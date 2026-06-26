/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        outfit: ['var(--font-outfit)'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: '#4B244A',
          foreground: '#ffffff',
          glow: 'rgba(75, 36, 74, 0.5)',
        },
        accent: {
          DEFAULT: '#4B244A',
          glow: 'rgba(75, 36, 74, 0.3)',
        },
      },
    },
  },
  plugins: [],
}
