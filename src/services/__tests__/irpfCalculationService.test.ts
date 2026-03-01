// Tests for irpfCalculationService — partial-year occupancy scenarios (tarea 1.1 epic #414)

import { calcularDiasAnio, calcularDiasAlquiladoDesdeContratos } from '../irpfCalculationService';

describe('calcularDiasAnio', () => {
  it('returns 365 for a non-leap year', () => {
    expect(calcularDiasAnio(2023)).toBe(365);
  });

  it('returns 366 for a leap year', () => {
    expect(calcularDiasAnio(2024)).toBe(366);
  });

  it('returns 365 for century year not divisible by 400', () => {
    expect(calcularDiasAnio(1900)).toBe(365);
  });

  it('returns 366 for century year divisible by 400', () => {
    expect(calcularDiasAnio(2000)).toBe(366);
  });
});

describe('calcularDiasAlquiladoDesdeContratos', () => {
  const YEAR = 2024;
  const DIAS_TOTAL = 366; // 2024 is a leap year

  it('returns 0 for empty contracts array', () => {
    expect(calcularDiasAlquiladoDesdeContratos([], YEAR, DIAS_TOTAL)).toBe(0);
  });

  it('returns full year days for a contract spanning the whole year', () => {
    const contracts = [
      { fechaInicio: '2024-01-01', fechaFin: '2024-12-31' },
    ];
    expect(calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL)).toBe(366);
  });

  it('counts 184 days for a contract from Jan 1 to Jul 2 (leap year)', () => {
    // Jan=31, Feb=29, Mar=31, Apr=30, May=31, Jun=30 = 182 days → +2 days in July = 184
    const contracts = [
      { fechaInicio: '2024-01-01', fechaFin: '2024-07-02' },
    ];
    const days = calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL);
    expect(days).toBe(184);
  });

  it('counts remaining days for a contract from Jul 3 to Dec 31 (leap year, 182 days)', () => {
    // 366 - 184 = 182
    const contracts = [
      { fechaInicio: '2024-07-03', fechaFin: '2024-12-31' },
    ];
    const days = calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL);
    expect(days).toBe(182);
  });

  it('clips contract dates to exercise year boundaries', () => {
    // Contract runs from 2023-07-01 to 2024-06-30 — only the 2024 part counts
    // Jan 1 to Jun 30 = 31+29+31+30+31+30 = 182 days
    const contracts = [
      { fechaInicio: '2023-07-01', fechaFin: '2024-06-30' },
    ];
    const days = calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL);
    expect(days).toBe(182);
  });

  it('caps the total at diasTotal when contracts overlap the full year', () => {
    const contracts = [
      { fechaInicio: '2024-01-01', fechaFin: '2024-12-31' },
      { fechaInicio: '2024-06-01', fechaFin: '2024-12-31' },
    ];
    const days = calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL);
    expect(days).toBe(DIAS_TOTAL);
  });

  it('supports startDate/endDate fallback fields', () => {
    const contracts = [
      { startDate: '2024-01-01', endDate: '2024-12-31' },
    ];
    expect(calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL)).toBe(366);
  });

  it('handles non-leap year correctly (2023, 365 days)', () => {
    const YEAR_2023 = 2023;
    const DIAS_2023 = 365;
    const contracts = [
      { fechaInicio: '2023-01-01', fechaFin: '2023-12-31' },
    ];
    expect(calcularDiasAlquiladoDesdeContratos(contracts, YEAR_2023, DIAS_2023)).toBe(365);
  });

  it('counts 155 days for a partial year rental (real user scenario)', () => {
    // Rented from May 30 to Oct 31 = 155 days
    // May: 2 days (30,31), Jun: 30, Jul: 31, Aug: 31, Sep: 30, Oct: 31 = 2+30+31+31+30+31 = 155
    const contracts = [
      { fechaInicio: '2024-05-30', fechaFin: '2024-10-31' },
    ];
    expect(calcularDiasAlquiladoDesdeContratos(contracts, YEAR, DIAS_TOTAL)).toBe(155);
  });
});
