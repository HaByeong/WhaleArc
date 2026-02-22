/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'whale-dark': '#1a2b4d', // 다크 블루
        'whale-light': '#4a90e2', // 라이트 블루
        'whale-accent': '#5ba3f5', // 강조 블루
      },
    },
  },
  plugins: [],
}

