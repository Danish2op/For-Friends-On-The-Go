import { AvatarRandomizer } from "@/src/components/avatar/avatar-ui";
import { Text, View } from "@/src/components/ui/tamagui-primitives";
import { genRandomAvatarConfig, type NiceAvatarConfig } from "@/src/constants/avatars";
import { useAppAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/context/ToastContext";
import { useUsernameAvailability } from "@/src/hooks/use-username-availability";
import { auth } from "@/src/services/firebase/config";
import {
    normalizeEmail,
    ProfileRegistrationError,
    registerUserProfile,
    UsernameTakenError,
    validateEmailFormat,
    type AvatarId,
} from "@/src/services/firebase/users";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { FirebaseError } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from "firebase/auth";
import { Lock, Mail, UserRound } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from "react-native";
import { COLORS, SHADOWS, SKEUO, TYPE } from "../../../constants/theme";

type SetupPhase = "credentials" | "profile";

const RETRYABLE_PROFILE_CODES = new Set([
    "permission-denied",
    "aborted",
    "deadline-exceeded",
    "unavailable",
    "resource-exhausted",
    "internal",
    "unknown",
]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isAlreadyRegisteredError = (error: unknown) =>
    error instanceof Error
    && error.message.includes("already registered with a different username");

const parseSignUpError = (error: unknown) => {
    if (error instanceof UsernameTakenError) {
        return error.message;
    }

    if (error instanceof ProfileRegistrationError) {
        if (RETRYABLE_PROFILE_CODES.has(error.code)) {
            return "Account was created, but profile setup is still syncing. Please tap Complete Setup again.";
        }
        return error.message || "Profile registration failed.";
    }

    if (error instanceof FirebaseError) {
        switch (error.code) {
            case "auth/email-already-in-use":
                return "An account already exists with this email.";
            case "auth/invalid-email":
                return "Email address format is invalid.";
            case "auth/weak-password":
                return "Password is too weak. Use at least 8 characters.";
            case "auth/network-request-failed":
                return "Network issue detected. Please retry.";
            case "auth/operation-not-allowed":
                return "Email/password sign-up is disabled in Firebase Auth.";
            case "auth/too-many-requests":
                return "Too many attempts. Please wait and try again.";
            default:
                return "Could not create your account. Please try again.";
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Could not create your account. Please try again.";
};

export default function SignUpScreen() {
    const { mode } = useLocalSearchParams<{ mode?: string }>();
    const toast = useToast();
    const { refreshProfile, setSignUpInProgress } = useAppAuth();

    const [phase, setPhase] = useState<SetupPhase>("credentials");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [username, setUsername] = useState("");
    const [avatarId] = useState<AvatarId>("1");
    const [avatarConfig, setAvatarConfig] = useState<NiceAvatarConfig>(genRandomAvatarConfig);
    const [registeredUid, setRegisteredUid] = useState<string | null>(auth.currentUser?.uid ?? null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (mode !== "complete-profile") {
            return;
        }

        const currentUid = auth.currentUser?.uid ?? null;
        if (currentUid) {
            setRegisteredUid(currentUid);
            setPhase("profile");
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user?.uid) {
                return;
            }
            setRegisteredUid(user.uid);
            setPhase("profile");
            unsubscribe();
        });

        return unsubscribe;
    }, [mode]);

    const usernameAvailability = useUsernameAvailability(username);
    const isUsernameReady = usernameAvailability.status === "available";

    const ensureAuthReady = async (expectedUid?: string | null) => {
        if (auth.currentUser?.uid && (!expectedUid || auth.currentUser.uid === expectedUid)) {
            await auth.currentUser.getIdToken(true);
            return auth.currentUser.uid;
        }

        const uid = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                unsubscribe();
                reject(new Error("Authentication session is not ready yet. Please retry."));
            }, 10000);

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (!user?.uid) {
                    return;
                }

                if (expectedUid && user.uid !== expectedUid) {
                    return;
                }

                try {
                    await user.getIdToken(true);
                    clearTimeout(timeout);
                    unsubscribe();
                    resolve(user.uid);
                } catch (error) {
                    clearTimeout(timeout);
                    unsubscribe();
                    reject(error);
                }
            });
        });

        return uid;
    };

    const registerProfileWithRetry = async (
        uid: string,
        normalizedEmail: string,
        normalizedUsername: string
    ) => {
        let attempts = 0;
        while (attempts < 3) {
            try {
                return await registerUserProfile({
                    uid,
                    email: normalizedEmail,
                    username: normalizedUsername,
                    avatarId,
                    avatarConfig,
                });
            } catch (error) {
                if (error instanceof UsernameTakenError) {
                    throw error;
                }
                if (error instanceof ProfileRegistrationError && RETRYABLE_PROFILE_CODES.has(error.code)) {
                    attempts += 1;
                    if (attempts >= 3) {
                        throw error;
                    }
                    await wait(350 * attempts);
                    continue;
                }
                throw error;
            }
        }
    };

    const waitForProfileSync = async () => {
        let attempts = 0;
        while (attempts < 5) {
            const profile = await refreshProfile();
            if (profile) {
                return;
            }
            attempts += 1;
            await wait(200 * attempts);
        }
        throw new Error("Profile setup saved but has not synced yet. Please sign in again.");
    };

    const resolveRegistrationEmail = () => {
        const currentAuthEmail = auth.currentUser?.email ? normalizeEmail(auth.currentUser.email) : "";
        const typedEmail = email.trim() ? normalizeEmail(email) : "";
        const resolvedEmail = currentAuthEmail || typedEmail;

        if (!validateEmailFormat(resolvedEmail)) {
            throw new Error("Email address is missing or invalid for this account.");
        }

        return resolvedEmail;
    };

    const finalizeProfileRegistration = async (uidCandidate?: string | null) => {
        const resolvedUid = uidCandidate ?? registeredUid ?? auth.currentUser?.uid ?? null;
        if (!resolvedUid) {
            throw new Error("Could not resolve account identity. Please sign in again.");
        }

        const verifiedUid = await ensureAuthReady(resolvedUid);
        const resolvedEmail = resolveRegistrationEmail();
        const resolvedUsername = usernameAvailability.normalizedUsername || username.trim();
        await registerProfileWithRetry(verifiedUid, resolvedEmail, resolvedUsername);
        await waitForProfileSync();

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/");
    };

    const handleStartSignUp = async () => {
        await Haptics.selectionAsync();

        if (!username.trim()) {
            toast.show("Username is required.", "error");
            return;
        }

        if (!isUsernameReady) {
            if (usernameAvailability.status === "checking") {
                toast.show("Please wait while username availability is checked.", "info");
            } else {
                toast.show(usernameAvailability.helperText || "Choose an available username.", "error");
            }
            return;
        }

        const normalizedEmail = normalizeEmail(email);
        if (!validateEmailFormat(normalizedEmail)) {
            toast.show("A valid email is required.", "error");
            return;
        }

        if (!password.trim()) {
            toast.show("Password is required.", "error");
            return;
        }

        if (password.length < 8) {
            toast.show("Password must contain at least 8 characters.", "error");
            return;
        }

        if (password !== confirmPassword) {
            toast.show("Passwords do not match.", "error");
            return;
        }

        setSubmitting(true);
        setSignUpInProgress(true);
        let createdUid: string | null = null;
        try {
            const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password.trim());

            createdUid = credential.user.uid;
            setRegisteredUid(createdUid);
            await finalizeProfileRegistration(createdUid);
        } catch (error) {
            if (createdUid || error instanceof UsernameTakenError) {
                setPhase("profile");
            }
            toast.show(parseSignUpError(error), "error");
        } finally {
            setSubmitting(false);
            setSignUpInProgress(false);
        }
    };

    const handleCompleteProfile = async () => {
        await Haptics.selectionAsync();

        if (!username.trim()) {
            toast.show("Username is required.", "error");
            return;
        }

        if (!isUsernameReady) {
            if (usernameAvailability.status === "checking") {
                toast.show("Please wait while username availability is checked.", "info");
            } else {
                toast.show(usernameAvailability.helperText || "Choose an available username.", "error");
            }
            return;
        }

        setSubmitting(true);
        try {
            await finalizeProfileRegistration();
        } catch (error) {
            if (isAlreadyRegisteredError(error)) {
                await refreshProfile();
                router.replace("/");
                return;
            }
            if (error instanceof UsernameTakenError) {
                setPhase("profile");
            }
            toast.show(parseSignUpError(error), "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoToSignIn = async () => {
        await Haptics.selectionAsync();
        if (auth.currentUser?.uid) {
            try {
                await firebaseSignOut(auth);
            } catch {
                toast.show("Could not sign out. Please retry.", "error");
                return;
            } finally {
                setRegisteredUid(null);
            }
        }
        router.replace("/sign-in");
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <LinearGradient
                colors={[COLORS.backgroundAlt, COLORS.background]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.eyebrow}>FOR FRIENDS ON THE GO</Text>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                    {phase === "credentials"
                        ? "Create your account with username, email, and password."
                        : "Complete your profile with an available username."}
                </Text>

                <View style={styles.cardShadowDark}>
                    <View style={styles.cardShadowLight}>
                        <View style={styles.card}>
                            {phase === "credentials" && (
                                <>
                                    <View style={styles.inputShell}>
                                        <UserRound size={16} color={COLORS.textMuted} />
                                        <TextInput
                                            value={username}
                                            onChangeText={setUsername}
                                            placeholder="Username (unique)"
                                            placeholderTextColor={COLORS.textMuted}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            style={styles.input}
                                            editable={!submitting}
                                        />
                                    </View>
                                    <View style={styles.usernameValidationRow}>
                                        {usernameAvailability.status === "checking" && (
                                            <ActivityIndicator color={COLORS.primary} size="small" />
                                        )}
                                        <Text
                                            style={[
                                                styles.usernameValidationText,
                                                usernameAvailability.status === "available" && styles.usernameAvailableText,
                                                (usernameAvailability.status === "taken"
                                                    || usernameAvailability.status === "invalid"
                                                    || usernameAvailability.status === "error") && styles.usernameErrorText,
                                            ]}
                                        >
                                            {usernameAvailability.helperText}
                                        </Text>
                                    </View>

                                    <View style={styles.inputShell}>
                                        <Mail size={16} color={COLORS.textMuted} />
                                        <TextInput
                                            value={email}
                                            onChangeText={setEmail}
                                            placeholder="Email"
                                            placeholderTextColor={COLORS.textMuted}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
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

                                    <View style={styles.inputShell}>
                                        <Lock size={16} color={COLORS.textMuted} />
                                        <TextInput
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            placeholder="Confirm password"
                                            placeholderTextColor={COLORS.textMuted}
                                            secureTextEntry
                                            style={styles.input}
                                            editable={!submitting}
                                        />
                                    </View>

                                    <Text style={styles.avatarLabel}>Your Avatar</Text>
                                    <AvatarRandomizer
                                        value={avatarConfig}
                                        onChange={setAvatarConfig}
                                        disabled={submitting}
                                        style={styles.avatarSelector}
                                    />

                                    <TouchableOpacity
                                        style={styles.buttonShadow}
                                        onPress={handleStartSignUp}
                                        activeOpacity={0.9}
                                        disabled={submitting}
                                    >
                                        <LinearGradient
                                            colors={[COLORS.primary, COLORS.primaryDeep]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.actionButton}
                                        >
                                            <Text style={styles.actionText}>
                                                {submitting ? "Creating..." : "Create Account"}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </>
                            )}

                            {phase === "profile" && (
                                <>
                                    <View style={styles.inputShell}>
                                        <UserRound size={16} color={COLORS.textMuted} />
                                        <TextInput
                                            value={username}
                                            onChangeText={setUsername}
                                            placeholder="Pick a new username"
                                            placeholderTextColor={COLORS.textMuted}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            style={styles.input}
                                            editable={!submitting}
                                        />
                                    </View>
                                    <View style={styles.usernameValidationRow}>
                                        {usernameAvailability.status === "checking" && (
                                            <ActivityIndicator color={COLORS.primary} size="small" />
                                        )}
                                        <Text
                                            style={[
                                                styles.usernameValidationText,
                                                usernameAvailability.status === "available" && styles.usernameAvailableText,
                                                (usernameAvailability.status === "taken"
                                                    || usernameAvailability.status === "invalid"
                                                    || usernameAvailability.status === "error") && styles.usernameErrorText,
                                            ]}
                                        >
                                            {usernameAvailability.helperText}
                                        </Text>
                                    </View>

                                    <Text style={styles.avatarLabel}>Your Avatar</Text>
                                    <AvatarRandomizer
                                        value={avatarConfig}
                                        onChange={setAvatarConfig}
                                        disabled={submitting}
                                        style={styles.avatarSelector}
                                    />

                                    <TouchableOpacity
                                        style={styles.buttonShadow}
                                        onPress={handleCompleteProfile}
                                        activeOpacity={0.9}
                                        disabled={submitting}
                                    >
                                        <LinearGradient
                                            colors={[COLORS.primary, COLORS.primaryDeep]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.actionButton}
                                        >
                                            <Text style={styles.actionText}>
                                                {submitting ? "Saving..." : "Complete Setup"}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={styles.linkRow} onPress={handleGoToSignIn}>
                    <Text style={styles.linkLabel}>
                        {phase === "profile"
                            ? "Use a different account? Sign in"
                            : "Already have an account? Sign in"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
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
        top: -90,
        right: -30,
        backgroundColor: "rgba(92, 151, 236, 0.25)",
    },
    glowBottom: {
        position: "absolute",
        width: 220,
        height: 220,
        borderRadius: 110,
        bottom: -90,
        left: -40,
        backgroundColor: "rgba(255, 255, 255, 0.52)",
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 82,
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
        marginBottom: 26,
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
    usernameValidationRow: {
        minHeight: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: -8,
        marginBottom: 2,
    },
    usernameValidationText: {
        flex: 1,
        color: COLORS.textMuted,
        fontSize: TYPE.size.caption,
        fontWeight: TYPE.weight.medium,
    },
    usernameAvailableText: {
        color: COLORS.success,
        fontWeight: TYPE.weight.semibold,
    },
    usernameErrorText: {
        color: COLORS.danger,
        fontWeight: TYPE.weight.semibold,
    },
    avatarLabel: {
        color: COLORS.textSecondary,
        fontWeight: TYPE.weight.semibold,
        fontSize: TYPE.size.caption,
    },
    avatarSelector: {
        marginTop: 2,
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
