import AsyncStorage from "@react-native-async-storage/async-storage";
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
        const persistence =
            typeof authModule.getReactNativePersistence === "function"
                ? authModule.getReactNativePersistence(AsyncStorage)
                : createFallbackReactNativePersistence(AsyncStorage);

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
