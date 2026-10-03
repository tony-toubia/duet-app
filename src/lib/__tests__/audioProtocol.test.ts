import {
  parseDataChannelMessage,
  formatCapsMessage,
  formatOpusMessage,
  formatPcmMessage,
  chooseAudioMessage,
  CodecNegotiator,
  CaptureFormatController,
  DecodeHealth,
} from '../audioProtocol';

/** How a 0.2.2 client treats a "C|" message: it only acts on three or more parts. */
function legacyClientActsOn(msg: string): boolean {
  if (msg.startsWith('A|')) return true;
  if (msg.startsWith('C|')) return msg.split('|').length >= 3;
  return true; // JSON or raw-base64 fallback: played or handled
}

describe('parseDataChannelMessage', () => {
  it('parses PCM audio', () => {
    expect(parseDataChannelMessage('A|48000|1|AAAA')).toEqual({ kind: 'pcm', audio: 'AAAA', sampleRate: 48000, channels: 1 });
  });

  it('parses Opus packets', () => {
    expect(parseDataChannelMessage('O|48000|1|AAA=,BBB=')).toEqual({
      kind: 'opus',
      packets: 'AAA=,BBB=',
      sampleRate: 48000,
      channels: 1,
    });
  });

  it('parses capability announcements', () => {
    expect(parseDataChannelMessage(formatCapsMessage(['opus'], false))).toEqual({ kind: 'caps', decodes: ['opus'], ack: false });
    expect(parseDataChannelMessage(formatCapsMessage(['opus'], true))).toEqual({ kind: 'caps', decodes: ['opus'], ack: true });
    expect(parseDataChannelMessage('C|caps;dec=;ack=0')).toEqual({ kind: 'caps', decodes: [], ack: false });
  });

  it('drops codecs it does not know', () => {
    expect(parseDataChannelMessage('C|caps;dec=lyra,opus;ack=1')).toEqual({ kind: 'caps', decodes: ['opus'], ack: true });
  });

  it('parses content links and reactions', () => {
    expect(parseDataChannelMessage('C|item1|https://example.com/a')).toEqual({ kind: 'link', id: 'item1', url: 'https://example.com/a' });
    expect(parseDataChannelMessage(JSON.stringify({ type: 'reaction', emoji: '🔥' }))).toEqual({ kind: 'reaction', emoji: '🔥' });
  });

  it('accepts legacy JSON and bare base64 audio', () => {
    expect(parseDataChannelMessage(JSON.stringify({ audio: 'AAAA', sampleRate: 44100, channels: 1 }))).toEqual({
      kind: 'pcm',
      audio: 'AAAA',
      sampleRate: 44100,
      channels: 1,
    });
    expect(parseDataChannelMessage('AAAABBBB')).toEqual({ kind: 'pcm', audio: 'AAAABBBB', sampleRate: 48000, channels: 1 });
  });

  it('ignores malformed and unknown messages instead of playing them', () => {
    for (const msg of ['', 'A|', 'A|48000|1|', 'O|x|1|AAAA', 'C|x', '{"type":"other"}', 'X|1|2|3', 'not base64!', 42]) {
      expect(parseDataChannelMessage(msg)).toEqual({ kind: 'ignore' });
    }
  });
});

describe('compatibility with 0.2.2 clients', () => {
  it('capability announcements are ignored by old clients', () => {
    expect(legacyClientActsOn(formatCapsMessage(['opus'], false))).toBe(false);
    expect(legacyClientActsOn(formatCapsMessage(['opus'], true))).toBe(false);
    expect(legacyClientActsOn(formatCapsMessage([], false))).toBe(false);
  });

  it('PCM keeps the format old clients read', () => {
    expect(formatPcmMessage('AAAA', 48000, 1)).toBe('A|48000|1|AAAA');
  });
});

describe('chooseAudioMessage', () => {
  const both = { audio: 'PCM', opus: 'OPUS', sampleRate: 48000, channels: 1 };

  it('sends Opus only to peers that decode it', () => {
    expect(chooseAudioMessage(both, true)).toBe(formatOpusMessage('OPUS', 48000, 1));
    expect(chooseAudioMessage(both, false)).toBe(formatPcmMessage('PCM', 48000, 1));
  });

  it('never sends an Opus peer the same audio twice', () => {
    // Opus capture on but no packet ready yet: skip, the packet follows
    expect(chooseAudioMessage({ audio: 'PCM', opus: '', sampleRate: 48000, channels: 1 }, true)).toBeNull();
    expect(chooseAudioMessage({ opus: '', sampleRate: 48000, channels: 1 }, true)).toBeNull();
    // Packet-only chunk (web encoder output) goes to Opus peers only
    expect(chooseAudioMessage({ opus: 'OPUS', sampleRate: 48000, channels: 1 }, false)).toBeNull();
    expect(chooseAudioMessage({ opus: 'OPUS', sampleRate: 48000, channels: 1 }, true)).toBe('O|48000|1|OPUS');
  });

  it('sends Opus peers PCM while Opus capture is off (e.g. this device cannot encode)', () => {
    expect(chooseAudioMessage({ audio: 'PCM', sampleRate: 48000, channels: 1 }, true)).toBe('A|48000|1|PCM');
  });
});

describe('CodecNegotiator', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** Two negotiators wired to each other, with an optional lossy link. */
  function pair(dropAToB = 0, dropBToA = 0) {
    const sentA: string[] = [];
    const sentB: string[] = [];
    let droppedAB = 0;
    let droppedBA = 0;
    // eslint-disable-next-line prefer-const
    let a: CodecNegotiator, b: CodecNegotiator;
    const deliver = (to: CodecNegotiator, msg: string) => {
      const parsed = parseDataChannelMessage(msg);
      if (parsed.kind === 'caps') to.handleCaps(parsed.decodes, parsed.ack);
    };
    a = new CodecNegotiator({
      localDecodes: () => ['opus'],
      send: (m) => {
        sentA.push(m);
        if (droppedAB < dropAToB) droppedAB++;
        else deliver(b, m);
      },
    });
    b = new CodecNegotiator({
      localDecodes: () => ['opus'],
      send: (m) => {
        sentB.push(m);
        if (droppedBA < dropBToA) droppedBA++;
        else deliver(a, m);
      },
    });
    return { a, b, sentA, sentB };
  }

  it('two new clients agree on Opus', () => {
    const { a, b } = pair();
    a.start();
    b.start();
    expect(a.peerDecodesOpus).toBe(true);
    expect(b.peerDecodesOpus).toBe(true);
  });

  it('recovers from lost announcements', () => {
    const { a, b } = pair(3, 2);
    a.start();
    b.start();
    jest.advanceTimersByTime(10000);
    expect(a.peerDecodesOpus).toBe(true);
    expect(b.peerDecodesOpus).toBe(true);
  });

  it('a peer that only announces after we stopped retrying still gets an answer', () => {
    const sentA: string[] = [];
    const a = new CodecNegotiator({ localDecodes: () => ['opus'], send: (m) => sentA.push(m) });
    a.start(); // nobody is listening: a gives up after its announcements
    jest.advanceTimersByTime(60000);
    const before = sentA.length;
    a.handleCaps(['opus'], false); // the peer finally announces, without having heard a
    expect(sentA).toHaveLength(before + 1);
    expect(parseDataChannelMessage(sentA[before])).toEqual({ kind: 'caps', decodes: ['opus'], ack: true });
    expect(a.peerDecodesOpus).toBe(true);
  });

  it('never assumes Opus for an old client that never answers, and stops announcing', () => {
    const sent: string[] = [];
    const n = new CodecNegotiator({ localDecodes: () => ['opus'], send: (m) => sent.push(m), maxAnnouncements: 5 });
    n.start();
    jest.advanceTimersByTime(60000);
    expect(sent).toHaveLength(5);
    expect(n.peerDecodesOpus).toBe(false);
    expect(n.settled).toBe(true);
  });

  it('reset forgets the peer and notifies', () => {
    const onChange = jest.fn();
    const n = new CodecNegotiator({ localDecodes: () => ['opus'], send: () => {}, onChange });
    n.start();
    n.handleCaps(['opus'], true);
    expect(n.peerDecodesOpus).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    n.reset();
    expect(n.peerDecodesOpus).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('a device that cannot decode Opus announces nothing', () => {
    const sent: string[] = [];
    const n = new CodecNegotiator({ localDecodes: () => [], send: (m) => sent.push(m) });
    n.start();
    n.handleCaps(['opus'], false);
    jest.advanceTimersByTime(60000);
    expect(sent).toHaveLength(0);
    expect(n.peerDecodesOpus).toBe(true); // it may still *send* Opus to this peer if it can encode
  });
});

describe('CodecNegotiator.reannounce', () => {
  it('tells the peer when this device stops decoding Opus', () => {
    jest.useFakeTimers();
    let decodes: ('opus')[] = ['opus'];
    const sent: string[] = [];
    const n = new CodecNegotiator({ localDecodes: () => decodes, send: (m) => sent.push(m) });
    n.reannounce(); // not started: nothing
    expect(sent).toHaveLength(0);
    n.start();
    n.handleCaps(['opus'], true);
    decodes = [];
    n.reannounce();
    expect(parseDataChannelMessage(sent[sent.length - 1])).toEqual({ kind: 'caps', decodes: [], ack: true });
    jest.useRealTimers();
  });
});

describe('CaptureFormatController', () => {
  const opusChunk = { opus: 'AAAA', audio: 'PCM', sampleRate: 48000, channels: 1 };
  const emptyChunk = { opus: '', audio: 'PCM', sampleRate: 48000, channels: 1 };

  function make() {
    const applied: { pcm: boolean; opus: boolean }[] = [];
    const c = new CaptureFormatController((pcm, opus) => applied.push({ pcm, opus }));
    return { c, applied };
  }

  it('stays PCM-only without an encoder or Opus peers', () => {
    const { c } = make();
    c.setPeers([true]);
    expect(c.formats).toEqual({ pcm: true, opus: false });
    c.setCanEncode(true);
    c.setPeers([false]);
    expect(c.formats).toEqual({ pcm: true, opus: false });
  });

  it('turns Opus on for Opus peers and PCM off once Opus is proven', () => {
    const { c, applied } = make();
    c.setCanEncode(true);
    c.setPeers([true]);
    expect(c.formats).toEqual({ pcm: true, opus: true });
    for (let i = 0; i < CaptureFormatController.PROVEN_AFTER; i++) c.onCaptured(opusChunk);
    expect(c.formats).toEqual({ pcm: false, opus: true });
    expect(applied).toEqual([{ pcm: true, opus: true }, { pcm: false, opus: true }]);
  });

  it('keeps PCM on while any peer needs it', () => {
    const { c } = make();
    c.setCanEncode(true);
    c.setPeers([true, false]);
    for (let i = 0; i < 10; i++) c.onCaptured(opusChunk);
    expect(c.formats).toEqual({ pcm: true, opus: true });
    c.setPeers([true]);
    expect(c.formats).toEqual({ pcm: false, opus: true });
  });

  it('falls back to PCM when the encoder never produces packets', () => {
    const { c } = make();
    c.setCanEncode(true);
    c.setPeers([true]);
    for (let i = 0; i < CaptureFormatController.FAIL_AFTER; i++) c.onCaptured(emptyChunk);
    expect(c.opusEncoderFailed).toBe(true);
    expect(c.formats).toEqual({ pcm: true, opus: false });
  });

  it('falls back to PCM when the encoder reports an error', () => {
    const { c } = make();
    c.setCanEncode(true);
    c.setPeers([true]);
    for (let i = 0; i < 5; i++) c.onCaptured(opusChunk);
    c.markEncoderFailed();
    expect(c.formats).toEqual({ pcm: true, opus: false });
  });

  it('falls back to PCM when a proven encoder stops producing packets', () => {
    const { c } = make();
    c.setCanEncode(true);
    c.setPeers([true]);
    for (let i = 0; i < 5; i++) c.onCaptured(opusChunk);
    expect(c.formats.pcm).toBe(false);
    for (let i = 0; i < CaptureFormatController.FAIL_AFTER; i++) c.onCaptured(emptyChunk);
    expect(c.formats).toEqual({ pcm: true, opus: false });
  });
});

describe('DecodeHealth', () => {
  it('disables Opus after repeated failures, and successes reset the count', () => {
    const onDisabled = jest.fn();
    const h = new DecodeHealth(onDisabled);
    for (let i = 0; i < DecodeHealth.FAIL_AFTER - 1; i++) h.failure();
    h.success();
    for (let i = 0; i < DecodeHealth.FAIL_AFTER - 1; i++) h.failure();
    expect(onDisabled).not.toHaveBeenCalled();
    h.failure();
    expect(onDisabled).toHaveBeenCalledTimes(1);
    expect(h.opusDisabled).toBe(true);
    h.failure();
    expect(onDisabled).toHaveBeenCalledTimes(1);
  });
});

describe('shared copy', () => {
  it('the website copy matches the app copy', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '../../..');
    expect(fs.readFileSync(path.join(root, 'website/src/lib/audioProtocol.ts'), 'utf8')).toBe(
      fs.readFileSync(path.join(root, 'src/lib/audioProtocol.ts'), 'utf8')
    );
  });
});
