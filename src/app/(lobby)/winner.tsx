import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import ExitConfirmationCard from "../../components/lobby/ExitConfirmationCard";
import { COLORS, SKEUO } from "../../constants/theme";
import { useAppAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLobby } from "../../hooks/useLobby";
import { useLobbyExitGuard } from "../../hooks/useLobbyExitGuard";
import { updateLobbyHistoryStatus } from "../../services/firebase/history";
import { exitLobbyWithCleanup } from "../../services/firebase/lobby-lifecycle";

export default function WinnerScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { userId } = useAppAuth();
    const toast = useToast();
    const { session, loading } = useLobby(id as string);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const mountedRef = useRef(true);

    const isHost = useMemo(() => session?.hostId === userId, [session?.hostId, userId]);
    const winner = (session as any)?.winningPlace;

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const { disableGuard } = useLobbyExitGuard({
        enabled: !isLeaving,
        onExitAttempt: () => setShowExitConfirm(true),
    });

    const handleConfirmExit = useCallback(async () => {
        if (!userId || !id) {
            return;
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setIsLeaving(true);
        setShowExitConfirm(false);
        try {
            const result = await exitLobbyWithCleanup(id, userId);
            await updateLobbyHistoryStatus(userId, id, "EXITED").catch(() => undefined);

            if (result.wasHost && result.newHostUid) {
                toast.show("Host role passed to the next member.", "info");
            } else if (result.lobbyAbandoned) {
                toast.show("Lobby closed — you were the last one.", "info");
            } else {
                toast.show("You left the lobby.", "info");
            }
            disableGuard();
            router.replace("/");
        } catch {
            toast.show("Could not leave lobby.", "error");
        } finally {
            if (mountedRef.current) {
                setIsLeaving(false);
            }
        }
    }, [id, toast, userId]);

    if (loading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={[COLORS.backgroundAlt, COLORS.background]} style={StyleSheet.absoluteFill} />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Calculating final destination...</Text>
                </View>
            </View>
        );
    }

    if (!session) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={[COLORS.backgroundAlt, COLORS.background]} style={StyleSheet.absoluteFill} />
                <View style={styles.centerContent}>
                    <Ionicons name="alert-circle-outline" size={58} color={COLORS.danger} />
                    <Text style={styles.errorText}>Mission data not found</Text>
                    <TouchableOpacity onPress={() => router.replace("/")} style={styles.homeButton}>
                        <Text style={styles.homeButtonText}>Return Home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <StatusBar barStyle="dark-content" />

            <LinearGradient
                colors={[COLORS.backgroundAlt, COLORS.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.content}>
                <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.headerContainer}>
                    <Text style={styles.headerLabel}>Mission Complete</Text>
                    <Text style={styles.headerTitle}>Top Pick Locked</Text>
                </Animated.View>

                {winner ? (
                    <Animated.View entering={ZoomIn.delay(250).springify()} style={styles.cardOuter}>
                        <View style={styles.cardInner}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="trophy" size={28} color={COLORS.accent} />
                            </View>

                            <Text style={styles.placeName}>
                                {winner.structured_formatting?.main_text || winner.description || "Mystery Place"}
                            </Text>

                            <Text style={styles.placeAddress}>
                                {winner.structured_formatting?.secondary_text || "Chosen by your group"}
                            </Text>

                            <View style={styles.statsRow}>
                                <View style={styles.statBadge}>
                                    <Ionicons name="star" size={14} color={COLORS.accent} />
                                    <Text style={styles.statText}>{winner.votes || 0} Votes</Text>
                                </View>
                                <View style={[styles.statBadge, styles.primaryBadge]}>
                                    <Ionicons name="location" size={14} color={COLORS.primary} />
                                    <Text style={[styles.statText, styles.primaryStatText]}>Winner</Text>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                ) : (
                    <Animated.View entering={FadeInUp.delay(260)} style={styles.errorContainer}>
                        <Text style={styles.errorText}>No consensus reached.</Text>
                    </Animated.View>
                )}

                <View style={styles.footer}>
                    {winner && (
                        <Animated.View entering={FadeInUp.delay(420).springify()} style={styles.fullWidth}>
                            <TouchableOpacity
                                style={styles.primaryButtonShell}
                                onPress={() => {
                                    disableGuard();
                                    router.push(`/navigation?id=${id}`);
                                }}
                            >
                                <LinearGradient
                                    colors={[COLORS.primary, COLORS.primaryDeep]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.primaryButton}
                                >
                                    <Text style={styles.primaryButtonText}>Start Live Navigation</Text>
                                    <Ionicons name="navigate-circle" size={24} color="#f6fbff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInUp.delay(520).springify()} style={styles.fullWidth}>
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setShowExitConfirm(true)}
                        >
                            <Text style={styles.secondaryButtonText}>Leave Lobby</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>

            <ExitConfirmationCard
                visible={showExitConfirm}
                isHost={isHost}
                loading={isLeaving}
                onConfirm={handleConfirmExit}
                onCancel={() => setShowExitConfirm(false)}
            />
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
        padding: 24,
    },
    loadingText: {
        color: COLORS.textDim,
        fontSize: 16,
        fontWeight: "600",
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 17,
        fontWeight: "700",
    },
    homeButton: {
        marginTop: 10,
        borderRadius: SKEUO.radius.pill,
        backgroundColor: COLORS.card,
        paddingVertical: 12,
        paddingHorizontal: 18,
    },
    homeButtonText: {
        color: COLORS.text,
        fontWeight: "700",
    },
    content: {
        flex: 1,
        paddingHorizontal: 22,
        paddingTop: 82,
        paddingBottom: 40,
        justifyContent: "space-between",
        alignItems: "center",
    },
    headerContainer: {
        alignItems: "center",
    },
    headerLabel: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.6,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 36,
        fontWeight: "800",
        textAlign: "center",
    },
    cardOuter: {
        width: "100%",
        borderRadius: 32,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 12, height: 12 },
        shadowOpacity: 0.44,
        shadowRadius: 18,
        elevation: 12,
    },
    cardInner: {
        borderRadius: 32,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        padding: 28,
        alignItems: "center",
    },
    iconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "rgba(244, 183, 79, 0.18)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    placeName: {
        color: COLORS.text,
        fontSize: 28,
        fontWeight: "800",
        lineHeight: 34,
        textAlign: "center",
        marginBottom: 8,
    },
    placeAddress: {
        color: COLORS.textDim,
        fontSize: 15,
        lineHeight: 20,
        textAlign: "center",
        marginBottom: 20,
    },
    statsRow: {
        flexDirection: "row",
        gap: 10,
    },
    statBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: 16,
        backgroundColor: "rgba(244, 183, 79, 0.18)",
        paddingHorizontal: 11,
        paddingVertical: 6,
    },
    primaryBadge: {
        backgroundColor: "rgba(47, 124, 245, 0.16)",
    },
    statText: {
        color: "#7f5f1d",
        fontWeight: "700",
        fontSize: 12,
    },
    primaryStatText: {
        color: COLORS.primary,
    },
    errorContainer: {
        borderRadius: SKEUO.radius.m,
        backgroundColor: "rgba(227, 90, 90, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(227, 90, 90, 0.35)",
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    footer: {
        width: "100%",
        alignItems: "center",
        gap: 14,
    },
    fullWidth: {
        width: "100%",
    },
    primaryButtonShell: {
        borderRadius: SKEUO.radius.pill,
        shadowColor: "rgba(31, 98, 204, 0.45)",
        shadowOffset: { width: 8, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    primaryButton: {
        borderRadius: SKEUO.radius.pill,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        paddingVertical: 17,
    },
    primaryButtonText: {
        color: "#f6fbff",
        fontSize: 16,
        fontWeight: "800",
    },
    secondaryButton: {
        borderRadius: SKEUO.radius.pill,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
    },
    secondaryButtonText: {
        color: COLORS.textDim,
        fontWeight: "700",
        fontSize: 15,
    },
});
