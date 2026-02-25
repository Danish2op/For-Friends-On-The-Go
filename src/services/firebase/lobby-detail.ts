import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    type Timestamp,
} from "firebase/firestore";
import { db } from "./config";

export interface LobbyDetailParticipant {
    uid: string;
    displayName: string;
    joinedAt: Timestamp | null;
    isReady: boolean;
}

export interface LobbyDetailRecommendation {
    place_id: string;
    name?: string;
    description?: string;
    votes?: number;
    voters?: string[];
}

export interface LobbyDetail {
    sessionId: string;
    code: string;
    hostId: string;
    status: string;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    participantsCount: number;
    participants: LobbyDetailParticipant[];
    recommendations: LobbyDetailRecommendation[];
    winningPlace: LobbyDetailRecommendation | null;
    missionStarted: boolean;
    finalDestination: string | null;
}

export const fetchLobbyDetail = async (sessionId: string): Promise<LobbyDetail | null> => {
    if (!sessionId) {
        return null;
    }

    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
        return null;
    }

    const data = sessionSnap.data() as Record<string, unknown>;

    // Fetch participants
    const participantsQuery = query(
        collection(db, "sessions", sessionId, "participants"),
        orderBy("joinedAt", "asc")
    );
    const participantsSnap = await getDocs(participantsQuery);
    const participants: LobbyDetailParticipant[] = participantsSnap.docs.map((d) => {
        const p = d.data() as Record<string, unknown>;
        return {
            uid: (p.uid as string) ?? d.id,
            displayName: (p.displayName as string) ?? "Unknown",
            joinedAt: (p.joinedAt as Timestamp) ?? null,
            isReady: (p.isReady as boolean) ?? false,
        };
    });

    // Extract recommendations
    const rawRecs = Array.isArray(data.recommendations) ? data.recommendations : [];
    const recommendations: LobbyDetailRecommendation[] = rawRecs.map((r: Record<string, unknown>) => ({
        place_id: (r.place_id as string) ?? "",
        name: (r.name as string) ?? undefined,
        description: (r.description as string) ?? undefined,
        votes: typeof r.votes === "number" ? r.votes : 0,
        voters: Array.isArray(r.voters) ? (r.voters as string[]) : [],
    }));

    // Extract winning place
    const rawWinning = data.winningPlace as Record<string, unknown> | undefined;
    const winningPlace: LobbyDetailRecommendation | null = rawWinning
        ? {
            place_id: (rawWinning.place_id as string) ?? "",
            name: (rawWinning.name as string) ?? undefined,
            description: (rawWinning.description as string) ?? undefined,
            votes: typeof rawWinning.votes === "number" ? rawWinning.votes : 0,
        }
        : null;

    const status = (data.status as string) ?? "UNKNOWN";
    const missionStarted = status === "FINISHED" || status === "VOTING";
    const finalDestination = winningPlace
        ? winningPlace.description?.split(",")[0] || winningPlace.name || null
        : null;

    return {
        sessionId,
        code: (data.code as string) ?? "",
        hostId: (data.hostId as string) ?? "",
        status,
        createdAt: (data.createdAt as Timestamp) ?? null,
        updatedAt: (data.updatedAt as Timestamp) ?? null,
        participantsCount: typeof data.participantsCount === "number" ? data.participantsCount : participants.length,
        participants,
        recommendations,
        winningPlace,
        missionStarted,
        finalDestination,
    };
};
