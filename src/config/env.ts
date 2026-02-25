const readEnv = (key: string) => (process.env[key] ?? "").trim();

const makeMissingEnvMessage = (key: string) =>
    `Missing required environment variable ${key}. Configure it in .env.local for local dev and EAS env for builds.`;

const isPlaceholder = (value: string) => {
    const lower = value.toLowerCase();
    return lower.includes("replace") || lower.includes("placeholder") || lower.includes("your_");
};

const ensurePresent = (key: string, value: string) => {
    if (!value || isPlaceholder(value)) {
        throw new Error(makeMissingEnvMessage(key));
    }
    return value;
};

export const ENV = {
    olaMapsApiKey: readEnv("EXPO_PUBLIC_OLA_MAPS_API_KEY"),
    googleMapsApiKey: readEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"),
} as const;

export const getRequiredRuntimeEnv = (
    key: "EXPO_PUBLIC_OLA_MAPS_API_KEY" | "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
) => {
    if (key === "EXPO_PUBLIC_OLA_MAPS_API_KEY") {
        return ensurePresent(key, ENV.olaMapsApiKey);
    }
    return ensurePresent(key, ENV.googleMapsApiKey);
};

export const getMissingRuntimeEnvKeys = () => {
    const missing: string[] = [];

    if (!ENV.olaMapsApiKey || isPlaceholder(ENV.olaMapsApiKey)) {
        missing.push("EXPO_PUBLIC_OLA_MAPS_API_KEY");
    }

    return missing;
};
