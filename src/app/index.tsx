import LobbyInviteNotificationStack from "@/src/components/lobby/lobby-invite-notification-stack";
import ProfileDrawer from "@/src/components/profile/ProfileDrawer";
import { getAvatarOptionById } from "@/src/constants/avatars";
import { COLORS, SKEUO } from "@/src/constants/theme";
import { useAppAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/context/ToastContext";
import { useFriendRequests } from "@/src/hooks/use-friend-requests";
import {
    cancelOutgoingFriendRequest,
    createFriendRequestByExactUsername,
    listFriendProfilesByIds,
    removeFriendBidirectional,
    respondToFriendRequest,
    type FriendProfile,
} from "@/src/services/firebase/friends";
import { recordLobbyHistory } from "@/src/services/firebase/history";
import {
    acceptLobbyInvite,
    createLobbySession,
    joinLobbyByCode,
    rejectLobbyInvite,
    subscribeIncomingLobbyInvites,
    type LobbyInvite,
} from "@/src/services/firebase/lobby-lifecycle";
import { updateUserAvatar } from "@/src/services/firebase/users";
import {
    registerDeviceForInvites,
    sendLobbyInvites,
} from "@/src/services/notifications/invites";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { FirebaseError } from "firebase/app";
import { LogIn, Menu, Plus, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ActionState = "create" | "join" | null;

const parseError = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

const parseJoinError = (error: unknown) => {
    if (error instanceof FirebaseError) {
        switch (error.code) {
            case "permission-denied":
                return "You are not allowed to join this lobby. Ask the host to recreate the invite or share a fresh code.";
            case "unavailable":
            case "deadline-exceeded":
                return "Lobby service is temporarily unavailable. Check network and retry.";
            default:
                break;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Lobby join failed. Please retry.";
};

export default function HomeScreen() {
    const [joinCode, setJoinCode] = useState("");
    const [activeAction, setActiveAction] = useState<ActionState>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [avatarUpdating, setAvatarUpdating] = useState(false);
    const [friendProfiles, setFriendProfiles] = useState<FriendProfile[]>([]);
    const [friendSearch, setFriendSearch] = useState("");
    const [searchingFriend, setSearchingFriend] = useState(false);
    const [removingFriendUid, setRemovingFriendUid] = useState<string | null>(null);
    const [respondingRequestUid, setRespondingRequestUid] = useState<string | null>(null);
    const [cancellingRequestUid, setCancellingRequestUid] = useState<string | null>(null);
    const [incomingLobbyInvites, setIncomingLobbyInvites] = useState<LobbyInvite[]>([]);
    const [loadingLobbyInvites, setLoadingLobbyInvites] = useState(true);
    const [processingLobbyInviteId, setProcessingLobbyInviteId] = useState<string | null>(null);
    const [inviteSelection, setInviteSelection] = useState<Record<string, boolean>>({});
    const mountedRef = useRef(true);

    const toast = useToast();
    const {
        userId,
        username,
        displayName,
        avatarId,
        friends,
        loading,
        signedIn,
        profileComplete,
        profileState,
        refreshProfile,
        signOut,
    } = useAppAuth();
    const {
        incomingRequests,
        outgoingRequests,
        incomingRequestsLoading,
        outgoingRequestsLoading,
        requestsError,
    } = useFriendRequests(userId);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!loading && signedIn && profileState === "missing" && !profileComplete) {
            router.replace("/sign-up?mode=complete-profile");
        }
    }, [loading, profileComplete, profileState, signedIn]);

    useFocusEffect(
        React.useCallback(() => {
            setActiveAction(null);
        }, [])
    );



    useEffect(() => {
        let active = true;

        const syncFriendProfiles = async () => {
            if (!userId || friends.length === 0) {
                setFriendProfiles([]);
                return;
            }

            try {
                const resolved = await listFriendProfilesByIds(friends);
                if (active) {
                    setFriendProfiles(resolved);
                }
            } catch (error) {
                if (active) {
                    toast.show(parseError(error, "Unable to load friends"), "error");
                }
            }
        };

        syncFriendProfiles();

        return () => {
            active = false;
        };
    }, [friends, toast, userId]);

    useEffect(() => {
        let active = true;

        const setupPush = async () => {
            if (!userId || !profileComplete) {
                return;
            }

            try {
                await registerDeviceForInvites(userId);
            } catch (error) {
                if (active) {
                    toast.show(parseError(error, "Push registration failed"), "error");
                }
            }
        };

        setupPush();

        return () => {
            active = false;
        };
    }, [profileComplete, toast, userId]);

    useEffect(() => {
        if (!userId || !profileComplete) {
            setIncomingLobbyInvites([]);
            setLoadingLobbyInvites(false);
            return;
        }

        setLoadingLobbyInvites(true);
        const unsubscribe = subscribeIncomingLobbyInvites(
            userId,
            (invites) => {
                setIncomingLobbyInvites(invites);
                setLoadingLobbyInvites(false);
            },
            (error) => {
                setLoadingLobbyInvites(false);
                toast.show(parseError(error, "Could not load lobby invites"), "error");
            }
        );

        return unsubscribe;
    }, [profileComplete, toast, userId]);

    useEffect(() => {
        setInviteSelection((previous) => {
            const validUids = new Set(friendProfiles.map((friend) => friend.uid));
            const next: Record<string, boolean> = {};

            Object.entries(previous).forEach(([uid, selected]) => {
                if (selected && validUids.has(uid)) {
                    next[uid] = true;
                }
            });

            const sameSize = Object.keys(previous).length === Object.keys(next).length;
            if (!sameSize) {
                return next;
            }

            const unchanged = Object.keys(previous).every((uid) => previous[uid] === next[uid]);
            return unchanged ? previous : next;
        });
    }, [friendProfiles]);

    const actorName = useMemo(() => username || displayName || "Friend", [displayName, username]);
    const avatarOption = useMemo(() => getAvatarOptionById(avatarId), [avatarId]);
    const selectedInviteUids = useMemo(
        () => Object.entries(inviteSelection).filter(([, selected]) => selected).map(([uid]) => uid),
        [inviteSelection]
    );
    const isBusy = loading || activeAction !== null || !userId || !profileComplete;

    const toggleInviteTarget = (friendUid: string) => {
        setInviteSelection((previous) => ({
            ...previous,
            [friendUid]: !previous[friendUid],
        }));
    };

    const handleCreate = async () => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveAction("create");

        try {
            const createdLobby = await createLobbySession({
                hostUid: userId,
                hostName: actorName,
                inviteeUids: selectedInviteUids,
            });
            await recordLobbyHistory({
                uid: userId,
                sessionId: createdLobby.lobbyId,
                code: createdLobby.lobbyCode,
                role: "host",
                status: "WAITING",
            });

            if (createdLobby.invitedRecipientUids.length > 0) {
                try {
                    const inviteResult = await sendLobbyInvites({
                        lobbyId: createdLobby.lobbyId,
                        lobbyCode: createdLobby.lobbyCode,
                        hostUsername: actorName,
                        recipientUids: createdLobby.invitedRecipientUids,
                    });

                    if (inviteResult.targetedTokens > 0) {
                        toast.show(
                            `Invites sent: ${inviteResult.delivered}/${inviteResult.targetedTokens}`,
                            "success"
                        );
                    } else {
                        toast.show("No active push tokens for selected friends.", "info");
                    }
                } catch (error) {
                    toast.show(parseError(error, "Invite delivery failed"), "error");
                }
            }

            setInviteSelection({});
            toast.show("Lobby created", "success");
            router.push(`/${createdLobby.lobbyId}`);
        } catch (error) {
            toast.show(parseError(error, "Failed to create lobby"), "error");
        } finally {
            if (mountedRef.current) {
                setActiveAction(null);
            }
        }
    };

    const handleJoin = async () => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        const normalizedCode = joinCode.trim().toUpperCase();
        if (!normalizedCode) {
            toast.show("Lobby code is required.", "error");
            return;
        }

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setActiveAction("join");

        try {
            const joinedLobby = await joinLobbyByCode({
                lobbyCode: normalizedCode,
                userUid: userId,
                userDisplayName: actorName,
            });
            await recordLobbyHistory({
                uid: userId,
                sessionId: joinedLobby.lobbyId,
                code: joinedLobby.lobbyCode,
                role: "guest",
                status: "WAITING",
            });
            toast.show("Lobby joined", "success");
            router.push(`/${joinedLobby.lobbyId}`);
        } catch (error) {
            if (error instanceof FirebaseError && error.code === "permission-denied") {
                toast.show(
                    "You are not authorized to join this lobby from your account. Ask the host to send a new invite.",
                    "error"
                );
            } else {
                toast.show(parseJoinError(error), "error");
            }
        } finally {
            if (mountedRef.current) {
                setActiveAction(null);
            }
        }
    };

    const handleSelectAvatar = async (selectedAvatarId: "1" | "2" | "3" | "4" | "5") => {
        if (!userId || selectedAvatarId === avatarId) {
            return;
        }

        await Haptics.selectionAsync();
        setAvatarUpdating(true);
        try {
            await updateUserAvatar(userId, selectedAvatarId);
            await refreshProfile();
            toast.show("Avatar updated", "success");
        } catch (error) {
            toast.show(parseError(error, "Could not update avatar"), "error");
        } finally {
            if (mountedRef.current) {
                setAvatarUpdating(false);
            }
        }
    };

    const handleSignOut = async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await signOut();
        router.replace("/sign-in");
    };

    const handleSearchFriend = async () => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        const exact = friendSearch.trim();
        if (!exact) {
            toast.show("Enter an exact username.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setSearchingFriend(true);
        try {
            const targetFriend = await createFriendRequestByExactUsername(userId, exact);
            setFriendSearch("");
            toast.show(`Friend request sent to ${targetFriend.username}`, "success");
        } catch (error) {
            toast.show(parseError(error, "Unable to send friend request"), "error");
        } finally {
            if (mountedRef.current) {
                setSearchingFriend(false);
            }
        }
    };

    const handleCancelFriendRequest = async (targetUid: string) => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setCancellingRequestUid(targetUid);
        try {
            await cancelOutgoingFriendRequest(userId, targetUid);
            toast.show("Friend request cancelled", "info");
        } catch (error) {
            toast.show(parseError(error, "Unable to cancel request"), "error");
        } finally {
            if (mountedRef.current) {
                setCancellingRequestUid(null);
            }
        }
    };

    const handleRemoveFriend = async (friendUid: string) => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setRemovingFriendUid(friendUid);
        try {
            await removeFriendBidirectional(userId, friendUid);
            await refreshProfile();
            toast.show("Friend removed", "info");
        } catch (error) {
            toast.show(parseError(error, "Unable to remove friend"), "error");
        } finally {
            if (mountedRef.current) {
                setRemovingFriendUid(null);
            }
        }
    };

    const handleAcceptFriendRequest = async (requesterUid: string) => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setRespondingRequestUid(requesterUid);
        try {
            await respondToFriendRequest(userId, requesterUid, "accept");
            await refreshProfile();
            toast.show("Friend request accepted", "success");
        } catch (error) {
            toast.show(parseError(error, "Unable to accept request"), "error");
        } finally {
            if (mountedRef.current) {
                setRespondingRequestUid(null);
            }
        }
    };

    const handleDeclineFriendRequest = async (requesterUid: string) => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setRespondingRequestUid(requesterUid);
        try {
            await respondToFriendRequest(userId, requesterUid, "reject");
            toast.show("Friend request declined", "info");
        } catch (error) {
            toast.show(parseError(error, "Unable to decline request"), "error");
        } finally {
            if (mountedRef.current) {
                setRespondingRequestUid(null);
            }
        }
    };

    const handleAcceptLobbyInvite = async (inviteId: string) => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setProcessingLobbyInviteId(inviteId);
        try {
            const accepted = await acceptLobbyInvite(userId, inviteId, actorName);
            await recordLobbyHistory({
                uid: userId,
                sessionId: accepted.lobbyId,
                code: accepted.lobbyCode,
                role: "guest",
                status: "WAITING",
            });
            toast.show("Lobby invite accepted", "success");
            router.push(`/${accepted.lobbyId}`);
        } catch (error) {
            toast.show(parseError(error, "Unable to accept invite"), "error");
        } finally {
            if (mountedRef.current) {
                setProcessingLobbyInviteId(null);
            }
        }
    };

    const handleRejectLobbyInvite = async (inviteId: string) => {
        if (!userId) {
            toast.show("Session unavailable. Please sign in again.", "error");
            return;
        }

        await Haptics.selectionAsync();
        setProcessingLobbyInviteId(inviteId);
        try {
            await rejectLobbyInvite(userId, inviteId);
            toast.show("Lobby invite rejected", "info");
        } catch (error) {
            toast.show(parseError(error, "Unable to reject invite"), "error");
        } finally {
            if (mountedRef.current) {
                setProcessingLobbyInviteId(null);
            }
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

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.headerRow}>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.headerEyebrow}>Live Session Hub</Text>
                        <Text style={styles.headerTitle}>For Friends On The Go</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.burgerButton}
                        onPress={() => setProfileOpen(true)}
                        activeOpacity={0.9}
                    >
                        <Menu color={COLORS.text} size={24} />
                    </TouchableOpacity>
                </View>

                <View style={styles.identityShell}>
                    <View style={styles.identityCard}>
                        <Image source={avatarOption.source} style={styles.identityAvatar} contentFit="cover" />
                        <View style={styles.identityTextWrap}>
                            <Text style={styles.identityLabel}>Signed in as</Text>
                            <Text style={styles.identityName}>{actorName}</Text>
                        </View>
                        <View style={styles.secureBadge}>
                            <ShieldCheck size={14} color={COLORS.secondary} />
                            <Text style={styles.secureBadgeText}>Secure</Text>
                        </View>
                    </View>
                </View>

                <LobbyInviteNotificationStack
                    invites={incomingLobbyInvites}
                    loading={loadingLobbyInvites}
                    processingInviteId={processingLobbyInviteId}
                    onAcceptInvite={handleAcceptLobbyInvite}
                    onRejectInvite={handleRejectLobbyInvite}
                />

                <View style={styles.cardShadowDark}>
                    <View style={styles.cardShadowLight}>
                        <View style={styles.mainCard}>
                            <TouchableOpacity
                                onPress={handleCreate}
                                disabled={isBusy}
                                activeOpacity={0.9}
                                style={styles.buttonShell}
                            >
                                <LinearGradient
                                    colors={[COLORS.primary, COLORS.primaryDeep]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.primaryButton}
                                >
                                    <Text style={styles.primaryButtonText}>
                                        {activeAction === "create" ? "Creating..." : "Create Lobby"}
                                    </Text>
                                    <Plus size={20} color={COLORS.primaryText} />
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.inviteSection}>
                                <Text style={styles.inviteTitle}>Invite Friends</Text>
                                {friendProfiles.length === 0 ? (
                                    <Text style={styles.inviteEmpty}>
                                        Add friends from the profile drawer to send invites.
                                    </Text>
                                ) : (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.inviteList}
                                    >
                                        {friendProfiles.map((friend) => {
                                            const selected = Boolean(inviteSelection[friend.uid]);
                                            return (
                                                <TouchableOpacity
                                                    key={friend.uid}
                                                    style={[
                                                        styles.inviteChip,
                                                        selected && styles.inviteChipSelected,
                                                    ]}
                                                    onPress={() => toggleInviteTarget(friend.uid)}
                                                    disabled={isBusy}
                                                    activeOpacity={0.9}
                                                >
                                                    <Image
                                                        source={getAvatarOptionById(friend.avatarId).source}
                                                        style={styles.inviteAvatar}
                                                        contentFit="cover"
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.inviteChipText,
                                                            selected && styles.inviteChipTextSelected,
                                                        ]}
                                                    >
                                                        {friend.username}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                )}
                            </View>

                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>Join Existing</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <View style={styles.joinRow}>
                                <View style={[styles.inputSocket, styles.joinInput]}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Lobby code"
                                        placeholderTextColor={COLORS.muted}
                                        value={joinCode}
                                        onChangeText={(value) => setJoinCode(value.toUpperCase())}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        maxLength={6}
                                        editable={!isBusy}
                                        selectionColor={COLORS.primary}
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={handleJoin}
                                    disabled={isBusy}
                                    activeOpacity={0.9}
                                    style={styles.joinActionShell}
                                >
                                    <LinearGradient
                                        colors={["#7ea9f7", "#4f7fdf"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.joinAction}
                                    >
                                        {activeAction === "join" ? (
                                            <Text style={styles.joinBusyText}>...</Text>
                                        ) : (
                                            <LogIn color="#eef6ff" size={20} />
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            <ProfileDrawer
                visible={profileOpen}
                onClose={() => setProfileOpen(false)}
                username={actorName}
                avatarId={avatarId as "1" | "2" | "3" | "4" | "5" | null}
                updatingAvatar={avatarUpdating}
                friendProfiles={friendProfiles}
                incomingRequests={incomingRequests}
                outgoingRequests={outgoingRequests}
                incomingRequestsLoading={incomingRequestsLoading}
                outgoingRequestsLoading={outgoingRequestsLoading}
                requestsError={requestsError}
                friendSearchValue={friendSearch}
                searchingFriend={searchingFriend}
                removingFriendUid={removingFriendUid}
                respondingRequestUid={respondingRequestUid}
                cancellingRequestUid={cancellingRequestUid}
                onSelectAvatar={handleSelectAvatar}
                onSignOut={handleSignOut}
                onOpenHistory={() => {
                    setProfileOpen(false);
                    router.push("/history");
                }}
                onChangeFriendSearch={setFriendSearch}
                onSearchFriend={handleSearchFriend}
                onRemoveFriend={handleRemoveFriend}
                onAcceptFriendRequest={handleAcceptFriendRequest}
                onRejectFriendRequest={handleDeclineFriendRequest}
                onCancelFriendRequest={handleCancelFriendRequest}
            />
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
        top: -120,
        right: -70,
        width: 270,
        height: 270,
        borderRadius: 135,
        backgroundColor: "rgba(60, 146, 255, 0.22)",
    },
    glowBottom: {
        position: "absolute",
        bottom: -80,
        left: -46,
        width: 210,
        height: 210,
        borderRadius: 105,
        backgroundColor: "rgba(245, 183, 79, 0.16)",
    },
    safeArea: {
        flex: 1,
        paddingHorizontal: 22,
    },
    headerRow: {
        marginTop: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    headerTextWrap: {
        flex: 1,
        paddingRight: 12,
    },
    headerEyebrow: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 1.1,
        textTransform: "uppercase",
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 30,
        fontWeight: "800",
        lineHeight: 34,
        marginTop: 4,
    },
    burgerButton: {
        width: 50,
        height: 50,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.34,
        shadowRadius: 12,
        elevation: 8,
    },
    identityShell: {
        marginTop: 22,
        borderRadius: SKEUO.radius.l,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        elevation: 10,
    },
    identityCard: {
        borderRadius: SKEUO.radius.l,
        padding: 14,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        flexDirection: "row",
        alignItems: "center",
    },
    identityAvatar: {
        width: 58,
        height: 58,
        borderRadius: 18,
        marginRight: 12,
    },
    identityTextWrap: {
        flex: 1,
    },
    identityLabel: {
        color: COLORS.textDim,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    identityName: {
        color: COLORS.text,
        fontSize: 22,
        fontWeight: "800",
        marginTop: 3,
    },
    secureBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: SKEUO.radius.pill,
        backgroundColor: COLORS.surface,
        paddingVertical: 8,
        paddingHorizontal: 11,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.75)",
    },
    secureBadgeText: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: "700",
    },
    cardShadowDark: {
        marginTop: 22,
        borderRadius: SKEUO.radius.xl,
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: 18, height: 18 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 16,
    },
    cardShadowLight: {
        borderRadius: SKEUO.radius.xl,
        shadowColor: COLORS.shadowLight,
        shadowOffset: { width: -12, height: -12 },
        shadowOpacity: 1,
        shadowRadius: 16,
    },
    mainCard: {
        borderRadius: SKEUO.radius.xl,
        padding: 20,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.65)",
        gap: 16,
    },
    buttonShell: {
        borderRadius: SKEUO.radius.pill,
        shadowColor: "rgba(37, 93, 184, 0.45)",
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 12,
    },
    primaryButton: {
        height: 58,
        borderRadius: SKEUO.radius.pill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.25)",
    },
    primaryButtonText: {
        color: COLORS.primaryText,
        fontWeight: "800",
        letterSpacing: 0.5,
        fontSize: 16,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        color: COLORS.textDim,
        fontWeight: "600",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 1.1,
    },
    inviteSection: {
        gap: 8,
    },
    inviteTitle: {
        color: COLORS.textDim,
        fontWeight: "700",
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 1.1,
    },
    inviteEmpty: {
        color: COLORS.textDim,
        fontSize: 12,
        lineHeight: 16,
    },
    inviteList: {
        gap: 8,
        paddingRight: 8,
    },
    inviteChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: SKEUO.radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 10,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.72)",
    },
    inviteChipSelected: {
        backgroundColor: "rgba(47,124,245,0.15)",
        borderColor: "rgba(47,124,245,0.45)",
    },
    inviteAvatar: {
        width: 26,
        height: 26,
        borderRadius: 10,
    },
    inviteChipText: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
    },
    inviteChipTextSelected: {
        color: COLORS.primary,
    },
    joinRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    inputSocket: {
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.surfaceDeep,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "rgba(255,255,255,0.8)",
        shadowOffset: { width: -3, height: -3 },
        shadowOpacity: 1,
        shadowRadius: 5,
        elevation: 2,
        minHeight: 56,
        justifyContent: "center",
    },
    joinInput: {
        flex: 1,
    },
    input: {
        color: COLORS.text,
        paddingHorizontal: 16,
        fontSize: 16,
        fontWeight: "600",
    },
    joinActionShell: {
        borderRadius: 24,
        shadowColor: "rgba(93, 127, 193, 0.5)",
        shadowOffset: { width: 8, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    joinAction: {
        width: 58,
        height: 58,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
    },
    joinBusyText: {
        color: "#eef6ff",
        fontSize: 18,
        fontWeight: "800",
    },
});
