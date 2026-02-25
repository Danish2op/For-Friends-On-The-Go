import { COLORS, SKEUO } from "@/src/constants/theme";
import { useAppAuth } from "@/src/context/AuthContext";
import {
    subscribeLobbyHistory,
    type LobbyHistoryItem,
} from "@/src/services/firebase/history";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const STATUS_COLORS: Record<string, string> = {
    WAITING: COLORS.accent,
    VOTING: COLORS.primary,
    FINISHED: COLORS.success,
    EXITED: COLORS.textDim,
    ABANDONED: COLORS.danger,
    UNKNOWN: COLORS.muted,
};

const toDateLabel = (value: unknown): string => {
    if (!value) return "—";

    if (typeof value === "object" && value !== null) {
        const withToDate = value as { toDate?: unknown };
        if (typeof withToDate.toDate === "function") {
            const d = (withToDate.toDate as () => unknown)();
            if (d instanceof Date && !Number.isNaN(d.getTime())) {
                return d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                });
            }
        }

        const withToMillis = value as { toMillis?: unknown };
        if (typeof withToMillis.toMillis === "function") {
            const ms = (withToMillis.toMillis as () => unknown)();
            if (typeof ms === "number") {
                return new Date(ms).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                });
            }
        }

        const withSeconds = value as { seconds?: unknown };
        if (typeof withSeconds.seconds === "number") {
            return new Date(withSeconds.seconds * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        }
    }

    return "—";
};

export default function HistoryScreen() {
    const { userId } = useAppAuth();
    const [history, setHistory] = useState<LobbyHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setHistory([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = subscribeLobbyHistory(userId, (items) => {
            setHistory(items);
            setLoading(false);
        }, 50);

        return unsubscribe;
    }, [userId]);

    const renderItem = ({ item }: { item: LobbyHistoryItem }) => {
        const statusColor = STATUS_COLORS[item.status] ?? COLORS.muted;

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push(`/history-detail?sessionId=${item.sessionId}`)}
                style={styles.card}
            >
                <View style={styles.cardTopRow}>
                    <Text style={styles.code} selectable>{item.code}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "1A" }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.cardBottomRow}>
                    <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={13} color={COLORS.textDim} />
                        <Text style={styles.roleText}>{item.role === "host" ? "Host" : "Guest"}</Text>
                    </View>

                    <Text style={styles.dateText}>{toDateLabel(item.updatedAt || item.joinedAt)}</Text>
                </View>

                <View style={styles.chevronWrap}>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: "Lobby History", headerShown: true }} />

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading history...</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.sessionId}
                    renderItem={renderItem}
                    contentInsetAdjustmentBehavior="automatic"
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="time-outline" size={48} color={COLORS.muted} />
                            <Text style={styles.emptyTitle}>No lobby history yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Your past lobbies and missions will appear here.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centerContent: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },
    loadingText: {
        color: COLORS.textDim,
        fontWeight: "600",
        fontSize: 15,
    },
    listContent: {
        padding: 16,
        gap: 10,
        paddingBottom: 40,
    },
    card: {
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        padding: 14,
        gap: 8,
        borderCurve: "continuous",
        boxShadow: "0 2px 8px rgba(129, 145, 168, 0.18)",
    } as any,
    cardTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    code: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "800",
        letterSpacing: 1.2,
        fontVariant: ["tabular-nums"],
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: 10,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    cardBottomRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    roleText: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "600",
    },
    dateText: {
        color: COLORS.muted,
        fontSize: 12,
        fontWeight: "500",
    },
    chevronWrap: {
        position: "absolute",
        right: 14,
        top: "50%",
        marginTop: -8,
    },
    emptyWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 100,
        gap: 8,
    },
    emptyTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "700",
    },
    emptySubtitle: {
        color: COLORS.textDim,
        fontSize: 14,
        textAlign: "center",
    },
});
