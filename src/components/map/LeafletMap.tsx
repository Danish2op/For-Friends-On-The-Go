
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Location {
    lat: number;
    lng: number;
}

interface Participant {
    uid: string;
    displayName: string;
    location?: Location;
}

interface LeafletMapProps {
    participants: Participant[];
    currentUserLocation?: Location;
    destination?: Location | null;
    routeCoords?: { latitude: number; longitude: number }[];
    onRegionChangeComplete?: (region: any) => void;
    initialRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
    controlsPosition?: 'top-left' | 'bottom-left';
    externalNightMode?: boolean;
}

const getParticipantColor = (uid: string) => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + "00000".substring(0, 6 - c.length) + c;
};

// HTML Template with Leaflet
const getMapHTML = () => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <style>
        body, html, #map {
            margin: 0; padding: 0;
            height: 100%; width: 100%;
            background-color: #dbe3ed;
        }
        .custom-icon {
            display: flex;
            justify-content: center;
            align-items: center;
            background: transparent;
        }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map', {
            zoomControl: false, // Cleaner look
            attributionControl: false // Minimalist
        }).setView([0,0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        // State storage
        var markers = {}; // uid -> marker
        var userMarker = null;
        var destMarker = null;
        var routePolyline = null;

        // Custom Icons
        const getDotIcon = (color) => L.divIcon({
            className: 'custom-icon',
            html: '<div style="background-color: ' + color + '; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const getUserIcon = () => L.divIcon({
            className: 'custom-icon',
            html: '<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #3b82f6;"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const getDestIcon = () => L.divIcon({
            className: 'custom-icon',
            html: '<div style="font-size: 24px;">🏁</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });

        // Programmatic move guard — prevents feedback loops
        var isProgrammaticMove = false;

        // Event Listeners: Region Change (Drag/Zoom)
        map.on('moveend', function() {
            if (isProgrammaticMove) {
                isProgrammaticMove = false;
                return; // Suppress echo for programmatic moves
            }

            var center = map.getCenter();
            var zoom = map.getZoom();
            var bounds = map.getBounds();
            var latDelta = Math.abs(bounds.getNorth() - bounds.getSouth());
            var lngDelta = Math.abs(bounds.getEast() - bounds.getWest());

            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'REGION_CHANGE',
                payload: {
                    latitude: center.lat,
                    longitude: center.lng,
                    latitudeDelta: latDelta,
                    longitudeDelta: lngDelta,
                    zoom: zoom
                }
            }));
        });

        // Message Handler from React Native
        document.addEventListener('message', function(event) {
            handleMessage(event.data);
        });
        window.addEventListener('message', function(event) {
            handleMessage(event.data);
        });

        function handleMessage(dataStr) {
            try {
                const data = JSON.parse(dataStr);
                if (data.type === 'UPDATE') {
                    updateMap(data.payload);
                } else if (data.type === 'FIT_BOUNDS') {
                    fitBounds(data.payload);
                } else if (data.type === 'SET_VIEW') {
                    setView(data.payload);
                }
            } catch (e) {
                // console.error("Parse Error", e);
            }
        }

        function setView(payload) {
             if (payload && payload.lat && payload.lng) {
                 isProgrammaticMove = true;
                 map.flyTo([payload.lat, payload.lng], payload.zoom || 15, { animate: true, duration: 1.5 });
             }
        }

        function updateMap(state) {
            // 1. Participants
            const currentUids = new Set();
            if (state.participants) {
                state.participants.forEach(p => {
                    if (p.location && p.location.lat) {
                        currentUids.add(p.uid);
                        if (markers[p.uid]) {
                            markers[p.uid].setLatLng([p.location.lat, p.location.lng]);
                        } else {
                            const m = L.marker([p.location.lat, p.location.lng], {
                                icon: getDotIcon(p.color)
                            })
                            .bindTooltip(p.displayName, { permanent: false, direction: 'top', offset: [0, -10] })
                            .addTo(map);
                            markers[p.uid] = m;
                        }
                    }
                });
            }
            
            // Cleanup markers
            Object.keys(markers).forEach(uid => {
                if (!currentUids.has(uid)) {
                    map.removeLayer(markers[uid]);
                    delete markers[uid];
                }
            });

            // 2. User Location
            if (state.userLocation && state.userLocation.lat) {
                if (userMarker) {
                    userMarker.setLatLng([state.userLocation.lat, state.userLocation.lng]);
                } else {
                    userMarker = L.marker([state.userLocation.lat, state.userLocation.lng], {
                        icon: getUserIcon(),
                        zIndexOffset: 1000
                    }).addTo(map);
                }
            }

            // 3. Destination
            if (state.destination && state.destination.lat) {
                if (destMarker) {
                    destMarker.setLatLng([state.destination.lat, state.destination.lng]);
                } else {
                    destMarker = L.marker([state.destination.lat, state.destination.lng], {
                        icon: getDestIcon(),
                        zIndexOffset: 900
                    }).addTo(map);
                }
            } else if (destMarker) {
                map.removeLayer(destMarker);
                destMarker = null;
            }

            // 4. Route
            if (state.routeCoords && state.routeCoords.length > 0) {
                const latlngs = state.routeCoords.map(c => [c.latitude, c.longitude]);
                if (routePolyline) {
                    routePolyline.setLatLngs(latlngs);
                } else {
                    routePolyline = L.polyline(latlngs, {
                        color: '#2f7cf5',
                        weight: 5,
                        opacity: 0.8,
                        lineCap: 'round'
                    }).addTo(map);
                }
            } else if (routePolyline) {
                map.removeLayer(routePolyline);
                routePolyline = null;
            }
        }

        function fitBounds(bounds) {
             if (!bounds || bounds.length === 0) return;
             // Ensure valid bounds
             var valid = bounds.filter(b => b && b[0] != null && b[1] != null);
             if (valid.length > 0) {
                 // **LOGIC SURGERY**: Padding increased to 80 to ensure avatar visibility
                 map.fitBounds(valid, { padding: [80, 80], animate: true, duration: 1.0 });
             }
        }
    </script>
</body>
</html>
`;

export interface LeafletMapRef {
    recenter: () => void;
    flyTo: (lat: number, lng: number) => void;
}

export default React.forwardRef<LeafletMapRef, LeafletMapProps>(function LeafletMap({
    participants,
    currentUserLocation,
    destination,
    routeCoords,
    initialRegion,
    onRegionChangeComplete
}, ref) {
    const webViewRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);
    // Deep-compare guard: skip redundant SET_VIEW calls for the same coordinates
    const prevRegionRef = useRef<{ lat: number; lng: number } | null>(null);

    // Prepare state payload for WebView
    const getPayload = useCallback(() => {
        return {
            participants: participants.map(p => ({
                ...p,
                color: getParticipantColor(p.uid)
            })),
            userLocation: currentUserLocation,
            destination: destination,
            routeCoords: routeCoords
        };
    }, [participants, currentUserLocation, destination, routeCoords]);

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'REGION_CHANGE') {
                if (onRegionChangeComplete) {
                    onRegionChangeComplete(data.payload);
                }
            }
        } catch {
            // ignore
        }
    };

    // **LOGIC SURGERY**: Group Bounding Box Helper
    // Aggregates ALL relevant points to determining the framing
    const getGroupBounds = useCallback(() => {
        const points: [number, number][] = [];
        participants.forEach(p => {
            if (p.location?.lat) points.push([p.location.lat, p.location.lng]);
        });
        if (currentUserLocation?.lat) points.push([currentUserLocation.lat, currentUserLocation.lng]);
        if (destination?.lat) points.push([destination.lat, destination.lng]);
        if (routeCoords) routeCoords.forEach(c => points.push([c.latitude, c.longitude]));
        return points;
    }, [participants, currentUserLocation, destination, routeCoords]);

    // Expose methods to parent
    React.useImperativeHandle(
        ref,
        () => ({
            // **LOGIC SURGERY**: Recenter now uses Group Logic, not just User logic
            recenter: () => {
                const points = getGroupBounds();
                if (points.length > 0) {
                    webViewRef.current?.postMessage(JSON.stringify({ type: 'FIT_BOUNDS', payload: points }));
                }
            },
            flyTo: (lat: number, lng: number) => {
                webViewRef.current?.postMessage(JSON.stringify({ type: 'SET_VIEW', payload: { lat, lng } }));
            }
        }),
        [getGroupBounds]
    );

    // Controlled Mode: Respond to genuine initialRegion changes only
    useEffect(() => {
        if (isReady && initialRegion) {
            const lat = initialRegion.latitude;
            const lng = initialRegion.longitude;
            const prev = prevRegionRef.current;

            // Skip if coordinates haven't meaningfully changed (~1m precision)
            if (prev && Math.abs(prev.lat - lat) < 0.00001 && Math.abs(prev.lng - lng) < 0.00001) {
                return;
            }

            prevRegionRef.current = { lat, lng };
            webViewRef.current?.postMessage(JSON.stringify({
                type: 'SET_VIEW',
                payload: { lat, lng, zoom: 16 }
            }));
        }
    }, [initialRegion, isReady]);

    // **LOGIC SURGERY**: Auto-Fit Logic (Reactive Bounding Box)
    // Triggers when GROUP changes (participants.length), not just load
    useEffect(() => {
        if (!isReady) return;
        if (initialRegion) return; // If Search Mode (controlled), don't group-fit

        const points = getGroupBounds();
        if (points.length > 0) {
            const timer = setTimeout(() => {
                webViewRef.current?.postMessage(JSON.stringify({ type: 'FIT_BOUNDS', payload: points }));
            }, 600); // Slight delay for WebView render
            return () => clearTimeout(timer);
        }
    }, [isReady, initialRegion, getGroupBounds]);

    // Regular State Updates
    useEffect(() => {
        if (isReady) {
            webViewRef.current?.postMessage(JSON.stringify({
                type: 'UPDATE',
                payload: getPayload()
            }));
        }
    }, [isReady, getPayload]);

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: getMapHTML() }}
                style={styles.webview}
                onLoadEnd={() => setIsReady(true)}
                onMessage={handleMessage}
                scrollEnabled={false}
                overScrollMode="never"
                bounces={false}
                // iOS: prevent WebView content from bouncing during scroll gestures
                {...(Platform.OS === 'ios' ? { decelerationRate: 'normal' } : {})}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dbe3ed',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent'
    }
});
