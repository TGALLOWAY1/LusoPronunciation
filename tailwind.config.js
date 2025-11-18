/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media', // Enable dark mode based on OS preference
  theme: {
    extend: {
      colors: {
        // Portuguese flag colors
        primary: {
          50: '#f0f9f4',
          100: '#dcf2e3',
          200: '#b8e5c7',
          300: '#94d8ab',
          400: '#70cb8f',
          500: '#2d8659', // Green
          600: '#1e6b47',
          700: '#155537',
          800: '#0c3f22',
          900: '#062915',
        },
        accent: {
          400: '#fdd835', // Yellow
          500: '#fbc02d',
        },
        secondary: {
          500: '#002776', // Blue
          600: '#001d5c',
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
    },
  },
  plugins: [],
}

