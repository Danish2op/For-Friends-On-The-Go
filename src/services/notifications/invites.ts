import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "../firebase/config";

// ─── Constants ───────────────────────────────────────────────────────────────
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_LIMIT = 100;
const TAG = "[PushNotifications]";

// ─── Types ───────────────────────────────────────────────────────────────────
interface InvitePayload {
    lobbyId: string;
    lobbyCode: string;
    hostUsername: string;
    recipientUids: string[];
}

interface SendInvitesResult {
    targetedRecipients: number;
    targetedTokens: number;
    delivered: number;
}

interface DeviceTokenRecord {
    expoPushToken: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ensureAndroidChannel = async () => {
    if (Platform.OS !== "android") {
        return;
    }

    await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2F7CF5",
    });
};

const getProjectId = (): string => {
    const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const fromEasConfig = Constants.easConfig?.projectId;
    const projectId = fromExpoConfig || fromEasConfig || "";
    if (!projectId) {
        console.warn(TAG, "No EAS projectId found. Token registration will fail.");
    }
    return projectId;
};

const toDeviceDocId = (token: string): string => {
    return token.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const isExpoPushToken = (token: string): boolean => {
    return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
};

// ─── Token Collection ────────────────────────────────────────────────────────

const collectRecipientTokens = async (recipientUids: string[]): Promise<string[]> => {
    const tokens = new Set<string>();

    await Promise.all(
        recipientUids.map(async (uid) => {
            try {
                const deviceSnapshot = await getDocs(collection(db, "users", uid, "devices"));
                deviceSnapshot.docs.forEach((deviceDoc) => {
                    const token = (deviceDoc.data() as DeviceTokenRecord).expoPushToken;
                    if (token && isExpoPushToken(token)) {
                        tokens.add(token);
                    }
                });
                console.log(TAG, `Collected ${deviceSnapshot.size} device doc(s) for uid=${uid.slice(0, 8)}…`);
            } catch (error: unknown) {
                // Permission denied = sender is not in recipient's friend list
                // This is expected if the friend relationship is one-directional
                const message = error instanceof Error ? error.message : String(error);
                console.warn(TAG, `Failed to read devices for uid=${uid.slice(0, 8)}…:`, message);
            }
        })
    );

    return [...tokens];
};

// ─── Push Delivery ───────────────────────────────────────────────────────────

const sendExpoPushBatch = async (messages: unknown[]): Promise<number> => {
    if (messages.length === 0) {
        return 0;
    }

    console.log(TAG, `Sending batch of ${messages.length} notification(s)…`);

    const response = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "(empty)");
        console.error(TAG, `Push API error: HTTP ${response.status} — ${text}`);
        throw new Error(`Push provider request failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as {
        data?: { status?: string; message?: string }[];
    };

    let okCount = 0;
    let errorCount = 0;
    payload.data?.forEach((item, idx) => {
        if (item.status === "ok") {
            okCount++;
        } else {
            errorCount++;
            console.warn(TAG, `Push ticket ${idx} failed: ${item.status} — ${item.message ?? "(no detail)"}`);
        }
    });

    console.log(TAG, `Batch result: ${okCount} ok, ${errorCount} failed`);
    return okCount;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Requests notification permissions, retrieves the Expo Push Token,
 * and saves it to Firestore under `users/{uid}/devices/{tokenDocId}`.
 *
 * Returns the token string on success, or `null` if permissions were denied.
 * Throws on infrastructure errors (missing projectId, Firestore write failure).
 */
export const registerDeviceForInvites = async (uid: string): Promise<string | null> => {
    console.log(TAG, `Registering device for uid=${uid.slice(0, 8)}…`);

    await ensureAndroidChannel();

    const existingPermissions = await Notifications.getPermissionsAsync();
    let permission = existingPermissions.status;
    console.log(TAG, `Current permission status: ${permission}`);

    if (permission !== "granted") {
        const request = await Notifications.requestPermissionsAsync();
        permission = request.status;
        console.log(TAG, `After request, permission status: ${permission}`);
    }

    if (permission !== "granted") {
        console.warn(TAG, "Notification permission denied — skipping token registration.");
        return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
        throw new Error("Missing EAS projectId for push registration.");
    }

    console.log(TAG, `Requesting Expo Push Token with projectId=${projectId.slice(0, 12)}…`);
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult.data;
    console.log(TAG, `Token received: ${token.slice(0, 30)}…`);

    if (!isExpoPushToken(token)) {
        console.error(TAG, `Invalid token format: "${token}"`);
        throw new Error("Invalid Expo push token returned.");
    }

    const tokenDocId = toDeviceDocId(token);
    await setDoc(
        doc(db, "users", uid, "devices", tokenDocId),
        {
            expoPushToken: token,
            platform: Platform.OS,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );

    console.log(TAG, `✅ Token saved to Firestore: users/${uid.slice(0, 8)}…/devices/${tokenDocId.slice(0, 20)}…`);
    return token;
};

/**
 * Sends push notifications to all devices belonging to the given recipient UIDs.
 *
 * Reads each recipient's `devices` subcollection (requires `isFriendOf` rule),
 * collects valid Expo Push Tokens, and dispatches via the Expo Push API.
 */
export const sendLobbyInvites = async (payload: InvitePayload): Promise<SendInvitesResult> => {
    const recipients = [...new Set(payload.recipientUids)].filter(Boolean);
    if (recipients.length === 0) {
        console.warn(TAG, "sendLobbyInvites called with zero recipients.");
        return { targetedRecipients: 0, targetedTokens: 0, delivered: 0 };
    }

    console.log(TAG, `Sending invites to ${recipients.length} recipient(s) for lobby=${payload.lobbyCode}`);

    const tokens = await collectRecipientTokens(recipients);
    if (tokens.length === 0) {
        console.warn(TAG, "No valid push tokens found across all recipients.");
        return { targetedRecipients: recipients.length, targetedTokens: 0, delivered: 0 };
    }

    console.log(TAG, `Found ${tokens.length} valid token(s). Building payloads…`);

    const deepLink = `forfriendsonthego:///${payload.lobbyId}`;

    const messages = tokens.map((to) => ({
        to,
        sound: "default",
        channelId: "default",
        title: `${payload.hostUsername} invited you`,
        body: `Join lobby ${payload.lobbyCode} now.`,
        data: {
            type: "lobby_invite",
            lobbyId: payload.lobbyId,
            lobbyCode: payload.lobbyCode,
            url: deepLink,
            deepLink,
            path: `/(lobby)/${payload.lobbyId}`,
        },
    }));

    let delivered = 0;
    for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_LIMIT) {
        const batch = messages.slice(i, i + EXPO_PUSH_BATCH_LIMIT);
        delivered += await sendExpoPushBatch(batch);
    }

    console.log(TAG, `✅ Delivery complete: ${delivered}/${tokens.length} delivered`);

    return {
        targetedRecipients: recipients.length,
        targetedTokens: tokens.length,
        delivered,
    };
};
