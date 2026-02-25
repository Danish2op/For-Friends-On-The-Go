import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "./config";
import { dedupeRecommendations } from "./recommendation-utils";

const generateCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

export const createSession = async (hostId: string, hostName: string) => {
    const code = generateCode();
    const sessionRef = await addDoc(collection(db, "sessions"), {
        code,
        hostId,
        status: "WAITING",
        createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "sessions", sessionRef.id, "participants", hostId), {
        uid: hostId,
        displayName: hostName,
        isReady: false,
    });

    return { sessionId: sessionRef.id, code };
};

export const joinSession = async (
    sessionId: string,
    userId: string,
    userName: string
) => {
    await setDoc(doc(db, "sessions", sessionId, "participants", userId), {
        uid: userId,
        displayName: userName,
        isReady: false,
    });
};

export const leaveSession = async (sessionId: string, userId: string) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const participantRef = doc(db, "sessions", sessionId, "participants", userId);

    await runTransaction(db, async (transaction) => {
        const [sessionSnap, participantSnap] = await Promise.all([
            transaction.get(sessionRef),
            transaction.get(participantRef),
        ]);

        if (!participantSnap.exists()) {
            return;
        }

        transaction.delete(participantRef);

        if (!sessionSnap.exists()) {
            return;
        }

        const sessionData = sessionSnap.data() as { participantsCount?: unknown };
        const currentCount = typeof sessionData.participantsCount === "number" && Number.isFinite(sessionData.participantsCount)
            ? Math.max(0, Math.floor(sessionData.participantsCount))
            : 1;

        transaction.update(sessionRef, {
            participantsCount: Math.max(0, currentCount - 1),
            updatedAt: serverTimestamp(),
        });
    });
};

export const subscribeToSession = (
    sessionId: string,
    onUpdate: (data: any) => void
) => {
    return onSnapshot(doc(db, "sessions", sessionId), (doc) => {
        onUpdate(doc.data());
    });
};

export const getSessionIdFromCode = async (code: string) => {
    const q = query(collection(db, "sessions"), where("code", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error("Session not found");
    }

    return snapshot.docs[0].id;
};

export const startVoting = async (
    sessionId: string,
    center: any,
    places: any[],
    durationMinutes: number = 3
) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const votingEndTime = Timestamp.fromMillis(Date.now() + durationMinutes * 60000);
    const normalizedPlaces = dedupeRecommendations(places);

    if (normalizedPlaces.length === 0) {
        throw new Error("No valid places available for voting.");
    }

    await updateDoc(sessionRef, {
        status: "VOTING",
        centerPoint: center,
        recommendations: normalizedPlaces,
        votingEndTime: votingEndTime,
        updatedAt: serverTimestamp(),
    });
};

export const castVote = async (sessionId: string, placeId: string, userId: string) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
        return;
    }

    const sessionData = sessionSnap.data() as { recommendations?: unknown };
    const currentRecs = dedupeRecommendations(sessionData.recommendations);
    const normalizedTargetId = placeId.trim().toLowerCase();
    let matched = false;

    const updatedRecs = currentRecs.map((rec: any) => {
        const recPlaceId = typeof rec.place_id === "string" ? rec.place_id.trim().toLowerCase() : "";
        if (matched || !recPlaceId || recPlaceId !== normalizedTargetId) {
            return rec;
        }

        matched = true;
        const voters = Array.isArray(rec.voters)
            ? rec.voters.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
            : [];
        const hasVoted = voters.includes(userId);
        const newVoters = hasVoted ? voters.filter((id: string) => id !== userId) : [...voters, userId];

        return { ...rec, voters: newVoters, votes: newVoters.length };
    });

    if (!matched) {
        return;
    }

    await updateDoc(sessionRef, {
        recommendations: updatedRecs,
        updatedAt: serverTimestamp(),
    });
};

export const finishVoting = async (sessionId: string) => {
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
        return;
    }

    const sessionData = sessionSnap.data() as { recommendations?: unknown };
    const currentRecs = dedupeRecommendations(sessionData.recommendations);
    const sortedRecs = [...currentRecs].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
    const winner = sortedRecs.length > 0 ? sortedRecs[0] : null;

    await updateDoc(sessionRef, {
        status: "FINISHED",
        recommendations: currentRecs,
        winningPlace: winner,
        updatedAt: serverTimestamp(),
    });
};
