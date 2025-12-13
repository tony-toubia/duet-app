import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';

// WebRTC configuration
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production (Twilio, Cloudflare Calls, etc.)
    // {
    //   urls: 'turn:your-turn-server.com:443',
    //   username: 'user',
    //   credential: 'pass',
    // },
  ],
};

export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface WebRTCCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onAudioData: (data: string) => void;
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
          // Send candidate to peer via signaling
          this.onLocalIceCandidate?.(event.candidate);
        }
      };
      
      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
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
      
      // Handle incoming data channel (for audio data)
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
      
      // Get local audio stream (just for establishing connection)
      // Actual audio capture is handled by native module
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
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
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
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
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
  
  /**
   * Add ICE candidate from remote peer
   */
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
  
  /**
   * Send audio data to peer
   */
  sendAudioData(base64Audio: string): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(base64Audio);
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
      // Received audio data from peer
      this.callbacks.onAudioData(event.data);
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
    this.dataChannel?.close();
    this.dataChannel = null;
    
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    
    this.peerConnection?.close();
    this.peerConnection = null;
    
    this.setConnectionState('disconnected');
  }
}

export default WebRTCService;
