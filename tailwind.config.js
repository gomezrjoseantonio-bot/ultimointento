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
        'atlas-blue': 'var(--atlas-v5-brand)',
        'atlas-blue-dark': 'var(--atlas-v5-brand)',
        'atlas-navy-1': 'var(--atlas-v5-ink-2)',
        'atlas-navy-2': 'var(--atlas-v5-brand)',
        'atlas-teal': '#1DA0BA',
        'atlas-teal-dark': '#178999',
        'bg': 'var(--atlas-v5-bg)',
        'text-gray': 'var(--atlas-v5-ink-3)',

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
        'primary-50': 'var(--atlas-v5-brand-wash)',
        'primary-100': 'var(--atlas-v5-brand-wash)',
        'primary-200': 'var(--atlas-v5-ink-5)',

        // Legacy brand colors (backward compatibility)
        'brand-navy': 'var(--atlas-v5-brand)',
        'brand-teal': '#1DA0BA',

        // v4: Horizon tokens → navy
        'hz-primary': 'var(--atlas-v5-brand)',
        'hz-primary-dark': 'var(--atlas-v5-brand)',
        'hz-bg': 'var(--atlas-v5-bg)',
        'hz-text': 'var(--atlas-v5-ink-2)',
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

        // v4: Horizon Neutral Colors → repuntado a v5 (Fase B · grises)
        'hz-neutral-900': 'var(--atlas-v5-ink-2)',
        'hz-neutral-700': 'var(--atlas-v5-ink-3)',
        'hz-neutral-500': 'var(--atlas-v5-ink-3)',
        'hz-neutral-300': 'var(--atlas-v5-line)',
        'hz-neutral-100': 'var(--atlas-v5-bg)',
        'hz-card-bg': 'var(--atlas-v5-card)',

        // Legacy horizon colors (backward compat)
        'horizon-navy': 'var(--atlas-v5-brand)',

        // Navy palette — repuntado a v5 (Fase B · azules + grises)
        navy: {
          50: 'var(--atlas-v5-brand-wash)',
          100: 'var(--atlas-v5-brand-wash)',
          200: 'var(--atlas-v5-ink-5)',
          500: 'var(--atlas-v5-brand-2)',
          600: 'var(--atlas-v5-brand)',
          700: 'var(--atlas-v5-brand)',
          800: 'var(--atlas-v5-brand)',
          900: 'var(--atlas-v5-brand)',
        },

        // Primary = navy (Fase B · azules + grises)
        primary: {
          50: 'var(--atlas-v5-brand-wash)',
          100: 'var(--atlas-v5-brand-wash)',
          200: 'var(--atlas-v5-ink-5)',
          500: 'var(--atlas-v5-brand-2)',
          600: 'var(--atlas-v5-brand)',
          700: 'var(--atlas-v5-brand)',
          800: 'var(--atlas-v5-brand)',
          900: 'var(--atlas-v5-brand)',
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

        // Neutral colors — repuntado a v5 (Fase B · grises)
        neutral: {
          50: 'var(--atlas-v5-card)',
          100: 'var(--atlas-v5-bg)',
          200: 'var(--atlas-v5-line)',
          300: 'var(--atlas-v5-ink-5)',
          400: 'var(--atlas-v5-ink-4)',
          500: 'var(--atlas-v5-ink-3)',
          600: 'var(--atlas-v5-ink-3)',
          700: 'var(--atlas-v5-ink-2)',
          800: 'var(--atlas-v5-ink)',
          900: 'var(--atlas-v5-ink)',
        },
        gray: {
          50: 'var(--atlas-v5-card)',
          100: 'var(--atlas-v5-bg)',
          200: 'var(--atlas-v5-line)',
          300: 'var(--atlas-v5-ink-5)',
          400: 'var(--atlas-v5-ink-4)',
          500: 'var(--atlas-v5-ink-3)',
          600: 'var(--atlas-v5-ink-3)',
          700: 'var(--atlas-v5-ink-2)',
          800: 'var(--atlas-v5-ink)',
          900: 'var(--atlas-v5-ink)',
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
