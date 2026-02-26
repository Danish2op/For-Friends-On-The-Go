import {
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    type Timestamp,
} from "firebase/firestore";
import { db } from "./config";

export type LobbyRole = "host" | "guest";

export type LobbyHistoryStatus = "WAITING" | "VOTING" | "FINISHED" | "EXITED" | "ABANDONED" | "UNKNOWN";

export interface LobbyHistoryItem {
    sessionId: string;
    code: string;
    role: LobbyRole;
    status: LobbyHistoryStatus;
    joinedAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

interface RecordLobbyHistoryInput {
    uid: string;
    sessionId: string;
    code: string;
    role: LobbyRole;
    status?: LobbyHistoryStatus;
}

export const recordLobbyHistory = async (input: RecordLobbyHistoryInput) => {
    const historyRef = doc(db, "users", input.uid, "history", input.sessionId);
    await setDoc(
        historyRef,
        {
            sessionId: input.sessionId,
            code: input.code.toUpperCase(),
            role: input.role,
            status: input.status ?? "WAITING",
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
};

export const updateLobbyHistoryStatus = async (
    uid: string,
    sessionId: string,
    status: LobbyHistoryStatus,
    roleOverride?: LobbyRole
) => {
    const historyRef = doc(db, "users", uid, "history", sessionId);
    const update: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
    };
    if (roleOverride) {
        update.role = roleOverride;
    }
    await setDoc(historyRef, update, { merge: true });
};

export const subscribeLobbyHistory = (
    uid: string,
    onUpdate: (items: LobbyHistoryItem[]) => void,
    maxItems: number = 25,
    onError?: (error: Error) => void
) => {
    const historyQuery = query(
        collection(db, "users", uid, "history"),
        orderBy("updatedAt", "desc"),
        limit(maxItems)
    );

    return onSnapshot(
        historyQuery,
        (snapshot) => {
            const items = snapshot.docs.map((item) => item.data() as LobbyHistoryItem);
            onUpdate(items);
        },
        (error) => {
            console.error("[subscribeLobbyHistory] Firestore listener error:", error);
            // Unblock the UI — deliver an empty list so the spinner stops.
            onUpdate([]);
            onError?.(error);
        }
    );
};
