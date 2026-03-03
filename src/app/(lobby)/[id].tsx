import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { ArrowLeft, Copy, LogOut, Radio, Share2, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Share,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { UserAvatar } from "../../components/avatar/avatar-ui";
import ExitConfirmationCard from "../../components/lobby/ExitConfirmationCard";
import OlaMap from "../../components/map/OlaMap";
import { COLORS, SKEUO } from "../../constants/theme";
import { useAppAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLobby } from "../../hooks/useLobby";
import { useLobbyExitGuard } from "../../hooks/useLobbyExitGuard";
import { db } from "../../services/firebase/config";
import { updateLobbyHistoryStatus } from "../../services/firebase/history";
import { exitLobbyWithCleanup, startLobbyVoting } from "../../services/firebase/lobby-lifecycle";
import { calculateCentroid, fetchMeetingPoints } from "../../services/ola/logic";

export default function LobbyScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { session, participants, loading } = useLobby(id as string);
    const { userId } = useAppAuth();
    const toast = useToast();

    const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isScanLoading, setIsScanLoading] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        let subscriber: Location.LocationSubscription | null = null;

        const beginTracking = async () => {
            try {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (permission.status !== "granted") {
                    if (active) {
                        toast.show("Location permission denied", "error");
                    }
                    return;
                }

                subscriber = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 4500,
                        distanceInterval: 8,
                    },
                    async (position) => {
                        if (!active || !userId || !id) {
                            return;
                        }

                        const coords = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        };

                        setCurrentUserLocation(coords);
                        await updateDoc(doc(db, "sessions", id, "participants", userId), {
                            location: coords,
                            updatedAt: new Date(),
                        }).catch(() => undefined);
                    }
                );
            } catch {
                if (active) {
                    toast.show("Location tracking unavailable", "error");
                }
            }
        };

        if (id && userId) {
            beginTracking().catch(() => undefined);
        }

        return () => {
            active = false;
            subscriber?.remove();
        };
    }, [id, toast, userId]);

    const isHost = useMemo(() => session?.hostId === userId, [session?.hostId, userId]);

    const { disableGuard } = useLobbyExitGuard({
        enabled: !isLeaving,
        onExitAttempt: () => setShowExitConfirm(true),
    });

    useEffect(() => {
        if (session?.status === "VOTING" && id) {
            disableGuard();
            router.replace(`/voting?id=${id}`);
        }
    }, [disableGuard, id, session?.status]);

    const handleShareCode = async () => {
        if (!session?.code) {
            return;
        }

        await Haptics.selectionAsync();
        await Share.share({
            message: `Join my ForFriendsOnTheGo lobby with code ${session.code}`,
        }).catch(() => undefined);
    };

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

    const handleStartScan = async () => {
        if (!id || !session || !userId || session.hostId !== userId) {
            return;
        }

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsScanLoading(true);

        try {
            const center = calculateCentroid(participants);
            if (!center) {
                toast.show("Waiting for participants to share location.", "error");
                return;
            }

            const result = await fetchMeetingPoints(center.lat, center.lng);
            if (result.places.length === 0) {
                toast.show("No meeting spots found. Try again in a moment.", "error");
                return;
            }

            console.log(
                `📍 Found ${result.places.length} spots ` +
                `(${result.cafeCount} cafes, ${result.restaurantCount} restaurants) ` +
                `in ${result.iterations} pass(es)`
            );

            await startLobbyVoting({
                sessionId: id,
                center,
                places: result.places,
            });
        } catch (error) {
            if (error instanceof Error) {
                toast.show(error.message || "Scan failed.", "error");
            } else {
                toast.show("Scan failed.", "error");
            }
        } finally {
            if (mountedRef.current) {
                setIsScanLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundAlt, COLORS.background]} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Syncing lobby state...</Text>
            </View>
        );
    }

    if (!session || !id) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundAlt, COLORS.background]} style={StyleSheet.absoluteFill} />
                <Text style={styles.loadingText}>Lobby not found.</Text>
                <TouchableOpacity onPress={() => router.replace("/")} style={styles.returnButton}>
                    <Text style={styles.returnButtonText}>Back Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!userId) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={[COLORS.backgroundAlt, COLORS.background]} style={StyleSheet.absoluteFill} />
                <Text style={styles.loadingText}>Session expired. Please sign in again.</Text>
                <TouchableOpacity onPress={() => router.replace("/sign-in")} style={styles.returnButton}>
                    <Text style={styles.returnButtonText}>Go to Sign In</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <LinearGradient
                colors={[COLORS.backgroundAlt, COLORS.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.mapShell}>
                <ErrorBoundary
                    fallback={
                        <View style={styles.mapError}>
                            <Text style={styles.mapErrorText}>Map unavailable right now.</Text>
                        </View>
                    }
                >
                    <OlaMap
                        participants={participants}
                        currentUserLocation={currentUserLocation ?? undefined}
                    />
                </ErrorBoundary>

                <LinearGradient colors={["rgba(219,227,237,0.97)", "rgba(219,227,237,0.00)"]} style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.topBarIcon}>
                        <ArrowLeft size={20} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.topBarTitle}>Mission Lobby</Text>
                    <TouchableOpacity onPress={handleShareCode} style={styles.topBarIcon}>
                        <Share2 size={18} color={COLORS.text} />
                    </TouchableOpacity>
                </LinearGradient>
            </View>

            <Animated.View entering={FadeInDown.duration(260)} style={styles.panelOuter}>
                <View style={styles.panelInner}>
                    <View style={styles.codeRow}>
                        <View style={styles.codeTextWrap}>
                            <Text style={styles.codeLabel}>Lobby Code</Text>
                            <Text style={styles.codeValue}>{session.code}</Text>
                        </View>
                        <TouchableOpacity onPress={handleShareCode} style={styles.codeAction}>
                            <Copy size={16} color={COLORS.primary} />
                            <Text style={styles.codeActionText}>Share</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.participantHeader}>
                        <Users size={14} color={COLORS.textDim} />
                        <Text style={styles.participantTitle}>Participants ({participants.length})</Text>
                    </View>

                    <FlatList
                        horizontal
                        data={participants}
                        keyExtractor={(item) => item.uid}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.participantList}
                        renderItem={({ item }) => (
                            <View style={styles.participantCard}>
                                <View style={[styles.participantAvatar, item.location ? styles.participantLive : styles.participantIdle]}>
                                    <UserAvatar config={item.avatarConfig} size={48} />
                                </View>
                                <Text style={styles.participantName} numberOfLines={1}>
                                    {item.displayName}
                                </Text>
                                {item.uid === session.hostId && (
                                    <Text style={styles.hostBadge}>HOST</Text>
                                )}
                            </View>
                        )}
                    />

                    {isHost ? (
                        <TouchableOpacity
                            style={[styles.scanButton, isScanLoading && styles.scanButtonDisabled]}
                            onPress={handleStartScan}
                            disabled={isScanLoading}
                        >
                            <Radio size={18} color="#f1fff8" />
                            <Text style={styles.scanButtonText}>
                                {isScanLoading ? "Scanning..." : "Scan Meeting Spots"}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.waitingRow}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.waitingText}>Waiting for host to start scan.</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.leaveButton, isLeaving && styles.leaveButtonDisabled]}
                        onPress={() => setShowExitConfirm(true)}
                        disabled={isLeaving}
                    >
                        <LogOut size={16} color={COLORS.danger} />
                        <Text style={styles.leaveButtonText}>{isLeaving ? "Leaving..." : "Leave Lobby"}</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

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
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: COLORS.background,
    },
    loadingText: {
        color: COLORS.textDim,
        fontWeight: "700",
        fontSize: 13,
    },
    returnButton: {
        marginTop: 4,
        borderRadius: SKEUO.radius.pill,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    returnButtonText: {
        color: COLORS.text,
        fontWeight: "700",
        fontSize: 13,
    },
    mapShell: {
        flex: 0.58,
        borderRadius: 28,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.68)",
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 12, height: 12 },
        shadowOpacity: 0.44,
        shadowRadius: 18,
        elevation: 12,
        backgroundColor: COLORS.surface,
    },
    mapError: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
    },
    mapErrorText: {
        color: COLORS.danger,
        fontWeight: "700",
        fontSize: 14,
    },
    topBar: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        paddingTop: 42,
        paddingBottom: 12,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    topBarIcon: {
        width: 38,
        height: 38,
        borderRadius: SKEUO.radius.s,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(246, 249, 253, 0.94)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
    },
    topBarTitle: {
        color: COLORS.text,
        fontWeight: "800",
        fontSize: 16,
        letterSpacing: 0.3,
    },
    panelOuter: {
        flex: 0.42,
        marginTop: 12,
        borderRadius: SKEUO.radius.l,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 14, height: 14 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 12,
    },
    panelInner: {
        flex: 1,
        borderRadius: SKEUO.radius.l,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
        gap: 12,
    },
    codeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
        padding: 10,
    },
    codeTextWrap: {
        gap: 2,
    },
    codeLabel: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.9,
    },
    codeValue: {
        color: COLORS.primary,
        fontSize: 24,
        fontWeight: "900",
        letterSpacing: 1.4,
    },
    codeAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: SKEUO.radius.pill,
        backgroundColor: "rgba(47,124,245,0.14)",
        borderWidth: 1,
        borderColor: "rgba(47,124,245,0.36)",
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    codeActionText: {
        color: COLORS.primary,
        fontWeight: "800",
        fontSize: 12,
    },
    participantHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    participantTitle: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: "800",
    },
    participantList: {
        gap: 10,
        paddingRight: 10,
    },
    participantCard: {
        width: 84,
        alignItems: "center",
        gap: 4,
    },
    participantAvatar: {
        width: 52,
        height: 52,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
    },
    participantLive: {
        borderColor: COLORS.secondary,
        backgroundColor: "rgba(24,165,116,0.14)",
    },
    participantIdle: {
        borderColor: "rgba(140,152,170,0.36)",
        backgroundColor: "rgba(207,216,229,0.42)",
    },
    participantLetter: {
        color: COLORS.text,
        fontWeight: "800",
        fontSize: 18,
    },
    participantName: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "700",
        width: "100%",
        textAlign: "center",
    },
    hostBadge: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: "800",
    },
    scanButton: {
        minHeight: 46,
        borderRadius: SKEUO.radius.pill,
        backgroundColor: COLORS.secondary,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
    },
    scanButtonDisabled: {
        opacity: 0.7,
    },
    scanButtonText: {
        color: "#f1fff8",
        fontWeight: "800",
        fontSize: 13,
        letterSpacing: 0.4,
    },
    waitingRow: {
        minHeight: 46,
        borderRadius: SKEUO.radius.m,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    waitingText: {
        color: COLORS.textDim,
        fontWeight: "700",
        fontSize: 12,
    },
    leaveButton: {
        minHeight: 42,
        borderRadius: SKEUO.radius.pill,
        backgroundColor: "rgba(227,90,90,0.16)",
        borderWidth: 1,
        borderColor: "rgba(227,90,90,0.34)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 7,
    },
    leaveButtonDisabled: {
        opacity: 0.72,
    },
    leaveButtonText: {
        color: COLORS.danger,
        fontWeight: "800",
        fontSize: 12,
    },
});
