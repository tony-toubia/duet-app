import { Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { getIceServers, ensureTurnCredentials } from '@/config/turn';
import type { AudioPacket, OpusPacket } from './WebRTCService';
import { lifecycle } from './LifecycleLog';
import {
  AudioCodec,
  CapturedAudio,
  CodecNegotiator,
  chooseAudioMessage,
  formatPcmMessage,
  parseDataChannelMessage,
} from '@/lib/audioProtocol';

export type PartyConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface PartyWebRTCCallbacks {
  onConnectionStateChange: (uid: string, state: PartyConnectionState) => void;
  onAudioData: (uid: string, data: AudioPacket) => void;
  onOpusData?: (uid: string, data: OpusPacket) => void;
  /** What some peer can decode changed */
  onCodecChange?: () => void;
  /** Codecs this device can decode right now (default: none) */
  localDecodes?: () => readonly AudioCodec[];
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
  public negotiator: CodecNegotiator;

  constructor(pc: RTCPeerConnection, callbacks: PartyWebRTCCallbacks) {
    this.pc = pc;
    this.negotiator = new CodecNegotiator({
      send: (msg) => this.send(msg),
      localDecodes: () => callbacks.localDecodes?.() ?? [],
      onChange: () => callbacks.onCodecChange?.(),
    });
  }

  send(msg: string): void {
    if (this.dataChannel?.readyState === 'open') {
      try {
        this.dataChannel.send(msg);
      } catch (e) {
        console.warn('[PartyWebRTC] Data channel send failed:', e);
      }
    }
  }

  /** (Re)start the codec exchange whenever the peer behind the channel may have changed. */
  restartNegotiation(): void {
    if (this.dataChannel?.readyState === 'open') this.negotiator.start();
    else this.negotiator.reset();
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
    const context = new PeerContext(pc, this.callbacks);
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
          if (context.state !== 'connected') context.restartNegotiation();
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
      lifecycle('party.peer.state', { uid, state: context.state });
      this.callbacks.onConnectionStateChange(uid, context.state);
    };

    safePc.ondatachannel = (event: any) => {
      this.setupDataChannel(uid, context, event.channel);
    };

    return context;
  }

  async createOffer(toUid: string): Promise<RTCSessionDescription> {
    // Peer connections pick up relay credentials at creation (cached; bounded wait)
    await ensureTurnCredentials();
    let context = this.peers.get(toUid);
    if (!context) {
      context = this.createPeerConnection(toUid);
    }

    context.isOfferer = true;
    // react-native-webrtc's channel type doesn't match the DOM lib type
    const channel = context.pc.createDataChannel('audio', {
      ordered: false,
      maxRetransmits: 0,
    }) as any;
    this.setupDataChannel(toUid, context, channel);

    const offer = await context.pc.createOffer({} as any);
    await context.pc.setLocalDescription(offer);

    return offer as RTCSessionDescription;
  }

  async handleOffer(fromUid: string, offer: RTCSessionDescription): Promise<RTCSessionDescription> {
    // Peer connections pick up relay credentials at creation (cached; bounded wait)
    await ensureTurnCredentials();
    let context = this.peers.get(fromUid);
    if (!context) context = this.createPeerConnection(fromUid);

    context.restartNegotiation();
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
    // Peer connections pick up relay credentials at creation (cached; bounded wait)
    await ensureTurnCredentials();
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

  /**
   * Send captured audio to every peer, each in the format it decodes: Opus
   * if it announced Opus and a packet is ready, otherwise PCM.
   */
  sendAudio(captured: CapturedAudio): void {
    this.peers.forEach((context) => {
      const msg = chooseAudioMessage(captured, context.negotiator.peerDecodesOpus);
      if (msg) context.send(msg);
    });
  }

  /** Send PCM audio data to every peer: "A|sampleRate|channels|base64Audio". */
  sendAudioData(base64Audio: string, sampleRate: number = 48000, channels: number = 1): void {
    const payload = formatPcmMessage(base64Audio, sampleRate, channels);
    this.peers.forEach((context) => context.send(payload));
  }

  /** Whether each peer with an open channel decodes Opus. */
  peerCodecs(): boolean[] {
    const result: boolean[] = [];
    this.peers.forEach((context) => {
      if (context.dataChannel?.readyState === 'open') result.push(context.negotiator.peerDecodesOpus);
    });
    return result;
  }

  /** Re-tell every peer what this device decodes (after it changed). */
  reannounceCodecs(): void {
    this.peers.forEach((context) => context.negotiator.reannounce());
  }

  removePeer(uid: string) {
    const context = this.peers.get(uid);
    if (context) {
      this.cancelIceRestart(context);
      context.negotiator.stop();
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
    lifecycle('party.peer.ice.restart', { uid, attempt: context.iceRestartCount });
    try {
      // Relay credentials expire after 24h: refresh before restarting ICE
      if (await ensureTurnCredentials()) {
        try {
          (context.pc as any).setConfiguration?.(getRtcConfig());
        } catch (e) {
          console.warn(`[PartyWebRTC] Could not apply refreshed relay credentials for ${uid}:`, e);
        }
      }
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
      // External signal (foreground/network change) — escape the give-up cap
      context.iceRestartCount = 0;
      this.attemptIceRestart(uid, context);
    });
  }

  private setupDataChannel(uid: string, context: PeerContext, channel: RTCDataChannel) {
    context.dataChannel = channel;
    context.negotiator.reset();

    channel.onopen = () => context.negotiator.start();
    channel.onclose = () => {
      // Only if this is still the peer's channel (a renegotiation may have replaced it)
      if (context.dataChannel === channel) context.negotiator.reset();
    };

    channel.onmessage = (event) => {
      const msg = parseDataChannelMessage(event.data);
      switch (msg.kind) {
        case 'pcm':
          this.callbacks.onAudioData(uid, { audio: msg.audio, sampleRate: msg.sampleRate, channels: msg.channels });
          break;
        case 'opus':
          this.callbacks.onOpusData?.(uid, { packets: msg.packets, sampleRate: msg.sampleRate, channels: msg.channels });
          break;
        case 'caps':
          context.negotiator.handleCaps(msg.decodes, msg.ack);
          break;
        case 'link':
          this.callbacks.onDeepLink?.(uid, msg.url);
          break;
        case 'reaction':
          this.callbacks.onReaction?.(uid, msg.emoji);
          break;
      }
    };

    // A channel received from the peer may already be open
    if (channel.readyState === 'open') context.negotiator.start();
  }

  close(): void {
    this.peers.forEach((context) => {
      this.cancelIceRestart(context);
      context.negotiator.stop();
      context.dataChannel?.close();
      context.pc.close();
    });
    this.peers.clear();
  }
}

export default PartyWebRTCService;
