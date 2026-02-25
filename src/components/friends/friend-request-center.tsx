import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AvatarImage } from "../../components/avatar/avatar-ui";
import { COLORS, SKEUO } from "../../constants/theme";
import type { FriendProfile, IncomingFriendRequest, OutgoingFriendRequest } from "../../services/firebase/friends";

interface FriendRequestCenterProps {
    friendSearchValue: string;
    onChangeFriendSearch: (value: string) => void;
    searchingFriend: boolean;
    onSearchFriend: () => Promise<void>;
    incomingRequests: IncomingFriendRequest[];
    outgoingRequests: OutgoingFriendRequest[];
    incomingRequestsLoading: boolean;
    outgoingRequestsLoading: boolean;
    requestsError: string | null;
    respondingRequestUid: string | null;
    cancellingRequestUid: string | null;
    onAcceptFriendRequest: (requesterUid: string) => Promise<void>;
    onRejectFriendRequest: (requesterUid: string) => Promise<void>;
    onCancelFriendRequest: (targetUid: string) => Promise<void>;
    friendProfiles: FriendProfile[];
    removingFriendUid: string | null;
    onRemoveFriend: (friendUid: string) => Promise<void>;
}

export default function FriendRequestCenter({
    friendSearchValue,
    onChangeFriendSearch,
    searchingFriend,
    onSearchFriend,
    incomingRequests,
    outgoingRequests,
    incomingRequestsLoading,
    outgoingRequestsLoading,
    requestsError,
    respondingRequestUid,
    cancellingRequestUid,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onCancelFriendRequest,
    friendProfiles,
    removingFriendUid,
    onRemoveFriend,
}: FriendRequestCenterProps) {
    return (
        <View style={styles.wrapper}>
            <View style={styles.friendSearchRow}>
                <TextInput
                    value={friendSearchValue}
                    onChangeText={onChangeFriendSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Exact username"
                    placeholderTextColor={COLORS.textDim}
                    style={styles.friendSearchInput}
                />
                <TouchableOpacity style={styles.friendSearchButton} onPress={onSearchFriend} disabled={searchingFriend}>
                    <Text style={styles.friendSearchButtonText}>{searchingFriend ? "..." : "Send"}</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.exactHint}>Requests require exact username match.</Text>
            {requestsError ? <Text style={styles.errorText}>Realtime sync warning: {requestsError}</Text> : null}

            <Text style={styles.groupHeading}>Incoming Requests</Text>
            {incomingRequestsLoading ? (
                <Text style={styles.emptyText}>Loading incoming requests...</Text>
            ) : incomingRequests.length === 0 ? (
                <Text style={styles.emptyText}>No incoming requests.</Text>
            ) : (
                incomingRequests.map((request) => (
                    <View key={request.requesterUid} style={styles.requestRow}>
                        <AvatarImage avatarId={request.requesterAvatarId} size={40} style={styles.friendAvatar} />
                        <View style={styles.friendMeta}>
                            <Text style={styles.friendName}>{request.requesterUsername}</Text>
                            <Text style={styles.friendUid}>Pending approval</Text>
                        </View>
                        <View style={styles.requestActions}>
                            <TouchableOpacity
                                style={styles.requestAcceptButton}
                                onPress={() => onAcceptFriendRequest(request.requesterUid)}
                                disabled={respondingRequestUid === request.requesterUid}
                            >
                                <Text style={styles.requestAcceptText}>
                                    {respondingRequestUid === request.requesterUid ? "..." : "Accept"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.requestRejectButton}
                                onPress={() => onRejectFriendRequest(request.requesterUid)}
                                disabled={respondingRequestUid === request.requesterUid}
                            >
                                <Text style={styles.requestRejectText}>
                                    {respondingRequestUid === request.requesterUid ? "..." : "Reject"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}

            <Text style={styles.groupHeading}>Outgoing Requests</Text>
            {outgoingRequestsLoading ? (
                <Text style={styles.emptyText}>Loading outgoing requests...</Text>
            ) : outgoingRequests.length === 0 ? (
                <Text style={styles.emptyText}>No outgoing requests.</Text>
            ) : (
                outgoingRequests.map((request) => (
                    <View key={request.targetUid} style={styles.requestRow}>
                        <AvatarImage avatarId={request.targetAvatarId} size={40} style={styles.friendAvatar} />
                        <View style={styles.friendMeta}>
                            <Text style={styles.friendName}>{request.targetUsername}</Text>
                            <Text style={styles.friendUid}>Awaiting response</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.requestRejectButton}
                            onPress={() => onCancelFriendRequest(request.targetUid)}
                            disabled={cancellingRequestUid === request.targetUid}
                        >
                            <Text style={styles.requestRejectText}>
                                {cancellingRequestUid === request.targetUid ? "..." : "Cancel"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}

            <Text style={styles.groupHeading}>Connected Friends ({friendProfiles.length})</Text>
            {friendProfiles.length === 0 ? (
                <Text style={styles.emptyText}>No friends connected yet.</Text>
            ) : (
                friendProfiles.map((friend) => (
                    <View key={friend.uid} style={styles.friendRow}>
                        <AvatarImage avatarId={friend.avatarId} size={40} style={styles.friendAvatar} />
                        <View style={styles.friendMeta}>
                            <Text style={styles.friendName}>{friend.username}</Text>
                            <Text style={styles.friendUid}>{friend.uid.slice(0, 12)}...</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.removeFriendButton}
                            onPress={() => onRemoveFriend(friend.uid)}
                            disabled={removingFriendUid === friend.uid}
                        >
                            <Text style={styles.removeFriendText}>
                                {removingFriendUid === friend.uid ? "..." : "Remove"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        gap: 8,
    },
    friendSearchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },
    friendSearchInput: {
        flex: 1,
        minHeight: 44,
        borderRadius: SKEUO.radius.s,
        backgroundColor: COLORS.surfaceDeep,
        borderWidth: 1,
        borderColor: COLORS.border,
        color: COLORS.text,
        paddingHorizontal: 12,
        fontSize: 14,
        fontWeight: "600",
    },
    friendSearchButton: {
        minWidth: 74,
        minHeight: 44,
        borderRadius: SKEUO.radius.s,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
    },
    friendSearchButtonText: {
        color: "#f6fbff",
        fontSize: 13,
        fontWeight: "800",
    },
    exactHint: {
        color: COLORS.textDim,
        fontSize: 11,
        marginBottom: 2,
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 11,
        marginBottom: 2,
    },
    groupHeading: {
        color: COLORS.text,
        fontWeight: "800",
        fontSize: 13,
        marginTop: 4,
    },
    emptyText: {
        color: COLORS.textDim,
        fontSize: 13,
    },
    requestRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: SKEUO.radius.s,
        padding: 8,
        backgroundColor: "rgba(76, 137, 243, 0.08)",
        borderWidth: 1,
        borderColor: "rgba(76, 137, 243, 0.24)",
        marginBottom: 2,
    },
    friendRow: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: SKEUO.radius.s,
        padding: 8,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.68)",
        marginBottom: 2,
    },
    friendAvatar: {
        marginRight: 9,
    },
    friendMeta: {
        flex: 1,
    },
    friendName: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "700",
    },
    friendUid: {
        color: COLORS.textDim,
        fontSize: 11,
        marginTop: 1,
    },
    requestActions: {
        gap: 6,
    },
    requestAcceptButton: {
        borderRadius: SKEUO.radius.pill,
        paddingVertical: 6,
        paddingHorizontal: 9,
        backgroundColor: "rgba(31, 184, 126, 0.2)",
        borderWidth: 1,
        borderColor: "rgba(31, 184, 126, 0.4)",
    },
    requestAcceptText: {
        color: COLORS.secondary,
        fontSize: 11,
        fontWeight: "800",
    },
    requestRejectButton: {
        borderRadius: SKEUO.radius.pill,
        paddingVertical: 6,
        paddingHorizontal: 9,
        backgroundColor: "rgba(227, 90, 90, 0.16)",
        borderWidth: 1,
        borderColor: "rgba(227, 90, 90, 0.35)",
    },
    requestRejectText: {
        color: COLORS.danger,
        fontSize: 11,
        fontWeight: "800",
    },
    removeFriendButton: {
        borderRadius: SKEUO.radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 10,
        backgroundColor: "rgba(227, 90, 90, 0.18)",
        borderWidth: 1,
        borderColor: "rgba(227, 90, 90, 0.35)",
    },
    removeFriendText: {
        color: COLORS.danger,
        fontSize: 11,
        fontWeight: "800",
    },
});
