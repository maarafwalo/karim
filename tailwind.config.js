/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1a56db', dark: '#1645b7', light: '#e8f0fe' },
        danger:  { DEFAULT: '#dc2626', light: '#fee2e2' },
        success: { DEFAULT: '#059669', light: '#d1fae5' },
        accent:  { DEFAULT: '#d97706', light: '#fef3c7' },
        muted:   '#64748b',
      },
      fontFamily: {
        arabic: ['"Cairo"', '"Noto Kufi Arabic"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp .25s ease',
        'slide-in': 'slideIn .25s ease',
        'fade-in':  'fadeIn .2s ease',
      },
      keyframes: {
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
