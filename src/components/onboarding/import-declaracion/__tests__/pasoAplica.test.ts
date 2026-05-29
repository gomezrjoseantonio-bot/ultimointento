// Wizard import XML V2 · § 4.2 · aplicabilidad condicional de los 10 pasos.
import { pasoAplica, type PasoNum } from '../useWizardImportState';
import type { DeclaracionCompleta } from '../../../../types/declaracionCompleta';

function decl(parcial: Partial<DeclaracionCompleta>): DeclaracionCompleta {
  return {
    meta: { ejercicio: 2024, tipoDeclaracion: 'D' } as any,
    declarante: { nif: 'X', nombreCompleto: 'Y', tributacion: 'individual' } as any,
    inmuebles: [],
    integracion: {} as any,
    resultado: {} as any,
    arrastres: {} as any,
    casillas: {},
    camposExtra: {},
    ...parcial,
  } as DeclaracionCompleta;
}

describe('pasoAplica', () => {
  it('sin declaraciones · sólo aplica el paso 1', () => {
    for (let n = 1 as PasoNum; n <= 10; n = (n + 1) as PasoNum) {
      expect(pasoAplica(n, [])).toBe(n === 1);
    }
  });

  it('pasos siempre aplicables: 1, 9, 10', () => {
    const d = [decl({})];
    expect(pasoAplica(1, d)).toBe(true);
    expect(pasoAplica(9, d)).toBe(true);
    expect(pasoAplica(10, d)).toBe(true);
  });

  it('paso 2 (inmuebles) sólo si hay inmuebles', () => {
    expect(pasoAplica(2, [decl({})])).toBe(false);
    expect(pasoAplica(2, [decl({ inmuebles: [{ refCatastral: 'RC', direccion: 'D', arrendamientos: [], mejorasEjercicio: [], proveedores: [] } as any] })])).toBe(true);
  });

  it('paso 3 (IBAN) sólo si hay cuenta', () => {
    expect(pasoAplica(3, [decl({})])).toBe(false);
    expect(pasoAplica(3, [decl({ cuentaDevolucion: { iban: 'ES00' } })])).toBe(true);
    expect(pasoAplica(3, [decl({ cuentaIngreso: { iban: 'ES11' } })])).toBe(true);
  });

  it('paso 5 (PP) sólo si hay planPensiones', () => {
    expect(pasoAplica(5, [decl({})])).toBe(false);
    expect(pasoAplica(5, [decl({ planPensiones: {} as any })])).toBe(true);
  });

  it('paso 6 (nómina) sólo si retribuciones > 0', () => {
    expect(pasoAplica(6, [decl({ trabajo: { retribucionesDinerarias: 0 } as any })])).toBe(false);
    expect(pasoAplica(6, [decl({ trabajo: { retribucionesDinerarias: 30000 } as any })])).toBe(true);
  });

  it('paso 7 (autónomo) sólo si hay actividadEconomica', () => {
    expect(pasoAplica(7, [decl({})])).toBe(false);
    expect(pasoAplica(7, [decl({ actividadEconomica: {} as any })])).toBe(true);
  });

  it('paso 8 (ventas) no aplica por ahora (detección en commit posterior)', () => {
    expect(pasoAplica(8, [decl({ inmuebles: [{ refCatastral: 'RC', direccion: 'D', arrendamientos: [], mejorasEjercicio: [], proveedores: [] } as any] })])).toBe(false);
  });
});
