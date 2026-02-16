import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDuetStore } from '@/hooks/useDuetStore';
import { adService } from '@/services/AdService';
import { colors } from '@/theme';

const GUEST_SESSION_SECONDS = 20 * 60; // 20 minutes

interface GuestRoomTimerProps {
  onTimeExpired: () => void;
}

export const GuestRoomTimer = ({ onTimeExpired }: GuestRoomTimerProps) => {
  const isGuest = useAuthStore((s) => s.isGuest);
  const signOut = useAuthStore((s) => s.signOut);
  const connectionState = useDuetStore((s) => s.connectionState);
  const setMuted = useDuetStore((s) => s.setMuted);
  const setDeafened = useDuetStore((s) => s.setDeafened);

  const [secondsLeft, setSecondsLeft] = useState(GUEST_SESSION_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isShowingAlert = useRef(false);

  useEffect(() => {
    if (!isGuest) return;

    intervalRef.current = setInterval(() => {
      // Only count down when connected to a partner
      const currentState = useDuetStore.getState().connectionState;
      if (currentState !== 'connected') return;

      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (!isShowingAlert.current) {
            handleTimeExpired();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGuest]);

  const handleTimeExpired = async () => {
    isShowingAlert.current = true;

    // Save current audio state
    const prevMuted = useDuetStore.getState().isMuted;
    const prevDeafened = useDuetStore.getState().isDeafened;

    // Force mute + deafen during ad
    setMuted(true);
    setDeafened(true);

    showExpiryAlert(prevMuted, prevDeafened);
  };

  const showExpiryAlert = (prevMuted: boolean, prevDeafened: boolean) => {
    const buttons: any[] = [
      {
        text: 'Watch Ad',
        onPress: async () => {
          const earned = await adService.showRewarded();
          if (earned) {
            // Restore audio state and reset timer
            setMuted(prevMuted);
            setDeafened(prevDeafened);
            setSecondsLeft(GUEST_SESSION_SECONDS);
            isShowingAlert.current = false;

            // Restart the countdown
            intervalRef.current = setInterval(() => {
              const currentState = useDuetStore.getState().connectionState;
              if (currentState !== 'connected') return;

              setSecondsLeft((prev) => {
                if (prev <= 1) {
                  if (intervalRef.current) clearInterval(intervalRef.current);
                  if (!isShowingAlert.current) {
                    handleTimeExpired();
                  }
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          } else {
            // Ad dismissed early or failed — re-show alert
            showExpiryAlert(prevMuted, prevDeafened);
          }
        },
      },
      {
        text: 'Sign In',
        onPress: () => {
          isShowingAlert.current = false;
          signOut();
        },
      },
      {
        text: 'Leave Room',
        style: 'destructive',
        onPress: () => {
          isShowingAlert.current = false;
          onTimeExpired();
        },
      },
    ];

    Alert.alert(
      'Session Expired',
      'Guest sessions are limited to 20 minutes. Watch a short ad to continue, or sign in for unlimited time.',
      buttons,
      { cancelable: false },
    );
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
    <View style={[styles.timerPill, { borderColor: timerColor }]}>
      <Text style={[styles.timerText, { color: timerColor }]}>{timeText}</Text>
    </View>
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
