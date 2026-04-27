import { getIceServers } from '@/config/turn';

const getRtcConfig = (): RTCConfiguration => ({
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
});

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface AudioPacket {
  audio: string;
  sampleRate: number;
  channels: number;
}

export interface WebRTCCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onAudioData: (data: AudioPacket) => void;
  onReaction?: (emoji: string) => void;
  onIceRestartOffer: (offer: RTCSessionDescriptionInit) => void;
  onError: (error: Error) => void;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCCallbacks;
  private _connectionState: ConnectionState = 'disconnected';
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private iceRestartCount = 0;
  private isOfferer = false;
  private onlineHandler: (() => void) | null = null;

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

  async initialize(): Promise<void> {
    try {
      this.peerConnection = new RTCPeerConnection(getRtcConfig());
      const pc = this.peerConnection;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] Local ICE candidate:', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
          });
          this.onLocalIceCandidate?.(event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
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
            this.attemptIceRestart();
            break;
          case 'closed':
            this.cancelIceRestart();
            this.setConnectionState('disconnected');
            break;
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState);
      };

      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };

      // Nudge a reconnect when the browser reports the network came back.
      // Only attached on web (window check guards SSR / non-browser contexts).
      if (typeof window !== 'undefined') {
        this.onlineHandler = () => {
          console.log('[WebRTC] Network back online, nudging reconnect');
          this.nudgeReconnect();
        };
        window.addEventListener('online', this.onlineHandler);
      }

      console.log('[WebRTC] Initialized successfully');
    } catch (error) {
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.isOfferer = true;
    this.setConnectionState('connecting');

    const channel = this.peerConnection.createDataChannel('audio', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.setupDataChannel(channel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.setConnectionState('connecting');

    console.log('[WebRTC] Setting remote description (offer)');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;

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

    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('[WebRTC] Setting remote description (answer)');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    this.remoteDescriptionSet = true;

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

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    if (!this.remoteDescriptionSet) {
      console.log('[WebRTC] Queuing ICE candidate (remote description not set yet)');
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[WebRTC] Failed to add ICE candidate:', e);
    }
  }

  sendAudioData(base64Audio: string, sampleRate: number = 48000, channels: number = 1): void {
    if (this.dataChannel?.readyState === 'open') {
      const packet: AudioPacket = { audio: base64Audio, sampleRate, channels };
      this.dataChannel.send(JSON.stringify(packet));
    }
  }

  sendReaction(emoji: string): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'reaction', emoji }));
    }
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('[WebRTC] Data channel opened');
    };

    channel.onclose = () => {
      console.log('[WebRTC] Data channel closed');
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'reaction') {
          this.callbacks.onReaction?.(data.emoji);
        } else {
          this.callbacks.onAudioData(data as AudioPacket);
        }
      } catch {
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

  onLocalIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;

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

    if (this.iceRestartCount >= 5) {
      console.log('[WebRTC] Max ICE restart attempts reached, giving up');
      this.setConnectionState('failed');
      return;
    }

    this.iceRestartCount++;
    console.log(`[WebRTC] Attempting ICE restart (attempt ${this.iceRestartCount})...`);
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      console.log('[WebRTC] ICE restart offer created, sending via signaling');
      this.callbacks.onIceRestartOffer(offer);
      this.scheduleIceRestart();
    } catch (e) {
      console.error('[WebRTC] ICE restart failed:', e);
      this.scheduleIceRestart();
    }
  }

  /**
   * External nudge to attempt reconnect, e.g. when the tab returns to foreground
   * or the network comes back online. Only acts when the connection isn't healthy.
   */
  nudgeReconnect(): void {
    if (!this.peerConnection) return;
    const state = this.peerConnection.connectionState;
    if (state === 'connected' || state === 'connecting') return;
    console.log('[WebRTC] External reconnect nudge received');
    this.attemptIceRestart();
  }

  close(): void {
    console.log('[WebRTC] Closing connection');
    this.cancelIceRestart();
    if (this.onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    this.dataChannel?.close();
    this.dataChannel = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];
    this.iceRestartCount = 0;
    this.isOfferer = false;

    this.setConnectionState('disconnected');
  }
}
