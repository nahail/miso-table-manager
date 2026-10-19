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
          dark: '#121214',
          card: '#1a1a1e',
          border: '#2e2e36',
          accent: '#e65c00',
        }
      }
    },
  },
  plugins: [],
}
