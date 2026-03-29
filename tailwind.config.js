/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // ATLAS v4 — Solo 3 familias: Navy, Teal, Gris
        'atlas-blue': '#042C5E',
        'atlas-blue-dark': '#0A3A72',
        'atlas-navy-1': '#303A4C',
        'atlas-navy-2': '#142C50',
        'atlas-teal': '#1DA0BA',
        'atlas-teal-dark': '#178999',
        'bg': '#F8F9FA',
        'text-gray': '#6C757D',

        // v4: Functional states mapped to navy/teal/gris (NO semaphore)
        'ok': '#042C5E',
        'ok-dark': '#0A3A72',
        'ok-50': '#F0F4FA',
        'ok-200': '#E8EFF7',
        'ok-700': '#042C5E',
        'warn': '#6C757D',
        'warn-bg': 'rgba(108, 117, 125, 0.1)',
        'error': '#303A4C',
        'error-50': '#EEF1F5',
        'error-200': '#DDE3EC',
        'error-500': '#303A4C',
        'error-600': '#303A4C',
        'error-700': '#303A4C',

        // ATLAS Utility Tokens
        'primary-50': '#F0F4FA',
        'primary-100': '#E8EFF7',
        'primary-200': '#C8D0DC',

        // Legacy brand colors (backward compatibility)
        'brand-navy': '#042C5E',
        'brand-teal': '#1DA0BA',

        // v4: Horizon tokens → navy
        'hz-primary': '#042C5E',
        'hz-primary-dark': '#0A3A72',
        'hz-bg': '#F8F9FA',
        'hz-text': '#303A4C',
        'hz-success': '#042C5E',
        'hz-warning': '#6C757D',
        'hz-error': '#303A4C',
        'hz-info': '#042C5E',

        // v4: Movement States — navy/gris only
        'movement-previsto-ingreso': '#042C5E',
        'movement-previsto-gasto': '#303A4C',
        'movement-confirmado': '#042C5E',
        'movement-vencido': '#6C757D',
        'movement-no-previsto': '#6C757D',

        // v4: Horizon Neutral Colors
        'hz-neutral-900': '#303A4C',
        'hz-neutral-700': '#6C757D',
        'hz-neutral-500': '#6C757D',
        'hz-neutral-300': '#DDE3EC',
        'hz-neutral-100': '#F8F9FA',
        'hz-card-bg': '#FFFFFF',

        // Legacy horizon colors (backward compat)
        'horizon-navy': '#042C5E',

        // Navy palette — v4
        navy: {
          50: '#F0F4FA',
          100: '#E8EFF7',
          200: '#C8D0DC',
          300: '#8ca4ce',
          400: '#5d7cb7',
          500: '#3a5998',
          600: '#1E3A5F',
          700: '#142C50',
          800: '#0A3A72',
          900: '#042C5E',
        },

        // Primary = navy
        primary: {
          50: '#F0F4FA',
          100: '#E8EFF7',
          200: '#C8D0DC',
          300: '#8ca4ce',
          400: '#5d7cb7',
          500: '#3a5998',
          600: '#1E3A5F',
          700: '#042C5E',
          800: '#0A3A72',
          900: '#042C5E',
        },

        // v4: Success → navy (no green)
        success: {
          50: '#F0F4FA',
          100: '#E8EFF7',
          200: '#C8D0DC',
          500: '#042C5E',
          600: '#0A3A72',
          700: '#042C5E',
        },

        // v4: Warning → grey (no yellow)
        warning: {
          50: '#EEF1F5',
          100: '#EEF1F5',
          200: '#DDE3EC',
          500: '#6C757D',
          600: '#6C757D',
          700: '#303A4C',
        },

        // v4: Error → grey-dark (no red)
        error: {
          50: '#EEF1F5',
          100: '#EEF1F5',
          200: '#DDE3EC',
          500: '#303A4C',
          600: '#303A4C',
          700: '#303A4C',
        },

        // Info → navy
        info: {
          50: '#F0F4FA',
          100: '#E8EFF7',
          500: '#042C5E',
          600: '#0A3A72',
          700: '#042C5E',
        },

        // Semantic aliases
        danger: '#303A4C',

        // Neutral colors
        neutral: {
          50: '#FFFFFF',
          100: '#F8F9FA',
          200: '#DDE3EC',
          300: '#C8D0DC',
          400: '#9CA3AF',
          500: '#6C757D',
          600: '#475569',
          700: '#303A4C',
          800: '#1A2332',
          900: '#1A2332',
          950: '#0F172A',
        },
        gray: {
          50: '#FFFFFF',
          100: '#F8F9FA',
          200: '#DDE3EC',
          300: '#C8D0DC',
          400: '#9CA3AF',
          500: '#6C757D',
          600: '#475569',
          700: '#303A4C',
          800: '#1A2332',
          900: '#1A2332',
          950: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'atlas': '12px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
