// Legacy compatibility layer for old contractService imports
export * from './contractServiceNew';

// Legacy function aliases for backward compatibility
export {
  getAllContracts,
  deleteContract,
  getContractStatus,
  rescindContract as terminateContract,
  validateContract,
  saveContract,
  updateContract
} from './contractServiceNew';

// Legacy functions that need to be implemented or stubbed
export const getRentCalendar = async (contractId: number) => {
  // Legacy function - return empty array with proper type structure
  return [] as Array<{
    id?: number;
    contractId: number;
    period: string;
    expectedAmount: number;
    isProrated: boolean;
    proratedDays?: number;
    totalDaysInMonth?: number;
    notes?: string;
    createdAt: string;
  }>;
};

export const getRentPayments = async (contractId: number) => {
  // Legacy function - return empty array with proper type structure
  return [] as Array<{
    id?: number;
    contractId: number;
    period: string;
    expectedAmount: number;
    status: 'pending' | 'paid' | 'partial';
    paidAmount?: number;
    paymentDate?: string;
    paymentNotes?: string;
    receiptDocuments: number[];
    createdAt: string;
    updatedAt: string;
  }>;
};

export const markPaymentAsPaid = async (id: number, paidAmount: number, paymentDate: string, notes?: string) => {
  // Legacy function - stub implementation
  console.warn('markPaymentAsPaid: Legacy function called, not implemented');
};

export const markPaymentAsPartial = async (id: number, paidAmount: number, paymentDate: string, notes?: string) => {
  // Legacy function - stub implementation
  console.warn('markPaymentAsPartial: Legacy function called, not implemented');
};