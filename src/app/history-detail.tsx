import { COLORS, SKEUO } from "@/src/constants/theme";
import {
    fetchLobbyDetail,
    type LobbyDetail,
    type LobbyDetailParticipant,
    type LobbyDetailRecommendation,
} from "@/src/services/firebase/lobby-detail";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import { ScrollView, Text, View } from "@/src/components/ui/tamagui-primitives";

const STATUS_META: Record<string, { icon: string; color: string; label: string }> = {
    WAITING: { icon: "hourglass-outline", color: COLORS.accent, label: "Waiting" },
    VOTING: { icon: "thumbs-up-outline", color: COLORS.primary, label: "Voting" },
    FINISHED: { icon: "checkmark-circle-outline", color: COLORS.success, label: "Finished" },
    ABANDONED: { icon: "close-circle-outline", color: COLORS.danger, label: "Abandoned" },
};

const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "object" && value !== null) {
        const v = value as { toDate?: unknown; toMillis?: unknown; seconds?: unknown };
        if (typeof v.toDate === "function") {
            const d = (v.toDate as () => unknown)();
            return d instanceof Date ? d : null;
        }
        if (typeof v.toMillis === "function") {
            const ms = (v.toMillis as () => unknown)();
            return typeof ms === "number" ? new Date(ms) : null;
        }
        if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
    }
    return null;
};

const formatDate = (value: unknown): string => {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

export default function HistoryDetailScreen() {
    const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
    const [detail, setDetail] = useState<LobbyDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) {
            setError("No session ID provided.");
            setLoading(false);
            return;
        }

        let active = true;

        const load = async () => {
            try {
                const result = await fetchLobbyDetail(sessionId);
                if (!active) return;
                if (!result) {
                    setError("Lobby not found. It may have been deleted.");
                } else {
                    setDetail(result);
                }
            } catch {
                if (active) setError("Failed to load lobby details.");
            } finally {
                if (active) setLoading(false);
            }
        };

        load();
        return () => { active = false; };
    }, [sessionId]);

    const statusMeta = detail ? STATUS_META[detail.status] ?? STATUS_META.WAITING : STATUS_META.WAITING;

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: detail ? `Lobby ${detail.code}` : "Lobby Detail",
                    headerShown: true,
                }}
            />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading lobby details...</Text>
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : detail ? (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Status + Code Header */}
                    <View style={styles.headerCard}>
                        <View style={styles.headerTopRow}>
                            <Text style={styles.codeLabel} selectable>{detail.code}</Text>
                            <View style={[styles.statusPill, { backgroundColor: statusMeta.color + "1A" }]}>
                                <Ionicons name={statusMeta.icon as any} size={14} color={statusMeta.color} />
                                <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                                    {statusMeta.label}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.dateText} selectable>
                            Created {formatDate(detail.createdAt)}
                        </Text>
                    </View>

                    {/* Mission Status Card */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Mission Status</Text>
                        <View style={styles.missionCard}>
                            <View style={styles.missionRow}>
                                <Ionicons
                                    name={detail.missionStarted ? "rocket-outline" : "pause-circle-outline"}
                                    size={20}
                                    color={detail.missionStarted ? COLORS.success : COLORS.muted}
                                />
                                <Text style={styles.missionLabel}>
                                    {detail.missionStarted ? "Mission was started" : "Mission was not started"}
                                </Text>
                            </View>
                            {detail.finalDestination && (
                                <View style={styles.destinationRow}>
                                    <Ionicons name="location" size={18} color={COLORS.primary} />
                                    <Text style={styles.destinationText} selectable>
                                        {detail.finalDestination}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Members */}
                    <View style={styles.section}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.sectionTitle}>Members</Text>
                            <Text style={styles.countBadge}>{detail.participants.length}</Text>
                        </View>
                        {detail.participants.length === 0 ? (
                            <Text style={styles.emptyText}>No participant data available.</Text>
                        ) : (
                            <View style={styles.membersList}>
                                {detail.participants.map((p: LobbyDetailParticipant) => (
                                    <View key={p.uid} style={styles.memberRow}>
                                        <View style={styles.memberAvatar}>
                                            <Ionicons name="person" size={16} color={COLORS.primary} />
                                        </View>
                                        <View style={styles.memberInfo}>
                                            <Text style={styles.memberName} selectable>
                                                {p.displayName}
                                            </Text>
                                            <Text style={styles.memberDate}>
                                                Joined {formatDate(p.joinedAt)}
                                            </Text>
                                        </View>
                                        {detail.hostId === p.uid && (
                                            <View style={styles.hostBadge}>
                                                <Text style={styles.hostBadgeText}>Host</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Voted Places */}
                    {detail.recommendations.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionTitleRow}>
                                <Text style={styles.sectionTitle}>Places Voted On</Text>
                                <Text style={styles.countBadge}>{detail.recommendations.length}</Text>
                            </View>
                            <View style={styles.placesList}>
                                {detail.recommendations.map((rec: LobbyDetailRecommendation, idx: number) => {
                                    const isWinner = detail.winningPlace?.place_id === rec.place_id && !!rec.place_id;
                                    return (
                                        <View
                                            key={rec.place_id || `rec_${idx}`}
                                            style={[styles.placeRow, isWinner && styles.placeRowWinner]}
                                        >
                                            <View style={styles.placeInfo}>
                                                {isWinner && (
                                                    <Ionicons
                                                        name="trophy"
                                                        size={14}
                                                        color={COLORS.accent}
                                                        style={styles.trophyIcon}
                                                    />
                                                )}
                                                <Text
                                                    style={[styles.placeName, isWinner && styles.placeNameWinner]}
                                                    numberOfLines={2}
                                                    selectable
                                                >
                                                    {rec.description?.split(",")[0] || rec.name || "Unknown Place"}
                                                </Text>
                                            </View>
                                            <View style={styles.voteBadge}>
                                                <Text style={styles.voteCount}>
                                                    {rec.votes ?? 0}
                                                </Text>
                                                <Ionicons name="arrow-up" size={12} color={COLORS.primary} />
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        padding: 24,
    },
    loadingText: {
        color: COLORS.textDim,
        fontWeight: "600",
    },
    errorText: {
        color: COLORS.danger,
        fontWeight: "600",
        fontSize: 16,
        textAlign: "center",
    },
    scrollContent: {
        padding: 16,
        gap: 18,
        paddingBottom: 40,
    },
    headerCard: {
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        padding: 16,
        gap: 6,
        borderCurve: "continuous",
        boxShadow: "0 2px 8px rgba(129, 145, 168, 0.18)",
    } as any,
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    codeLabel: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "800",
        letterSpacing: 2,
        fontVariant: ["tabular-nums"],
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: "700",
    },
    dateText: {
        color: COLORS.textDim,
        fontSize: 13,
        fontWeight: "500",
    },
    section: {
        gap: 8,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: "800",
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    countBadge: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: "700",
        backgroundColor: COLORS.primary + "1A",
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 2,
        overflow: "hidden",
        fontVariant: ["tabular-nums"],
    },
    missionCard: {
        borderRadius: SKEUO.radius.s,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        padding: 14,
        gap: 10,
        borderCurve: "continuous",
        boxShadow: "0 1px 4px rgba(129, 145, 168, 0.12)",
    } as any,
    missionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    missionLabel: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "600",
    },
    destinationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: COLORS.primary + "0F",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    destinationText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: "700",
        flex: 1,
    },
    emptyText: {
        color: COLORS.muted,
        fontSize: 14,
    },
    membersList: {
        borderRadius: SKEUO.radius.s,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        overflow: "hidden",
        borderCurve: "continuous",
        boxShadow: "0 1px 4px rgba(129, 145, 168, 0.12)",
    } as any,
    memberRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        gap: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    memberAvatar: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: COLORS.primary + "14",
        alignItems: "center",
        justifyContent: "center",
        borderCurve: "continuous",
    } as any,
    memberInfo: {
        flex: 1,
        gap: 2,
    },
    memberName: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "700",
    },
    memberDate: {
        color: COLORS.muted,
        fontSize: 12,
    },
    hostBadge: {
        backgroundColor: COLORS.accent + "22",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    hostBadgeText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: "700",
    },
    placesList: {
        borderRadius: SKEUO.radius.s,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        overflow: "hidden",
        borderCurve: "continuous",
        boxShadow: "0 1px 4px rgba(129, 145, 168, 0.12)",
    } as any,
    placeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    placeRowWinner: {
        backgroundColor: COLORS.accent + "0D",
    },
    placeInfo: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginRight: 10,
    },
    trophyIcon: {
        marginRight: 2,
    },
    placeName: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "600",
        flex: 1,
    },
    placeNameWinner: {
        fontWeight: "800",
        color: COLORS.text,
    },
    voteBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: COLORS.primary + "14",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    voteCount: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
    },
});
