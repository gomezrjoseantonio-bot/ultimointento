/**
 * Tests · fixDeclaracionCompletaCruceB6 (FIX-B6-bis).
 *
 * Casos cubiertos ·
 *   1. Swap · ejercicio con aeat.fuenteImportacion='xml' y planPensiones
 *      poblado invierte aportacionesTrabajador ↔ contribucionesEmpresa ·
 *      flag escrito · skipped=false. Otros campos (totalConDerechoReduccion,
 *      nifEmpleador, nombreEmpleador) intactos.
 *   2. Skip-on-flag · 2ª ejecución no toca nada · skipped=true · swapped=0.
 *   3. fuenteImportacion!='xml' · permanece intacto.
 *   4. Sin aeat · sin declaracionCompleta · sin planPensiones · skip.
 *   5. Caso Jose · 5 ejercicios (2020-2024) · todos volteados, sumas
 *      preservadas.
 *   6. Ambos importes a 0 · no cuenta como swap · flag igualmente escrito.
 *   7. DB vacía · skipped=false · swapped=0 · flag escrito.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { EjercicioFiscalCoord } from '../../db';

describe('fixDeclaracionCompletaCruceB6', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  function buildEjercicio(overrides: {
    año: number;
    fuenteImportacion?: 'xml' | 'pdf' | 'manual';
    planPensiones?: {
      aportacionesTrabajador: number;
      contribucionesEmpresa: number;
      totalConDerechoReduccion: number;
      nifEmpleador?: string;
      nombreEmpleador?: string;
    };
    sinAeat?: boolean;
    sinDeclaracionCompleta?: boolean;
  }): EjercicioFiscalCoord {
    const base: EjercicioFiscalCoord = {
      año: overrides.año,
      estado: 'declarado',
      arrastresIn: {
        fuente: 'aeat',
        gastosPendientes: [],
        perdidasPatrimoniales: [],
        amortizacionesAcumuladas: [],
        deduccionesPendientes: [],
      },
      inmuebleIds: [],
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };
    if (overrides.sinAeat) return base;
    base.aeat = {
      snapshot: {},
      resumen: {
        baseImponibleGeneral: 0,
        baseImponibleAhorro: 0,
        baseLiquidableGeneral: 0,
        baseLiquidableAhorro: 0,
        cuotaIntegra: 0,
        cuotaIntegraEstatal: 0,
        cuotaIntegraAutonomica: 0,
        cuotaLiquidaEstatal: 0,
        cuotaLiquidaAutonomica: 0,
        resultado: 0,
      },
      fechaImportacion: '2026-04-01T00:00:00Z',
      fuenteImportacion: overrides.fuenteImportacion ?? 'xml',
    };
    if (overrides.sinDeclaracionCompleta) return base;
    base.aeat.declaracionCompleta = {
      meta: {
        ejercicio: overrides.año,
        modelo: '100',
        fechaPresentacion: '',
        numeroJustificante: '',
        csv: '',
        referencia: '',
        fuenteImportacion: overrides.fuenteImportacion ?? 'xml',
        confianza: 'total',
        esComplementaria: false,
        esRectificativa: false,
        tipoDeclaracion: 'D',
      },
      planPensiones: overrides.planPensiones,
    } as any;
    return base;
  }

  it('1 · swap · xml + planPensiones · invierte campos · otros intactos · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6, B6_DECLARACION_COMPLETA_FLAG_KEY } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();
    await db.put(
      'ejerciciosFiscalesCoord',
      buildEjercicio({
        año: 2024,
        fuenteImportacion: 'xml',
        planPensiones: {
          aportacionesTrabajador: 1862.16,
          contribucionesEmpresa: 1396.68,
          totalConDerechoReduccion: 3258.84,
          nifEmpleador: 'A82009812',
          nombreEmpleador: 'ORANGE ESPAGNE SA',
        },
      }),
    );

    const report = await fixDeclaracionCompletaCruceB6();

    expect(report.skipped).toBe(false);
    expect(report.swapped).toBe(1);
    expect(report.errors).toEqual([]);

    const ej = (await db.get('ejerciciosFiscalesCoord', 2024)) as any;
    expect(ej.aeat.declaracionCompleta.planPensiones.aportacionesTrabajador).toBe(1396.68);
    expect(ej.aeat.declaracionCompleta.planPensiones.contribucionesEmpresa).toBe(1862.16);
    // Invariante de suma · total = trabajador + empresa.
    expect(
      ej.aeat.declaracionCompleta.planPensiones.aportacionesTrabajador
        + ej.aeat.declaracionCompleta.planPensiones.contribucionesEmpresa,
    ).toBeCloseTo(3258.84, 2);
    // Resto intacto.
    expect(ej.aeat.declaracionCompleta.planPensiones.totalConDerechoReduccion).toBe(3258.84);
    expect(ej.aeat.declaracionCompleta.planPensiones.nifEmpleador).toBe('A82009812');
    expect(ej.aeat.declaracionCompleta.planPensiones.nombreEmpleador).toBe('ORANGE ESPAGNE SA');

    const flag = await db.get('keyval', B6_DECLARACION_COMPLETA_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · skip-on-flag · 2ª ejecución no toca nada · skipped=true', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6 } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();
    await db.put(
      'ejerciciosFiscalesCoord',
      buildEjercicio({
        año: 2024,
        planPensiones: {
          aportacionesTrabajador: 1862.16,
          contribucionesEmpresa: 1396.68,
          totalConDerechoReduccion: 3258.84,
        },
      }),
    );

    const first = await fixDeclaracionCompletaCruceB6();
    expect(first.skipped).toBe(false);
    expect(first.swapped).toBe(1);

    const second = await fixDeclaracionCompletaCruceB6();
    expect(second.skipped).toBe(true);
    expect(second.swapped).toBe(0);
    expect(second.errors).toEqual([]);

    // Tras el 1.º run, queda volteado. 2.º run NO debe re-invertir.
    const ej = (await db.get('ejerciciosFiscalesCoord', 2024)) as any;
    expect(ej.aeat.declaracionCompleta.planPensiones.aportacionesTrabajador).toBe(1396.68);
    expect(ej.aeat.declaracionCompleta.planPensiones.contribucionesEmpresa).toBe(1862.16);
  });

  it('3 · fuenteImportacion!=xml · permanece intacto', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6 } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();
    await db.put(
      'ejerciciosFiscalesCoord',
      buildEjercicio({
        año: 2024,
        fuenteImportacion: 'pdf',
        planPensiones: {
          aportacionesTrabajador: 1396.68,
          contribucionesEmpresa: 1862.16,
          totalConDerechoReduccion: 3258.84,
        },
      }),
    );
    await db.put(
      'ejerciciosFiscalesCoord',
      buildEjercicio({
        año: 2023,
        fuenteImportacion: 'manual',
        planPensiones: {
          aportacionesTrabajador: 1000,
          contribucionesEmpresa: 2000,
          totalConDerechoReduccion: 3000,
        },
      }),
    );

    const report = await fixDeclaracionCompletaCruceB6();
    expect(report.swapped).toBe(0);
    expect(report.errors).toEqual([]);

    const ej2024 = (await db.get('ejerciciosFiscalesCoord', 2024)) as any;
    expect(ej2024.aeat.declaracionCompleta.planPensiones.aportacionesTrabajador).toBe(1396.68);
    expect(ej2024.aeat.declaracionCompleta.planPensiones.contribucionesEmpresa).toBe(1862.16);

    const ej2023 = (await db.get('ejerciciosFiscalesCoord', 2023)) as any;
    expect(ej2023.aeat.declaracionCompleta.planPensiones.aportacionesTrabajador).toBe(1000);
    expect(ej2023.aeat.declaracionCompleta.planPensiones.contribucionesEmpresa).toBe(2000);
  });

  it('4 · sin aeat · sin declaracionCompleta · sin planPensiones · skip por registro', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6, B6_DECLARACION_COMPLETA_FLAG_KEY } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();
    await db.put('ejerciciosFiscalesCoord', buildEjercicio({ año: 2024, sinAeat: true }));
    await db.put('ejerciciosFiscalesCoord', buildEjercicio({ año: 2023, sinDeclaracionCompleta: true }));
    await db.put('ejerciciosFiscalesCoord', buildEjercicio({ año: 2022 }));

    const report = await fixDeclaracionCompletaCruceB6();
    expect(report.swapped).toBe(0);
    expect(report.errors).toEqual([]);

    const flag = await db.get('keyval', B6_DECLARACION_COMPLETA_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('5 · 5 ejercicios Jose (2020-2024) · todos volteados · sumas preservadas', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6 } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();
    const datos = [
      { año: 2020, trabajador: 1604.52, empresa: 1203.36, total: 2807.88 },
      { año: 2021, trabajador: 1604.52, empresa: 1203.37, total: 2807.89 },
      { año: 2022, trabajador: 1708.80, empresa: 1281.60, total: 2990.40 },
      { año: 2023, trabajador: 1806.24, empresa: 1354.68, total: 3160.92 },
      { año: 2024, trabajador: 1862.16, empresa: 1396.68, total: 3258.84 },
    ];
    for (const d of datos) {
      await db.put(
        'ejerciciosFiscalesCoord',
        buildEjercicio({
          año: d.año,
          planPensiones: {
            aportacionesTrabajador: d.trabajador,
            contribucionesEmpresa: d.empresa,
            totalConDerechoReduccion: d.total,
          },
        }),
      );
    }

    const report = await fixDeclaracionCompletaCruceB6();
    expect(report.swapped).toBe(5);
    expect(report.errors).toEqual([]);

    for (const d of datos) {
      const ej = (await db.get('ejerciciosFiscalesCoord', d.año)) as any;
      const pp = ej.aeat.declaracionCompleta.planPensiones;
      expect(pp.aportacionesTrabajador).toBe(d.empresa);
      expect(pp.contribucionesEmpresa).toBe(d.trabajador);
      expect(pp.aportacionesTrabajador + pp.contribucionesEmpresa).toBeCloseTo(d.total, 2);
      expect(pp.totalConDerechoReduccion).toBe(d.total);
    }
  });

  it('6 · ambos importes a 0 · no cuenta como swap · flag igualmente escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6, B6_DECLARACION_COMPLETA_FLAG_KEY } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();
    await db.put(
      'ejerciciosFiscalesCoord',
      buildEjercicio({
        año: 2024,
        planPensiones: {
          aportacionesTrabajador: 0,
          contribucionesEmpresa: 0,
          totalConDerechoReduccion: 0,
        },
      }),
    );

    const report = await fixDeclaracionCompletaCruceB6();
    expect(report.skipped).toBe(false);
    expect(report.swapped).toBe(0);
    expect(report.errors).toEqual([]);

    const flag = await db.get('keyval', B6_DECLARACION_COMPLETA_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('7 · DB vacía · skipped=false · swapped=0 · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixDeclaracionCompletaCruceB6, B6_DECLARACION_COMPLETA_FLAG_KEY } = await import(
      '../fixDeclaracionCompletaCruceB6'
    );

    const db = await initDB();

    const report = await fixDeclaracionCompletaCruceB6();
    expect(report.skipped).toBe(false);
    expect(report.swapped).toBe(0);
    expect(report.errors).toEqual([]);

    const flag = await db.get('keyval', B6_DECLARACION_COMPLETA_FLAG_KEY);
    expect(flag).toBe('completed');
  });
});
