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
        'brand-navy': '#0E2A47',  // Azul marino Horizon - color base principal
        'brand-teal': '#00B8C4',  // Turquesa Pulse - reservado solo para Pulse
        
        // Horizon colors (primary navy)
        'horizon-navy': '#0E2A47',
        
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
        
        // Semantic colors (Atlas Horizon Style Guide)
        success: '#16A34A',   // Verde OK, validado, conciliado
        warning: '#EAB308',   // Amarillo warning, pendiente
        error: '#DC2626',     // Rojo error, descuadre
        danger: '#DC2626',    // Alias para error
        info: '#00B8C4',      // Usar teal para info (solo Pulse)
        
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