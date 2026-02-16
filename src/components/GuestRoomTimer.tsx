import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDuetStore } from '@/hooks/useDuetStore';
import { adService } from '@/services/AdService';
import { ConfirmModal } from '@/components/ConfirmModal';
import { colors } from '@/theme';

const GUEST_SESSION_SECONDS = 20 * 60; // 20 minutes

interface GuestRoomTimerProps {
  onTimeExpired: () => void;
}

export const GuestRoomTimer = ({ onTimeExpired }: GuestRoomTimerProps) => {
  const isGuest = useAuthStore((s) => s.isGuest);
  const signOut = useAuthStore((s) => s.signOut);
  const setMuted = useDuetStore((s) => s.setMuted);
  const setDeafened = useDuetStore((s) => s.setDeafened);

  const [secondsLeft, setSecondsLeft] = useState(GUEST_SESSION_SECONDS);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevAudioState = useRef<{ muted: boolean; deafened: boolean }>({ muted: false, deafened: false });

  const startCountdown = () => {
    intervalRef.current = setInterval(() => {
      const currentState = useDuetStore.getState().connectionState;
      if (currentState !== 'connected') return;

      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!isGuest) return;
    startCountdown();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGuest]);

  // Show modal when timer reaches 0
  useEffect(() => {
    if (secondsLeft === 0 && isGuest && !showExpiredModal) {
      prevAudioState.current = {
        muted: useDuetStore.getState().isMuted,
        deafened: useDuetStore.getState().isDeafened,
      };
      setMuted(true);
      setDeafened(true);
      setShowExpiredModal(true);
    }
  }, [secondsLeft, isGuest]);

  const handleWatchAd = async () => {
    const earned = await adService.showRewarded();
    if (earned) {
      setMuted(prevAudioState.current.muted);
      setDeafened(prevAudioState.current.deafened);
      setSecondsLeft(GUEST_SESSION_SECONDS);
      setShowExpiredModal(false);

      Alert.alert(
        'Session Extended!',
        'You\'ve earned 20 more minutes. Enjoy your call!',
        [{ text: 'OK' }],
      );

      startCountdown();
    }
    // If ad failed/dismissed, modal stays open
  };

  const handleSignIn = () => {
    setShowExpiredModal(false);
    signOut();
  };

  const handleLeaveRoom = () => {
    setShowExpiredModal(false);
    onTimeExpired();
  };

  if (!isGuest) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeText = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const timerColor =
    secondsLeft <= 30
      ? colors.danger
      : secondsLeft <= 120
        ? colors.warning
        : colors.textMuted;

  return (
    <>
      <View style={[styles.timerPill, { borderColor: timerColor }]}>
        <Text style={[styles.timerText, { color: timerColor }]}>{timeText}</Text>
      </View>
      <ConfirmModal
        visible={showExpiredModal}
        title="Session Expired"
        message="Guest sessions are limited to 20 minutes. Watch a short ad to continue, or sign in for unlimited time."
        buttons={[
          { text: 'Watch Ad', style: 'default', onPress: handleWatchAd },
          { text: 'Sign In', style: 'default', onPress: handleSignIn },
          { text: 'Leave Room', style: 'destructive', onPress: handleLeaveRoom },
        ]}
        onClose={() => {}}
      />
    </>
  );
};

const styles = StyleSheet.create({
  timerPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
