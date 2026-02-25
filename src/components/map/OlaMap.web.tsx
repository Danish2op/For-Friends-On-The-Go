import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
}

export default function OlaMap({ participants, currentUserLocation }: OlaMapProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Interactive Map is only available on Android/iOS</Text>
            <Text style={styles.subText}>Tracking {participants.length} users</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#374151', // Gray background
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    text: {
        color: '#f3f4f6',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subText: {
        color: '#9ca3af',
        fontSize: 14,
    },
});
