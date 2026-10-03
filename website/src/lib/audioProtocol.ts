/**
 * Data-channel message protocol for room audio, shared by the app and the
 * website. Keep the two copies identical:
 *   src/lib/audioProtocol.ts
 *   website/src/lib/audioProtocol.ts
 *
 * Messages are strings:
 *   A|<sampleRate>|<channels>|<base64 float32 PCM>        every version
 *   O|<sampleRate>|<channels>|<base64 Opus>[,<base64 Opus>…] 0.2.3+, one or more
 *                                                         20 ms Opus packets
 *   C|caps;dec=opus;ack=0                                 0.2.3+, what the
 *                                                         sender can decode
 *   C|<id>|<url>                                          shared content link
 *   {"type":"reaction","emoji":"…"}                       reactions
 *
 * Compatibility with 0.2.2 and older: those clients act on "C|" messages only
 * when they have three or more "|"-separated parts, so the capability message
 * (one "|") is ignored. They never announce Opus, so they are only ever sent
 * PCM. An "O|" message reaching them would be played as noise, which is why a
 * sender must only use Opus with a peer that announced it on the current
 * channel (see CodecNegotiator).
 */

export type AudioCodec = 'opus';

export type DataChannelMessage =
  | { kind: 'pcm'; audio: string; sampleRate: number; channels: number }
  | { kind: 'opus'; packets: string; sampleRate: number; channels: number }
  | { kind: 'caps'; decodes: AudioCodec[]; ack: boolean }
  | { kind: 'link'; id: string; url: string }
  | { kind: 'reaction'; emoji: string }
  | { kind: 'ignore' };

/** Audio captured locally, in whichever formats are currently enabled. */
export interface CapturedAudio {
  /** base64 float32 PCM, when PCM capture is on */
  audio?: string;
  /**
   * Comma-separated base64 Opus packets. Present (possibly empty, e.g. while
   * the encoder primes) whenever Opus capture is on; absent when it is off.
   */
  opus?: string;
  sampleRate: number;
  channels: number;
}

const CAPS_PREFIX = 'C|caps;';
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const KNOWN_CODECS: readonly AudioCodec[] = ['opus'];

function parseAudioHeader(msg: string): { sampleRate: number; channels: number; body: string } | null {
  const second = msg.indexOf('|', 2);
  const third = second < 0 ? -1 : msg.indexOf('|', second + 1);
  if (third < 0) return null;
  const sampleRate = parseInt(msg.substring(2, second), 10);
  const channels = parseInt(msg.substring(second + 1, third), 10);
  if (!(sampleRate > 0) || !(channels > 0)) return null;
  return { sampleRate, channels, body: msg.substring(third + 1) };
}

export function parseDataChannelMessage(msg: unknown): DataChannelMessage {
  if (typeof msg !== 'string' || msg.length === 0) return { kind: 'ignore' };

  if (msg.startsWith('A|')) {
    const h = parseAudioHeader(msg);
    return h && h.body ? { kind: 'pcm', audio: h.body, sampleRate: h.sampleRate, channels: h.channels } : { kind: 'ignore' };
  }

  if (msg.startsWith('O|')) {
    const h = parseAudioHeader(msg);
    return h && h.body ? { kind: 'opus', packets: h.body, sampleRate: h.sampleRate, channels: h.channels } : { kind: 'ignore' };
  }

  if (msg.startsWith(CAPS_PREFIX)) {
    let decodes: AudioCodec[] = [];
    let ack = false;
    for (const field of msg.substring(CAPS_PREFIX.length).split(';')) {
      const [key, value = ''] = field.split('=');
      if (key === 'dec') decodes = value.split(',').filter((c): c is AudioCodec => (KNOWN_CODECS as string[]).includes(c));
      else if (key === 'ack') ack = value === '1';
    }
    return { kind: 'caps', decodes, ack };
  }

  if (msg.startsWith('C|')) {
    const parts = msg.split('|');
    return parts.length >= 3 ? { kind: 'link', id: parts[1], url: parts.slice(2).join('|') } : { kind: 'ignore' };
  }

  if (msg.charAt(0) === '{') {
    try {
      const data = JSON.parse(msg);
      if (data?.type === 'reaction' && typeof data.emoji === 'string') return { kind: 'reaction', emoji: data.emoji };
      // Legacy JSON audio packet (older web builds)
      if (typeof data?.audio === 'string' && data.audio) {
        return {
          kind: 'pcm',
          audio: data.audio,
          sampleRate: Number(data.sampleRate) > 0 ? Number(data.sampleRate) : 48000,
          channels: Number(data.channels) > 0 ? Number(data.channels) : 1,
        };
      }
    } catch {
      // fall through
    }
    return { kind: 'ignore' };
  }

  // Legacy: bare base64 PCM. Anything else is unknown and dropped rather
  // than played as noise.
  return BASE64_RE.test(msg) ? { kind: 'pcm', audio: msg, sampleRate: 48000, channels: 1 } : { kind: 'ignore' };
}

export function formatPcmMessage(audio: string, sampleRate: number, channels: number): string {
  return `A|${sampleRate}|${channels}|${audio}`;
}

export function formatOpusMessage(packets: string, sampleRate: number, channels: number): string {
  return `O|${sampleRate}|${channels}|${packets}`;
}

export function formatCapsMessage(decodes: readonly AudioCodec[], ack: boolean): string {
  return `${CAPS_PREFIX}dec=${decodes.join(',')};ack=${ack ? 1 : 0}`;
}

/**
 * Pick the message to send one peer for a captured chunk. A peer that decodes
 * Opus gets Opus whenever Opus capture is on (nothing for a chunk with no
 * packet ready, so it never hears the same audio twice), and PCM only while
 * Opus capture is off. Other peers get PCM.
 */
export function chooseAudioMessage(captured: CapturedAudio, peerDecodesOpus: boolean): string | null {
  if (peerDecodesOpus && captured.opus !== undefined) {
    return captured.opus ? formatOpusMessage(captured.opus, 48000, captured.channels) : null;
  }
  if (captured.audio) return formatPcmMessage(captured.audio, captured.sampleRate, captured.channels);
  return null;
}

export interface CodecNegotiatorOptions {
  /** Send a string on the peer's data channel (no-op if it isn't open). */
  send: (msg: string) => void;
  /** Codecs this device can decode right now. Empty means "announce nothing". */
  localDecodes: () => readonly AudioCodec[];
  /** Called when what the peer decodes changes. */
  onChange?: () => void;
  retryMs?: number;
  maxAnnouncements?: number;
}

/**
 * Per-peer, per-channel capability exchange. Each side announces what it can
 * decode when the channel opens and repeats the announcement (the channel is
 * unreliable) until it hears the peer's, or gives up because the peer is an
 * older client that never answers. An announcement with ack=0 means "I don't
 * have yours yet", so the receiver answers it.
 *
 * reset() must be called whenever the channel or the peer behind it may have
 * changed (new channel, renegotiation, reconnect), so Opus is never sent to a
 * peer that hasn't announced it on the current channel.
 */
export class CodecNegotiator {
  private remote: AudioCodec[] = [];
  private heardRemote = false;
  private announcements = 0;
  private started = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly retryMs: number;
  private readonly maxAnnouncements: number;

  constructor(private readonly opts: CodecNegotiatorOptions) {
    this.retryMs = opts.retryMs ?? 2000;
    this.maxAnnouncements = opts.maxAnnouncements ?? 10;
  }

  /** The channel is open: start announcing. */
  start(): void {
    this.reset();
    this.started = true;
    if (this.opts.localDecodes().length === 0) return;
    this.announce();
  }

  /**
   * What this device decodes changed (e.g. Opus decoding started failing):
   * tell the peer now so it switches format.
   */
  reannounce(): void {
    if (!this.started) return;
    this.opts.send(formatCapsMessage(this.opts.localDecodes(), this.heardRemote));
  }

  /** Forget the peer's capabilities and stop announcing. */
  reset(): void {
    this.clearTimer();
    this.started = false;
    this.announcements = 0;
    this.heardRemote = false;
    if (this.remote.length > 0) {
      this.remote = [];
      this.opts.onChange?.();
    }
  }

  stop(): void {
    this.reset();
  }

  handleCaps(decodes: AudioCodec[], ack: boolean): void {
    const first = !this.heardRemote;
    this.heardRemote = true;
    this.clearTimer();
    const changed = decodes.join(',') !== this.remote.join(',');
    this.remote = [...decodes];
    // The peer hasn't heard us yet: answer (only if we have something to say)
    const local = this.opts.localDecodes();
    if (!ack && local.length > 0) this.opts.send(formatCapsMessage(local, true));
    if (changed || first) this.opts.onChange?.();
  }

  get peerDecodesOpus(): boolean {
    return this.remote.includes('opus');
  }

  /** True once the peer has announced (or we gave up waiting). */
  get settled(): boolean {
    return this.heardRemote || this.announcements >= this.maxAnnouncements;
  }

  private announce(): void {
    if (this.heardRemote || this.announcements >= this.maxAnnouncements) return;
    this.announcements++;
    this.opts.send(formatCapsMessage(this.opts.localDecodes(), false));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.announce();
    }, this.retryMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Decides which formats local capture produces, from what the connected peers
 * decode and whether the local Opus encoder is actually producing packets.
 * PCM stays on until Opus has been seen working, so a codec that fails on a
 * particular device degrades to PCM instead of silence.
 */
export class CaptureFormatController {
  private canEncode = false;
  private encoderFailed = false;
  private opusChunks = 0;
  private emptyRun = 0;
  private peerOpus: boolean[] = [];
  private current = { pcm: true, opus: false };

  /** Opus chunks needed before PCM may be switched off. */
  static readonly PROVEN_AFTER = 3;
  /** Consecutive empty Opus chunks (about 20 ms each) before giving up on the encoder. */
  static readonly FAIL_AFTER = 50;

  constructor(private readonly apply: (pcm: boolean, opus: boolean) => void) {}

  setCanEncode(canEncode: boolean): void {
    this.canEncode = canEncode;
    this.recompute();
  }

  /** One entry per connected peer: whether it decodes Opus. */
  setPeers(peerOpus: boolean[]): void {
    this.peerOpus = peerOpus;
    this.recompute();
  }

  /** Feed every captured chunk so encoder health can be tracked. */
  onCaptured(chunk: CapturedAudio): void {
    if (!this.current.opus || this.encoderFailed) return;
    if (chunk.opus) {
      this.emptyRun = 0;
      if (++this.opusChunks === CaptureFormatController.PROVEN_AFTER) this.recompute();
    } else if (++this.emptyRun >= CaptureFormatController.FAIL_AFTER) {
      this.encoderFailed = true;
      this.recompute();
    }
  }

  /** The encoder reported an error: stop using Opus for this session. */
  markEncoderFailed(): void {
    if (this.encoderFailed) return;
    this.encoderFailed = true;
    this.recompute();
  }

  get formats(): { pcm: boolean; opus: boolean } {
    return { ...this.current };
  }

  get opusEncoderFailed(): boolean {
    return this.encoderFailed;
  }

  private recompute(): void {
    const opus = this.canEncode && !this.encoderFailed && this.peerOpus.some(Boolean);
    const proven = this.opusChunks >= CaptureFormatController.PROVEN_AFTER;
    const pcm = !opus || !proven || this.peerOpus.length === 0 || this.peerOpus.some((p) => !p);
    if (pcm === this.current.pcm && opus === this.current.opus) return;
    this.current = { pcm, opus };
    this.apply(pcm, opus);
  }
}

/**
 * Tracks Opus playback failures. After too many in a row this device stops
 * announcing Opus, so peers fall back to PCM.
 */
export class DecodeHealth {
  private failures = 0;
  private disabled = false;
  static readonly FAIL_AFTER = 10;

  constructor(private readonly onDisabled: () => void) {}

  success(): void {
    this.failures = 0;
  }

  failure(): void {
    if (this.disabled) return;
    if (++this.failures >= DecodeHealth.FAIL_AFTER) {
      this.disabled = true;
      this.onDisabled();
    }
  }

  get opusDisabled(): boolean {
    return this.disabled;
  }
}
