import { AlertTriangle, LogOut, X } from "lucide-react-native";
import React from "react";
import {
    Modal,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
} from "react-native";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import { COLORS, SKEUO } from "../../constants/theme";

interface ExitConfirmationCardProps {
    visible: boolean;
    isHost: boolean;
    loading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ExitConfirmationCard({
    visible,
    isHost,
    loading,
    onConfirm,
    onCancel,
}: ExitConfirmationCardProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.cardOuter}>
                            <View style={styles.cardInner}>
                                <View style={styles.iconCircle}>
                                    <AlertTriangle size={28} color={COLORS.danger} />
                                </View>

                                <Text style={styles.title}>Leave Lobby?</Text>

                                <Text style={styles.description}>
                                    {isHost
                                        ? "You are the host. If you leave, the host role will be passed to the next person who joined. Your progress in this lobby will be marked as exited."
                                        : "Are you sure you want to leave this lobby? Your progress will be marked as exited."}
                                </Text>

                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={onCancel}
                                        disabled={loading}
                                        activeOpacity={0.88}
                                    >
                                        <X size={16} color={COLORS.text} />
                                        <Text style={styles.cancelText}>Stay</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
                                        onPress={onConfirm}
                                        disabled={loading}
                                        activeOpacity={0.88}
                                    >
                                        <LogOut size={16} color="#f7fbff" />
                                        <Text style={styles.confirmText}>
                                            {loading ? "Leaving..." : "Leave"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    cardOuter: {
        width: "100%",
        maxWidth: 360,
        borderRadius: SKEUO.radius.l,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 12, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 16,
    },
    cardInner: {
        borderRadius: SKEUO.radius.l,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        padding: 24,
        alignItems: "center",
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(227,90,90,0.14)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        color: COLORS.text,
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 8,
    },
    description: {
        color: COLORS.textDim,
        fontSize: 14,
        fontWeight: "500",
        lineHeight: 20,
        textAlign: "center",
        marginBottom: 24,
    },
    actions: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    cancelButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 14,
    },
    cancelText: {
        color: COLORS.text,
        fontWeight: "800",
        fontSize: 14,
    },
    confirmButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.danger,
        paddingVertical: 14,
    },
    confirmButtonDisabled: {
        opacity: 0.7,
    },
    confirmText: {
        color: "#f7fbff",
        fontWeight: "800",
        fontSize: 14,
    },
});
