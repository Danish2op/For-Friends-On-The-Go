import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./config";
import { dedupeRecommendations } from "./recommendation-utils";

const createCustomPlaceId = () => {
    const suffix = Math.floor(Math.random() * 10_000).toString().padStart(4, "0");
    return `custom_${Date.now()}_${suffix}`;
};

export const addCustomRecommendation = async (sessionId: string, place: any) => {
    try {
        const sessionRef = doc(db, "sessions", sessionId);

        const placeId = typeof place?.place_id === "string" && place.place_id.trim()
            ? place.place_id.trim()
            : createCustomPlaceId();

        const newPlace = {
            ...place,
            place_id: placeId,
            description: place.description || place.name || "Custom Location",
            name: place.name || "Custom Location",
            votes: 0,
            voters: [],
            isCustom: true,
        };

        await runTransaction(db, async (transaction) => {
            const sessionSnap = await transaction.get(sessionRef);
            if (!sessionSnap.exists()) {
                throw new Error("Session no longer exists.");
            }

            const sessionData = sessionSnap.data() as { recommendations?: unknown };
            const existing = Array.isArray(sessionData.recommendations) ? sessionData.recommendations : [];
            const mergedRecommendations = dedupeRecommendations([...existing, newPlace]);

            transaction.update(sessionRef, {
                recommendations: mergedRecommendations,
                updatedAt: serverTimestamp(),
            });
        });

        console.log("✅ Added custom place:", newPlace.name);
        return true;
    } catch (error) {
        console.error("❌ Error adding custom recommendation:", error);
        return false;
    }
};
