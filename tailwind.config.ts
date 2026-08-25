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
      },
      fontFamily: {
        mono: [
          '"IBM Plex Mono"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
