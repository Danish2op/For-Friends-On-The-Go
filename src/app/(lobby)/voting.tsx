import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown, Layout, ZoomIn } from "react-native-reanimated";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import ExitConfirmationCard from "../../components/lobby/ExitConfirmationCard";
import AddPlaceSheet from "../../components/voting/AddPlaceSheet";
import { COLORS, SKEUO } from "../../constants/theme";
import { useAppAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLobby } from "../../hooks/useLobby";
import { useLobbyExitGuard } from "../../hooks/useLobbyExitGuard";
import { castVote, finishVoting } from "../../services/firebase/firestore";
import { updateLobbyHistoryStatus } from "../../services/firebase/history";
import { exitLobbyWithCleanup } from "../../services/firebase/lobby-lifecycle";
import { dedupeRecommendations } from "../../services/firebase/recommendation-utils";
import { addCustomRecommendation } from "../../services/firebase/recommendations";

const resolveTimestampMillis = (value: unknown): number | null => {
    if (!value) {
        return null;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "object" && value !== null) {
        const withToMillis = value as { toMillis?: unknown };
        if (typeof withToMillis.toMillis === "function") {
            const parsed = (withToMillis.toMillis as () => unknown)();
            return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
        }
    }

    return null;
};

export default function VotingScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { userId } = useAppAuth();
    const toast = useToast();
    const { session, participants, loading } = useLobby(id as string);
    const [timeLeft, setTimeLeft] = useState("00:00");
    const [isAddSheetVisible, setAddSheetVisible] = useState(false);
    const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const mountedRef = useRef(true);

    const isHost = useMemo(() => session?.hostId === userId, [session?.hostId, userId]);

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

    useEffect(() => {
        let active = true;

        const loadLocation = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted" || !active) {
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            if (active) {
                setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
        };

        loadLocation().catch(() => undefined);

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const end = resolveTimestampMillis(session?.votingEndTime);
        const hostId = session?.hostId;
        const status = session?.status;
        if (!end) {
            return;
        }

        const interval = setInterval(() => {
            const diff = end - Date.now();

            if (diff <= 0) {
                setTimeLeft("00:00");
                clearInterval(interval);

                if (userId && hostId === userId && status !== "FINISHED") {
                    finishVoting(id as string);
                }
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [id, session?.hostId, session?.status, session?.votingEndTime, userId]);

    useEffect(() => {
        if (session?.status === "FINISHED") {
            disableGuard();
            router.replace(`/winner?id=${id}`);
        }
    }, [disableGuard, id, session?.status]);

    const recommendations = useMemo(
        () => dedupeRecommendations(session?.recommendations || []),
        [session?.recommendations]
    );

    const handleVote = async (placeId: string) => {
        if (!userId || !id) {
            toast.show("Session expired. Rejoin lobby.", "error");
            return;
        }

        await Haptics.selectionAsync();
        castVote(id, placeId, userId);
    };

    const handleFinish = () => {
        Alert.alert("Finalize voting?", "This locks in the winner.", [
            { text: "Cancel", style: "cancel" },
            { text: "Confirm", onPress: () => finishVoting(id as string) },
        ]);
    };

    const handleConfirmAddPlace = async (place: any) => {
        const success = await addCustomRecommendation(id as string, place);
        if (success) {
            setAddSheetVisible(false);
            toast.show("Place added", "success");
            return;
        }
        Alert.alert("Error", "Could not add this place. Please try again.");
    };

    if (loading || !session) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={[COLORS.backgroundAlt, COLORS.background]}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Syncing voting data...</Text>
                </View>
            </View>
        );
    }

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const hasVoted = userId ? item.voters?.includes(userId) : false;

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 80).springify()}
                layout={Layout.springify()}
                style={[styles.cardOuter, hasVoted && styles.cardOuterActive]}
            >
                <View style={[styles.card, hasVoted && styles.cardActive]}>
                    <View style={styles.textContainer}>
                        <Text style={styles.placeName} numberOfLines={1}>
                            {item.description?.split(",")[0] || item.name}
                        </Text>
                        <Text style={styles.placeAddress} numberOfLines={2}>
                            {item.description}
                        </Text>
                    </View>

                    <View style={styles.voteAction}>
                        <View style={styles.voteBadge}>
                            <Ionicons name="people" size={12} color={COLORS.textDim} />
                            <Text style={styles.voteCount}>{item.votes || 0}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.voteButton, hasVoted ? styles.unvoteButton : styles.voteButtonPrimary]}
                            onPress={() => handleVote(item.place_id)}
                            activeOpacity={0.88}
                        >
                            <Ionicons
                                name={hasVoted ? "checkmark-circle" : "arrow-up-circle-outline"}
                                size={20}
                                color="#f6fbff"
                            />
                            <Text style={styles.voteButtonText}>{hasVoted ? "Voted" : "Vote"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        );
    };

    const hostCanFinish = Boolean(userId && session.hostId === userId);

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

            <View style={styles.headerOuter}>
                <View style={styles.headerInner}>
                    <Text style={styles.headerLabel}>Vote For Meeting Spot</Text>
                    <View style={styles.timerContainer}>
                        <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.timerText}>{timeLeft}</Text>
                    </View>
                </View>
            </View>

            <FlatList
                data={recommendations}
                keyExtractor={(item, index) =>
                    typeof item.place_id === "string" && item.place_id.trim().length > 0
                        ? item.place_id
                        : `recommendation_${index}`
                }
                contentContainerStyle={styles.listContent}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No places found yet.</Text>
                    </View>
                }
                ListFooterComponent={
                    <TouchableOpacity style={styles.suggestButton} onPress={() => setAddSheetVisible(true)}>
                        <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
                        <Text style={styles.suggestButtonText}>Suggest a Place</Text>
                    </TouchableOpacity>
                }
            />

            {hostCanFinish && (
                <View style={styles.fabContainer}>
                    <Animated.View entering={ZoomIn.delay(350).springify()}>
                        <TouchableOpacity style={styles.finishShell} onPress={handleFinish} activeOpacity={0.9}>
                            <LinearGradient
                                colors={[COLORS.accent, "#e19d2c"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.finishFab}
                            >
                                <Text style={styles.finishFabText}>End Voting</Text>
                                <Ionicons name="stop-circle-outline" size={22} color="#fff9ef" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            <AddPlaceSheet
                visible={isAddSheetVisible}
                onClose={() => setAddSheetVisible(false)}
                onConfirm={handleConfirmAddPlace}
                userLocation={
                    participants.find((participant) => participant.uid === userId)?.location ||
                    (session as any)?.center ||
                    myLocation ||
                    { lat: 12.9716, lng: 77.5946 }
                }
                participants={participants}
            />

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
    },
    loadingText: {
        color: COLORS.textDim,
        marginTop: 14,
        fontWeight: "600",
    },
    headerOuter: {
        marginHorizontal: 16,
        marginTop: 56,
        borderRadius: 26,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 12,
    },
    headerInner: {
        borderRadius: 26,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: "center",
    },
    headerLabel: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    timerContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: COLORS.surface,
        borderRadius: SKEUO.radius.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    timerText: {
        color: COLORS.text,
        fontWeight: "800",
        fontSize: 28,
        fontVariant: ["tabular-nums"],
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 130,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: "center",
    },
    emptyText: {
        color: COLORS.textDim,
        fontSize: 15,
    },
    cardOuter: {
        borderRadius: SKEUO.radius.m,
        marginBottom: 12,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 8, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    cardOuterActive: {
        shadowColor: "rgba(48, 124, 245, 0.35)",
    },
    card: {
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.62)",
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
    },
    cardActive: {
        borderColor: "rgba(47, 124, 245, 0.5)",
        backgroundColor: "#e3edff",
    },
    textContainer: {
        flex: 1,
        marginRight: 10,
    },
    placeName: {
        fontSize: 16,
        color: COLORS.text,
        fontWeight: "700",
        marginBottom: 4,
    },
    placeAddress: {
        fontSize: 12,
        color: COLORS.textDim,
    },
    voteAction: {
        alignItems: "flex-end",
        gap: 8,
    },
    voteBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    voteCount: {
        color: COLORS.textDim,
        fontWeight: "700",
        fontSize: 12,
    },
    voteButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        minWidth: 94,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 14,
    },
    voteButtonPrimary: {
        backgroundColor: COLORS.primary,
    },
    unvoteButton: {
        backgroundColor: "rgba(227, 90, 90, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(227, 90, 90, 0.35)",
    },
    voteButtonText: {
        color: "#f6fbff",
        fontWeight: "700",
        fontSize: 14,
    },
    suggestButton: {
        marginTop: 18,
        borderRadius: SKEUO.radius.m,
        borderWidth: 1,
        borderColor: "rgba(47,124,245,0.45)",
        borderStyle: "dashed",
        backgroundColor: "rgba(47,124,245,0.08)",
        paddingVertical: 15,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
    },
    suggestButtonText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: "700",
    },
    fabContainer: {
        position: "absolute",
        bottom: 26,
        left: 0,
        right: 0,
        alignItems: "center",
    },
    finishShell: {
        borderRadius: SKEUO.radius.pill,
        shadowColor: "rgba(225, 157, 44, 0.42)",
        shadowOffset: { width: 8, height: 10 },
        shadowOpacity: 0.48,
        shadowRadius: 14,
        elevation: 10,
    },
    finishFab: {
        borderRadius: SKEUO.radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 28,
    },
    finishFabText: {
        color: "#fff9ef",
        fontWeight: "800",
        fontSize: 15,
        letterSpacing: 0.3,
    },
});
