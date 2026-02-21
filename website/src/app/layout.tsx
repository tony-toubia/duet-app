import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://getduet.app'),
  title: 'Duet - Always-On Voice Connection',
  description: 'Always-on voice for the people who matter most. One-tap rooms, peer-to-peer encrypted audio, free on iOS, Android, and the web.',
  keywords: ['voice chat', 'always on', 'walkie talkie', 'couples app', 'voice call', 'peer to peer', 'encrypted audio'],
  icons: {
    icon: '/favicon.ico',
    apple: '/duet-logo.png',
  },
  openGraph: {
    title: 'Duet - Always-On Voice Connection',
    description: 'Always-on voice for the people who matter most. One-tap rooms, peer-to-peer encrypted audio, free on iOS, Android, and the web.',
    url: 'https://getduet.app',
    siteName: 'Duet',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Duet - Always-On Voice Connection' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Duet - Always-On Voice Connection',
    description: 'Always-on voice for the people who matter most.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  const imaVastTag = process.env.NEXT_PUBLIC_IMA_VAST_TAG?.trim();

  return (
    <html lang="en">
      <head>
        {adsenseClientId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
        {imaVastTag && (
          <script
            async
            src="https://imasdk.googleapis.com/js/sdkloader/ima3.js"
          />
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
