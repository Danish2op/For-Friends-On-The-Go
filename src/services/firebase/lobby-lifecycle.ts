import { FirebaseError } from "firebase/app";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
    type Timestamp as FirestoreTimestamp
} from "firebase/firestore";
import { db } from "./config";
import { dedupeRecommendations } from "./recommendation-utils";

const SESSION_COLLECTION = "sessions";
const SESSION_CODE_COLLECTION = "sessionCodes";
const USER_COLLECTION = "users";

const LOBBY_INVITE_TTL_HOURS = 24;

const generateCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let value = "";
    for (let index = 0; index < 6; index += 1) {
        value += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return value;
};

const normalizeLobbyCode = (code: string) => code.trim().toUpperCase();
const normalizeDisplayName = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return "Friend";
    }
    return trimmed.slice(0, 64);
};

export interface CreateLobbyInput {
    hostUid: string;
    hostName: string;
    inviteeUids: string[];
    hostAvatarConfig?: any | null; // NiceAvatarConfig
}

export interface CreateLobbyResult {
    lobbyId: string;
    lobbyCode: string;
    invitedRecipientUids: string[];
}

export interface JoinLobbyInput {
    lobbyCode: string;
    userUid: string;
    userDisplayName: string;
    userAvatarConfig?: any | null;
}

export interface JoinLobbyResult {
    lobbyId: string;
    lobbyCode: string;
}

export type LobbyInviteStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export interface LobbyInvite {
    inviteId: string;
    lobbyId: string;
    lobbyCode: string;
    hostUid: string;
    hostUsername: string;
    recipientUid: string;
    status: LobbyInviteStatus;
    createdAt: FirestoreTimestamp | null;
    updatedAt: FirestoreTimestamp | null;
    expiresAt: FirestoreTimestamp | null;
    respondedAt: FirestoreTimestamp | null;
}

interface SessionDocument {
    code: string;
    hostId: string;
    status: string;
    maxParticipants?: number;
    participantsCount?: number;
}

const DEFAULT_MAX_LOBBY_PARTICIPANTS = 16;

const isInviteExpired = (invite: LobbyInvite) => {
    const expiresAtMillis = invite.expiresAt?.toMillis();
    if (!expiresAtMillis) {
        return false;
    }
    return Date.now() > expiresAtMillis;
};

const toTimestampMillis = (value: unknown): number => {
    if (!value) {
        return 0;
    }
    if (value instanceof Timestamp) {
        return value.toMillis();
    }
    if (typeof value === "object" && value !== null) {
        const withToMillis = value as { toMillis?: unknown };
        if (typeof withToMillis.toMillis === "function") {
            const millis = (withToMillis.toMillis as () => unknown)();
            if (typeof millis === "number" && Number.isFinite(millis)) {
                return millis;
            }
        }
    }
    return 0;
};

const ensureInviteOpen = (invite: LobbyInvite) => {
    if (invite.status !== "pending") {
        throw new Error("Invite is no longer pending.");
    }
    if (isInviteExpired(invite)) {
        throw new Error("Invite has expired.");
    }
};

const readLobbyCodeLookup = async (normalizedCode: string): Promise<string | null> => {
    const codeRef = doc(db, SESSION_CODE_COLLECTION, normalizedCode);
    const codeSnap = await getDoc(codeRef);
    if (!codeSnap.exists()) {
        return null;
    }

    const sessionId = (codeSnap.data().sessionId as string | undefined) ?? null;
    return sessionId;
};

const readLobbyIdFromSessionQuery = async (normalizedCode: string): Promise<string | null> => {
    const sessionsQuery = query(
        collection(db, SESSION_COLLECTION),
        where("code", "==", normalizedCode),
        limit(1)
    );
    const sessionSnapshot = await getDocs(sessionsQuery);
    if (sessionSnapshot.empty) {
        return null;
    }
    return sessionSnapshot.docs[0].id;
};

export const resolveLobbyIdFromCode = async (code: string): Promise<string> => {
    const normalizedCode = normalizeLobbyCode(code);
    if (!normalizedCode) {
        throw new Error("Lobby code is required.");
    }

    const fromLookup = await readLobbyCodeLookup(normalizedCode);
    if (fromLookup) {
        return fromLookup;
    }

    const fromSessionQuery = await readLobbyIdFromSessionQuery(normalizedCode);
    if (!fromSessionQuery) {
        throw new Error("Lobby not found.");
    }

    await updateDoc(doc(db, SESSION_CODE_COLLECTION, normalizedCode), {
        sessionId: fromSessionQuery,
        updatedAt: serverTimestamp(),
    }).catch(() => undefined);

    return fromSessionQuery;
};

export const createLobbySession = async (input: CreateLobbyInput): Promise<CreateLobbyResult> => {
    const hostDisplayName = normalizeDisplayName(input.hostName);
    const uniqueInvitees = [...new Set(input.inviteeUids)]
        .filter((uid): uid is string => Boolean(uid))
        .filter((uid) => uid !== input.hostUid);

    const sessionRef = doc(collection(db, SESSION_COLLECTION));
    const inviteExpiry = Timestamp.fromMillis(
        Date.now() + LOBBY_INVITE_TTL_HOURS * 60 * 60 * 1000
    );

    let selectedCode = "";
    let attempts = 0;

    while (attempts < 8) {
        attempts += 1;
        const candidateCode = generateCode();
        const codeRef = doc(db, SESSION_CODE_COLLECTION, candidateCode);

        try {
            await runTransaction(db, async (transaction) => {
                const codeSnap = await transaction.get(codeRef);
                if (codeSnap.exists()) {
                    throw new Error("code-collision");
                }

                const now = serverTimestamp();
                transaction.set(codeRef, {
                    sessionId: sessionRef.id,
                    code: candidateCode,
                    createdAt: now,
                    updatedAt: now,
                });
                transaction.set(sessionRef, {
                    code: candidateCode,
                    hostId: input.hostUid,
                    status: "WAITING",
                    maxParticipants: DEFAULT_MAX_LOBBY_PARTICIPANTS,
                    participantsCount: 1,
                    createdAt: now,
                    updatedAt: now,
                });
                transaction.set(doc(db, SESSION_COLLECTION, sessionRef.id, "participants", input.hostUid), {
                    uid: input.hostUid,
                    displayName: hostDisplayName,
                    isReady: false,
                    joinedAt: now,
                    updatedAt: now,
                    avatarConfig: input.hostAvatarConfig ?? null,
                });

                uniqueInvitees.forEach((recipientUid) => {
                    transaction.set(doc(db, USER_COLLECTION, recipientUid, "lobbyInvites", sessionRef.id), {
                        inviteId: sessionRef.id,
                        lobbyId: sessionRef.id,
                        lobbyCode: candidateCode,
                        hostUid: input.hostUid,
                        hostUsername: input.hostName,
                        recipientUid,
                        status: "pending",
                        createdAt: now,
                        updatedAt: now,
                        respondedAt: null,
                        expiresAt: inviteExpiry,
                    });
                });
            });

            selectedCode = candidateCode;
            break;
        } catch (error) {
            if (error instanceof Error && error.message === "code-collision") {
                continue;
            }
            throw error;
        }
    }

    if (!selectedCode) {
        throw new Error("Unable to reserve a unique lobby code. Please retry.");
    }

    return {
        lobbyId: sessionRef.id,
        lobbyCode: selectedCode,
        invitedRecipientUids: uniqueInvitees,
    };
};

export const joinLobbyByCode = async (input: JoinLobbyInput): Promise<JoinLobbyResult> => {
    const normalizedCode = normalizeLobbyCode(input.lobbyCode);
    const normalizedDisplayName = normalizeDisplayName(input.userDisplayName);
    if (!normalizedCode) {
        throw new Error("Lobby code is required.");
    }

    const lobbyId = await resolveLobbyIdFromCode(normalizedCode);
    const sessionRef = doc(db, SESSION_COLLECTION, lobbyId);
    const participantRef = doc(db, SESSION_COLLECTION, lobbyId, "participants", input.userUid);

    await runTransaction(db, async (transaction) => {
        const [sessionSnap, participantSnap] = await Promise.all([
            transaction.get(sessionRef),
            transaction.get(participantRef),
        ]);
        if (!sessionSnap.exists()) {
            throw new Error("Lobby not found.");
        }

        const sessionData = sessionSnap.data() as SessionDocument;
        if (sessionData.status === "FINISHED") {
            throw new Error("Lobby has already ended.");
        }

        const maxParticipants = typeof sessionData.maxParticipants === "number" && Number.isFinite(sessionData.maxParticipants)
            ? Math.max(1, Math.floor(sessionData.maxParticipants))
            : DEFAULT_MAX_LOBBY_PARTICIPANTS;
        const trackedCount = typeof sessionData.participantsCount === "number" && Number.isFinite(sessionData.participantsCount)
            ? Math.max(0, Math.floor(sessionData.participantsCount))
            : 0;
        const alreadyJoined = participantSnap.exists();

        if (!alreadyJoined && trackedCount >= maxParticipants) {
            throw new Error("Lobby is full.");
        }

        const now = serverTimestamp();
        if (alreadyJoined) {
            transaction.update(participantRef, {
                updatedAt: now,
            });
        } else {
            transaction.set(participantRef, {
                uid: input.userUid,
                displayName: normalizedDisplayName,
                isReady: false,
                joinedAt: now,
                updatedAt: now,
                avatarConfig: input.userAvatarConfig ?? null,
            });
            transaction.update(sessionRef, {
                updatedAt: now,
                participantsCount: trackedCount + 1,
            });
        }
    });

    return {
        lobbyId,
        lobbyCode: normalizedCode,
    };
};

export const acceptLobbyInvite = async (
    recipientUid: string,
    inviteId: string,
    recipientDisplayName: string,
    recipientAvatarConfig?: any | null
): Promise<JoinLobbyResult> => {
    const normalizedDisplayName = normalizeDisplayName(recipientDisplayName);
    const inviteRef = doc(db, USER_COLLECTION, recipientUid, "lobbyInvites", inviteId);
    const sessionRef = doc(db, SESSION_COLLECTION, inviteId);
    const participantRef = doc(db, SESSION_COLLECTION, inviteId, "participants", recipientUid);
    let lobbyCode = "";

    await runTransaction(db, async (transaction) => {
        const [inviteSnap, sessionSnap] = await Promise.all([
            transaction.get(inviteRef),
            transaction.get(sessionRef),
        ]);

        if (!inviteSnap.exists()) {
            throw new Error("Invite no longer exists.");
        }
        if (!sessionSnap.exists()) {
            throw new Error("Lobby no longer exists.");
        }

        const invite = inviteSnap.data() as LobbyInvite;
        ensureInviteOpen(invite);
        lobbyCode = invite.lobbyCode;

        const session = sessionSnap.data() as SessionDocument;
        if (session.status === "FINISHED") {
            throw new Error("Lobby has already ended.");
        }
        const maxParticipants = typeof session.maxParticipants === "number" && Number.isFinite(session.maxParticipants)
            ? Math.max(1, Math.floor(session.maxParticipants))
            : DEFAULT_MAX_LOBBY_PARTICIPANTS;
        const trackedCount = typeof session.participantsCount === "number" && Number.isFinite(session.participantsCount)
            ? Math.max(0, Math.floor(session.participantsCount))
            : 0;
        const participantSnap = await transaction.get(participantRef);
        const alreadyJoined = participantSnap.exists();
        if (!alreadyJoined && trackedCount >= maxParticipants) {
            throw new Error("Lobby is full.");
        }

        const now = serverTimestamp();
        if (alreadyJoined) {
            transaction.update(participantRef, {
                updatedAt: now,
            });
        } else {
            transaction.set(participantRef, {
                uid: recipientUid,
                displayName: normalizedDisplayName,
                isReady: false,
                joinedAt: now,
                updatedAt: now,
                avatarConfig: recipientAvatarConfig ?? null,
            });
        }
        transaction.update(inviteRef, {
            status: "accepted",
            respondedAt: now,
            updatedAt: now,
        });
        if (!alreadyJoined) {
            transaction.update(sessionRef, {
                updatedAt: now,
                participantsCount: trackedCount + 1,
            });
        }
    });

    return {
        lobbyId: inviteId,
        lobbyCode,
    };
};

export const leaveLobbySession = async (sessionId: string, userId: string): Promise<void> => {
    if (!sessionId || !userId) {
        throw new Error("Session ID and User ID are required to leave.");
    }

    const sessionRef = doc(db, SESSION_COLLECTION, sessionId);
    const participantRef = doc(db, SESSION_COLLECTION, sessionId, "participants", userId);

    await runTransaction(db, async (transaction) => {
        const [sessionSnap, participantSnap] = await Promise.all([
            transaction.get(sessionRef),
            transaction.get(participantRef),
        ]);

        if (!participantSnap.exists()) {
            return;
        }

        if (sessionSnap.exists()) {
            const sessionData = sessionSnap.data() as SessionDocument;
            const currentCount = typeof sessionData.participantsCount === "number" && Number.isFinite(sessionData.participantsCount)
                ? Math.max(0, Math.floor(sessionData.participantsCount))
                : 1;

            transaction.update(sessionRef, {
                participantsCount: Math.max(0, currentCount - 1),
                updatedAt: serverTimestamp(),
            });
        }

        transaction.delete(participantRef);
    });
};

export interface StartLobbyVotingInput {
    sessionId: string;
    center: { lat: number; lng: number };
    places: Record<string, unknown>[];
    durationMinutes?: number;
}

export const startLobbyVoting = async (input: StartLobbyVotingInput): Promise<void> => {
    const { sessionId, center, places, durationMinutes = 3 } = input;
    if (!sessionId) {
        throw new Error("Session ID is required to start voting.");
    }

    const sessionRef = doc(db, SESSION_COLLECTION, sessionId);
    const votingEndTime = Timestamp.fromMillis(Date.now() + durationMinutes * 60000);
    const normalizedPlaces = dedupeRecommendations(places);

    if (normalizedPlaces.length === 0) {
        throw new Error("No valid places available for voting.");
    }

    await updateDoc(sessionRef, {
        status: "VOTING",
        centerPoint: center,
        recommendations: normalizedPlaces,
        votingEndTime,
        updatedAt: serverTimestamp(),
    });
};

export const rejectLobbyInvite = async (recipientUid: string, inviteId: string) => {
    const inviteRef = doc(db, USER_COLLECTION, recipientUid, "lobbyInvites", inviteId);

    await runTransaction(db, async (transaction) => {
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists()) {
            throw new Error("Invite no longer exists.");
        }

        const invite = inviteSnap.data() as LobbyInvite;
        if (invite.status !== "pending") {
            throw new Error("Invite is no longer pending.");
        }

        const now = serverTimestamp();
        transaction.update(inviteRef, {
            status: "rejected",
            respondedAt: now,
            updatedAt: now,
        });
    });
};

export const subscribeIncomingLobbyInvites = (
    uid: string,
    onUpdate: (invites: LobbyInvite[]) => void,
    onError?: (error: Error) => void
) => {
    const baseCollection = collection(db, USER_COLLECTION, uid, "lobbyInvites");
    const indexedQuery = query(
        baseCollection,
        where("status", "==", "pending"),
        orderBy("updatedAt", "desc"),
        limit(10)
    );
    const fallbackQuery = query(baseCollection, where("status", "==", "pending"));

    const normalizeInvites = (rawInvites: LobbyInvite[], shouldSortClient: boolean) => {
        const pendingInvites = rawInvites.filter((invite) => {
            if (!isInviteExpired(invite)) {
                return true;
            }

            updateDoc(doc(db, USER_COLLECTION, uid, "lobbyInvites", invite.inviteId), {
                status: "expired",
                updatedAt: serverTimestamp(),
            }).catch(() => undefined);
            return false;
        });

        if (!shouldSortClient) {
            return pendingInvites;
        }

        return [...pendingInvites]
            .sort((left, right) => toTimestampMillis(right.updatedAt) - toTimestampMillis(left.updatedAt))
            .slice(0, 10);
    };

    let fallbackUnsubscribe: (() => void) | null = null;

    const indexedUnsubscribe = onSnapshot(
        indexedQuery,
        (snapshot) => {
            const invites = snapshot.docs.map((item) => ({ ...item.data(), inviteId: item.id } as LobbyInvite));
            onUpdate(normalizeInvites(invites, false));
        },
        (error) => {
            if (!(error instanceof FirebaseError) || error.code !== "failed-precondition") {
                if (onError) {
                    onError(error);
                }
                return;
            }

            if (fallbackUnsubscribe) {
                return;
            }

            fallbackUnsubscribe = onSnapshot(
                fallbackQuery,
                (fallbackSnapshot) => {
                    const invites = fallbackSnapshot.docs.map(
                        (item) => ({ ...item.data(), inviteId: item.id } as LobbyInvite)
                    );
                    onUpdate(normalizeInvites(invites, true));
                },
                (fallbackError) => {
                    if (onError) {
                        onError(fallbackError);
                    }
                }
            );
        }
    );

    return () => {
        indexedUnsubscribe();
        if (fallbackUnsubscribe) {
            fallbackUnsubscribe();
        }
    };
};

// ──────────────────────────────────────────────────────────
// Exit Lobby With Cleanup (Host Delegation + Status)
// ──────────────────────────────────────────────────────────

export interface ExitLobbyResult {
    wasHost: boolean;
    newHostUid: string | null;
    lobbyAbandoned: boolean;
    sessionCode: string;
}

export const exitLobbyWithCleanup = async (
    sessionId: string,
    userId: string
): Promise<ExitLobbyResult> => {
    if (!sessionId || !userId) {
        throw new Error("Session ID and User ID are required.");
    }

    const sessionRef = doc(db, SESSION_COLLECTION, sessionId);
    const participantRef = doc(db, SESSION_COLLECTION, sessionId, "participants", userId);
    const participantsCollectionRef = collection(db, SESSION_COLLECTION, sessionId, "participants");

    let result: ExitLobbyResult = {
        wasHost: false,
        newHostUid: null,
        lobbyAbandoned: false,
        sessionCode: "",
    };

    await runTransaction(db, async (transaction) => {
        const [sessionSnap, participantSnap] = await Promise.all([
            transaction.get(sessionRef),
            transaction.get(participantRef),
        ]);

        if (!participantSnap.exists()) {
            // User already removed — no-op
            if (sessionSnap.exists()) {
                result.sessionCode = (sessionSnap.data() as SessionDocument).code ?? "";
            }
            return;
        }

        if (!sessionSnap.exists()) {
            // Session gone — just clean up participant
            transaction.delete(participantRef);
            return;
        }

        const sessionData = sessionSnap.data() as SessionDocument;
        result.sessionCode = sessionData.code ?? "";

        const isHost = sessionData.hostId === userId;
        result.wasHost = isHost;

        const currentCount = typeof sessionData.participantsCount === "number" && Number.isFinite(sessionData.participantsCount)
            ? Math.max(0, Math.floor(sessionData.participantsCount))
            : 1;

        const newCount = Math.max(0, currentCount - 1);

        // Build the session update payload
        const sessionUpdate: Record<string, unknown> = {
            participantsCount: newCount,
            updatedAt: serverTimestamp(),
        };

        if (newCount === 0) {
            // Last person leaving — abandon the lobby
            sessionUpdate.status = "ABANDONED";
            result.lobbyAbandoned = true;
        } else if (isHost) {
            // Host is leaving but others remain — delegate
            // We need to find the next oldest participant
            // Read all participants within the transaction
            const allParticipantsSnap = await getDocs(
                query(participantsCollectionRef, orderBy("joinedAt", "asc"), limit(DEFAULT_MAX_LOBBY_PARTICIPANTS))
            );

            let nextHostUid: string | null = null;
            for (const participantDoc of allParticipantsSnap.docs) {
                const pData = participantDoc.data() as { uid?: string };
                if (pData.uid && pData.uid !== userId) {
                    nextHostUid = pData.uid;
                    break;
                }
            }

            if (nextHostUid) {
                sessionUpdate.hostId = nextHostUid;
                result.newHostUid = nextHostUid;
            } else {
                // No valid next host found — abandon
                sessionUpdate.status = "ABANDONED";
                result.lobbyAbandoned = true;
            }
        }

        transaction.update(sessionRef, sessionUpdate);
        transaction.delete(participantRef);
    });

    return result;
};
