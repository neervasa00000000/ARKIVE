export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#f4f3ef',
        surface: '#fcfbf8',
        'surface-2': '#eae8e2',
        'surface-3': '#dedbd3',
        card: '#fcfbf8',
        elevated: '#fcfbf8',
        line: 'rgba(36, 37, 35, 0.15)',
        'line-strong': 'rgba(36, 37, 35, 0.28)',
        border: 'rgba(36, 37, 35, 0.15)',
        ink: '#242523',
        muted: '#62645f',
        faint: '#73756f',
        accent: '#b63720',
        brand: '#b63720',
        'brand-hover': '#922914',
        'brand-muted': 'rgba(182, 55, 32, 0.10)',
        cyan: { 400: '#b63720' },
        text: {
          primary: '#242523',
          secondary: '#62645f',
          muted: '#73756f',
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
