import { ChevronRight, Clock3, LogOut, Users, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { AvatarImage, AvatarSelector } from "../../components/avatar/avatar-ui";
import FriendRequestCenter from "../../components/friends/friend-request-center";
import { getAvatarOptionById, type AvatarId } from "../../constants/avatars";
import { COLORS, SKEUO } from "../../constants/theme";
import type { FriendProfile, IncomingFriendRequest, OutgoingFriendRequest } from "../../services/firebase/friends";

interface ProfileDrawerProps {
    visible: boolean;
    username: string;
    avatarId: AvatarId | null;
    updatingAvatar: boolean;
    friendProfiles: FriendProfile[];
    incomingRequests: IncomingFriendRequest[];
    outgoingRequests: OutgoingFriendRequest[];
    friendSearchValue: string;
    searchingFriend: boolean;
    incomingRequestsLoading: boolean;
    outgoingRequestsLoading: boolean;
    requestsError: string | null;
    respondingRequestUid: string | null;
    cancellingRequestUid: string | null;
    removingFriendUid: string | null;
    onClose: () => void;
    onSignOut: () => Promise<void>;
    onSelectAvatar: (avatarId: AvatarId) => Promise<void>;
    onOpenHistory: () => void;
    onChangeFriendSearch: (value: string) => void;
    onSearchFriend: () => Promise<void>;
    onAcceptFriendRequest: (requesterUid: string) => Promise<void>;
    onRejectFriendRequest: (requesterUid: string) => Promise<void>;
    onCancelFriendRequest: (targetUid: string) => Promise<void>;
    onRemoveFriend: (friendUid: string) => Promise<void>;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const PANEL_WIDTH = Math.min(388, SCREEN_WIDTH * 0.88);

export default function ProfileDrawer({
    visible,
    username,
    avatarId,
    updatingAvatar,
    friendProfiles,
    incomingRequests,
    outgoingRequests,
    friendSearchValue,
    searchingFriend,
    incomingRequestsLoading,
    outgoingRequestsLoading,
    requestsError,
    respondingRequestUid,
    cancellingRequestUid,
    removingFriendUid,
    onClose,
    onSignOut,
    onSelectAvatar,
    onOpenHistory,
    onChangeFriendSearch,
    onSearchFriend,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onCancelFriendRequest,
    onRemoveFriend,
}: ProfileDrawerProps) {
    const [mounted, setMounted] = useState(visible);
    const slideX = useRef(new Animated.Value(PANEL_WIDTH)).current;
    const backdrop = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.parallel([
                Animated.timing(slideX, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(backdrop, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
            return;
        }

        if (!mounted) {
            return;
        }

        Animated.parallel([
            Animated.timing(slideX, {
                toValue: PANEL_WIDTH,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(backdrop, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) {
                setMounted(false);
            }
        });
    }, [backdrop, mounted, slideX, visible]);

    const selectedAvatar = useMemo(() => getAvatarOptionById(avatarId), [avatarId]);

    if (!mounted) {
        return null;
    }

    return (
        <Modal transparent visible onRequestClose={onClose} animationType="none">
            <View style={styles.modalRoot}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.panelShadow,
                        {
                            width: PANEL_WIDTH,
                            transform: [{ translateX: slideX }],
                        },
                    ]}
                >
                    <View style={styles.panel}>
                        <View style={styles.headerRow}>
                            <Text style={styles.headerTitle}>Profile</Text>
                            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                                <X color={COLORS.text} size={20} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileCard}>
                            <AvatarImage avatarId={selectedAvatar.id} size={66} style={styles.profileAvatar} />
                            <View style={styles.profileTextWrap}>
                                <Text style={styles.usernameLabel}>Username</Text>
                                <Text style={styles.usernameText}>{username}</Text>
                            </View>
                        </View>

                        <Text style={styles.sectionLabel}>Avatar Selection</Text>
                        <AvatarSelector
                            value={selectedAvatar.id}
                            onChange={(nextAvatar) => {
                                void onSelectAvatar(nextAvatar);
                            }}
                            disabled={updatingAvatar}
                            layout="grid"
                        />

                        {/* Lobby History Navigation Button */}
                        <TouchableOpacity
                            style={styles.historyNavButton}
                            onPress={onOpenHistory}
                            activeOpacity={0.85}
                        >
                            <View style={styles.historyNavIconCircle}>
                                <Clock3 size={18} color={COLORS.primary} />
                            </View>
                            <View style={styles.historyNavTextWrap}>
                                <Text style={styles.historyNavTitle}>Lobby History</Text>
                                <Text style={styles.historyNavSubtitle}>View past lobbies & missions</Text>
                            </View>
                            <ChevronRight size={18} color={COLORS.muted} />
                        </TouchableOpacity>

                        <ScrollView style={styles.scrollSection} showsVerticalScrollIndicator={false}>
                            <View style={styles.sectionHeader}>
                                <Users size={14} color={COLORS.textDim} />
                                <Text style={styles.sectionTitle}>Friends Management</Text>
                            </View>
                            <FriendRequestCenter
                                friendSearchValue={friendSearchValue}
                                onChangeFriendSearch={onChangeFriendSearch}
                                searchingFriend={searchingFriend}
                                onSearchFriend={onSearchFriend}
                                incomingRequests={incomingRequests}
                                outgoingRequests={outgoingRequests}
                                incomingRequestsLoading={incomingRequestsLoading}
                                outgoingRequestsLoading={outgoingRequestsLoading}
                                requestsError={requestsError}
                                respondingRequestUid={respondingRequestUid}
                                cancellingRequestUid={cancellingRequestUid}
                                onAcceptFriendRequest={onAcceptFriendRequest}
                                onRejectFriendRequest={onRejectFriendRequest}
                                onCancelFriendRequest={onCancelFriendRequest}
                                friendProfiles={friendProfiles}
                                removingFriendUid={removingFriendUid}
                                onRemoveFriend={onRemoveFriend}
                            />
                        </ScrollView>

                        <TouchableOpacity onPress={onSignOut} style={styles.signOutButton} activeOpacity={0.9}>
                            <LogOut color="#f6fbff" size={17} />
                            <Text style={styles.signOutText}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        alignItems: "flex-end",
    },
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(17, 31, 48, 0.42)",
    },
    panelShadow: {
        height: "100%",
        shadowColor: COLORS.shadowDark,
        shadowOffset: { width: -10, height: 12 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
        elevation: 14,
    },
    panel: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderLeftWidth: 1,
        borderLeftColor: "rgba(255,255,255,0.65)",
        paddingTop: 54,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: "800",
        color: COLORS.text,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
    },
    profileCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: SKEUO.radius.m,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        marginBottom: 14,
    },
    profileAvatar: {
        width: 66,
        height: 66,
        borderRadius: 22,
        marginRight: 12,
    },
    profileTextWrap: {
        flex: 1,
    },
    usernameLabel: {
        color: COLORS.textDim,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.1,
        fontWeight: "700",
    },
    usernameText: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "800",
        marginTop: 2,
    },
    sectionLabel: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.1,
        marginBottom: 8,
    },
    historyNavButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: SKEUO.radius.s,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.7)",
        padding: 12,
        marginTop: 10,
        marginBottom: 6,
    },
    historyNavIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.primary + "14",
        alignItems: "center",
        justifyContent: "center",
    },
    historyNavTextWrap: {
        flex: 1,
        gap: 1,
    },
    historyNavTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "700",
    },
    historyNavSubtitle: {
        color: COLORS.textDim,
        fontSize: 12,
    },
    scrollSection: {
        flex: 1,
    },
    sectionHeader: {
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
    },
    sectionTitle: {
        color: COLORS.text,
        fontWeight: "800",
        fontSize: 14,
    },
    signOutButton: {
        height: 48,
        borderRadius: SKEUO.radius.pill,
        backgroundColor: COLORS.danger,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
        marginTop: 10,
    },
    signOutText: {
        color: "#f6fbff",
        fontWeight: "800",
        fontSize: 14,
    },
});
