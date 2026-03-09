/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#d9e1ef',
          200: '#b3c2df',
          300: '#8da3cf',
          400: '#6684bf',
          500: '#4065af',
          600: '#34518c',
          700: '#283d69',
          800: '#1c2846',
          900: '#0e1423',
        },
        teal: {
          50: '#f0fcfc',
          100: '#d0f5f5',
          200: '#a0eaea',
          300: '#70dfdf',
          400: '#40d4d4',
          500: '#26abab',
          600: '#1c8686',
          700: '#136060',
          800: '#093b3b',
          900: '#041515',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}