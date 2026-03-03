import * as Haptics from "expo-haptics";
import { AlertCircle, CheckCircle, Info, LucideIcon } from "lucide-react-native";
import React, { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import { COLORS, SKEUO } from "../../constants/theme";

export type ToastType = "success" | "error" | "info";

export interface ToastRef {
    show: (message: string, type?: ToastType, duration?: number) => void;
    hide: () => void;
}

const ICONS: Record<ToastType, LucideIcon> = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

const THEME: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: "#dff5e9", border: "#5dbf97", text: "#1d5b44" },
    error: { bg: "#f8e3e3", border: "#e08888", text: "#7d2f2f" },
    info: { bg: "#e3ecfb", border: "#7ea6e9", text: "#1f4c95" },
};

const Toast = forwardRef<ToastRef>((_props, ref) => {
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState("");
    const [type, setType] = useState<ToastType>("info");
    const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const hide = useCallback(() => {
        setVisible(false);
        if (timer) clearTimeout(timer);
    }, [timer]);

    const show = useCallback(
        (msg: string, toastType: ToastType = "info", duration = 3200) => {
            if (timer) clearTimeout(timer);

            setMessage(msg);
            setType(toastType);
            setVisible(true);

            if (toastType === "error") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            const newTimer = setTimeout(() => {
                hide();
            }, duration);

            setTimer(newTimer);
        },
        [hide, timer]
    );

    useImperativeHandle(ref, () => ({ show, hide }));

    if (!visible) return null;

    const Icon = ICONS[type];
    const theme = THEME[type];

    return (
        <Animated.View entering={SlideInUp.duration(280)} exiting={SlideOutUp.duration(220)} style={styles.wrapper}>
            <View style={styles.shadowDark}>
                <View style={[styles.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <Icon size={22} color={theme.text} strokeWidth={2.2} />
                    <Text style={[styles.text, { color: theme.text }]}>{message}</Text>
                </View>
            </View>
        </Animated.View>
    );
});

Toast.displayName = "Toast";

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        top: Platform.OS === "ios" ? 54 : 24,
        left: 18,
        right: 18,
        zIndex: 9999,
    },
    shadowDark: {
        borderRadius: SKEUO.radius.m,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.36,
        shadowRadius: 12,
        elevation: 10,
    },
    container: {
        borderRadius: SKEUO.radius.m,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    text: {
        flex: 1,
        fontSize: 14,
        fontWeight: "700",
        lineHeight: 20,
    },
});

export default Toast;
