export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#f6f3eb',
        surface: '#fffdf7',
        'surface-2': '#eeeae0',
        'surface-3': '#e5dfd1',
        card: '#fffdf7',
        elevated: '#fffdf7',
        line: 'rgba(35, 60, 54, 0.15)',
        'line-strong': 'rgba(35, 60, 54, 0.28)',
        border: 'rgba(35, 60, 54, 0.15)',
        ink: '#17332e',
        muted: '#536d65',
        faint: '#687e76',
        accent: '#1b6d58',
        brand: '#1b6d58',
        'brand-hover': '#14513f',
        'brand-muted': 'rgba(27, 109, 88, 0.10)',
        cyan: { 400: '#1b6d58' },
        text: {
          primary: '#17332e',
          secondary: '#536d65',
          muted: '#687e76',
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
