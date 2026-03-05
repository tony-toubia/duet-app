import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { useDuetStore } from '@/hooks/useDuetStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { adService } from '@/services/AdService';
import { invitationService } from '@/services/InvitationService';
import { LobbyNativeAd } from '@/components/LobbyNativeAd';
import { ShareModal } from '@/components/ShareModal';
import { colors } from '@/theme';
import type { LobbyScreenProps } from '@/navigation/types';

export const LobbyScreen = ({ navigation, route }: LobbyScreenProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const {
    roomCode,
    initialize,
    createRoom,
    joinRoom,
    startAudio,
  } = useDuetStore();

  const userProfile = useAuthStore((s) => s.userProfile);
  const isGuest = useAuthStore((s) => s.isGuest);
  const signOut = useAuthStore((s) => s.signOut);

  const [showingAd, setShowingAd] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  // Online friends for quick connect
  const acceptedFriends = useFriendsStore((s) => s.acceptedFriends);
  const statuses = useFriendsStore((s) => s.statuses);

  // Subscribe to friends on mount
  useEffect(() => {
    const unsub = useFriendsStore.getState().subscribe();
    return unsub;
  }, []);

  const onlineFriends = acceptedFriends().filter(
    (f) => statuses[f.uid]?.state === 'online'
  );

  const [persistentRoom, setPersistentRoom] = useState<{
    partnerUid: string;
    partnerName: string;
    partnerAvatar?: string | null;
  } | null>(null);

  // Navigate to room when connected (gated by ad + audio readiness)
  useEffect(() => {
    if (roomCode && !showingAd && audioReady) {
      navigation.replace('Room');
    }
  }, [roomCode, showingAd, audioReady, navigation]);

  // Handle auto-join from push notification
  useEffect(() => {
    const autoJoinCode = route.params?.autoJoinCode;
    if (autoJoinCode && isInitialized) {
      handleJoinWithCode(autoJoinCode);
    }
  }, [route.params?.autoJoinCode, isInitialized]);

  // Fetch persistent room entry when initialized
  useEffect(() => {
    if (!isInitialized) return;
    const user = auth().currentUser;
    if (!user) return;
    database()
      .ref(`/users/${user.uid}/persistentRoom`)
      .once('value')
      .then((snap) => {
        const data = snap.val();
        if (data && data.partnerUid && data.partnerName) {
          setPersistentRoom(data);
        }
      })
      .catch((e) => console.warn('[Lobby] Failed to load persistent room:', e));
  }, [isInitialized]);

  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
        try { adService.initialize(); } catch (e) { console.warn('[Ad] Ad init failed:', e); }
        setIsInitialized(true);
      } catch (error: any) {
        console.error('[Lobby] Init failed:', error);
        Alert.alert('Error', error?.message || 'Failed to initialize audio. Please restart the app.');
      }
    };
    init();
  }, []);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    try {
      const code = await createRoom();
      // Show pre-roll ad before starting mic
      if (adService.isPreRollReady) {
        setShowingAd(true);
        await adService.showPreRoll();
        setShowingAd(false);
      }
      // Start mic after ad dismisses so user isn't recorded during ad
      await startAudio();
      setAudioReady(true);
      setShareCode(code);
    } catch (error: any) {
      console.error('[Lobby] Create room failed:', error);
      Alert.alert('Error', error?.message || 'Failed to create room. Please restart the app and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWithCode = async (code: string) => {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character room code');
      return;
    }
    setIsLoading(true);
    try {
      await joinRoom(code.toUpperCase());
      // Show pre-roll ad before starting mic
      if (adService.isPreRollReady) {
        setShowingAd(true);
        await adService.showPreRoll();
        setShowingAd(false);
      }
      // Start mic after ad dismisses so user isn't recorded during ad
      await startAudio();
      setAudioReady(true);
      setShowJoinInput(false);
    } catch (error: any) {
      console.error('[Lobby] Join room failed:', error);
      Alert.alert('Error', error?.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = () => handleJoinWithCode(joinCode);

  const handleQuickConnect = async (friendUid: string, friendName: string) => {
    setIsLoading(true);
    try {
      const code = await createRoom();
      await invitationService.sendInvitation(friendUid, code);
      useDuetStore.getState().setFromInvite(true);
      if (adService.isPreRollReady) {
        setShowingAd(true);
        await adService.showPreRoll();
        setShowingAd(false);
      }
      await startAudio();
      setAudioReady(true);
      Alert.alert('Invitation Sent', `${friendName} has been invited to join!`);
    } catch (error: any) {
      console.error('[Lobby] Quick connect failed:', error);
      Alert.alert('Error', error?.message || 'Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = async () => {
    if (!persistentRoom) return;
    setIsLoading(true);
    try {
      const code = await createRoom();
      // Send invitation to persistent partner
      await invitationService.sendInvitation(persistentRoom.partnerUid, code);
      // Show pre-roll ad before starting mic
      if (adService.isPreRollReady) {
        setShowingAd(true);
        await adService.showPreRoll();
        setShowingAd(false);
      }
      await startAudio();
      setAudioReady(true);
      setShareCode(code);
    } catch (error: any) {
      console.error('[Lobby] Reconnect failed:', error);
      Alert.alert('Error', error?.message || 'Failed to reconnect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Initializing audio...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.lobbyContainer}>
      <StatusBar style="light" />
      <View style={styles.lobbyTopBg} />
      <View style={styles.lobbyBottomBg} />
      <View style={styles.lobbyImageContainer}>
        <Image
          source={require('../../assets/duet-home-bg.png')}
          style={styles.lobbyImage}
          resizeMode="contain"
        />
      </View>
      <KeyboardAvoidingView
        style={[styles.lobbyOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.lobbyTopBar}>
          <TouchableOpacity
            style={styles.friendsBtn}
            onPress={() => navigation.navigate('Friends')}
          >
            <Text style={styles.friendsBtnText}>Friends</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {isGuest ? (
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => signOut()}
            >
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.profileBtnText}>
                {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'P'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.lobbyHeader}>
          <Image
            source={require('../../assets/duet-logo.png')}
            style={styles.lobbyLogo}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.lobbyButtons}>
          {persistentRoom && (
            <TouchableOpacity
              style={styles.reconnectButton}
              onPress={handleReconnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.reconnectText}>
                  Reconnect with {persistentRoom.partnerName}
                </Text>
              )}
            </TouchableOpacity>
          )}
          {onlineFriends.length > 0 && !showJoinInput && (
            <View style={styles.onlineFriendsRow}>
              {onlineFriends.slice(0, 3).map((friend) => (
                <TouchableOpacity
                  key={friend.uid}
                  style={styles.onlineFriendChip}
                  onPress={() => handleQuickConnect(friend.uid, friend.displayName)}
                  disabled={isLoading}
                >
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineFriendName} numberOfLines={1}>
                    {friend.displayName.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.startRoomButton}
            onPress={handleCreateRoom}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.startRoomText}>Start a Room</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.joinRoomButton}
            onPress={() => setShowJoinInput(true)}
            disabled={isLoading}
          >
            <Text style={styles.joinRoomText}>Join Room</Text>
          </TouchableOpacity>
          {showJoinInput && (
            <View style={styles.joinInputRow}>
              <TextInput
                style={styles.joinInput}
                placeholder="ENTER CODE"
                placeholderTextColor="#999"
                value={joinCode}
                onChangeText={(text) => setJoinCode(text.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                textContentType="none"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.joinGoButton, joinCode.length !== 6 && styles.buttonDisabled]}
                onPress={handleJoinRoom}
                disabled={isLoading || joinCode.length !== 6}
              >
                <Text style={styles.joinGoText}>Go</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {!showJoinInput && <LobbyNativeAd />}
      </KeyboardAvoidingView>
      <ShareModal
        visible={!!shareCode && !showingAd}
        roomCode={shareCode || ''}
        onClose={() => setShareCode(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 16,
  },
  lobbyContainer: {
    flex: 1,
    position: 'relative',
  },
  lobbyTopBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#1a293d',
  },
  lobbyBottomBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#f4dbc8',
  },
  lobbyImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lobbyImage: {
    width: '100%',
    height: '100%',
  },
  lobbyOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  lobbyTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  friendsBtn: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  friendsBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  signInBtn: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  signInBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  lobbyHeader: {
    alignItems: 'center',
    paddingTop: 8,
  },
  lobbyLogo: {
    width: 60,
    height: 56,
    tintColor: '#e8734a',
  },
  lobbyTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  lobbyTagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  lobbyButtons: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 12,
  },
  reconnectButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  reconnectText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  startRoomButton: {
    backgroundColor: '#e8734a',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  startRoomText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  joinRoomButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3d3d50',
  },
  joinRoomText: {
    color: '#3d3d50',
    fontSize: 18,
    fontWeight: '600',
  },
  joinInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  joinInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#1a293d',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 28,
  },
  joinGoButton: {
    backgroundColor: '#e8734a',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    justifyContent: 'center',
  },
  joinGoText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  onlineFriendsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  onlineFriendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  onlineFriendName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 80,
  },
});
