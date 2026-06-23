export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0A0B0F',
        card: '#12141C',
        elevated: '#1A1D2A',
        border: '#1E2235',
        cyan: { 400: '#00E5FF', 500: '#00CCE5' },
        purple: { 400: '#9B4FDE', 500: '#7B2FBE' },
        text: {
          primary: '#E8E8F4',
          secondary: '#7A7F9A',
          muted: '#3D4260'
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } }
      }
    }
  }
}
