import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDuetStore } from '@/hooks/useDuetStore';
import { adService } from '@/services/AdService';
import { DuetAudio } from '@/native/DuetAudio';
import { colors } from '@/theme';

const GUEST_SESSION_SECONDS = 20 * 60; // 20 minutes
const GRACE_PERIOD_SECONDS = 5 * 60; // 5 minutes before auto-leave
const WARNING_SECONDS = 120; // 2 minutes — play chime

interface GuestRoomTimerProps {
  onTimeExpired: () => void;
  onControlsLocked?: (locked: boolean) => void;
}

export const GuestRoomTimer = ({ onTimeExpired, onControlsLocked }: GuestRoomTimerProps) => {
  const isGuest = useAuthStore((s) => s.isGuest);
  const signOut = useAuthStore((s) => s.signOut);
  const setMuted = useDuetStore((s) => s.setMuted);
  const setDeafened = useDuetStore((s) => s.setDeafened);

  const [secondsLeft, setSecondsLeft] = useState(GUEST_SESSION_SECONDS);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(GRACE_PERIOD_SECONDS);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevAudioState = useRef<{ muted: boolean; deafened: boolean }>({ muted: false, deafened: false });
  const chimePlayedRef = useRef(false);

  const startCountdown = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    chimePlayedRef.current = false;

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

  const startGraceCountdown = () => {
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    setGraceSecondsLeft(GRACE_PERIOD_SECONDS);

    graceIntervalRef.current = setInterval(() => {
      setGraceSecondsLeft((prev) => {
        if (prev <= 1) {
          if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
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
      if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    };
  }, [isGuest]);

  // Play chime at 2-minute warning
  useEffect(() => {
    if (secondsLeft === WARNING_SECONDS && isGuest && !chimePlayedRef.current) {
      chimePlayedRef.current = true;
      try { DuetAudio.playChime(); } catch {}
    }
  }, [secondsLeft, isGuest]);

  // Handle timer expiry
  useEffect(() => {
    if (secondsLeft === 0 && isGuest && !showExpiredModal) {
      prevAudioState.current = {
        muted: useDuetStore.getState().isMuted,
        deafened: useDuetStore.getState().isDeafened,
      };
      setMuted(true);
      setDeafened(true);
      onControlsLocked?.(true);
      setShowExpiredModal(true);
      startGraceCountdown();
    }
  }, [secondsLeft, isGuest]);

  // Auto-leave when grace period expires
  useEffect(() => {
    if (graceSecondsLeft === 0 && showExpiredModal) {
      setShowExpiredModal(false);
      onControlsLocked?.(false);
      onTimeExpired();
    }
  }, [graceSecondsLeft, showExpiredModal]);

  const handleWatchAd = async () => {
    setIsLoadingAd(true);
    try {
      // Try interstitial first (pre-roll), fall back to rewarded
      if (adService.isPreRollReady) {
        await adService.showPreRoll();
      } else {
        const earned = await adService.showRewarded();
        if (!earned) {
          setIsLoadingAd(false);
          return;
        }
      }

      // Ad completed — restore session
      if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
      setMuted(prevAudioState.current.muted);
      setDeafened(prevAudioState.current.deafened);
      onControlsLocked?.(false);
      setSecondsLeft(GUEST_SESSION_SECONDS);
      setShowExpiredModal(false);
      startCountdown();
    } catch {
      // Ad failed — modal stays open
    } finally {
      setIsLoadingAd(false);
    }
  };

  const handleSignIn = () => {
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    onControlsLocked?.(false);
    setShowExpiredModal(false);
    signOut();
  };

  const handleLeaveRoom = () => {
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    onControlsLocked?.(false);
    setShowExpiredModal(false);
    onTimeExpired();
  };

  if (!isGuest) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeText = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const graceMinutes = Math.floor(graceSecondsLeft / 60);
  const graceSecs = graceSecondsLeft % 60;
  const graceText = `${graceMinutes}:${graceSecs.toString().padStart(2, '0')}`;

  const timerColor =
    secondsLeft <= 30
      ? colors.danger
      : secondsLeft <= WARNING_SECONDS
        ? colors.warning
        : colors.textMuted;

  const adReady = adService.isPreRollReady || adService.isRewardedReady;

  return (
    <>
      <View style={[styles.timerPill, { borderColor: timerColor }]}>
        <Text style={[styles.timerText, { color: timerColor }]}>{timeText}</Text>
      </View>

      <Modal
        visible={showExpiredModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Session Paused</Text>
            <Text style={styles.modalMessage}>
              Watch a short ad to continue your call, or sign in for unlimited time.
            </Text>

            <View style={styles.graceContainer}>
              <Text style={styles.graceLabel}>Auto-leaving in</Text>
              <Text style={styles.graceTimer}>{graceText}</Text>
            </View>

            <TouchableOpacity
              style={[styles.adButton, !adReady && styles.buttonDisabled]}
              onPress={handleWatchAd}
              disabled={!adReady || isLoadingAd}
            >
              {isLoadingAd ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.adButtonText}>
                  {adReady ? 'Watch Ad to Continue' : 'Ad Not Available'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
              <Text style={styles.leaveButtonText}>Leave Room</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#6b6b80',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  graceContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  graceLabel: {
    fontSize: 12,
    color: '#9a9aaa',
    marginBottom: 4,
  },
  graceTimer: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.danger,
    fontVariant: ['tabular-nums'],
  },
  adButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  adButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveButton: {
    backgroundColor: colors.danger,
    borderRadius: 20,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
