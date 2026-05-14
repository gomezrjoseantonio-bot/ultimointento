// S-FISCAL-FIXES Fix 3 · N3 imputación renta a disposición
// Validación al céntimo · T64 4D 2024 (260,68) · año bisiesto 366 · revisado 1,1%

import {
  computeImputacion,
  calcularImputacion,
  esBisiesto,
  vcRevisadoEnUltimos10Anios,
} from '../imputacionRentaService';
import { initDB } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));

describe('Fix 3 · imputación renta · helpers', () => {
  it('esBisiesto', () => {
    expect(esBisiesto(2024)).toBe(true);
    expect(esBisiesto(2025)).toBe(false);
    expect(esBisiesto(2000)).toBe(true);
    expect(esBisiesto(1900)).toBe(false);
    expect(esBisiesto(2100)).toBe(false);
  });

  it('vcRevisadoEnUltimos10Anios', () => {
    expect(vcRevisadoEnUltimos10Anios('2015-06-01', 2024)).toBe(true); // 9 años
    expect(vcRevisadoEnUltimos10Anios('2014-12-31', 2024)).toBe(true); // 10 años
    expect(vcRevisadoEnUltimos10Anios('2013-12-31', 2024)).toBe(false); // 11 años
    expect(vcRevisadoEnUltimos10Anios(undefined, 2024)).toBe(false);
    expect(vcRevisadoEnUltimos10Anios('invalid-date', 2024)).toBe(false);
  });
});

describe('Fix 3 · computeImputacion · al céntimo', () => {
  it('T64 4D 2024 · revisado · 182 días · 366 día año → 260,68', () => {
    const r = computeImputacion({
      diasDisposicion: 182,
      valorCatastral: 47656.37,
      revisado: true,
      anio: 2024,
    });
    expect(r.desglose.tipoAplicable).toBe(1.1);
    expect(r.desglose.diasAnio).toBe(366);
    expect(r.desglose.diasDisposicion).toBe(182);
    expect(r.imputacion).toBeCloseTo(260.68, 2);
    expect(r.alertas).toEqual([]);
  });

  it('No revisado · 2% sobre VC', () => {
    // 100000 × 2% × 365/365 = 2000
    const r = computeImputacion({
      diasDisposicion: 365,
      valorCatastral: 100000,
      revisado: false,
      anio: 2025,
    });
    expect(r.desglose.tipoAplicable).toBe(2.0);
    expect(r.desglose.diasAnio).toBe(365);
    expect(r.imputacion).toBeCloseTo(2000, 2);
  });

  it('Sin días disposición · imputación = 0', () => {
    const r = computeImputacion({
      diasDisposicion: 0,
      valorCatastral: 100000,
      revisado: true,
      anio: 2024,
    });
    expect(r.imputacion).toBe(0);
    expect(r.alertas).toEqual([]);
  });

  it('Sin VC · imputación = 0 + alerta', () => {
    const r = computeImputacion({
      diasDisposicion: 100,
      valorCatastral: 0,
      revisado: true,
      anio: 2024,
    });
    expect(r.imputacion).toBe(0);
    expect(r.alertas).toHaveLength(1);
    expect(r.alertas[0]).toMatch(/Valor catastral/);
  });
});

describe('Fix 3 · calcularImputacion (con DB)', () => {
  function setupDB(property: any, propertyDays: any | null) {
    (initDB as jest.Mock).mockResolvedValue({
      get: jest.fn(async (store: string, id: number) =>
        store === 'properties' && property?.id === id ? property : null,
      ),
      getAllFromIndex: jest.fn(async (store: string) => {
        if (store === 'propertyDays' && propertyDays) return [propertyDays];
        return [];
      }),
    });
  }

  beforeEach(() => jest.clearAllMocks());

  it('T64 4D 2024 · días disposición = total − alquilado − obras', async () => {
    // 366 - 184 (alquilado) - 0 (obras) = 182
    setupDB(
      {
        id: 4001,
        fiscalData: { cadastralValue: 47656.37, cadastralRevised: true },
      },
      { propertyId: 4001, taxYear: 2024, daysAvailable: 366, daysRented: 184, daysUnderRenovation: 0 },
    );
    const r = await calcularImputacion(4001, 2024);
    expect(r.desglose.diasDisposicion).toBe(182);
    expect(r.desglose.tipoAplicable).toBe(1.1);
    expect(r.imputacion).toBeCloseTo(260.68, 2);
  });

  it('Buigas 2024 · alquilado todo el año · imputación = 0', async () => {
    setupDB(
      { id: 4002, fiscalData: { cadastralValue: 68371.03, cadastralRevised: false } },
      { propertyId: 4002, taxYear: 2024, daysAvailable: 366, daysRented: 366, daysUnderRenovation: 0 },
    );
    const r = await calcularImputacion(4002, 2024);
    expect(r.desglose.diasDisposicion).toBe(0);
    expect(r.imputacion).toBe(0);
  });

  it('Sin propertyDays · asume todo a disposición', async () => {
    setupDB(
      { id: 9, fiscalData: { cadastralValue: 50000, cadastralRevised: true } },
      null,
    );
    const r = await calcularImputacion(9, 2024);
    expect(r.desglose.diasDisposicion).toBe(366);
    // 50000 × 1.1% × 366/366 = 550
    expect(r.imputacion).toBeCloseTo(550, 2);
  });

  it('Property no existe · lanza error', async () => {
    setupDB(null, null);
    await expect(calcularImputacion(99, 2024)).rejects.toThrow(/no existe/);
  });
});
