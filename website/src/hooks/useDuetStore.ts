import { create } from 'zustand';
import { ref, get as firebaseGet } from 'firebase/database';
import { firebaseDb } from '@/services/firebase';
import { WebRTCService, ConnectionState } from '@/services/WebRTCService';
import { SignalingService } from '@/services/SignalingService';
import { WebAudioEngine } from '@/audio/WebAudioEngine';
import { friendsService } from '@/services/FriendsService';
import { useAuthStore } from './useAuthStore';

interface DuetState {
  connectionState: ConnectionState;
  roomCode: string | null;
  isHost: boolean;
  partnerId: string | null;
  roomDeleted: boolean;

  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isPartnerSpeaking: boolean;

  vadSensitivity: number;

  webrtc: WebRTCService | null;
  signaling: SignalingService | null;
  audioEngine: WebAudioEngine | null;

  initialize: () => Promise<void>;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setVadSensitivity: (sensitivity: number) => void;
}

async function createAndStartAudioEngine(
  set: (partial: Partial<DuetState>) => void,
  get: () => DuetState
): Promise<WebAudioEngine> {
  const engine = new WebAudioEngine({
    onAudioData: (base64, sampleRate, channels) => {
      const { webrtc } = get();
      webrtc?.sendAudioData(base64, sampleRate, channels);
    },
    onVoiceActivity: (speaking) => {
      set({ isSpeaking: speaking });
    },
    onError: (error) => {
      console.error('[WebAudio] Error:', error);
    },
  });

  await engine.setup();
  await engine.start();

  // Apply current VAD sensitivity
  const { vadSensitivity } = get();
  const threshold = 0.001 + (0.099 * (100 - vadSensitivity) / 100);
  engine.setVadThreshold(threshold);

  return engine;
}

export const useDuetStore = create<DuetState>((set, get) => ({
  connectionState: 'disconnected',
  roomCode: null,
  isHost: false,
  partnerId: null,
  roomDeleted: false,

  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  isPartnerSpeaking: false,

  vadSensitivity: 40,

  webrtc: null,
  signaling: null,
  audioEngine: null,

  initialize: async () => {
    console.log('[Store] Initialized (web)');
  },

  createRoom: async () => {
    const signaling = new SignalingService({
      onOffer: () => {},
      onAnswer: async (answer) => {
        const { webrtc } = get();
        await webrtc?.handleAnswer(answer);
      },
      onIceCandidate: async (candidate) => {
        const { webrtc } = get();
        await webrtc?.addIceCandidate(candidate);
      },
      onPartnerJoined: async () => {
        console.log('[Store] Partner joined! Creating offer...');
        const { webrtc, signaling } = get();
        if (webrtc && signaling) {
          try {
            set({ connectionState: 'connecting' });
            const offer = await webrtc.createOffer();
            await signaling.sendOffer(offer);
          } catch (e) {
            console.error('[Store] Failed to create/send offer:', e);
          }
        }
        // Resolve real partner UID from room members
        const partnerUid = await signaling?.getPartnerUid();
        set({ partnerId: partnerUid || 'partner' });
      },
      onPartnerLeft: () => {
        set({ partnerId: null, connectionState: 'disconnected' });
      },
      onRoomDeleted: () => {
        console.log('[Store] Room was deleted');
        set({ roomDeleted: true, partnerId: null, connectionState: 'disconnected' });
      },
      onError: (error) => {
        console.error('[Signaling] Error:', error);
      },
    });

    const webrtc = new WebRTCService({
      onConnectionStateChange: (state) => {
        set({ connectionState: state });
      },
      onAudioData: (packet) => {
        // Phase 4: feed packet to WebAudioEngine playback
        const { audioEngine } = get();
        audioEngine?.playAudio(packet.audio, packet.sampleRate, packet.channels);
        set({ isPartnerSpeaking: true });
        setTimeout(() => set({ isPartnerSpeaking: false }), 500);
      },
      onError: (error) => {
        console.error('[WebRTC] Error:', error);
      },
    });

    set({ signaling, webrtc, isHost: true });

    const uid = useAuthStore.getState().user?.uid;
    await signaling.initialize(uid);
    await webrtc.initialize();

    webrtc.onLocalIceCandidate = (candidate) => {
      signaling.sendIceCandidate(candidate);
    };

    const roomCode = await signaling.createRoom();
    set({ roomCode });

    // Start audio engine (mic capture + playback)
    try {
      const engine = await createAndStartAudioEngine(set, get);
      set({ audioEngine: engine });
    } catch (e) {
      console.warn('[Store] Audio engine failed to start:', e);
      // Room still usable — user can see connection but won't have audio
    }

    return roomCode;
  },

  joinRoom: async (code: string) => {
    const signaling = new SignalingService({
      onOffer: async (offer) => {
        console.log('[Store] Received offer! Processing...');
        const { webrtc, signaling } = get();
        if (webrtc && signaling) {
          try {
            set({ connectionState: 'connecting' });
            const answer = await webrtc.handleOffer(offer);
            await signaling.sendAnswer(answer);
          } catch (e) {
            console.error('[Store] Failed to handle offer:', e);
          }
        }
      },
      onAnswer: () => {},
      onIceCandidate: async (candidate) => {
        const { webrtc } = get();
        await webrtc?.addIceCandidate(candidate);
      },
      onPartnerJoined: () => {},
      onPartnerLeft: () => {
        set({ partnerId: null, connectionState: 'disconnected' });
      },
      onRoomDeleted: () => {
        console.log('[Store] Room was deleted');
        set({ roomDeleted: true, partnerId: null, connectionState: 'disconnected' });
      },
      onError: (error) => {
        console.error('[Signaling] Error:', error);
      },
    });

    const webrtc = new WebRTCService({
      onConnectionStateChange: (state) => {
        set({ connectionState: state });
      },
      onAudioData: (packet) => {
        const { audioEngine } = get();
        audioEngine?.playAudio(packet.audio, packet.sampleRate, packet.channels);
        set({ isPartnerSpeaking: true });
        setTimeout(() => set({ isPartnerSpeaking: false }), 500);
      },
      onError: (error) => {
        console.error('[WebRTC] Error:', error);
      },
    });

    set({ signaling, webrtc, isHost: false });

    try {
      const uid = useAuthStore.getState().user?.uid;
      await signaling.initialize(uid);
      await webrtc.initialize();

      webrtc.onLocalIceCandidate = (candidate) => {
        signaling.sendIceCandidate(candidate);
      };

      await signaling.joinRoom(code);
      // Only set roomCode after successful join
      set({ roomCode: code });

      // Resolve real partner UID from room members
      const partnerUid = await signaling.getPartnerUid();
      set({ partnerId: partnerUid || 'partner' });

      // Start audio engine (mic capture + playback)
      try {
        const engine = await createAndStartAudioEngine(set, get);
        set({ audioEngine: engine });
      } catch (e) {
        console.warn('[Store] Audio engine failed to start:', e);
      }
    } catch (e) {
      // Clean up on failure so LobbyScreen doesn't see stale roomCode
      webrtc.close();
      signaling.leave().catch(() => {});
      set({ signaling: null, webrtc: null, roomCode: null, isHost: false });
      throw e;
    }
  },

  leaveRoom: async () => {
    const { webrtc, signaling, audioEngine, partnerId, roomCode } = get();

    // Record recent connection before cleanup
    if (partnerId && partnerId !== 'partner' && roomCode) {
      try {
        const profileSnap = await firebaseGet(ref(firebaseDb, `/users/${partnerId}/profile`));
        const profile = profileSnap.val();
        if (profile) {
          await friendsService.recordRecentConnection(
            partnerId,
            profile.displayName || 'Duet User',
            profile.avatarUrl || null,
            roomCode
          );
        }
      } catch (e) {
        console.warn('[Store] Failed to record recent connection:', e);
      }
    }

    audioEngine?.stop();

    webrtc?.close();
    await signaling?.leave();

    set({
      webrtc: null,
      signaling: null,
      audioEngine: null,
      roomCode: null,
      isHost: false,
      partnerId: null,
      roomDeleted: false,
      connectionState: 'disconnected',
      isSpeaking: false,
      isPartnerSpeaking: false,
    });
  },

  setMuted: (muted: boolean) => {
    const { audioEngine } = get();
    audioEngine?.setMuted(muted);
    set({ isMuted: muted });
  },

  setDeafened: (deafened: boolean) => {
    const { audioEngine } = get();
    audioEngine?.setDeafened(deafened);
    set({ isDeafened: deafened });
  },

  setVadSensitivity: (sensitivity: number) => {
    const { audioEngine } = get();
    const threshold = 0.001 + (0.099 * (100 - sensitivity) / 100);
    audioEngine?.setVadThreshold(threshold);
    set({ vadSensitivity: sensitivity });
  },
}));
