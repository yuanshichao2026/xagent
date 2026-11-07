/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        codex: {
          bg: '#0d0d0d',
          sidebar: '#121212',
          surface: '#1c1c1c',
          border: '#262626',
          input: '#171717',
          hover: '#1e1e1e'
        }
      }
    },
  },
  plugins: [],
}
