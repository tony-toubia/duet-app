/**
 * Linear interpolation resampler.
 * Used when the browser's sample rate differs from 48kHz.
 */
export function resample(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcFloor = Math.floor(srcIndex);
    const srcCeil = Math.min(srcFloor + 1, input.length - 1);
    const frac = srcIndex - srcFloor;

    output[i] = input[srcFloor] * (1 - frac) + input[srcCeil] * frac;
  }

  return output;
}
