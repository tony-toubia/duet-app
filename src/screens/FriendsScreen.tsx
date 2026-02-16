import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { ConfirmModal } from '@/components/ConfirmModal';
import { colors } from '@/theme';
import type { FriendsScreenProps } from '@/navigation/types';

export const FriendsScreen = ({ navigation }: FriendsScreenProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{ uid: string; name: string } | null>(null);
  const insets = useSafeAreaInsets();

  const {
    friends,
    recentConnections,
    statuses,
    searchResults,
    isSearching,
    pendingRequests,
    acceptedFriends,
    subscribe,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    searchUsers,
    clearSearch,
  } = useFriendsStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      searchUsers(searchQuery);
    }
  };

  const handleSendRequest = async (uid: string) => {
    try {
      await sendFriendRequest(uid);
      Alert.alert('Request Sent', 'Friend request has been sent.');
      clearSearch();
      setSearchQuery('');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to send request.');
    }
  };

  const handleAccept = async (uid: string) => {
    try {
      await acceptFriendRequest(uid);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to accept request.');
    }
  };

  const handleRemove = (uid: string, name: string) => {
    setRemoveTarget({ uid, name });
  };

  const handleConfirmRemove = () => {
    if (removeTarget) {
      removeFriend(removeTarget.uid);
      setRemoveTarget(null);
    }
  };

  const pending = pendingRequests();
  const accepted = acceptedFriends();
  const recentList = Object.entries(recentConnections)
    .map(([uid, c]) => ({ uid, ...c }))
    .sort((a, b) => b.lastConnectedAt - a.lastConnectedAt);

  const renderAvatar = (name: string, avatarUrl: string | null, isOnline?: boolean) => (
    <View style={styles.avatarContainer}>
      <View style={styles.smallAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.smallAvatarImage} />
        ) : (
          <Text style={styles.smallAvatarText}>{name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      {isOnline !== undefined && (
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]} />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Friends</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearch}
              disabled={searchQuery.length < 2}
            >
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>

          {isSearching && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}

          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((result) => (
                <View key={result.uid} style={styles.userRow}>
                  {renderAvatar(result.displayName, result.avatarUrl)}
                  <Text style={styles.userName}>{result.displayName}</Text>
                  {friends[result.uid] ? (
                    <Text style={styles.alreadyAdded}>
                      {friends[result.uid].status === 'accepted' ? 'Friends' : 'Pending'}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleSendRequest(result.uid)}
                    >
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            <View style={styles.card}>
              {pending.map((req) => (
                <View key={req.uid} style={styles.friendRow}>
                  {renderAvatar(req.displayName, req.avatarUrl)}
                  <Text style={[styles.userName, { flex: 1 }]}>{req.displayName}</Text>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAccept(req.uid)}
                  >
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => handleRemove(req.uid, req.displayName)}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Friends {accepted.length > 0 ? `(${accepted.length})` : ''}
          </Text>
          {accepted.length === 0 ? (
            <Text style={styles.emptyText}>No friends yet. Search for users to add them.</Text>
          ) : (
            <View style={styles.card}>
              {accepted.map((friend) => {
                const isOnline = statuses[friend.uid]?.state === 'online';
                return (
                  <TouchableOpacity
                    key={friend.uid}
                    style={styles.friendRow}
                    onLongPress={() => handleRemove(friend.uid, friend.displayName)}
                  >
                    {renderAvatar(friend.displayName, friend.avatarUrl, isOnline)}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{friend.displayName}</Text>
                      <Text style={styles.statusText}>
                        {isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Recent Connections */}
        {recentList.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Connections</Text>
            <View style={styles.card}>
              {recentList.map((conn) => (
                <View key={conn.uid} style={styles.friendRow}>
                  {renderAvatar(conn.displayName, conn.avatarUrl)}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{conn.displayName}</Text>
                    <Text style={styles.statusText}>Room: {conn.roomCode}</Text>
                  </View>
                  {!friends[conn.uid] && (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleSendRequest(conn.uid)}
                    >
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <ConfirmModal
        visible={!!removeTarget}
        title="Remove Friend"
        message={removeTarget ? `Remove ${removeTarget.name} from your friends?` : ''}
        buttons={[
          { text: 'Remove', style: 'destructive', onPress: handleConfirmRemove },
          { text: 'Cancel', style: 'cancel', onPress: () => setRemoveTarget(null) },
        ]}
        onClose={() => setRemoveTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    gap: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  screenTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  searchResults: {
    marginTop: 12,
    backgroundColor: colors.glass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    gap: 10,
  },
  section: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    gap: 10,
  },
  avatarContainer: {
    position: 'relative',
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  smallAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  smallAvatarText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  userName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  alreadyAdded: {
    color: colors.textMuted,
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  acceptBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  declineBtn: {
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  declineBtnText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
