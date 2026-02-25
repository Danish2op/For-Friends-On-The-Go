import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_LIMIT = 100;

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

const getProjectId = () => {
    const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const fromEasConfig = Constants.easConfig?.projectId;
    return fromExpoConfig || fromEasConfig || "";
};

const toDeviceDocId = (token: string) => {
    return token.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const isExpoPushToken = (token: string) => {
    return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
};

const collectRecipientTokens = async (recipientUids: string[]) => {
    const tokens = new Set<string>();

    await Promise.all(
        recipientUids.map(async (uid) => {
            const deviceSnapshot = await getDocs(collection(db, "users", uid, "devices"));
            deviceSnapshot.docs.forEach((deviceDoc) => {
                const token = (deviceDoc.data() as DeviceTokenRecord).expoPushToken;
                if (token && isExpoPushToken(token)) {
                    tokens.add(token);
                }
            });
        })
    );

    return [...tokens];
};

const sendExpoPushBatch = async (messages: unknown[]) => {
    if (messages.length === 0) {
        return 0;
    }

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
        throw new Error("Push provider request failed.");
    }

    const payload = (await response.json()) as {
        data?: { status?: string }[];
    };

    const okCount = payload.data?.filter((item) => item.status === "ok").length;
    return okCount ?? messages.length;
};

export const registerDeviceForInvites = async (uid: string) => {
    await ensureAndroidChannel();

    const existingPermissions = await Notifications.getPermissionsAsync();
    let permission = existingPermissions.status;

    if (permission !== "granted") {
        const request = await Notifications.requestPermissionsAsync();
        permission = request.status;
    }

    if (permission !== "granted") {
        return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
        throw new Error("Missing EAS projectId for push registration.");
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult.data;

    if (!isExpoPushToken(token)) {
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

    return token;
};

export const sendLobbyInvites = async (payload: InvitePayload): Promise<SendInvitesResult> => {
    const recipients = [...new Set(payload.recipientUids)].filter(Boolean);
    if (recipients.length === 0) {
        return { targetedRecipients: 0, targetedTokens: 0, delivered: 0 };
    }

    const tokens = await collectRecipientTokens(recipients);
    if (tokens.length === 0) {
        return { targetedRecipients: recipients.length, targetedTokens: 0, delivered: 0 };
    }

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

    return {
        targetedRecipients: recipients.length,
        targetedTokens: tokens.length,
        delivered,
    };
};
