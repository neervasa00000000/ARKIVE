export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#050505',
        surface: '#0c0c0e',
        'surface-2': '#141416',
        'surface-3': '#1c1c1f',
        card: '#0c0c0e',
        elevated: '#141416',
        line: 'rgba(255, 255, 255, 0.08)',
        'line-strong': 'rgba(255, 255, 255, 0.14)',
        border: 'rgba(255, 255, 255, 0.08)',
        ink: '#fafafa',
        muted: '#a1a1aa',
        faint: '#52525b',
        accent: '#e4e4e7',
        brand: '#fafafa',
        'brand-hover': '#e4e4e7',
        'brand-muted': 'rgba(255, 255, 255, 0.06)',
        cyan: { 400: '#a1a1aa' },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#52525b',
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
