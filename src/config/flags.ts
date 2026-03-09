export const FLAGS = {
  DEMO_MODE: false as const,
  PREVIEW_SIMULATION: false as const,
  
  // Treasury v1.2 Feature Flags
  ENHANCED_BANK_IMPORT: true as const,
  MULTI_BANK_PARSER: true as const,
  CALENDAR_IMPROVEMENTS: true as const,
  CASCADE_ACCOUNT_DELETION: true as const,
  MOVEMENT_PREVIEW_MODAL: true as const,
  
  // Import pipeline features
  AUTO_COLUMN_MAPPING: true as const,
  DEDUPLICATION_SERVICE: true as const,
  SPANISH_FORMAT_PARSING: true as const,
  
  // Rollback flags (for quick disable if needed)
  LEGACY_IMPORT_FALLBACK: false as const,
  OLD_CALENDAR_VIEW: false as const,
};