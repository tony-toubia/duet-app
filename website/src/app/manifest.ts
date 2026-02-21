import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Duet - Always-On Voice',
    short_name: 'Duet',
    description: 'Always-on voice for the people who matter most.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#1a293d',
    theme_color: '#e8734a',
    icons: [
      { src: '/duet-logo.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
