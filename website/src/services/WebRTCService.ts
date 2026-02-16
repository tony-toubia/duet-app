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
  onError: (error: Error) => void;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCCallbacks;
  private _connectionState: ConnectionState = 'disconnected';
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

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

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState);
      };

      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };

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
        const packet: AudioPacket = JSON.parse(event.data);
        this.callbacks.onAudioData(packet);
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

  close(): void {
    console.log('[WebRTC] Closing connection');
    this.dataChannel?.close();
    this.dataChannel = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];

    this.setConnectionState('disconnected');
  }
}
