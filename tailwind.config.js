/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius-sm)',
        sm: 'calc(var(--radius-sm) - 2px)',
        full: 'var(--radius-pill)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      transitionDuration: {
        micro: 'var(--motion-duration-micro)',
        reveal: 'var(--motion-duration-reveal)',
        state: 'var(--motion-duration-state)',
      },
      transitionTimingFunction: {
        motion: 'var(--motion-ease-standard)',
      },
      animation: {
        'fade-in': 'fadeIn var(--motion-duration-reveal) var(--motion-ease-standard) both',
        'slide-up': 'slideUp var(--motion-duration-reveal) var(--motion-ease-standard) both',
        'panel-open': 'panelOpen var(--motion-duration-reveal) var(--motion-ease-standard) both',
        'result-reveal': 'resultReveal var(--motion-duration-reveal) var(--motion-ease-standard) both',
        'state-change': 'stateChange var(--motion-duration-state) var(--motion-ease-emphasis) both',
        'status-enter': 'statusEnter var(--motion-duration-reveal) var(--motion-ease-standard) both',
        'theme-icon': 'themeIcon var(--motion-duration-micro) var(--motion-ease-emphasis) both',
        'toast-in': 'toastIn var(--motion-duration-reveal) var(--motion-ease-emphasis) both',
        'spin-slow': 'spin 1.4s linear infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(10px) scale(0.99)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        panelOpen: {
          from: { opacity: 0, transform: 'translateY(-4px) scale(0.995)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        resultReveal: {
          from: { opacity: 0, transform: 'translateY(8px) scale(0.99)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        stateChange: {
          from: { opacity: 0, transform: 'translateY(2px) scale(0.98)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        statusEnter: {
          from: { opacity: 0, transform: 'translateY(3px) scale(0.96)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        themeIcon: {
          from: { opacity: 0, transform: 'rotate(-8deg) scale(0.92)' },
          to: { opacity: 1, transform: 'rotate(0) scale(1)' },
        },
        toastIn: {
          from: { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
