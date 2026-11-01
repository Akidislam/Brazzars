/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#20251f',
        paper: '#f8f8f5',
        forest: '#234b3b',
        lime: '#c8ed75',
        muted: '#747b73',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      boxShadow: { soft: '0 18px 60px rgba(32, 37, 31, 0.08)' },
    },
  },
  plugins: [],
};
