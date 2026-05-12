/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        platzi: {
          green: '#98EC2D',
          'green-hover': '#7dcf1f',
        },
        dark: {
          900: '#0f0f0f',
          800: '#1a1a1a',
          700: '#222222',
          600: '#2e2e2e',
          500: '#3d3d3d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease',
        'slide-up': 'slideUp 200ms ease',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, 
                   to:   { opacity: 1, transform: 'translateY(0)' } },
      }
    }
  },
  plugins: [],
}
