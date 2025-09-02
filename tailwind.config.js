/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Official ATLAS brand colors (immutable)
        'brand-navy': '#0F3D62',
        'brand-teal': '#2EB0CB',
        
        // Navy palette for Horizon theme
        navy: {
          50: '#f0f4f9',
          100: '#d9e2ef',
          200: '#b6c7df',
          300: '#8ca4ce',
          400: '#5d7cb7',
          500: '#3a5998',
          600: '#2a4073',
          700: '#0F3D62', // Official brand navy
          800: '#1a2438',
          900: '#0f131c',
        },
        
        // Teal palette for Pulse theme  
        teal: {
          50: '#f0fdfc',
          100: '#ccfbf7',
          200: '#99f6ee',
          300: '#5eebe3',
          400: '#2EB0CB', // Official brand teal
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        
        // Semantic colors (aligned with ATLAS design system)
        success: '#2EAF7D',
        warning: '#F0A202', 
        error: '#E35D5D',
        danger: '#E35D5D',
        info: '#2EB0CB', // Use brand teal for info
        
        // Neutral colors (consistent with CSS variables)
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        gray: {
          50: '#F8FAFC',   // bg-base
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
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