import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { BellRing, Check, X } from "lucide-react-native";
import { ScrollView, Text, View } from "@/src/components/ui/tamagui-primitives";
import { COLORS, SKEUO } from "../../constants/theme";
import type { LobbyInvite } from "../../services/firebase/lobby-lifecycle";

interface LobbyInviteNotificationStackProps {
    invites: LobbyInvite[];
    loading: boolean;
    processingInviteId: string | null;
    onAcceptInvite: (inviteId: string) => Promise<void>;
    onRejectInvite: (inviteId: string) => Promise<void>;
}

const toRelativeLabel = (value: LobbyInvite["createdAt"]) => {
    if (!value) {
        return "now";
    }
    const diffMs = Date.now() - value.toMillis();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMins < 1) {
        return "now";
    }
    if (diffMins < 60) {
        return `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    return `${Math.floor(diffHours / 24)}d ago`;
};

export default function LobbyInviteNotificationStack({
    invites,
    loading,
    processingInviteId,
    onAcceptInvite,
    onRejectInvite,
}: LobbyInviteNotificationStackProps) {
    if (loading) {
        return (
            <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading invites...</Text>
            </View>
        );
    }

    if (invites.length === 0) {
        return (
            <View style={styles.emptyCard}>
                <BellRing size={16} color={COLORS.textDim} />
                <Text style={styles.emptyText}>No pending lobby invites.</Text>
            </View>
        );
    }

    return (
        <View style={styles.stackContainer}>
            <View style={styles.stackHeader}>
                <BellRing size={16} color={COLORS.primary} />
                <Text style={styles.stackTitle}>Incoming Lobby Invites</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.inviteRow}
            >
                {invites.map((invite) => {
                    const processing = processingInviteId === invite.inviteId;
                    return (
                        <View key={invite.inviteId} style={styles.inviteCard}>
                            <Text style={styles.inviteHost}>{invite.hostUsername}</Text>
                            <Text style={styles.inviteBody}>
                                invited you to lobby <Text style={styles.inviteCode}>{invite.lobbyCode}</Text>
                            </Text>
                            <Text style={styles.inviteTime}>{toRelativeLabel(invite.createdAt)}</Text>

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.rejectButton]}
                                    onPress={() => onRejectInvite(invite.inviteId)}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Text style={styles.rejectText}>...</Text>
                                    ) : (
                                        <>
                                            <X size={14} color={COLORS.danger} />
                                            <Text style={styles.rejectText}>Reject</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.acceptButton]}
                                    onPress={() => onAcceptInvite(invite.inviteId)}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Text style={styles.acceptText}>...</Text>
                                    ) : (
                                        <>
                                            <Check size={14} color="#eef9f5" />
                                            <Text style={styles.acceptText}>Join</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    stackContainer: {
        marginTop: 16,
        borderRadius: SKEUO.radius.l,
        backgroundColor: "rgba(234, 240, 248, 0.92)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 10,
    },
    stackHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    stackTitle: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 0.4,
    },
    inviteRow: {
        gap: 10,
        paddingRight: 8,
    },
    inviteCard: {
        width: 220,
        borderRadius: SKEUO.radius.m,
        padding: 12,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.74)",
        gap: 6,
    },
    inviteHost: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "800",
    },
    inviteBody: {
        color: COLORS.textDim,
        fontSize: 12,
        lineHeight: 17,
    },
    inviteCode: {
        color: COLORS.primary,
        fontWeight: "800",
        letterSpacing: 0.6,
    },
    inviteTime: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "600",
    },
    actionRow: {
        marginTop: 4,
        flexDirection: "row",
        gap: 8,
    },
    actionButton: {
        flex: 1,
        minHeight: 36,
        borderRadius: SKEUO.radius.s,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
    },
    rejectButton: {
        backgroundColor: "rgba(227, 90, 90, 0.16)",
        borderColor: "rgba(227, 90, 90, 0.34)",
    },
    acceptButton: {
        backgroundColor: COLORS.secondary,
        borderColor: "rgba(255,255,255,0.4)",
    },
    rejectText: {
        color: COLORS.danger,
        fontSize: 12,
        fontWeight: "800",
    },
    acceptText: {
        color: "#eef9f5",
        fontSize: 12,
        fontWeight: "800",
    },
    loadingCard: {
        marginTop: 16,
        minHeight: 50,
        borderRadius: SKEUO.radius.m,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    loadingText: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
    },
    emptyCard: {
        marginTop: 16,
        minHeight: 50,
        borderRadius: SKEUO.radius.m,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    emptyText: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
    },
});
