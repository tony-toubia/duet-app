import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Platform,
  ImageBackground,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
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
import { GuestRoomTimer } from '@/components/GuestRoomTimer';
import { ReactionBar } from '@/components/ReactionBar';
import { ReactionOverlay } from '@/components/ReactionOverlay';
import { ConnectionQualityIndicator } from '@/components/ConnectionQualityIndicator';
import { ShareModal } from '@/components/ShareModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { InviteModal } from '@/components/InviteModal';
import { colors } from '@/theme';
import type { RoomScreenProps } from '@/navigation/types';

const TABLET_MIN_WIDTH = 600;

export const RoomScreen = ({ navigation }: RoomScreenProps) => {
  const [mediaMinimized, setMediaMinimized] = useState(false);
  const [showAdTransition, setShowAdTransition] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false);
  const hasShownInitialShare = useRef(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const isLandscape = width > height;
  const useTwoColumn = isTablet && isLandscape;

  const {
    connectionState,
    webrtc,
    roomCode,
    roomDeleted,
    isHost,
    partnerId,
    isMuted,
    isDeafened,
    isSpeaking,
    isPartnerSpeaking,
    vadSensitivity,
    duckingEnabled,
    fromInvite,
    leaveRoom,
    setMuted,
    setDeafened,
    setVadSensitivity,
    setDuckingEnabled,
    setFromInvite,
  } = useDuetStore();

  const hasBeenConnected = useRef(false);
  const isLeaving = useRef(false);

  // Auto-show share modal when entering as host — skip if room was created via friend invite
  useEffect(() => {
    if (isHost && roomCode && !hasShownInitialShare.current && !fromInvite) {
      hasShownInitialShare.current = true;
      setShowShareModal(true);
    }
    if (fromInvite) {
      setFromInvite(false);
    }
  }, [isHost, roomCode]);

  useEffect(() => {
    if (connectionState === 'connected') {
      hasBeenConnected.current = true;
    }
  }, [connectionState]);

  // Navigate to lobby when room code is cleared (after leaveRoom)
  useEffect(() => {
    if (!roomCode && isLeaving.current) {
      navigation.replace('Lobby');
    }
  }, [roomCode, navigation]);

  // Auto-eject when room is deleted from Firebase
  useEffect(() => {
    if (roomDeleted && !isLeaving.current) {
      isLeaving.current = true;
      Alert.alert(
        'Room Closed',
        'This room is no longer available.',
        [{ text: 'OK', onPress: async () => {
          await leaveRoom();
          navigation.replace('Lobby');
        }}],
        { cancelable: false }
      );
    }
  }, [roomDeleted]);

  // Clean up on unmount (e.g., app termination, unexpected navigation)
  useEffect(() => {
    return () => {
      if (!isLeaving.current) {
        leaveRoom();
      }
    };
  }, []);

  const handleShareCode = () => {
    setShowShareModal(true);
  };

  const handleInviteFriend = () => {
    const friends = useFriendsStore.getState().acceptedFriends();
    if (friends.length === 0) {
      Alert.alert('No Friends', 'Add friends from the lobby to invite them to rooms.');
      return;
    }
    setShowInviteModal(true);
  };

  const handleSendInvite = (friendUid: string, friendName: string) => {
    setShowInviteModal(false);
    invitationService.sendInvitation(friendUid, roomCode!)
      .then(() => Alert.alert('Invited', `Invitation sent to ${friendName}!`))
      .catch((error: any) => Alert.alert('Error', error?.message || 'Failed to send invitation.'));
  };

  const handleLeave = () => {
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    if (isLeaving.current) return;
    isLeaving.current = true;
    setShowLeaveModal(false);
    const willShowAd = adService.willShowInterstitial();
    await leaveRoom();
    if (willShowAd) {
      setShowAdTransition(true);
      await new Promise((r) => setTimeout(r, 1500));
    }
    await adService.onRoomLeave();
    navigation.replace('Lobby');
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

  // While leaving, show nothing (effect will navigate to Lobby)
  if (!roomCode) {
    return null;
  }

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={handleShareCode} style={styles.roomIdContainer}>
        <View style={[styles.statusDot, { backgroundColor: getConnectionColor() }]} />
        <Text style={styles.roomIdText}>{roomCode}</Text>
      </TouchableOpacity>
      <Text style={[styles.connectionText, { color: getConnectionColor() }]}>
        {getConnectionText()}
      </Text>
      <ConnectionQualityIndicator webrtc={webrtc} />
      <GuestRoomTimer onTimeExpired={handleLeave} onControlsLocked={setControlsLocked} />
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
        style={[styles.actionBtn, isMuted && styles.actionBtnActive, controlsLocked && styles.actionBtnLocked]}
        onPress={() => !controlsLocked && setMuted(!isMuted)}
        disabled={controlsLocked}
      >
        <Text style={styles.actionIcon}>{isMuted ? '\ud83d\udd07' : '\ud83c\udfa4'}</Text>
        <Text style={styles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, isDeafened && styles.actionBtnActive, controlsLocked && styles.actionBtnLocked]}
        onPress={() => !controlsLocked && setDeafened(!isDeafened)}
        disabled={controlsLocked}
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

  const handleWatchRewardedAd = async () => {
    const earned = await adService.showRewarded();
    if (earned) {
      Alert.alert('Ad-Free!', 'You have 1 hour of ad-free rooms. Enjoy!');
    }
  };

  const rewardedAdButton = adService.isRewardedReady && !adService.isAdFree ? (
    <TouchableOpacity style={styles.rewardedAdBtn} onPress={handleWatchRewardedAd}>
      <Text style={styles.rewardedAdText}>Watch ad for 1hr ad-free</Text>
    </TouchableOpacity>
  ) : null;

  const adTransitionOverlay = showAdTransition ? (
    <View style={styles.adTransition}>
      <ActivityIndicator size="large" color={colors.text} />
      <Text style={styles.adTransitionText}>A short ad will play next</Text>
      <Text style={styles.adTransitionSub}>Thanks for using Duet!</Text>
    </View>
  ) : null;

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
              <ReactionBar />
            </View>
            <View style={styles.twoColRight}>
              <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />
              <RoomNativeAd />
              {rewardedAdButton}
              {duckingToggle}
              {mediaPlayer}
              <NavigationWidget />
            </View>
          </View>
          <View style={{ height: insets.bottom }} />
          <ReactionOverlay />
          {adTransitionOverlay}
          <ShareModal
            visible={showShareModal}
            roomCode={roomCode}
            onClose={() => setShowShareModal(false)}
          />
          <ConfirmModal
            visible={showLeaveModal}
            title="Leave Room"
            message="Are you sure you want to disconnect?"
            buttons={[
              { text: 'Leave', style: 'destructive', onPress: handleConfirmLeave },
              { text: 'Cancel', style: 'cancel', onPress: () => setShowLeaveModal(false) },
            ]}
            onClose={() => setShowLeaveModal(false)}
          />
          <InviteModal
            visible={showInviteModal}
            friends={useFriendsStore.getState().acceptedFriends().slice(0, 10)}
            onInvite={handleSendInvite}
            onClose={() => setShowInviteModal(false)}
          />
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
          <ReactionBar />
          <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />
          <RoomNativeAd />
          {rewardedAdButton}
          {duckingToggle}
          {mediaPlayer}
          <NavigationWidget />
        </ScrollView>
        <ReactionOverlay />
        {adTransitionOverlay}
        <ShareModal
          visible={showShareModal}
          roomCode={roomCode}
          onClose={() => setShowShareModal(false)}
        />
        <ConfirmModal
          visible={showLeaveModal}
          title="Leave Room"
          message="Are you sure you want to disconnect?"
          buttons={[
            { text: 'Leave', style: 'destructive', onPress: handleConfirmLeave },
            { text: 'Cancel', style: 'cancel', onPress: () => setShowLeaveModal(false) },
          ]}
          onClose={() => setShowLeaveModal(false)}
        />
        <InviteModal
          visible={showInviteModal}
          friends={useFriendsStore.getState().acceptedFriends().slice(0, 10)}
          onInvite={handleSendInvite}
          onClose={() => setShowInviteModal(false)}
        />
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
  actionBtnLocked: {
    opacity: 0.4,
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
  adTransition: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 40, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  adTransitionText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  adTransitionSub: {
    color: colors.textMuted,
    fontSize: 13,
  },
  rewardedAdBtn: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  rewardedAdText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: '500',
  },
});
