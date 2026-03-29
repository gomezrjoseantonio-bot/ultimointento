import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type AppModule = 'horizon' | 'pulse';

interface ThemeContextType {
  currentModule: AppModule;
  setCurrentModule: (module: AppModule) => void;
  primaryColor: string;
  accentColor: string;
  atlasTokens: AtlasTokens;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  formatNumber: (num: number) => string;
}

interface AtlasTokens {
  colors: {
    atlasBlue: string;
    atlasTeal: string;
    atlasNavy1: string;
    atlasNavy2: string;
    ok: string;
    warn: string;
    error: string;
    bg: string;
    textGray: string;
  };
  fonts: {
    sans: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
}

const ATLAS_TOKENS: AtlasTokens = {
  colors: {
    atlasBlue: 'var(--navy-900)',
    atlasTeal: 'var(--teal-600)',
    atlasNavy1: 'var(--grey-700)',
    atlasNavy2: 'var(--grey-900)',
    ok: 'var(--navy-900)',
    warn: 'var(--grey-500)',
    error: 'var(--grey-700)',
    bg: 'var(--grey-50)',
    textGray: 'var(--grey-500)',
  },
  fonts: {
    sans: 'var(--font-base)',
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

  const primaryColor = ATLAS_TOKENS.colors.atlasBlue;
  const accentColor = ATLAS_TOKENS.colors.atlasTeal;

  useEffect(() => {
    document.body.classList.add('atlas-theme');
    return () => {
      document.body.classList.remove('atlas-theme');
    };
  }, []);

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
