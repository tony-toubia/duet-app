import { Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { getIceServers } from '@/config/turn';
import { lifecycle } from './LifecycleLog';

// WebRTC configuration
// ICE servers loaded from config for easy production deployment
// iOS: use 'nohost' to skip host/mDNS candidates which trigger the
//   "find devices on local network" permission prompt. STUN (srflx)
//   and TURN (relay) candidates still work for all network scenarios.
// Android: use 'all' for optimal connectivity.
const getRtcConfig = () => ({
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  // 'nohost' is supported by react-native-webrtc (maps to RTCIceTransportPolicyNoHost)
  // but not in the TS type definitions, so we cast it.
  iceTransportPolicy: (Platform.OS === 'ios' ? 'nohost' : 'all') as 'all' | 'relay',
});

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export type ConnectionQuality = {
  rtt: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  packetsLost: number;
  packetsReceived: number;
};

export interface AudioPacket {
  audio: string;      // base64 encoded audio data
  sampleRate: number; // sample rate in Hz (should be 48000)
  channels: number;   // number of channels (should be 1)
}

export interface WebRTCCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onAudioData: (data: AudioPacket) => void;
  onReaction?: (emoji: string) => void;
  onDeepLink?: (url: string) => void;
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
  private iceRestartCount: number = 0;
  private isOfferer: boolean = false;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }
  
  get connectionState(): ConnectionState {
    return this._connectionState;
  }
  
  private setConnectionState(state: ConnectionState) {
    this._connectionState = state;
    lifecycle('webrtc.state', { state });
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
          const candidate = event.candidate;
          const candidateStr: string = candidate.candidate || '';
          const candidateType = candidateStr.split(' ')[7]; // typ host/srflx/relay

          // Only filter mDNS candidates (.local addresses) which trigger
          // the iOS "find devices on local network" permission prompt.
          // Regular host candidates (with real IPs) are safe and needed
          // when STUN/TURN don't produce srflx/relay candidates.
          if (candidateStr.includes('.local')) {
            console.log('[WebRTC] Filtered mDNS candidate');
            return;
          }

          console.log('[WebRTC] Local ICE candidate:', {
            type: candidate.type,
            protocol: candidate.protocol,
            address: candidate.address,
            port: candidate.port,
            candidateType,
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
            this.iceRestartCount = 0;
            this.setConnectionState('connected');
            break;
          case 'disconnected':
            this.setConnectionState('reconnecting');
            this.scheduleIceRestart();
            break;
          case 'failed':
            this.cancelIceRestart();
            this.setConnectionState('failed');
            // Attempt ICE restart on failed — both sides can try
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
   * Send audio data to peer with metadata.
   * Uses compact pipe-delimited format: "A|sampleRate|channels|base64Audio"
   * ~40% less overhead than JSON.stringify while staying string-compatible.
   */
  sendAudioData(base64Audio: string, sampleRate: number = 48000, channels: number = 1): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(`A|${sampleRate}|${channels}|${base64Audio}`);
    }
  }

  getDataChannelState(): string {
    return this.dataChannel?.readyState ?? 'null';
  }

  /**
   * Send an emoji reaction to peer
   */
  sendReaction(emoji: string): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'reaction', emoji }));
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
      const msg: string = event.data;

      // Compact audio format: "A|sampleRate|channels|base64Audio"
      if (msg.startsWith('A|')) {
        const firstPipe = 2;
        const secondPipe = msg.indexOf('|', firstPipe);
        const thirdPipe = msg.indexOf('|', secondPipe + 1);
        this.callbacks.onAudioData({
          audio: msg.substring(thirdPipe + 1),
          sampleRate: parseInt(msg.substring(firstPipe, secondPipe), 10),
          channels: parseInt(msg.substring(secondPipe + 1, thirdPipe), 10),
        });
        return;
      }

      if (msg.startsWith('C|')) {
        const parts = msg.split('|');
        if (parts.length >= 3) {
           this.callbacks.onDeepLink?.(parts[2]);
        }
        return;
      }

      // JSON messages (reactions + legacy audio)
      try {
        const data = JSON.parse(msg);
        if (data.type === 'reaction') {
          this.callbacks.onReaction?.(data.emoji);
        } else {
          this.callbacks.onAudioData(data as AudioPacket);
        }
      } catch (e) {
        // Fallback for raw base64 data
        this.callbacks.onAudioData({
          audio: msg,
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
   * Schedule an ICE restart with exponential backoff.
   * Both offerer and answerer can initiate restarts to handle cases
   * where the other side's device is dormant.
   */
  private scheduleIceRestart(): void {
    this.cancelIceRestart();
    // Exponential backoff: 3s, 6s, 12s, 24s, capped at 30s
    const delay = Math.min(3000 * Math.pow(2, this.iceRestartCount), 30000);
    this.iceRestartTimer = setTimeout(() => {
      this.attemptIceRestart();
    }, delay);
    console.log(`[WebRTC] ICE restart scheduled in ${delay / 1000}s (attempt ${this.iceRestartCount + 1})`);
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

    // Cap retries to avoid infinite restart loops
    if (this.iceRestartCount >= 5) {
      console.log('[WebRTC] Max ICE restart attempts reached, giving up');
      this.setConnectionState('failed');
      return;
    }

    this.iceRestartCount++;
    console.log(`[WebRTC] Attempting ICE restart (attempt ${this.iceRestartCount})...`);
    lifecycle('webrtc.ice.restart', { attempt: this.iceRestartCount });
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true } as any);
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] ICE restart offer created, sending via signaling');
      this.callbacks.onIceRestartOffer(offer as RTCSessionDescription);

      // Schedule another attempt in case this one doesn't connect
      this.scheduleIceRestart();
    } catch (e) {
      console.error('[WebRTC] ICE restart failed:', e);
      // Schedule retry even on error
      this.scheduleIceRestart();
    }
  }

  /**
   * External nudge to attempt reconnect, e.g. when the app returns to foreground
   * or a network change is detected. No-op if the connection is already healthy.
   */
  nudgeReconnect(): void {
    if (!this.peerConnection) return;
    const state = this.peerConnection.connectionState;
    if (state === 'connected' || state === 'connecting') return;
    console.log('[WebRTC] External reconnect nudge received');
    this.attemptIceRestart();
  }

  /**
   * Get connection quality stats from the peer connection.
   */
  async getConnectionStats(): Promise<ConnectionQuality | null> {
    if (!this.peerConnection) return null;

    try {
      const stats = await this.peerConnection.getStats();
      let rtt = -1;
      let packetsLost = 0;
      let packetsReceived = 0;

      stats.forEach((report: any) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') {
            rtt = report.currentRoundTripTime * 1000; // seconds -> ms
          }
        }
        if (report.type === 'inbound-rtp') {
          if (typeof report.packetsLost === 'number') {
            packetsLost += report.packetsLost;
          }
          if (typeof report.packetsReceived === 'number') {
            packetsReceived += report.packetsReceived;
          }
        }
      });

      if (rtt < 0) return null;

      let quality: ConnectionQuality['quality'];
      if (rtt < 50) quality = 'excellent';
      else if (rtt < 150) quality = 'good';
      else if (rtt < 300) quality = 'fair';
      else quality = 'poor';

      return { rtt: Math.round(rtt), quality, packetsLost, packetsReceived };
    } catch (e) {
      console.warn('[WebRTC] Failed to get connection stats:', e);
      return null;
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
