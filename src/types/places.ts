/**
 * Strict TypeScript interfaces for Places API responses and the
 * dynamic-radius meeting-point finder.
 */

// ── API Response Shapes ──────────────────────────────────────────────────────

export interface PlaceLocation {
    lat: number;
    lng: number;
}

export interface PlaceGeometry {
    location: PlaceLocation;
}

/** A single place returned from the OLA Maps Nearby Search API. */
export interface NearbyPlace {
    place_id: string;
    name: string;
    description?: string;
    types?: string[];
    geometry?: PlaceGeometry;
    location?: PlaceLocation;
    [key: string]: unknown;
}

// ── Category Classification ──────────────────────────────────────────────────

export type PlaceCategory = "cafe" | "restaurant" | "other";

export interface CategorizedPlace extends NearbyPlace {
    /** Derived category used for quota tracking. */
    _category: PlaceCategory;
}

// ── Fetch Result ─────────────────────────────────────────────────────────────

export interface FetchMeetingPointsResult {
    places: CategorizedPlace[];
    cafeCount: number;
    restaurantCount: number;
    radiusUsed: number;
    iterations: number;
}
