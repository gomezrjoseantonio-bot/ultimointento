import { initDB, Contract, RentCalendar, RentPayment } from './db';
import { generateIncomeFromContract } from './treasuryCreationService';

// Contract management service for H7 functionality

export const saveContract = async (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
  const db = await initDB();
  const now = new Date().toISOString();
  
  const newContract: Omit<Contract, 'id'> = {
    ...contract,
    createdAt: now,
    updatedAt: now,
  };
  
  const contractId = await db.add('contracts', newContract);
  
  // Generate rent calendar and payments
  await generateRentCalendar(contractId as number, contract);
  await generateRentPayments(contractId as number, contract);
  
  // H10: Generate Treasury income records for active contracts
  if (contract.status === 'active') {
    try {
      const fullContract = { ...newContract, id: contractId as number };
      await generateIncomeFromContract(fullContract);
    } catch (error) {
      console.error('Error generating income from contract:', error);
      // Don't fail the contract creation if Treasury generation fails
    }
  }
  
  return contractId as number;
};

export const updateContract = async (id: number, updates: Partial<Contract>): Promise<void> => {
  const db = await initDB();
  const existing = await db.get('contracts', id);
  
  if (!existing) {
    throw new Error('Contract not found');
  }
  
  const updatedContract: Contract = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await db.put('contracts', updatedContract);
  
  // If dates or rent changed, regenerate calendar and payments
  if (updates.startDate || updates.endDate || updates.monthlyRent || updates.isIndefinite) {
    await regenerateRentCalendar(id, updatedContract);
    await regenerateRentPayments(id, updatedContract);
  }
  
  // H10: Regenerate Treasury income records for status changes
  if (updates.status === 'active' || updates.monthlyRent || updates.startDate || updates.endDate) {
    try {
      // Remove existing income records for this contract
      const db = await initDB();
      const existingIngresos = await db.getAll('ingresos');
      const contractIngresos = existingIngresos.filter(i => 
        i.origen === 'contrato_id' && i.origen_id === id
      );
      
      for (const ingreso of contractIngresos) {
        if (ingreso.id) {
          await db.delete('ingresos', ingreso.id);
        }
      }
      
      // Generate new income records if contract is active
      if (updatedContract.status === 'active') {
        await generateIncomeFromContract(updatedContract);
      }
    } catch (error) {
      console.error('Error regenerating income from contract:', error);
    }
  }
};

export const getContract = async (id: number): Promise<Contract | undefined> => {
  const db = await initDB();
  return await db.get('contracts', id);
};

export const getContractsByProperty = async (propertyId: number): Promise<Contract[]> => {
  const db = await initDB();
  return await db.getAllFromIndex('contracts', 'propertyId', propertyId);
};

export const getAllContracts = async (): Promise<Contract[]> => {
  const db = await initDB();
  return await db.getAll('contracts');
};

export const deleteContract = async (id: number): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['contracts', 'rentCalendar', 'rentPayments'], 'readwrite');
  
  // Delete contract
  await tx.objectStore('contracts').delete(id);
  
  // Delete related rent calendar entries
  const calendarEntries = await tx.objectStore('rentCalendar').index('contractId').getAll(id);
  for (const entry of calendarEntries) {
    if (entry.id) {
      await tx.objectStore('rentCalendar').delete(entry.id);
    }
  }
  
  // Delete related rent payments
  const payments = await tx.objectStore('rentPayments').index('contractId').getAll(id);
  for (const payment of payments) {
    if (payment.id) {
      await tx.objectStore('rentPayments').delete(payment.id);
    }
  }
  
  await tx.done;
};

export const terminateContract = async (id: number, terminationDate: string): Promise<void> => {
  const db = await initDB();
  const contract = await db.get('contracts', id);
  
  if (!contract) {
    throw new Error('Contract not found');
  }
  
  // Update contract with termination date
  await updateContract(id, {
    endDate: terminationDate,
    isIndefinite: false,
    status: 'terminated',
  });
};

// Rent calendar functions
export const generateRentCalendar = async (contractId: number, contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  const db = await initDB();
  const periods = calculateRentPeriods(contract);
  
  const calendarEntries: Omit<RentCalendar, 'id'>[] = periods.map(period => ({
    contractId,
    period: period.period,
    expectedAmount: period.amount,
    isProrated: period.isProrated,
    proratedDays: period.proratedDays,
    totalDaysInMonth: period.totalDaysInMonth,
    notes: period.notes,
    createdAt: new Date().toISOString(),
  }));
  
  // Clear existing entries and add new ones
  await clearRentCalendar(contractId);
  for (const entry of calendarEntries) {
    await db.add('rentCalendar', entry);
  }
};

export const regenerateRentCalendar = async (contractId: number, contract: Contract): Promise<void> => {
  await generateRentCalendar(contractId, contract);
};

export const clearRentCalendar = async (contractId: number): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['rentCalendar'], 'readwrite');
  const entries = await tx.objectStore('rentCalendar').index('contractId').getAll(contractId);
  
  for (const entry of entries) {
    if (entry.id) {
      await tx.objectStore('rentCalendar').delete(entry.id);
    }
  }
  
  await tx.done;
};

export const getRentCalendar = async (contractId: number): Promise<RentCalendar[]> => {
  const db = await initDB();
  return await db.getAllFromIndex('rentCalendar', 'contractId', contractId);
};

// Rent payments functions
export const generateRentPayments = async (contractId: number, contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  const db = await initDB();
  const periods = calculateRentPeriods(contract);
  
  const payments: Omit<RentPayment, 'id'>[] = periods.map(period => ({
    contractId,
    period: period.period,
    expectedAmount: period.amount,
    status: 'pending',
    receiptDocuments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  
  // Clear existing payments and add new ones
  await clearRentPayments(contractId);
  for (const payment of payments) {
    await db.add('rentPayments', payment);
  }
};

export const regenerateRentPayments = async (contractId: number, contract: Contract): Promise<void> => {
  await generateRentPayments(contractId, contract);
};

export const clearRentPayments = async (contractId: number): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['rentPayments'], 'readwrite');
  const payments = await tx.objectStore('rentPayments').index('contractId').getAll(contractId);
  
  for (const payment of payments) {
    if (payment.id) {
      await tx.objectStore('rentPayments').delete(payment.id);
    }
  }
  
  await tx.done;
};

export const getRentPayments = async (contractId: number): Promise<RentPayment[]> => {
  const db = await initDB();
  return await db.getAllFromIndex('rentPayments', 'contractId', contractId);
};

export const updateRentPayment = async (id: number, updates: Partial<RentPayment>): Promise<void> => {
  const db = await initDB();
  const existing = await db.get('rentPayments', id);
  
  if (!existing) {
    throw new Error('Payment not found');
  }
  
  const updatedPayment: RentPayment = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await db.put('rentPayments', updatedPayment);
};

export const markPaymentAsPaid = async (id: number, paidAmount: number, paymentDate: string, notes?: string): Promise<void> => {
  await updateRentPayment(id, {
    status: 'paid',
    paidAmount,
    paymentDate,
    paymentNotes: notes,
  });
};

export const markPaymentAsPartial = async (id: number, paidAmount: number, paymentDate: string, notes?: string): Promise<void> => {
  await updateRentPayment(id, {
    status: 'partial',
    paidAmount,
    paymentDate,
    paymentNotes: notes,
  });
};

// Utility functions for rent calculation
interface RentPeriod {
  period: string; // YYYY-MM
  amount: number;
  isProrated: boolean;
  proratedDays?: number;
  totalDaysInMonth?: number;
  notes?: string;
}

export const calculateRentPeriods = (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): RentPeriod[] => {
  const periods: RentPeriod[] = [];
  const startDate = new Date(contract.startDate);
  
  // Determine end date
  let endDate: Date;
  if (contract.isIndefinite) {
    // For indefinite contracts, generate 12 months from start
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else if (contract.endDate) {
    endDate = new Date(contract.endDate);
  } else {
    // Fallback to 12 months
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const period = formatYearMonth(current);
    const isFirstMonth = current.getMonth() === startDate.getMonth() && current.getFullYear() === startDate.getFullYear();
    const isLastMonth = !contract.isIndefinite && contract.endDate && 
      current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear();
    
    let amount = contract.monthlyRent;
    let isProrated = false;
    let proratedDays: number | undefined;
    let totalDaysInMonth: number | undefined;
    let notes: string | undefined;
    
    if (isFirstMonth && startDate.getDate() > 1) {
      // Prorate first month
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRented = daysInMonth - startDate.getDate() + 1;
      amount = (contract.monthlyRent * daysRented) / daysInMonth;
      isProrated = true;
      proratedDays = daysRented;
      totalDaysInMonth = daysInMonth;
      notes = `Prorrateo: ${daysRented}/${daysInMonth} días`;
    }
    
    if (isLastMonth && contract.endDate && !contract.isIndefinite) {
      // Prorate last month
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRented = endDate.getDate();
      amount = (contract.monthlyRent * daysRented) / daysInMonth;
      isProrated = true;
      proratedDays = daysRented;
      totalDaysInMonth = daysInMonth;
      notes = `Prorrateo: ${daysRented}/${daysInMonth} días`;
    }
    
    periods.push({
      period,
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      isProrated,
      proratedDays,
      totalDaysInMonth,
      notes,
    });
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }
  
  return periods;
};

const formatYearMonth = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

// Contract status helpers
export const getContractStatus = (contract: Contract): 'active' | 'upcoming' | 'terminated' => {
  const now = new Date();
  const startDate = new Date(contract.startDate);
  
  if (contract.status === 'terminated') {
    return 'terminated';
  }
  
  if (startDate > now) {
    return 'upcoming';
  }
  
  if (contract.isIndefinite) {
    return 'active';
  }
  
  if (contract.endDate) {
    const endDate = new Date(contract.endDate);
    if (endDate < now) {
      return 'terminated';
    }
  }
  
  return 'active';
};

export const validateContract = async (contract: Partial<Contract>): Promise<string[]> => {
  const errors: string[] = [];
  
  if (!contract.propertyId) {
    errors.push('Debe seleccionar un inmueble');
  }
  
  if (!contract.tenant?.name?.trim()) {
    errors.push('El nombre del inquilino es obligatorio');
  }
  
  if (!contract.startDate) {
    errors.push('La fecha de inicio es obligatoria');
  }
  
  if (!contract.isIndefinite && !contract.endDate) {
    errors.push('Debe especificar una fecha de fin del contrato o marcar la opción "Contrato indefinido"');
  }
  
  if (contract.startDate && contract.endDate && !contract.isIndefinite) {
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);
    if (end <= start) {
      errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
    }
  }
  
  if (!contract.monthlyRent || contract.monthlyRent <= 0) {
    errors.push('La renta mensual debe ser mayor que 0');
  }
  
  if (!contract.paymentDay || contract.paymentDay < 1 || contract.paymentDay > 31) {
    errors.push('El día de cobro debe estar entre 1 y 31');
  }
  
  if (contract.deposit?.months !== undefined && contract.deposit.months < 0) {
    errors.push('Los meses de fianza deben ser 0 o mayor');
  }
  
  // H7: Occupancy validation - check for overlapping contracts
  if (contract.propertyId && contract.startDate) {
    const occupancyErrors = await validateOccupancy(contract);
    errors.push(...occupancyErrors);
  }
  
  return errors;
};

// H7: Occupancy validation to prevent double-booking
export const validateOccupancy = async (contract: Partial<Contract>): Promise<string[]> => {
  const errors: string[] = [];
  
  if (!contract.propertyId || !contract.startDate) {
    return errors;
  }
  
  try {
    const db = await initDB();
    const existingContracts = await db.getAllFromIndex('contracts', 'propertyId', contract.propertyId);
    
    // Filter out the current contract if we're editing
    const otherContracts = existingContracts.filter(c => c.id !== contract.id);
    
    const newStart = new Date(contract.startDate);
    const newEnd = contract.endDate && !contract.isIndefinite 
      ? new Date(contract.endDate) 
      : null; // null means indefinite
    
    for (const existing of otherContracts) {
      // Skip terminated contracts
      if (existing.status === 'terminated') continue;
      
      const existingStart = new Date(existing.startDate);
      const existingEnd = existing.endDate && !existing.isIndefinite 
        ? new Date(existing.endDate) 
        : null; // null means indefinite
      
      // Check for scope conflicts
      let hasConflict = false;
      let conflictDescription = '';
      
      if (contract.scope === 'full-property' || existing.scope === 'full-property') {
        // If either contract covers the full property, there's a conflict
        hasConflict = true;
        conflictDescription = 'inmueble completo';
      } else if (contract.scope === 'units' && existing.scope === 'units') {
        // Check for unit overlaps
        const overlappingUnits = (contract.selectedUnits || []).filter(unit => 
          (existing.selectedUnits || []).includes(unit)
        );
        
        if (overlappingUnits.length > 0) {
          hasConflict = true;
          conflictDescription = `habitación${overlappingUnits.length > 1 ? 'es' : ''} ${overlappingUnits.join(', ')}`;
        }
      }
      
      if (hasConflict) {
        // Check for date overlaps
        const hasDateOverlap = checkDateOverlap(newStart, newEnd, existingStart, existingEnd);
        
        if (hasDateOverlap) {
          const tenantName = existing.tenant?.name || 'Inquilino sin nombre';
          const dateRange = formatDateRange(existingStart, existingEnd);
          
          errors.push(
            `Conflicto de ocupación: ${conflictDescription} ya está ocupado por ${tenantName} (${dateRange})`
          );
        }
      }
    }
  } catch (error) {
    console.error('Error validating occupancy:', error);
    errors.push('Error al validar disponibilidad del inmueble');
  }
  
  return errors;
};

// Helper function to check if two date ranges overlap
const checkDateOverlap = (
  start1: Date, 
  end1: Date | null, 
  start2: Date, 
  end2: Date | null
): boolean => {
  // If either contract is indefinite (end is null), we need special handling
  if (end1 === null && end2 === null) {
    // Both indefinite - always overlap
    return true;
  }
  
  if (end1 === null) {
    // First contract is indefinite - overlaps if second starts before first
    return start2 >= start1;
  }
  
  if (end2 === null) {
    // Second contract is indefinite - overlaps if first starts before second
    return start1 >= start2;
  }
  
  // Both have end dates - standard overlap check
  return start1 <= end2 && start2 <= end1;
};

// Helper function to format date range for error messages
const formatDateRange = (start: Date, end: Date | null): string => {
  const formatDate = (date: Date) => date.toLocaleDateString('es-ES');
  
  if (end === null) {
    return `desde ${formatDate(start)} (indefinido)`;
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`;
};