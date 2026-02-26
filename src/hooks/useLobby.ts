import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../services/firebase/config";

export interface Recommendation {
    place_id: string;
    reference?: string;
    description?: string;
    structured_formatting?: {
        main_text?: string;
        secondary_text?: string;
    };
    voters?: string[];
    votes?: number;
}

export interface Session {
    code: string;
    hostId: string;
    status: string;
    votingEndTime?: { toMillis: () => number } | number;
    recommendations?: Recommendation[];
}

import { type NiceAvatarConfig } from "../constants/avatars";

export interface Participant {
    uid: string;
    displayName: string;
    avatarConfig?: NiceAvatarConfig | null;
    isReady: boolean;
    location?: {
        lat: number;
        lng: number;
    };
}

export function useLobby(sessionId: string) {
    const [session, setSession] = useState<Session | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sessionId) {
            setSession(null);
            setParticipants([]);
            setLoading(false);
            return;
        }

        let isActive = true;
        let hasSessionSnapshot = false;
        let hasParticipantsSnapshot = false;

        const settleLoading = () => {
            if (isActive && hasSessionSnapshot && hasParticipantsSnapshot) {
                setLoading(false);
            }
        };

        setLoading(true);

        // Subscribe to session document
        const sessionRef = doc(db, "sessions", sessionId);
        const unsubSession = onSnapshot(
            sessionRef,
            (docSnapshot) => {
                if (!isActive) {
                    return;
                }

                hasSessionSnapshot = true;
                if (docSnapshot.exists()) {
                    setSession(docSnapshot.data() as Session);
                } else {
                    setSession(null);
                }
                settleLoading();
            },
            () => {
                if (!isActive) {
                    return;
                }

                hasSessionSnapshot = true;
                setSession(null);
                settleLoading();
            }
        );

        // Subscribe to participants collection
        const participantsRef = collection(db, "sessions", sessionId, "participants");
        const unsubParticipants = onSnapshot(
            participantsRef,
            (snapshot) => {
                if (!isActive) {
                    return;
                }

                hasParticipantsSnapshot = true;
                const participantsList = snapshot.docs.map((participantDoc) => participantDoc.data() as Participant);
                setParticipants(participantsList);
                settleLoading();
            },
            () => {
                if (!isActive) {
                    return;
                }

                hasParticipantsSnapshot = true;
                setParticipants([]);
                settleLoading();
            }
        );

        return () => {
            isActive = false;
            unsubSession();
            unsubParticipants();
        };
    }, [sessionId]);

    return { session, participants, loading };
}
