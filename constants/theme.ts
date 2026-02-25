import { Platform, type TextStyle, type ViewStyle } from "react-native";

type ShadowStyle = Pick<
    ViewStyle,
    "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

const createShadow = (
    shadowColor: string,
    width: number,
    height: number,
    radius: number,
    opacity: number,
    elevation: number
): ShadowStyle => ({
    shadowColor,
    shadowOffset: { width, height },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
});

export const COLORS = {
    background: "#d8e0eb",
    backgroundAlt: "#edf2f8",
    card: "#e7edf6",
    surface: "#edf2f8",
    surfaceSoft: "#f4f7fb",
    surfacePressed: "#d8e0eb",
    border: "rgba(255, 255, 255, 0.65)",
    borderStrong: "rgba(169, 181, 198, 0.45)",
    primary: "#2f7cf5",
    primaryDeep: "#1e5dc3",
    secondary: "#1da578",
    accent: "#f4b74f",
    textPrimary: "#172233",
    textSecondary: "#4b5a71",
    textMuted: "#6f8098",
    shadowDark: "rgba(111, 128, 150, 0.42)",
    shadowDarkSoft: "rgba(111, 128, 150, 0.24)",
    shadowLight: "rgba(255, 255, 255, 0.94)",
    glowTop: "rgba(255, 255, 255, 0.75)",
    glowBottom: "rgba(167, 181, 199, 0.30)",
    danger: "#d75454",
    success: "#2f9f75",
} as const;

export const SHADOWS = {
    raised: {
        dark: createShadow(COLORS.shadowDark, 14, 14, 20, 1, 14),
        light: createShadow(COLORS.shadowLight, -10, -10, 16, 1, 10),
    },
    raisedSoft: {
        dark: createShadow(COLORS.shadowDarkSoft, 8, 8, 14, 1, 8),
        light: createShadow(COLORS.shadowLight, -6, -6, 10, 1, 6),
    },
    pressed: {
        dark: createShadow("rgba(136, 148, 165, 0.22)", 4, 4, 8, 1, 4),
        light: createShadow("rgba(255, 255, 255, 0.70)", -2, -2, 6, 1, 2),
    },
    floating: {
        dark: createShadow("rgba(57, 79, 108, 0.33)", 18, 18, 24, 1, 16),
        light: createShadow("rgba(255, 255, 255, 0.84)", -12, -12, 18, 1, 12),
    },
} as const;

export const SKEUO = {
    radius: {
        xs: 12,
        s: 16,
        m: 22,
        l: 30,
        xl: 38,
        pill: 999,
    },
    spacing: {
        xs: 6,
        s: 10,
        m: 16,
        l: 24,
        xl: 32,
        xxl: 40,
    },
    border: {
        hairline: 1,
        soft: COLORS.border,
        strong: COLORS.borderStrong,
    },
    lighting: {
        topGlow: COLORS.glowTop,
        bottomShade: COLORS.glowBottom,
    },
    shadow: SHADOWS,
    surfaceStyles: {
        base: {
            backgroundColor: COLORS.surface,
            borderWidth: 1,
            borderColor: COLORS.border,
        } satisfies ViewStyle,
        soft: {
            backgroundColor: COLORS.surfaceSoft,
            borderWidth: 1,
            borderColor: COLORS.border,
        } satisfies ViewStyle,
        pressed: {
            backgroundColor: COLORS.surfacePressed,
            borderWidth: 1,
            borderColor: COLORS.borderStrong,
        } satisfies ViewStyle,
    },
} as const;

export const TYPE = {
    size: {
        hero: 44,
        title: 32,
        h1: 26,
        h2: 22,
        body: 16,
        caption: 13,
    },
    weight: {
        regular: "400" as TextStyle["fontWeight"],
        medium: "500" as TextStyle["fontWeight"],
        semibold: "600" as TextStyle["fontWeight"],
        bold: "700" as TextStyle["fontWeight"],
        black: "900" as TextStyle["fontWeight"],
    },
} as const;

export const Colors = {
    light: {
        text: COLORS.textPrimary,
        background: COLORS.background,
        tint: COLORS.primary,
        icon: COLORS.textMuted,
        tabIconDefault: COLORS.textMuted,
        tabIconSelected: COLORS.primary,
    },
    dark: {
        text: "#f2f6ff",
        background: "#121a26",
        tint: "#84b2ff",
        icon: "#9fb2cc",
        tabIconDefault: "#9fb2cc",
        tabIconSelected: "#84b2ff",
    },
} as const;

export const Fonts = Platform.select({
    ios: {
        sans: "system-ui",
        serif: "ui-serif",
        rounded: "ui-rounded",
        mono: "ui-monospace",
    },
    android: {
        sans: "sans-serif",
        serif: "serif",
        rounded: "sans-serif-medium",
        mono: "monospace",
    },
    default: {
        sans: "normal",
        serif: "serif",
        rounded: "normal",
        mono: "monospace",
    },
    web: {
        sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        serif: "Georgia, 'Times New Roman', serif",
        rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, sans-serif",
        mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    },
});
