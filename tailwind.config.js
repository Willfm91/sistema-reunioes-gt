/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#1A3A52',
        orange: '#FF9500',
        skyblue: '#4A90E2',
        green: '#2ECC71',
        red: '#E63946',
        emerald: '#10B981',
        gold: '#D4AF37',
        canvas: 'var(--canvas)',
        panel: 'var(--panel)',
        edge: 'var(--edge)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
