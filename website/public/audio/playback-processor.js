/**
 * AudioWorklet processor for playing back received audio.
 *
 * Keeps one queue per remote stream (partner) and sums them into the output,
 * so people talking at the same time are heard together instead of queued
 * one after another. Each queue waits for 40 ms before playing (absorbs
 * network jitter) and waits again after running dry. Its backlog is capped
 * at 300 ms: past that, the oldest audio is dropped down to 100 ms so
 * overlapping talk or a network burst can't build up a growing delay.
 * Outputs silence when nothing is queued.
 */

class StreamQueue {
  constructor(rate) {
    this.capacity = Math.round(rate * 0.4);
    this.prime = Math.round(rate * 0.04);
    this.max = Math.round(rate * 0.3);
    this.target = Math.round(rate * 0.1);
    this.ring = new Float32Array(this.capacity);
    this.readPos = 0;
    this.size = 0;
    this.primed = false;
  }

  write(samples) {
    for (let i = 0; i < samples.length; i++) {
      if (this.size === this.capacity) {
        this.readPos = (this.readPos + 1) % this.capacity;
        this.size--;
      }
      this.ring[(this.readPos + this.size) % this.capacity] = samples[i];
      this.size++;
    }
    if (this.size > this.max) {
      const skip = this.size - this.target;
      this.readPos = (this.readPos + skip) % this.capacity;
      this.size -= skip;
    }
  }

  /** Add up to out.length queued samples into out; returns how many were added. */
  mixInto(out) {
    if (!this.primed) {
      if (this.size < this.prime) return 0;
      this.primed = true;
    }
    const count = Math.min(out.length, this.size);
    for (let i = 0; i < count; i++) {
      out[i] += this.ring[this.readPos];
      this.readPos = (this.readPos + 1) % this.capacity;
    }
    this.size -= count;
    if (this.size === 0) this.primed = false;
    return count;
  }
}

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.streams = new Map();

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'audio') {
        const id = data.stream || 'partner';
        let queue = this.streams.get(id);
        if (!queue) {
          queue = new StreamQueue(sampleRate);
          this.streams.set(id, queue);
        }
        queue.write(data.samples);
      } else if (data.type === 'release') {
        this.streams.delete(data.stream);
      } else if (data.type === 'clear') {
        this.streams.clear();
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    channel.fill(0);
    let active = 0;
    this.streams.forEach((queue) => {
      if (queue.mixInto(channel) > 0) active++;
    });
    if (active > 1) {
      for (let i = 0; i < channel.length; i++) {
        channel[i] = Math.max(-1, Math.min(1, channel[i]));
      }
    }
    // Same signal on every output channel
    for (let c = 1; c < output.length; c++) output[c].set(channel);

    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
