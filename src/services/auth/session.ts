import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const SESSION_KEY = "ffotg.auth.jwt.session.v1";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export interface AuthSession {
    userId: string;
    displayName: string;
    token: string;
    expiresAt: number;
    provider: "jwt-local";
}

const toUtf8Bytes = (value: string) => {
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(value);
    }

    const escaped = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_match, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
    );

    return Uint8Array.from(escaped, (char) => char.charCodeAt(0));
};

const encodeBase64 = (value: string) => {
    const bytes = toUtf8Bytes(value);
    let output = "";

    for (let i = 0; i < bytes.length; i += 3) {
        const byte1 = bytes[i];
        const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

        const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

        output += BASE64_ALPHABET[(chunk >> 18) & 63];
        output += BASE64_ALPHABET[(chunk >> 12) & 63];
        output += i + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : "=";
        output += i + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : "=";
    }

    return output;
};

const encodeBase64Url = (value: string) =>
    encodeBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 32) || "Traveler";

const buildToken = async (userId: string, displayName: string, expiresAt: number) => {
    const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = encodeBase64Url(
        JSON.stringify({
            sub: userId,
            name: displayName,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(expiresAt / 1000),
            iss: "forfriendsonthego-local",
        })
    );

    const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${header}.${payload}.${userId}:${expiresAt}`,
        { encoding: Crypto.CryptoEncoding.HEX }
    );

    return `${header}.${payload}.${signature}`;
};

const safeParse = (raw: string | null) => {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthSession;
    } catch {
        return null;
    }
};

const isSessionValid = (session: AuthSession | null): session is AuthSession => {
    if (!session) return false;
    return Boolean(session.userId && session.token && session.displayName) && session.expiresAt > Date.now();
};

export const restoreAuthSession = async () => {
    const stored = safeParse(await AsyncStorage.getItem(SESSION_KEY));
    if (!isSessionValid(stored)) {
        await AsyncStorage.removeItem(SESSION_KEY);
        return null;
    }
    return stored;
};

export const createOrRefreshSession = async (name: string, existing?: AuthSession | null) => {
    const displayName = normalizeName(name);
    const userId = existing?.userId || Crypto.randomUUID();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const token = await buildToken(userId, displayName, expiresAt);

    const session: AuthSession = {
        userId,
        displayName,
        token,
        expiresAt,
        provider: "jwt-local",
    };

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
};

export const clearAuthSession = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
};
