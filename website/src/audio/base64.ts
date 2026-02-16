/**
 * Audio base64 encoding/decoding utilities.
 * Must match native encoding: Float32 little-endian → base64.
 *
 * Native (Android) encodes as:
 *   ByteBuffer.allocate(length * 4).order(LITTLE_ENDIAN).putFloat(sample) → Base64.NO_WRAP
 *
 * Native (iOS) encodes as:
 *   Data(bytes: floatChannelData[0], count: frameLength * 4).base64EncodedString()
 *   (macOS/iOS are little-endian on all Apple Silicon and Intel)
 *
 * Web (this file): Float32Array → ArrayBuffer (already little-endian on all modern CPUs) → base64
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode a Float32Array to base64 string.
 * The underlying ArrayBuffer is already little-endian on all modern browsers.
 */
export function float32ToBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  return uint8ArrayToBase64(bytes);
}

/**
 * Decode a base64 string to Float32Array.
 */
export function base64ToFloat32(base64: string): Float32Array {
  const bytes = base64ToUint8Array(base64);
  // Ensure alignment by copying into a new ArrayBuffer
  const aligned = new ArrayBuffer(bytes.length);
  new Uint8Array(aligned).set(bytes);
  return new Float32Array(aligned);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;

    result += BASE64_CHARS[(b0 >> 2) & 0x3f];
    result += BASE64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f];
    result += i + 1 < len ? BASE64_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : '=';
  }

  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Remove padding
  const cleaned = base64.replace(/=+$/, '');
  const len = cleaned.length;
  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);

  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = BASE64_CHARS.indexOf(cleaned[i]);
    const c1 = i + 1 < len ? BASE64_CHARS.indexOf(cleaned[i + 1]) : 0;
    const c2 = i + 2 < len ? BASE64_CHARS.indexOf(cleaned[i + 2]) : 0;
    const c3 = i + 3 < len ? BASE64_CHARS.indexOf(cleaned[i + 3]) : 0;

    bytes[byteIndex++] = (c0 << 2) | (c1 >> 4);
    if (byteIndex < byteLen) bytes[byteIndex++] = ((c1 << 4) | (c2 >> 2)) & 0xff;
    if (byteIndex < byteLen) bytes[byteIndex++] = ((c2 << 6) | c3) & 0xff;
  }

  return bytes;
}
