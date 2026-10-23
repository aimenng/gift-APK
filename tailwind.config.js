/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  // Enumerated on purpose: class names also live as plain strings in the .ts constants
  // files (components/anniversary/constants.ts, components/focus/constants.ts), so .ts
  // must be scanned. android/, dist/, backend/ and public/ contain no app markup.
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './authContext.tsx',
    './context.tsx',
    './constants.ts',
    './types.ts',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8a9a5b', // Sage Green
        'primary-dark': '#728961',
        'background-light': '#FFFDD0', // Cream White
        'background-dark': '#1d2210',
        surface: '#ffffff',
        'text-main': '#2c2c2a',
        sage: '#758961',
        'sage-light': '#e3e9de',
        rose: { 50: '#fff1f2', 100: '#ffe4e6', 400: '#fb7185', 500: '#f43f5e' },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans SC', 'sans-serif'],
        display: ['Noto Sans SC', 'sans-serif'],
        handwriting: ['Caveat', 'cursive'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 24px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 24px)',
      },
      boxShadow: {
        soft: '0 20px 40px -15px rgba(0, 0, 0, 0.1)',
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        glow: '0 0 20px rgba(138, 154, 91, 0.3)',
        'inner-glow': 'inset 0 2px 10px rgba(138, 154, 91, 0.15)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
