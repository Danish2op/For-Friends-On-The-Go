import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "../services/firebase/config";
import {
    checkUsernameAvailability,
    IdentifierResolutionError,
    normalizeUsername,
    validateUsernameFormat,
} from "../services/firebase/users";

type UsernameAvailabilityStatus =
    | "idle"
    | "invalid"
    | "checking"
    | "available"
    | "taken"
    | "error";

interface UsernameAvailabilityState {
    status: UsernameAvailabilityStatus;
    normalizedUsername: string;
    helperText: string;
    isAvailable: boolean;
}

const INITIAL_STATE: UsernameAvailabilityState = {
    status: "idle",
    normalizedUsername: "",
    helperText: "",
    isAvailable: false,
};

export function useUsernameAvailability(rawUsername: string, debounceMs: number = 360) {
    const [state, setState] = useState<UsernameAvailabilityState>(INITIAL_STATE);
    const latestRequestRef = useRef(0);

    const normalizedUsername = useMemo(() => normalizeUsername(rawUsername), [rawUsername]);

    useEffect(() => {
        let active = true;
        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;

        if (!normalizedUsername) {
            setState(INITIAL_STATE);
            return () => {
                active = false;
            };
        }

        if (!validateUsernameFormat(normalizedUsername)) {
            setState({
                status: "invalid",
                normalizedUsername,
                helperText: "Use 3-20 letters, numbers, or underscores.",
                isAvailable: false,
            });
            return () => {
                active = false;
            };
        }

        setState({
            status: "checking",
            normalizedUsername,
            helperText: "Checking username availability...",
            isAvailable: false,
        });

        const timeout = setTimeout(() => {
            const currentUid = auth.currentUser?.uid ?? null;

            checkUsernameAvailability(normalizedUsername, currentUid)
                .then((result) => {
                    if (!active || latestRequestRef.current !== requestId) {
                        return;
                    }

                    if (result.available) {
                        setState({
                            status: "available",
                            normalizedUsername: result.normalizedUsername,
                            helperText: "Username is available.",
                            isAvailable: true,
                        });
                        return;
                    }

                    setState({
                        status: "taken",
                        normalizedUsername: result.normalizedUsername,
                        helperText: "Username is already taken.",
                        isAvailable: false,
                    });
                })
                .catch((error: unknown) => {
                    if (!active || latestRequestRef.current !== requestId) {
                        return;
                    }

                    if (error instanceof IdentifierResolutionError && error.code === "invalid-identifier") {
                        setState({
                            status: "invalid",
                            normalizedUsername,
                            helperText: error.message,
                            isAvailable: false,
                        });
                        return;
                    }

                    setState({
                        status: "error",
                        normalizedUsername,
                        helperText: "Could not validate username. Please retry.",
                        isAvailable: false,
                    });
                });
        }, debounceMs);

        return () => {
            active = false;
            clearTimeout(timeout);
        };
    }, [debounceMs, normalizedUsername]);

    return state;
}
