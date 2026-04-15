'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ref, get as firebaseGet } from 'firebase/database';
import { useDuetStore } from '@/hooks/useDuetStore';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useFriendsStore } from '@/hooks/useFriendsStore';
import { invitationService } from '@/services/InvitationService';
import { firebaseAuth, firebaseDb } from '@/services/firebase';
import { ShareModal } from './ShareModal';
import { MatchBanner } from './MatchBanner';
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

  const { roomCode, initialize, createRoom, joinRoom, createPartyRoom } = useDuetStore();
  const userProfile = useAuthStore((s) => s.userProfile);
  const isGuest = useAuthStore((s) => s.isGuest);
  const promptUpgrade = useAuthStore((s) => s.promptUpgrade);

  // Online friends for quick connect
  const acceptedFriends = useFriendsStore((s) => s.acceptedFriends);
  const statuses = useFriendsStore((s) => s.statuses);

  // Subscribe to friends on mount
  useEffect(() => {
    const unsub = useFriendsStore.getState().subscribe();
    return unsub;
  }, []);

  const currentUid = firebaseAuth.currentUser?.uid;

  const onlineFriends = acceptedFriends().filter(
    (f) => f.uid !== currentUid && statuses[f.uid]?.state === 'online'
  );

  // Persistent room for quick reconnect
  const [persistentRoom, setPersistentRoom] = useState<{
    partnerUid: string;
    partnerName: string;
    partnerAvatar?: string | null;
  } | null>(null);

  // Fetch persistent room entry when initialized
  useEffect(() => {
    if (!isInitialized) return;
    const user = firebaseAuth.currentUser;
    if (!user) return;
    firebaseGet(ref(firebaseDb, `/users/${user.uid}/persistentRoom`))
      .then((snap) => {
        const data = snap.val();
        if (data && data.partnerUid && data.partnerName && data.partnerUid !== user.uid) {
          setPersistentRoom(data);
        }
      })
      .catch((e) => console.warn('[Lobby] Failed to load persistent room:', e));
  }, [isInitialized]);

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

  // --- Room handlers ---

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

  const handleCreatePartyRoom = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const code = await createPartyRoom();
      setShareCode(code);
    } catch (err: any) {
      setError(err?.message || 'Failed to create party room.');
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

  const handleQuickConnect = async (friendUid: string, friendName: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const code = await createRoom();
      await invitationService.sendInvitation(friendUid, code);
      setShareCode(code);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconnect = async () => {
    if (!persistentRoom) return;
    setError(null);
    setIsLoading(true);
    try {
      const code = await createRoom();
      await invitationService.sendInvitation(persistentRoom.partnerUid, code);
      setShareCode(code);
    } catch (err: any) {
      setError(err?.message || 'Failed to reconnect. Please try again.');
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
            <button
              onClick={() => router.push('/app/hub')}
              className="bg-glass border border-glass-border rounded-2xl py-1.5 px-3.5 text-text-main text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Hub
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

        <MatchBanner />

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

            {/* Persistent room reconnect */}
            {persistentRoom && (
              <button
                onClick={handleReconnect}
                disabled={isLoading}
                className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : `Reconnect with ${persistentRoom.partnerName}`}
              </button>
            )}

            {/* Online friends quick connect */}
            {onlineFriends.length > 0 && !showJoinInput && (
              <div className="flex flex-row gap-2 justify-center flex-wrap">
                {onlineFriends.slice(0, 3).map((friend) => (
                  <button
                    key={friend.uid}
                    onClick={() => handleQuickConnect(friend.uid, friend.displayName)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full py-2 px-3.5 hover:bg-white/25 transition-colors disabled:opacity-50"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#4ade80]" />
                    <span className="text-white text-sm font-medium max-w-[80px] truncate">
                      {friend.displayName.split(' ')[0]}
                    </span>
                  </button>
                ))}
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
              onClick={handleCreatePartyRoom}
              disabled={isLoading}
              className="bg-[#4ade80] text-white py-4 rounded-full text-lg font-semibold hover:bg-[#22c55e] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Start a Watch Party'}
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
          visible={!!shareCode}
          roomCode={shareCode || ''}
          onClose={() => setShareCode(null)}
        />
      </div>
  );
}

