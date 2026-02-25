import { getRequiredRuntimeEnv } from "../../config/env";

const getOlaApiKey = () => getRequiredRuntimeEnv("EXPO_PUBLIC_OLA_MAPS_API_KEY");

// Simple Polyline Decoder (No external lib needed)
// Returns [{ latitude, longitude }] for <Polyline> component
const decodePolyline = (t: string) => {
    let points = [];
    let index = 0, len = t.length;
    let lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = t.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
            b = t.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        points.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
    }
    return points;
};

export const fetchRoute = async (origin: { lat: number, lng: number }, dest: { lat: number, lng: number }) => {
    try {
        const apiKey = getOlaApiKey();
        const url = `https://api.olamaps.io/routing/v1/directions?origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&mode=driving&api_key=${apiKey}`;
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();

        if (data.routes && data.routes[0]?.overview_polyline) {
            return decodePolyline(data.routes[0].overview_polyline);
        }
        return [];
    } catch (error) {
        console.error("Routing Error:", error);
        return [];
    }
};
