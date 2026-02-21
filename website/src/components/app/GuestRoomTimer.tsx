'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDuetStore } from '@/hooks/useDuetStore';
import { adService } from '@/services/AdService';

const GUEST_ROOM_DURATION = 20 * 60; // 20 minutes
const GRACE_PERIOD_SECONDS = 5 * 60; // 5 minutes before auto-leave
const WARNING_SECONDS = 120; // 2 minutes — play chime

function playWarningChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880; // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

interface GuestRoomTimerProps {
  partnerJoined: boolean;
  onTimeExpired: () => void;
  onControlsLocked?: (locked: boolean) => void;
}

export function GuestRoomTimer({ partnerJoined, onTimeExpired, onControlsLocked }: GuestRoomTimerProps) {
  const isGuest = useAuthStore((s) => s.isGuest);
  const signOut = useAuthStore((s) => s.signOut);
  const setMuted = useDuetStore((s) => s.setMuted);
  const setDeafened = useDuetStore((s) => s.setDeafened);

  const [secondsLeft, setSecondsLeft] = useState(GUEST_ROOM_DURATION);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(GRACE_PERIOD_SECONDS);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const graceTimerRef = useRef<ReturnType<typeof setInterval>>();
  const timerStarted = useRef(false);
  const chimePlayedRef = useRef(false);
  const prevAudioState = useRef({ muted: false, deafened: false });

  const startCountdown = () => {
    clearInterval(timerRef.current);
    chimePlayedRef.current = false;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startGraceCountdown = () => {
    clearInterval(graceTimerRef.current);
    setGraceSecondsLeft(GRACE_PERIOD_SECONDS);

    graceTimerRef.current = setInterval(() => {
      setGraceSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(graceTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Only start the timer once a partner has joined
  useEffect(() => {
    if (!isGuest || !partnerJoined || timerStarted.current) return;
    timerStarted.current = true;
    startCountdown();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(graceTimerRef.current);
    };
  }, [isGuest, partnerJoined]);

  // Play chime at 2-minute warning
  useEffect(() => {
    if (secondsLeft === WARNING_SECONDS && isGuest && !chimePlayedRef.current) {
      chimePlayedRef.current = true;
      playWarningChime();
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

  if (!isGuest) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isWarning = secondsLeft <= WARNING_SECONDS && secondsLeft > 30;
  const isDanger = secondsLeft <= 30;

  const graceMinutes = Math.floor(graceSecondsLeft / 60);
  const graceSecs = graceSecondsLeft % 60;
  const graceText = `${graceMinutes}:${graceSecs.toString().padStart(2, '0')}`;

  const adReady = adService.isPreRollReady || adService.isRewardedReady;

  const handleWatchAd = async () => {
    setIsLoadingAd(true);
    try {
      const earned = await adService.showRewarded();
      if (earned) {
        clearInterval(graceTimerRef.current);
        setMuted(prevAudioState.current.muted);
        setDeafened(prevAudioState.current.deafened);
        onControlsLocked?.(false);
        setSecondsLeft(GUEST_ROOM_DURATION);
        setShowExpiredModal(false);
        startCountdown();
      }
    } catch {
      // Ad failed — modal stays open
    } finally {
      setIsLoadingAd(false);
    }
  };

  const handleSignIn = async () => {
    clearInterval(graceTimerRef.current);
    onControlsLocked?.(false);
    setShowExpiredModal(false);
    await signOut();
  };

  const handleLeave = () => {
    clearInterval(graceTimerRef.current);
    onControlsLocked?.(false);
    setShowExpiredModal(false);
    onTimeExpired();
  };

  return (
    <>
      <span className={`text-xs font-mono ${isDanger ? 'text-danger' : isWarning ? 'text-warning' : 'text-text-muted'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>

      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl">
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Session Paused</h2>
            <p className="text-sm text-[#6b6b80] mb-4">
              Watch a short ad to continue your call, or sign in for unlimited time.
            </p>

            <div className="mb-5">
              <p className="text-xs text-[#9a9aaa] mb-1">Auto-leaving in</p>
              <p className="text-3xl font-bold text-danger font-mono">{graceText}</p>
            </div>

            <button
              onClick={handleWatchAd}
              disabled={!adReady || isLoadingAd}
              className="bg-primary text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {isLoadingAd ? 'Loading...' : adReady ? 'Watch Ad to Continue' : 'Ad Not Available'}
            </button>
            <button
              onClick={handleSignIn}
              className="bg-primary text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-primary-light transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleLeave}
              className="bg-danger text-white rounded-2xl py-3.5 w-full font-bold text-base hover:bg-red-600 transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      )}
    </>
  );
}
