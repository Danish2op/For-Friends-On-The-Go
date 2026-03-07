import type { ConfigContext, ExpoConfig } from "@expo/config";

// Load .env.local into process.env BEFORE Metro bundles the JS.
// This is critical: EXPO_PUBLIC_* vars are inlined at bundle time.
// .easignore ensures .env.local is in the EAS build archive.
try {
    const { config: loadDotenv } = require("dotenv");
    const path = require("path");
    loadDotenv({ path: path.resolve(__dirname, ".env.local"), override: false });
} catch {
    // dotenv not available — env vars must already be in process.env
}

const EAS_PROJECT_ID = "450150cf-ce6f-4b59-8aff-90ce8ed80884";

const isPlaceholder = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes("replace") || lower.includes("placeholder") || lower.includes("your_");
};

/**
 * Non-throwing env reader for build-time config injection.
 * Returns the value if present and valid, otherwise returns fallback.
 * Runtime validation still occurs in src/config/env.ts at app startup.
 */
const getEnv = (name: string, fallback = ""): string => {
    const value = (process.env[name] ?? "").trim();
    if (!value || isPlaceholder(value)) {
        if (process.env.EAS_BUILD === "true" || process.env.CI === "true") {
            console.warn(
                `[app.config] ⚠️ ${name} is missing or placeholder. ` +
                `Ensure it is set in EAS secrets or shell env before building.`
            );
        }
        return fallback;
    }
    return value;
};

export default ({ config }: ConfigContext): ExpoConfig => {
    getEnv("EXPO_PUBLIC_OLA_MAPS_API_KEY");
    const googleMapsApiKey = getEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");

    return {
        ...config,
        name: "ForFriendsOnTheGo",
        slug: "ForFriendsOnTheGo-App",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/images/Gemini_Generated_Image_bqiykfbqiykfbqiy-removebg-preview.png",
        scheme: "forfriendsonthego",
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.danishsharma.ForFriendsOnTheGo",
        },
        android: {
            adaptiveIcon: {
                backgroundColor: "#000000",
                foregroundImage: "./assets/images/Gemini_Generated_Image_bqiykfbqiykfbqiy-removebg-preview.png",
            },
            package: "com.danishsharma.ForFriendsOnTheGo",
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false,
            googleServicesFile: "./google-services.json",
            config: {
                googleMaps: {
                    apiKey: googleMapsApiKey,
                },
            },
            permissions: [
                "android.permission.INTERNET",
                "android.permission.ACCESS_NETWORK_STATE",
                "android.permission.ACCESS_COARSE_LOCATION",
                "android.permission.ACCESS_FINE_LOCATION",
            ],
        },
        web: {
            output: "static",
            favicon: "./assets/images/Gemini_Generated_Image_bqiykfbqiykfbqiy-removebg-preview.png",
        },
        plugins: [
            "expo-router",
            [
                "expo-location",
                {
                    locationAlwaysAndWhenInUsePermission:
                        "Allow ForFriendsOnTheGo to use your location.",
                },
            ],
            "expo-notifications",
            [
                "expo-splash-screen",
                {
                    image: "./assets/images/Gemini_Generated_Image_bqiykfbqiykfbqiy-removebg-preview.png",
                    imageWidth: 200,
                    resizeMode: "contain",
                    backgroundColor: "#ffffff",
                    dark: {
                        backgroundColor: "#000000",
                    },
                },
            ],
        ],
        experiments: {
            typedRoutes: true,
            reactCompiler: true,
        },
        extra: {
            router: {},
            eas: {
                projectId: EAS_PROJECT_ID,
            },
        },
        runtimeVersion: {
            policy: "appVersion",
        },
        updates: {
            url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
        },
    };
};
