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
    atlasBlue: string;      // Primary brand token
    atlasTeal: string;      // Accent token for gestión
    atlasNavy1: string;     // Texto principal
    atlasNavy2: string;     // Barra lateral / topbar
    ok: string;             // Estado success
    warn: string;           // Estado warning
    error: string;          // Estado error
    bg: string;             // Fondo base
    textGray: string;       // Texto secundario
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
    atlasBlue: 'var(--atlas-blue)',
    atlasTeal: 'var(--atlas-teal)',
    atlasNavy1: 'var(--atlas-navy-1)',
    atlasNavy2: 'var(--atlas-navy-2)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    error: 'var(--error)',
    bg: 'var(--bg)',
    textGray: 'var(--text-gray)',
  },
  fonts: {
    sans: 'var(--font-inter, "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif)',
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
  const getThemeColors = (_module: AppModule) => {
    // Both modules comparten los mismos tokens de color base
    const primaryColor = ATLAS_TOKENS.colors.atlasBlue;
    const accentColor = ATLAS_TOKENS.colors.atlasTeal;

    return { primaryColor, accentColor };
  };

  const { primaryColor, accentColor } = getThemeColors(currentModule);

  // Apply ATLAS theme globally when provider mounts
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply Inter font family globally
    root.style.setProperty('--font-inter', '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif');
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