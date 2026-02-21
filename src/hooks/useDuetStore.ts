import { create } from 'zustand';
import { Platform, PermissionsAndroid } from 'react-native';
import database from '@react-native-firebase/database';
import { DuetAudio } from '@/native/DuetAudio';
import { WebRTCService, ConnectionState } from '@/services/WebRTCService';
import { SignalingService } from '@/services/SignalingService';
import { crashlyticsService } from '@/services/CrashlyticsService';
import { pushNotificationService } from '@/services/PushNotificationService';
import { friendsService } from '@/services/FriendsService';
import { eventTrackingService } from '@/services/EventTrackingService';

interface DuetState {
  // Connection
  connectionState: ConnectionState;
  roomCode: string | null;
  isHost: boolean;
  partnerId: string | null;
  roomDeleted: boolean;

  // Audio controls
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isPartnerSpeaking: boolean;

  // Reactions
  incomingReaction: { emoji: string; id: number } | null;

  // Settings
  duckLevel: number; // 0-100, percentage of original volume when ducking
  vadSensitivity: number; // 0-100, higher = more sensitive
  duckingEnabled: boolean; // iOS only: attempt to duck other audio (may pause some apps)

  // Services (non-serialized)
  webrtc: WebRTCService | null;
  signaling: SignalingService | null;

  // Actions
  initialize: () => Promise<void>;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setDuckLevel: (level: number) => void;
  setVadSensitivity: (sensitivity: number) => void;
  setDuckingEnabled: (enabled: boolean) => void;
  sendReaction: (emoji: string) => void;
}

export const useDuetStore = create<DuetState>((set, get) => ({
  // Initial state
  connectionState: 'disconnected',
  roomCode: null,
  isHost: false,
  partnerId: null,
  roomDeleted: false,
  
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  isPartnerSpeaking: false,

  incomingReaction: null,

  duckLevel: 30,
  vadSensitivity: 40, // Default: moderate-low, good for car/road noise environments
  duckingEnabled: false, // Default off - mixing only; ducking may pause some apps
  
  webrtc: null,
  signaling: null,
  
  // =====================
  // INITIALIZATION
  // =====================
  
  initialize: async () => {
    try {
      // Initialize Crashlytics first for error tracking
      await crashlyticsService.initialize();
      crashlyticsService.log('[Store] Initializing...');

      // Initialize push notifications
      await pushNotificationService.initialize({
        onPartnerLeft: (roomCode) => {
          crashlyticsService.log(`[Push] Partner left room: ${roomCode}`);
          // If we're in this room, handle the disconnect
          const state = get();
          if (state.roomCode === roomCode) {
            set({ partnerId: null, connectionState: 'disconnected' });
          }
        },
      });

      // Initialize native audio
      const audioResult = await DuetAudio.setupAudioSession();
      crashlyticsService.logAudioSetup(Platform.OS, audioResult.sampleRate);

      // Set up audio event listeners
      DuetAudio.onVoiceActivity((event) => {
        set({ isSpeaking: event.speaking });
      });

      DuetAudio.onAudioData((data) => {
        // Send audio to partner via WebRTC with metadata
        const { webrtc } = get();
        webrtc?.sendAudioData(data.audio, data.sampleRate, data.channels);
      });

      DuetAudio.onConnectionStateChange((event) => {
        console.log('[Audio] Connection state:', event.state);
        crashlyticsService.log(`[Audio] State: ${event.state}`);
      });

      DuetAudio.onError((error) => {
        crashlyticsService.logAudioError(new Error(error.message), 'runtime');
      });

      console.log('[Store] Initialized');
      crashlyticsService.log('[Store] Initialized successfully');
    } catch (error) {
      console.error('[Store] Initialization failed:', error);
      crashlyticsService.recordError(error as Error, 'Store initialization');
      throw error;
    }
  },
  
  // =====================
  // ROOM MANAGEMENT
  // =====================
  
  createRoom: async () => {
    const { initialize: initAudio } = get();
    
    // Create signaling service
    const signaling = new SignalingService({
      onOffer: () => {}, // We're creating, we send the offer
      onAnswer: async (answer) => {
        const { webrtc } = get();
        await webrtc?.handleAnswer(answer);
      },
      onIceCandidate: async (candidate) => {
        const { webrtc } = get();
        await webrtc?.addIceCandidate(candidate);
      },
      onPartnerJoined: async () => {
        const { webrtc, signaling, connectionState } = get();
        // Skip offer creation if WebRTC is already connected (e.g., partner
        // briefly backgrounded causing Firebase member churn, but ICE stayed up)
        if (connectionState === 'connected' || connectionState === 'reconnecting') {
          console.log('[Store] Partner joined but WebRTC already', connectionState, '— skipping offer');
          const partnerUid = await signaling?.getPartnerUid();
          set({ partnerId: partnerUid || 'partner' });
          return;
        }
        console.log('[Store] Partner joined! Creating offer...');
        if (webrtc && signaling) {
          try {
            set({ connectionState: 'connecting' });
            const offer = await webrtc.createOffer();
            console.log('[Store] Offer created, sending via signaling...');
            await signaling.sendOffer(offer);
            console.log('[Store] Offer sent successfully');
          } catch (e) {
            console.error('[Store] Failed to create/send offer:', e);
          }
        } else {
          console.error('[Store] WebRTC or Signaling not available!', { webrtc: !!webrtc, signaling: !!signaling });
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

    // Create WebRTC service
    const webrtc = new WebRTCService({
      onConnectionStateChange: (state) => {
        set({ connectionState: state });
        crashlyticsService.logWebRTCStateChange(state);
      },
      onAudioData: async (packet) => {
        // Play received audio with proper sample rate (this triggers ducking in native code)
        await DuetAudio.playAudio(packet.audio, packet.sampleRate, packet.channels);
        set({ isPartnerSpeaking: true });
        // Reset after delay matching the native ducking timeout (500ms)
        // This keeps UI in sync with audio ducking behavior
        setTimeout(() => set({ isPartnerSpeaking: false }), 500);
      },
      onReaction: (emoji) => {
        set({ incomingReaction: { emoji, id: Date.now() } });
      },
      onIceRestartOffer: async (offer) => {
        // Host sends ICE restart offer via signaling so answerer can renegotiate
        const { signaling } = get();
        if (signaling) {
          console.log('[Store] Sending ICE restart offer via signaling');
          await signaling.sendOffer(offer);
        }
      },
      onError: (error) => {
        console.error('[WebRTC] Error:', error);
        crashlyticsService.logWebRTCError(error, 'createRoom');
      },
    });

    set({ signaling, webrtc, isHost: true });

    // Initialize services
    await signaling.initialize();
    await webrtc.initialize();

    // Set up ICE candidate forwarding
    webrtc.onLocalIceCandidate = (candidate) => {
      signaling.sendIceCandidate(candidate);
    };
    
    // Create room
    const roomCode = await signaling.createRoom();
    set({ roomCode });
    crashlyticsService.logRoomCreated(roomCode);
    eventTrackingService.track('room_created', { roomCode });

    // Request mic permission on Android (iOS handles via infoPlist)
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[Store] Microphone permission denied');
      }
    }

    // Start audio engine
    await DuetAudio.startAudioEngine();
    crashlyticsService.logAudioEngineStart();

    return roomCode;
  },
  
  joinRoom: async (code: string) => {
    // Create signaling service
    const signaling = new SignalingService({
      onOffer: async (offer) => {
        console.log('[Store] Received offer! Processing...');
        const { webrtc, signaling } = get();
        if (webrtc && signaling) {
          try {
            set({ connectionState: 'connecting' });
            console.log('[Store] Handling offer and creating answer...');
            const answer = await webrtc.handleOffer(offer);
            console.log('[Store] Answer created, sending via signaling...');
            await signaling.sendAnswer(answer);
            console.log('[Store] Answer sent successfully');
          } catch (e) {
            console.error('[Store] Failed to handle offer:', e);
          }
        } else {
          console.error('[Store] WebRTC or Signaling not available!', { webrtc: !!webrtc, signaling: !!signaling });
        }
      },
      onAnswer: () => {}, // We're joining, we receive offer and send answer
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

    // Create WebRTC service
    const webrtc = new WebRTCService({
      onConnectionStateChange: (state) => {
        set({ connectionState: state });
        crashlyticsService.logWebRTCStateChange(state);
      },
      onAudioData: async (packet) => {
        await DuetAudio.playAudio(packet.audio, packet.sampleRate, packet.channels);
        set({ isPartnerSpeaking: true });
        // Match native ducking timeout (500ms)
        setTimeout(() => set({ isPartnerSpeaking: false }), 500);
      },
      onReaction: (emoji) => {
        set({ incomingReaction: { emoji, id: Date.now() } });
      },
      onIceRestartOffer: async () => {
        // Only the offerer (host) initiates ICE restart — answerer is a no-op here.
        // The answerer handles the restart offer via the signaling onOffer callback.
      },
      onError: (error) => {
        console.error('[WebRTC] Error:', error);
        crashlyticsService.logWebRTCError(error, 'joinRoom');
      },
    });

    set({ signaling, webrtc, isHost: false, roomCode: code });

    // Initialize services
    await signaling.initialize();
    await webrtc.initialize();

    // Set up ICE candidate forwarding
    webrtc.onLocalIceCandidate = (candidate) => {
      signaling.sendIceCandidate(candidate);
    };

    // Join room
    await signaling.joinRoom(code);
    // Resolve real partner UID from room members
    const partnerUid = await signaling.getPartnerUid();
    set({ partnerId: partnerUid || 'partner' });
    crashlyticsService.logRoomJoined(code);
    eventTrackingService.track('room_joined', { roomCode: code });

    // Request mic permission on Android (iOS handles via infoPlist)
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[Store] Microphone permission denied');
      }
    }

    // Start audio engine
    await DuetAudio.startAudioEngine();
    crashlyticsService.logAudioEngineStart();
  },
  
  leaveRoom: async () => {
    const { webrtc, signaling, partnerId, roomCode } = get();

    crashlyticsService.log('[Store] Leaving room...');

    // Record recent connection before cleanup
    if (partnerId && partnerId !== 'partner' && roomCode) {
      try {
        const profileSnap = await database().ref(`/users/${partnerId}/profile`).once('value');
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

    // Stop audio
    await DuetAudio.stopAudioEngine();
    crashlyticsService.logAudioEngineStop();
    DuetAudio.removeAllListeners();

    // Close connections
    webrtc?.close();
    await signaling?.leave();

    crashlyticsService.logRoomLeft();

    set({
      webrtc: null,
      signaling: null,
      roomCode: null,
      isHost: false,
      partnerId: null,
      roomDeleted: false,
      connectionState: 'disconnected',
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isPartnerSpeaking: false,
      incomingReaction: null,
    });
  },
  
  // =====================
  // AUDIO CONTROLS
  // =====================
  
  setMuted: (muted: boolean) => {
    DuetAudio.setMuted(muted);
    set({ isMuted: muted });
  },
  
  setDeafened: (deafened: boolean) => {
    DuetAudio.setDeafened(deafened);
    set({ isDeafened: deafened });
  },
  
  setDuckLevel: (level: number) => {
    // Duck level is handled by system audio session
    // This is more for UI/preference storage
    set({ duckLevel: level });
  },
  
  setVadSensitivity: (sensitivity: number) => {
    // Convert 0-100 to threshold (inverse - higher sensitivity = lower threshold)
    const threshold = 0.001 + (0.099 * (100 - sensitivity) / 100);
    DuetAudio.setVadThreshold(threshold);
    set({ vadSensitivity: sensitivity });
  },

  setDuckingEnabled: (enabled: boolean) => {
    // iOS only: toggle between mixing and ducking
    if (Platform.OS === 'ios') {
      DuetAudio.setDuckingEnabled(enabled);
    }
    set({ duckingEnabled: enabled });
  },

  sendReaction: (emoji: string) => {
    const { webrtc } = get();
    webrtc?.sendReaction(emoji);
  },
}));

export default useDuetStore;
