// `getRentalDaysForYear` · el camino real, con IO · DEDUC Parte A
//
// `diasArrendados.test.ts` fija la unión pura. Esto comprueba lo que la
// envuelve: que el override manual sigue mandando, que el fallback por
// contratos ya no toma el máximo, y que ve los contratos del inmueble por el
// criterio canónico (`inmuebleId` con `propertyId` de respaldo), que es donde
// se quedaban fuera los contratos importados.

import { getRentalDaysForYear } from '../aeatAmortizationService';
import { initDB } from '../db';
import { FECHA_FIN_INDEFINIDO } from '../db/types-alquiler';

jest.mock('../db', () => ({ initDB: jest.fn() }));

// CRA pone `resetMocks: true`: la implementación se repone en cada caso.
const conDatos = (contratos: unknown[], propertyDays: unknown[] = []): void => {
  (initDB as jest.Mock).mockResolvedValue({
    getAllFromIndex: async (store: string) => (store === 'propertyDays' ? propertyDays : []),
    getAll: async () => contratos,
  });
};

const contrato = (fechaInicio: string, fechaFin?: string, over: Record<string, unknown> = {}) => ({
  inmuebleId: 1,
  fechaInicio,
  fechaFin,
  ...over,
});

describe('getRentalDaysForYear', () => {
  it('CONSECUTIVOS · el caso que estaba mal · 272, no 150', async () => {
    conDatos([contrato('2025-02-01', '2025-06-30'), contrato('2025-09-01', '2025-12-31')]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(272);
  });

  it('SIMULTÁNEOS · dos contratos a la vez no duplican', async () => {
    conDatos([contrato('2025-03-01', '2025-06-30'), contrato('2025-03-01', '2025-06-30')]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(122);
  });

  it('LARGA todo el año · 365 · 366 en bisiesto', async () => {
    conDatos([contrato('2025-01-01', '2025-12-31')]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(365);
    conDatos([contrato('2024-01-01', '2024-12-31')]);
    expect(await getRentalDaysForYear(1, 2024)).toBe(366);
  });

  it('FECHA_FIN_INDEFINIDO cubre hasta el 31 de diciembre', async () => {
    conDatos([contrato('2025-03-01', FECHA_FIN_INDEFINIDO)]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(306);
  });

  it('el override manual de `propertyDays` sigue mandando sobre los contratos', async () => {
    conDatos([contrato('2025-01-01', '2025-12-31')], [{ daysRented: 99 }]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(99);
  });

  it('un override en cero es un override · no se cae a los contratos', async () => {
    conDatos([contrato('2025-01-01', '2025-12-31')], [{ daysRented: 0 }]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(0);
  });

  it('un `propertyDays` sin `daysRented` numérico no cuenta como override', async () => {
    conDatos([contrato('2025-02-01', '2025-06-30')], [{ daysRented: null }]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(150);
  });

  it('los contratos de otros inmuebles no suman', async () => {
    conDatos([
      contrato('2025-02-01', '2025-06-30'),
      contrato('2025-09-01', '2025-12-31', { inmuebleId: 2 }),
    ]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(150);
  });

  // Un contrato importado lleva el espejo legacy `propertyId`
  // (`contractImportCreationService.ts:148`). El filtro que había aquí miraba
  // solo `inmuebleId`, así que esos contratos no aportaban ni un día.
  it('ve el contrato importado que solo trae el espejo legacy `propertyId`', async () => {
    conDatos([contrato('2025-02-01', '2025-06-30', { inmuebleId: undefined, propertyId: 1 })]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(150);
  });

  it('sin contratos, cero', async () => {
    conDatos([]);
    expect(await getRentalDaysForYear(1, 2025)).toBe(0);
  });
});
