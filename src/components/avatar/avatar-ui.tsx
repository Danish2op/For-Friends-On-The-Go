import { Image } from "expo-image";
import React from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ImageStyle,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { AVATAR_OPTIONS, getAvatarOptionById, type AvatarId } from "../../constants/avatars";
import { COLORS, SKEUO } from "../../constants/theme";

interface AvatarImageProps {
    avatarId: AvatarId | string | null | undefined;
    size?: number;
    style?: StyleProp<ImageStyle>;
    accessibilityLabel?: string;
}

interface AvatarSelectorProps {
    value: AvatarId;
    onChange: (avatarId: AvatarId) => void;
    disabled?: boolean;
    layout?: "row" | "grid";
    style?: StyleProp<ViewStyle>;
}

export function AvatarImage({
    avatarId,
    size = 48,
    style,
    accessibilityLabel = "Profile avatar",
}: AvatarImageProps) {
    const avatar = getAvatarOptionById(avatarId);

    return (
        <Image
            source={avatar.source}
            contentFit="cover"
            accessibilityLabel={accessibilityLabel}
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: Math.round(size * 0.34),
                },
                style,
            ]}
        />
    );
}

export function AvatarSelector({
    value,
    onChange,
    disabled = false,
    layout = "grid",
    style,
}: AvatarSelectorProps) {
    return (
        <View style={[styles.container, layout === "row" ? styles.containerRow : styles.containerGrid, style]}>
            {AVATAR_OPTIONS.map((option) => {
                const active = option.id === value;
                return (
                    <TouchableOpacity
                        key={option.id}
                        onPress={() => onChange(option.id)}
                        activeOpacity={0.88}
                        disabled={disabled}
                        style={[
                            styles.option,
                            layout === "row" ? styles.optionRow : styles.optionGrid,
                            active && styles.optionActive,
                            disabled && styles.optionDisabled,
                        ]}
                    >
                        <AvatarImage
                            avatarId={option.id}
                            size={44}
                            style={styles.optionImage}
                            accessibilityLabel={`${option.label} avatar`}
                        />
                        <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    containerRow: {
        flexWrap: "nowrap",
        justifyContent: "space-between",
    },
    containerGrid: {
        justifyContent: "flex-start",
    },
    option: {
        borderRadius: SKEUO.radius.s,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surfaceDeep,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    optionRow: {
        flex: 1,
        minWidth: 0,
    },
    optionGrid: {
        width: "31%",
        minWidth: 88,
    },
    optionActive: {
        borderColor: COLORS.primary,
        backgroundColor: "rgba(47,124,245,0.14)",
    },
    optionDisabled: {
        opacity: 0.65,
    },
    optionImage: {
        marginBottom: 6,
    },
    optionLabel: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "700",
    },
    optionLabelActive: {
        color: COLORS.primary,
    },
});
