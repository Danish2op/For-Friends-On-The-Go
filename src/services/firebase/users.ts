import { FirebaseError } from "firebase/app";
import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    type DocumentData,
} from "firebase/firestore";
import { auth, db } from "./config";

export type AvatarId = "1" | "2" | "3" | "4" | "5";

export interface UserProfile {
    uid: string;
    email: string;
    emailNormalized: string;
    username: string;
    usernameLower: string;
    avatarId: AvatarId;
    friends: string[];
    lastSeen: Timestamp | null;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
    profileVersion: number;
}

interface UsernameIndexEntry {
    uid: string;
    username: string;
    usernameLower: string;
    emailNormalized: string;
    avatarId: AvatarId;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

interface RegisterProfileInput {
    uid: string;
    email: string;
    username: string;
    avatarId: AvatarId;
}

export interface UsernameAvailabilityResult {
    normalizedUsername: string;
    usernameLower: string;
    available: boolean;
    ownerUid: string | null;
}

type IdentifierResolutionCode =
    | "invalid-identifier"
    | "identifier-not-found"
    | "lookup-unavailable";

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_SCHEMA_VERSION = 2;

const USER_COLLECTION = "users";
const USERNAME_INDEX_COLLECTION = "usernameIndex";

const isLookupTransportError = (error: FirebaseError) => {
    return (
        error.code === "unavailable"
        || error.code === "deadline-exceeded"
        || error.code === "resource-exhausted"
        || error.code === "cancelled"
        || error.code === "internal"
        || error.code === "unknown"
    );
};

const isAvatarId = (value: unknown): value is AvatarId =>
    value === "1" || value === "2" || value === "3" || value === "4" || value === "5";

const asTimestamp = (value: unknown): Timestamp | null => {
    if (value instanceof Timestamp) {
        return value;
    }
    if (typeof value === "object" && value !== null) {
        const withToMillis = value as { toMillis?: unknown };
        if (typeof withToMillis.toMillis === "function") {
            const millis = (withToMillis.toMillis as () => unknown)();
            if (typeof millis === "number" && Number.isFinite(millis)) {
                return Timestamp.fromMillis(millis);
            }
        }
    }
    return null;
};

const normalizeFriends = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
};

const usernameKeyFromValue = (value: string) => normalizeUsername(value).toLowerCase();

export class UsernameTakenError extends Error {
    constructor() {
        super("That username is already taken.");
        this.name = "UsernameTakenError";
    }
}

export class ProfileRegistrationError extends Error {
    code: string;

    constructor(code: string, message?: string) {
        super(message ?? "Profile registration failed.");
        this.name = "ProfileRegistrationError";
        this.code = code;
    }
}

export class IdentifierResolutionError extends Error {
    code: IdentifierResolutionCode;

    constructor(code: IdentifierResolutionCode, message: string) {
        super(message);
        this.name = "IdentifierResolutionError";
        this.code = code;
    }
}

export const normalizeUsername = (username: string) => username.trim();

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const validateUsernameFormat = (username: string) => {
    return USERNAME_REGEX.test(normalizeUsername(username));
};

export const validateEmailFormat = (email: string) => {
    return EMAIL_REGEX.test(normalizeEmail(email));
};

const parseUserProfile = (uid: string, payload: DocumentData): { profile: UserProfile; requiresRepair: boolean } | null => {
    const username = typeof payload.username === "string" ? normalizeUsername(payload.username) : "";
    const usernameLower =
        typeof payload.usernameLower === "string" && payload.usernameLower.trim().length > 0
            ? payload.usernameLower.trim().toLowerCase()
            : usernameKeyFromValue(username);

    const emailFromDoc = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const fallbackAuthEmail =
        auth.currentUser?.uid === uid && typeof auth.currentUser.email === "string"
            ? normalizeEmail(auth.currentUser.email)
            : "";
    const email = emailFromDoc || fallbackAuthEmail;
    const emailNormalized =
        typeof payload.emailNormalized === "string" && payload.emailNormalized.trim().length > 0
            ? normalizeEmail(payload.emailNormalized)
            : email;

    const avatarId = isAvatarId(payload.avatarId) ? payload.avatarId : "1";
    const friends = normalizeFriends(payload.friends);
    const createdAt = asTimestamp(payload.createdAt);
    const updatedAt = asTimestamp(payload.updatedAt);
    const lastSeen = asTimestamp(payload.lastSeen);
    const profileVersion =
        typeof payload.profileVersion === "number" && Number.isFinite(payload.profileVersion)
            ? payload.profileVersion
            : 1;

    if (!validateUsernameFormat(username)) {
        return null;
    }
    if (!validateEmailFormat(emailNormalized)) {
        return null;
    }

    const profile: UserProfile = {
        uid,
        email,
        emailNormalized,
        username,
        usernameLower,
        avatarId,
        friends,
        lastSeen,
        createdAt,
        updatedAt,
        profileVersion,
    };

    const requiresRepair =
        profile.uid !== payload.uid
        || payload.usernameLower !== usernameLower
        || payload.emailNormalized !== emailNormalized
        || payload.email !== email
        || !isAvatarId(payload.avatarId)
        || !Array.isArray(payload.friends)
        || profileVersion < PROFILE_SCHEMA_VERSION;

    return { profile, requiresRepair };
};

const ensureUsernameIndexForProfile = async (profile: UserProfile) => {
    const usernameIndexRef = doc(db, USERNAME_INDEX_COLLECTION, profile.usernameLower);
    await setDoc(
        usernameIndexRef,
        {
            uid: profile.uid,
            username: profile.username,
            usernameLower: profile.usernameLower,
            emailNormalized: profile.emailNormalized,
            avatarId: profile.avatarId,
            createdAt: profile.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
};

const repairUserProfile = async (profile: UserProfile) => {
    if (auth.currentUser?.uid !== profile.uid) {
        return;
    }

    try {
        await updateDoc(doc(db, USER_COLLECTION, profile.uid), {
            uid: profile.uid,
            email: profile.emailNormalized,
            emailNormalized: profile.emailNormalized,
            username: profile.username,
            usernameLower: profile.usernameLower,
            avatarId: profile.avatarId,
            friends: profile.friends,
            lastSeen: profile.lastSeen ?? serverTimestamp(),
            createdAt: profile.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
            profileVersion: PROFILE_SCHEMA_VERSION,
        });
        await ensureUsernameIndexForProfile(profile);
    } catch {
        // no-op, profile usage should not fail because repair failed
    }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const snapshot = await getDoc(doc(db, USER_COLLECTION, uid));
    if (!snapshot.exists()) {
        return null;
    }

    const parsed = parseUserProfile(uid, snapshot.data());
    if (!parsed) {
        return null;
    }

    if (parsed.requiresRepair) {
        void repairUserProfile(parsed.profile);
    }

    return parsed.profile;
};

export const resolveEmailForAuthIdentifier = async (identifier: string): Promise<string> => {
    const candidate = identifier.trim();
    if (!candidate) {
        throw new IdentifierResolutionError("invalid-identifier", "Email or username is required.");
    }

    if (candidate.includes("@")) {
        const normalized = normalizeEmail(candidate);
        if (!validateEmailFormat(normalized)) {
            throw new IdentifierResolutionError("invalid-identifier", "Email format is invalid.");
        }
        return normalized;
    }

    if (!validateUsernameFormat(candidate)) {
        throw new IdentifierResolutionError(
            "invalid-identifier",
            "Username must be 3-20 letters, numbers, or underscores."
        );
    }

    const usernameLower = usernameKeyFromValue(candidate);
    const usernameCandidates = [...new Set([usernameLower, normalizeUsername(candidate)])];

    for (const usernameKey of usernameCandidates) {
        const usernameIndexRef = doc(db, USERNAME_INDEX_COLLECTION, usernameKey);
        let usernameIndexSnap;
        try {
            usernameIndexSnap = await getDoc(usernameIndexRef);
        } catch (error: unknown) {
            if (error instanceof FirebaseError && isLookupTransportError(error)) {
                throw new IdentifierResolutionError(
                    "lookup-unavailable",
                    "Username lookup is temporarily unavailable. Use your email address or retry."
                );
            }
            throw error;
        }
        if (!usernameIndexSnap.exists()) {
            continue;
        }

        const usernameEntry = usernameIndexSnap.data() as Partial<UsernameIndexEntry>;
        const emailFromIndex =
            typeof usernameEntry.emailNormalized === "string"
                ? normalizeEmail(usernameEntry.emailNormalized)
                : "";

        if (validateEmailFormat(emailFromIndex)) {
            return emailFromIndex;
        }

        if (typeof usernameEntry.uid === "string" && usernameEntry.uid.length > 0) {
            try {
                const userSnap = await getDoc(doc(db, USER_COLLECTION, usernameEntry.uid));
                if (!userSnap.exists()) {
                    continue;
                }

                const userData = userSnap.data() as Partial<UserProfile>;
                const emailCandidate =
                    typeof userData.emailNormalized === "string"
                        ? normalizeEmail(userData.emailNormalized)
                        : typeof userData.email === "string"
                            ? normalizeEmail(userData.email)
                            : "";
                if (validateEmailFormat(emailCandidate)) {
                    return emailCandidate;
                }
            } catch (error) {
                if (error instanceof FirebaseError && error.code === "permission-denied") {
                    continue;
                }
                if (error instanceof FirebaseError && isLookupTransportError(error)) {
                    throw new IdentifierResolutionError(
                        "lookup-unavailable",
                        "Username lookup is temporarily unavailable. Use your email address or retry."
                    );
                }
                throw error;
            }
        }
    }

    throw new IdentifierResolutionError("identifier-not-found", "No account found for that username.");
};

export const checkUsernameAvailability = async (
    username: string,
    currentUid?: string | null
): Promise<UsernameAvailabilityResult> => {
    const normalizedUsername = normalizeUsername(username);
    if (!validateUsernameFormat(normalizedUsername)) {
        throw new IdentifierResolutionError(
            "invalid-identifier",
            "Username must be 3-20 letters, numbers, or underscores."
        );
    }

    const usernameLower = usernameKeyFromValue(normalizedUsername);
    const usernameRef = doc(db, USERNAME_INDEX_COLLECTION, usernameLower);
    const usernameSnap = await getDoc(usernameRef);
    if (!usernameSnap.exists()) {
        return {
            normalizedUsername,
            usernameLower,
            available: true,
            ownerUid: null,
        };
    }

    const ownerUid = ((usernameSnap.data() as Partial<UsernameIndexEntry>).uid as string | undefined) ?? null;
    if (currentUid && ownerUid === currentUid) {
        return {
            normalizedUsername,
            usernameLower,
            available: true,
            ownerUid,
        };
    }

    return {
        normalizedUsername,
        usernameLower,
        available: false,
        ownerUid,
    };
};

export const updateUserAvatar = async (uid: string, avatarId: AvatarId) => {
    const profile = await getUserProfile(uid);

    await updateDoc(doc(db, USER_COLLECTION, uid), {
        avatarId,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
        profileVersion: PROFILE_SCHEMA_VERSION,
    });

    if (profile?.usernameLower) {
        await setDoc(
            doc(db, USERNAME_INDEX_COLLECTION, profile.usernameLower),
            {
                uid,
                username: profile.username,
                usernameLower: profile.usernameLower,
                emailNormalized: profile.emailNormalized,
                avatarId,
                updatedAt: serverTimestamp(),
                createdAt: profile.createdAt ?? serverTimestamp(),
            },
            { merge: true }
        );
    }
};

export const touchUserLastSeen = async (uid: string) => {
    await updateDoc(doc(db, USER_COLLECTION, uid), {
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
        profileVersion: PROFILE_SCHEMA_VERSION,
    });
};

export const registerUserProfile = async (input: RegisterProfileInput): Promise<UserProfile> => {
    const username = normalizeUsername(input.username);
    const usernameLower = usernameKeyFromValue(username);
    const emailNormalized = normalizeEmail(input.email);

    if (!validateUsernameFormat(username)) {
        throw new Error("Username must be 3-20 characters and contain only letters, numbers, and underscores.");
    }
    if (!validateEmailFormat(emailNormalized)) {
        throw new Error("Email address format is invalid.");
    }
    if (!isAvatarId(input.avatarId)) {
        throw new Error("Invalid avatar selection.");
    }

    const userRef = doc(db, USER_COLLECTION, input.uid);
    const usernameRef = doc(db, USERNAME_INDEX_COLLECTION, usernameLower);

    try {
        await runTransaction(db, async (transaction) => {
            const [usernameSnap, userSnap] = await Promise.all([
                transaction.get(usernameRef),
                transaction.get(userRef),
            ]);

            if (usernameSnap.exists()) {
                const ownerUid = usernameSnap.data().uid as string;
                if (ownerUid !== input.uid) {
                    throw new UsernameTakenError();
                }
            }

            const now = serverTimestamp();
            const existingUser = userSnap.exists() ? (userSnap.data() as Partial<UserProfile>) : null;
            const existingCreatedAt = existingUser ? asTimestamp(existingUser.createdAt) : null;
            const existingFriends = normalizeFriends(existingUser?.friends);
            const existingUsernameLower =
                existingUser && typeof existingUser.usernameLower === "string"
                    ? existingUser.usernameLower.trim().toLowerCase()
                    : existingUser && typeof existingUser.username === "string"
                        ? usernameKeyFromValue(existingUser.username)
                        : null;

            if (existingUsernameLower && existingUsernameLower !== usernameLower) {
                throw new Error("Your account is already registered with a different username.");
            }

            transaction.set(userRef, {
                uid: input.uid,
                email: emailNormalized,
                emailNormalized,
                username,
                usernameLower,
                avatarId: input.avatarId,
                friends: existingFriends,
                lastSeen: now,
                createdAt: existingCreatedAt ?? now,
                updatedAt: now,
                profileVersion: PROFILE_SCHEMA_VERSION,
            });

            const existingIndexCreatedAt = usernameSnap.exists()
                ? asTimestamp((usernameSnap.data() as Partial<UsernameIndexEntry>).createdAt)
                : null;

            transaction.set(
                usernameRef,
                {
                    uid: input.uid,
                    username,
                    usernameLower,
                    emailNormalized,
                    avatarId: input.avatarId,
                    createdAt: existingIndexCreatedAt ?? now,
                    updatedAt: now,
                },
                { merge: true }
            );
        });
    } catch (error: unknown) {
        if (error instanceof UsernameTakenError) {
            throw error;
        }

        if (error instanceof FirebaseError) {
            if (error.code === "aborted" || error.code === "already-exists") {
                throw new UsernameTakenError();
            }
            if (error.code === "permission-denied") {
                throw new ProfileRegistrationError(
                    error.code,
                    "Profile registration permission was denied. Please retry in a few seconds."
                );
            }
            throw new ProfileRegistrationError(error.code, error.message);
        }

        throw error;
    }

    const registered = await getUserProfile(input.uid);
    if (!registered) {
        throw new Error("Profile creation did not complete. Please retry.");
    }

    return registered;
};
