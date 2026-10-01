'use client';

import { useEffect, useRef } from 'react';
import { mountConceptFilm } from './conceptFilm';

const CHAPTER_CLASS =
  'rounded-full border border-white/20 px-3 py-1.5 text-[13px] font-semibold text-text-muted transition-colors ' +
  'hover:border-white/40 hover:text-white ' +
  'aria-[current=true]:border-lobby-warm aria-[current=true]:bg-lobby-warm aria-[current=true]:text-background ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lobby-warm ' +
  'max-sm:px-2.5 max-sm:text-xs';

export function ConceptFilm() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<SVGPathElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const chaptersRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current, playBtn = playRef.current, playIcon = iconRef.current;
    const scrub = scrubRef.current, time = timeRef.current, caption = captionRef.current;
    const eyebrow = eyebrowRef.current, chapters = chaptersRef.current;
    if (!canvas || !playBtn || !playIcon || !scrub || !time || !caption || !eyebrow || !chapters) return;
    return mountConceptFilm({
      canvas, playBtn, playIcon, scrub, time, caption, eyebrow, chapters,
      chapterClassName: CHAPTER_CLASS,
      logoSrc: '/duet-logo.png',
    });
  }, []);

  return (
    <div className="grid gap-4">
      <div className="relative aspect-[16/10] w-full max-w-full overflow-hidden rounded-[18px] border border-white/10 bg-lobby-dark">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          role="img"
          aria-label="Animated illustration of Duet: a couple separated by a New York crowd stays in touch over an always-on voice line, a rideshare driver keeps a friend on the line between pickups, and a couple heads opposite ways from home and still talks across miles."
        />
      </div>

      <div className="grid gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            ref={playRef}
            type="button"
            aria-label="Pause"
            className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-background transition-colors hover:bg-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lobby-warm"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-current">
              <path ref={iconRef} d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </svg>
          </button>
          <nav ref={chaptersRef} aria-label="Scenes" className="flex min-w-0 flex-1 flex-wrap gap-1.5" />
          <span ref={timeRef} className="flex-none text-[13px] tabular-nums text-text-muted">0:00 / 0:55</span>
        </div>
        <input
          ref={scrubRef}
          type="range"
          min={0}
          max={55}
          step={0.01}
          defaultValue={0}
          aria-label="Position in film"
          className="w-full accent-primary"
        />
      </div>

      <div className="grid min-h-[6.4em] content-start gap-1.5 max-sm:min-h-[7.6em]">
        <span ref={eyebrowRef} className="text-xs font-bold uppercase tracking-[0.12em] text-primary-light">
          Out exploring
        </span>
        <p
          ref={captionRef}
          aria-live="polite"
          className="m-0 max-w-[52ch] text-balance text-[clamp(19px,2.4vw,26px)] font-medium leading-snug"
        >
          Out exploring the city. Headphones on, each of you in your own soundtrack.
        </p>
      </div>
    </div>
  );
}
