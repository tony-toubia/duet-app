import Link from 'next/link';
import Image from 'next/image';
import { AdSlot } from '@/components/app/AdSlot';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-lobby-dark text-white">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16"
        style={{ background: 'linear-gradient(180deg, #1a293d 0%, #24384f 40%, #f4dbc8 100%)' }}>

        {/* Logo */}
        <div className="mb-6">
          <Image
            src="/duet-logo.png"
            alt="Duet"
            width={80}
            height={80}
            className="mx-auto mb-4"
            style={{ filter: 'drop-shadow(0 8px 32px rgba(232, 115, 74, 0.3))' }}
          />
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-4 max-sm:text-4xl">Duet</h1>
        <p className="text-xl text-white/85 leading-relaxed max-w-md mb-10 max-sm:text-lg">
          Always-on voice connection.<br />Together, even when apart.
        </p>

        {/* Badges */}
        <div className="flex gap-4 flex-wrap justify-center mb-12">
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-5 py-3 text-sm font-medium backdrop-blur-lg">
            Available on iOS
          </span>
          <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-5 py-3 text-sm font-medium backdrop-blur-lg">
            Available on Android
          </span>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 rounded-xl px-5 py-3 text-sm font-medium backdrop-blur-lg hover:bg-primary/30 transition-colors"
          >
            Open Web App
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl w-full mb-16">
          <div className="text-center p-5">
            <div
              className="w-16 h-16 mx-auto mb-4"
              style={{ backgroundColor: '#ec7657', WebkitMaskImage: 'url(/always-on.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url(/always-on.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
            />
            <h3 className="text-base font-semibold mb-1">Always On</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              One-tap voice rooms that stay connected in the background.
            </p>
          </div>
          <div className="text-center p-5">
            <div
              className="w-16 h-16 mx-auto mb-4"
              style={{ backgroundColor: '#ec7657', WebkitMaskImage: 'url(/private.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url(/private.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
            />
            <h3 className="text-base font-semibold mb-1">Private</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Peer-to-peer encrypted audio. We never hear your conversations.
            </p>
          </div>
          <div className="text-center p-5">
            <div
              className="w-16 h-16 mx-auto mb-4"
              style={{ backgroundColor: '#ec7657', WebkitMaskImage: 'url(/stay-connected.png)', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: 'url(/stay-connected.png)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
            />
            <h3 className="text-base font-semibold mb-1">Stay Connected</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Add friends, see who&apos;s online, and jump into a room together.
            </p>
          </div>
        </div>

        {/* Ad */}
        {process.env.NEXT_PUBLIC_AD_SLOT_LANDING && (
          <div className="w-full max-w-2xl mb-12">
            <AdSlot adSlot={process.env.NEXT_PUBLIC_AD_SLOT_LANDING} format="horizontal" />
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <Link href="/privacy" className="text-lobby-dark/60 text-sm mx-3 hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/delete" className="text-lobby-dark/60 text-sm mx-3 hover:text-primary transition-colors">
            Delete Account
          </Link>
          <a href="mailto:hello@getduet.app" className="text-lobby-dark/60 text-sm mx-3 hover:text-primary transition-colors">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
