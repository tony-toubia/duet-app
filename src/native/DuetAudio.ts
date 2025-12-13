import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { DuetAudioManager } = NativeModules;

// Types
export interface AudioSetupResult {
  success: boolean;
  sampleRate: number;
}

export interface AudioDataEvent {
  audio: string; // base64 encoded
  sampleRate: number;
  channels: number;
}

export interface VoiceActivityEvent {
  speaking: boolean;
}

export interface ConnectionStateEvent {
  state: 'interrupted' | 'resumed' | 'focusLost' | 'routeChanged';
  reason?: string;
}

export interface PlayAudioResult {
  played: boolean;
  reason?: string;
}

// Event emitter
const audioEventEmitter = new NativeEventEmitter(DuetAudioManager);

// Callback types
type AudioDataCallback = (data: AudioDataEvent) => void;
type VoiceActivityCallback = (activity: VoiceActivityEvent) => void;
type ConnectionStateCallback = (state: ConnectionStateEvent) => void;
type ErrorCallback = (error: { message: string }) => void;

// Subscriptions
let audioDataSubscription: any = null;
let voiceActivitySubscription: any = null;
let connectionStateSubscription: any = null;
let errorSubscription: any = null;

/**
 * DuetAudio - Cross-platform audio module for real-time voice communication
 * with automatic ducking of other audio sources (Spotify, etc.)
 */
export const DuetAudio = {
  /**
   * Initialize the audio session with proper settings for voice communication
   * and ducking of other audio sources.
   */
  async setupAudioSession(): Promise<AudioSetupResult> {
    return await DuetAudioManager.setupAudioSession();
  },

  /**
   * Start the audio engine - begins capturing microphone input
   * and prepares for playback of partner audio.
   */
  async startAudioEngine(): Promise<{ success: boolean }> {
    return await DuetAudioManager.startAudioEngine();
  },

  /**
   * Stop the audio engine and release resources.
   */
  async stopAudioEngine(): Promise<{ success: boolean }> {
    return await DuetAudioManager.stopAudioEngine();
  },

  /**
   * Play audio received from partner.
   * This will automatically duck other audio (Spotify, etc.)
   */
  async playAudio(
    base64Audio: string,
    sampleRate: number = 48000,
    channels: number = 1
  ): Promise<PlayAudioResult> {
    return await DuetAudioManager.playAudio(base64Audio, sampleRate, channels);
  },

  /**
   * Mute/unmute local microphone.
   */
  setMuted(muted: boolean): void {
    DuetAudioManager.setMuted(muted);
  },

  /**
   * Deafen/undeafen - stop hearing partner audio.
   */
  setDeafened(deafened: boolean): void {
    DuetAudioManager.setDeafened(deafened);
  },

  /**
   * Set voice activity detection threshold.
   * Lower = more sensitive, higher = less sensitive.
   * Range: 0.001 - 0.1, default: 0.01
   */
  setVadThreshold(threshold: number): void {
    DuetAudioManager.setVadThreshold(threshold);
  },

  // =====================
  // EVENT LISTENERS
  // =====================

  /**
   * Subscribe to audio data from local microphone.
   * Only fires when voice activity is detected.
   */
  onAudioData(callback: AudioDataCallback): () => void {
    audioDataSubscription?.remove();
    audioDataSubscription = audioEventEmitter.addListener('onAudioData', callback);
    return () => audioDataSubscription?.remove();
  },

  /**
   * Subscribe to voice activity changes (speaking/not speaking).
   */
  onVoiceActivity(callback: VoiceActivityCallback): () => void {
    voiceActivitySubscription?.remove();
    voiceActivitySubscription = audioEventEmitter.addListener('onVoiceActivity', callback);
    return () => voiceActivitySubscription?.remove();
  },

  /**
   * Subscribe to connection state changes (interruptions, route changes).
   */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    connectionStateSubscription?.remove();
    connectionStateSubscription = audioEventEmitter.addListener('onConnectionStateChange', callback);
    return () => connectionStateSubscription?.remove();
  },

  /**
   * Subscribe to error events.
   */
  onError(callback: ErrorCallback): () => void {
    errorSubscription?.remove();
    errorSubscription = audioEventEmitter.addListener('onError', callback);
    return () => errorSubscription?.remove();
  },

  /**
   * Remove all event listeners.
   */
  removeAllListeners(): void {
    audioDataSubscription?.remove();
    voiceActivitySubscription?.remove();
    connectionStateSubscription?.remove();
    errorSubscription?.remove();
  },
};

export default DuetAudio;
