// src/services/store.ts
import { create } from 'zustand';
import { MediaStream } from 'react-native-webrtc';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

interface DuetState {
  connectionState: ConnectionState;
  roomId: string | null;
  oderId: string | null;
  partnerName: string;
  isMuted: boolean;
  isDeafened: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  duckLevel: number;
  voiceBoost: number;
  releaseDelay: number;
  
  setConnectionState: (state: ConnectionState) => void;
  setRoomId: (roomId: string | null) => void;
  setPeerId: (oderId: string | null) => void;
  setPartnerName: (name: string) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setDuckLevel: (level: number) => void;
  setVoiceBoost: (boost: number) => void;
  setReleaseDelay: (delay: number) => void;
  reset: () => void;
}

const initialState = {
  connectionState: 'disconnected' as ConnectionState,
  roomId: null,
  oderId: null,
  partnerName: 'Partner',
  isMuted: false,
  isDeafened: false,
  localStream: null,
  remoteStream: null,
  duckLevel: 70,
  voiceBoost: 50,
  releaseDelay: 500,
};

export const useDuetStore = create<DuetState>((set) => ({
  ...initialState,
  setConnectionState: (connectionState) => set({ connectionState }),
  setRoomId: (roomId) => set({ roomId }),
  setPeerId: (oderId) => set({ oderId }),
  setPartnerName: (partnerName) => set({ partnerName }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleDeafen: () => set((state) => ({ isDeafened: !state.isDeafened })),
  setMuted: (isMuted) => set({ isMuted }),
  setDeafened: (isDeafened) => set({ isDeafened }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setDuckLevel: (duckLevel) => set({ duckLevel }),
  setVoiceBoost: (voiceBoost) => set({ voiceBoost }),
  setReleaseDelay: (releaseDelay) => set({ releaseDelay }),
  reset: () => set(initialState),
}));

export const useConnectionState = () => useDuetStore((s) => s.connectionState);
export const useIsConnected = () => useDuetStore((s) => s.connectionState === 'connected');
export const useAudioControls = () => useDuetStore((s) => ({
  isMuted: s.isMuted,
  isDeafened: s.isDeafened,
  toggleMute: s.toggleMute,
  toggleDeafen: s.toggleDeafen,
}));
