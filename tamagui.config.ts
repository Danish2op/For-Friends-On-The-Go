import { createAnimations } from "@tamagui/animations-react-native";
import { defaultConfig } from "@tamagui/config/v4";
import { createFont, createTamagui, createTokens } from "tamagui";

import { COLORS, SKEUO, TYPE } from "./constants/theme";

const tokens = createTokens({
    color: {
        background: COLORS.background,
        backgroundAlt: COLORS.backgroundAlt,
        card: COLORS.card,
        surface: COLORS.surface,
        surfaceSoft: COLORS.surfaceSoft,
        surfacePressed: COLORS.surfacePressed,
        border: COLORS.border,
        borderStrong: COLORS.borderStrong,
        primary: COLORS.primary,
        primaryDeep: COLORS.primaryDeep,
        secondary: COLORS.secondary,
        accent: COLORS.accent,
        textPrimary: COLORS.textPrimary,
        textSecondary: COLORS.textSecondary,
        textMuted: COLORS.textMuted,
        shadowDark: COLORS.shadowDark,
        shadowLight: COLORS.shadowLight,
        danger: COLORS.danger,
        success: COLORS.success,
        white: "#ffffff",
        black: "#000000",
    },
    space: {
        0: 0,
        1: 4,
        2: SKEUO.spacing.xs,
        3: SKEUO.spacing.s,
        4: SKEUO.spacing.m,
        5: SKEUO.spacing.l,
        6: SKEUO.spacing.xl,
        7: SKEUO.spacing.xxl,
        true: SKEUO.spacing.m,
    },
    size: {
        0: 0,
        1: TYPE.size.caption,
        2: TYPE.size.body,
        3: TYPE.size.h2,
        4: TYPE.size.h1,
        5: TYPE.size.title,
        6: TYPE.size.hero,
        true: TYPE.size.body,
    },
    radius: {
        0: 0,
        1: SKEUO.radius.xs,
        2: SKEUO.radius.s,
        3: SKEUO.radius.m,
        4: SKEUO.radius.l,
        5: SKEUO.radius.xl,
        true: SKEUO.radius.m,
        full: SKEUO.radius.pill,
    },
    zIndex: {
        0: 0,
        1: 10,
        2: 100,
        3: 500,
        4: 1000,
        5: 9999,
    },
});

const bodyFont = createFont({
    family: "System",
    size: {
        1: 12,
        2: 13,
        3: 14,
        4: 15,
        5: TYPE.size.body,
        6: 18,
        7: 22,
        8: 28,
        true: TYPE.size.body,
    },
    lineHeight: {
        1: 16,
        2: 18,
        3: 20,
        4: 22,
        5: 24,
        6: 26,
        7: 30,
        8: 34,
    },
    weight: {
        4: TYPE.weight.regular,
        5: TYPE.weight.medium,
        6: TYPE.weight.semibold,
        7: TYPE.weight.bold,
        9: TYPE.weight.black,
    },
    letterSpacing: {
        4: 0,
        6: 0.2,
        7: 0.3,
        8: 0.6,
    },
});

const headingFont = createFont({
    family: "System",
    size: {
        1: TYPE.size.body,
        2: TYPE.size.h2,
        3: TYPE.size.h1,
        4: TYPE.size.title,
        5: TYPE.size.hero,
        true: TYPE.size.h2,
    },
    lineHeight: {
        1: 24,
        2: 28,
        3: 32,
        4: 38,
        5: 48,
    },
    weight: {
        6: TYPE.weight.semibold,
        7: TYPE.weight.bold,
        9: TYPE.weight.black,
    },
    letterSpacing: {
        1: 0,
        2: 0.2,
        3: 0.3,
        4: 0.4,
        5: 0.5,
    },
});

const monoFont = createFont({
    family: "Menlo",
    size: {
        1: 11,
        2: 12,
        3: 13,
        4: 14,
        true: 13,
    },
    lineHeight: {
        1: 16,
        2: 18,
        3: 20,
        4: 22,
    },
    weight: {
        4: "400",
        6: "600",
    },
    letterSpacing: {
        1: 0,
    },
});

const lightTheme = {
    background: COLORS.background,
    backgroundHover: COLORS.backgroundAlt,
    backgroundPress: COLORS.surfacePressed,
    backgroundFocus: COLORS.backgroundAlt,
    color: COLORS.textPrimary,
    colorHover: COLORS.textPrimary,
    colorPress: COLORS.textSecondary,
    colorFocus: COLORS.textPrimary,
    borderColor: COLORS.border,
    borderColorHover: COLORS.borderStrong,
    borderColorPress: COLORS.borderStrong,
    borderColorFocus: COLORS.primary,
    placeholderColor: COLORS.textMuted,
    outlineColor: COLORS.primary,
    surface: COLORS.surface,
    surfaceSoft: COLORS.surfaceSoft,
    card: COLORS.card,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    success: COLORS.success,
    danger: COLORS.danger,
    accent: COLORS.accent,
    shadowColor: COLORS.shadowDark,
};

const darkTheme = {
    background: "#121a26",
    backgroundHover: "#1a2536",
    backgroundPress: "#202e43",
    backgroundFocus: "#1a2536",
    color: "#f2f6ff",
    colorHover: "#f2f6ff",
    colorPress: "#d5deed",
    colorFocus: "#f2f6ff",
    borderColor: "#2b3a52",
    borderColorHover: "#395173",
    borderColorPress: "#395173",
    borderColorFocus: "#84b2ff",
    placeholderColor: "#9fb2cc",
    outlineColor: "#84b2ff",
    surface: "#1a2536",
    surfaceSoft: "#202e43",
    card: "#1a2536",
    primary: "#84b2ff",
    secondary: "#55c49c",
    success: "#55c49c",
    danger: "#f18b8b",
    accent: "#f5c66d",
    shadowColor: "rgba(0, 0, 0, 0.45)",
};

const config = createTamagui({
    ...defaultConfig,
    settings: {
        ...defaultConfig.settings,
        styleCompat: "react-native",
    },
    tokens,
    fonts: {
        ...defaultConfig.fonts,
        body: bodyFont,
        heading: headingFont,
        mono: monoFont,
    },
    themes: {
        ...defaultConfig.themes,
        light: {
            ...defaultConfig.themes.light,
            ...lightTheme,
        },
        dark: {
            ...defaultConfig.themes.dark,
            ...darkTheme,
        },
    },
    animations: createAnimations({
        quick: {
            type: "timing",
            duration: 170,
        },
        medium: {
            type: "timing",
            duration: 250,
        },
        slow: {
            type: "timing",
            duration: 360,
        },
        bouncy: {
            type: "spring",
            damping: 14,
            mass: 0.85,
            stiffness: 130,
        },
    }),
    defaultFont: "body",
});

export type AppTamaguiConfig = typeof config;

declare module "tamagui" {
    interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default config;
