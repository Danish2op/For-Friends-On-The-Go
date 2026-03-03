import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, StatusBar, StyleSheet, TouchableOpacity } from "react-native";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import ExitConfirmationCard from "../../components/lobby/ExitConfirmationCard";
import OlaMap from "../../components/map/OlaMap";
import { COLORS, SKEUO } from "../../constants/theme";
import { useAppAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useLobby } from "../../hooks/useLobby";
import { useLobbyExitGuard } from "../../hooks/useLobbyExitGuard";
import { db } from "../../services/firebase/config";
import { updateLobbyHistoryStatus } from "../../services/firebase/history";
import { exitLobbyWithCleanup } from "../../services/firebase/lobby-lifecycle";
import { fetchPlaceDetails } from "../../services/ola/logic";
import { fetchRoute } from "../../services/ola/routing";

export default function NavigationScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { userId } = useAppAuth();
    const toast = useToast();
    const { session, participants } = useLobby(id as string);
    const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[]>([]);
    const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const routeRequestedRef = useRef(false);
    const mountedRef = useRef(true);

    const isHost = useMemo(() => session?.hostId === userId, [session?.hostId, userId]);
    const winningPlace = (session as any)?.winningPlace;

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
                toast.show("Mission complete — lobby closed.", "info");
            } else {
                toast.show("You left the mission.", "info");
            }
            disableGuard();
            router.replace("/");
        } catch {
            toast.show("Could not leave mission.", "error");
        } finally {
            if (mountedRef.current) {
                setIsLeaving(false);
            }
        }
    }, [id, toast, userId]);

    useEffect(() => {
        let active = true;
        const resolveDestination = async () => {
            if (!winningPlace) return;

            if (winningPlace.geometry?.location?.lat && winningPlace.geometry?.location?.lng) {
                if (active) {
                    setDestCoords(winningPlace.geometry.location);
                }
                return;
            }

            if (winningPlace.location?.lat && winningPlace.location?.lng) {
                if (active) {
                    setDestCoords(winningPlace.location);
                }
                return;
            }

            if (winningPlace.place_id) {
                const coords = await fetchPlaceDetails(winningPlace.place_id);
                if (active && coords) {
                    setDestCoords(coords);
                }
            }
        };

        resolveDestination();

        return () => {
            active = false;
        };
    }, [winningPlace]);

    useEffect(() => {
        routeRequestedRef.current = false;
        setRoutePath([]);
    }, [destCoords?.lat, destCoords?.lng]);

    useEffect(() => {
        let subscriber: Location.LocationSubscription | null = null;
        let mounted = true;

        const track = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") return;

            subscriber = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
                async (loc) => {
                    if (!mounted) return;

                    const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
                    setMyLocation(coords);

                    if (userId) {
                        updateDoc(doc(db, "sessions", id as string, "participants", userId), {
                            location: coords,
                            updatedAt: new Date(),
                        }).catch(() => undefined);
                    }

                    if (destCoords && !routeRequestedRef.current) {
                        routeRequestedRef.current = true;
                        const path = await fetchRoute(coords, destCoords);
                        if (path && path.length > 0) {
                            setRoutePath(path);
                        } else {
                            routeRequestedRef.current = false;
                        }
                    }
                }
            );
        };

        track();

        return () => {
            mounted = false;
            subscriber?.remove();
        };
    }, [destCoords, id, userId]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <StatusBar
                barStyle={theme === "dark" ? "light-content" : "dark-content"}
                translucent
                backgroundColor="transparent"
            />

            <View style={styles.mapFrame}>
                <OlaMap
                    participants={participants}
                    currentUserLocation={myLocation || undefined}
                    destination={destCoords}
                    routeCoords={routePath}
                    externalNightMode={theme === "dark"}
                    controlsPosition="top-left"
                />
            </View>

            <View style={styles.topBar}>
                <Text style={styles.topLabel}>Live Navigation</Text>
            </View>

            <TouchableOpacity
                style={styles.themeToggle}
                onPress={async () => {
                    await Haptics.selectionAsync();
                    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
                }}
            >
                <Ionicons
                    name={theme === "dark" ? "sunny" : "moon"}
                    size={22}
                    color={theme === "dark" ? COLORS.accent : COLORS.primary}
                />
            </TouchableOpacity>

            <View style={styles.hudShadow}>
                <LinearGradient
                    colors={theme === "dark" ? ["rgba(38,46,61,0.95)", "rgba(17,25,37,0.98)"] : [COLORS.card, COLORS.surface]}
                    style={styles.hudCard}
                >
                    <View style={styles.destInfo}>
                        <Text style={styles.flagIcon}>🏁</Text>
                        <View style={styles.destTextWrap}>
                            <Text style={[styles.destTitle, theme === "dark" && styles.destTitleDark]} numberOfLines={1}>
                                {winningPlace?.description?.split(",")[0] || winningPlace?.name || "Unknown Destination"}
                            </Text>
                            <Text style={styles.destSub}>{participants.length} friends active</Text>
                        </View>
                    </View>

                    <View style={styles.actionsColumn}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.mapsBtn]}
                            onPress={async () => {
                                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (destCoords) {
                                    const url = `https://www.google.com/maps/dir/?api=1&destination=${destCoords.lat},${destCoords.lng}&travelmode=driving`;
                                    Linking.openURL(url);
                                }
                            }}
                        >
                            <Text style={styles.actionText}>Open In Google Maps</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.exitBtn]}
                            onPress={() => setShowExitConfirm(true)}
                        >
                            <Text style={styles.actionText}>Exit Mission</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
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
    mapFrame: {
        ...StyleSheet.absoluteFillObject,
    },
    topBar: {
        position: "absolute",
        top: 52,
        alignSelf: "center",
        borderRadius: SKEUO.radius.pill,
        paddingHorizontal: 20,
        paddingVertical: 9,
        backgroundColor: "rgba(238,244,252,0.9)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.75)",
    },
    topLabel: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1.2,
        textTransform: "uppercase",
    },
    themeToggle: {
        position: "absolute",
        top: 50,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(238,244,252,0.9)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.75)",
    },
    hudShadow: {
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 24,
        borderRadius: 24,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 8, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
    },
    hudCard: {
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        gap: 16,
    },
    destInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    flagIcon: {
        fontSize: 30,
    },
    destTextWrap: {
        flex: 1,
    },
    destTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "800",
    },
    destTitleDark: {
        color: "#f6fbff",
    },
    destSub: {
        color: COLORS.textDim,
        marginTop: 2,
        fontSize: 13,
    },
    actionsColumn: {
        gap: 10,
    },
    actionBtn: {
        borderRadius: SKEUO.radius.m,
        paddingVertical: 14,
        alignItems: "center",
    },
    mapsBtn: {
        backgroundColor: COLORS.primary,
    },
    exitBtn: {
        backgroundColor: COLORS.danger,
    },
    actionText: {
        color: "#f7fbff",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
});
