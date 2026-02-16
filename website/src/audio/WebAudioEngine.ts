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
 */

import { float32ToBase64, base64ToFloat32 } from './base64';
import { resample } from './resample';

export interface WebAudioEngineCallbacks {
  onAudioData: (base64: string, sampleRate: number, channels: number) => void;
  onVoiceActivity: (speaking: boolean) => void;
  onError: (error: Error) => void;
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

  constructor(callbacks: WebAudioEngineCallbacks) {
    this.callbacks = callbacks;
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

        const base64 = float32ToBase64(samples);
        this.callbacks.onAudioData(base64, 48000, 1);
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
  playAudio(base64: string, sampleRate: number = 48000, channels: number = 1): void {
    if (this.isDeafened || !this.playbackNode) return;

    let samples = base64ToFloat32(base64);

    // Resample if incoming sample rate differs from our playback rate
    if (sampleRate !== this.browserSampleRate) {
      samples = resample(samples, sampleRate, this.browserSampleRate);
    }

    this.playbackNode.port.postMessage(
      { type: 'audio', samples },
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
