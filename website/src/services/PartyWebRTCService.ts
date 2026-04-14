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
  onError: (error: Error) => void;
}

const getRtcConfig = (): RTCConfiguration => ({
  iceServers: getIceServers(),
  iceCandidatePoolSize: 5,
  iceTransportPolicy: 'all',
});

class PeerContext {
  public pc: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  public state: PartyConnectionState = 'connecting';
  public pendingCandidates: RTCIceCandidateInit[] = [];
  public remoteDescriptionSet = false;

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

  public onLocalIceCandidate:
    | ((toUid: string, candidate: RTCIceCandidate) => void)
    | null = null;

  private createPeerConnection(uid: string): PeerContext {
    const pc = new RTCPeerConnection(getRtcConfig());
    const context = new PeerContext(pc);
    this.peers.set(uid, context);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateStr: string = event.candidate.candidate || '';
        if (candidateStr.includes('.local')) return;
        this.onLocalIceCandidate?.(uid, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      switch (state) {
        case 'connected':
          context.state = 'connected';
          break;
        case 'disconnected':
          context.state = 'reconnecting';
          break;
        case 'failed':
          context.state = 'failed';
          break;
        case 'closed':
          context.state = 'disconnected';
          break;
      }
      this.callbacks.onConnectionStateChange(uid, context.state);
    };

    pc.ondatachannel = (event) => {
      this.setupDataChannel(uid, context, event.channel);
    };

    return context;
  }

  async createOffer(toUid: string): Promise<RTCSessionDescriptionInit> {
    let context = this.peers.get(toUid);
    if (!context) {
      context = this.createPeerConnection(toUid);
    }

    context.dataChannel = context.pc.createDataChannel('audio', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.setupDataChannel(toUid, context, context.dataChannel);

    const offer = await context.pc.createOffer();
    await context.pc.setLocalDescription(offer);

    return offer;
  }

  async handleOffer(
    fromUid: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    let context = this.peers.get(fromUid);
    if (!context) context = this.createPeerConnection(fromUid);

    await context.pc.setRemoteDescription(new RTCSessionDescription(offer));
    context.remoteDescriptionSet = true;

    for (const candidate of context.pendingCandidates) {
      try {
        await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn(
          `[PartyWebRTC] Failed adding candidate for ${fromUid}`,
          e
        );
      }
    }
    context.pendingCandidates = [];

    const answer = await context.pc.createAnswer();
    await context.pc.setLocalDescription(answer);

    return answer;
  }

  async handleAnswer(
    fromUid: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    const context = this.peers.get(fromUid);
    if (!context) throw new Error(`PC for ${fromUid} not found`);

    await context.pc.setRemoteDescription(new RTCSessionDescription(answer));
    context.remoteDescriptionSet = true;

    for (const candidate of context.pendingCandidates) {
      try {
        await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Silently fail stale candidates
      }
    }
    context.pendingCandidates = [];
  }

  async addIceCandidate(
    fromUid: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    let context = this.peers.get(fromUid);
    if (!context) context = this.createPeerConnection(fromUid);

    if (!context.remoteDescriptionSet) {
      context.pendingCandidates.push(candidate);
      return;
    }

    try {
      await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Silently fail
    }
  }

  sendAudioData(
    base64Audio: string,
    sampleRate: number = 48000,
    channels: number = 1
  ): void {
    const payload = `A|${sampleRate}|${channels}|${base64Audio}`;
    this.peers.forEach((context) => {
      if (context.dataChannel?.readyState === 'open') {
        context.dataChannel.send(payload);
      }
    });
  }

  sendReaction(emoji: string): void {
    const payload = JSON.stringify({ type: 'reaction', emoji });
    this.peers.forEach((context) => {
      if (context.dataChannel?.readyState === 'open') {
        context.dataChannel.send(payload);
      }
    });
  }

  removePeer(uid: string) {
    const context = this.peers.get(uid);
    if (context) {
      context.dataChannel?.close();
      context.pc.close();
      this.peers.delete(uid);
    }
  }

  getConnectedPeerCount(): number {
    let count = 0;
    this.peers.forEach((ctx) => {
      if (ctx.state === 'connected') count++;
    });
    return count;
  }

  private setupDataChannel(
    uid: string,
    context: PeerContext,
    channel: RTCDataChannel
  ) {
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
      } catch {
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
      context.dataChannel?.close();
      context.pc.close();
    });
    this.peers.clear();
  }
}
