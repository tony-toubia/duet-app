/**
 * Web Audio Engine
 *
 * Replaces the native DuetAudio module for browser environments.
 * Uses AudioWorklet for low-latency capture and playback.
 *
 * Audio format (must match native):
 *   - Float32 samples, little-endian
 *   - 48kHz mono
 *   - 960 samples per chunk (20ms)
 *   - Base64 encoded for data channel transport
 *
 * Opus (src/lib/audioProtocol.ts) uses the browser's WebCodecs encoder and
 * decoder where available: 20 ms packets, 48 kHz mono, 32 kbps.
 */

import { float32ToBase64, base64ToFloat32 } from './base64';
import { resample } from './resample';
import type { CapturedAudio } from '@/lib/audioProtocol';

export interface CodecSupport {
  opusEncode: boolean;
  opusDecode: boolean;
}

export interface WebAudioEngineCallbacks {
  /** Captured audio, in whichever formats are enabled (see setCaptureFormats) */
  onAudioData: (captured: CapturedAudio) => void;
  onVoiceActivity: (speaking: boolean) => void;
  onError: (error: Error) => void;
  /** The Opus encoder failed; Opus capture has been switched off */
  onOpusEncoderError?: () => void;
  /** An Opus decoder failed (counts toward giving up on Opus playback) */
  onOpusDecodeError?: () => void;
}

const OPUS_CONFIG = { codec: 'opus', sampleRate: 48000, numberOfChannels: 1 } as const;
const OPUS_BITRATE = 32000;
const OPUS_PACKET_US = 20000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

interface OpusStream {
  decoder: AudioDecoder;
  timestamp: number;
}

export class WebAudioEngine {
  private audioContext: AudioContext | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private playbackNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private callbacks: WebAudioEngineCallbacks;
  private isMuted = false;
  private isDeafened = false;
  private browserSampleRate = 48000;

  // Opus state
  private capturePcm = true;
  private captureOpus = false;
  private encoder: AudioEncoder | null = null;
  private encoderTimestamp = 0;
  private decoders = new Map<string, OpusStream>();

  constructor(callbacks: WebAudioEngineCallbacks) {
    this.callbacks = callbacks;
  }

  /** Whether this browser can encode and decode Opus with WebCodecs. */
  static async getCodecSupport(): Promise<CodecSupport> {
    const check = async (fn: () => Promise<{ supported?: boolean }>): Promise<boolean> => {
      try {
        return (await fn()).supported === true;
      } catch {
        return false;
      }
    };
    const opusEncode =
      typeof AudioEncoder !== 'undefined' &&
      typeof AudioData !== 'undefined' &&
      (await check(() => AudioEncoder.isConfigSupported({ ...OPUS_CONFIG, bitrate: OPUS_BITRATE })));
    const opusDecode =
      typeof AudioDecoder !== 'undefined' &&
      typeof EncodedAudioChunk !== 'undefined' &&
      (await check(() => AudioDecoder.isConfigSupported({ ...OPUS_CONFIG })));
    return { opusEncode, opusDecode };
  }

  /** Choose which formats captured audio is delivered in. Default: PCM only. */
  setCaptureFormats(pcm: boolean, opus: boolean): void {
    this.capturePcm = pcm;
    this.captureOpus = opus;
    if (!opus) this.closeEncoder();
  }

  private ensureEncoder(): AudioEncoder | null {
    if (this.encoder) return this.encoder;
    try {
      const encoder = new AudioEncoder({
        output: (chunk) => {
          const bytes = new Uint8Array(chunk.byteLength);
          chunk.copyTo(bytes);
          // Packets go out on their own, to Opus peers only
          this.callbacks.onAudioData({ opus: bytesToBase64(bytes), sampleRate: 48000, channels: 1 });
        },
        error: (e) => {
          console.warn('[WebAudio] Opus encoder error:', e);
          this.closeEncoder();
          this.captureOpus = false;
          this.callbacks.onOpusEncoderError?.();
        },
      });
      encoder.configure({ ...OPUS_CONFIG, bitrate: OPUS_BITRATE, opus: { frameDuration: OPUS_PACKET_US, format: 'opus' } });
      this.encoder = encoder;
      this.encoderTimestamp = 0;
      return encoder;
    } catch (e) {
      console.warn('[WebAudio] Opus encoder unavailable:', e);
      this.captureOpus = false;
      this.callbacks.onOpusEncoderError?.();
      return null;
    }
  }

  private closeEncoder(): void {
    if (!this.encoder) return;
    try {
      if (this.encoder.state !== 'closed') this.encoder.close();
    } catch {
      // already closed
    }
    this.encoder = null;
  }

  private encodeOpus(samples: Float32Array): void {
    const encoder = this.ensureEncoder();
    if (!encoder || encoder.state !== 'configured') return;
    const data = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: samples.length,
      numberOfChannels: 1,
      timestamp: this.encoderTimestamp,
      data: new Float32Array(samples),
    });
    this.encoderTimestamp += Math.round((samples.length * 1e6) / 48000);
    try {
      encoder.encode(data);
    } finally {
      data.close();
    }
  }

  private getDecoder(streamId: string): OpusStream | null {
    const existing = this.decoders.get(streamId);
    if (existing && existing.decoder.state === 'configured') return existing;
    try {
      const decoder = new AudioDecoder({
        output: (audio) => {
          try {
            const samples = new Float32Array(audio.numberOfFrames);
            audio.copyTo(samples, { planeIndex: 0, format: 'f32-planar' });
            this.playSamples(samples, audio.sampleRate, streamId);
          } finally {
            audio.close();
          }
        },
        error: (e) => {
          console.warn('[WebAudio] Opus decoder error:', e);
          this.decoders.delete(streamId);
          this.callbacks.onOpusDecodeError?.();
        },
      });
      decoder.configure({ ...OPUS_CONFIG });
      const stream = { decoder, timestamp: 0 };
      this.decoders.set(streamId, stream);
      return stream;
    } catch (e) {
      console.warn('[WebAudio] Opus decoder unavailable:', e);
      return null;
    }
  }

  /**
   * Play comma-separated base64 Opus packets from one remote stream. Returns
   * false if they couldn't be decoded.
   */
  playOpus(streamId: string, packets: string): boolean {
    if (this.isDeafened || !this.playbackNode) return true;
    const stream = this.getDecoder(streamId);
    if (!stream) return false;
    let ok = true;
    for (const b64 of packets.split(',')) {
      const bytes = b64 ? base64ToBytes(b64) : null;
      if (!bytes || bytes.length === 0) {
        ok = false;
        continue;
      }
      try {
        stream.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: stream.timestamp, data: bytes }));
        stream.timestamp += OPUS_PACKET_US;
      } catch (e) {
        console.warn('[WebAudio] Opus decode failed:', e);
        ok = false;
      }
    }
    return ok;
  }

  async setup(): Promise<{ sampleRate: number }> {
    this.audioContext = new AudioContext({ sampleRate: 48000 });

    // Some browsers may not honor the requested sample rate
    this.browserSampleRate = this.audioContext.sampleRate;
    console.log('[WebAudio] AudioContext sample rate:', this.browserSampleRate);

    // Load worklet processors
    await this.audioContext.audioWorklet.addModule('/audio/capture-processor.js');
    await this.audioContext.audioWorklet.addModule('/audio/playback-processor.js');

    return { sampleRate: 48000 };
  }

  async start(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio engine not set up. Call setup() first.');
    }

    // Resume context (required after user gesture in most browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Get microphone
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      },
    });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Create capture worklet node
    this.captureNode = new AudioWorkletNode(this.audioContext, 'capture-processor');
    this.captureNode.port.onmessage = (event) => {
      if (this.isMuted) return;

      if (event.data.type === 'audio') {
        let samples: Float32Array = event.data.samples;

        // Resample to 48kHz if browser uses a different rate
        if (this.browserSampleRate !== 48000) {
          samples = resample(samples, this.browserSampleRate, 48000);
        }

        // Encoded packets arrive asynchronously via the encoder's output
        // callback. While Opus is on, PCM chunks carry opus: '' so Opus peers
        // skip them (see chooseAudioMessage).
        const opusOn = this.captureOpus;
        if (opusOn) this.encodeOpus(samples);
        if (this.capturePcm) {
          this.callbacks.onAudioData({
            audio: float32ToBase64(samples),
            ...(opusOn ? { opus: '' } : {}),
            sampleRate: 48000,
            channels: 1,
          });
        }
      } else if (event.data.type === 'voiceActivity') {
        this.callbacks.onVoiceActivity(event.data.speaking);
      }
    };

    // Connect: mic → capture processor (capture doesn't output to speakers)
    this.sourceNode.connect(this.captureNode);
    // Connect to a dummy destination to keep the worklet alive
    this.captureNode.connect(this.audioContext.destination);

    // Create playback worklet node
    this.playbackNode = new AudioWorkletNode(this.audioContext, 'playback-processor');
    this.playbackNode.connect(this.audioContext.destination);

    console.log('[WebAudio] Started capture and playback');
  }

  stop(): void {
    this.closeEncoder();
    this.decoders.forEach(({ decoder }) => {
      try {
        if (decoder.state !== 'closed') decoder.close();
      } catch {
        // already closed
      }
    });
    this.decoders.clear();

    // Stop microphone tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Disconnect nodes
    this.sourceNode?.disconnect();
    this.sourceNode = null;

    this.captureNode?.disconnect();
    this.captureNode = null;

    this.playbackNode?.disconnect();
    this.playbackNode = null;

    // Close context
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    console.log('[WebAudio] Stopped');
  }

  /**
   * Play received audio from partner.
   * Decodes base64 Float32 data and feeds to the playback worklet.
   */
  playAudio(base64: string, sampleRate: number = 48000, channels: number = 1, streamId: string = 'partner'): void {
    if (this.isDeafened || !this.playbackNode) return;
    this.playSamples(base64ToFloat32(base64), sampleRate, streamId);
  }

  /** Forget a stream's playback queue and decoder (the partner left). */
  releaseStream(streamId: string): void {
    this.playbackNode?.port.postMessage({ type: 'release', stream: streamId });
    const stream = this.decoders.get(streamId);
    if (stream) {
      try {
        if (stream.decoder.state !== 'closed') stream.decoder.close();
      } catch {
        // already closed
      }
      this.decoders.delete(streamId);
    }
  }

  /** Queue audio on a stream; the playback worklet mixes all streams. */
  private playSamples(samples: Float32Array, sampleRate: number, streamId: string): void {
    if (this.isDeafened || !this.playbackNode) return;

    // Resample if incoming sample rate differs from our playback rate
    if (sampleRate !== this.browserSampleRate) {
      samples = resample(samples, sampleRate, this.browserSampleRate);
    }

    this.playbackNode.port.postMessage(
      { type: 'audio', stream: streamId, samples },
      [samples.buffer]
    );
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    // When muted, audio data callbacks are suppressed in the message handler
  }

  setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;
    // Clear the playback buffer when deafening
    if (deafened && this.playbackNode) {
      this.playbackNode.port.postMessage({ type: 'clear' });
    }
  }

  setVadThreshold(threshold: number): void {
    if (this.captureNode) {
      this.captureNode.port.postMessage({ type: 'setVadThreshold', threshold });
    }
  }

  /**
   * Resume AudioContext after user interaction.
   * Call this if the context gets suspended (e.g., tab backgrounding on mobile Safari).
   */
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[WebAudio] Resumed AudioContext');
    }
  }
}
