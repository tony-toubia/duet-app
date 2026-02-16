import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Duet - Always-On Voice Connection',
  description: 'Duet is an always-on voice connection app. Together, even when apart.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
