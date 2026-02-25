import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, waitForFirebaseInitialization } from "../services/firebase/config";
import { AvatarId, getUserProfile, type UserProfile } from "../services/firebase/users";

interface AuthContextValue {
    userId: string | null;
    displayName: string;
    username: string | null;
    avatarId: AvatarId | null;
    friends: string[];
    profileState: "idle" | "loading" | "ready" | "missing" | "error";
    profileError: string | null;
    token: string | null;
    authMode: "firebase";
    loading: boolean;
    signedIn: boolean;
    profileComplete: boolean;
    signInWithName: (name: string) => Promise<string>;
    updateDisplayName: (name: string) => Promise<void>;
    refreshProfile: () => Promise<UserProfile | null>;
    signOut: () => Promise<void>;
}

interface AuthProviderProps {
    children: React.ReactNode;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getFallbackDisplayName = () => {
    const email = auth.currentUser?.email?.trim();
    if (!email) {
        return "";
    }
    const localPart = email.split("@")[0] ?? "";
    return localPart.trim();
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const shouldRetryProfileRead = (error: unknown) => {
    if (error instanceof FirebaseError) {
        return (
            error.code === "permission-denied"
            || error.code === "unavailable"
            || error.code === "deadline-exceeded"
            || error.code === "resource-exhausted"
            || error.code === "cancelled"
            || error.code === "internal"
            || error.code === "unknown"
        );
    }

    if (error instanceof Error) {
        return /permission|network|offline|timeout/i.test(error.message);
    }

    return false;
};

const fetchProfileWithRetry = async (uid: string) => {
    try {
        return await getUserProfile(uid);
    } catch (error: unknown) {
        const shouldRetry = shouldRetryProfileRead(error) && auth.currentUser?.uid === uid;
        if (!shouldRetry || !auth.currentUser) {
            throw error;
        }

        await auth.currentUser.getIdToken(true);
        await wait(200);
        return getUserProfile(uid);
    }
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [authReady, setAuthReady] = useState(false);
    const [userId, setUserId] = useState<string | null>(auth.currentUser?.uid ?? null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileState, setProfileState] = useState<"idle" | "loading" | "ready" | "missing" | "error">(
        auth.currentUser?.uid ? "loading" : "idle"
    );
    const [profileError, setProfileError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        let unsubscribe: (() => void) | null = null;

        const bootstrapAuth = async () => {
            await waitForFirebaseInitialization();
            if (!active) {
                return;
            }

            unsubscribe = onAuthStateChanged(auth, (user) => {
                if (!active) {
                    return;
                }
                setUserId(user?.uid ?? null);
                if (!user?.uid) {
                    setProfile(null);
                    setProfileState("idle");
                    setProfileError(null);
                }
                setAuthReady(true);
            });
        };

        bootstrapAuth().catch(() => {
            if (!active) {
                return;
            }
            setUserId(auth.currentUser?.uid ?? null);
            setAuthReady(true);
        });

        return () => {
            active = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    useEffect(() => {
        let active = true;

        const syncProfile = async () => {
            if (!userId) {
                if (active) {
                    setProfile(null);
                    setProfileLoading(false);
                    setProfileState("idle");
                    setProfileError(null);
                }
                return;
            }

            if (active) {
                setProfileLoading(true);
                setProfileState("loading");
                setProfileError(null);
            }

            try {
                const existingProfile = await fetchProfileWithRetry(userId);
                if (active) {
                    setProfile(existingProfile);
                    setProfileState(existingProfile ? "ready" : "missing");
                }
            } catch (error: unknown) {
                if (active) {
                    setProfileState("error");
                    setProfileError(error instanceof Error ? error.message : "Profile sync failed.");
                }
            } finally {
                if (active) {
                    setProfileLoading(false);
                }
            }
        };

        syncProfile().catch(() => {
            if (active) {
                setProfileState("error");
                setProfileError("Profile sync failed.");
                setProfileLoading(false);
            }
        });

        return () => {
            active = false;
        };
    }, [userId]);

    const refreshProfile = useCallback(async () => {
        const currentUid = auth.currentUser?.uid ?? null;
        if (!currentUid) {
            setProfile(null);
            setProfileState("idle");
            setProfileError(null);
            return null;
        }

        setProfileLoading(true);
        setProfileState("loading");
        setProfileError(null);

        try {
            const latest = await fetchProfileWithRetry(currentUid);
            setProfile(latest);
            setProfileState(latest ? "ready" : "missing");
            return latest;
        } catch (error: unknown) {
            setProfileState("error");
            setProfileError(error instanceof Error ? error.message : "Profile sync failed.");
            throw error;
        } finally {
            setProfileLoading(false);
        }
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
        setProfile(null);
        setProfileState("idle");
        setProfileError(null);
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            userId,
            displayName: profile?.username ?? getFallbackDisplayName(),
            username: profile?.username ?? null,
            avatarId: profile?.avatarId ?? null,
            friends: profile?.friends ?? [],
            profileState,
            profileError,
            token: null,
            authMode: "firebase",
            loading: !authReady || profileLoading,
            signedIn: Boolean(userId),
            profileComplete: profileState === "ready",
            signInWithName: async () => {
                if (!userId) {
                    throw new Error("A Firebase session is required.");
                }
                return userId;
            },
            updateDisplayName: async () => {
                throw new Error("Display name updates are managed through the profile service.");
            },
            refreshProfile,
            signOut,
        }),
        [authReady, profile, profileError, profileLoading, profileState, refreshProfile, signOut, userId]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAppAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAppAuth must be used within AuthProvider");
    }
    return context;
};
