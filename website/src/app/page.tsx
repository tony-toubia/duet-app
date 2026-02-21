import Link from 'next/link';
import Image from 'next/image';
import { AdSlot } from '@/components/app/AdSlot';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Duet',
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'iOS, Android, Web',
  description: 'Always-on voice for the people who matter most. One-tap rooms, peer-to-peer encrypted audio.',
  url: 'https://getduet.app',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  installUrl: 'https://play.google.com/store/apps/details?id=com.duet.app',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-lobby-dark text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ============ HERO ============ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background illustration */}
        <Image
          src="/hero-bg.jpg"
          alt=""
          fill
          priority
          className="object-cover"
          aria-hidden="true"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 via-black/40 to-[#1a293d]" />

        {/* Hero content */}
        <div className="relative z-[2] text-center px-6 flex flex-col items-center justify-between min-h-screen py-16">
          {/* Top group: logo + title */}
          <div>
            <img
              src="/duet-logo-animated-once.gif"
              alt="Duet"
              width={140}
              height={105}
              className="mx-auto mb-4 drop-shadow-[0_8px_32px_rgba(232,115,74,0.4)] mix-blend-screen"
            />
            <h1
              className="text-6xl font-bold tracking-tight max-sm:text-4xl"
              style={{ textShadow: '0 4px 24px rgba(232, 115, 74, 0.3)' }}
            >
              Duet
            </h1>
          </div>

          {/* Bottom group: tagline + CTAs */}
          <div>
            <p className="text-xl text-white/85 leading-relaxed max-w-lg mx-auto mb-10 max-sm:text-lg">
              Always-on voice for the people who matter most.
            </p>

          {/* CTAs */}
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-light text-white rounded-2xl px-8 py-4 text-base font-semibold transition-colors shadow-lg shadow-primary/25"
            >
              Open Web App
            </Link>
            <a
              href="#download"
              className="inline-flex items-center gap-2 border-2 border-white/30 hover:border-white/60 rounded-2xl px-8 py-4 text-base font-semibold transition-colors backdrop-blur-sm"
            >
              Download
            </a>
          </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[3] animate-bounce opacity-60">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="bg-lobby-dark py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 max-sm:text-2xl animate-fade-in-up">
            Why Duet?
          </h2>
          <p className="text-center text-white/60 mb-14 max-w-md mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            A voice connection that fits into your life — not the other way around.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Always On */}
            <div
              className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
            >
              <div
                className="w-14 h-14 mx-auto mb-5"
                style={{ backgroundColor: '#e8734a', WebkitMaskImage: 'url(/always-on.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url(/always-on.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
              />
              <h3 className="text-lg font-semibold mb-2">Always On</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                One-tap voice rooms that stay connected in the background while you go about your day.
              </p>
            </div>

            {/* Private */}
            <div
              className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }}
            >
              <div
                className="w-14 h-14 mx-auto mb-5"
                style={{ backgroundColor: '#e8734a', WebkitMaskImage: 'url(/private.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url(/private.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
              />
              <h3 className="text-lg font-semibold mb-2">Private</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Peer-to-peer encrypted audio. Your conversations never touch our servers.
              </p>
            </div>

            {/* Stay Connected */}
            <div
              className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center animate-fade-in-up opacity-0"
              style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
            >
              <div
                className="w-14 h-14 mx-auto mb-5"
                style={{ backgroundColor: '#e8734a', WebkitMaskImage: 'url(/stay-connected.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url(/stay-connected.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
              />
              <h3 className="text-lg font-semibold mb-2">Stay Connected</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Add friends, see who&apos;s online, and jump into a room together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ USE CASES ============ */}
      <section className="bg-lobby-dark pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 max-sm:text-2xl">
            Made for real life
          </h2>
          <p className="text-center text-white/60 mb-14 max-w-md mx-auto">
            Duet fits into the moments where a phone call is too much and a text isn&apos;t enough.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Drivers */}
            <div className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-5">🚗</div>
              <h3 className="text-lg font-semibold mb-2">On the road</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Rideshare drivers keeping a friend on the line between pickups. No awkward speakerphone &mdash; just company while you drive.
              </p>
            </div>

            {/* Exploring */}
            <div className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-5">🎧</div>
              <h3 className="text-lg font-semibold mb-2">Out exploring</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Couples in a busy city keeping their own music on but staying one tap away when they spot something worth sharing.
              </p>
            </div>

            {/* Study/Work */}
            <div className="bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-5">📚</div>
              <h3 className="text-lg font-semibold mb-2">Working together, apart</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Study buddies or coworkers with music playing and a voice room open &mdash; like being at the same desk without the commute.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ APP SHOWCASE ============ */}
      <section className="relative z-10 py-24 px-6" style={{ background: 'linear-gradient(180deg, #1a293d 0%, #1e3148 50%, #1a293d 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 max-sm:text-2xl">
            See it in action
          </h2>
          <p className="text-center text-white/60 mb-16 max-w-md mx-auto">
            Create a room, share the code, and start talking — it&apos;s that simple.
          </p>

          {/* Phone mockups */}
          <div className="flex justify-center items-start gap-6 sm:gap-10 overflow-visible pb-4 max-sm:overflow-x-auto max-sm:px-4">
            {/* Lobby */}
            <div className="flex-shrink-0 text-center">
              <div className="transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                <Image
                  src="/mockup-lobby.png"
                  alt="Duet lobby screen"
                  width={260}
                  height={564}
                  className="rounded-[2rem] shadow-2xl shadow-black/40 max-sm:w-[200px] max-sm:h-auto"
                />
              </div>
              <p className="text-sm text-white/50 mt-5 font-medium">Drop in instantly</p>
            </div>

            {/* Share */}
            <div className="flex-shrink-0 text-center sm:mt-8">
              <div className="transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <Image
                  src="/mockup-share.png"
                  alt="Duet share screen"
                  width={260}
                  height={564}
                  className="rounded-[2rem] shadow-2xl shadow-black/40 max-sm:w-[200px] max-sm:h-auto"
                />
              </div>
              <p className="text-sm text-white/50 mt-5 font-medium">Share a room code</p>
            </div>

            {/* Room */}
            <div className="flex-shrink-0 text-center">
              <div className="transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <Image
                  src="/mockup-room.png"
                  alt="Duet room screen"
                  width={260}
                  height={564}
                  className="rounded-[2rem] shadow-2xl shadow-black/40 max-sm:w-[200px] max-sm:h-auto"
                />
              </div>
              <p className="text-sm text-white/50 mt-5 font-medium">Talk while you live your life</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ AD SLOT ============ */}
      {process.env.NEXT_PUBLIC_AD_SLOT_LANDING && (
        <section className="bg-lobby-dark py-8 px-6">
          <div className="max-w-2xl mx-auto">
            <AdSlot adSlot={process.env.NEXT_PUBLIC_AD_SLOT_LANDING} format="horizontal" />
          </div>
        </section>
      )}

      {/* ============ DOWNLOAD / GET STARTED ============ */}
      <section
        id="download"
        className="py-24 px-6"
        style={{ background: 'linear-gradient(180deg, #1a293d 0%, #2a3f55 30%, #f4dbc8 100%)' }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4 max-sm:text-3xl">
            Ready to connect?
          </h2>
          <p className="text-lg text-white/70 mb-12 max-sm:text-base">
            Available free on iOS, Android, and the web.
          </p>

          {/* Store badges + web app */}
          <div className="flex flex-wrap justify-center items-center gap-5">
            {/* App Store badge (placeholder link) */}
            <span className="opacity-80 hover:opacity-100 transition-opacity cursor-default">
              <Image
                src="/badge-appstore.png"
                alt="Download on the App Store"
                width={180}
                height={53}
                className="h-[53px] w-auto"
              />
            </span>

            {/* Google Play badge */}
            <a
              href="https://play.google.com/store/apps/details?id=com.duet.app"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 hover:opacity-100 transition-opacity"
            >
              <Image
                src="/badge-googleplay.png"
                alt="Get it on Google Play"
                width={180}
                height={53}
                className="h-[53px] w-auto"
              />
            </a>

            {/* Web app button */}
            <Link
              href="/app"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-light text-white rounded-2xl px-7 py-3.5 text-base font-semibold transition-colors shadow-lg shadow-primary/25"
            >
              Open Web App
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-lobby-dark border-t border-white/10 py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex flex-wrap justify-center gap-6 mb-6">
            <Link href="/privacy" className="text-white/50 text-sm hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/delete" className="text-white/50 text-sm hover:text-primary transition-colors">
              Delete Account
            </Link>
            <a href="mailto:hello@getduet.app" className="text-white/50 text-sm hover:text-primary transition-colors">
              Contact
            </a>
          </div>
          <p className="text-white/30 text-xs">&copy; {new Date().getFullYear()} Duet. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
