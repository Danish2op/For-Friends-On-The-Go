import * as Haptics from "expo-haptics";
import { Compass, Locate } from "lucide-react-native";
import React, { useImperativeHandle, useRef } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { View } from "@/src/components/ui/tamagui-primitives";

import { COLORS } from "../../constants/theme";
import { useToast } from "../../context/ToastContext";
import LeafletMap, { LeafletMapRef } from "./LeafletMap";

interface Location {
    lat: number;
    lng: number;
}

interface Participant {
    uid: string;
    displayName: string;
    location?: Location;
}

interface OlaMapProps {
    participants: Participant[];
    currentUserLocation?: Location;
    destination?: Location | null;
    routeCoords?: { latitude: number; longitude: number }[];
    onRegionChangeComplete?: (region: any) => void;
    initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
    controlsPosition?: "top-left" | "bottom-left";
    externalNightMode?: boolean;
}

export type OlaMapRef = LeafletMapRef;

const OlaMap = React.forwardRef<OlaMapRef, OlaMapProps>(function OlaMap(props, ref) {
    const mapRef = useRef<LeafletMapRef>(null);
    const toast = useToast();

    // Expose the inner LeafletMap handle to the parent
    useImperativeHandle(ref, () => ({
        recenter: () => mapRef.current?.recenter(),
        flyTo: (lat: number, lng: number) => mapRef.current?.flyTo(lat, lng),
    }), []);

    const handleRecenter = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        mapRef.current?.recenter();
    };

    const handleResetNorth = async () => {
        await Haptics.selectionAsync();
        mapRef.current?.recenter();
        toast.show("View reset", "info", 1200);
    };

    return (
        <View style={styles.container}>
            <LeafletMap ref={mapRef} {...props} />

            <View
                style={[
                    styles.controlsColumn,
                    props.controlsPosition === "top-left" ? styles.controlsTop : styles.controlsBottom,
                ]}
            >
                <TouchableOpacity style={styles.controlBtn} onPress={handleResetNorth} activeOpacity={0.9}>
                    <Compass size={20} color={COLORS.text} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlBtn, styles.controlPrimary]} onPress={handleRecenter} activeOpacity={0.9}>
                    <Locate size={20} color="#f6fbff" />
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default OlaMap;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden",
    },
    controlsColumn: {
        position: "absolute",
        left: 18,
        gap: 12,
        alignItems: "flex-start",
    },
    controlsTop: {
        top: 110,
    },
    controlsBottom: {
        bottom: 34,
    },
    controlBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: "rgba(245,249,255,0.94)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.76)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.34,
        shadowRadius: 10,
        elevation: 8,
    },
    controlPrimary: {
        backgroundColor: COLORS.primary,
        borderColor: "rgba(255,255,255,0.45)",
    },
});
