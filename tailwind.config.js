/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        miso: {
          burgundy: '#5d1022',
          'burgundy-dark': '#450a18',
          'burgundy-light': '#7a1930',
          gold: '#d39f61',
          'gold-dark': '#b68043',
          'gold-light': '#f4e7d5',
          cream: '#faf7f4',
          surface: '#ffffff',
          charcoal: '#1c1917',
        }
      }
    },
  },
  plugins: [],
}
