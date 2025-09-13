import { initDB, Contract, RentaMensual } from './db';

// Enhanced contract management service for CONTRATOS module

// Helper function to suggest indexation based on start date
export const suggestIndexation = (fechaInicio: string): 'ipc' | 'irav' => {
  const startDate = new Date(fechaInicio);
  const cutoffDate = new Date('2023-05-25');
  
  return startDate < cutoffDate ? 'ipc' : 'irav';
};

// Helper function to calculate end date for habitual contracts
export const calculateHabitualEndDate = (fechaInicio: string): string => {
  const startDate = new Date(fechaInicio);
  startDate.setFullYear(startDate.getFullYear() + 5);
  return startDate.toISOString().split('T')[0];
};

// Helper function to calculate duration for temporal contracts
export const calculateDuration = (fechaInicio: string, fechaFin: string): string => {
  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  
  return `${months}m ${days}d`;
};

export const saveContract = async (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
  const db = await initDB();
  const now = new Date().toISOString();
  
  // Ensure default values for required fields
  const enhancedContract: Omit<Contract, 'id'> = {
    ...contract,
    // Set defaults for backward compatibility
    status: contract.estadoContrato === 'activo' ? 'active' : 
           contract.estadoContrato === 'finalizado' ? 'terminated' : 'upcoming',
    documents: contract.documents || [],
    
    // Ensure default grace period
    margenGraciaDias: contract.margenGraciaDias || 5,
    
    // Initialize empty historical indexations
    historicoIndexaciones: contract.historicoIndexaciones || [],
    
    // Set default deposit status
    fianzaEstado: contract.fianzaEstado || 'retenida',
    
    createdAt: now,
    updatedAt: now,
  };
  
  const contractId = await db.add('contracts', enhancedContract);
  
  // Generate monthly rent forecasts (RentaMensual)
  await generateRentaMensual(contractId as number, enhancedContract);
  
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
  
  // If dates or rent changed, regenerate monthly forecasts
  if (updates.fechaInicio || updates.fechaFin || updates.rentaMensual) {
    await regenerateRentaMensual(id, updatedContract);
  }
};

export const getContract = async (id: number): Promise<Contract | undefined> => {
  const db = await initDB();
  return await db.get('contracts', id);
};

export const getContractsByProperty = async (inmuebleId: number): Promise<Contract[]> => {
  const db = await initDB();
  const allContracts = await db.getAll('contracts');
  return allContracts.filter(contract => contract.inmuebleId === inmuebleId);
};

export const getAllContracts = async (): Promise<Contract[]> => {
  try {
    const db = await initDB();
    return await db.getAll('contracts');
  } catch (error) {
    console.error('Error fetching contracts:', error);
    
    // Return empty array as fallback instead of throwing
    // This prevents the page from becoming completely unusable
    if (error instanceof Error && error.message.includes('Database')) {
      console.warn('Database error, returning empty contracts array');
      return [];
    }
    
    throw error;
  }
};

export const deleteContract = async (id: number): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['contracts', 'rentaMensual'], 'readwrite');
  
  // Delete contract
  await tx.objectStore('contracts').delete(id);
  
  // Delete related rent forecasts
  const rentaMensualEntries = await tx.objectStore('rentaMensual').index('contratoId').getAll(id);
  for (const entry of rentaMensualEntries) {
    if (entry.id) {
      await tx.objectStore('rentaMensual').delete(entry.id);
    }
  }
  
  await tx.done;
};

export const rescindContract = async (id: number, fechaRescision: string, motivo: string): Promise<void> => {
  const db = await initDB();
  const contract = await db.get('contracts', id);
  
  if (!contract) {
    throw new Error('Contract not found');
  }
  
  // Update contract with rescission information
  await updateContract(id, {
    fechaFin: fechaRescision,
    estadoContrato: 'rescindido',
    rescision: {
      fecha: fechaRescision,
      motivo
    }
  });
};

// Generate monthly rent forecasts for treasury integration
export const generateRentaMensual = async (contratoId: number, contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  const db = await initDB();
  const periods = calculateRentPeriodsNew(contract);
  
  const rentaMensualEntries: Omit<RentaMensual, 'id'>[] = periods.map(period => ({
    contratoId,
    periodo: period.periodo,
    importePrevisto: period.importe,
    importeCobradoAcum: 0,
    estado: 'pendiente',
    movimientosVinculados: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  
  // Clear existing entries and add new ones
  await clearRentaMensual(contratoId);
  for (const entry of rentaMensualEntries) {
    await db.add('rentaMensual', entry);
  }
};

export const regenerateRentaMensual = async (contratoId: number, contract: Contract): Promise<void> => {
  await generateRentaMensual(contratoId, contract);
};

export const clearRentaMensual = async (contratoId: number): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['rentaMensual'], 'readwrite');
  const entries = await tx.objectStore('rentaMensual').index('contratoId').getAll(contratoId);
  
  for (const entry of entries) {
    if (entry.id) {
      await tx.objectStore('rentaMensual').delete(entry.id);
    }
  }
  
  await tx.done;
};

export const getRentaMensual = async (contratoId: number): Promise<RentaMensual[]> => {
  const db = await initDB();
  const allEntries = await db.getAll('rentaMensual');
  return allEntries.filter(entry => entry.contratoId === contratoId);
};

// Calculate rent periods for new Contract interface
interface RentPeriodNew {
  periodo: string; // YYYY-MM
  importe: number;
  esProrrata: boolean;
  diasProrrata?: number;
  diasTotalesMes?: number;
  notas?: string;
}

export const calculateRentPeriodsNew = (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): RentPeriodNew[] => {
  const periods: RentPeriodNew[] = [];
  const startDate = new Date(contract.fechaInicio);
  const endDate = new Date(contract.fechaFin);
  
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const periodo = formatYearMonth(current);
    const isFirstMonth = current.getMonth() === startDate.getMonth() && current.getFullYear() === startDate.getFullYear();
    const isLastMonth = current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear();
    
    let importe = contract.rentaMensual;
    let esProrrata = false;
    let diasProrrata: number | undefined;
    let diasTotalesMes: number | undefined;
    let notas: string | undefined;
    
    if (isFirstMonth && startDate.getDate() > 1) {
      // Prorate first month
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRented = daysInMonth - startDate.getDate() + 1;
      importe = (contract.rentaMensual * daysRented) / daysInMonth;
      esProrrata = true;
      diasProrrata = daysRented;
      diasTotalesMes = daysInMonth;
      notas = `Prorrateo: ${daysRented}/${daysInMonth} días`;
    }
    
    if (isLastMonth && endDate.getDate() < new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()) {
      // Prorate last month
      const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const daysRented = endDate.getDate();
      importe = (contract.rentaMensual * daysRented) / daysInMonth;
      esProrrata = true;
      diasProrrata = daysRented;
      diasTotalesMes = daysInMonth;
      notas = `Prorrateo: ${daysRented}/${daysInMonth} días`;
    }
    
    periods.push({
      periodo,
      importe: Math.round(importe * 100) / 100, // Round to 2 decimal places
      esProrrata,
      diasProrrata,
      diasTotalesMes,
      notas,
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
  const startDate = new Date(contract.fechaInicio);
  
  if (contract.estadoContrato === 'rescindido' || contract.estadoContrato === 'finalizado') {
    return 'terminated';
  }
  
  if (startDate > now) {
    return 'upcoming';
  }
  
  return 'active';
};

export const validateContract = async (contract: Partial<Contract>): Promise<string[]> => {
  const errors: string[] = [];
  
  if (!contract.inmuebleId) {
    errors.push('Debe seleccionar un inmueble');
  }
  
  if (!contract.inquilino?.nombre?.trim()) {
    errors.push('El nombre del inquilino es obligatorio');
  }
  
  if (!contract.inquilino?.apellidos?.trim()) {
    errors.push('Los apellidos del inquilino son obligatorios');
  }
  
  if (!contract.inquilino?.dni?.trim()) {
    errors.push('El DNI del inquilino es obligatorio');
  }
  
  if (!contract.inquilino?.telefono?.trim()) {
    errors.push('El teléfono del inquilino es obligatorio');
  }
  
  if (!contract.inquilino?.email?.trim()) {
    errors.push('El email del inquilino es obligatorio');
  }
  
  if (!contract.fechaInicio) {
    errors.push('La fecha de inicio es obligatoria');
  }
  
  if (!contract.fechaFin) {
    errors.push('La fecha de fin es obligatoria');
  }
  
  if (contract.fechaInicio && contract.fechaFin) {
    const start = new Date(contract.fechaInicio);
    const end = new Date(contract.fechaFin);
    if (end <= start) {
      errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
    }
  }
  
  if (!contract.rentaMensual || contract.rentaMensual <= 0) {
    errors.push('La renta mensual debe ser mayor que 0');
  }
  
  if (!contract.diaPago || contract.diaPago < 1 || contract.diaPago > 31) {
    errors.push('El día de cobro debe estar entre 1 y 31');
  }
  
  if (contract.fianzaMeses !== undefined && contract.fianzaMeses < 0) {
    errors.push('Los meses de fianza deben ser 0 o mayor');
  }
  
  if (!contract.cuentaCobroId) {
    errors.push('Debe seleccionar una cuenta bancaria de cobro');
  }
  
  // Check for overlapping contracts on the same unit/room
  if (contract.inmuebleId && contract.fechaInicio) {
    const occupancyErrors = await validateOccupancy(contract);
    errors.push(...occupancyErrors);
  }
  
  return errors;
};

// Occupancy validation to prevent double-booking
export const validateOccupancy = async (contract: Partial<Contract>): Promise<string[]> => {
  const errors: string[] = [];
  
  if (!contract.inmuebleId || !contract.fechaInicio) {
    return errors;
  }
  
  try {
    const existingContracts = await getContractsByProperty(contract.inmuebleId);
    
    // Filter out the current contract if we're editing
    const otherContracts = existingContracts.filter(c => c.id !== contract.id);
    
    const newStart = new Date(contract.fechaInicio);
    const newEnd = contract.fechaFin ? new Date(contract.fechaFin) : null;
    
    for (const existing of otherContracts) {
      // Skip terminated contracts
      if (existing.estadoContrato === 'rescindido' || existing.estadoContrato === 'finalizado') continue;
      
      const existingStart = new Date(existing.fechaInicio);
      const existingEnd = new Date(existing.fechaFin);
      
      // Check for unit conflicts
      let hasConflict = false;
      let conflictDescription = '';
      
      if (contract.unidadTipo === 'vivienda' || existing.unidadTipo === 'vivienda') {
        // If either contract covers the full property, there's a conflict
        hasConflict = true;
        conflictDescription = 'inmueble completo';
      } else if (contract.unidadTipo === 'habitacion' && existing.unidadTipo === 'habitacion') {
        // Check for specific room conflicts
        if (contract.habitacionId && existing.habitacionId && contract.habitacionId === existing.habitacionId) {
          hasConflict = true;
          conflictDescription = `habitación ${contract.habitacionId}`;
        }
      }
      
      if (hasConflict) {
        // Check for date overlaps
        const hasDateOverlap = checkDateOverlap(newStart, newEnd, existingStart, existingEnd);
        
        if (hasDateOverlap) {
          const tenantName = `${existing.inquilino.nombre} ${existing.inquilino.apellidos}`;
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
  // If either end date is null, treat as very far future
  const actualEnd1 = end1 || new Date('2099-12-31');
  const actualEnd2 = end2 || new Date('2099-12-31');
  
  // Standard overlap check
  return start1 <= actualEnd2 && start2 <= actualEnd1;
};

// Helper function to format date range for error messages
const formatDateRange = (start: Date, end: Date | null): string => {
  const formatDate = (date: Date) => date.toLocaleDateString('es-ES');
  
  if (end === null) {
    return `desde ${formatDate(start)} (indefinido)`;
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`;
};