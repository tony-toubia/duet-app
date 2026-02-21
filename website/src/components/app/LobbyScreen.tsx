'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDuetStore } from '@/hooks/useDuetStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { ShareModal } from './ShareModal';
import { PreRollAd, type ImaAdDisplayContainer } from './PreRollAd';
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
  const [showingAd, setShowingAd] = useState(false);

  const adContainerRef = useRef<HTMLDivElement | null>(null);
  const adVideoRef = useRef<HTMLVideoElement | null>(null);
  const adDisplayContainerRef = useRef<ImaAdDisplayContainer | null>(null);

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
    if (roomCode && !showingAd) {
      router.push(`/app/room/${roomCode}`);
    }
  }, [roomCode, showingAd, router]);

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

  // --- IMA Pre-Roll Ad helpers ---

  const isAdEnabled = (): boolean => {
    const vastTag = process.env.NEXT_PUBLIC_IMA_VAST_TAG?.trim();
    return !!vastTag && !!window.google?.ima;
  };

  const initializeAdContainer = (): boolean => {
    try {
      const ima = window.google?.ima;
      if (!ima) return false;

      const containerDiv = document.createElement('div');
      containerDiv.id = 'ima-ad-container';
      containerDiv.style.cssText =
        'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'width:min(640px,90vw);height:min(360px,50vh);z-index:101;';
      document.body.appendChild(containerDiv);

      const videoEl = document.createElement('video');
      videoEl.playsInline = true;
      videoEl.style.cssText = 'width:100%;height:100%;background:#000;border-radius:12px;';
      containerDiv.appendChild(videoEl);

      const adDisplayContainer = new ima.AdDisplayContainer(containerDiv, videoEl);
      adDisplayContainer.initialize();

      adContainerRef.current = containerDiv;
      adVideoRef.current = videoEl;
      adDisplayContainerRef.current = adDisplayContainer;

      return true;
    } catch (err) {
      console.warn('[LobbyScreen] Failed to initialize IMA container:', err);
      return false;
    }
  };

  const cleanupAdElements = () => {
    if (adContainerRef.current) {
      adContainerRef.current.remove();
      adContainerRef.current = null;
    }
    adVideoRef.current = null;
    adDisplayContainerRef.current = null;
  };

  const handleAdComplete = useCallback(() => {
    cleanupAdElements();
    setShowingAd(false);
  }, []);

  // --- Room handlers ---

  const handleCreateRoom = async () => {
    setError(null);
    setIsLoading(true);

    const adReady = isAdEnabled() && initializeAdContainer();

    try {
      const code = await createRoom();
      setShareCode(code);

      if (adReady) {
        setShowingAd(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create room.');
      if (adReady) cleanupAdElements();
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

    const adReady = isAdEnabled() && initializeAdContainer();

    try {
      await joinRoom(code.toUpperCase());
      setShowJoinInput(false);

      if (adReady) {
        setShowingAd(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to join room.');
      if (adReady) cleanupAdElements();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="h-screen-safe bg-background flex flex-col items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div
        className="min-h-screen-safe bg-[#1a293d] bg-cover bg-no-repeat flex flex-col"
        style={{ backgroundImage: 'url(/duet-app-bg.jpg)', backgroundPosition: 'center 40%' }}
      >
        {/* Top bar */}
        <div className="flex justify-center w-full">
          <div className="w-full max-w-2xl flex items-center justify-between px-5 pt-4">
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

        {/* Logo — plays animated GIF once, then shows static logo */}
        <div className="text-center pt-6">
          <img
            src="/duet-logo-animated-once.gif"
            alt="Duet"
            className="w-[120px] h-[90px] mx-auto object-contain"
          />
        </div>

        <div className="flex-1" />

        {/* Buttons */}
        <div className="w-full max-w-sm mx-auto">
          <div className="px-6 pb-8 flex flex-col gap-3 w-full">
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
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  placeholder="ENTER CODE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoFocus
                  className="flex-1 min-w-0 bg-white/90 text-[#1a293d] text-base font-bold tracking-[2px] text-center py-3 px-3 rounded-full placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinWithCode(joinCode);
                  }}
                />
                <button
                  onClick={() => handleJoinWithCode(joinCode)}
                  disabled={isLoading || joinCode.length !== 6}
                  className="bg-primary text-white py-3 px-5 rounded-full text-base font-semibold disabled:opacity-50 hover:bg-primary-light transition-colors"
                >
                  Go
                </button>
              </div>
            )}
          </div>
        </div>

        <ShareModal
          visible={!!shareCode && !showingAd}
          roomCode={shareCode || ''}
          onClose={() => setShareCode(null)}
        />
      </div>

      {showingAd && adDisplayContainerRef.current && adVideoRef.current && adContainerRef.current && (
        <PreRollAd
          adDisplayContainer={adDisplayContainerRef.current}
          videoElement={adVideoRef.current}
          adContainerElement={adContainerRef.current}
          onComplete={handleAdComplete}
        />
      )}
    </>
  );
}
