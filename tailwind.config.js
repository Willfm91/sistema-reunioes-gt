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
        canvas: '#0B0E14',
        panel: '#12161F',
        edge: '#1F2430',
        ink: '#E8EAED',
        muted: '#8B93A1',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
