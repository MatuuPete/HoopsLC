import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        panel: '#111111',
        border: '#2a2a2a',
        text: '#f5f5f5',
        muted: '#8a8a8a',
        accent: '#22c55e',
        // Light-theme palette for the public home page only — grounded in
        // actual basketball materials (backboard, court line, hardwood,
        // basketball leather) rather than the app's dark in-product theme.
        paper: '#F7F5F1',
        ink: '#171512',
        chalk: '#D9D3C8',
        court: '#EFEAE1',
        rim: '#E8590C',
      },
      fontFamily: {
        mono: [
          '"IBM Plex Mono"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
        display: ['Anton', 'sans-serif'],
        body: ['"Work Sans"', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
