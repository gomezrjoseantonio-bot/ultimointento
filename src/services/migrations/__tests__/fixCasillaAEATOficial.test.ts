/**
 * Tests · fixCasillaAEATOficial (TAREA 13 v4 · Acción 1 · D6).
 *
 * Casos cubiertos ·
 *   1. Update + split · solo titular → '0426' in-place; solo empresa → '0427'
 *      in-place; ambos > 0 → split en 2 rows (id original con '0426' y
 *      empresa=0, id nuevo con '0427' y titular=0). Flag escrito · skipped=false.
 *   2. Skip-on-flag · 2ª ejecución no toca nada · skipped=true · updated=0 ·
 *      split=0.
 *   3. Non-XML records · registros con origen!='xml_aeat' permanecen intactos.
 *   4. Casillas ya oficiales · registros con casillaAEAT='0426'/'0427' NO se
 *      tocan (respeta lo escrito por el servicio nuevo).
 *   5. Importes a 0 + RSUMAD · no se cuenta como update/split.
 *   6. Caso Jose 2024 · titular=1396.68 (>0) + empresa=1862.16 (>0) → split
 *      en 2 rows · suma preservada al céntimo.
 *   7. Idempotencia post-migración · aportacionExisteIdempotente del servicio
 *      canónico matchea correctamente los rows resultantes (rol 'titular' y
 *      rol 'empresa') · reimportación NO duplica importes.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('fixCasillaAEATOficial', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedAportacion(
    db: any,
    overrides: Partial<{
      id: string;
      planId: string;
      ejercicioFiscal: number;
      importeTitular: number;
      importeEmpresa: number;
      origen: 'manual' | 'xml_aeat' | 'nomina_vinculada' | 'migrado_v60';
      casillaAEAT: string;
    }> = {},
  ): Promise<void> {
    await db.put('aportacionesPlan', {
      id: overrides.id ?? 'ap-1',
      planId: overrides.planId ?? 'plan-1',
      fecha: '2024-12-31',
      ejercicioFiscal: overrides.ejercicioFiscal ?? 2024,
      importeTitular: overrides.importeTitular ?? 0,
      importeEmpresa: overrides.importeEmpresa ?? 0,
      origen: overrides.origen ?? 'xml_aeat',
      granularidad: 'anual',
      casillaAEAT: overrides.casillaAEAT ?? 'RSUMAD',
      fechaCreacion: '2026-04-01T00:00:00Z',
      fechaActualizacion: '2026-04-01T00:00:00Z',
    });
  }

  it('1 · update in-place (solo titular / solo empresa) + split (ambos) · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial, CASILLA_AEAT_OFICIAL_FLAG_KEY } =
      await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-solo-titular',
      planId: 'plan-a',
      importeTitular: 1500,
      importeEmpresa: 0,
    });
    await seedAportacion(db, {
      id: 'ap-solo-empresa',
      planId: 'plan-b',
      importeTitular: 0,
      importeEmpresa: 5000,
    });
    await seedAportacion(db, {
      id: 'ap-ambos',
      planId: 'plan-c',
      importeTitular: 1200,
      importeEmpresa: 1800,
    });

    const report = await fixCasillaAEATOficial();

    expect(report.skipped).toBe(false);
    expect(report.updated).toBe(2); // solo titular + solo empresa
    expect(report.split).toBe(1); // ap-ambos
    expect(report.errors).toEqual([]);

    // Updates in-place.
    const apTitular = await db.get('aportacionesPlan', 'ap-solo-titular');
    expect(apTitular.casillaAEAT).toBe('0426');
    expect(apTitular.importeTitular).toBe(1500);
    expect(apTitular.importeEmpresa).toBe(0);

    const apEmpresa = await db.get('aportacionesPlan', 'ap-solo-empresa');
    expect(apEmpresa.casillaAEAT).toBe('0427');
    expect(apEmpresa.importeEmpresa).toBe(5000);

    // Split · original retiene id y queda como '0426' con empresa=0.
    const apAmbosOriginal = await db.get('aportacionesPlan', 'ap-ambos');
    expect(apAmbosOriginal.casillaAEAT).toBe('0426');
    expect(apAmbosOriginal.importeTitular).toBe(1200);
    expect(apAmbosOriginal.importeEmpresa).toBe(0);

    // ... y un nuevo row de empresa para el mismo planId/ejercicio.
    const todos = (await db.getAll('aportacionesPlan')) as any[];
    const empresaRows = todos.filter(
      (a) => a.planId === 'plan-c' && a.casillaAEAT === '0427',
    );
    expect(empresaRows).toHaveLength(1);
    expect(empresaRows[0].id).not.toBe('ap-ambos');
    expect(empresaRows[0].importeTitular).toBe(0);
    expect(empresaRows[0].importeEmpresa).toBe(1800);
    expect(empresaRows[0].ejercicioFiscal).toBe(2024);
    expect(empresaRows[0].planId).toBe('plan-c');

    const flag = await db.get('keyval', CASILLA_AEAT_OFICIAL_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · skip-on-flag · 2ª ejecución no toca nada · skipped=true', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-1',
      importeTitular: 1500,
      importeEmpresa: 0,
    });

    const first = await fixCasillaAEATOficial();
    expect(first.skipped).toBe(false);
    expect(first.updated).toBe(1);
    expect(first.split).toBe(0);

    const second = await fixCasillaAEATOficial();
    expect(second.skipped).toBe(true);
    expect(second.updated).toBe(0);
    expect(second.split).toBe(0);

    const ap = await db.get('aportacionesPlan', 'ap-1');
    expect(ap.casillaAEAT).toBe('0426');
  });

  it('3 · non-XML records · permanecen intactos', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-manual',
      importeTitular: 1000,
      importeEmpresa: 0,
      origen: 'manual',
      casillaAEAT: 'RSUMAD', // valor improbable pero comprobamos que no se toca
    });
    await seedAportacion(db, {
      id: 'ap-nomina',
      importeTitular: 200,
      importeEmpresa: 100,
      origen: 'nomina_vinculada',
      casillaAEAT: 'RSUMAD',
    });

    const report = await fixCasillaAEATOficial();
    expect(report.updated).toBe(0);
    expect(report.split).toBe(0);

    expect((await db.get('aportacionesPlan', 'ap-manual')).casillaAEAT).toBe('RSUMAD');
    expect((await db.get('aportacionesPlan', 'ap-nomina')).casillaAEAT).toBe('RSUMAD');
  });

  it('4 · casillas oficiales pre-existentes · no se tocan', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-nuevo-servicio-0426',
      importeTitular: 1500,
      importeEmpresa: 0,
      origen: 'xml_aeat',
      casillaAEAT: '0426',
    });
    await seedAportacion(db, {
      id: 'ap-nuevo-servicio-0427',
      importeTitular: 0,
      importeEmpresa: 8000,
      origen: 'xml_aeat',
      casillaAEAT: '0427',
    });

    const report = await fixCasillaAEATOficial();
    expect(report.updated).toBe(0);
    expect(report.split).toBe(0);

    expect((await db.get('aportacionesPlan', 'ap-nuevo-servicio-0426')).casillaAEAT).toBe('0426');
    expect((await db.get('aportacionesPlan', 'ap-nuevo-servicio-0427')).casillaAEAT).toBe('0427');
  });

  it('5 · importes a 0 + RSUMAD · no se cuenta como update', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-cero',
      importeTitular: 0,
      importeEmpresa: 0,
      origen: 'xml_aeat',
      casillaAEAT: 'RSUMAD',
    });

    const report = await fixCasillaAEATOficial();
    expect(report.updated).toBe(0);
    expect(report.split).toBe(0);

    expect((await db.get('aportacionesPlan', 'ap-cero')).casillaAEAT).toBe('RSUMAD');
  });

  it('6 · caso Jose 2024 · titular=1396.68 + empresa=1862.16 → split 0426 + 0427 · suma preservada', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-jose-2024',
      planId: 'plan-ppe-orange',
      ejercicioFiscal: 2024,
      importeTitular: 1396.68,
      importeEmpresa: 1862.16,
      origen: 'xml_aeat',
      casillaAEAT: 'RSUMAD',
    });

    const report = await fixCasillaAEATOficial();
    expect(report.updated).toBe(0);
    expect(report.split).toBe(1);

    // Original retiene id · queda como 0426 con empresa=0.
    const original = await db.get('aportacionesPlan', 'ap-jose-2024');
    expect(original.casillaAEAT).toBe('0426');
    expect(original.importeTitular).toBe(1396.68);
    expect(original.importeEmpresa).toBe(0);

    // Nuevo row 0427 con empresa íntegra.
    const todos = (await db.getAll('aportacionesPlan')) as any[];
    const nuevoEmpresa = todos.find(
      (a) => a.planId === 'plan-ppe-orange' && a.casillaAEAT === '0427',
    );
    expect(nuevoEmpresa).toBeDefined();
    expect(nuevoEmpresa.importeTitular).toBe(0);
    expect(nuevoEmpresa.importeEmpresa).toBe(1862.16);
    expect(nuevoEmpresa.id).not.toBe('ap-jose-2024');

    // Invariante de suma preservado al céntimo.
    const sumaTitular = todos.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const sumaEmpresa = todos.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    expect(sumaTitular).toBeCloseTo(1396.68, 2);
    expect(sumaEmpresa).toBeCloseTo(1862.16, 2);
    expect(sumaTitular + sumaEmpresa).toBeCloseTo(3258.84, 2);
  });

  it('7 · idempotencia post-migración · reimport XML no duplica importes', async () => {
    // Caso end-to-end · primero migración (split del combinado) · luego
    // reimport XML para el mismo plan/ejercicio · servicio canónico debe
    // detectar idempotencia y NO crear duplicados.
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();

    // Seed · plan PPE preexistente con CIF Orange.
    const ahora = new Date().toISOString();
    await (db as any).add('planesPensiones', {
      id: 'plan-ppe-orange',
      nombre: 'Plan PPE Orange',
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPE',
      subtipoPPE: 'empleador_unico',
      empresaPagadora: { cif: 'A82009812', nombre: 'Orange' },
      gestoraActual: 'Orange',
      fechaContratacion: '2020-01-01',
      estado: 'activo',
      origen: 'manual',
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
    });

    // Registro legacy combinado escrito por el bloque viejo.
    await seedAportacion(db, {
      id: 'ap-jose-2024-legacy',
      planId: 'plan-ppe-orange',
      ejercicioFiscal: 2024,
      importeTitular: 1396.68,
      importeEmpresa: 1862.16,
      origen: 'xml_aeat',
      casillaAEAT: 'RSUMAD',
    });

    // Migración divide en 2.
    await fixCasillaAEATOficial();

    // Reimport del mismo XML 2024 vía servicio canónico.
    const { importarAportacionesAEAT } = await import(
      '../../aeatPlanesPensionesImportService'
    );
    const r = await importarAportacionesAEAT({
      personalDataId: 1,
      titular: 'yo',
      ejercicio: 2024,
      aportacionesTrabajador: 1396.68,
      contribucionesEmpresariales: 1862.16,
      nifEmpleador: 'A82009812',
      nombreEmpleador: 'Orange',
    });

    // Servicio detecta idempotencia · NO crea aportaciones nuevas.
    expect(r.aportacionesCreadas).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes('ya importada previamente'))).toBe(true);

    // Sumas finales · siguen al céntimo · no hay duplicados.
    const aps = (await db.getAll('aportacionesPlan')) as any[];
    expect(aps).toHaveLength(2); // exactly 2 rows: el original 0426 y el split 0427
    const sumaTitular = aps.reduce((s, a) => s + (a.importeTitular ?? 0), 0);
    const sumaEmpresa = aps.reduce((s, a) => s + (a.importeEmpresa ?? 0), 0);
    expect(sumaTitular).toBeCloseTo(1396.68, 2);
    expect(sumaEmpresa).toBeCloseTo(1862.16, 2);
  });
});
