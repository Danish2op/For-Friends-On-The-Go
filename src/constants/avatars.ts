import type { ImageSourcePropType } from "react-native";

export type AvatarId = "1" | "2" | "3" | "4" | "5";

export interface AvatarOption {
    id: AvatarId;
    label: string;
    source: ImageSourcePropType;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
    {
        id: "1",
        label: "Navigator",
        source: require("../../assets/images/avatars/avatar-1.png"),
    },
    {
        id: "2",
        label: "Scout",
        source: require("../../assets/images/avatars/avatar-2.png"),
    },
    {
        id: "3",
        label: "Signal",
        source: require("../../assets/images/avatars/avatar-3.png"),
    },
    {
        id: "4",
        label: "Grid",
        source: require("../../assets/images/avatars/avatar-4.png"),
    },
    {
        id: "5",
        label: "Pilot",
        source: require("../../assets/images/avatars/avatar-5.png"),
    },
];

export const DEFAULT_AVATAR_ID: AvatarId = "1";

export const getAvatarOptionById = (avatarId: string | null | undefined) => {
    return AVATAR_OPTIONS.find((option) => option.id === avatarId) ?? AVATAR_OPTIONS[0];
};
