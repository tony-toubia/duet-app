import { Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { getIceServers } from '@/config/turn';
import type { AudioPacket } from './WebRTCService';

export type PartyConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface PartyWebRTCCallbacks {
  onConnectionStateChange: (uid: string, state: PartyConnectionState) => void;
  onAudioData: (uid: string, data: AudioPacket) => void;
  onReaction?: (uid: string, emoji: string) => void;
  onDeepLink?: (uid: string, url: string) => void;
  onIceRestartOffer: (uid: string, offer: RTCSessionDescription) => void;
  onError: (error: Error) => void;
}

const getRtcConfig = () => ({
  iceServers: getIceServers(),
  iceCandidatePoolSize: 5,
  iceTransportPolicy: (Platform.OS === 'ios' ? 'nohost' : 'all') as 'all' | 'relay',
});

class PeerContext {
  public pc: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  public state: PartyConnectionState = 'connecting';
  public pendingCandidates: RTCIceCandidate[] = [];
  public remoteDescriptionSet = false;
  public isOfferer = false;
  public iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
  public iceRestartCount = 0;

  constructor(pc: RTCPeerConnection) {
    this.pc = pc;
  }
}

export class PartyWebRTCService {
  private peers = new Map<string, PeerContext>();
  private callbacks: PartyWebRTCCallbacks;

  constructor(callbacks: PartyWebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public onLocalIceCandidate: ((toUid: string, candidate: RTCIceCandidate) => void) | null = null;

  private createPeerConnection(uid: string): PeerContext {
    const pc = new RTCPeerConnection(getRtcConfig());
    const context = new PeerContext(pc);
    this.peers.set(uid, context);

    const safePc = pc as any;

    safePc.onicecandidate = (event: any) => {
      if (event.candidate) {
        const candidateStr: string = event.candidate.candidate || '';
        if (candidateStr.includes('.local')) return;
        this.onLocalIceCandidate?.(uid, event.candidate);
      }
    };

    safePc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      switch (state) {
        case 'connected':
          context.state = 'connected';
          this.cancelIceRestart(context);
          context.iceRestartCount = 0;
          break;
        case 'disconnected':
          context.state = 'reconnecting';
          this.scheduleIceRestart(uid, context);
          break;
        case 'failed':
          context.state = 'failed';
          this.cancelIceRestart(context);
          this.attemptIceRestart(uid, context);
          break;
        case 'closed':
          context.state = 'disconnected';
          this.cancelIceRestart(context);
          break;
      }
      this.callbacks.onConnectionStateChange(uid, context.state);
    };

    safePc.ondatachannel = (event: any) => {
      this.setupDataChannel(uid, context, event.channel);
    };

    return context;
  }

  async createOffer(toUid: string): Promise<RTCSessionDescription> {
    let context = this.peers.get(toUid);
    if (!context) {
      context = this.createPeerConnection(toUid);
    }

    context.isOfferer = true;
    context.dataChannel = context.pc.createDataChannel('audio', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.setupDataChannel(toUid, context, context.dataChannel);

    const offer = await context.pc.createOffer({} as any);
    await context.pc.setLocalDescription(offer);

    return offer as RTCSessionDescription;
  }

  async handleOffer(fromUid: string, offer: RTCSessionDescription): Promise<RTCSessionDescription> {
    let context = this.peers.get(fromUid);
    if (!context) context = this.createPeerConnection(fromUid);

    await context.pc.setRemoteDescription(new RTCSessionDescription(offer));
    context.remoteDescriptionSet = true;

    for (const candidate of context.pendingCandidates) {
      try {
        await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn(`[PartyWebRTC] Failed adding candidate for ${fromUid}`, e);
      }
    }
    context.pendingCandidates = [];

    const answer = await context.pc.createAnswer();
    await context.pc.setLocalDescription(answer);
    
    return answer as RTCSessionDescription;
  }

  async handleAnswer(fromUid: string, answer: RTCSessionDescription): Promise<void> {
    const context = this.peers.get(fromUid);
    if (!context) throw new Error(`PC for ${fromUid} not found`);

    await context.pc.setRemoteDescription(new RTCSessionDescription(answer));
    context.remoteDescriptionSet = true;

    for (const candidate of context.pendingCandidates) {
      try {
        await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
    context.pendingCandidates = [];
  }

  async addIceCandidate(fromUid: string, candidate: RTCIceCandidate): Promise<void> {
    let context = this.peers.get(fromUid);
    // It's possible candidates arrive slightly before the offer
    if (!context) context = this.createPeerConnection(fromUid);

    if (!context.remoteDescriptionSet) {
      context.pendingCandidates.push(candidate);
      return;
    }

    try {
      await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {}
  }

  sendAudioData(base64Audio: string, sampleRate: number = 48000, channels: number = 1): void {
    const payload = `A|${sampleRate}|${channels}|${base64Audio}`;
    this.peers.forEach((context) => {
      if (context.dataChannel?.readyState === 'open') {
         context.dataChannel.send(payload);
      }
    });
  }

  removePeer(uid: string) {
    const context = this.peers.get(uid);
    if (context) {
      this.cancelIceRestart(context);
      context.dataChannel?.close();
      context.pc.close();
      this.peers.delete(uid);
    }
  }

  /**
   * Per-peer ICE restart with exponential backoff. Only the original offerer
   * for that pair attempts restart, to avoid simultaneous offers colliding
   * across the mesh. The other side renegotiates by handling the offer.
   */
  private scheduleIceRestart(uid: string, context: PeerContext): void {
    if (!context.isOfferer) return;
    this.cancelIceRestart(context);
    const delay = Math.min(3000 * Math.pow(2, context.iceRestartCount), 30000);
    context.iceRestartTimer = setTimeout(() => {
      this.attemptIceRestart(uid, context);
    }, delay);
    console.log(`[PartyWebRTC] ICE restart for ${uid} in ${delay / 1000}s (attempt ${context.iceRestartCount + 1})`);
  }

  private cancelIceRestart(context: PeerContext): void {
    if (context.iceRestartTimer) {
      clearTimeout(context.iceRestartTimer);
      context.iceRestartTimer = null;
    }
  }

  private async attemptIceRestart(uid: string, context: PeerContext): Promise<void> {
    if (!context.isOfferer) return;
    if (context.pc.connectionState === 'connected') {
      console.log(`[PartyWebRTC] ${uid} recovered, skipping ICE restart`);
      return;
    }
    if (context.iceRestartCount >= 5) {
      console.log(`[PartyWebRTC] Max ICE restart attempts for ${uid}, giving up`);
      context.state = 'failed';
      this.callbacks.onConnectionStateChange(uid, 'failed');
      return;
    }
    context.iceRestartCount++;
    console.log(`[PartyWebRTC] Attempting ICE restart for ${uid} (attempt ${context.iceRestartCount})`);
    try {
      const offer = await context.pc.createOffer({ iceRestart: true } as any);
      await context.pc.setLocalDescription(offer);
      this.callbacks.onIceRestartOffer(uid, offer as RTCSessionDescription);
      this.scheduleIceRestart(uid, context);
    } catch (e) {
      console.error(`[PartyWebRTC] ICE restart failed for ${uid}:`, e);
      this.scheduleIceRestart(uid, context);
    }
  }

  /**
   * External nudge to attempt reconnect for all unhealthy peers, e.g. after
   * the app returns from background or a network change.
   */
  nudgeReconnect(): void {
    this.peers.forEach((context, uid) => {
      const state = context.pc.connectionState;
      if (state === 'connected' || state === 'connecting') return;
      this.attemptIceRestart(uid, context);
    });
  }

  private setupDataChannel(uid: string, context: PeerContext, channel: RTCDataChannel) {
    context.dataChannel = channel;

    channel.onmessage = (event) => {
      const msg: string = event.data;
      if (msg.startsWith('A|')) {
        const firstPipe = 2;
        const secondPipe = msg.indexOf('|', firstPipe);
        const thirdPipe = msg.indexOf('|', secondPipe + 1);
        this.callbacks.onAudioData(uid, {
          audio: msg.substring(thirdPipe + 1),
          sampleRate: parseInt(msg.substring(firstPipe, secondPipe), 10),
          channels: parseInt(msg.substring(secondPipe + 1, thirdPipe), 10),
        });
        return;
      }

      if (msg.startsWith('C|')) {
        const parts = msg.split('|');
        if (parts.length >= 3) {
          this.callbacks.onDeepLink?.(uid, parts[2]);
        }
        return;
      }

      try {
        const data = JSON.parse(msg);
        if (data.type === 'reaction') {
          this.callbacks.onReaction?.(uid, data.emoji);
        } else {
          this.callbacks.onAudioData(uid, data as AudioPacket);
        }
      } catch (e) {
        this.callbacks.onAudioData(uid, {
          audio: msg,
          sampleRate: 48000,
          channels: 1,
        });
      }
    };
  }

  close(): void {
    this.peers.forEach((context) => {
      this.cancelIceRestart(context);
      context.dataChannel?.close();
      context.pc.close();
    });
    this.peers.clear();
  }
}

export default PartyWebRTCService;
