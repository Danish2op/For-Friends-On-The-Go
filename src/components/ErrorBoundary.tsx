import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import { COLORS, SKEUO } from "../constants/theme";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.shadowOuter}>
                    <View style={styles.container}>
                        <Text style={styles.title}>Something went wrong</Text>
                        <Text style={styles.errorText}>{this.state.error?.message}</Text>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    shadowOuter: {
        borderRadius: SKEUO.radius.l,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 0.38,
        shadowRadius: 14,
        elevation: 10,
    },
    container: {
        padding: 20,
        borderRadius: SKEUO.radius.l,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.62)",
    },
    title: {
        color: COLORS.danger,
        fontWeight: "800",
        marginBottom: 8,
        fontSize: 16,
    },
    errorText: {
        color: COLORS.text,
        textAlign: "center",
        fontSize: 13,
    },
});
