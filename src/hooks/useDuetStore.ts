import { create } from 'zustand';
import { DuetAudio } from '@/native/DuetAudio';
import { WebRTCService, ConnectionState } from '@/services/WebRTCService';
import { SignalingService } from '@/services/SignalingService';

interface DuetState {
  // Connection
  connectionState: ConnectionState;
  roomCode: string | null;
  isHost: boolean;
  partnerId: string | null;
  
  // Audio controls
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isPartnerSpeaking: boolean;
  
  // Settings
  duckLevel: number; // 0-100, percentage of original volume when ducking
  vadSensitivity: number; // 0-100, higher = more sensitive
  
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
}

export const useDuetStore = create<DuetState>((set, get) => ({
  // Initial state
  connectionState: 'disconnected',
  roomCode: null,
  isHost: false,
  partnerId: null,
  
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  isPartnerSpeaking: false,
  
  duckLevel: 30,
  vadSensitivity: 50,
  
  webrtc: null,
  signaling: null,
  
  // =====================
  // INITIALIZATION
  // =====================
  
  initialize: async () => {
    try {
      // Initialize native audio
      await DuetAudio.setupAudioSession();
      
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
      });
      
      console.log('[Store] Initialized');
    } catch (error) {
      console.error('[Store] Initialization failed:', error);
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
        // Partner joined, create offer
        console.log('[Store] Partner joined! Creating offer...');
        const { webrtc, signaling } = get();
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
        set({ partnerId: 'partner' }); // Simplified
      },
      onPartnerLeft: () => {
        set({ partnerId: null, connectionState: 'disconnected' });
      },
      onError: (error) => {
        console.error('[Signaling] Error:', error);
      },
    });
    
    // Create WebRTC service
    const webrtc = new WebRTCService({
      onConnectionStateChange: (state) => {
        set({ connectionState: state });
      },
      onAudioData: async (packet) => {
        // Play received audio with proper sample rate (this triggers ducking in native code)
        await DuetAudio.playAudio(packet.audio, packet.sampleRate, packet.channels);
        set({ isPartnerSpeaking: true });
        // Reset after delay matching the native ducking timeout (500ms)
        // This keeps UI in sync with audio ducking behavior
        setTimeout(() => set({ isPartnerSpeaking: false }), 500);
      },
      onError: (error) => {
        console.error('[WebRTC] Error:', error);
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
    
    // Start audio engine
    await DuetAudio.startAudioEngine();
    
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
      onError: (error) => {
        console.error('[Signaling] Error:', error);
      },
    });
    
    // Create WebRTC service
    const webrtc = new WebRTCService({
      onConnectionStateChange: (state) => {
        set({ connectionState: state });
      },
      onAudioData: async (packet) => {
        await DuetAudio.playAudio(packet.audio, packet.sampleRate, packet.channels);
        set({ isPartnerSpeaking: true });
        // Match native ducking timeout (500ms)
        setTimeout(() => set({ isPartnerSpeaking: false }), 500);
      },
      onError: (error) => {
        console.error('[WebRTC] Error:', error);
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
    set({ partnerId: 'partner' });
    
    // Start audio engine
    await DuetAudio.startAudioEngine();
  },
  
  leaveRoom: async () => {
    const { webrtc, signaling } = get();
    
    // Stop audio
    await DuetAudio.stopAudioEngine();
    DuetAudio.removeAllListeners();
    
    // Close connections
    webrtc?.close();
    await signaling?.leave();
    
    set({
      webrtc: null,
      signaling: null,
      roomCode: null,
      isHost: false,
      partnerId: null,
      connectionState: 'disconnected',
      isSpeaking: false,
      isPartnerSpeaking: false,
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
}));

export default useDuetStore;
