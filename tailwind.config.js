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
        'atlas-teal': '#1DA0BA', // teal · frente gráficos (pendiente · no repuntado)
        'bg': 'var(--atlas-v5-bg)',
        'text-gray': 'var(--atlas-v5-ink-3)',

        // v4: Functional states → navy/gris (NO semaphore) · repuntado a v5 (Fase B · semánticos)
        'ok': 'var(--atlas-v5-brand)',
        'ok-dark': 'var(--atlas-v5-brand)',
        'ok-50': 'var(--atlas-v5-brand-wash)',
        'ok-200': 'var(--atlas-v5-brand-wash)',
        'ok-700': 'var(--atlas-v5-brand)',
        'warn': 'var(--atlas-v5-ink-3)',
        'warn-bg': 'rgba(108, 117, 125, 0.1)',
        'error': 'var(--atlas-v5-ink-2)',
        'error-50': 'var(--atlas-v5-line-2)',
        'error-200': 'var(--atlas-v5-line)',
        'error-500': 'var(--atlas-v5-ink-2)',
        'error-600': 'var(--atlas-v5-ink-2)',
        'error-700': 'var(--atlas-v5-ink-2)',

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
        'hz-success': 'var(--atlas-v5-brand)',
        'hz-warning': 'var(--atlas-v5-ink-3)',
        'hz-error': 'var(--atlas-v5-ink-2)',
        'hz-info': 'var(--atlas-v5-brand)',

        // v4: Movement States — navy/gris only · repuntado a v5 (Fase B · semánticos)
        'movement-previsto-ingreso': 'var(--atlas-v5-brand)',
        'movement-previsto-gasto': 'var(--atlas-v5-ink-2)',
        'movement-confirmado': 'var(--atlas-v5-brand)',
        'movement-vencido': 'var(--atlas-v5-ink-3)',
        'movement-no-previsto': 'var(--atlas-v5-ink-3)',

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

        // v4: Success → navy (no green) · repuntado a v5 (Fase B · semánticos)
        success: {
          50: 'var(--atlas-v5-brand-wash)',
          100: 'var(--atlas-v5-brand-wash)',
          200: 'var(--atlas-v5-ink-5)',
          500: 'var(--atlas-v5-brand)',
          600: 'var(--atlas-v5-brand)',
          700: 'var(--atlas-v5-brand)',
        },

        // v4: Warning → grey (no yellow) · repuntado a v5 (Fase B · semánticos)
        warning: {
          50: 'var(--atlas-v5-line-2)',
          100: 'var(--atlas-v5-line-2)',
          200: 'var(--atlas-v5-line)',
          500: 'var(--atlas-v5-ink-3)',
          600: 'var(--atlas-v5-ink-3)',
          700: 'var(--atlas-v5-ink-2)',
        },

        // v4: Error → grey-dark (no red) · repuntado a v5 (Fase B · semánticos)
        error: {
          50: 'var(--atlas-v5-line-2)',
          100: 'var(--atlas-v5-line-2)',
          200: 'var(--atlas-v5-line)',
          500: 'var(--atlas-v5-ink-2)',
          600: 'var(--atlas-v5-ink-2)',
          700: 'var(--atlas-v5-ink-2)',
        },

        // Info → navy · repuntado a v5 (Fase B · semánticos)
        info: {
          50: 'var(--atlas-v5-brand-wash)',
          100: 'var(--atlas-v5-brand-wash)',
          500: 'var(--atlas-v5-brand)',
          600: 'var(--atlas-v5-brand)',
          700: 'var(--atlas-v5-brand)',
        },

        // Semantic aliases
        danger: 'var(--atlas-v5-ink-2)',

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
