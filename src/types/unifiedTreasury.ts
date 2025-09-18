// ATLAS Horizon - Unified Treasury Types
// Implementation of the final unified Treasury view per requirements

import { Account, Movement } from '../services/db';

// Unified Treasury Movement Status with color coding
export type UnifiedMovementStatus = 
  | 'previsto'      // Green chip - forecast income/expense
  | 'confirmado'    // Blue chip - confirmed transaction  
  | 'vencido'       // Amber chip - overdue without reconciliation
  | 'no_planificado'; // Gray chip - unplanned transaction

// Enhanced Account for unified view
export interface UnifiedAccount extends Omit<Account, 'isActive' | 'deleted_at' | 'status'> {
  // Account status for filtering - translated from AccountStatus enum
  // Maps: ACTIVE -> 'activa', INACTIVE -> 'desactivada', DELETED -> 'eliminada' 
  status: 'activa' | 'desactivada' | 'eliminada';
  
  // Current balance and next event
  currentBalance: number;
  nextEvent?: {
    date: string;
    concept: string;
    amount: number;
    type: 'income' | 'expense';
  };
  
  // Risk semaphore for the month (green/amber/red)
  riskLevel: 'verde' | 'ambar' | 'rojo';
  
  // Projected balance and minimum balance for the month
  projectedBalance: number;
  monthlyMinBalance: number;
}

// Enhanced Movement for unified timeline
export interface UnifiedMovement extends Movement {
  // Unified status for chip display
  unifiedStatus: UnifiedMovementStatus;
  
  // Enhanced fields for timeline display
  sign: '+' | '-';
  destinationAccount?: string; // For transfers
  originAccount?: string;      // For transfers
  
  // Timing information
  forecastDate?: string;  // When it was forecast to happen
  confirmedDate?: string; // When it actually happened
  
  // Classification and provider info
  provider?: string;
  contractReference?: string;
  propertyId?: number;
  
  // Quick action flags
  canConfirm: boolean;    // Can mark as confirmed
  canEdit: boolean;       // Can edit details
  canDelete: boolean;     // Can delete/cancel
  canReclassify: boolean; // Can reclassify category
}

// Transfer pair for linked movements
export interface Transfer {
  id: string;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  date: string;
  note?: string;
  status: 'previsto' | 'confirmado';
  movements: [UnifiedMovement, UnifiedMovement]; // Always exactly 2 movements
}

// Matching rules for reconciliation
export interface MatchingRules {
  dateWindow: number;        // ±N days (default 3)
  amountTolerancePercent: number; // ±N% (default 10)
  amountToleranceFixed: number;   // ±N€ (user configurable)
  
  // Soft matching keys
  useIbanMatching: boolean;
  useProviderMatching: boolean;
  useContractMatching: boolean;
  usePropertyMatching: boolean;
}

// Timeline day entry for account expansion
export interface TimelineDay {
  date: string; // YYYY-MM-DD
  movements: UnifiedMovement[];
  dailyBalance: number;
  isToday: boolean;
  isWeekend: boolean;
}

// Account expansion data when clicked
export interface AccountTimeline {
  account: UnifiedAccount;
  days: TimelineDay[];
  monthProjection: {
    projectedBalance: number;
    minBalance: number;
    needsTransfer: boolean;
    transferRecommendation?: {
      amount: number;
      fromAccount: string;
      beforeDate: string;
    };
  };
}

// Filter state for the unified view
export interface TreasuryFilters {
  monthYear: string;     // YYYY-MM format
  excludePersonal: boolean;
  status: 'todos' | 'previsto' | 'confirmado' | 'vencido' | 'no_planificado';
  search: string;        // Search in account/provider/concept
}

// Import result for statement processing
export interface ImportResult {
  totalLines: number;
  confirmedMovements: number;
  unplannedMovements: number;
  detectedTransfers: number;
  errors: string[];
}

// Quick action types for movement chips
export type QuickAction = 
  | 'confirm'     // Mark forecast as confirmed
  | 'edit'        // Edit movement details
  | 'delete'      // Delete/cancel movement
  | 'reclassify'; // Reclassify category/provider

// Account action types for three-dot menu
export type AccountAction = 
  | 'view_details'      // View account details
  | 'create_transfer'   // Create transfer from this account
  | 'import_statement'; // Import statement for this account