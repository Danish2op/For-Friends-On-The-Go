import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View } from "@/src/components/ui/tamagui-primitives";

import { COLORS, SKEUO } from "../../constants/theme";
import { calculateCentroid, getAutocompleteSuggestions, getPlaceDetails } from "../../services/ola/logic";
import OlaMap, { type OlaMapRef } from "../map/OlaMap";

interface AddPlaceSheetProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (place: any) => void;
    userLocation: { lat: number; lng: number };
    participants: { uid: string; displayName: string; location?: { lat: number; lng: number } }[];
}

type Region = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

const defaultRegion: Region = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

const dedupeSuggestionItems = (items: any[]) => {
    const byKey = new Map<string, any>();

    items.forEach((item, index) => {
        if (!item || typeof item !== "object") {
            return;
        }
        const placeId = typeof item.place_id === "string" ? item.place_id.trim().toLowerCase() : "";
        const description = `${item.description || item.name || ""}`.trim().toLowerCase();
        const key = placeId || (description ? `desc:${description}` : `idx:${index}`);

        if (!byKey.has(key)) {
            byKey.set(key, item);
        }
    });

    return [...byKey.values()];
};

export default function AddPlaceSheet({
    visible,
    onClose,
    onConfirm,
    userLocation,
    participants,
}: AddPlaceSheetProps) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<OlaMapRef>(null);

    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const initialRegion = useMemo(() => {
        const centroid = calculateCentroid(participants as any);
        if (centroid) {
            return {
                latitude: centroid.lat,
                longitude: centroid.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            };
        }

        if (userLocation?.lat && userLocation?.lng) {
            return {
                latitude: userLocation.lat,
                longitude: userLocation.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            };
        }

        return defaultRegion;
    }, [participants, userLocation]);

    // commandedRegion: ONLY updated by programmatic actions (modal open, suggestion select).
    // This drives the map's initialRegion prop. User drags NEVER update this.
    const [commandedRegion, setCommandedRegion] = useState<Region>(initialRegion);

    // mapCenterRef: silently tracks the current map center for autocomplete API bias.
    // Using a ref avoids re-renders and prevents feeding state back into the map.
    const mapCenterRef = useRef<{ latitude: number; longitude: number }>({
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
    });

    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedPlaceName, setSelectedPlaceName] = useState("");

    useEffect(() => {
        if (visible) {
            setCommandedRegion(initialRegion);
            mapCenterRef.current = { latitude: initialRegion.latitude, longitude: initialRegion.longitude };
            setSelectedLocation({ lat: initialRegion.latitude, lng: initialRegion.longitude });
            setSuggestions([]);
            setQuery("");
            setSelectedPlaceName("");
        }
    }, [initialRegion, visible]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length < 3) {
                setSuggestions([]);
                return;
            }

            setLoading(true);
            // Read center from ref — no dependency on dragged state, no feedback loop
            const { latitude, longitude } = mapCenterRef.current;
            const results = await getAutocompleteSuggestions(query.trim(), latitude, longitude);
            setSuggestions(dedupeSuggestionItems(results || []));
            setLoading(false);
        }, 450);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelectSuggestion = async (item: any) => {
        await Haptics.selectionAsync();
        Keyboard.dismiss();

        setQuery(item.description || item.name || "");
        setSuggestions([]);

        // Prefer coordinates embedded in autocomplete prediction (faster, no extra API call).
        // Fall back to getPlaceDetails only when the prediction doesn't carry geometry.
        let loc: { lat: number; lng: number } | null = null;
        let placeName = item.description || item.name || "";

        if (item.geometry?.location?.lat && item.geometry?.location?.lng) {
            loc = item.geometry.location;
        } else if (item.place_id) {
            const details = await getPlaceDetails(item.place_id);
            if (details?.geometry?.location) {
                loc = details.geometry.location;
                placeName = details.name || placeName;
            }
        }

        if (loc) {
            const newRegion: Region = {
                latitude: loc.lat,
                longitude: loc.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
            setCommandedRegion(newRegion);
            mapCenterRef.current = { latitude: loc.lat, longitude: loc.lng };
            setSelectedLocation(loc);
            setSelectedPlaceName(placeName);

            // Imperative flyTo — bypasses the deep-compare guard in LeafletMap
            // so the map ALWAYS moves to the selected place, even if nearby.
            mapRef.current?.flyTo(loc.lat, loc.lng);
        }
    };

    const handleRegionChangeComplete = (mapRegion: Region) => {
        // Only update the ref (for API bias) and the selected location (for confirm).
        // Do NOT update commandedRegion — that would feed back into the map and cause shaking.
        mapCenterRef.current = { latitude: mapRegion.latitude, longitude: mapRegion.longitude };
        setSelectedLocation({ lat: mapRegion.latitude, lng: mapRegion.longitude });
    };

    const handleConfirm = async () => {
        if (!selectedLocation) return;

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        onConfirm({
            name: selectedPlaceName || query || "Custom Pin",
            description: selectedPlaceName || query || "Custom Location",
            geometry: { location: selectedLocation },
            place_id: `custom_${Date.now()}`,
        });

        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior="padding"
                    style={styles.keyboardContainer}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                >
                    <View style={[styles.sheetOuter, { paddingBottom: Math.max(insets.bottom, 18) }]}>
                        <View style={styles.sheetInner}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Suggest A Place</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={20} color={COLORS.textDim} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.searchRow}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Search places"
                                    placeholderTextColor={COLORS.muted}
                                    value={query}
                                    onChangeText={setQuery}
                                />
                                {query.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setQuery("");
                                            setSuggestions([]);
                                        }}
                                        style={styles.clearBtn}
                                    >
                                        <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
                                    </TouchableOpacity>
                                )}
                                {loading && <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />}
                            </View>

                            {suggestions.length > 0 && (
                                <View style={styles.suggestionsContainer}>
                                    <FlatList
                                        data={suggestions}
                                        keyboardShouldPersistTaps="handled"
                                        nestedScrollEnabled
                                        keyExtractor={(item, index) =>
                                            typeof item.place_id === "string" && item.place_id.trim().length > 0
                                                ? item.place_id
                                                : `suggestion_${index}_${(item.description || item.name || "").toString()}`
                                        }
                                        renderItem={({ item }) => (
                                            <TouchableOpacity style={styles.item} onPress={() => handleSelectSuggestion(item)}>
                                                <Ionicons name="location-outline" size={16} color={COLORS.textDim} />
                                                <Text style={styles.itemText} numberOfLines={1}>
                                                    {item.description || item.name}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    />
                                </View>
                            )}

                            <View style={styles.mapWrapper}>
                                <OlaMap
                                    ref={mapRef}
                                    participants={participants}
                                    currentUserLocation={selectedLocation || userLocation}
                                    initialRegion={commandedRegion}
                                    onRegionChangeComplete={handleRegionChangeComplete}
                                />
                                <View style={styles.crosshair} pointerEvents="none">
                                    <Text style={styles.crosshairIcon}>⌖</Text>
                                </View>
                                <View style={styles.mapHint}>
                                    <Text style={styles.mapHintText}>Drag map to position pin</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.confirmBtn, !selectedLocation && styles.confirmBtnDisabled]}
                                onPress={handleConfirm}
                                disabled={!selectedLocation}
                                activeOpacity={0.9}
                            >
                                <Text style={styles.btnText}>Add To Vote List</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(13, 18, 28, 0.36)",
    },
    keyboardContainer: {
        width: "100%",
        maxHeight: "86%",
        flex: 1,
    },
    sheetOuter: {
        flex: 1,
        borderTopLeftRadius: SKEUO.radius.xl,
        borderTopRightRadius: SKEUO.radius.xl,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 14,
    },
    sheetInner: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderTopLeftRadius: SKEUO.radius.xl,
        borderTopRightRadius: SKEUO.radius.xl,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        paddingHorizontal: 18,
        paddingTop: 16,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    title: {
        fontSize: 20,
        fontWeight: "800",
        color: COLORS.text,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.surfaceDeep,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    input: {
        flex: 1,
        color: COLORS.text,
        fontSize: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontWeight: "600",
    },
    clearBtn: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    loader: {
        marginRight: 10,
    },
    suggestionsContainer: {
        maxHeight: 230,
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 10,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(195,206,221,0.4)",
    },
    itemText: {
        flex: 1,
        color: COLORS.text,
        fontSize: 14,
    },
    mapWrapper: {
        flex: 1,
        borderRadius: SKEUO.radius.l,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 14,
    },
    crosshair: {
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: -11,
        marginTop: -20,
        alignItems: "center",
        justifyContent: "center",
    },
    crosshairIcon: {
        color: COLORS.primary,
        fontSize: 30,
        fontWeight: "800",
    },
    mapHint: {
        position: "absolute",
        top: 10,
        alignSelf: "center",
        backgroundColor: "rgba(239, 245, 255, 0.92)",
        borderRadius: SKEUO.radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.8)",
    },
    mapHintText: {
        color: COLORS.textDim,
        fontWeight: "700",
        fontSize: 12,
    },
    confirmBtn: {
        borderRadius: SKEUO.radius.pill,
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 6,
    },
    confirmBtnDisabled: {
        backgroundColor: COLORS.surfaceDeep,
        borderWidth: 1,
        borderColor: COLORS.border,
        opacity: 0.7,
    },
    btnText: {
        color: COLORS.primaryText,
        fontWeight: "800",
        fontSize: 15,
        letterSpacing: 0.4,
    },
});
