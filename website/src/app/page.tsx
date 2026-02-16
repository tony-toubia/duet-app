import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-lobby-dark text-white">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16"
        style={{ background: 'linear-gradient(180deg, #1a293d 0%, #24384f 50%, #f4dbc8 100%)' }}>

        {/* Logo */}
        <div className="mb-6">
          <div className="w-20 h-20 bg-primary rounded-[20px] flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 8px 32px rgba(232, 115, 74, 0.3)' }}>
            <svg viewBox="0 0 24 24" className="w-11 h-11 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
            </svg>
          </div>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight mb-4 max-sm:text-4xl">Duet</h1>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full mb-16">
          <div className="text-center p-6">
            <div className="text-3xl mb-3">&#x1F399;</div>
            <h3 className="text-base font-semibold mb-1">Always On</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              One-tap voice rooms that stay connected in the background.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">&#x1F512;</div>
            <h3 className="text-base font-semibold mb-1">Private</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Peer-to-peer encrypted audio. We never hear your conversations.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">&#x1F465;</div>
            <h3 className="text-base font-semibold mb-1">Friends</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Add friends, see who&apos;s online, and invite them to your room.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <Link href="/privacy" className="text-white/50 text-sm mx-3 hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          <Link href="/delete" className="text-white/50 text-sm mx-3 hover:text-primary transition-colors">
            Delete Account
          </Link>
          <a href="mailto:privacy@duetapp.com" className="text-white/50 text-sm mx-3 hover:text-primary transition-colors">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
