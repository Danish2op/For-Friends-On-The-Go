
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { View } from '@/src/components/ui/tamagui-primitives';

interface Location {
    lat: number;
    lng: number;
}

interface SafeMapProps {
    mode?: 'view' | 'select' | 'navigate';
    theme?: 'light' | 'dark' | 'auto';
    participants?: { uid: string; displayName: string; location?: Location }[];
    currentUserLocation?: Location;
    initialRegion?: Location;
    destination?: Location;
    routeCoords?: Location[];
    onRegionChangeComplete?: (region: { latitude: number; longitude: number }) => void;
    onLog?: (msg: string) => void;
}

export default function SafeMap({
    mode = 'view',
    theme = 'dark',
    participants = [],
    currentUserLocation,
    initialRegion,
    destination,
    routeCoords = [],
    onRegionChangeComplete,
    onLog
}: SafeMapProps) {
    const webViewRef = useRef<WebView>(null);

    // Default center priority: Initial -> User -> Dest -> Default
    const centerLat = initialRegion?.lat || currentUserLocation?.lat || destination?.lat || 12.9716;
    const centerLng = initialRegion?.lng || currentUserLocation?.lng || destination?.lng || 77.5946;

    // Sync Region Changes (e.g. from Autocomplete selection)
    useEffect(() => {
        if (webViewRef.current && initialRegion) {
            const script = `
                if (window.map) {
                    window.map.setView([${initialRegion.lat}, ${initialRegion.lng}], 15);
                }
            `;
            webViewRef.current.injectJavaScript(script);
        }
    }, [initialRegion]);

    // Handle Messages from WebView (MoveEnd)
    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'regionChange' && onRegionChangeComplete) {
                onRegionChangeComplete({ latitude: data.lat, longitude: data.lng });
            }
        } catch {
            // ignore
        }
    };

    if (!currentUserLocation && mode === 'view') {
        return (
            <View style={styles.center}>
                <ActivityIndicator color="#6366F1" />
            </View>
        );
    }

    // Generate HTML for Leaflet
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <style>
                body { margin: 0; padding: 0; background-color: ${theme === 'light' ? '#f8fafc' : '#242f3e'}; }
                #map { height: 100vh; width: 100vw; }
                
                /* Custom Marker Styles */
                .marker-user {
                    background-color: #6366F1;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
                }
                .marker-friend {
                    background-color: #A855F7;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    border: 2px solid white;
                    opacity: 0.9;
                }
                .marker-dest {
                    font-size: 32px;
                    text-align: center;
                    line-height: 32px;
                    width: 32px;
                    height: 32px;
                }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                // Initialize Map
                var map = L.map('map', { zoomControl: false, attributionControl: false })
                    .setView([${centerLat}, ${centerLng}], 15);

                window.map = map;

                L.tileLayer('${theme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}', {
                    maxZoom: 20
                }).addTo(map);

                // Helper for Icons
                function createIcon(className, html) {
                    return L.divIcon({
                        className: 'custom-div-icon',
                        html: '<div class="' + className + '">' + (html || '') + '</div>',
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });
                }

                // Current User
                ${currentUserLocation ? `
                L.marker([${currentUserLocation.lat}, ${currentUserLocation.lng}], { 
                    icon: createIcon('marker-user') 
                }).addTo(map);
                ` : ''}

                // Participants
                ${participants.map(p => p.location ? `
                L.marker([${p.location.lat}, ${p.location.lng}], {
                    icon: createIcon('marker-friend')
                }).bindPopup("${p.displayName}", { closeButton: false }).addTo(map);
                ` : '').join('')}

                // Destination
                ${destination ? `
                L.marker([${destination.lat}, ${destination.lng}], {
                    icon: createIcon('marker-dest', '🏁')
                }).addTo(map);
                ` : ''}

                // Route
                ${routeCoords.length > 0 ? `
                var routePoints = ${JSON.stringify(routeCoords.map(c => [c.lat, c.lng]))};
                var polyline = L.polyline(routePoints, {
                    color: '#3b82f6',
                    weight: 6,
                    opacity: 0.9
                }).addTo(map);
                map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
                ` : ''}

                // Events
                map.on('moveend', function() {
                    var center = map.getCenter();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'regionChange',
                        lat: center.lat,
                        lng: center.lng
                    }));
                });

            </script>
        </body>
        </html>
    `;

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={styles.webview}
                scrollEnabled={false}
                onMessage={handleMessage}
                // @ts-ignore
                androidHardwareAccelerationDisabled={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    webview: { flex: 1, opacity: 0.99 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }
});
