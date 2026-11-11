/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // PeerPays teal accent (brand)
        brand: {
          50: '#f0faf8',
          100: '#d6f2ee',
          200: '#b0e6df',
          300: '#7fd4ca',
          400: '#4ec0b4',
          500: '#37b0a2',
          600: '#2a8d82',
          700: '#257168',
          800: '#225a54',
          900: '#1f4a46',
        },
        // PeerPays deep navy base
        navy: {
          50: '#eef4fa',
          100: '#d5e3f1',
          200: '#adc7e0',
          300: '#7ba4cc',
          400: '#4a7db2',
          500: '#2f5e94',
          600: '#234a76',
          700: '#173a5e',
          800: '#0f2f4f',
          900: '#0b2c4b',
        },
        accent: {
          400: '#fde047',
          500: '#facc15',
        },
      },
      backgroundImage: {
        'peerpays-gradient': 'linear-gradient(135deg, #0b2c4b, #37b0a2)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
