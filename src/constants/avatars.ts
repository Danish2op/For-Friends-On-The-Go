/**
 * Avatar Configuration System
 *
 * Defines the serializable config for cartoon SVG avatars.
 * Every user gets a random config at signup, persisted to Firestore.
 * The config drives the `<UserAvatar />` SVG component.
 */

// ─── Config Types ────────────────────────────────────────────────────────────

export type AvatarSex = "man" | "woman";
export type AvatarEarSize = "small" | "big";
export type AvatarHairStyle = "normal" | "thick" | "mohawk" | "womanLong" | "womanShort";
export type AvatarEyeStyle = "circle" | "oval" | "smile";
export type AvatarNoseStyle = "short" | "long" | "round";
export type AvatarMouthStyle = "laugh" | "smile" | "peace";
export type AvatarGlassesStyle = "none" | "round" | "square";
export type AvatarShirtStyle = "hoody" | "short" | "polo";

export interface NiceAvatarConfig {
    sex: AvatarSex;
    faceColor: string;
    earSize: AvatarEarSize;
    hairColor: string;
    hairStyle: AvatarHairStyle;
    eyeStyle: AvatarEyeStyle;
    noseStyle: AvatarNoseStyle;
    mouthStyle: AvatarMouthStyle;
    glassesStyle: AvatarGlassesStyle;
    shirtStyle: AvatarShirtStyle;
    shirtColor: string;
    bgColor: string;
}

// ─── Color Palettes ──────────────────────────────────────────────────────────

const FACE_COLORS = [
    "#F9C9B6", "#FFD5C2", "#F0C8A4", "#E8B894", "#D4A27A",
    "#C28B6A", "#B07B5C", "#9B6B4E", "#8D5B3F", "#704A38",
];

const HAIR_COLORS = [
    "#000000", "#2C1B0E", "#4A3222", "#6B4D32", "#A67B5B",
    "#D4A76A", "#E8C07A", "#C24014", "#B83B2A", "#F5D76E",
    "#FF6B6B", "#7B68EE", "#4ECDC4", "#2D3436",
];

const SHIRT_COLORS = [
    "#2F7CF5", "#F5A623", "#E74C3C", "#1ABC9C", "#9B59B6",
    "#3498DB", "#E67E22", "#2ECC71", "#FF6384", "#36D7B7",
    "#F39C12", "#6C5CE7", "#00B894", "#FD79A8",
];

const BG_COLORS = [
    "#E8F4FD", "#FFF3E0", "#E8F5E9", "#F3E5F5", "#FFF8E1",
    "#E1F5FE", "#FCE4EC", "#F1F8E9", "#E0F7FA", "#FBE9E7",
    "#DCEEFB", "#F5E6CC", "#D5F5E3", "#FADBD8", "#EBF5FB",
];

// ─── Random Helpers ──────────────────────────────────────────────────────────

const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generates a random avatar config. Call this during signup
 * and on "re-roll" button presses.
 */
export const genRandomAvatarConfig = (): NiceAvatarConfig => {
    const sex = pick(["man", "woman"] as const);
    const hairStyles: AvatarHairStyle[] =
        sex === "man"
            ? ["normal", "thick", "mohawk"]
            : ["womanLong", "womanShort", "normal"];

    return {
        sex,
        faceColor: pick(FACE_COLORS),
        earSize: pick(["small", "big"] as const),
        hairColor: pick(HAIR_COLORS),
        hairStyle: pick(hairStyles),
        eyeStyle: pick(["circle", "oval", "smile"] as const),
        noseStyle: pick(["short", "long", "round"] as const),
        mouthStyle: pick(["laugh", "smile", "peace"] as const),
        glassesStyle: pick(["none", "none", "none", "round", "square"] as const), // 60% no glasses
        shirtStyle: pick(["hoody", "short", "polo"] as const),
        shirtColor: pick(SHIRT_COLORS),
        bgColor: pick(BG_COLORS),
    };
};

/**
 * Validates a config object from Firestore.
 * Returns true if all required fields are present and of correct type.
 */
export const isValidAvatarConfig = (value: unknown): value is NiceAvatarConfig => {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.sex === "string" &&
        typeof obj.faceColor === "string" &&
        typeof obj.earSize === "string" &&
        typeof obj.hairColor === "string" &&
        typeof obj.hairStyle === "string" &&
        typeof obj.eyeStyle === "string" &&
        typeof obj.noseStyle === "string" &&
        typeof obj.mouthStyle === "string" &&
        typeof obj.glassesStyle === "string" &&
        typeof obj.shirtStyle === "string" &&
        typeof obj.shirtColor === "string" &&
        typeof obj.bgColor === "string"
    );
};

/**
 * Returns a deterministic default config for existing users
 * who don't have an avatarConfig yet.
 */
export const DEFAULT_AVATAR_CONFIG: NiceAvatarConfig = {
    sex: "man",
    faceColor: "#F9C9B6",
    earSize: "small",
    hairColor: "#2C1B0E",
    hairStyle: "normal",
    eyeStyle: "circle",
    noseStyle: "short",
    mouthStyle: "smile",
    glassesStyle: "none",
    shirtStyle: "hoody",
    shirtColor: "#2F7CF5",
    bgColor: "#E8F4FD",
};

// ─── Legacy Compatibility ────────────────────────────────────────────────────

/** @deprecated Use NiceAvatarConfig instead */
export type AvatarId = "1" | "2" | "3" | "4" | "5";
