import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ConceptFilm } from '@/components/concept/ConceptFilm';

const TITLE = 'How Duet Works - Duet';
const DESCRIPTION =
  'A 55-second look at Duet: an always-on voice line that keeps you close to your people, whether you’re lost in a crowd, driving a shift, or miles apart.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/concept' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://getduet.app/concept',
    siteName: 'Duet',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Duet - Always-On Voice Connection' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

const LEGEND = [
  {
    title: 'The glowing line',
    body: 'Your always-on voice connection. It stretches as far as you go: across a crowd, a city, or miles.',
    icon: (
      <svg viewBox="0 0 48 32" aria-hidden="true" className="h-8 w-12">
        <path d="M4 26 Q24 -4 44 26" fill="none" stroke="#f4dbc8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="11" r="4" fill="#e8734a" />
      </svg>
    ),
  },
  {
    title: 'The listening pill',
    body: 'What each person is playing. When the other person talks, it lowers so their voice comes through, then rises again.',
    icon: (
      <svg viewBox="0 0 48 32" aria-hidden="true" className="h-8 w-12">
        <path d="M6 13h4l6-5v16l-6-5H6z" fill="#f4dbc8" />
        {[22, 28, 34, 40].map((x, i) => (
          <rect key={x} x={x} y={i % 2 ? 10 : 6} width="4" height={i % 2 ? 12 : 20} rx="2" fill="#e8734a" />
        ))}
      </svg>
    ),
  },
  {
    title: 'Mute, not hang up',
    body: 'Need a moment? Tap mute. The line stays open, so you’re back with one tap and nobody has to call again.',
    icon: (
      <svg viewBox="0 0 48 32" aria-hidden="true" className="h-8 w-12">
        <rect x="19" y="4" width="10" height="16" rx="5" fill="none" stroke="#f4dbc8" strokeWidth="3" />
        <path d="M14 15a10 10 0 0 0 20 0M24 25v4" fill="none" stroke="#f4dbc8" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 4l24 24" stroke="#e8734a" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function ConceptPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-5 pt-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/duet-logo.png" alt="" width={348} height={325} className="h-8 w-auto" priority />
          <span className="text-xl font-bold tracking-tight">Duet</span>
        </Link>
        <Link
          href="/app"
          className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-primary-light"
        >
          Open Web App
        </Link>
      </header>

      <main className="mx-auto grid max-w-[1080px] gap-12 px-5 pb-20 pt-10">
        <section className="grid gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary-light">How Duet works</span>
          <h1 className="text-balance text-[clamp(32px,5vw,52px)] font-bold leading-tight">
            Together, even when apart.
          </h1>
          <p className="max-w-[60ch] text-lg leading-relaxed text-white/75 max-sm:text-base">
            Duet keeps an always-on voice line open between you and the people you care about. Your music or
            podcast keeps playing, and it lowers on its own whenever they talk.
          </p>
        </section>

        <ConceptFilm />

        <section aria-labelledby="legend-heading" className="grid gap-5 border-t border-white/10 pt-10">
          <h2 id="legend-heading" className="text-xl font-semibold">What you’re seeing</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {LEGEND.map((item) => (
              <div key={item.title} className="grid content-start gap-2">
                {item.icon}
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-[15px] leading-relaxed text-white/70">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid justify-items-start gap-4 rounded-2xl bg-lobby-dark px-6 py-8 sm:px-10">
          <h2 className="text-2xl font-bold">Start a room in seconds</h2>
          <p className="max-w-[52ch] text-white/75">
            Free on iOS and the web. Share a room code, and you’re connected.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-base font-semibold shadow-lg shadow-primary/25 transition-colors hover:bg-primary-light"
            >
              Open Web App
            </Link>
            <Link href="/" className="text-sm font-semibold text-white/70 transition-colors hover:text-primary">
              Back to getduet.app
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-lobby-dark px-6 py-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 flex flex-wrap justify-center gap-6">
            <Link href="/privacy" className="text-sm text-white/50 transition-colors hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="/delete" className="text-sm text-white/50 transition-colors hover:text-primary">
              Delete Account
            </Link>
            <a href="mailto:hello@getduet.app" className="text-sm text-white/50 transition-colors hover:text-primary">
              Contact
            </a>
          </div>
          <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Duet. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
