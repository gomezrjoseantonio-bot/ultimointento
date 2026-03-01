import { initDB, PropertyDays } from './db';
import { calcularDiasAlquiladoDesdeContratos } from './irpfCalculationService';

function getDaysInYear(year: number): number {
  return new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
}

export async function getPropertyOccupancy(propertyId: number, taxYear: number): Promise<PropertyDays | null> {
  const db = await initDB();
  const rows = await db.getAllFromIndex('propertyDays', 'property-year', [propertyId, taxYear]);
  return rows?.[0] ?? null;
}

export async function ensurePropertyOccupancy(propertyId: number, taxYear: number): Promise<PropertyDays> {
  const existing = await getPropertyOccupancy(propertyId, taxYear);
  if (existing) return existing;

  const db = await initDB();
  const contracts = await db.getAllFromIndex('contracts', 'propertyId', propertyId);
  const yearDays = getDaysInYear(taxYear);
  const daysRented = calcularDiasAlquiladoDesdeContratos(contracts as any[], taxYear, yearDays);

  const draft: Omit<PropertyDays, 'id'> = {
    propertyId,
    taxYear,
    daysRented,
    daysAvailable: yearDays,
    daysUnderRenovation: 0,
    manualOverride: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const id = await db.add('propertyDays', draft) as number;
  return { ...draft, id };
}

export async function savePropertyOccupancy(
  propertyId: number,
  taxYear: number,
  payload: { daysRented: number; daysUnderRenovation?: number; notes?: string }
): Promise<PropertyDays> {
  const db = await initDB();
  const yearDays = getDaysInYear(taxYear);
  const current = await ensurePropertyOccupancy(propertyId, taxYear);

  const daysRented = Math.max(0, Math.min(yearDays, Math.round(payload.daysRented || 0)));
  const maxRenovation = Math.max(0, yearDays - daysRented);
  const daysUnderRenovation = Math.max(
    0,
    Math.min(maxRenovation, Math.round(payload.daysUnderRenovation || 0))
  );

  const updated: PropertyDays = {
    ...current,
    daysRented,
    daysUnderRenovation,
    daysAvailable: yearDays,
    manualOverride: true,
    notes: payload.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  await db.put('propertyDays', updated);
  return updated;
}
