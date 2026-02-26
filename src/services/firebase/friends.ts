import { FirebaseError } from "firebase/app";
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    where,
    type Timestamp,
} from "firebase/firestore";
import { type NiceAvatarConfig } from "../../constants/avatars";
import { db } from "./config";
import {
    checkUsernameAvailability,
    getUserProfile,
    normalizeUsername,
    validateUsernameFormat,
    type AvatarId,
    type UserProfile,
} from "./users";

export interface FriendProfile {
    uid: string;
    username: string;
    avatarId: AvatarId;
    avatarConfig: NiceAvatarConfig | null;
}

export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

interface FriendRequestRecord {
    requesterUid: string;
    requesterUsername: string;
    requesterAvatarId: AvatarId;
    requesterAvatarConfig: NiceAvatarConfig | null;
    targetUid: string;
    targetUsername: string;
    targetAvatarId: AvatarId;
    targetAvatarConfig: NiceAvatarConfig | null;
    status: FriendRequestStatus;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    respondedAt: Timestamp | null;
}

export interface IncomingFriendRequest {
    requesterUid: string;
    requesterUsername: string;
    requesterAvatarId: AvatarId;
    requesterAvatarConfig: NiceAvatarConfig | null;
    status: FriendRequestStatus;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    respondedAt: Timestamp | null;
}

export interface OutgoingFriendRequest {
    targetUid: string;
    targetUsername: string;
    targetAvatarId: AvatarId;
    targetAvatarConfig: NiceAvatarConfig | null;
    status: FriendRequestStatus;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    respondedAt: Timestamp | null;
}

const toFriendProfile = (profile: UserProfile): FriendProfile => ({
    uid: profile.uid,
    username: profile.username,
    avatarId: profile.avatarId,
    avatarConfig: profile.avatarConfig,
});

const toIncomingRequest = (record: FriendRequestRecord): IncomingFriendRequest => ({
    requesterUid: record.requesterUid,
    requesterUsername: record.requesterUsername,
    requesterAvatarId: record.requesterAvatarId,
    requesterAvatarConfig: record.requesterAvatarConfig ?? null,
    status: record.status,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    respondedAt: record.respondedAt ?? null,
});

const toOutgoingRequest = (record: FriendRequestRecord): OutgoingFriendRequest => ({
    targetUid: record.targetUid,
    targetUsername: record.targetUsername,
    targetAvatarId: record.targetAvatarId,
    targetAvatarConfig: record.targetAvatarConfig ?? null,
    status: record.status,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    respondedAt: record.respondedAt ?? null,
});

const readUser = async (uid: string) => {
    const profile = await getUserProfile(uid);
    if (!profile) {
        throw new Error("User profile not found.");
    }
    return profile;
};

const areMutualFriends = (first: UserProfile, second: UserProfile) => {
    return first.friends.includes(second.uid) && second.friends.includes(first.uid);
};

export const findUserByExactUsername = async (username: string): Promise<FriendProfile | null> => {
    const exactUsername = normalizeUsername(username);
    if (!validateUsernameFormat(exactUsername)) {
        throw new Error("Username must be an exact 3-20 character match.");
    }

    const usernameAvailability = await checkUsernameAvailability(exactUsername);
    if (usernameAvailability.available || !usernameAvailability.ownerUid) {
        return null;
    }

    const found = await readUser(usernameAvailability.ownerUid);
    if (found.username !== exactUsername) {
        return null;
    }

    return toFriendProfile(found);
};

export const listFriendProfilesByIds = async (uids: string[]): Promise<FriendProfile[]> => {
    const uniqueUids = [...new Set(uids)].filter((uid): uid is string => Boolean(uid));
    if (uniqueUids.length === 0) {
        return [];
    }

    const profiles = await Promise.all(uniqueUids.map(async (uid) => getUserProfile(uid)));
    return profiles
        .filter((profile): profile is UserProfile => profile !== null)
        .map(toFriendProfile);
};

export const createFriendRequestByExactUsername = async (
    requesterUid: string,
    username: string
): Promise<FriendProfile> => {
    const target = await findUserByExactUsername(username);
    if (!target) {
        throw new Error("No user found with that exact username.");
    }

    if (target.uid === requesterUid) {
        throw new Error("You cannot add yourself.");
    }

    const requester = await readUser(requesterUid);
    const targetProfile = await readUser(target.uid);

    if (areMutualFriends(requester, targetProfile)) {
        throw new Error("You are already friends.");
    }

    const incomingRequestRef = doc(db, "users", target.uid, "friendRequests", requesterUid);
    const outgoingRequestRef = doc(db, "users", requesterUid, "sentFriendRequests", target.uid);
    const reverseIncomingRef = doc(db, "users", requesterUid, "friendRequests", target.uid);

    try {
        await runTransaction(db, async (transaction) => {
            const [incomingSnap, outgoingSnap, reverseIncomingSnap] = await Promise.all([
                transaction.get(incomingRequestRef),
                transaction.get(outgoingRequestRef),
                transaction.get(reverseIncomingRef),
            ]);

            if (reverseIncomingSnap.exists()) {
                const reverseRequest = reverseIncomingSnap.data() as FriendRequestRecord;
                if (reverseRequest.status === "pending") {
                    throw new Error("You already have a pending request from this user.");
                }
            }

            if (incomingSnap.exists()) {
                const incomingRequest = incomingSnap.data() as FriendRequestRecord;
                if (incomingRequest.status === "pending") {
                    throw new Error("Friend request already sent.");
                }
            }

            if (outgoingSnap.exists()) {
                const outgoingRequest = outgoingSnap.data() as FriendRequestRecord;
                if (outgoingRequest.status === "pending") {
                    throw new Error("Friend request already sent.");
                }
            }

            const now = serverTimestamp();
            const requestPayload: Omit<FriendRequestRecord, "createdAt" | "updatedAt" | "respondedAt"> = {
                requesterUid: requester.uid,
                requesterUsername: requester.username,
                requesterAvatarId: requester.avatarId,
                requesterAvatarConfig: requester.avatarConfig,
                targetUid: targetProfile.uid,
                targetUsername: targetProfile.username,
                targetAvatarId: targetProfile.avatarId,
                targetAvatarConfig: targetProfile.avatarConfig,
                status: "pending",
            };

            transaction.set(incomingRequestRef, {
                ...requestPayload,
                createdAt: now,
                updatedAt: now,
                respondedAt: null,
            });
            transaction.set(outgoingRequestRef, {
                ...requestPayload,
                createdAt: now,
                updatedAt: now,
                respondedAt: null,
            });
            transaction.update(doc(db, "users", requesterUid), {
                lastSeen: now,
                updatedAt: now,
            });
        });
    } catch (error: unknown) {
        if (error instanceof FirebaseError && error.code === "permission-denied") {
            const [latestRequester, latestTarget] = await Promise.all([readUser(requesterUid), readUser(target.uid)]);
            if (areMutualFriends(latestRequester, latestTarget)) {
                throw new Error("You are already friends.");
            }
        }
        throw error;
    }

    return target;
};

export const subscribeIncomingFriendRequests = (
    uid: string,
    onUpdate: (items: IncomingFriendRequest[]) => void,
    onError?: (error: Error) => void
) => {
    const requestsQuery = query(
        collection(db, "users", uid, "friendRequests"),
        where("status", "==", "pending"),
        orderBy("updatedAt", "desc")
    );

    return onSnapshot(
        requestsQuery,
        (snapshot) => {
            const items = snapshot.docs.map((item) => toIncomingRequest(item.data() as FriendRequestRecord));
            onUpdate(items);
        },
        (error) => {
            if (onError) {
                onError(error);
            }
        }
    );
};

export const subscribeOutgoingFriendRequests = (
    uid: string,
    onUpdate: (items: OutgoingFriendRequest[]) => void,
    onError?: (error: Error) => void
) => {
    const requestsQuery = query(
        collection(db, "users", uid, "sentFriendRequests"),
        where("status", "==", "pending"),
        orderBy("updatedAt", "desc")
    );

    return onSnapshot(
        requestsQuery,
        (snapshot) => {
            const items = snapshot.docs.map((item) => toOutgoingRequest(item.data() as FriendRequestRecord));
            onUpdate(items);
        },
        (error) => {
            if (onError) {
                onError(error);
            }
        }
    );
};

const transitionRequestStatus = async (
    recipientUid: string,
    requesterUid: string,
    nextStatus: Exclude<FriendRequestStatus, "pending">
) => {
    if (recipientUid === requesterUid) {
        throw new Error("Invalid friend request.");
    }

    const incomingRequestRef = doc(db, "users", recipientUid, "friendRequests", requesterUid);
    const outgoingRequestRef = doc(db, "users", requesterUid, "sentFriendRequests", recipientUid);
    const recipientRef = doc(db, "users", recipientUid);
    const requesterRef = doc(db, "users", requesterUid);

    await runTransaction(db, async (transaction) => {
        const [incomingSnap, outgoingSnap, recipientSnap, requesterSnap] = await Promise.all([
            transaction.get(incomingRequestRef),
            transaction.get(outgoingRequestRef),
            transaction.get(recipientRef),
            transaction.get(requesterRef),
        ]);

        if (!incomingSnap.exists()) {
            throw new Error("Friend request no longer exists.");
        }
        if (!outgoingSnap.exists()) {
            throw new Error("Friend request is out of sync. Please retry.");
        }
        if (!recipientSnap.exists() || !requesterSnap.exists()) {
            throw new Error("One of the users no longer exists.");
        }

        const incoming = incomingSnap.data() as FriendRequestRecord;
        if (incoming.status !== "pending") {
            throw new Error("Friend request is no longer pending.");
        }

        const now = serverTimestamp();

        transaction.update(incomingRequestRef, {
            status: nextStatus,
            respondedAt: now,
            updatedAt: now,
        });
        transaction.update(outgoingRequestRef, {
            status: nextStatus,
            respondedAt: now,
            updatedAt: now,
        });

        if (nextStatus === "accepted") {
            transaction.update(recipientRef, {
                friends: arrayUnion(requesterUid),
                lastSeen: now,
                updatedAt: now,
            });
            transaction.update(requesterRef, {
                friends: arrayUnion(recipientUid),
                lastSeen: now,
                updatedAt: now,
            });
        }
    });
};

export const respondToFriendRequest = async (
    recipientUid: string,
    requesterUid: string,
    action: "accept" | "reject"
) => {
    await transitionRequestStatus(recipientUid, requesterUid, action === "accept" ? "accepted" : "rejected");
};

export const cancelOutgoingFriendRequest = async (requesterUid: string, targetUid: string) => {
    if (requesterUid === targetUid) {
        throw new Error("Invalid cancellation target.");
    }

    const incomingRequestRef = doc(db, "users", targetUid, "friendRequests", requesterUid);
    const outgoingRequestRef = doc(db, "users", requesterUid, "sentFriendRequests", targetUid);

    await runTransaction(db, async (transaction) => {
        const [incomingSnap, outgoingSnap] = await Promise.all([
            transaction.get(incomingRequestRef),
            transaction.get(outgoingRequestRef),
        ]);

        if (!incomingSnap.exists() || !outgoingSnap.exists()) {
            throw new Error("Friend request no longer exists.");
        }

        const incoming = incomingSnap.data() as FriendRequestRecord;
        if (incoming.status !== "pending") {
            throw new Error("Only pending requests can be cancelled.");
        }

        const now = serverTimestamp();
        transaction.update(incomingRequestRef, {
            status: "cancelled",
            respondedAt: now,
            updatedAt: now,
        });
        transaction.update(outgoingRequestRef, {
            status: "cancelled",
            respondedAt: now,
            updatedAt: now,
        });
    });
};

export const removeFriendBidirectional = async (requesterUid: string, friendUid: string) => {
    if (requesterUid === friendUid) {
        throw new Error("Invalid friend target.");
    }

    const requester = await readUser(requesterUid);
    const friend = await readUser(friendUid);
    if (!areMutualFriends(requester, friend)) {
        throw new Error("Friend is already removed.");
    }

    const requesterRef = doc(db, "users", requesterUid);
    const friendRef = doc(db, "users", friendUid);

    try {
        await runTransaction(db, async (transaction) => {
            const [requesterSnap, friendSnap] = await Promise.all([
                transaction.get(requesterRef),
                transaction.get(friendRef),
            ]);

            if (!requesterSnap.exists() || !friendSnap.exists()) {
                throw new Error("Friend data no longer exists.");
            }

            const now = serverTimestamp();
            transaction.update(requesterRef, {
                friends: arrayRemove(friendUid),
                lastSeen: now,
                updatedAt: now,
            });
            transaction.update(friendRef, {
                friends: arrayRemove(requesterUid),
                lastSeen: now,
                updatedAt: now,
            });
        });
    } catch (error: unknown) {
        if (error instanceof FirebaseError && error.code === "permission-denied") {
            const [latestRequester, latestFriend] = await Promise.all([readUser(requesterUid), readUser(friendUid)]);
            if (!areMutualFriends(latestRequester, latestFriend)) {
                return;
            }
        }
        throw error;
    }
};
