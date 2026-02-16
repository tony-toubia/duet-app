/**
 * AudioWorklet processor for playing back received audio.
 * Maintains a ring buffer and fills output frames from queued chunks.
 * Outputs silence on underflow.
 */
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ring buffer: store up to 20 chunks (400ms of audio at 48kHz)
    this.ringBuffer = new Float32Array(960 * 20);
    this.writePos = 0;
    this.readPos = 0;
    this.bufferedSamples = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'audio') {
        this.enqueue(event.data.samples);
      } else if (event.data.type === 'clear') {
        this.writePos = 0;
        this.readPos = 0;
        this.bufferedSamples = 0;
      }
    };
  }

  enqueue(samples) {
    const len = samples.length;
    const bufLen = this.ringBuffer.length;

    for (let i = 0; i < len; i++) {
      this.ringBuffer[this.writePos] = samples[i];
      this.writePos = (this.writePos + 1) % bufLen;
    }

    this.bufferedSamples = Math.min(this.bufferedSamples + len, bufLen);
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    const bufLen = this.ringBuffer.length;

    for (let i = 0; i < channel.length; i++) {
      if (this.bufferedSamples > 0) {
        channel[i] = this.ringBuffer[this.readPos];
        this.readPos = (this.readPos + 1) % bufLen;
        this.bufferedSamples--;
      } else {
        channel[i] = 0; // Silence on underflow
      }
    }

    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
