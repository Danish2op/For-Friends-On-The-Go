import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import fetch from "node-fetch";

admin.initializeApp();
const db = admin.firestore();

// ─── Constants ───────────────────────────────────────────────────────────────
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[[^\]]+\]$/;
const TAG = "[onLobbyInviteCreated]";

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface InviteData {
    lobbyId?: string;
    lobbyCode?: string;
    hostUsername?: string;
    hostUid?: string;
    recipientUid?: string;
    status?: string;
}

interface DeviceDoc {
    expoPushToken?: string;
}

interface ExpoPushTicket {
    status?: string;
    message?: string;
    id?: string;
}

// ─── Cloud Function ──────────────────────────────────────────────────────────

/**
 * Fires whenever a new lobby invite document is created at:
 *   users/{recipientUid}/lobbyInvites/{inviteId}
 *
 * Reads the recipient's registered push tokens from their
 * `devices` subcollection and sends a push notification
 * via the Expo Push API.
 *
 * This runs server-side with admin privileges — it doesn't
 * depend on the sender's device being online or the recipient's
 * app being open.
 */
export const onLobbyInviteCreated = onDocumentCreated(
    {
        document: "users/{recipientUid}/lobbyInvites/{inviteId}",
        region: "us-central1",
    },
    async (event) => {
        const snap = event.data;
        if (!snap) {
            console.warn(TAG, "No snapshot data — skipping.");
            return;
        }

        const invite = snap.data() as InviteData;
        const recipientUid = event.params.recipientUid;

        // Only send for new pending invites
        if (invite.status !== "pending") {
            console.log(TAG, `Invite status is "${invite.status}" — not pending, skipping.`);
            return;
        }

        const lobbyId = invite.lobbyId ?? "";
        const lobbyCode = invite.lobbyCode ?? "";
        const hostUsername = invite.hostUsername ?? "A friend";

        if (!lobbyId || !lobbyCode) {
            console.warn(TAG, "Missing lobbyId or lobbyCode — skipping.");
            return;
        }

        console.log(
            TAG,
            `New invite: host="${hostUsername}" → recipient="${recipientUid.slice(0, 8)}…" lobby="${lobbyCode}"`
        );

        // ── Collect recipient's push tokens ────────────────────────────────
        const devicesSnap = await db
            .collection("users")
            .doc(recipientUid)
            .collection("devices")
            .get();

        const tokens: string[] = [];
        devicesSnap.docs.forEach((deviceDoc) => {
            const data = deviceDoc.data() as DeviceDoc;
            if (data.expoPushToken && EXPO_PUSH_TOKEN_REGEX.test(data.expoPushToken)) {
                tokens.push(data.expoPushToken);
            }
        });

        if (tokens.length === 0) {
            console.warn(TAG, `No valid push tokens for recipient ${recipientUid.slice(0, 8)}…`);
            return;
        }

        console.log(TAG, `Found ${tokens.length} valid token(s). Dispatching push…`);

        // ── Build and send the Expo Push payload ───────────────────────────
        const deepLink = `forfriendsonthego:///${lobbyId}`;

        const messages = tokens.map((to) => ({
            to,
            sound: "default" as const,
            channelId: "default",
            title: `${hostUsername} invited you`,
            body: `Join lobby ${lobbyCode} now.`,
            data: {
                type: "lobby_invite",
                lobbyId,
                lobbyCode,
                url: deepLink,
                deepLink,
                path: `/(lobby)/${lobbyId}`,
            },
        }));

        try {
            const response = await fetch(EXPO_PUSH_API_URL, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(messages),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(TAG, `Expo Push API error: HTTP ${response.status} — ${text}`);
                return;
            }

            const result = (await response.json()) as { data?: ExpoPushTicket[] };
            let okCount = 0;
            let failCount = 0;

            result.data?.forEach((ticket, idx) => {
                if (ticket.status === "ok") {
                    okCount++;
                } else {
                    failCount++;
                    console.warn(
                        TAG,
                        `Ticket ${idx} failed: status="${ticket.status}" message="${ticket.message ?? ""}"`
                    );
                }
            });

            console.log(TAG, `✅ Push complete: ${okCount} ok, ${failCount} failed`);
        } catch (error) {
            console.error(TAG, "Failed to send push notification:", error);
        }
    }
);
