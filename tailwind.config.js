/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          500: '#64748B',
          700: '#334155',
          900: '#0F172A',
        },
        living: '#0D9488',
        comfort: '#D97706',
        savings: '#059669',
        danger: '#DC2626',
        warn: '#F59E0B',
      },
      fontFamily: {
        sans: ['DMSans_400Regular'],
        medium: ['DMSans_500Medium'],
        bold: ['DMSans_700Bold'],
      },
    },
  },
  plugins: [],
};
