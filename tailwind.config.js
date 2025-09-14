/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // ATLAS HORIZON - Official Color Tokens ONLY
        'atlas-blue': '#042C5E',     // Horizon primary - ONLY allowed blue
        'atlas-navy-1': '#303A4C',   // Neutral dark text
        'atlas-navy-2': '#142C50',   // Dark backgrounds/sidebar
        'atlas-teal': '#1DA0BA',     // PULSE accent - chips, gestión tags
        'bg': '#F8F9FA',             // Light background
        'text-gray': '#6C757D',      // Secondary text
        
        // ATLAS Functional States - EXACT requirements
        'ok': '#28A745',             // Success green
        'warn': '#FFC107',           // Warning yellow  
        'error': '#DC3545',          // Error red
        
        // Legacy brand colors (backward compatibility)
        'brand-navy': '#042C5E',     // Maps to atlas-blue
        'brand-teal': '#1DA0BA',     // Maps to atlas-teal
        
        // Official Horizon Design System Tokens (EXACT per requirements)
        'hz-primary': '#042C5E',     // ATLAS blue #042C5E - ONLY allowed
        'hz-primary-dark': '#042C5E', // Same as primary per spec
        'hz-bg': '#F8F9FA',          // ATLAS background
        'hz-text': '#303A4C',        // ATLAS neutral dark
        'hz-success': '#28A745',     // ATLAS Success green
        'hz-warning': '#FFC107',     // ATLAS Warning yellow
        'hz-error': '#DC3545',       // ATLAS Error red
        'hz-info': '#042C5E',        // Info same as primary
        
        // Movement States - EXACT per specification
        'movement-previsto-ingreso': '#28A745',  // Green for expected income
        'movement-previsto-gasto': '#DC3545',    // Red for expected expense  
        'movement-confirmado': '#042C5E',        // Blue for confirmed
        'movement-vencido': '#FFC107',           // Amber for overdue
        'movement-no-previsto': '#6C757D',       // Gray for unplanned
        
        // Horizon Neutral Colors - ATLAS specification
        'hz-neutral-900': '#303A4C', // ATLAS neutral dark - darkest text
        'hz-neutral-700': '#6C757D', // ATLAS text gray - secondary text
        'hz-neutral-500': '#6C757D', // ATLAS text gray - muted text
        'hz-neutral-300': '#DEE2E6', // Light borders
        'hz-neutral-100': '#F8F9FA', // ATLAS bg - light backgrounds
        'hz-card-bg': '#FFFFFF',     // White cards
        
        // Legacy horizon colors (for backward compatibility)
        'horizon-navy': '#0F2C5C',   // Maps to hz-primary
        
        // Navy palette for Horizon theme - ATLAS specification
        navy: {
          50: '#f0f4f9',
          100: '#d9e2ef',
          200: '#b6c7df',
          300: '#8ca4ce',
          400: '#5d7cb7',
          500: '#3a5998',
          600: '#2a4073',
          700: '#042C5E', // Official ATLAS blue - Horizon primary
          800: '#031F47', // Darker for hover states
          900: '#021530', // Darkest for pressed states
        },
        
        // ===== ATLAS HORIZON COLOR SYSTEM =====
        // Primary colors - ATLAS Blue #042C5E only
        primary: {
          50: '#f0f4f9',   // Lightest tint for backgrounds
          100: '#d9e2ef',  // Light tint for hover states
          200: '#b6c7df',  // Medium light for borders
          300: '#8ca4ce',  // Medium for secondary elements
          400: '#5d7cb7',  // Medium strong for active states
          500: '#3a5998',  // Alternative primary shade
          600: '#2a4073',  // Strong for emphasis
          700: '#042C5E',  // ATLAS HORIZON PRIMARY - main color
          800: '#031F47',  // Darker for hover/focus
          900: '#021530',  // Darkest for pressed states
        },
        
        // Success colors - ATLAS Green #28A745
        success: {
          50: '#f0fdf4',   // Success background
          100: '#dcfce7',  // Light success background
          200: '#bbf7d0',  // Success border
          300: '#86efac',  // Success icon light
          400: '#4ade80',  // Success icon medium
          500: '#28A745',  // ATLAS SUCCESS GREEN - exact spec
          600: '#16a34a',  // Success button hover
          700: '#15803d',  // Success text dark
          800: '#166534',  // Success strong emphasis
          900: '#14532d',  // Success darkest
        },
        
        // Warning colors - ATLAS Yellow #FFC107
        warning: {
          50: '#fffbeb',   // Warning background
          100: '#fef3c7',  // Light warning background
          200: '#fde68a',  // Warning border
          300: '#fcd34d',  // Warning icon light
          400: '#fbbf24',  // Warning icon medium
          500: '#FFC107',  // ATLAS WARNING YELLOW - exact spec
          600: '#f59e0b',  // Warning button hover
          700: '#d97706',  // Warning text dark
          800: '#b45309',  // Warning strong emphasis
          900: '#92400e',  // Warning darkest
        },
        
        // Error colors - ATLAS Red #DC3545
        error: {
          50: '#fef2f2',   // Error background
          100: '#fee2e2',  // Light error background
          200: '#fecaca',  // Error border
          300: '#fca5a5',  // Error icon light
          400: '#f87171',  // Error icon medium
          500: '#DC3545',  // ATLAS ERROR RED - exact spec
          600: '#dc2626',  // Error button hover
          700: '#b91c1c',  // Error text dark
          800: '#991b1b',  // Error strong emphasis
          900: '#7f1d1d',  // Error darkest
        },
        
        // Info colors - ATLAS Blue for informational content
        info: {
          50: '#f0f4f9',   // Info background (same as primary)
          100: '#d9e2ef',  // Light info background 
          200: '#b6c7df',  // Info border
          300: '#8ca4ce',  // Info icon light
          400: '#5d7cb7',  // Info icon medium
          500: '#042C5E',  // ATLAS INFO BLUE - same as primary
          600: '#031F47',  // Info button hover
          700: '#021530',  // Info text dark
          800: '#011224',  // Info strong emphasis
          900: '#000915',  // Info darkest
        },
        
        // Semantic aliases for backward compatibility
        danger: '#DC3545',    // Alias for error.500 - ATLAS Red
        
        // Neutral colors - ATLAS Horizon specification
        neutral: {
          50: '#FFFFFF',     // White
          100: '#F8F9FA',    // ATLAS background - light neutral
          200: '#E2E8F0',
          300: '#DEE2E6',    // Light borders per spec
          400: '#94A3B8',
          500: '#6C757D',    // ATLAS text gray - secondary text
          600: '#475569',
          700: '#334155',
          800: '#303A4C',    // ATLAS neutral dark - primary text
          900: '#1E293B',    // Darkest
          950: '#0F172A',
        },
        gray: {
          50: '#FFFFFF',     // White per ATLAS
          100: '#F8F9FA',    // ATLAS background per spec
          200: '#E2E8F0',
          300: '#DEE2E6',    // Light borders per spec
          400: '#94A3B8',
          500: '#6C757D',    // ATLAS text gray per spec
          600: '#475569',
          700: '#334155',
          800: '#303A4C',    // ATLAS neutral dark per spec
          900: '#1E293B',    // Dark
          950: '#0F172A',
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