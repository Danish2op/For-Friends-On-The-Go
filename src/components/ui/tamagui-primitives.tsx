import React from "react";
import type { ScrollViewProps, TextProps, ViewProps } from "react-native";
import {
    ScrollView as TamaguiScrollView,
    styled,
    Text as TamaguiText,
    View as TamaguiView,
} from "tamagui";

const StyledView = styled(TamaguiView, {});

const StyledText = styled(TamaguiText, {});

const StyledScrollView = styled(TamaguiScrollView, {});

export function View(props: ViewProps) {
    return <StyledView {...(props as any)} />;
}

export function Text(props: TextProps) {
    return <StyledText {...(props as any)} />;
}

export function ScrollView(props: ScrollViewProps) {
    return <StyledScrollView {...(props as any)} />;
}
