export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#07090c',
        surface: '#0e1217',
        'surface-2': '#151a21',
        'surface-3': '#1c232c',
        card: '#0e1217',
        elevated: '#151a21',
        line: 'rgba(214, 232, 255, 0.10)',
        'line-strong': 'rgba(214, 232, 255, 0.18)',
        border: 'rgba(214, 232, 255, 0.10)',
        ink: '#f3f7fb',
        muted: '#8f9baa',
        faint: '#5d6976',
        accent: '#53d5ff',
        brand: '#53d5ff',
        'brand-hover': '#83e2ff',
        'brand-muted': 'rgba(83, 213, 255, 0.10)',
        cyan: { 400: '#53d5ff' },
        text: {
          primary: '#f3f7fb',
          secondary: '#8f9baa',
          muted: '#5d6976',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 50px -12px rgba(0,0,0,0.7)',
        float: '0 24px 80px -12px rgba(0,0,0,0.8)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
}
