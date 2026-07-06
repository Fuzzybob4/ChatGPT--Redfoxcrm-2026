import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fox: {
          red: '#D9352A',
          ember: '#FF6A3D',
          ink: '#111827',
          coal: '#0B0F19',
          cream: '#FFF8F1',
          line: '#E5E7EB'
        }
      },
      boxShadow: { soft: '0 18px 60px rgba(15, 23, 42, 0.08)' },
      borderRadius: { xl2: '1.25rem' }
    }
  },
  plugins: []
}

export default config
