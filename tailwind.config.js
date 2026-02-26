/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#03050a',
          900: '#060b14',
          800: '#0a1628',
          700: '#0f2040',
          600: '#162d58',
        },
        satellite: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          green: '#22c55e',
          orange: '#f97316',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(60px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(60px) rotate(-360deg)' },
        }
      }
    },
  },
  plugins: [],
};
