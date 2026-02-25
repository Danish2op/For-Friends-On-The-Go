import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword } from "firebase/auth";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
import { LogIn, Lock, UserRound } from "lucide-react-native";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { COLORS, SHADOWS, SKEUO, TYPE } from "../../../constants/theme";
import { useToast } from "@/src/context/ToastContext";
import { auth } from "@/src/services/firebase/config";
import { IdentifierResolutionError, resolveEmailForAuthIdentifier } from "@/src/services/firebase/users";

const parseSignInError = (error: unknown, identifier: string) => {
    if (error instanceof IdentifierResolutionError) {
        if (error.code === "lookup-unavailable") {
            return identifier.includes("@")
                ? "Login lookup is temporarily unavailable. Please retry."
                : "Username lookup is unavailable right now. Sign in with email or retry.";
        }
        return error.message;
    }

    if (error instanceof FirebaseError) {
        switch (error.code) {
            case "auth/invalid-credential":
            case "auth/user-not-found":
            case "auth/wrong-password":
                return "Invalid email/username or password.";
            case "auth/invalid-api-key":
            case "auth/app-not-authorized":
                return "Authentication configuration is invalid for this build.";
            case "auth/operation-not-allowed":
                return "Email/password login is disabled in Firebase Auth settings.";
            case "auth/network-request-failed":
                return "Network issue detected. Please retry.";
            case "auth/too-many-requests":
                return "Too many attempts. Please wait and try again.";
            default:
                return "Sign in failed. Please try again.";
        }
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Sign in failed. Please try again.";
};

export default function SignInScreen() {
    const toast = useToast();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSignIn = async () => {
        await Haptics.selectionAsync();

        const trimmedIdentifier = identifier.trim();
        if (!trimmedIdentifier || !password.trim()) {
            toast.show("Email/username and password are required.", "error");
            return;
        }

        setSubmitting(true);
        try {
            const emailForAuth = await resolveEmailForAuthIdentifier(trimmedIdentifier);
            await signInWithEmailAndPassword(auth, emailForAuth, password.trim());
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace("/");
        } catch (error) {
            toast.show(parseSignInError(error, trimmedIdentifier), "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <LinearGradient
                colors={[COLORS.backgroundAlt, COLORS.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

            <View style={styles.container}>
                <Text style={styles.eyebrow}>FOR FRIENDS ON THE GO</Text>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in with email or username and your password.</Text>

                <View style={styles.cardShadowDark}>
                    <View style={styles.cardShadowLight}>
                        <View style={styles.card}>
                            <View style={styles.inputShell}>
                                <UserRound size={16} color={COLORS.textMuted} />
                                <TextInput
                                    value={identifier}
                                    onChangeText={setIdentifier}
                                    placeholder="Email or username"
                                    placeholderTextColor={COLORS.textMuted}
                                    autoCapitalize="none"
                                    style={styles.input}
                                    editable={!submitting}
                                />
                            </View>

                            <View style={styles.inputShell}>
                                <Lock size={16} color={COLORS.textMuted} />
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Password"
                                    placeholderTextColor={COLORS.textMuted}
                                    secureTextEntry
                                    style={styles.input}
                                    editable={!submitting}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.buttonShadow}
                                onPress={handleSignIn}
                                activeOpacity={0.9}
                                disabled={submitting}
                            >
                                <LinearGradient
                                    colors={[COLORS.primary, COLORS.primaryDeep]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.actionButton}
                                >
                                    <LogIn color="#f4f8ff" size={18} />
                                    <Text style={styles.actionText}>{submitting ? "Signing In..." : "Sign In"}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <Link href="/sign-up" asChild>
                    <TouchableOpacity style={styles.linkRow}>
                        <Text style={styles.linkLabel}>New here? Create your account</Text>
                    </TouchableOpacity>
                </Link>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    glowTop: {
        position: "absolute",
        width: 260,
        height: 260,
        borderRadius: 130,
        top: -100,
        right: -40,
        backgroundColor: "rgba(75, 133, 222, 0.24)",
    },
    glowBottom: {
        position: "absolute",
        width: 220,
        height: 220,
        borderRadius: 110,
        bottom: -90,
        left: -50,
        backgroundColor: "rgba(255, 255, 255, 0.55)",
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 92,
        paddingBottom: 40,
        justifyContent: "center",
    },
    eyebrow: {
        color: COLORS.textSecondary,
        letterSpacing: 1.4,
        fontWeight: TYPE.weight.semibold,
        fontSize: TYPE.size.caption,
        marginBottom: 10,
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: TYPE.size.hero,
        fontWeight: TYPE.weight.black,
    },
    subtitle: {
        marginTop: 8,
        color: COLORS.textSecondary,
        fontSize: TYPE.size.body,
        lineHeight: 22,
        marginBottom: 28,
    },
    cardShadowDark: {
        borderRadius: SKEUO.radius.xl,
        ...SHADOWS.raised.dark,
    },
    cardShadowLight: {
        borderRadius: SKEUO.radius.xl,
        ...SHADOWS.raised.light,
    },
    card: {
        borderRadius: SKEUO.radius.xl,
        padding: 20,
        gap: 14,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inputShell: {
        minHeight: 56,
        borderRadius: SKEUO.radius.m,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: COLORS.surfacePressed,
        borderWidth: 1,
        borderColor: COLORS.borderStrong,
        ...SHADOWS.pressed.light,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: TYPE.size.body,
        fontWeight: TYPE.weight.medium,
    },
    buttonShadow: {
        borderRadius: SKEUO.radius.pill,
        ...SHADOWS.floating.dark,
    },
    actionButton: {
        height: 56,
        borderRadius: SKEUO.radius.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
    },
    actionText: {
        color: "#f4f8ff",
        fontWeight: TYPE.weight.bold,
        fontSize: TYPE.size.body,
        letterSpacing: 0.3,
    },
    linkRow: {
        marginTop: 18,
        alignItems: "center",
    },
    linkLabel: {
        color: COLORS.textSecondary,
        textDecorationLine: "underline",
        fontSize: TYPE.size.caption,
        fontWeight: TYPE.weight.semibold,
    },
});
