import { getApp, getApps, initializeApp } from "firebase/app";
import * as FirebaseAuth from "firebase/auth";
import {
    CACHE_SIZE_UNLIMITED,
    getFirestore,
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    type Firestore,
} from "firebase/firestore";
import { Platform } from "react-native";

type Auth = FirebaseAuth.Auth;
type Persistence = FirebaseAuth.Persistence;

type AsyncStorageLike = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<unknown>;
    removeItem: (key: string) => Promise<unknown>;
};

// ── Defensive AsyncStorage import ────────────────────────────────────────────
// On iOS hot reloads the NativeModule can be null before the bridge
// finishes initialising. We import lazily and fall back to a transient
// in-memory store so `config.ts` module evaluation never hard-crashes and
// cascades into "missing default export" for every route.

const _memoryFallback: Record<string, string> = {};
const memoryStorage: AsyncStorageLike = {
    getItem: async (key) => _memoryFallback[key] ?? null,
    setItem: async (key, value) => { _memoryFallback[key] = value; },
    removeItem: async (key) => { delete _memoryFallback[key]; },
};

let _asyncStorage: AsyncStorageLike | null = null;
const getAsyncStorage = (): AsyncStorageLike => {
    if (_asyncStorage) return _asyncStorage;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("@react-native-async-storage/async-storage");
        const resolved = mod?.default ?? mod;
        if (resolved && typeof resolved.getItem === "function") {
            _asyncStorage = resolved as AsyncStorageLike;
            return _asyncStorage;
        }
    } catch (e) {
        console.warn("[config] AsyncStorage native module unavailable — using memory fallback:", e);
    }
    return memoryStorage;
};

const envFirebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
const envFirebaseWebApiKey = process.env.EXPO_PUBLIC_FIREBASE_WEB_API_KEY?.trim();
const envFirebaseAuthDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
const envFirebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
const envFirebaseStorageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
const envFirebaseMessagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
const envFirebaseAppId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim();
const envFirebaseWebAppId = process.env.EXPO_PUBLIC_FIREBASE_WEB_APP_ID?.trim();

const coalesce = (...values: (string | undefined)[]) => {
    for (const value of values) {
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
    }
    return null;
};

const defaultFirebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
};

const webBackedConfig = {
    apiKey: coalesce(envFirebaseApiKey, envFirebaseWebApiKey) ?? defaultFirebaseConfig.apiKey,
    authDomain: coalesce(envFirebaseAuthDomain) ?? defaultFirebaseConfig.authDomain,
    projectId: coalesce(envFirebaseProjectId) ?? defaultFirebaseConfig.projectId,
    storageBucket: coalesce(envFirebaseStorageBucket) ?? defaultFirebaseConfig.storageBucket,
    messagingSenderId: coalesce(envFirebaseMessagingSenderId) ?? defaultFirebaseConfig.messagingSenderId,
    appId: coalesce(envFirebaseAppId, envFirebaseWebAppId) ?? defaultFirebaseConfig.appId,
};

const firebaseConfig = webBackedConfig;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const authModule = FirebaseAuth as unknown as {
    getAuth: typeof FirebaseAuth.getAuth;
    initializeAuth: typeof FirebaseAuth.initializeAuth;
    getReactNativePersistence?: (storage: AsyncStorageLike) => Persistence;
};

const createFallbackReactNativePersistence = (storage: AsyncStorageLike): Persistence => {
    const STORAGE_PROBE_KEY = "__ffotg_firebase_auth_probe__";

    class ReactNativePersistence {
        static type = "LOCAL";
        readonly type = "LOCAL";

        async _isAvailable() {
            try {
                await storage.setItem(STORAGE_PROBE_KEY, "1");
                await storage.removeItem(STORAGE_PROBE_KEY);
                return true;
            } catch {
                return false;
            }
        }

        async _set(key: string, value: unknown) {
            await storage.setItem(key, JSON.stringify(value));
        }

        async _get(key: string) {
            const value = await storage.getItem(key);
            if (!value) {
                return null;
            }
            return JSON.parse(value);
        }

        async _remove(key: string) {
            await storage.removeItem(key);
        }

        _addListener(_key: string, _listener: () => void) {
            return;
        }

        _removeListener(_key: string, _listener: () => void) {
            return;
        }
    }

    return ReactNativePersistence as unknown as Persistence;
};

const initializeFirebaseAuth = (): Auth => {
    if (Platform.OS === "web") {
        return authModule.getAuth(app);
    }

    try {
        const storage = getAsyncStorage();
        const persistence =
            typeof authModule.getReactNativePersistence === "function"
                ? authModule.getReactNativePersistence(storage)
                : createFallbackReactNativePersistence(storage);

        return authModule.initializeAuth(app, { persistence });
    } catch {
        return authModule.getAuth(app);
    }
};

const auth = initializeFirebaseAuth();
const initializeFirebaseFirestore = (): Firestore => {
    const androidLikeRuntime = Platform.OS === "android";
    const sharedSettings = {
        ignoreUndefinedProperties: true,
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        experimentalAutoDetectLongPolling: !androidLikeRuntime,
        experimentalForceLongPolling: androidLikeRuntime,
        useFetchStreams: !androidLikeRuntime,
    };

    try {
        if (Platform.OS === "web") {
            return initializeFirestore(app, {
                ...sharedSettings,
                localCache: persistentLocalCache(),
            });
        }

        return initializeFirestore(app, {
            ...sharedSettings,
            localCache: memoryLocalCache(),
        });
    } catch {
        return getFirestore(app);
    }
};

const db = initializeFirebaseFirestore();

const waitForFirebaseInitialization = async () => {
    const authWithStateReady = auth as Auth & {
        authStateReady?: () => Promise<void>;
    };

    if (typeof authWithStateReady.authStateReady === "function") {
        await authWithStateReady.authStateReady();
        return;
    }

    await new Promise<void>((resolve) => {
        const unsubscribe = FirebaseAuth.onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
        });
    });
};

export { app, auth, db, waitForFirebaseInitialization };
