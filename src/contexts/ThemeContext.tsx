import React, { createContext, useContext, useState, ReactNode } from 'react';

export type AppModule = 'horizon' | 'pulse';

interface ThemeContextType {
  currentModule: AppModule;
  setCurrentModule: (module: AppModule) => void;
  primaryColor: string;
  accentColor: string;
}

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
  
  // Theme configuration based on ATLAS requirements
  const getThemeColors = (module: AppModule) => {
    switch (module) {
      case 'horizon':
        return {
          primaryColor: 'navy', // Navy primary for Horizon (Invest)
          accentColor: 'teal',  // Teal accent for Horizon
        };
      case 'pulse':
        return {
          primaryColor: 'teal', // Teal primary for Pulse (Personal)
          accentColor: 'navy',  // Navy accent for Pulse
        };
      default:
        return {
          primaryColor: 'navy',
          accentColor: 'teal',
        };
    }
  };

  const { primaryColor, accentColor } = getThemeColors(currentModule);

  const value: ThemeContextType = {
    currentModule,
    setCurrentModule,
    primaryColor,
    accentColor,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};