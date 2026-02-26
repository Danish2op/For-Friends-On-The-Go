/**
 * Avatar UI Components
 *
 * Re-exports UserAvatar and provides the AvatarRandomizer
 * for signup / profile editing flows.
 */

import { RefreshCw } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import {
    genRandomAvatarConfig,
    type NiceAvatarConfig,
} from "../../constants/avatars";
import { COLORS, SKEUO } from "../../constants/theme";
import UserAvatar from "./UserAvatar";

// Re-export for convenience
export { UserAvatar } from "./UserAvatar";

// ─── AvatarRandomizer ────────────────────────────────────────────────────────

interface AvatarRandomizerProps {
    value: NiceAvatarConfig;
    onChange: (config: NiceAvatarConfig) => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * Shows the current avatar with a "Randomize" button.
 * Replaces the old 5-option AvatarSelector.
 */
export function AvatarRandomizer({
    value,
    onChange,
    disabled = false,
    style,
}: AvatarRandomizerProps) {
    const handleRandomize = () => {
        onChange(genRandomAvatarConfig());
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.previewWrap}>
                <UserAvatar config={value} size={72} />
            </View>

            <TouchableOpacity
                onPress={handleRandomize}
                disabled={disabled}
                activeOpacity={0.85}
                style={[styles.randomizeButton, disabled && styles.disabledButton]}
            >
                <RefreshCw size={14} color={COLORS.primary} />
                <Text style={styles.randomizeText}>Randomize</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        gap: 12,
    },
    previewWrap: {
        borderRadius: SKEUO.radius.l,
        borderWidth: 2,
        borderColor: COLORS.border,
        padding: 4,
        backgroundColor: COLORS.surface,
    },
    randomizeButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: SKEUO.radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "rgba(47,124,245,0.12)",
        borderWidth: 1,
        borderColor: "rgba(47,124,245,0.25)",
    },
    disabledButton: {
        opacity: 0.5,
    },
    randomizeText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: "700",
    },
});
