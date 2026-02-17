/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
      {
        // Allow Firebase Auth iframe and handler to load in frames/popups
        source: '/__/auth/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://getduet.app https://www.getduet.app",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/__/auth/:path*',
          destination: 'https://duet-33cf5.firebaseapp.com/__/auth/:path*',
        },
      ],
    };
  },
};

export default nextConfig;
