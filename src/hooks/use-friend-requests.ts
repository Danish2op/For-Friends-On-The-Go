import { FirebaseError } from "firebase/app";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    where,
    type QuerySnapshot,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "../services/firebase/config";
import type {
    FriendRequestStatus,
    IncomingFriendRequest,
    OutgoingFriendRequest,
} from "../services/firebase/friends";

type FriendRequestRecord = {
    requesterUid?: unknown;
    requesterUsername?: unknown;
    requesterAvatarId?: unknown;
    targetUid?: unknown;
    targetUsername?: unknown;
    targetAvatarId?: unknown;
    status?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    respondedAt?: unknown;
};

type FirestoreTimestampLike =
    | Timestamp
    | {
        toMillis?: () => number;
        toDate?: () => Date;
        seconds?: number;
        nanoseconds?: number;
    }
    | null
    | undefined;

const isFriendRequestStatus = (value: unknown): value is FriendRequestStatus => {
    return value === "pending" || value === "accepted" || value === "rejected" || value === "cancelled";
};

const toAvatarId = (value: unknown): "1" | "2" | "3" | "4" | "5" => {
    if (value === "1" || value === "2" || value === "3" || value === "4" || value === "5") {
        return value;
    }
    return "1";
};

const asTimestamp = (value: FirestoreTimestampLike): Timestamp | null => {
    if (!value) {
        return null;
    }
    if (value instanceof Timestamp) {
        return value;
    }

    if (typeof value === "object") {
        if (typeof value.toMillis === "function") {
            const millis = value.toMillis();
            if (Number.isFinite(millis)) {
                return Timestamp.fromMillis(millis);
            }
        }

        if (typeof value.toDate === "function") {
            const date = value.toDate();
            if (date instanceof Date && !Number.isNaN(date.getTime())) {
                return Timestamp.fromDate(date);
            }
        }

        if (typeof value.seconds === "number") {
            const nanos = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
            return new Timestamp(value.seconds, nanos);
        }
    }

    return null;
};

const toMillis = (value: FirestoreTimestampLike) => {
    const normalized = asTimestamp(value);
    return normalized ? normalized.toMillis() : 0;
};

const sortByUpdatedAtDesc = <T extends { updatedAt: FirestoreTimestampLike; createdAt: FirestoreTimestampLike }>(
    items: T[]
) => {
    return [...items].sort((a, b) => {
        const aMillis = toMillis(a.updatedAt) || toMillis(a.createdAt);
        const bMillis = toMillis(b.updatedAt) || toMillis(b.createdAt);
        return bMillis - aMillis;
    });
};

const isIndexMissingError = (error: unknown) => {
    return error instanceof FirebaseError && error.code === "failed-precondition";
};

const toIncoming = (raw: FriendRequestRecord): IncomingFriendRequest | null => {
    if (!isFriendRequestStatus(raw.status) || raw.status !== "pending") {
        return null;
    }
    if (typeof raw.requesterUid !== "string" || raw.requesterUid.trim().length === 0) {
        return null;
    }
    if (typeof raw.requesterUsername !== "string" || raw.requesterUsername.trim().length === 0) {
        return null;
    }

    return {
        requesterUid: raw.requesterUid.trim(),
        requesterUsername: raw.requesterUsername.trim(),
        requesterAvatarId: toAvatarId(raw.requesterAvatarId),
        status: raw.status,
        createdAt: asTimestamp(raw.createdAt as FirestoreTimestampLike),
        updatedAt: asTimestamp(raw.updatedAt as FirestoreTimestampLike),
        respondedAt: asTimestamp(raw.respondedAt as FirestoreTimestampLike),
    };
};

const toOutgoing = (raw: FriendRequestRecord): OutgoingFriendRequest | null => {
    if (!isFriendRequestStatus(raw.status) || raw.status !== "pending") {
        return null;
    }
    if (typeof raw.targetUid !== "string" || raw.targetUid.trim().length === 0) {
        return null;
    }
    if (typeof raw.targetUsername !== "string" || raw.targetUsername.trim().length === 0) {
        return null;
    }

    return {
        targetUid: raw.targetUid.trim(),
        targetUsername: raw.targetUsername.trim(),
        targetAvatarId: toAvatarId(raw.targetAvatarId),
        status: raw.status,
        createdAt: asTimestamp(raw.createdAt as FirestoreTimestampLike),
        updatedAt: asTimestamp(raw.updatedAt as FirestoreTimestampLike),
        respondedAt: asTimestamp(raw.respondedAt as FirestoreTimestampLike),
    };
};

const mapIncomingSnapshot = (snapshot: QuerySnapshot) => {
    return snapshot.docs
        .map((item) => toIncoming(item.data() as FriendRequestRecord))
        .filter((item): item is IncomingFriendRequest => Boolean(item));
};

const mapOutgoingSnapshot = (snapshot: QuerySnapshot) => {
    return snapshot.docs
        .map((item) => toOutgoing(item.data() as FriendRequestRecord))
        .filter((item): item is OutgoingFriendRequest => Boolean(item));
};

interface FriendRequestsState {
    incomingRequests: IncomingFriendRequest[];
    outgoingRequests: OutgoingFriendRequest[];
    incomingRequestsLoading: boolean;
    outgoingRequestsLoading: boolean;
    loadingRequests: boolean;
    requestsError: string | null;
}

export const useFriendRequests = (uid: string | null): FriendRequestsState => {
    const [incomingRequests, setIncomingRequests] = useState<IncomingFriendRequest[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<OutgoingFriendRequest[]>([]);
    const [incomingRequestsLoading, setIncomingRequestsLoading] = useState(false);
    const [outgoingRequestsLoading, setOutgoingRequestsLoading] = useState(false);
    const [requestsError, setRequestsError] = useState<string | null>(null);

    useEffect(() => {
        if (!uid) {
            setIncomingRequests([]);
            setIncomingRequestsLoading(false);
            return;
        }

        let disposed = false;
        let fallbackUnsubscribe: (() => void) | null = null;

        setIncomingRequestsLoading(true);
        setRequestsError(null);

        const baseRef = collection(db, "users", uid, "friendRequests");
        const primaryQuery = query(baseRef, where("status", "==", "pending"), orderBy("updatedAt", "desc"));
        const fallbackQuery = query(baseRef, where("status", "==", "pending"));

        const unsubscribe = onSnapshot(
            primaryQuery,
            (snapshot) => {
                if (disposed) {
                    return;
                }
                setIncomingRequests(mapIncomingSnapshot(snapshot));
                setIncomingRequestsLoading(false);
            },
            (error) => {
                if (disposed) {
                    return;
                }

                if (!isIndexMissingError(error) || fallbackUnsubscribe) {
                    setIncomingRequestsLoading(false);
                    setRequestsError(error.message);
                    return;
                }

                fallbackUnsubscribe = onSnapshot(
                    fallbackQuery,
                    (fallbackSnapshot) => {
                        if (disposed) {
                            return;
                        }
                        const mapped = mapIncomingSnapshot(fallbackSnapshot);
                        setIncomingRequests(sortByUpdatedAtDesc(mapped));
                        setIncomingRequestsLoading(false);
                    },
                    (fallbackError) => {
                        if (disposed) {
                            return;
                        }
                        setIncomingRequestsLoading(false);
                        setRequestsError(fallbackError.message);
                    }
                );
            }
        );

        return () => {
            disposed = true;
            unsubscribe();
            if (fallbackUnsubscribe) {
                fallbackUnsubscribe();
            }
        };
    }, [uid]);

    useEffect(() => {
        if (!uid) {
            setOutgoingRequests([]);
            setOutgoingRequestsLoading(false);
            return;
        }

        let disposed = false;
        let fallbackUnsubscribe: (() => void) | null = null;

        setOutgoingRequestsLoading(true);
        setRequestsError(null);

        const baseRef = collection(db, "users", uid, "sentFriendRequests");
        const primaryQuery = query(baseRef, where("status", "==", "pending"), orderBy("updatedAt", "desc"));
        const fallbackQuery = query(baseRef, where("status", "==", "pending"));

        const unsubscribe = onSnapshot(
            primaryQuery,
            (snapshot) => {
                if (disposed) {
                    return;
                }
                setOutgoingRequests(mapOutgoingSnapshot(snapshot));
                setOutgoingRequestsLoading(false);
            },
            (error) => {
                if (disposed) {
                    return;
                }

                if (!isIndexMissingError(error) || fallbackUnsubscribe) {
                    setOutgoingRequestsLoading(false);
                    setRequestsError(error.message);
                    return;
                }

                fallbackUnsubscribe = onSnapshot(
                    fallbackQuery,
                    (fallbackSnapshot) => {
                        if (disposed) {
                            return;
                        }
                        const mapped = mapOutgoingSnapshot(fallbackSnapshot);
                        setOutgoingRequests(sortByUpdatedAtDesc(mapped));
                        setOutgoingRequestsLoading(false);
                    },
                    (fallbackError) => {
                        if (disposed) {
                            return;
                        }
                        setOutgoingRequestsLoading(false);
                        setRequestsError(fallbackError.message);
                    }
                );
            }
        );

        return () => {
            disposed = true;
            unsubscribe();
            if (fallbackUnsubscribe) {
                fallbackUnsubscribe();
            }
        };
    }, [uid]);

    const loadingRequests = useMemo(
        () => incomingRequestsLoading || outgoingRequestsLoading,
        [incomingRequestsLoading, outgoingRequestsLoading]
    );

    return {
        incomingRequests,
        outgoingRequests,
        incomingRequestsLoading,
        outgoingRequestsLoading,
        loadingRequests,
        requestsError,
    };
};
