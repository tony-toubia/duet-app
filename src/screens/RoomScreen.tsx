import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Switch,
  Platform,
  ImageBackground,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDuetStore } from '@/hooks/useDuetStore';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { invitationService } from '@/services/InvitationService';
import { adService } from '@/services/AdService';
import { AvatarCircle } from '@/components/AvatarCircle';
import { MediaPlayer } from '@/components/MediaPlayer';
import { VoiceSensitivity } from '@/components/VoiceSensitivity';
import { NavigationWidget } from '@/components/NavigationWidget';
import { RoomNativeAd } from '@/components/RoomNativeAd';
import { colors } from '@/theme';
import type { RoomScreenProps } from '@/navigation/types';

const TABLET_MIN_WIDTH = 600;

export const RoomScreen = ({ navigation }: RoomScreenProps) => {
  const [mediaMinimized, setMediaMinimized] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const isLandscape = width > height;
  const useTwoColumn = isTablet && isLandscape;

  const {
    connectionState,
    roomCode,
    partnerId,
    isMuted,
    isDeafened,
    isSpeaking,
    isPartnerSpeaking,
    vadSensitivity,
    duckingEnabled,
    leaveRoom,
    setMuted,
    setDeafened,
    setVadSensitivity,
    setDuckingEnabled,
  } = useDuetStore();

  const hasBeenConnected = useRef(false);

  useEffect(() => {
    if (connectionState === 'connected') {
      hasBeenConnected.current = true;
    }
  }, [connectionState]);

  // Clean up on unmount (e.g., app termination)
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  // If no room code, go back to lobby
  if (!roomCode) {
    navigation.replace('Lobby');
    return null;
  }

  const shareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join me on Duet! Enter code: ${code}`,
      });
    } catch (error) {
      console.log('Share cancelled');
    }
  };

  const handleInviteFriend = () => {
    const friends = useFriendsStore.getState().acceptedFriends();
    if (friends.length === 0) {
      Alert.alert('No Friends', 'Add friends from the lobby to invite them to rooms.');
      return;
    }

    const buttons: Array<{ text: string; onPress?: () => void; style?: string }> = friends.slice(0, 5).map((friend) => ({
      text: friend.displayName,
      onPress: () => {
        invitationService.sendInvitation(friend.uid, roomCode!)
          .then(() => Alert.alert('Invited', `Invitation sent to ${friend.displayName}!`))
          .catch((error: any) => Alert.alert('Error', error?.message || 'Failed to send invitation.'));
      },
    }));
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Invite Friend', 'Choose a friend to invite:', buttons as any);
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveRoom();
            await adService.onRoomLeave();
            navigation.replace('Lobby');
          },
        },
      ]
    );
  };

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected': return colors.success;
      case 'connecting':
      case 'reconnecting': return colors.warning;
      case 'failed': return colors.danger;
      default:
        if (hasBeenConnected.current && !partnerId) return colors.danger;
        return colors.warning;
    }
  };

  const getConnectionText = () => {
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'failed': return 'Connection Failed';
      default:
        if (hasBeenConnected.current && !partnerId) return 'Partner left';
        return 'Waiting for partner...';
    }
  };

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => shareCode(roomCode)} style={styles.roomIdContainer}>
        <View style={[styles.statusDot, { backgroundColor: getConnectionColor() }]} />
        <Text style={styles.roomIdText}>{roomCode}</Text>
      </TouchableOpacity>
      <Text style={[styles.connectionText, { color: getConnectionColor() }]}>
        {getConnectionText()}
      </Text>
      <TouchableOpacity onPress={handleLeave} style={styles.leaveBtn}>
        <Text style={styles.leaveBtnText}>Leave</Text>
      </TouchableOpacity>
    </View>
  );

  const avatars = (
    <View style={styles.avatarsRow}>
      <AvatarCircle label="You" initials="Y" isSpeaking={isSpeaking} isMuted={isMuted} />
      <AvatarCircle label="Partner" initials="P" isSpeaking={isPartnerSpeaking} isDeafened={isDeafened} />
    </View>
  );

  const actionButtons = (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.actionBtn, isMuted && styles.actionBtnActive]}
        onPress={() => setMuted(!isMuted)}
      >
        <Text style={styles.actionIcon}>{isMuted ? '\ud83d\udd07' : '\ud83c\udfa4'}</Text>
        <Text style={styles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, isDeafened && styles.actionBtnActive]}
        onPress={() => setDeafened(!isDeafened)}
      >
        <Text style={styles.actionIcon}>{isDeafened ? '\ud83d\udd15' : '\ud83d\udd0a'}</Text>
        <Text style={styles.actionLabel}>{isDeafened ? 'Undeafen' : 'Deafen'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={handleInviteFriend}
      >
        <Text style={styles.actionIcon}>{'\ud83d\udc65'}</Text>
        <Text style={styles.actionLabel}>Invite</Text>
      </TouchableOpacity>
    </View>
  );

  const duckingToggle = Platform.OS === 'ios' ? (
    <View style={styles.duckingCard}>
      <View style={styles.duckingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.duckingTitle}>Lower other audio</Text>
          <Text style={styles.duckingWarning}>Some apps may pause instead</Text>
        </View>
        <Switch
          value={duckingEnabled}
          onValueChange={setDuckingEnabled}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.primary }}
          thumbColor={colors.text}
        />
      </View>
    </View>
  ) : null;

  const mediaPlayer = (
    <MediaPlayer minimized={mediaMinimized} onToggleMinimized={() => setMediaMinimized(!mediaMinimized)} />
  );

  // Tablet two-column layout
  if (useTwoColumn) {
    return (
      <ImageBackground
        source={require('../../assets/duet-room-bg.png')}
        style={styles.roomBg}
        resizeMode="cover"
      >
        <View style={styles.roomOverlay}>
          <StatusBar style="light" />
          {topBar}
          <View style={styles.twoColContainer}>
            <View style={styles.twoColLeft}>
              {avatars}
              {actionButtons}
            </View>
            <View style={styles.twoColRight}>
              <RoomNativeAd />
              <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />
              {duckingToggle}
              {mediaPlayer}
              <NavigationWidget />
            </View>
          </View>
          <View style={{ height: insets.bottom }} />
        </View>
      </ImageBackground>
    );
  }

  // Single-column phone layout
  return (
    <ImageBackground
      source={require('../../assets/duet-room-bg.png')}
      style={styles.roomBg}
      resizeMode="cover"
    >
      <View style={styles.roomOverlay}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[styles.roomScroll, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {topBar}
          {avatars}
          {actionButtons}
          <RoomNativeAd />
          <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />
          {duckingToggle}
          {mediaPlayer}
          <NavigationWidget />
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  roomBg: {
    flex: 1,
  },
  roomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 40, 0.55)',
  },
  roomScroll: {
    flexGrow: 1,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  roomIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  roomIdText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  connectionText: {
    fontSize: 12,
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  leaveBtnText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(232, 115, 74, 0.25)',
    borderColor: colors.primary,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  duckingCard: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  duckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duckingTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  duckingWarning: {
    color: colors.warning,
    fontSize: 11,
    marginTop: 2,
  },
  twoColContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  twoColLeft: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  twoColRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
});
