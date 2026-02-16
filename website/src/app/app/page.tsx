'use client';

import Link from 'next/link';

export default function AppPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white px-6">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6"
        style={{ boxShadow: '0 8px 32px rgba(232, 115, 74, 0.3)' }}>
        <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold mb-2">Duet Web</h1>
      <p className="text-text-muted text-center mb-8 max-w-sm">
        The web version of Duet is coming soon. Voice rooms that work right in your browser.
      </p>
      <Link
        href="/"
        className="text-primary hover:text-primary-light transition-colors text-sm font-medium"
      >
        &larr; Back to home
      </Link>
    </div>
  );
}
