import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type AppModule = 'horizon' | 'pulse';

interface ThemeContextType {
  currentModule: AppModule;
  setCurrentModule: (module: AppModule) => void;
  primaryColor: string;
  accentColor: string;
  // ATLAS token access
  atlasTokens: AtlasTokens;
  // Locale formatting
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  formatNumber: (num: number) => string;
}

interface AtlasTokens {
  // ATLAS Color Tokens - Exact Specification
  colors: {
    atlasBlue: string;      // #042C5E - primary/CTA/links
    atlasTeal: string;      // #1DA0BA - accent gestión
    atlasNavy1: string;     // #303A4C - texto principal  
    atlasNavy2: string;     // #142C50 - sidebar/topbar
    ok: string;             // #28A745 - success
    warn: string;           // #FFC107 - warning
    error: string;          // #DC3545 - error
    bg: string;             // #F8F9FA - background
    textGray: string;       // #6C757D - secondary text
  };
  // Typography - Inter only
  fonts: {
    sans: string;           // Inter with fallbacks
  };
  // Spacing - 4px grid
  spacing: {
    xs: string;    // 4px
    sm: string;    // 8px
    md: string;    // 12px
    lg: string;    // 16px
    xl: string;    // 20px
    xxl: string;   // 24px
  };
}

const ATLAS_TOKENS: AtlasTokens = {
  colors: {
    atlasBlue: '#042C5E',
    atlasTeal: '#1DA0BA', 
    atlasNavy1: '#303A4C',
    atlasNavy2: '#142C50',
    ok: '#28A745',
    warn: '#FFC107',
    error: '#DC3545',
    bg: '#F8F9FA',
    textGray: '#6C757D',
  },
  fonts: {
    sans: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  spacing: {
    xs: '4px',
    sm: '8px', 
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentModule, setCurrentModule] = useState<AppModule>('horizon');
  
  // ES-ES Locale formatting functions as per ATLAS requirements
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }).format(date);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Theme configuration based on ATLAS requirements
  const getThemeColors = (module: AppModule) => {
    // Both modules use ATLAS blue as primary and teal as accent per ATLAS brand guidelines
    switch (module) {
      case 'horizon':
        return {
          primaryColor: ATLAS_TOKENS.colors.atlasBlue,
          accentColor: ATLAS_TOKENS.colors.atlasTeal,
        };
      case 'pulse':
        return {
          primaryColor: ATLAS_TOKENS.colors.atlasBlue,
          accentColor: ATLAS_TOKENS.colors.atlasTeal,
        };
      default:
        return {
          primaryColor: ATLAS_TOKENS.colors.atlasBlue,
          accentColor: ATLAS_TOKENS.colors.atlasTeal,
        };
    }
  };

  const { primaryColor, accentColor } = getThemeColors(currentModule);

  // Apply ATLAS theme globally when provider mounts
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply ATLAS CSS custom properties globally
    root.style.setProperty('--atlas-blue', ATLAS_TOKENS.colors.atlasBlue);
    root.style.setProperty('--atlas-teal', ATLAS_TOKENS.colors.atlasTeal);
    root.style.setProperty('--atlas-navy-1', ATLAS_TOKENS.colors.atlasNavy1);
    root.style.setProperty('--atlas-navy-2', ATLAS_TOKENS.colors.atlasNavy2);
    root.style.setProperty('--ok', ATLAS_TOKENS.colors.ok);
    root.style.setProperty('--warn', ATLAS_TOKENS.colors.warn);
    root.style.setProperty('--error', ATLAS_TOKENS.colors.error);
    root.style.setProperty('--bg', ATLAS_TOKENS.colors.bg);
    root.style.setProperty('--text-gray', ATLAS_TOKENS.colors.textGray);
    
    // Apply Inter font family globally
    root.style.setProperty('--font-sans', ATLAS_TOKENS.fonts.sans);
    root.style.fontFamily = ATLAS_TOKENS.fonts.sans;
    
    // Enable tabular numbers globally for financial data
    root.style.fontVariantNumeric = 'tabular-nums';
    
    // Add ATLAS class to body for scoped styles
    document.body.classList.add('atlas-theme');
    document.body.classList.add(`atlas-${currentModule}`);
    
    return () => {
      document.body.classList.remove('atlas-theme', `atlas-${currentModule}`);
    };
  }, [currentModule]);

  const value: ThemeContextType = {
    currentModule,
    setCurrentModule,
    primaryColor,
    accentColor,
    atlasTokens: ATLAS_TOKENS,
    formatCurrency,
    formatDate,
    formatNumber,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};