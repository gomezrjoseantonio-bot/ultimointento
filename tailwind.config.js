/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Official ATLAS brand colors - Atlas Horizon Style Guide
        'brand-navy': '#0E2A47',  // Legacy ATLAS navy (backward compatibility)
        'brand-teal': '#00B8C4',  // Turquesa Pulse - RESERVED FOR PULSE ONLY
        
        // Official Horizon Design System Tokens (Updated per requirements)
        'hz-primary': '#0A84FF',     // Primary Horizon blue #0A84FF
        'hz-primary-dark': '#0A3D62', // Primary dark (text/borders) #0A3D62  
        'hz-bg': '#F7F9FC',          // Official Horizon soft background
        'hz-text': '#111827',        // Text color #111827
        'hz-success': '#10B981',     // Success green #10B981
        'hz-warning': '#F59E0B',     // Warning yellow #F59E0B
        'hz-error': '#EF4444',       // Error red #EF4444
        'hz-info': '#0A84FF',        // Info blue same as primary
        
        // Horizon Neutral Colors per requirements
        'hz-neutral-900': '#111827', // Darkest text
        'hz-neutral-700': '#374151', // Secondary text
        'hz-neutral-500': '#6B7280', // Muted text
        'hz-neutral-300': '#D1D5DB', // Light borders
        'hz-neutral-100': '#F3F4F6', // Light backgrounds
        'hz-card-bg': '#FFFFFF',     // Card backgrounds
        
        // Legacy horizon colors (for backward compatibility)
        'horizon-navy': '#0F2C5C',   // Maps to hz-primary
        
        // Navy palette for Horizon theme
        navy: {
          50: '#f0f4f9',
          100: '#d9e2ef',
          200: '#b6c7df',
          300: '#8ca4ce',
          400: '#5d7cb7',
          500: '#3a5998',
          600: '#2a4073',
          700: '#0E2A47', // Official Horizon navy
          800: '#0a1f35',
          900: '#071829',
        },
        
        // Teal palette for Pulse theme (NO usar en Horizon)
        teal: {
          50: '#f0fdfc',
          100: '#ccfbf7',
          200: '#99f6ee',
          300: '#5eebe3',
          400: '#00B8C4', // Official Pulse teal - NO usar en Horizon
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        
        // ===== STANDARDIZED COLOR SYSTEM =====
        // Primary colors (replace scattered blue usage)
        primary: {
          50: '#f0f4f9',   // Lightest - backgrounds, subtle highlights
          100: '#d9e2ef',  // Light - hover states, secondary backgrounds  
          200: '#b6c7df',  // Medium light - borders, disabled states
          300: '#8ca4ce',  // Medium - icons, secondary text
          400: '#5d7cb7',  // Medium strong - active states
          500: '#3a5998',  // Default primary - buttons, links
          600: '#2a4073',  // Strong - hover states, emphasis
          700: '#0E2A47',  // Strongest - high contrast text, borders
          800: '#0a1f35',  // Very strong - headers, important text
          900: '#071829',  // Darkest - maximum contrast
        },
        
        // Success colors (standardize green usage)
        success: {
          50: '#f0fdf4',   // Success background
          100: '#dcfce7',  // Light success background
          200: '#bbf7d0',  // Success border
          300: '#86efac',  // Success icon light
          400: '#4ade80',  // Success icon medium
          500: '#16A34A',  // Primary success - official Atlas success
          600: '#15803d',  // Success button hover
          700: '#166534',  // Success text dark
          800: '#14532d',  // Success strong emphasis
          900: '#052e16',  // Success darkest
        },
        
        // Warning colors (standardize yellow/orange usage)
        warning: {
          50: '#fffbeb',   // Warning background
          100: '#fef3c7',  // Light warning background
          200: '#fde68a',  // Warning border
          300: '#fcd34d',  // Warning icon light
          400: '#fbbf24',  // Warning icon medium
          500: '#EAB308',  // Primary warning - official Atlas warning
          600: '#d97706',  // Warning button hover
          700: '#b45309',  // Warning text dark
          800: '#92400e',  // Warning strong emphasis
          900: '#451a03',  // Warning darkest
        },
        
        // Error/Danger colors (standardize red usage)
        error: {
          50: '#fef2f2',   // Error background
          100: '#fee2e2',  // Light error background
          200: '#fecaca',  // Error border
          300: '#fca5a5',  // Error icon light
          400: '#f87171',  // Error icon medium
          500: '#DC2626',  // Primary error - official Atlas error
          600: '#dc2626',  // Error button hover
          700: '#b91c1c',  // Error text dark
          800: '#991b1b',  // Error strong emphasis
          900: '#450a0a',  // Error darkest
        },
        
        // Info colors (for informational content)
        info: {
          50: '#f0f9ff',   // Info background
          100: '#e0f2fe',  // Light info background
          200: '#bae6fd',  // Info border
          300: '#7dd3fc',  // Info icon light
          400: '#38bdf8',  // Info icon medium
          500: '#0ea5e9',  // Primary info
          600: '#0284c7',  // Info button hover
          700: '#0369a1',  // Info text dark
          800: '#075985',  // Info strong emphasis
          900: '#0c4a6e',  // Info darkest
        },
        
        // Semantic color aliases (for backward compatibility)
        danger: '#DC2626',    // Alias for error.500
        
        // Neutral colors (Atlas Horizon Style Guide)
        neutral: {
          50: '#FFFFFF',     // Blanco
          100: '#F3F4F6',    // Gris claro - fondos neutros secundarios
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#6B7280',    // Gris medio - textos secundarios, labels
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#111827',    // Negro - texto alto contraste
          950: '#020617',
        },
        gray: {
          50: '#FFFFFF',     // Blanco según guía
          100: '#F3F4F6',    // Gris claro según guía
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#6B7280',    // Gris medio según guía
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#111827',    // Negro según guía
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'atlas': '12px', // Official ATLAS radius
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}