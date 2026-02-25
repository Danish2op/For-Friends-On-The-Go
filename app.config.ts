import type { ConfigContext, ExpoConfig } from "@expo/config";

const EAS_PROJECT_ID = "450150cf-ce6f-4b59-8aff-90ce8ed80884";

const isPlaceholder = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes("replace") || lower.includes("placeholder") || lower.includes("your_");
};

const getRequiredEnv = (
    name: string,
    validationPattern?: RegExp,
    aliases: string[] = []
) => {
    const candidates = [name, ...aliases];
    const resolved = candidates
        .map((key) => ({ key, value: (process.env[key] ?? "").trim() }))
        .find((entry) => entry.value && !isPlaceholder(entry.value));

    if (!resolved) {
        const aliasHint = aliases.length > 0 ? ` (or ${aliases.join(", ")})` : "";
        throw new Error(
            `[app.config] Missing ${name}. Set ${name}${aliasHint} in .env.local for local development and in EAS environment variables for build profiles.`
        );
    }

    if (validationPattern && !validationPattern.test(resolved.value)) {
        throw new Error(`[app.config] Invalid ${resolved.key}. Value does not match expected format.`);
    }

    return resolved.value;
};

export default ({ config }: ConfigContext): ExpoConfig => {
    getRequiredEnv("EXPO_PUBLIC_OLA_MAPS_API_KEY");
    const googleMapsApiKey = getRequiredEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");

    return {
        ...config,
        name: "ForFriendsOnTheGo",
        slug: "ForFriendsOnTheGo-App",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/images/Gemini_Generated_Image_4kxl224kxl224kxl.png",
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
                foregroundImage: "./assets/images/Gemini_Generated_Image_4kxl224kxl224kxl.png",
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
            favicon: "./assets/images/favicon.png",
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
                    image: "./assets/images/splash-icon.png",
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
