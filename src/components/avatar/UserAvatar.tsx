import React, { memo } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { View } from "@/src/components/ui/tamagui-primitives";
import {
    DEFAULT_AVATAR_CONFIG,
    isValidAvatarConfig,
    type NiceAvatarConfig,
} from "../../constants/avatars";

// ─── Props ───────────────────────────────────────────────────────────────────

interface UserAvatarProps {
    config?: NiceAvatarConfig | null;
    size?: number;
    style?: StyleProp<ViewStyle>;
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

const darken = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
    const b = Math.max(0, (num & 0x0000ff) - amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

const lighten = (hex: string, amount: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
    const b = Math.min(255, (num & 0x0000ff) + amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

// ─── SVG Sub-renderers ───────────────────────────────────────────────────────

const renderFace = (c: NiceAvatarConfig) => (
    <G>
        {/* Face shape */}
        <Ellipse cx={50} cy={52} rx={28} ry={30} fill={c.faceColor} />
        {/* Cheek blush */}
        <Circle cx={32} cy={58} r={5} fill={lighten(c.faceColor, 10)} opacity={0.5} />
        <Circle cx={68} cy={58} r={5} fill={lighten(c.faceColor, 10)} opacity={0.5} />
    </G>
);

const renderEars = (c: NiceAvatarConfig) => {
    const r = c.earSize === "big" ? 7 : 5;
    return (
        <G>
            <Circle cx={22} cy={52} r={r} fill={c.faceColor} />
            <Circle cx={78} cy={52} r={r} fill={c.faceColor} />
            <Circle cx={22} cy={52} r={r - 2} fill={darken(c.faceColor, 20)} opacity={0.3} />
            <Circle cx={78} cy={52} r={r - 2} fill={darken(c.faceColor, 20)} opacity={0.3} />
        </G>
    );
};

const renderHair = (c: NiceAvatarConfig) => {
    switch (c.hairStyle) {
        case "thick":
            return (
                <G>
                    <Ellipse cx={50} cy={32} rx={30} ry={18} fill={c.hairColor} />
                    <Rect x={22} y={26} width={56} height={12} rx={6} fill={c.hairColor} />
                </G>
            );
        case "mohawk":
            return (
                <G>
                    <Rect x={42} y={14} width={16} height={24} rx={8} fill={c.hairColor} />
                    <Ellipse cx={50} cy={30} rx={14} ry={8} fill={c.hairColor} />
                </G>
            );
        case "womanLong":
            return (
                <G>
                    <Ellipse cx={50} cy={34} rx={32} ry={20} fill={c.hairColor} />
                    <Rect x={20} y={34} width={12} height={34} rx={6} fill={c.hairColor} />
                    <Rect x={68} y={34} width={12} height={34} rx={6} fill={c.hairColor} />
                </G>
            );
        case "womanShort":
            return (
                <G>
                    <Ellipse cx={50} cy={34} rx={32} ry={20} fill={c.hairColor} />
                    <Rect x={20} y={34} width={10} height={18} rx={5} fill={c.hairColor} />
                    <Rect x={70} y={34} width={10} height={18} rx={5} fill={c.hairColor} />
                </G>
            );
        case "normal":
        default:
            return (
                <G>
                    <Ellipse cx={50} cy={34} rx={30} ry={16} fill={c.hairColor} />
                </G>
            );
    }
};

const renderEyes = (c: NiceAvatarConfig) => {
    switch (c.eyeStyle) {
        case "oval":
            return (
                <G>
                    <Ellipse cx={39} cy={50} rx={4} ry={5} fill="#2D3436" />
                    <Ellipse cx={61} cy={50} rx={4} ry={5} fill="#2D3436" />
                    <Circle cx={40} cy={49} r={1.5} fill="#FFFFFF" />
                    <Circle cx={62} cy={49} r={1.5} fill="#FFFFFF" />
                </G>
            );
        case "smile":
            return (
                <G>
                    <Path d="M35 50 Q39 46 43 50" stroke="#2D3436" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                    <Path d="M57 50 Q61 46 65 50" stroke="#2D3436" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                </G>
            );
        case "circle":
        default:
            return (
                <G>
                    <Circle cx={39} cy={50} r={4} fill="#2D3436" />
                    <Circle cx={61} cy={50} r={4} fill="#2D3436" />
                    <Circle cx={40} cy={49} r={1.5} fill="#FFFFFF" />
                    <Circle cx={62} cy={49} r={1.5} fill="#FFFFFF" />
                </G>
            );
    }
};

const renderNose = (c: NiceAvatarConfig) => {
    switch (c.noseStyle) {
        case "long":
            return <Path d="M48 55 L50 62 L52 55" stroke={darken(c.faceColor, 40)} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
        case "round":
            return <Circle cx={50} cy={58} r={3} fill={darken(c.faceColor, 30)} opacity={0.5} />;
        case "short":
        default:
            return <Path d="M48 56 L50 59 L52 56" stroke={darken(c.faceColor, 40)} strokeWidth={1.5} fill="none" strokeLinecap="round" />;
    }
};

const renderMouth = (c: NiceAvatarConfig) => {
    switch (c.mouthStyle) {
        case "laugh":
            return (
                <G>
                    <Path d="M40 65 Q50 75 60 65" fill="#FFFFFF" stroke="#2D3436" strokeWidth={1.5} />
                    <Path d="M40 65 Q50 68 60 65" fill="#E74C3C" />
                </G>
            );
        case "peace":
            return <Path d="M44 66 Q50 64 56 66" stroke="#2D3436" strokeWidth={2} fill="none" strokeLinecap="round" />;
        case "smile":
        default:
            return <Path d="M42 65 Q50 72 58 65" stroke="#2D3436" strokeWidth={2} fill="none" strokeLinecap="round" />;
    }
};

const renderGlasses = (c: NiceAvatarConfig) => {
    if (c.glassesStyle === "none") return null;

    if (c.glassesStyle === "square") {
        return (
            <G>
                <Rect x={31} y={44} width={16} height={12} rx={2} stroke="#2D3436" strokeWidth={1.8} fill="none" />
                <Rect x={53} y={44} width={16} height={12} rx={2} stroke="#2D3436" strokeWidth={1.8} fill="none" />
                <Path d="M47 50 L53 50" stroke="#2D3436" strokeWidth={1.5} />
            </G>
        );
    }

    // round
    return (
        <G>
            <Circle cx={39} cy={50} r={9} stroke="#2D3436" strokeWidth={1.8} fill="none" />
            <Circle cx={61} cy={50} r={9} stroke="#2D3436" strokeWidth={1.8} fill="none" />
            <Path d="M48 50 L52 50" stroke="#2D3436" strokeWidth={1.5} />
        </G>
    );
};

const renderShirt = (c: NiceAvatarConfig) => {
    switch (c.shirtStyle) {
        case "short":
            return (
                <G>
                    <Path d="M22 82 Q50 78 78 82 L80 100 L20 100 Z" fill={c.shirtColor} />
                    <Path d="M40 82 L40 84" stroke={lighten(c.shirtColor, 30)} strokeWidth={1} opacity={0.4} />
                    <Path d="M60 82 L60 84" stroke={lighten(c.shirtColor, 30)} strokeWidth={1} opacity={0.4} />
                </G>
            );
        case "polo":
            return (
                <G>
                    <Path d="M22 82 Q50 78 78 82 L80 100 L20 100 Z" fill={c.shirtColor} />
                    {/* Collar */}
                    <Path d="M38 80 L50 85 L62 80" stroke={darken(c.shirtColor, 30)} strokeWidth={2} fill="none" />
                    {/* Buttons */}
                    <Circle cx={50} cy={90} r={1.5} fill={darken(c.shirtColor, 40)} />
                    <Circle cx={50} cy={95} r={1.5} fill={darken(c.shirtColor, 40)} />
                </G>
            );
        case "hoody":
        default:
            return (
                <G>
                    <Path d="M22 82 Q50 78 78 82 L80 100 L20 100 Z" fill={c.shirtColor} />
                    {/* Hood strings */}
                    <Path d="M44 84 L44 92" stroke={lighten(c.shirtColor, 40)} strokeWidth={1.5} strokeLinecap="round" />
                    <Path d="M56 84 L56 92" stroke={lighten(c.shirtColor, 40)} strokeWidth={1.5} strokeLinecap="round" />
                    {/* Hood neckline */}
                    <Path d="M34 82 Q50 88 66 82" stroke={darken(c.shirtColor, 20)} strokeWidth={1.5} fill="none" />
                </G>
            );
    }
};

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * A universally reusable avatar component.
 *
 * @param config  The NiceAvatarConfig determining appearance.
 *                Falls back to DEFAULT_AVATAR_CONFIG if null/undefined/invalid.
 * @param size    Width and height in dp. Default 48.
 * @param style   Optional ViewStyle for the container.
 */
function UserAvatarInner({ config, size = 48, style }: UserAvatarProps) {
    const c = config && isValidAvatarConfig(config) ? config : DEFAULT_AVATAR_CONFIG;

    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: Math.round(size * 0.34),
                    overflow: "hidden",
                },
                style,
            ]}
        >
            <Svg viewBox="0 0 100 100" width={size} height={size}>
                {/* Background */}
                <Rect x={0} y={0} width={100} height={100} fill={c.bgColor} />

                {/* Body order matters for layering */}
                {renderShirt(c)}
                {renderEars(c)}
                {renderFace(c)}
                {renderHair(c)}
                {renderEyes(c)}
                {renderNose(c)}
                {renderMouth(c)}
                {renderGlasses(c)}
            </Svg>
        </View>
    );
}

export const UserAvatar = memo(UserAvatarInner);
export default UserAvatar;
