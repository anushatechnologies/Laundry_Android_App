/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        plum: { DEFAULT: '#5B214F', dark: '#2B1326' },
        'dusty-rose': '#B76E79',
        gold: '#D6B36A',
        cream: '#FCF9F7',
        blush: '#F7F0F2',
        ink: '#241A21',
        muted: '#6F626A',
        border: '#E8DDE1',
        success: '#137A4A',
        warning: '#A95E0B',
        danger: '#C2384D',
        info: '#365EAA',
        brand: {
          50: '#FCF9F7',
          100: '#F7F0F2',
          200: '#E8DDE1',
          400: '#B76E79',
          500: '#5B214F',
          600: '#5B214F',
          800: '#2B1326',
          900: '#2B1326',
        },
        mist: '#6F626A',
      },
      borderRadius: {
        '4xl': '28px',
      },
    },
  },
  plugins: [],
};
