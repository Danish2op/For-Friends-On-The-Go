import { useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler } from "react-native";

interface UseLobbyExitGuardOptions {
    enabled: boolean;
    onExitAttempt: () => void;
}

/**
 * Universal exit guard for all lobby screens.
 *
 * Intercepts:
 *   1. Android hardware back button
 *   2. React Navigation `beforeRemove` event (covers router.back, swipe, replace)
 *   3. iOS swipe-back gesture (via gestureEnabled: false on Stack.Screen)
 *
 * Returns `disableGuard()` — call it **synchronously** before any
 * programmatic navigation that should NOT be intercepted:
 *   - Forward progression: router.replace("/voting"), router.push("/navigation")
 *   - Confirmed exit: router.replace("/") after exitLobbyWithCleanup
 *
 * This uses a ref (not state) so the bypass takes effect immediately,
 * before React re-renders or re-runs effects.
 */
export function useLobbyExitGuard({ enabled, onExitAttempt }: UseLobbyExitGuardOptions) {
    const navigation = useNavigation();
    const callbackRef = useRef(onExitAttempt);
    callbackRef.current = onExitAttempt;

    // Synchronous bypass ref — survives across renders without waiting
    // for a state update + effect re-run cycle.
    const bypassRef = useRef(false);

    const disableGuard = useCallback(() => {
        bypassRef.current = true;
    }, []);

    // Android hardware back button
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const handler = () => {
            if (bypassRef.current) {
                return false; // let system handle it
            }
            callbackRef.current();
            return true; // block default back behavior
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", handler);
        return () => subscription.remove();
    }, [enabled]);

    // React Navigation beforeRemove (catches router.back, router.replace, swipe, etc.)
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const unsubscribe = navigation.addListener("beforeRemove", (e) => {
            if (bypassRef.current) {
                // Bypass is active — allow navigation through
                return;
            }
            e.preventDefault();
            callbackRef.current();
        });

        return unsubscribe;
    }, [enabled, navigation]);

    return { disableGuard };
}
