// src/services/opexService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub para evitar romper consumers.
// Ya migrado a compromisosRecurrentes en TAREA 2.

import { CompromisoRecurrente } from '../types/compromisosRecurrentes';

// Legacy types (no longer in db.ts)
export type OpexFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one-time';
export type OpexCategory = 'ibi' | 'seguro' | 'comunidad' | 'suministros' | 'otros' | 'basura' | 'gestion';

export interface OpexRule {
  id?: number;
  propertyId: number;
  category: OpexCategory;
  estimatedAmount: number;
  frequency: OpexFrequency;
  nextDueDate?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getOpexRulesForProperty(_propertyId: number): Promise<OpexRule[]> {
  return [];
}

export async function saveOpexRule(_rule: Partial<OpexRule>): Promise<OpexRule | null> {
  console.warn('[opexService] Store eliminado en V62 · usar compromisosRecurrentes');
  return null;
}

export async function deleteOpexRule(_id: number): Promise<void> {
  console.warn('[opexService] Store eliminado en V62 · operación no-op');
}

export function mapCompromisoToOpexRule(_compromiso: CompromisoRecurrente): OpexRule | null {
  return null;
}
