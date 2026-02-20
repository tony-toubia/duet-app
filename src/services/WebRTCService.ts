import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { getIceServers } from '@/config/turn';

// WebRTC configuration
// ICE servers loaded from config for easy production deployment
const getRtcConfig = () => ({
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  // Try all transports - will prefer direct, fall back to relay
  iceTransportPolicy: 'all' as const,
});

export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface AudioPacket {
  audio: string;      // base64 encoded audio data
  sampleRate: number; // sample rate in Hz (should be 48000)
  channels: number;   // number of channels (should be 1)
}

export interface WebRTCCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onAudioData: (data: AudioPacket) => void;
  onIceRestartOffer: (offer: RTCSessionDescription) => void;
  onError: (error: Error) => void;
}

/**
 * WebRTC Service
 * 
 * Handles peer-to-peer audio streaming between two devices.
 * Uses a signaling service (Firebase) for connection establishment.
 */
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCCallbacks;

  // Connection state
  private _connectionState: ConnectionState = 'disconnected';

  // Queue ICE candidates until remote description is set
  private pendingCandidates: RTCIceCandidate[] = [];
  private remoteDescriptionSet: boolean = false;

  // ICE restart: schedule a restart after brief disconnection (e.g., screen lock)
  private iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private isOfferer: boolean = false;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }
  
  get connectionState(): ConnectionState {
    return this._connectionState;
  }
  
  private setConnectionState(state: ConnectionState) {
    this._connectionState = state;
    this.callbacks.onConnectionStateChange(state);
  }
  
  /**
   * Initialize WebRTC peer connection
   */
  async initialize(): Promise<void> {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection(getRtcConfig());
      const pc = this.peerConnection as any;

      // Handle ICE candidates
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          // Log candidate details for debugging
          const candidate = event.candidate;
          console.log('[WebRTC] Local ICE candidate:', {
            type: candidate.type,
            protocol: candidate.protocol,
            address: candidate.address,
            port: candidate.port,
            candidateType: candidate.candidate?.split(' ')[7], // typ host/srflx/relay
          });
          // Send candidate to peer via signaling
          this.onLocalIceCandidate?.(event.candidate);
        } else {
          console.log('[WebRTC] ICE candidate gathering complete (null candidate)');
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('[WebRTC] Connection state changed:', state);
        switch (state) {
          case 'connected':
            this.cancelIceRestart();
            this.setConnectionState('connected');
            break;
          case 'disconnected':
            this.setConnectionState('reconnecting');
            this.scheduleIceRestart();
            break;
          case 'failed':
            this.cancelIceRestart();
            this.setConnectionState('failed');
            // Also attempt ICE restart on failed — last chance before giving up
            this.attemptIceRestart();
            break;
          case 'closed':
            this.cancelIceRestart();
            this.setConnectionState('disconnected');
            break;
        }
      };

      // Also monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      // Monitor ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
      };

      // Handle incoming data channel (for audio data)
      pc.ondatachannel = (event: any) => {
        this.setupDataChannel(event.channel);
      };

      // No audio tracks are used - all audio goes via data channel
      pc.ontrack = (event: any) => {
        console.log('[WebRTC] Unexpected remote track:', event.track.kind);
      };

      // NOTE: We do NOT call getUserMedia here. Audio capture is handled entirely
      // by the native DuetAudio module and sent via data channel, not WebRTC audio tracks.
      // Calling getUserMedia would claim the mic and conflict with the native AudioRecord
      // on Android, causing the native capture to silently fail.
      
      console.log('[WebRTC] Initialized successfully');
    } catch (error) {
      this.callbacks.onError(error as Error);
      throw error;
    }
  }
  
  /**
   * Create offer (initiator side)
   */
  async createOffer(): Promise<RTCSessionDescription> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    this.isOfferer = true;
    this.setConnectionState('connecting');

    // Create data channel for audio data
    const channel = this.peerConnection.createDataChannel('audio', {
      ordered: false, // Don't need ordering for real-time audio
      maxRetransmits: 0, // No retransmits for lowest latency
    });
    this.setupDataChannel(channel as any);
    
    // Create and set local offer (no audio/video tracks - using data channel only)
    const offer = await this.peerConnection.createOffer({} as any);
    
    await this.peerConnection.setLocalDescription(offer);
    
    return offer as RTCSessionDescription;
  }
  
  /**
   * Handle received offer (receiver side)
   */
  async handleOffer(offer: RTCSessionDescription): Promise<RTCSessionDescription> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.setConnectionState('connecting');

    console.log('[WebRTC] Setting remote description (offer)');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;

    // Process any queued ICE candidates
    console.log('[WebRTC] Processing', this.pendingCandidates.length, 'queued ICE candidates');
    for (const candidate of this.pendingCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add queued ICE candidate:', e);
      }
    }
    this.pendingCandidates = [];

    console.log('[WebRTC] Creating answer');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer as RTCSessionDescription;
  }
  
  /**
   * Handle received answer (initiator side)
   */
  async handleAnswer(answer: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('[WebRTC] Setting remote description (answer)');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    this.remoteDescriptionSet = true;

    // Process any queued ICE candidates
    console.log('[WebRTC] Processing', this.pendingCandidates.length, 'queued ICE candidates');
    for (const candidate of this.pendingCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Failed to add queued ICE candidate:', e);
      }
    }
    this.pendingCandidates = [];
  }

  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Queue candidates if remote description not set yet
    if (!this.remoteDescriptionSet) {
      console.log('[WebRTC] Queuing ICE candidate (remote description not set yet)');
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      // Log received candidate details
      const candidateStr = typeof candidate === 'object' ? (candidate as any).candidate : candidate;
      const candidateType = candidateStr?.split(' ')[7]; // typ host/srflx/relay
      console.log('[WebRTC] Adding remote ICE candidate:', {
        candidateType,
        candidate: candidateStr?.substring(0, 80) + '...',
      });
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[WebRTC] Failed to add ICE candidate:', e);
    }
  }
  
  /**
   * Send audio data to peer with metadata
   */
  sendAudioData(base64Audio: string, sampleRate: number = 48000, channels: number = 1): void {
    if (this.dataChannel?.readyState === 'open') {
      // Send as JSON packet with metadata for cross-platform compatibility
      const packet: AudioPacket = {
        audio: base64Audio,
        sampleRate,
        channels,
      };
      this.dataChannel.send(JSON.stringify(packet));
    }
  }
  
  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    
    channel.onopen = () => {
      console.log('[WebRTC] Data channel opened');
    };
    
    channel.onclose = () => {
      console.log('[WebRTC] Data channel closed');
    };
    
    channel.onmessage = (event) => {
      // Received audio data from peer - parse JSON packet
      try {
        const packet: AudioPacket = JSON.parse(event.data);
        this.callbacks.onAudioData(packet);
      } catch (e) {
        // Fallback for legacy raw base64 data (backward compatibility)
        console.warn('[WebRTC] Received non-JSON data, using defaults');
        this.callbacks.onAudioData({
          audio: event.data,
          sampleRate: 48000,
          channels: 1,
        });
      }
    };
    
    channel.onerror = (error) => {
      console.error('[WebRTC] Data channel error:', error);
    };
  }
  
  /**
   * Callback for sending ICE candidates to peer via signaling
   * Set this before creating offer/handling offer
   */
  onLocalIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  
  /**
   * Schedule an ICE restart after 3 seconds if the connection doesn't self-recover.
   * Only the offerer initiates ICE restart (creates new offer with iceRestart flag).
   */
  private scheduleIceRestart(): void {
    this.cancelIceRestart();
    this.iceRestartTimer = setTimeout(() => {
      this.attemptIceRestart();
    }, 3000);
    console.log('[WebRTC] ICE restart scheduled in 3s');
  }

  private cancelIceRestart(): void {
    if (this.iceRestartTimer) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
  }

  private async attemptIceRestart(): Promise<void> {
    if (!this.peerConnection) return;

    const state = this.peerConnection.connectionState;
    if (state === 'connected') {
      console.log('[WebRTC] Connection recovered, skipping ICE restart');
      return;
    }

    if (!this.isOfferer) {
      // Answerer can't initiate ICE restart — wait for offerer's new offer
      console.log('[WebRTC] Answerer waiting for ICE restart offer from host');
      return;
    }

    console.log('[WebRTC] Attempting ICE restart...');
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true } as any);
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] ICE restart offer created, sending via signaling');
      this.callbacks.onIceRestartOffer(offer as RTCSessionDescription);
    } catch (e) {
      console.error('[WebRTC] ICE restart failed:', e);
    }
  }

  /**
   * Close connection and cleanup
   */
  close(): void {
    console.log('[WebRTC] Closing connection');
    this.cancelIceRestart();
    this.dataChannel?.close();
    this.dataChannel = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    // Reset state
    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];
    this.isOfferer = false;

    this.setConnectionState('disconnected');
  }
}

export default WebRTCService;
