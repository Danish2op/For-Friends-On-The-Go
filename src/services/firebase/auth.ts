import { createOrRefreshSession } from "../auth/session";

export const signInAsGuest = async (displayName: string = "Traveler") => {
    return createOrRefreshSession(displayName);
};
