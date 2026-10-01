/**
 * Concept film engine for /concept.
 *
 * A 55-second looping canvas animation of the Duet idea, drawn procedurally in
 * the style of the app's home-screen artwork: flat navy silhouettes, a dusk
 * terracotta skyline, and a glowing cord between headphones that loops into a
 * heart when two people are close and arcs over everything when they're apart.
 *
 * Every frame is a pure function of time, so scrubbing and chapter jumps work
 * without replaying state. mountConceptFilm() wires the canvas to its controls
 * and returns a cleanup function for React effects.
 */

export interface ConceptFilmElements {
  canvas: HTMLCanvasElement;
  playBtn: HTMLButtonElement;
  playIcon: SVGPathElement;
  scrub: HTMLInputElement;
  time: HTMLElement;
  caption: HTMLElement;
  eyebrow: HTMLElement;
  chapters: HTMLElement;
  /** Class list applied to each generated chapter button. */
  chapterClassName: string;
  logoSrc: string;
}

interface Pt { x: number; y: number }
interface Figure { e: Pt; hx: number; hy: number; top: number; u: number }
interface Building { x: number; w: number; h: number; tower: boolean; seed: number; spire?: boolean }
interface Skyline { list: Building[]; span: number }
interface PersonOpts {
  x: number; y: number; s?: number; dir?: number; phase?: number; amp?: number;
  col?: string; kind?: 'm' | 'f'; hp?: boolean; reach?: number;
}
interface Pulse { p: number; from: 'A' | 'B'; alpha: number; arrive: number }
type Ctx = CanvasRenderingContext2D;
type Caption = [number, string];
interface Segment { name: string; d: number; draw: (c: Ctx, t: number) => void; end?: boolean; caps: Caption[] }

const W = 1600, H = 1000, G = 800; // logical stage; G = ground line where feet stand
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COL = {
  ink: '#1a1a2e', sil: '#1c2740', navy: '#1a293d', orange: '#e8734a', orangeL: '#f0956e',
  cream: '#f4dbc8', creamL: '#fbeee3', muted: '#b0b8c8', cab: '#fbbf24',
};
const CROWD = ['#8a5a5f', '#9c6a60', '#76546a', '#a8745f', '#6f5a70'];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sm = (a: number, b: number, t: number) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const win = (a: number, b: number, t: number, f = 0.25) => sm(a, a + f, t) * (1 - sm(b - f, b, t));
const rng = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
// One spoken line, timed relative to when the speaker starts: the dot rests at
// the speaker for a moment, travels the line, then rests at the listener while
// an arrival ring spreads. The listener's audio lowers as the voice arrives and
// stays lowered a little after the speaker finishes, so each step reads on its own.
const TALK = 3.0;
function beat(t: number, t0: number, from: 'A' | 'B') {
  const r = t - t0;
  return {
    speak: win(0, TALK, r, 0.3),
    pulse: r > 0 && r < 2.25 ? { p: sm(0.35, 1.6, r), from, alpha: win(0, 2.25, r, 0.2), arrive: sm(1.55, 2.2, r) } : null,
    duck: sm(1.3, 1.9, r) * (1 - sm(3.2, 3.8, r)),
  };
}
const hexRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mixColor = (a: string, b: string, t: number) => {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
};

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Precomputed integral of a speed curve, so scrolling stays a pure function of time.
function integrator(speed: (t: number) => number, dur: number) {
  const N = Math.ceil(dur * 120) + 2, acc = new Float32Array(N);
  for (let i = 1; i < N; i++) acc[i] = acc[i - 1] + speed((i - 0.5) / 120) / 120;
  return (t: number) => { const f = clamp(t * 120, 0, N - 1.001), i = Math.floor(f); return lerp(acc[i], acc[i + 1], f - i); };
}

function makeSkyline(seed: number, n: number, minW: number, maxW: number, minH: number, maxH: number): Skyline {
  const r = rng(seed), list: Building[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = minW + r() * (maxW - minW), h = minH + r() * (maxH - minH);
    list.push({ x, w, h, tower: r() < 0.3, seed: Math.floor(r() * 97) });
    x += w + r() * 14;
  }
  return { list, span: x };
}

export function mountConceptFilm(el: ConceptFilmElements): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = el.canvas;
  const ctx = cv.getContext('2d');
  if (!ctx) return () => {};
  let k = 1, dpr = 1;
  const fs = (px: number) => Math.max(px, 12.5 / k); // keep canvas text legible on phones

  const logoImg = new Image();
  logoImg.src = el.logoSrc;

  // ───────────── Shared scenery ─────────────
  function sky(c: Ctx, stops: [number, string][], cx: number, cy: number, rgb: string, t: number, ringA = 0.09) {
    const g = c.createLinearGradient(0, 0, 0, G);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // Slowly widening rings: the always-on signal motif from Duet's artwork
    c.save();
    c.lineWidth = 34;
    for (let i = 0; i < 10; i++) {
      const r = 60 + ((i * 88 + t * 36) % 880);
      c.strokeStyle = `rgba(${rgb},${(ringA * (1 - r / 940)).toFixed(3)})`;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  function skyline(c: Ctx, sk: Skyline, offset: number, base: number, fill: string, winFill: string | null, alpha: number, opts: { spire?: boolean; towers?: boolean } = {}) {
    c.save();
    c.globalAlpha = alpha;
    const o = ((offset % sk.span) + sk.span) % sk.span;
    for (let rep = -1; rep < 2; rep++) {
      for (const b of sk.list) {
        const x = b.x - o + rep * sk.span;
        if (x > W || x + b.w < 0) continue;
        const y = base - b.h;
        c.fillStyle = fill;
        c.fillRect(x, y, b.w, b.h + 60);
        if (opts.spire && b.spire) {
          c.fillRect(x + b.w * 0.22, y - 60, b.w * 0.56, 62);
          c.fillRect(x + b.w * 0.36, y - 120, b.w * 0.28, 62);
          c.fillRect(x + b.w * 0.47, y - 210, b.w * 0.06, 92);
        }
        if (opts.towers && b.tower) { // NYC rooftop water tower
          const tx = x + b.w * 0.58;
          c.fillRect(tx - 2, y - 34, 4, 34);
          c.fillRect(tx + 30, y - 34, 4, 34);
          c.fillRect(tx - 6, y - 76, 44, 44);
          c.beginPath(); c.moveTo(tx - 10, y - 76); c.lineTo(tx + 16, y - 100); c.lineTo(tx + 42, y - 76); c.fill();
        }
        if (winFill) {
          c.fillStyle = winFill;
          const cols = Math.max(2, Math.floor(b.w / 40)), rows = Math.floor(b.h / 54);
          for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            if ((i * 7 + j * 13 + b.seed) % 5 < 2) continue;
            c.fillRect(x + 14 + i * ((b.w - 28) / cols), y + 22 + j * 54, 14, 20);
          }
        }
      }
    }
    c.restore();
  }

  function ground(c: Ctx, top: number, a: string, b: string) {
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, top);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, top + Math.sin(x * 0.004 + 1.3) * 10);
    c.lineTo(W, H);
    c.closePath();
    const g = c.createLinearGradient(0, top - 20, 0, H);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g;
    c.fill();
  }

  function shadow(c: Ctx, x: number, y: number, w: number) {
    c.fillStyle = 'rgba(232,115,74,0.16)';
    c.beginPath(); c.ellipse(x, y + 4, w, w * 0.18, 0, 0, Math.PI * 2); c.fill();
  }

  // ───────────── Characters ─────────────
  // Returns head/ear positions in the current coordinate space so the voice
  // line and labels can attach to them.
  function person(c: Ctx, o: PersonOpts): Figure {
    const { x, y, s = 1, dir = 1, phase = 0, amp = 1, col = COL.sil, kind = 'm', hp = false, reach = 0 } = o;
    const u = 33 * s;
    const a = Math.sin(phase) * 0.42 * amp;
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = col; c.fillStyle = col;
    const hipY = -3.7 * u, L = 3.7 * u;
    const leg = (ang: number) => {
      const fx = Math.sin(ang) * L, fy = hipY + Math.cos(ang) * L;
      c.lineWidth = 0.62 * u;
      c.beginPath(); c.moveTo(0, hipY); c.lineTo(fx, fy); c.stroke();
      c.lineWidth = 0.5 * u;
      c.beginPath(); c.moveTo(fx - 0.05 * u, fy - 0.1 * u); c.lineTo(fx + 0.55 * u, fy - 0.05 * u); c.stroke();
    };
    const arm = (ang: number) => {
      c.lineWidth = 0.44 * u;
      c.beginPath(); c.moveTo(0.05 * u, -6.15 * u);
      c.lineTo(Math.sin(ang) * 2.9 * u, -6.15 * u + Math.cos(ang) * 2.9 * u);
      c.stroke();
    };
    leg(-a);
    arm(a * 0.9);
    leg(a);
    if (kind === 'f') {
      c.beginPath();
      c.moveTo(-0.55 * u, -6.5 * u); c.lineTo(0.75 * u, -6.5 * u);
      c.lineTo(1.25 * u, -3.0 * u); c.lineTo(-1.15 * u, -3.0 * u);
      c.closePath(); c.fill();
    } else {
      rr(c, -0.75 * u, -6.6 * u, 1.6 * u, 3.2 * u, 0.55 * u); c.fill();
    }
    arm(lerp(-a * 0.9, 1.45, reach));
    c.lineWidth = 0.42 * u;
    c.beginPath(); c.moveTo(0.1 * u, -6.5 * u); c.lineTo(0.15 * u, -6.9 * u); c.stroke();
    const hx = 0.2 * u, hy = -7.45 * u, hr = 0.62 * u;
    if (kind === 'f') { c.beginPath(); c.ellipse(hx - 0.35 * u, hy + 0.15 * u, 0.85 * u, 0.95 * u, 0.2, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI * 2); c.fill();
    if (kind === 'm') { c.beginPath(); c.ellipse(hx - 0.12 * u, hy - 0.34 * u, 0.7 * u, 0.42 * u, -0.15, 0, Math.PI * 2); c.fill(); }
    if (hp) {
      c.strokeStyle = COL.cream; c.lineWidth = 0.17 * u;
      c.beginPath(); c.arc(hx, hy, hr + 0.16 * u, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.fillStyle = COL.cream;
      c.beginPath(); c.ellipse(hx - 0.05 * u, hy + 0.06 * u, 0.26 * u, 0.34 * u, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    return {
      e: { x: x + dir * (hx - 0.05 * u), y: y + hy + 0.06 * u },
      hx: x + dir * hx, hy: y + hy, top: y + hy - hr - 0.45 * u, u,
    };
  }

  // Bicycle and rider (faces right). x is the crank axle, y the ground.
  function cyclist(c: Ctx, x: number, y: number, crank: number, s = 1): Figure {
    const u = 33 * s, R = 1.25 * u;
    c.save();
    c.translate(x, y);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const rw = { x: -2.0 * u, y: -R }, fw = { x: 2.1 * u, y: -R }, bb = { x: 0, y: -R * 0.9 };
    const seat = { x: -0.75 * u, y: -3.1 * u }, bar = { x: 1.55 * u, y: -3.4 * u };
    for (const w of [rw, fw]) {
      c.strokeStyle = COL.sil; c.lineWidth = 0.22 * u;
      c.beginPath(); c.arc(w.x, w.y, R, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 0.06 * u;
      for (let i = 0; i < 6; i++) {
        const a = crank * 1.6 + i * Math.PI / 3;
        c.beginPath(); c.moveTo(w.x, w.y); c.lineTo(w.x + Math.cos(a) * R, w.y + Math.sin(a) * R); c.stroke();
      }
    }
    const pr = 0.65 * u;
    const p1 = { x: bb.x + Math.cos(crank) * pr, y: bb.y + Math.sin(crank) * pr };
    const p2 = { x: bb.x - Math.cos(crank) * pr, y: bb.y - Math.sin(crank) * pr };
    const hip = { x: seat.x, y: seat.y - 0.2 * u };
    const legIK = (foot: Pt) => {
      const l = 2.0 * u, dx = foot.x - hip.x, dy = foot.y - hip.y;
      const d = Math.min(Math.hypot(dx, dy), 2 * l - 0.01);
      const a = Math.atan2(dy, dx), b = Math.acos(d / (2 * l));
      const knee = { x: hip.x + Math.cos(a - b) * l, y: hip.y + Math.sin(a - b) * l };
      c.strokeStyle = COL.sil; c.lineWidth = 0.55 * u;
      c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(knee.x, knee.y); c.lineTo(foot.x, foot.y); c.stroke();
    };
    legIK(p2);
    c.strokeStyle = COL.orange; c.lineWidth = 0.2 * u;
    const st = { x: seat.x + 0.1 * u, y: seat.y + 0.3 * u }, ht = { x: bar.x - 0.2 * u, y: bar.y + 0.5 * u };
    c.beginPath();
    c.moveTo(rw.x, rw.y); c.lineTo(bb.x, bb.y); c.lineTo(st.x, st.y); c.lineTo(rw.x, rw.y);
    c.moveTo(bb.x, bb.y); c.lineTo(ht.x, ht.y); c.lineTo(st.x, st.y);
    c.moveTo(ht.x, ht.y); c.lineTo(fw.x, fw.y);
    c.stroke();
    c.strokeStyle = COL.sil; c.lineWidth = 0.18 * u;
    c.beginPath(); c.moveTo(ht.x, ht.y); c.lineTo(bar.x, bar.y); c.lineTo(bar.x + 0.4 * u, bar.y); c.stroke();
    const sh = { x: hip.x + 1.15 * u, y: hip.y - 2.5 * u };
    c.strokeStyle = COL.sil; c.lineWidth = 1.2 * u;
    c.beginPath(); c.moveTo(hip.x, hip.y - 0.3 * u); c.lineTo(sh.x, sh.y); c.stroke();
    c.lineWidth = 0.42 * u;
    c.beginPath(); c.moveTo(sh.x, sh.y); c.lineTo(bar.x + 0.2 * u, bar.y); c.stroke();
    const hx = sh.x + 0.5 * u, hy = sh.y - 1.0 * u, hr = 0.62 * u;
    c.fillStyle = COL.sil;
    c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(hx - 0.12 * u, hy - 0.34 * u, 0.7 * u, 0.42 * u, -0.15, 0, Math.PI * 2); c.fill();
    c.strokeStyle = COL.cream; c.lineWidth = 0.17 * u;
    c.beginPath(); c.arc(hx, hy, hr + 0.16 * u, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.fillStyle = COL.cream;
    c.beginPath(); c.ellipse(hx - 0.05 * u, hy + 0.06 * u, 0.26 * u, 0.34 * u, 0, 0, Math.PI * 2); c.fill();
    legIK(p1);
    c.restore();
    return { e: { x: x + hx - 0.05 * u, y: y + hy + 0.06 * u }, hx: x + hx, hy: y + hy, top: y + hy - hr - 0.45 * u, u };
  }

  // Faint "where they were" silhouette, drawn opaque offscreen so overlapping limbs don't double up.
  const ghostCv = document.createElement('canvas');
  ghostCv.width = W / 2; ghostCv.height = H / 2;
  const gctx = ghostCv.getContext('2d');
  function ghost(c: Ctx, o: PersonOpts, alpha: number) {
    if (alpha <= 0.01 || !gctx) return;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, ghostCv.width, ghostCv.height);
    gctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    person(gctx, { ...o, col: COL.creamL });
    c.save(); c.globalAlpha = alpha; c.drawImage(ghostCv, 0, 0, W, H); c.restore();
  }

  // ───────────── The voice line & overlays ─────────────
  function heartPath(c: Ctx, x: number, y: number, s: number) {
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.3, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.9, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
  }
  const qpt = (A: Pt, P: Pt, B: Pt, p: number): Pt => {
    const q = 1 - p;
    return { x: q * q * A.x + 2 * q * p * P.x + p * p * B.x, y: q * q * A.y + 2 * q * p * P.y + p * p * B.y };
  };

  // The glowing cord between two ear cups. Close together it loops into the
  // heart; apart it arcs over everything. A pulse travels from whoever speaks.
  function cord(c: Ctx, A: Pt, B: Pt, o: { heart?: number; alpha?: number; energy?: number; pulse?: Pulse | null } = {}): Pt {
    const { heart = 0, alpha = 1, energy = 0, pulse = null } = o;
    const dist = Math.hypot(B.x - A.x, B.y - A.y);
    const P = { x: (A.x + B.x) / 2, y: Math.max(36, Math.min(A.y, B.y) - (30 + dist * 0.3)) };
    c.save();
    c.lineCap = 'round';
    c.shadowColor = 'rgba(251,230,212,0.95)';
    c.shadowBlur = (10 + energy * 18) * k * dpr;
    c.strokeStyle = COL.cream;
    c.lineWidth = 3.2 + energy * 2.4;
    if (heart < 1) {
      c.globalAlpha = alpha * (1 - heart);
      c.beginPath(); c.moveTo(A.x, A.y); c.quadraticCurveTo(P.x, P.y, B.x, B.y); c.stroke();
    }
    if (heart > 0) {
      const s = 30 * heart + 4, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + 70;
      c.globalAlpha = alpha * heart;
      const Lp = { x: mx - s * 0.95, y: my - s * 0.55 }, Rp = { x: mx + s * 0.95, y: my - s * 0.55 };
      c.beginPath(); c.moveTo(A.x, A.y); c.quadraticCurveTo((A.x + Lp.x) / 2, Math.max(A.y, Lp.y) + 46, Lp.x, Lp.y); c.stroke();
      c.beginPath(); c.moveTo(B.x, B.y); c.quadraticCurveTo((B.x + Rp.x) / 2, Math.max(B.y, Rp.y) + 46, Rp.x, Rp.y); c.stroke();
      c.beginPath(); heartPath(c, mx, my, s); c.stroke();
    }
    if (pulse && heart < 0.5) {
      const p = pulse.from === 'A' ? pulse.p : 1 - pulse.p;
      const back = pulse.from === 'A' ? -1 : 1;
      // trail only while travelling, so the dot rests cleanly at each end
      const moving = Math.min(pulse.p, 1 - pulse.p) > 0.001;
      const pa = alpha * pulse.alpha;
      for (let i = 4; i >= 0; i--) {
        if (i > 0 && !moving) continue;
        const pt = qpt(A, P, B, clamp(p + back * i * 0.018));
        c.globalAlpha = pa;
        c.fillStyle = i === 0 ? COL.creamL : `rgba(244,219,200,${0.5 - i * 0.1})`;
        c.beginPath(); c.arc(pt.x, pt.y, 11 - i * 1.6, 0, Math.PI * 2); c.fill();
      }
      const pt = qpt(A, P, B, p);
      c.shadowBlur = 0;
      c.fillStyle = COL.orange;
      c.beginPath(); c.arc(pt.x, pt.y, 5, 0, Math.PI * 2); c.fill();
      // arrival ring at the listener's ear
      if (pulse.arrive > 0 && pulse.arrive < 1) {
        const end = pulse.from === 'A' ? B : A;
        c.globalAlpha = alpha * (1 - pulse.arrive) * 0.9;
        c.strokeStyle = COL.creamL; c.lineWidth = 3;
        c.beginPath(); c.arc(end.x, end.y, 12 + 40 * pulse.arrive, 0, Math.PI * 2); c.stroke();
      }
    }
    c.restore();
    return qpt(A, P, B, 0.5);
  }

  // Sound bars from the Duet logo, around whoever is talking.
  function voiceBars(c: Ctx, x: number, y: number, u: number, t: number, amt: number) {
    if (amt <= 0.01) return;
    c.save();
    c.lineCap = 'round';
    c.globalAlpha = amt;
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
      const bx = x + side * (1.2 * u + i * 0.62 * u);
      const h = (i ? 0.55 : 0.95) * u * (0.65 + 0.35 * Math.sin(t * 13 + i * 1.9 + (side > 0 ? 0.7 : 0))) * amt;
      c.strokeStyle = COL.cream; c.lineWidth = 0.36 * u;
      c.beginPath(); c.moveTo(bx, y - h); c.lineTo(bx, y + h); c.stroke();
      c.strokeStyle = COL.orange; c.lineWidth = 0.22 * u;
      c.beginPath(); c.moveTo(bx, y - h); c.lineTo(bx, y + h); c.stroke();
    }
    c.restore();
  }

  // "What I'm listening to" pill. While the other person talks the audio is
  // ducked: the speaker glyph loses its sound waves, the level bars slow to a
  // stop and settle into a low, dim line, and a "lowered" label appears.
  function chip(c: Ctx, x: number, y: number, label: string, level: number, t: number) {
    const d = clamp((1 - level) / 0.7); // 0 = playing normally, 1 = fully lowered
    const f = fs(21);
    c.save();
    c.font = `600 ${f}px ${FONT}`;
    const tw = c.measureText(label).width, bw = f * 0.34, gap = f * 0.22, nb = 5, gw = f * 0.95;
    const w = f * 0.6 + gw + f * 0.25 + tw + f * 0.5 + nb * bw + (nb - 1) * gap + f * 0.7, h = f * 1.75;
    const x0 = clamp(x - w / 2, 12, W - 12 - w), y0 = y - h / 2;
    rr(c, x0, y0, w, h, h / 2);
    c.fillStyle = 'rgba(22,24,44,0.84)'; c.fill();
    c.strokeStyle = `rgba(244,219,200,${(0.35 - 0.2 * d).toFixed(3)})`; c.lineWidth = 1.5; c.stroke();
    // speaker glyph: its sound waves fade out as the audio is lowered
    const gx = x0 + f * 0.6;
    c.fillStyle = mixColor(COL.cream, '#8a8ca3', d);
    c.beginPath();
    c.moveTo(gx, y - f * 0.16); c.lineTo(gx + f * 0.18, y - f * 0.16); c.lineTo(gx + f * 0.42, y - f * 0.36);
    c.lineTo(gx + f * 0.42, y + f * 0.36); c.lineTo(gx + f * 0.18, y + f * 0.16); c.lineTo(gx, y + f * 0.16);
    c.closePath(); c.fill();
    c.strokeStyle = COL.cream; c.lineWidth = f * 0.09; c.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      c.globalAlpha = clamp((1 - d) * 2 - i);
      c.beginPath(); c.arc(gx + f * 0.42, y, f * (0.24 + i * 0.2), -0.85, 0.85); c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = mixColor(COL.cream, '#9a9cb2', d); c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(label, gx + gw + f * 0.25, y + 1);
    // level bars: lively while playing; slowed, flattened and dimmed while lowered
    let bx = gx + gw + f * 0.25 + tw + f * 0.5;
    c.fillStyle = mixColor(COL.orange, '#6b6d85', d);
    for (let i = 0; i < nb; i++) {
      const live = 0.35 + 0.65 * Math.abs(Math.sin(t * 5.5 + i * 1.7));
      const bh = Math.max(f * 0.14, h * 0.58 * lerp(live, 0.5, d) * lerp(1, 0.18, d));
      rr(c, bx, y - bh / 2, bw, bh, bw / 2); c.fill();
      bx += bw + gap;
    }
    if (d > 0.02) {
      const lf = fs(16), text = `${label} lowered`;
      c.globalAlpha = d;
      c.font = `700 ${lf}px ${FONT}`;
      const lw = c.measureText(text).width + lf * 1.1, lh = lf * 1.6;
      const lx = clamp(x0 + w / 2 - lw / 2, 12, W - 12 - lw), ly = y0 - lh - lf * 0.3;
      rr(c, lx, ly, lw, lh, lh / 2);
      c.fillStyle = 'rgba(22,24,44,0.84)'; c.fill();
      c.fillStyle = COL.orangeL; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, lx + lw / 2, ly + lh / 2 + 1);
    }
    c.restore();
    return { x0, y0, w, h };
  }

  function bubble(c: Ctx, x: number, y: number, text: string, a: number, lean = 0) {
    if (a <= 0.01) return;
    const f = fs(32);
    c.save();
    c.font = `600 ${f}px ${FONT}`;
    const w = c.measureText(text).width + f * 1.3, h = f * 2.0;
    const bx = clamp(x - w / 2 + lean * w * 0.3, 14, W - 14 - w);
    const by = y - h - f * 0.55;
    const sc = 0.9 + 0.1 * a;
    c.translate(x, y); c.scale(sc, sc); c.translate(-x, -y);
    c.globalAlpha = a;
    c.shadowColor = 'rgba(10,10,25,0.35)';
    c.shadowBlur = 14 * k * dpr;
    rr(c, bx, by, w, h, h / 2);
    c.fillStyle = COL.creamL; c.fill();
    c.shadowBlur = 0;
    const tx = clamp(x, bx + h * 0.5, bx + w - h * 0.5);
    c.beginPath(); c.moveTo(tx - f * 0.42, by + h - 2); c.lineTo(tx + f * 0.42, by + h - 2); c.lineTo(x, y); c.closePath(); c.fill();
    c.fillStyle = COL.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, bx + w / 2, by + h / 2 + 1);
    c.restore();
  }

  function tag(c: Ctx, x: number, y: number, text: string, a = 1) {
    if (a <= 0.01) return;
    const f = fs(20);
    c.save();
    c.globalAlpha = a;
    c.font = `600 ${f}px ${FONT}`;
    const w = c.measureText(text).width + f * 1.2, h = f * 1.7;
    const x0 = clamp(x - w / 2, 12, W - 12 - w);
    rr(c, x0, y - h / 2, w, h, h / 2);
    c.fillStyle = 'rgba(22,24,44,0.78)'; c.fill();
    c.fillStyle = COL.cream; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x0 + w / 2, y + 1);
    c.restore();
  }

  function muteBadge(c: Ctx, x: number, y: number, a: number) {
    if (a <= 0.01) return;
    const f = fs(20);
    c.save();
    c.globalAlpha = a;
    c.font = `700 ${f}px ${FONT}`;
    const w = f * 2.3 + c.measureText('Muted').width, h = f * 1.75;
    const x0 = Math.min(x, W - 12 - w);
    rr(c, x0, y - h / 2, w, h, h / 2);
    c.fillStyle = COL.orange; c.fill();
    const mx = x0 + f * 0.95, my = y;
    c.strokeStyle = COL.ink; c.lineWidth = f * 0.12; c.lineCap = 'round';
    rr(c, mx - f * 0.18, my - f * 0.44, f * 0.36, f * 0.56, f * 0.18); c.stroke();
    c.beginPath(); c.arc(mx, my - f * 0.06, f * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.beginPath(); c.moveTo(mx, my + f * 0.26); c.lineTo(mx, my + f * 0.42); c.stroke();
    c.beginPath(); c.moveTo(mx - f * 0.4, my - f * 0.44); c.lineTo(mx + f * 0.4, my + f * 0.4); c.stroke();
    c.fillStyle = COL.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('Muted', x0 + f * 1.65, y + 1);
    c.restore();
  }

  function brandMark(c: Ctx, name: string) {
    if (!logoImg.complete || !logoImg.naturalWidth) return;
    const h = fs(46), w = h * logoImg.naturalWidth / logoImg.naturalHeight;
    c.drawImage(logoImg, 34, 30, w, h);
    const f = fs(22);
    c.save();
    c.font = `600 ${f}px ${FONT}`;
    c.fillStyle = COL.creamL; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(10,10,25,0.5)'; c.shadowBlur = 8 * k * dpr;
    c.fillText(name, 34 + w + 14, 30 + h / 2);
    c.restore();
  }

  // ───────────── Scene 1 · Out exploring (NYC) ─────────────
  const far1 = makeSkyline(3, 16, 90, 190, 300, 500);
  far1.list[5].spire = true; far1.list[5].h = 540;
  const near1 = makeSkyline(11, 14, 150, 260, 210, 410);
  const off1 = integrator(t => 120 * clamp(1 - sm(6.2, 6.8, t) + sm(14.9, 15.5, t)), 18.2);
  const STOP1 = off1(9);
  const crowd1 = (() => {
    const r = rng(21);
    const out: { enter: number; v: number; s: number; y: number; col: string; kind: 'm' | 'f'; ph: number; front: boolean }[] = [];
    for (let i = 0; i < 15; i++) {
      const front = r() < 0.55;
      out.push({
        enter: 2.0 + i * 0.42 + r() * 0.3, v: -(230 + r() * 110),
        s: front ? 1.02 + r() * 0.1 : 0.86 + r() * 0.08, y: front ? G + 16 : G - 8,
        col: CROWD[i % CROWD.length], kind: r() < 0.5 ? 'm' : 'f', ph: r() * 6, front,
      });
    }
    return out;
  })();
  function drawCrowd(c: Ctx, t: number, front: boolean) {
    for (const p of crowd1) {
      if (p.front !== front || t < p.enter) continue;
      const x = W + 140 + p.v * (t - p.enter);
      if (x < -160) continue;
      person(c, { x, y: p.y, s: p.s, dir: -1, phase: t * 9 + p.ph, kind: p.kind, col: p.col });
    }
  }

  function drawCart(c: Ctx, x: number, y: number) {
    c.save();
    c.fillStyle = COL.sil;
    c.fillRect(x - 3, y - 300, 6, 200);
    const uy = y - 300, R = 100;
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? COL.creamL : COL.orange;
      c.beginPath(); c.moveTo(x, uy);
      c.arc(x, uy, R, Math.PI + i * Math.PI / 8, Math.PI + (i + 1) * Math.PI / 8);
      c.closePath(); c.fill();
    }
    rr(c, x - 85, y - 118, 170, 92, 12); c.fillStyle = '#f7e4d6'; c.fill();
    c.fillStyle = COL.orange; c.fillRect(x - 85, y - 92, 170, 12);
    c.strokeStyle = '#b5653f'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(x - 9, y - 54, 12, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x + 9, y - 54, 12, 0, Math.PI * 2); c.stroke();
    c.fillStyle = COL.sil;
    c.beginPath(); c.arc(x - 55, y - 18, 16, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 55, y - 18, 16, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawCab(c: Ctx, x: number, y: number) {
    c.save();
    c.fillStyle = COL.cab;
    c.beginPath();
    c.moveTo(x - 190, y - 40); c.lineTo(x - 190, y - 95); c.lineTo(x - 110, y - 100);
    c.quadraticCurveTo(x - 70, y - 160, x - 10, y - 162); c.lineTo(x + 70, y - 160);
    c.quadraticCurveTo(x + 110, y - 150, x + 125, y - 100); c.lineTo(x + 190, y - 92);
    c.lineTo(x + 192, y - 40); c.closePath(); c.fill();
    c.fillStyle = COL.sil;
    c.beginPath(); c.moveTo(x - 95, y - 105); c.quadraticCurveTo(x - 62, y - 148, x - 10, y - 150);
    c.lineTo(x + 66, y - 148); c.quadraticCurveTo(x + 95, y - 140, x + 108, y - 105); c.closePath(); c.fill();
    c.fillStyle = COL.cab; c.fillRect(x + 4, y - 152, 9, 50);
    c.fillStyle = COL.creamL; rr(c, x - 30, y - 178, 60, 16, 4); c.fill();
    c.fillStyle = '#10131f';
    for (const wx of [x - 110, x + 120]) { c.beginPath(); c.arc(wx, y - 36, 34, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  function scene1(c: Ctx, t: number) {
    const off = off1(t);
    sky(c, [[0, '#1a293d'], [0.45, '#3d3350'], [0.8, '#9a5a5c'], [1, '#d9785f']], 800, 560, '244,219,200', t);
    skyline(c, far1, off * 0.18, G - 40, 'rgb(214,132,108)', 'rgba(250,214,190,0.5)', 0.5, { spire: true });
    skyline(c, near1, off * 0.42, G - 10, '#e8866a', '#f7c9ad', 1, { towers: true });
    ground(c, G - 14, '#f6dcc9', '#fbeee3');

    drawCab(c, -400 + (STOP1 - off), G - 2);
    drawCart(c, 1340 + (STOP1 - off), G + 4);

    const hxp = lerp(700, 430, sm(3, 6.5, t)) + 260 * sm(15.0, 17.2, t);
    const sxp = lerp(830, 1180, sm(3, 6.5, t)) - 360 * sm(15.0, 17.2, t);
    const ampH = clamp(1 - sm(6.2, 6.7, t) + sm(14.9, 15.3, t));
    const ampS = clamp(1 - sm(6.4, 6.9, t) + sm(14.9, 15.3, t));
    const ph = off * 0.05;
    const reach = sm(6.9, 7.5, t) * (1 - sm(8.2, 8.7, t));

    drawCrowd(c, t, false);
    ghost(c, { x: hxp + 150, y: G, kind: 'f', s: 0.94, amp: 0, hp: true }, 0.3 * reach);
    shadow(c, hxp, G, 46); shadow(c, sxp, G, 42);
    const him = person(c, { x: hxp, y: G, phase: ph, amp: ampH, kind: 'm', hp: true, reach });
    const her = person(c, { x: sxp, y: G, s: 0.94, phase: ph + 2.2, amp: ampS, kind: 'f', hp: true });
    drawCrowd(c, t, true);

    const dist = Math.abs(her.e.x - him.e.x);
    const bH = beat(t, 8.7, 'A'), bS = beat(t, 12.4, 'B');
    const talkH = bH.speak, talkS = bS.speak;
    const pulse = bH.pulse || bS.pulse;
    cord(c, him.e, her.e, { heart: 1 - sm(190, 330, dist), energy: Math.max(talkH, talkS), pulse });
    voiceBars(c, him.hx, him.hy, him.u, t, talkH);
    voiceBars(c, her.hx, her.hy, her.u, t, talkS);
    chip(c, him.hx - 75, him.top - 40, 'music', 1 - 0.7 * bS.duck, t);
    chip(c, her.hx + 75, her.top - 40, 'music', 1 - 0.7 * bH.duck, t);

    const q = win(7.2, 8.6, t, 0.2);
    if (q > 0.01) {
      c.save();
      c.globalAlpha = q;
      c.fillStyle = COL.creamL;
      c.font = `700 ${fs(70)}px ${FONT}`;
      c.textAlign = 'center';
      c.fillText('?', him.hx + 70, him.top - 70);
      c.restore();
    }
    bubble(c, him.hx, him.top - 82, 'Hey, where’d you go?', talkH, -0.3);
    bubble(c, her.hx, her.top - 82, 'By the pretzel cart. I’ll wait!', talkS, 0.3);
  }

  // ───────────── Scene 2 · On the road (rideshare) ─────────────
  const far2 = makeSkyline(5, 18, 80, 170, 220, 470);
  const mid2 = makeSkyline(9, 14, 140, 240, 160, 320);
  const off2 = integrator(t => 380 * (1 - sm(10.2, 11.3, t)), 15);

  function drawLamp(c: Ctx, x: number) {
    c.save();
    c.fillStyle = '#3d3a5c';
    c.fillRect(x - 4, G - 300, 8, 300);
    c.fillRect(x - 4, G - 300, 46, 7);
    const g = c.createRadialGradient(x + 40, G - 288, 4, x + 40, G - 288, 90);
    g.addColorStop(0, 'rgba(251,230,212,0.75)'); g.addColorStop(1, 'rgba(251,230,212,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x + 40, G - 288, 90, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawCar(c: Ctx, x: number, y: number, off: number, rider: number): Figure {
    const x0 = x - 280;
    c.save();
    const g = c.createLinearGradient(x0 + 560, 0, x0 + 1000, 0);
    g.addColorStop(0, 'rgba(251,238,227,0.4)'); g.addColorStop(1, 'rgba(251,238,227,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x0 + 550, y - 100); c.lineTo(x0 + 1000, y - 160); c.lineTo(x0 + 1000, y - 10); c.lineTo(x0 + 550, y - 72);
    c.fill();
    c.fillStyle = '#2b3a5c';
    c.beginPath();
    c.moveTo(x0 + 10, y - 40); c.lineTo(x0 + 10, y - 105);
    c.quadraticCurveTo(x0 + 20, y - 122, x0 + 70, y - 125); c.lineTo(x0 + 140, y - 128);
    c.quadraticCurveTo(x0 + 200, y - 205, x0 + 260, y - 208); c.lineTo(x0 + 360, y - 206);
    c.quadraticCurveTo(x0 + 420, y - 200, x0 + 455, y - 132); c.lineTo(x0 + 530, y - 120);
    c.quadraticCurveTo(x0 + 560, y - 112, x0 + 560, y - 80); c.lineTo(x0 + 558, y - 40);
    c.closePath(); c.fill();
    c.save();
    c.beginPath();
    c.moveTo(x0 + 160, y - 135); c.quadraticCurveTo(x0 + 210, y - 192, x0 + 262, y - 194);
    c.lineTo(x0 + 356, y - 192); c.quadraticCurveTo(x0 + 405, y - 188, x0 + 438, y - 135);
    c.closePath();
    const wg = c.createLinearGradient(0, y - 195, 0, y - 135);
    wg.addColorStop(0, '#f6c3a3'); wg.addColorStop(1, '#e8866a');
    c.fillStyle = wg; c.fill();
    c.clip();
    c.fillStyle = COL.sil;
    c.fillRect(x0 + 332, y - 182, 16, 50);
    rr(c, x0 + 348, y - 142, 64, 30, 12); c.fill();
    c.beginPath(); c.arc(x0 + 378, y - 162, 17, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x0 + 374, y - 172, 19, 11, -0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = COL.cream;
    c.beginPath(); c.arc(x0 + 371, y - 160, 6, 0, Math.PI * 2); c.fill();
    if (rider > 0.01) {
      c.globalAlpha = rider;
      c.fillStyle = '#5a4258';
      rr(c, x0 + 218, y - 142, 60, 30, 12); c.fill();
      c.beginPath(); c.arc(x0 + 246, y - 162, 17, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
    c.fillStyle = '#2b3a5c'; c.fillRect(x0 + 300, y - 196, 12, 62);
    c.strokeStyle = 'rgba(244,219,200,0.28)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x0 + 30, y - 96); c.lineTo(x0 + 540, y - 96); c.stroke();
    c.beginPath(); c.moveTo(x0 + 300, y - 128); c.lineTo(x0 + 300, y - 46); c.stroke();
    c.fillStyle = COL.orange; c.fillRect(x0 + 10, y - 104, 12, 24);
    c.fillStyle = COL.creamL; c.fillRect(x0 + 545, y - 104, 14, 18);
    for (const wx of [x0 + 120, x0 + 455]) {
      c.fillStyle = '#10131f'; c.beginPath(); c.arc(wx, y - 46, 46, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c9b4a6'; c.beginPath(); c.arc(wx, y - 46, 20, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#10131f'; c.lineWidth = 4;
      const ang = off / 46;
      for (let i = 0; i < 5; i++) {
        const a = ang + i * 1.2566;
        c.beginPath(); c.moveTo(wx, y - 46); c.lineTo(wx + Math.cos(a) * 20, y - 46 + Math.sin(a) * 20); c.stroke();
      }
    }
    c.restore();
    return { e: { x: x0 + 371, y: y - 160 }, hx: x0 + 378, hy: y - 162, top: y - 208, u: 22 };
  }

  function drawInset(c: Ctx, t: number): Figure {
    const x = 1070, y = 96, w = 460, h = 340, r = 28;
    c.save();
    c.shadowColor = 'rgba(240,149,110,0.55)'; c.shadowBlur = 34 * k * dpr;
    rr(c, x, y, w, h, r); c.fillStyle = '#e8866a'; c.fill();
    c.restore();
    c.save();
    rr(c, x, y, w, h, r); c.clip();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#f6c3a3'); g.addColorStop(1, '#e8866a');
    c.fillStyle = g; c.fillRect(x, y, w, h);
    rr(c, x + 34, y + 84, 150, 110, 10); c.fillStyle = '#231c3a'; c.fill();
    c.fillStyle = 'rgba(244,219,200,0.7)';
    for (let i = 0; i < 9; i++) c.fillRect(x + 50 + (i * 37) % 120, y + 104 + ((i * 53) % 70), 7, 9);
    c.strokeStyle = COL.sil; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x + 340, y); c.lineTo(x + 340, y + 66); c.stroke();
    const lg = c.createRadialGradient(x + 340, y + 104, 4, x + 340, y + 104, 120);
    lg.addColorStop(0, 'rgba(255,244,234,0.85)'); lg.addColorStop(1, 'rgba(255,244,234,0)');
    c.fillStyle = lg; c.beginPath(); c.arc(x + 340, y + 104, 120, 0, Math.PI * 2); c.fill();
    c.fillStyle = COL.sil;
    c.beginPath(); c.moveTo(x + 310, y + 98); c.lineTo(x + 370, y + 98); c.lineTo(x + 355, y + 66); c.lineTo(x + 325, y + 66); c.closePath(); c.fill();
    const fr = person(c, { x: x + 250, y: y + h + 80, s: 0.95, dir: -1, amp: 0, kind: 'f', hp: true });
    c.fillStyle = COL.sil; c.fillRect(x, y + h - 62, w, 62);
    c.fillStyle = '#2b3a5c'; c.fillRect(x, y + h - 62, w, 9);
    rr(c, x + 110, y + h - 98, 34, 38, 6); c.fillStyle = COL.creamL; c.fill();
    c.strokeStyle = COL.creamL; c.lineWidth = 4;
    c.beginPath(); c.arc(x + 146, y + h - 80, 9, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.strokeStyle = 'rgba(251,238,227,0.7)'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      c.beginPath();
      for (let j = 0; j <= 10; j++) {
        const yy = y + h - 104 - j * 4, xx = x + 120 + i * 14 + Math.sin(j * 0.8 + t * 4 + i) * 4;
        if (j) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.stroke();
    }
    c.fillStyle = COL.sil; rr(c, x + 400, y + h - 100, 30, 38, 4); c.fill();
    c.fillStyle = '#c9705a';
    for (let i = 0; i < 5; i++) {
      c.beginPath(); c.ellipse(x + 415 + (i - 2) * 9, y + h - 116 + Math.abs(i - 2) * 4, 7, 18, (i - 2) * 0.35, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    c.save();
    rr(c, x, y, w, h, r);
    c.strokeStyle = 'rgba(244,219,200,0.6)'; c.lineWidth = 3; c.stroke();
    c.restore();
    tag(c, x + 92, y + 30, 'Across town');
    return fr;
  }

  function scene2(c: Ctx, t: number) {
    const off = off2(t);
    sky(c, [[0, '#0e1325'], [0.6, '#221b38'], [1, '#4b2b40']], 1300, 300, '244,219,200', t, 0.06);
    skyline(c, far2, off * 0.15, G - 30, '#2a2342', 'rgba(244,219,200,0.32)', 1);
    skyline(c, mid2, off * 0.35, G - 10, '#382a48', 'rgba(240,149,110,0.55)', 1, { towers: true });
    c.fillStyle = '#2e3150'; c.fillRect(0, G - 12, W, 28);
    const sp = 520;
    for (let lx = -(off % sp); lx < W + sp; lx += sp) drawLamp(c, lx + 120);
    c.fillStyle = '#1b2033'; c.fillRect(0, G + 16, W, H - G - 16);
    c.fillStyle = 'rgba(244,219,200,0.45)';
    for (let x = -(off % 150); x < W; x += 150) c.fillRect(x, 935, 76, 8);

    // rider walks up and gets in
    const pa = win(11.3, 13.2, t, 0.3);
    if (pa > 0.01) {
      c.save(); c.globalAlpha = pa;
      person(c, { x: lerp(1060, 560, sm(11.3, 13.0, t)), y: G + 10, s: 0.95, dir: -1, phase: t * 8.5, amp: 1 - sm(12.7, 13.0, t), kind: 'm', col: CROWD[0] });
      c.restore();
    }
    const bob = Math.sin(t * 14) * 2 * (1 - sm(10.3, 11.3, t));
    const car = drawCar(c, 600, 905 + bob, off, sm(12.9, 13.3, t));
    const fr = drawInset(c, t);

    const bF = beat(t, 3.0, 'B'), bD = beat(t, 6.7, 'A');
    const talkF = bF.speak, talkD = bD.speak;
    const muted = sm(11.7, 12.1, t);
    const pulse = bF.pulse || bD.pulse;
    cord(c, car.e, fr.e, { energy: Math.max(talkF, talkD), pulse, alpha: 1 - 0.5 * muted });
    voiceBars(c, car.hx, car.hy, car.u, t, talkD);
    voiceBars(c, fr.hx, fr.hy, fr.u, t, talkF);
    const dc = chip(c, car.hx - 20, car.top - 44, 'music', 1 - 0.7 * bF.duck, t);
    muteBadge(c, dc.x0 + dc.w + 10, car.top - 44, muted);
    chip(c, fr.hx + 30, fr.top - 30, 'music', 1 - 0.7 * bD.duck, t);
    bubble(c, fr.hx, fr.top - 66, 'How’s the shift going?', talkF, -0.5);
    bubble(c, car.hx, car.top - 76, 'Slow night. Airport run next.', talkD, 0.1);
  }

  // ───────────── Scene 3 · Leaving home ─────────────
  const P3 = (p: Pt, z: number): Pt => ({ x: 800 + (p.x - 800) * z, y: G + (p.y - G) * z });

  function hills(c: Ctx, yBase: number, amp: number, col: string, seed: number) {
    c.beginPath();
    c.moveTo(-3600, H * 2);
    for (let x = -3600; x <= 5200; x += 60) {
      c.lineTo(x, yBase - amp * (0.5 + 0.5 * Math.sin(x * 0.0016 + seed)) - amp * 0.4 * Math.sin(x * 0.0041 + seed * 2));
    }
    c.lineTo(5200, H * 2);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  }

  function house(c: Ctx, x: number, w: number, h: number, door: boolean) {
    c.fillStyle = '#e8866a';
    c.fillRect(x - w / 2, G - h, w, h);
    c.fillStyle = COL.navy;
    c.beginPath(); c.moveTo(x - w / 2 - 24, G - h + 2); c.lineTo(x, G - h - w * 0.45); c.lineTo(x + w / 2 + 24, G - h + 2); c.closePath(); c.fill();
    c.fillStyle = COL.creamL;
    c.fillRect(x - w * 0.36, G - h * 0.78, w * 0.2, w * 0.18);
    c.fillRect(x + w * 0.16, G - h * 0.78, w * 0.2, w * 0.18);
    if (door) {
      c.fillStyle = '#f7e4d6'; rr(c, x - 22, G - 124, 44, 124, 8); c.fill();
      c.fillStyle = COL.orange; c.beginPath(); c.arc(x + 12, G - 62, 4, 0, Math.PI * 2); c.fill();
    }
  }

  function tree(c: Ctx, x: number, s: number) {
    c.fillStyle = COL.navy; c.fillRect(x - 8 * s, G - 120 * s, 16 * s, 120 * s);
    c.fillStyle = '#d9775c'; c.beginPath(); c.arc(x, G - 170 * s, 72 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e8866a'; c.beginPath(); c.arc(x - 30 * s, G - 150 * s, 48 * s, 0, Math.PI * 2); c.fill();
  }

  function awning(c: Ctx, x: number, w: number, y: number) {
    const n = 8, sw = w / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = i % 2 ? COL.creamL : COL.orange;
      c.fillRect(x - w / 2 + i * sw, y, sw, 40);
      c.beginPath(); c.arc(x - w / 2 + i * sw + sw / 2, y + 40, sw / 2, 0, Math.PI); c.fill();
    }
  }

  function stall(c: Ctx, x: number) {
    c.fillStyle = COL.navy; c.fillRect(x - 130, G - 260, 10, 260); c.fillRect(x + 120, G - 260, 10, 260);
    awning(c, x, 280, G - 270);
    c.fillStyle = '#c9705a'; c.fillRect(x - 120, G - 110, 240, 20);
    c.fillStyle = '#a85b48'; c.fillRect(x - 110, G - 90, 220, 90);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = i % 3 ? COL.orange : '#f2b632';
      c.beginPath(); c.arc(x - 96 + i * 24, G - 118, 11, 0, Math.PI * 2); c.fill();
    }
  }

  function kiosk(c: Ctx, x: number) {
    awning(c, x, 220, G - 250);
    c.fillStyle = '#f7e4d6'; rr(c, x - 100, G - 210, 200, 160, 10); c.fill();
    c.fillStyle = COL.orange; c.fillRect(x - 100, G - 150, 200, 16);
    c.fillStyle = COL.navy; rr(c, x - 18, G - 200, 36, 40, 6); c.fill();
    c.beginPath(); c.arc(x - 60, G - 34, 26, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 60, G - 34, 26, 0, Math.PI * 2); c.fill();
  }

  function scene3(c: Ctx, t: number) {
    const z = lerp(1, 0.36, sm(2.2, 9.0, t));
    sky(c, [[0, '#3b3f63'], [0.5, '#b9707a'], [0.85, '#efa384'], [1, '#f6c9ab']], 800, 690, '255,240,228', t, 0.1);
    c.fillStyle = 'rgba(251,238,227,0.92)';
    c.beginPath(); c.arc(800, 640 - 24 * sm(0, 14, t), 70, 0, Math.PI * 2); c.fill();
    const zf = lerp(1, z, 0.45);
    c.save(); c.translate(800, G); c.scale(zf, zf); c.translate(-800, -G);
    hills(c, G - 90, 120, 'rgba(201,112,90,0.55)', 1.1);
    hills(c, G - 30, 80, 'rgba(232,134,106,0.75)', 2.7);
    c.restore();
    ground(c, G - 14, '#f6dcc9', '#fbeee3');

    c.save();
    c.translate(800, G); c.scale(z, z); c.translate(-800, -G);
    c.fillStyle = 'rgba(232,134,106,0.16)'; c.fillRect(-4000, G + 16, 9000, 28);
    const trees: [number, number][] = [[-1500, 1.1], [-1050, 0.9], [-280, 1.0], [430, 0.85], [1300, 1.05], [1760, 0.9], [2750, 1.1], [3200, 0.95]];
    for (const [tx, ts] of trees) tree(c, tx, ts);
    house(c, 230, 220, 190, false);
    house(c, 1390, 230, 200, false);
    house(c, 800, 300, 250, true);
    stall(c, -800);
    kiosk(c, 2380);

    const herX = lerp(770, -560, sm(2.4, 9.0, t));
    const bikeX = lerp(880, 2200, sm(2.0, 9.0, t));
    shadow(c, herX, G, 42); shadow(c, bikeX, G, 90);
    const her = person(c, { x: herX, y: G, s: 0.94, dir: -1, phase: t * 8.5, amp: win(2.4, 9.0, t, 0.5), kind: 'f', hp: true });
    const him = cyclist(c, bikeX, G, (bikeX - 880) / 38);
    c.restore();

    const A = P3(her.e, z), B = P3(him.e, z);
    const herHead = P3({ x: her.hx, y: her.hy }, z), herTop = P3({ x: her.hx, y: her.top }, z).y;
    const himHead = P3({ x: him.hx, y: him.hy }, z), himTop = P3({ x: him.hx, y: him.top }, z).y;
    const herU = Math.max(12, her.u * z), himU = Math.max(12, him.u * z);
    const bM = beat(t, 9.4, 'B'), bF = beat(t, 13.1, 'A');
    const talkM = bM.speak, talkF = bF.speak;
    const pulse = bM.pulse || bF.pulse;
    const dist = Math.hypot(B.x - A.x, B.y - A.y);
    const apex = cord(c, A, B, { heart: 1 - sm(160, 300, dist), energy: Math.max(talkM, talkF), pulse });
    const miles = (him.e.x - her.e.x) / 1650;
    tag(c, apex.x, apex.y - 34, `${Math.max(0.1, miles).toFixed(1)} mi apart`, sm(3.4, 4.0, t));
    voiceBars(c, himHead.x, himHead.y, himU, t, talkM);
    voiceBars(c, herHead.x, herHead.y, herU, t, talkF);
    chip(c, herHead.x - 80, herTop - 36, 'podcast', 1 - 0.7 * bM.duck, t);
    chip(c, himHead.x + 80, himTop - 36, 'music', 1 - 0.7 * bF.duck, t);
    bubble(c, himHead.x, himTop - 76, 'Grabbing coffee. Want one?', talkM, -0.2);
    bubble(c, herHead.x, herTop - 76, 'Oat latte, please!', talkF, 0.2);
  }

  // ───────────── End card ─────────────
  function endCard(c: Ctx, t: number) {
    const g = c.createRadialGradient(800, 470, 40, 800, 470, 950);
    g.addColorStop(0, '#2a2f52'); g.addColorStop(1, '#141428');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save();
    c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const r = 120 + ((i * 110 + t * 60) % 770);
      c.strokeStyle = `rgba(244,219,200,${(0.22 * (1 - r / 900)).toFixed(3)})`;
      c.beginPath(); c.arc(800, 400, r, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
    if (logoImg.complete && logoImg.naturalWidth) {
      const a = sm(0.15, 0.9, t), h = lerp(150, 190, sm(0, 1.2, t)), w = h * logoImg.naturalWidth / logoImg.naturalHeight;
      c.save(); c.globalAlpha = a; c.drawImage(logoImg, 800 - w / 2, 400 - h / 2, w, h); c.restore();
    }
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.globalAlpha = sm(0.5, 1.3, t);
    c.fillStyle = COL.creamL;
    c.font = `700 ${fs(118)}px ${FONT}`;
    c.fillText('Duet', 800, 640);
    c.globalAlpha = sm(0.9, 1.7, t);
    c.fillStyle = COL.cream;
    c.font = `600 ${fs(44)}px ${FONT}`;
    c.fillText('Together, even when apart.', 800, 712);
    c.globalAlpha = sm(1.3, 2.1, t);
    c.fillStyle = COL.muted;
    c.font = `400 ${fs(28)}px ${FONT}`;
    c.fillText('Always-on voice for the people who matter most.', 800, 770);
    c.restore();
  }

  // ───────────── Timeline ─────────────
  const SEGS: Segment[] = [
    { name: 'Out exploring', d: 17.8, draw: scene1, caps: [
      [0, 'Out exploring the city. Headphones on, each of you in your own soundtrack.'],
      [3, 'The crowd pulls you apart, and neither of you notices.'],
      [6.6, 'You turn to say something, and they’re gone.'],
      [8.6, 'With Duet, you’re still connected. Just talk; Duet can lower their music so they hear you.'],
      [15.3, 'No calling, no texting, no scanning the crowd.'],
    ] },
    { name: 'On the road', d: 14.6, draw: scene2, caps: [
      [0, 'Driving a rideshare shift. Long, quiet stretches between pickups.'],
      [2.9, 'A friend rides along on an always-on line. No speakerphone, no calling back after every trip.'],
      [11.2, 'A rider gets in? Tap mute. The line stays open for later.'],
    ] },
    { name: 'Leaving home', d: 17.6, draw: scene3, caps: [
      [0, 'Saturday morning. Two plans, one front door.'],
      [2.4, 'She walks to the farmers market with a podcast. He rides to the park with a playlist.'],
      [9.3, 'Miles apart, and still one sentence away.'],
      [15.9, 'Say it the moment you think of it. Duet keeps the line open.'],
    ] },
    { name: 'Duet', d: 5, draw: endCard, end: true, caps: [
      [0, 'Duet. Together, even when apart.'],
    ] },
  ];
  const STARTS: number[] = [];
  let TOTAL = 0;
  for (const s of SEGS) { STARTS.push(TOTAL); TOTAL += s.d; }

  function locate(T: number) {
    let i = SEGS.length - 1;
    while (i > 0 && T < STARTS[i]) i--;
    return { i, lt: T - STARTS[i] };
  }

  function render(c: Ctx, T: number) {
    const { i, lt } = locate(T);
    const seg = SEGS[i];
    c.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    c.clearRect(0, 0, W, H);
    seg.draw(c, lt);
    if (!seg.end) brandMark(c, seg.name);
    const fade = 1 - sm(0, 0.45, Math.min(lt, seg.d - lt));
    if (fade > 0.001) { c.fillStyle = `rgba(20,20,40,${fade})`; c.fillRect(0, 0, W, H); }
    return { i, lt };
  }

  // ───────────── Controls ─────────────
  const c2d = ctx;
  el.scrub.max = String(TOTAL);
  el.chapters.replaceChildren();
  const chapBtns = SEGS.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = el.chapterClassName;
    b.textContent = s.name;
    b.addEventListener('click', () => { T = STARTS[i] + 0.5; draw(); });
    el.chapters.appendChild(b);
    return b;
  });

  let T = reduce ? 10.6 : 0.5;
  let playing = !reduce;
  let scrubbing = false;
  let lastCap = '', lastSeg = -1;
  let raf = 0;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function setPlaying(p: boolean) {
    playing = p;
    el.playIcon.setAttribute('d', p ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4l13 8-13 8z');
    el.playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
  }

  function draw() {
    const info = render(c2d, T);
    const seg = SEGS[info.i];
    let cap = seg.caps[0][1];
    for (const [s, txt] of seg.caps) if (info.lt >= s) cap = txt;
    if (cap !== lastCap) { el.caption.textContent = cap; lastCap = cap; }
    if (info.i !== lastSeg) {
      el.eyebrow.textContent = seg.name;
      chapBtns.forEach((b, j) => b.setAttribute('aria-current', j === info.i ? 'true' : 'false'));
      lastSeg = info.i;
    }
    if (!scrubbing) el.scrub.value = T.toFixed(2);
    el.time.textContent = `${fmt(T)} / ${fmt(TOTAL)}`;
  }

  const onPlay = () => setPlaying(!playing);
  const onScrubDown = () => { scrubbing = true; };
  const onPointerUp = () => { scrubbing = false; };
  const onScrubInput = () => { T = parseFloat(el.scrub.value); draw(); };
  el.playBtn.addEventListener('click', onPlay);
  el.scrub.addEventListener('pointerdown', onScrubDown);
  window.addEventListener('pointerup', onPointerUp);
  el.scrub.addEventListener('input', onScrubInput);
  el.scrub.addEventListener('change', onPointerUp);

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    k = r.width / W;
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(cv);
  logoImg.addEventListener('load', draw);

  setPlaying(playing);
  let last: number | null = null;
  function frame(now: number) {
    if (last === null) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing && !scrubbing) { T = (T + dt) % TOTAL; draw(); }
    raf = requestAnimationFrame(frame);
  }
  resize();
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    logoImg.removeEventListener('load', draw);
    el.playBtn.removeEventListener('click', onPlay);
    el.scrub.removeEventListener('pointerdown', onScrubDown);
    window.removeEventListener('pointerup', onPointerUp);
    el.scrub.removeEventListener('input', onScrubInput);
    el.scrub.removeEventListener('change', onPointerUp);
    el.chapters.replaceChildren();
  };
}
