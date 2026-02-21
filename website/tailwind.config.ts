import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1a2e',
        surface: '#16213e',
        primary: '#e8734a',
        'primary-light': '#f0956e',
        secondary: '#0f3460',
        'text-main': '#ffffff',
        'text-muted': '#b0b8c8',
        'text-dark': '#2d3650',
        success: '#4ade80',
        warning: '#fbbf24',
        danger: '#ef4444',
        glass: 'rgba(255, 255, 255, 0.12)',
        'glass-border': 'rgba(255, 255, 255, 0.18)',
        'lobby-warm': '#f4dbc8',
        'lobby-dark': '#1a293d',
      },
      keyframes: {
        'float-emoji': {
          '0%': { transform: 'translateY(0) scale(0.3)', opacity: '1' },
          '15%': { transform: 'translateY(-10vh) scale(1)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'translateY(-50vh) scale(0.6)', opacity: '0' },
        },
      },
      animation: {
        'float-emoji': 'float-emoji 2s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
