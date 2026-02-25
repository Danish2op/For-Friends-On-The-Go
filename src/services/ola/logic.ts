import { getRequiredRuntimeEnv } from "../../config/env";

export const calculateCentroid = (participants: any[]) => {
    const validParticipants = participants.filter(
        (p) => p.location && p.location.lat && p.location.lng
    );

    if (validParticipants.length === 0) {
        return null;
    }

    const total = validParticipants.reduce(
        (acc, p) => {
            return {
                lat: acc.lat + p.location.lat,
                lng: acc.lng + p.location.lng,
            };
        },
        { lat: 0, lng: 0 }
    );

    return {
        lat: total.lat / validParticipants.length,
        lng: total.lng / validParticipants.length,
    };
};

const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
};

export const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

const getOlaApiKey = () => getRequiredRuntimeEnv("EXPO_PUBLIC_OLA_MAPS_API_KEY");

const buildPlaceIdentityKey = (place: any, index: number) => {
    const placeId = typeof place?.place_id === "string" ? place.place_id.trim().toLowerCase() : "";
    if (placeId) {
        return `id:${placeId}`;
    }

    const primaryText = `${place?.description || place?.name || ""}`.trim().toLowerCase();
    const lat = place?.geometry?.location?.lat;
    const lng = place?.geometry?.location?.lng;
    const coordsKey = typeof lat === "number" && typeof lng === "number"
        ? `${lat.toFixed(6)},${lng.toFixed(6)}`
        : "";

    if (primaryText && coordsKey) {
        return `text:${primaryText}|coords:${coordsKey}`;
    }
    if (primaryText) {
        return `text:${primaryText}`;
    }
    return `idx:${index}`;
};

const dedupePlaces = (places: any[]) => {
    const byKey = new Map<string, any>();
    places.forEach((place, index) => {
        if (!place || typeof place !== "object") {
            return;
        }
        const identityKey = buildPlaceIdentityKey(place, index);
        if (!byKey.has(identityKey)) {
            byKey.set(identityKey, place);
        }
    });
    return [...byKey.values()];
};

export const fetchMeetingPoints = async (lat: number, lng: number) => {
    try {
        const apiKey = getOlaApiKey();
        // STRICTER QUERY: Only food & drink
        const url = `https://api.olamaps.io/places/v1/nearbysearch?layers=venue&types=restaurant,cafe,bar&location=${lat},${lng}&radius=2000&api_key=${apiKey}`;

        console.log("🔍 Requesting URL:", url);
        const response = await fetch(url);
        const data = await response.json();

        const rawPlaces = data.predictions || data.places || [];

        // THE BOUNCER: Filter out junk keywords
        const cleanPlaces = rawPlaces.filter((place: any) => {
            const name = (place.description || place.name || "").toLowerCase();
            const junkWords = ["mechanic", "repair", "auto", "tyre", "tire", "honda", "tvs", "service center", "grocery", "store", "kirana", "medical", "atm", "sabzi", "mandi", "vegetable", "market"];
            return !junkWords.some(word => name.includes(word));
        });

        const dedupedPlaces = dedupePlaces(cleanPlaces);
        console.log(`🧹 Filtered ${rawPlaces.length} places down to ${cleanPlaces.length} clean spots.`);
        console.log(`🧩 Removed duplicates. Final suggestion count: ${dedupedPlaces.length}.`);
        return dedupedPlaces;
    } catch (error) {
        console.error("❌ Error fetching meeting points:", error);
        return [];
    }
};

// --- ROUTING LOGIC ---

// Helper to decode Google-encoded polyline string
const decodePolyline = (encoded: string, precision: number = 5) => {
    let latitude = 0;
    let longitude = 0;
    let index = 0;
    const factor = 10 ** precision;
    const points: { latitude: number; longitude: number }[] = [];

    const decodeChunk = () => {
        let value = 0;
        let shift = 0;
        let chunk: number;

        do {
            chunk = encoded.charCodeAt(index++) - 63;
            value |= (chunk & 0x1f) << shift;
            shift += 5;
        } while (chunk >= 0x20);

        return value & 1 ? ~(value >> 1) : value >> 1;
    };

    while (index < encoded.length) {
        latitude += decodeChunk();
        longitude += decodeChunk();
        points.push({ latitude: latitude / factor, longitude: longitude / factor });
    }

    return points;
};

export const fetchRoute = async (origin: { lat: number, lng: number }, destination: { lat: number, lng: number }) => {
    try {
        console.log("🛣️ Requesting Route from Ola Maps...");
        const apiKey = getOlaApiKey();

        // Using POST as per standard routing APIs often requiring body
        const response = await fetch(`https://api.olamaps.io/routing/v1/directions?api_key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                origin: { lat: origin.lat, lng: origin.lng },
                destination: { lat: destination.lat, lng: destination.lng },
                mode: 'driving',
                alternatives: false,
                steps: true,
                overview: 'full'
            })
        });

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const overviewPolyline = data.routes[0].overview_polyline;
            if (overviewPolyline) {
                return decodePolyline(overviewPolyline);
            }
        }

        console.warn("⚠️ No route found in response:", data);
        return [];
    } catch (error) {
        console.error("❌ Error fetching route:", error);
        return [];
    }
};

export const fetchPlaceDetails = async (placeId: string) => {
    try {
        console.log("Details for placeId fetching:", placeId);
        const apiKey = getOlaApiKey();
        const url = `https://api.olamaps.io/places/v1/details?place_id=${placeId}&api_key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        // Return the geometry location if it exists
        return data?.result?.geometry?.location || null;
    } catch (error) {
        console.error("❌ Error fetching place details:", error);
        return null;
    }
};

export const searchPlaces = async (query: string, lat: number, lng: number) => {
    if (!query) return [];

    try {
        const apiKey = getOlaApiKey();
        // Using Nearby Search with 'name' filter effectively acts as a local search
        const url = `https://api.olamaps.io/places/v1/nearbysearch?layers=venue&name=${encodeURIComponent(query)}&location=${lat},${lng}&radius=10000&api_key=${apiKey}`;
        console.log("🔍 Searching places:", query);
        const res = await fetch(url);
        const data = await res.json();
        return data.predictions || [];
    } catch (error) {
        console.error("❌ Search error:", error);
        return [];
    }
};

export const getAutocompleteSuggestions = async (input: string, lat: number, lng: number) => {
    if (!input || input.length < 3) return [];
    try {
        const apiKey = getOlaApiKey();
        // Strict bounds to user's location to prioritize nearby results, increased radius to 10km
        // Removed types restriction as it causes API 500 errors (Autocomplete likely doesn't support multiple category types)
        const url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(input)}&location=${lat},${lng}&radius=10000&api_key=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) {
            const text = await res.text();
            console.error(`Autocomplete API Error: ${res.status} ${res.statusText}`, text);
            return [];
        }

        const data = await res.json();
        return data.predictions || [];
    } catch (error) {
        console.error("Autocomplete Error:", error);
        return [];
    }
};

// We also need a way to get coords from the prediction selection
export const getPlaceDetails = async (placeId: string) => {
    try {
        const apiKey = getOlaApiKey();
        const url = `https://api.olamaps.io/places/v1/details?place_id=${placeId}&api_key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.result; // Contains geometry.location
    } catch (error) {
        console.error("❌ Error getting place details:", error);
        return null;
    }
};
