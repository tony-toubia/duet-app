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
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { ConfirmModal } from '@/components/ConfirmModal';
import { colors } from '@/theme';
import type { FriendsScreenProps } from '@/navigation/types';

type SearchTab = 'email' | 'code';

export const FriendsScreen = ({ navigation }: FriendsScreenProps) => {
  const [searchTab, setSearchTab] = useState<SearchTab>('email');
  const [emailQuery, setEmailQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{ uid: string; name: string } | null>(null);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const insets = useSafeAreaInsets();

  const isGuest = useAuthStore.getState().isGuest;

  const {
    friends,
    recentConnections,
    statuses,
    searchResult,
    isSearching,
    friendCode,
    isFriendCodeLoading,
    pendingRequests,
    acceptedFriends,
    subscribe,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    searchByEmail,
    lookupFriendCode,
    getOrCreateFriendCode,
    clearSearch,
  } = useFriendsStore();

  useEffect(() => {
    const unsub = subscribe();
    return unsub;
  }, []);

  useEffect(() => {
    if (!isGuest) {
      getOrCreateFriendCode().catch(() => {});
    }
  }, [isGuest]);

  const handleSearchByEmail = async () => {
    if (!emailQuery.trim()) return;
    setSearchNotFound(false);
    await searchByEmail(emailQuery);
    setTimeout(() => {
      const { searchResult } = useFriendsStore.getState();
      if (!searchResult) setSearchNotFound(true);
    }, 100);
  };

  const handleLookupCode = async () => {
    if (codeQuery.length !== 8) return;
    setSearchNotFound(false);
    await lookupFriendCode(codeQuery);
    setTimeout(() => {
      const { searchResult } = useFriendsStore.getState();
      if (!searchResult) setSearchNotFound(true);
    }, 100);
  };

  const handleSendRequest = async (uid: string) => {
    try {
      await sendFriendRequest(uid);
      Alert.alert('Request Sent', 'Friend request has been sent.');
      clearSearch();
      setEmailQuery('');
      setCodeQuery('');
      setSearchNotFound(false);
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

  const handleCopyCode = async () => {
    if (!friendCode) return;
    await Clipboard.setStringAsync(friendCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    if (!friendCode) return;
    try {
      await Share.share({
        message: `Add me as a friend on Duet! My friend code: ${friendCode}`,
      });
    } catch {}
  };

  const pending = pendingRequests();
  const accepted = acceptedFriends();
  const recentList = Object.entries(recentConnections)
    .map(([uid, c]) => ({ uid, ...c }))
    .filter((conn) => !friends[conn.uid])
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

        {/* Your Friend Code */}
        {!isGuest && (
          <View style={styles.friendCodeSection}>
            <Text style={styles.sectionTitle}>YOUR FRIEND CODE</Text>
            {isFriendCodeLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : friendCode ? (
              <View style={styles.friendCodeCard}>
                <View style={styles.friendCodeRow}>
                  <Text style={styles.friendCodeText}>{friendCode}</Text>
                  <TouchableOpacity onPress={handleCopyCode}>
                    <Text style={styles.copyText}>{codeCopied ? 'Copied!' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.shareInviteBtn} onPress={handleShareInvite}>
                  <Text style={styles.shareInviteText}>Share Invite Link</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {/* Add Friend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADD FRIEND</Text>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, searchTab === 'email' && styles.tabActive]}
              onPress={() => { setSearchTab('email'); clearSearch(); setSearchNotFound(false); }}
            >
              <Text style={[styles.tabText, searchTab === 'email' && styles.tabTextActive]}>By Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, searchTab === 'code' && styles.tabActive]}
              onPress={() => { setSearchTab('code'); clearSearch(); setSearchNotFound(false); }}
            >
              <Text style={[styles.tabText, searchTab === 'code' && styles.tabTextActive]}>By Friend Code</Text>
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.searchRow}>
            {searchTab === 'email' ? (
              <TextInput
                style={styles.searchInput}
                placeholder="Enter email address..."
                placeholderTextColor={colors.textMuted}
                value={emailQuery}
                onChangeText={(t) => { setEmailQuery(t); setSearchNotFound(false); }}
                onSubmitEditing={handleSearchByEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            ) : (
              <TextInput
                style={[styles.searchInput, styles.codeInput]}
                placeholder="Enter 8-char code..."
                placeholderTextColor={colors.textMuted}
                value={codeQuery}
                onChangeText={(t) => { setCodeQuery(t.toUpperCase()); setSearchNotFound(false); }}
                onSubmitEditing={handleLookupCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
            )}
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={searchTab === 'email' ? handleSearchByEmail : handleLookupCode}
              disabled={searchTab === 'email' ? !emailQuery.trim() : codeQuery.length !== 8}
            >
              {isSearching ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.searchBtnText}>{searchTab === 'email' ? 'Search' : 'Look Up'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Search result */}
          {searchResult && (
            <View style={styles.searchResults}>
              <View style={styles.userRow}>
                {renderAvatar(searchResult.displayName, searchResult.avatarUrl)}
                <Text style={styles.userName}>{searchResult.displayName}</Text>
                {friends[searchResult.uid] ? (
                  <Text style={styles.alreadyAdded}>
                    {friends[searchResult.uid].status === 'accepted' ? 'Friends' : 'Pending'}
                  </Text>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(searchResult.uid)}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {searchNotFound && !isSearching && !searchResult && (
            <Text style={styles.emptyText}>
              {searchTab === 'email' ? 'No user found with that email.' : 'No user found with that code.'}
            </Text>
          )}
        </View>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PENDING REQUESTS</Text>
            <View style={styles.card}>
              {pending.map((req) => (
                <View key={req.uid} style={styles.friendRow}>
                  {renderAvatar(req.displayName, req.avatarUrl)}
                  <Text style={[styles.userName, { flex: 1 }]}>{req.displayName}</Text>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req.uid)}>
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => handleRemove(req.uid, req.displayName)}>
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Connections */}
        {recentList.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECENT CONNECTIONS</Text>
            <View style={styles.card}>
              {recentList.map((conn) => (
                <View key={conn.uid} style={styles.friendRow}>
                  {renderAvatar(conn.displayName, conn.avatarUrl)}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{conn.displayName}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleSendRequest(conn.uid)}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            FRIENDS {accepted.length > 0 ? `(${accepted.length})` : ''}
          </Text>
          {accepted.length === 0 ? (
            <Text style={styles.emptyText}>No friends yet. Search by email or share your friend code.</Text>
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
  friendCodeSection: {
    paddingHorizontal: 20,
    gap: 8,
  },
  friendCodeCard: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: 16,
  },
  friendCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  friendCodeText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  copyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  shareInviteBtn: {
    backgroundColor: 'rgba(232, 115, 74, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 115, 74, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  shareInviteText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.text,
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
  codeInput: {
    letterSpacing: 3,
    fontWeight: '600',
    textTransform: 'uppercase',
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
    marginTop: 4,
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
    gap: 10,
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
