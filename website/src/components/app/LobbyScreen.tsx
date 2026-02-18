'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDuetStore } from '@/hooks/useDuetStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { ShareModal } from './ShareModal';
import { AdSlot } from './AdSlot';
import { Spinner } from '@/components/ui/Spinner';

export function LobbyScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isInitialized, setIsInitialized] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { roomCode, initialize, createRoom, joinRoom } = useDuetStore();
  const userProfile = useAuthStore((s) => s.userProfile);
  const isGuest = useAuthStore((s) => s.isGuest);
  const promptUpgrade = useAuthStore((s) => s.promptUpgrade);

  // Show notice from query params (e.g., after room deletion)
  useEffect(() => {
    const noticeParam = searchParams.get('notice');
    if (noticeParam === 'room_closed') {
      setNotice('The room was closed.');
      // Clean up the URL
      router.replace('/app');
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (roomCode) {
      router.push(`/app/room/${roomCode}`);
    }
  }, [roomCode, router]);

  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
        setIsInitialized(true);
      } catch (err: any) {
        setError(err?.message || 'Failed to initialize. Please refresh.');
      }
    };
    init();
  }, [initialize]);

  const handleCreateRoom = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const code = await createRoom();
      setShareCode(code);
    } catch (err: any) {
      setError(err?.message || 'Failed to create room.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWithCode = async (code: string) => {
    if (code.length !== 6) {
      setError('Please enter a 6-character room code.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await joinRoom(code.toUpperCase());
      setShowJoinInput(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to join room.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="h-screen-safe bg-background flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="text-text-muted mt-4">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="h-screen-safe relative overflow-hidden bg-[#1a293d]">
      {/* Background image: scales to viewport height, width follows aspect ratio, max 600px */}
      <div className="absolute inset-0 flex justify-center overflow-hidden">
        <img src="/duet-home-bg.png" alt="" className="h-full w-auto max-w-[560px] object-top" />
      </div>

      {/* Top bar — wider than content frame, sits at image edges */}
      <div className="absolute inset-x-0 top-0 z-20 flex justify-center">
        <div className="w-full sm:max-w-[540px] flex items-center justify-between px-5 sm:px-4 pt-4">
          <button
            onClick={() => router.push('/app/friends')}
            className="bg-glass border border-glass-border rounded-2xl py-1.5 px-3.5 text-text-main text-sm font-medium hover:bg-white/20 transition-colors"
          >
            Friends
          </button>
          <div className="flex-1" />
          {isGuest ? (
            <button
              onClick={() => promptUpgrade()}
              className="bg-glass border border-primary rounded-2xl py-1.5 px-3.5 text-primary text-sm font-semibold"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => router.push('/app/profile')}
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold"
            >
              {userProfile?.displayName?.charAt(0)?.toUpperCase() || 'P'}
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex justify-center">
        <div className="relative w-full sm:max-w-[280px] h-full flex flex-col">

        {/* Logo */}
        <div className="text-center pt-2">
          <img
            src="/duet-logo.png"
            alt="Duet"
            className="w-[60px] h-[56px] mx-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(55%) sepia(80%) saturate(500%) hue-rotate(340deg)' }}
          />
        </div>

        <div className="flex-1" />

        {/* Ad */}
        {process.env.NEXT_PUBLIC_AD_SLOT_LOBBY && (
          <div className="px-6 sm:px-3 mb-4 w-full">
            <AdSlot adSlot={process.env.NEXT_PUBLIC_AD_SLOT_LOBBY} format="rectangle" />
          </div>
        )}

        {/* Buttons */}
        <div className="px-6 sm:px-3 pb-8 flex flex-col gap-3 w-full">
          {notice && (
            <div className="bg-warning/15 border border-warning/30 rounded-xl px-4 py-3 text-sm text-warning">
              {notice}
            </div>
          )}
          {error && (
            <div className="bg-danger/15 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Start a Room'}
          </button>

          <button
            onClick={() => setShowJoinInput(true)}
            disabled={isLoading}
            className="bg-transparent text-[#3d3d50] py-4 rounded-full text-lg font-semibold border-2 border-[#3d3d50] hover:bg-[#3d3d50]/10 transition-colors"
          >
            Join Room
          </button>

          {showJoinInput && (
            <div className="flex gap-2 sm:gap-2 mt-1">
              <input
                type="text"
                placeholder="ENTER CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
                className="flex-1 min-w-0 bg-white/90 text-[#1a293d] text-lg sm:text-base font-bold tracking-[3px] sm:tracking-[2px] text-center py-3 sm:py-2.5 px-3 sm:px-2 rounded-full placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-base sm:placeholder:text-sm placeholder:font-normal outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinWithCode(joinCode);
                }}
              />
              <button
                onClick={() => handleJoinWithCode(joinCode)}
                disabled={isLoading || joinCode.length !== 6}
                className="bg-primary text-white py-3 sm:py-2.5 px-5 sm:px-4 rounded-full text-lg sm:text-base font-semibold disabled:opacity-50 hover:bg-primary-light transition-colors"
              >
                Go
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      <ShareModal
        visible={!!shareCode}
        roomCode={shareCode || ''}
        onClose={() => setShareCode(null)}
      />
    </div>
  );
}
