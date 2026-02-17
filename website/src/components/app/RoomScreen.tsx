'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDuetStore } from '@/hooks/useDuetStore';
import { ShareModal } from './ShareModal';
import { GuestRoomTimer } from './GuestRoomTimer';
import { AdSlot } from './AdSlot';

function AvatarCircle({
  label,
  initials,
  isSpeaking,
  isMuted,
  isDeafened,
}: {
  label: string;
  initials: string;
  isSpeaking: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Pulse rings */}
        {isSpeaking && (
          <>
            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '1.5s' }} />
            <div className="absolute -inset-2 rounded-full bg-primary/15 animate-pulse" style={{ animationDuration: '2s' }} />
          </>
        )}
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white transition-all duration-300 ${
            isSpeaking ? 'bg-primary scale-110' : 'bg-glass border border-glass-border'
          }`}
        >
          {isMuted ? '\ud83d\udd07' : isDeafened ? '\ud83d\udd15' : initials}
        </div>
      </div>
      <span className="text-text-muted text-xs font-medium">{label}</span>
    </div>
  );
}

function VoiceSensitivity({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const levels = [20, 35, 50, 65, 80];
  const currentIndex = levels.indexOf(value) !== -1 ? levels.indexOf(value) : 2;

  const decrease = () => {
    if (currentIndex > 0) onChange(levels[currentIndex - 1]);
  };

  const increase = () => {
    if (currentIndex < levels.length - 1) onChange(levels[currentIndex + 1]);
  };

  return (
    <div className="bg-glass border border-glass-border rounded-2xl mx-5 py-3 px-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-main text-xs font-medium">Voice Sensitivity</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={decrease}
          className="w-8 h-8 rounded-full bg-white/10 border border-glass-border text-text-main text-lg font-bold flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          -
        </button>
        <div className="flex-1 flex gap-1.5">
          {levels.map((level, i) => (
            <button
              key={level}
              onClick={() => onChange(level)}
              className={`flex-1 h-3 rounded-full transition-colors ${
                i <= currentIndex ? 'bg-primary' : 'bg-white/15'
              }`}
            />
          ))}
        </div>
        <button
          onClick={increase}
          className="w-8 h-8 rounded-full bg-white/10 border border-glass-border text-text-main text-lg font-bold flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          +
        </button>
      </div>
      <div className="flex justify-between mt-1.5 px-11">
        <span className="text-text-muted text-[10px]">Low</span>
        <span className="text-text-muted text-[10px]">High</span>
      </div>
    </div>
  );
}

export function RoomScreen({ initialRoomCode }: { initialRoomCode?: string }) {
  const router = useRouter();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const hasShownInitialShare = useRef(false);
  const hasBeenConnected = useRef(false);
  const hasLeft = useRef(false);
  const autoJoinAttempted = useRef(false);

  const {
    connectionState,
    roomCode,
    isHost,
    partnerId,
    isMuted,
    isDeafened,
    isSpeaking,
    isPartnerSpeaking,
    vadSensitivity,
    leaveRoom,
    setMuted,
    setDeafened,
    setVadSensitivity,
    joinRoom,
  } = useDuetStore();

  // Auto-join from URL if not already in a room (only once)
  useEffect(() => {
    if (initialRoomCode && !roomCode && !autoJoinAttempted.current && !hasLeft.current) {
      autoJoinAttempted.current = true;
      joinRoom(initialRoomCode).catch((err) => {
        console.error('[Room] Auto-join failed:', err);
        router.push('/app');
      });
    }
  }, [initialRoomCode, roomCode, joinRoom, router]);

  // Auto-show share modal for host
  useEffect(() => {
    if (isHost && roomCode && !hasShownInitialShare.current) {
      hasShownInitialShare.current = true;
      setShowShareModal(true);
    }
  }, [isHost, roomCode]);

  useEffect(() => {
    if (connectionState === 'connected') {
      hasBeenConnected.current = true;
    }
  }, [connectionState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (!hasLeft.current) {
        leaveRoom();
      }
    };
  }, [leaveRoom]);

  // If no room code and not auto-joining, go to lobby
  if (!roomCode && !initialRoomCode) {
    router.push('/app');
    return null;
  }

  const handleLeave = async () => {
    setShowLeaveConfirm(false);
    hasLeft.current = true;
    await leaveRoom();
    router.push('/app');
  };

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-success';
      case 'connecting':
      case 'reconnecting': return 'text-warning';
      case 'failed': return 'text-danger';
      default:
        if (hasBeenConnected.current && !partnerId) return 'text-danger';
        return 'text-warning';
    }
  };

  const getConnectionDotColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-success';
      case 'connecting':
      case 'reconnecting': return 'bg-warning';
      case 'failed': return 'bg-danger';
      default:
        if (hasBeenConnected.current && !partnerId) return 'bg-danger';
        return 'bg-warning';
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

  const displayCode = roomCode || initialRoomCode || '';

  return (
    <div className="h-screen-safe relative overflow-hidden bg-[#141428]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative w-full max-w-[600px] h-full bg-cover bg-center"
          style={{ backgroundImage: 'url(/duet-room-bg.png)' }}
        >
          <div className="absolute inset-0 bg-[rgba(20,20,40,0.55)]" />
        </div>
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative w-full max-w-[600px] h-full flex flex-col overflow-auto">
        {/* Tab warning banner */}
        <div className="bg-warning/20 border-b border-warning/30 px-4 py-2 text-center">
          <p className="text-warning text-xs font-medium">
            Keep this tab open for the best call quality. Switching tabs may interrupt your connection.
          </p>
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center bg-glass border border-glass-border rounded-2xl py-1.5 px-3"
          >
            <div className={`w-2 h-2 rounded-full mr-1.5 ${getConnectionDotColor()}`} />
            <span className="text-text-main text-sm font-semibold tracking-widest">{displayCode}</span>
          </button>
          <span className={`text-xs ${getConnectionColor()}`}>{getConnectionText()}</span>
          <GuestRoomTimer partnerJoined={!!partnerId} onTimeExpired={handleLeave} />
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="bg-danger/25 border border-danger/40 rounded-2xl py-1.5 px-3.5 text-[#ff6b6b] text-sm font-semibold hover:bg-danger/35 transition-colors"
          >
            Leave
          </button>
        </div>

        {/* Avatars */}
        <div className="flex justify-center items-center gap-10 py-8">
          <AvatarCircle label="You" initials="Y" isSpeaking={isSpeaking} isMuted={isMuted} />
          <AvatarCircle label="Partner" initials="P" isSpeaking={isPartnerSpeaking} isDeafened={isDeafened} />
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4 px-5">
          <button
            onClick={() => setMuted(!isMuted)}
            className={`flex items-center gap-2 rounded-3xl py-3 px-5 border transition-colors ${
              isMuted
                ? 'bg-primary/25 border-primary'
                : 'bg-glass border-glass-border'
            }`}
          >
            <span className="text-lg">{isMuted ? '\ud83d\udd07' : '\ud83c\udfa4'}</span>
            <span className="text-text-main text-sm font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button
            onClick={() => setDeafened(!isDeafened)}
            className={`flex items-center gap-2 rounded-3xl py-3 px-5 border transition-colors ${
              isDeafened
                ? 'bg-primary/25 border-primary'
                : 'bg-glass border-glass-border'
            }`}
          >
            <span className="text-lg">{isDeafened ? '\ud83d\udd15' : '\ud83d\udd0a'}</span>
            <span className="text-text-main text-sm font-medium">{isDeafened ? 'Undeafen' : 'Deafen'}</span>
          </button>
        </div>

        {/* Voice sensitivity */}
        <div className="mt-4">
          <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />
        </div>

        <div className="flex-1" />

        {/* Ad */}
        {process.env.NEXT_PUBLIC_AD_SLOT_ROOM && (
          <div className="px-5 mb-4">
            <AdSlot adSlot={process.env.NEXT_PUBLIC_AD_SLOT_ROOM} format="horizontal" />
          </div>
        )}

        {/* Leave confirmation */}
        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={() => setShowLeaveConfirm(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Leave Room</h2>
              <p className="text-sm text-[#6b6b80] mb-6">Are you sure you want to disconnect?</p>
              <button
                onClick={handleLeave}
                className="bg-danger text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-red-600 transition-colors"
              >
                Leave
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="text-[#9a9aaa] text-[15px] font-semibold py-2 px-6"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <ShareModal
          visible={showShareModal}
          roomCode={displayCode}
          onClose={() => setShowShareModal(false)}
        />
        </div>
      </div>
    </div>
  );
}
