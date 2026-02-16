/**
 * AudioWorklet processor for capturing microphone audio.
 * Accumulates float32 PCM samples into 960-sample chunks (20ms at 48kHz),
 * computes RMS for VAD, and posts audio data to the main thread.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(960);
    this.bufferIndex = 0;
    this.vadThreshold = 0.01;
    this.silenceFrames = 0;
    this.isSpeaking = false;

    this.port.onmessage = (event) => {
      if (event.data.type === 'setVadThreshold') {
        this.vadThreshold = event.data.threshold;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono channel

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= 960) {
        this.processChunk();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  processChunk() {
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < 960; i++) {
      sum += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sum / 960);

    const wasSpeaking = this.isSpeaking;

    if (rms > this.vadThreshold) {
      this.isSpeaking = true;
      this.silenceFrames = 0;
    } else {
      this.silenceFrames++;
      if (this.silenceFrames > 10) {
        this.isSpeaking = false;
      }
    }

    // Emit voice activity change
    if (this.isSpeaking !== wasSpeaking) {
      this.port.postMessage({
        type: 'voiceActivity',
        speaking: this.isSpeaking,
      });
    }

    // Only send audio data when speaking
    if (this.isSpeaking) {
      // Copy the buffer so it doesn't get overwritten
      const samples = new Float32Array(this.buffer);
      this.port.postMessage({
        type: 'audio',
        samples: samples,
        rms: rms,
      }, [samples.buffer]);
    }
  }
}

registerProcessor('capture-processor', CaptureProcessor);
