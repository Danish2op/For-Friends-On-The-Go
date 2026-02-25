type RecommendationLike = {
    place_id?: unknown;
    name?: unknown;
    description?: unknown;
    geometry?: unknown;
    location?: unknown;
    votes?: unknown;
    voters?: unknown;
    [key: string]: unknown;
};

type LatLng = {
    lat: number;
    lng: number;
};

const asString = (value: unknown): string => {
    return typeof value === "string" ? value.trim() : "";
};

const normalizeVoters = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    const unique = new Set<string>();
    value.forEach((entry) => {
        if (typeof entry !== "string") {
            return;
        }
        const normalized = entry.trim();
        if (normalized) {
            unique.add(normalized);
        }
    });

    return [...unique];
};

const normalizeVotes = (value: unknown): number => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
};

const extractLatLng = (item: RecommendationLike): LatLng | null => {
    const geometry = item.geometry as { location?: unknown } | undefined;
    const geometryLocation = geometry?.location as { lat?: unknown; lng?: unknown } | undefined;
    const rootLocation = item.location as { lat?: unknown; lng?: unknown } | undefined;

    const latCandidate = geometryLocation?.lat ?? rootLocation?.lat;
    const lngCandidate = geometryLocation?.lng ?? rootLocation?.lng;

    if (typeof latCandidate !== "number" || typeof lngCandidate !== "number") {
        return null;
    }
    if (!Number.isFinite(latCandidate) || !Number.isFinite(lngCandidate)) {
        return null;
    }

    return { lat: latCandidate, lng: lngCandidate };
};

const toCoordKey = (coords: LatLng | null) => {
    if (!coords) {
        return "";
    }
    return `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
};

const buildIdentityKey = (item: RecommendationLike, index: number) => {
    const placeId = asString(item.place_id).toLowerCase();
    if (placeId) {
        return `id:${placeId}`;
    }

    const primaryText = (asString(item.description) || asString(item.name)).toLowerCase();
    const coordsKey = toCoordKey(extractLatLng(item));

    if (primaryText && coordsKey) {
        return `text:${primaryText}|coords:${coordsKey}`;
    }
    if (primaryText) {
        return `text:${primaryText}`;
    }
    if (coordsKey) {
        return `coords:${coordsKey}`;
    }
    return `fallback:${index}`;
};

const hashString = (value: string) => {
    let hash = 0;
    for (let idx = 0; idx < value.length; idx += 1) {
        hash = (hash * 31 + value.charCodeAt(idx)) | 0;
    }
    return Math.abs(hash).toString(36);
};

const buildSyntheticPlaceId = (identityKey: string, index: number) => {
    return `rec_${hashString(`${identityKey}:${index}`)}`;
};

const toRecommendationItem = (raw: RecommendationLike, identityKey: string, index: number): RecommendationLike => {
    const voters = normalizeVoters(raw.voters);
    const votes = voters.length > 0 ? voters.length : normalizeVotes(raw.votes);
    const normalizedPlaceId = asString(raw.place_id) || buildSyntheticPlaceId(identityKey, index);

    return {
        ...raw,
        place_id: normalizedPlaceId,
        voters,
        votes,
    };
};

const mergeRecommendation = (base: RecommendationLike, next: RecommendationLike): RecommendationLike => {
    const baseVoters = normalizeVoters(base.voters);
    const nextVoters = normalizeVoters(next.voters);
    const mergedVoters = normalizeVoters([...baseVoters, ...nextVoters]);
    const baseVotes = normalizeVotes(base.votes);
    const nextVotes = normalizeVotes(next.votes);

    const baseDescription = asString(base.description);
    const nextDescription = asString(next.description);
    const description = baseDescription.length >= nextDescription.length ? base.description : next.description;

    return {
        ...base,
        ...next,
        place_id: asString(base.place_id) || asString(next.place_id),
        name: asString(base.name) ? base.name : next.name,
        description,
        voters: mergedVoters,
        votes: mergedVoters.length > 0 ? mergedVoters.length : Math.max(baseVotes, nextVotes),
    };
};

export const dedupeRecommendations = (input: unknown): RecommendationLike[] => {
    if (!Array.isArray(input)) {
        return [];
    }

    const byIdentity = new Map<string, RecommendationLike>();

    input.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") {
            return;
        }
        const raw = entry as RecommendationLike;
        const identityKey = buildIdentityKey(raw, index);
        const normalized = toRecommendationItem(raw, identityKey, index);
        const existing = byIdentity.get(identityKey);

        if (!existing) {
            byIdentity.set(identityKey, normalized);
            return;
        }

        byIdentity.set(identityKey, mergeRecommendation(existing, normalized));
    });

    return [...byIdentity.values()];
};
