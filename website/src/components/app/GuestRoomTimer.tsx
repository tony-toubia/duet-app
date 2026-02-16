'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { adService } from '@/services/AdService';

const GUEST_ROOM_DURATION = 20 * 60; // 20 minutes in seconds

interface GuestRoomTimerProps {
  partnerJoined: boolean;
  onTimeExpired: () => void;
}

export function GuestRoomTimer({ partnerJoined, onTimeExpired }: GuestRoomTimerProps) {
  const isGuest = useAuthStore((s) => s.isGuest);
  const signOut = useAuthStore((s) => s.signOut);
  const [secondsLeft, setSecondsLeft] = useState(GUEST_ROOM_DURATION);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const timerStarted = useRef(false);

  // Only start the timer once a partner has joined (matches mobile behavior)
  useEffect(() => {
    if (!isGuest || !partnerJoined || timerStarted.current) return;

    timerStarted.current = true;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isGuest, partnerJoined]);

  useEffect(() => {
    if (secondsLeft === 0 && isGuest) {
      setShowExpiredModal(true);
    }
  }, [secondsLeft, isGuest]);

  if (!isGuest) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isLow = secondsLeft < 300; // Under 5 min

  const handleWatchAd = async () => {
    const earned = await adService.showRewarded();
    if (earned) {
      setSecondsLeft(GUEST_ROOM_DURATION);
      setShowExpiredModal(false);
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleSignIn = async () => {
    setShowExpiredModal(false);
    await signOut();
  };

  const handleLeave = () => {
    setShowExpiredModal(false);
    onTimeExpired();
  };

  return (
    <>
      <span className={`text-xs font-mono ${isLow ? 'text-danger' : 'text-text-muted'}`}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>

      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl">
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Session Expired</h2>
            <p className="text-sm text-[#6b6b80] mb-6">
              Your guest session has ended. Sign in for unlimited time, or extend your session.
            </p>
            <button
              onClick={handleWatchAd}
              className="bg-primary text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-primary-light transition-colors"
            >
              Extend Session
            </button>
            <button
              onClick={handleSignIn}
              className="bg-primary text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-primary-light transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleLeave}
              className="bg-danger text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-red-600 transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      )}
    </>
  );
}
