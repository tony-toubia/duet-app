// src/services/webrtc.ts
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { sendSignal, listenForSignals, sendIceCandidate, listenForIceCandidates } from './firebase';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface WebRTCCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onError: (error: Error) => void;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private roomId: string = '';
  private oderId: string = '';
  private callbacks: WebRTCCallbacks;
  private unsubscribeSignals: (() => void) | null = null;
  private unsubscribeCandidates: (() => void) | null = null;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  async initializeLocalStream(): Promise<MediaStream> {
    const stream = await mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    this.localStream = stream;
    return stream;
  }

  async createRoom(roomId: string, oderId: string): Promise<void> {
    this.roomId = roomId;
    this.oderId = oderId;
    this.setupPeerConnection();
    this.listenForSignaling();
    this.callbacks.onConnectionStateChange('connecting');
  }

  async joinRoom(roomId: string, oderId: string): Promise<void> {
    this.roomId = roomId;
    this.oderId = oderId;
    this.setupPeerConnection();
    this.listenForSignaling();
    await this.createAndSendOffer();
    this.callbacks.onConnectionStateChange('connecting');
  }

  private setupPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    const pc = this.peerConnection as any;

    pc.ontrack = (event: any) => {
      if (event.streams?.[0]) this.callbacks.onRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        sendIceCandidate(this.roomId, this.oderId, event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') this.callbacks.onConnectionStateChange('connected');
      else if (state === 'disconnected' || state === 'closed') this.callbacks.onConnectionStateChange('disconnected');
      else if (state === 'failed') this.callbacks.onConnectionStateChange('failed');
    };
  }

  private listenForSignaling(): void {
    this.unsubscribeSignals = listenForSignals(this.roomId, this.oderId, async (signal) => {
      if (signal.type === 'offer') await this.handleOffer(signal);
      else if (signal.type === 'answer') await this.handleAnswer(signal);
    }) as any;

    this.unsubscribeCandidates = listenForIceCandidates(this.roomId, this.oderId, async (candidate) => {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }) as any;
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
    await this.peerConnection.setLocalDescription(offer);
    await sendSignal(this.roomId, this.oderId, offer);
  }

  private async handleOffer(offer: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await sendSignal(this.roomId, this.oderId, answer);
  }

  private async handleAnswer(answer: RTCSessionDescription): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }

  disconnect(): void {
    this.unsubscribeSignals?.();
    this.unsubscribeCandidates?.();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.peerConnection?.close();
    this.peerConnection = null;
    this.callbacks.onConnectionStateChange('disconnected');
  }
}
