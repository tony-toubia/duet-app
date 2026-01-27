import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';

// WebRTC configuration with STUN and TURN servers
// STUN: Discovers public IP (works when both peers can reach each other directly)
// TURN: Relays traffic when direct connection fails (symmetric NAT, firewalls)
const rtcConfig = {
  iceServers: [
    // STUN servers for NAT traversal discovery
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },

    // TURN servers for relay when direct connection fails
    // Using Open Relay Project's free TURN servers
    // Note: For production, deploy your own TURN server (coturn) for reliability
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  // Try all transports - will prefer direct, fall back to relay
  iceTransportPolicy: 'all' as const,
};

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
  private localStream: MediaStream | null = null;

  // Connection state
  private _connectionState: ConnectionState = 'disconnected';

  // Queue ICE candidates until remote description is set
  private pendingCandidates: RTCIceCandidate[] = [];
  private remoteDescriptionSet: boolean = false;

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
      this.peerConnection = new RTCPeerConnection(rtcConfig);
      
      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
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
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('[WebRTC] Connection state changed:', state);
        switch (state) {
          case 'connected':
            this.setConnectionState('connected');
            break;
          case 'disconnected':
            this.setConnectionState('reconnecting');
            break;
          case 'failed':
            this.setConnectionState('failed');
            break;
          case 'closed':
            this.setConnectionState('disconnected');
            break;
        }
      };

      // Also monitor ICE connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      // Monitor ICE gathering state
      this.peerConnection.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state:', this.peerConnection?.iceGatheringState);
      };
      
      // Handle incoming data channel (for audio data)
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };

      // Handle incoming audio tracks - mute them since we use data channel for audio
      // This prevents double audio (WebRTC track + data channel)
      this.peerConnection.ontrack = (event) => {
        console.log('[WebRTC] Received remote track:', event.track.kind);
        // Mute incoming audio tracks - we receive audio via data channel instead
        if (event.track.kind === 'audio') {
          event.track.enabled = false;
          console.log('[WebRTC] Muted incoming audio track (using data channel instead)');
        }
      };

      // Get local audio stream (needed for WebRTC connection negotiation)
      // Actual audio capture/transmission is handled by native module via data channel
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Add tracks to peer connection (required for proper WebRTC negotiation)
      // BUT mute the local audio track - we send audio via data channel, not WebRTC track
      this.localStream.getTracks().forEach((track) => {
        if (track.kind === 'audio') {
          track.enabled = false;  // Mute - actual audio goes via data channel
          console.log('[WebRTC] Local audio track muted (using data channel instead)');
        }
        this.peerConnection?.addTrack(track, this.localStream!);
      });
      
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
    
    this.setConnectionState('connecting');
    
    // Create data channel for audio data
    const channel = this.peerConnection.createDataChannel('audio', {
      ordered: false, // Don't need ordering for real-time audio
      maxRetransmits: 0, // No retransmits for lowest latency
    });
    this.setupDataChannel(channel);
    
    // Create and set local offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    
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
   * Close connection and cleanup
   */
  close(): void {
    console.log('[WebRTC] Closing connection');
    this.dataChannel?.close();
    this.dataChannel = null;

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    // Reset state
    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];

    this.setConnectionState('disconnected');
  }
}

export default WebRTCService;
