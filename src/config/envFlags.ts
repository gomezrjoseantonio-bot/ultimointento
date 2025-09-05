// Environment Flags Configuration for Inbox Auto-Processing
// Implements the required flags: INBOX_AUTO_ROUTE, INBOX_AUTO_OCR, BANK_IMPORT_ENABLE

export interface EnvFlags {
  // Auto-processing flags
  INBOX_AUTO_ROUTE: boolean;
  INBOX_AUTO_OCR: boolean;  
  BANK_IMPORT_ENABLE: boolean;
  
  // Development and testing
  ENABLE_TELEMETRY: boolean;
  QA_DASHBOARD: boolean;
  
  // OCR Configuration
  OCR_CONFIDENCE_THRESHOLD: number;
}

// Parse environment variables with proper defaults
const parseEnvFlag = (envVar: string | undefined, defaultValue: boolean = false): boolean => {
  if (!envVar) return defaultValue;
  return envVar === '1' || envVar.toLowerCase() === 'true';
};

const parseEnvNumber = (envVar: string | undefined, defaultValue: number): number => {
  if (!envVar) return defaultValue;
  const parsed = parseFloat(envVar);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Get all environment flags
export const getEnvFlags = (): EnvFlags => {
  return {
    // Main feature flags - default to enabled for production readiness
    INBOX_AUTO_ROUTE: parseEnvFlag(process.env.REACT_APP_INBOX_AUTO_ROUTE, true),
    INBOX_AUTO_OCR: parseEnvFlag(process.env.REACT_APP_INBOX_AUTO_OCR, true),
    BANK_IMPORT_ENABLE: parseEnvFlag(process.env.REACT_APP_BANK_IMPORT_ENABLE, true),
    
    // Development flags
    ENABLE_TELEMETRY: parseEnvFlag(process.env.REACT_APP_ENABLE_TELEMETRY, true),
    QA_DASHBOARD: parseEnvFlag(process.env.REACT_APP_QA_DASHBOARD, process.env.NODE_ENV === 'development'),
    
    // Configuration
    OCR_CONFIDENCE_THRESHOLD: parseEnvNumber(process.env.REACT_APP_OCR_CONFIDENCE_THRESHOLD, 0.80)
  };
};

// Convenience functions for individual flags
export const isAutoRouteEnabled = (): boolean => getEnvFlags().INBOX_AUTO_ROUTE;
export const isAutoOCREnabled = (): boolean => getEnvFlags().INBOX_AUTO_OCR;
export const isBankImportEnabled = (): boolean => getEnvFlags().BANK_IMPORT_ENABLE;
export const isTelemetryEnabled = (): boolean => getEnvFlags().ENABLE_TELEMETRY;
export const isQADashboardEnabled = (): boolean => getEnvFlags().QA_DASHBOARD;
export const getOCRConfidenceThreshold = (): number => getEnvFlags().OCR_CONFIDENCE_THRESHOLD;

// Log environment flags on startup (dev only)
if (process.env.NODE_ENV === 'development') {
  const flags = getEnvFlags();
  console.log('📋 Environment Flags Configuration:', {
    'Auto Route': flags.INBOX_AUTO_ROUTE ? '✅' : '❌',
    'Auto OCR': flags.INBOX_AUTO_OCR ? '✅' : '❌', 
    'Bank Import': flags.BANK_IMPORT_ENABLE ? '✅' : '❌',
    'Telemetry': flags.ENABLE_TELEMETRY ? '✅' : '❌',
    'OCR Threshold': `${(flags.OCR_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%`
  });
}