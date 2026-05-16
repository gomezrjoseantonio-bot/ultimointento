/**
 * Tests · fixCasillaAEATOficial (TAREA 13 v4 · Acción 1 · D6).
 *
 * Casos cubiertos ·
 *   1. Update · registros con origen='xml_aeat' y casillaAEAT='RSUMAD' se
 *      reescriben a '0426' (solo titular) / '0427' (solo empresa) / '0426/0427'
 *      (ambos) · flag escrito · skipped=false.
 *   2. Skip-on-flag · 2ª ejecución no toca nada · skipped=true · updated=0.
 *   3. Non-XML records · registros con origen!='xml_aeat' permanecen intactos.
 *   4. Casillas ya oficiales · registros con casillaAEAT='0426'/'0427' NO se
 *      tocan (respeta lo escrito por el servicio nuevo).
 *   5. Importes a 0 + RSUMAD · no se cuenta como update.
 *   6. Caso Jose 2024 · titular=1396.68 (>0) + empresa=1862.16 (>0) →
 *      casillaAEAT='0426/0427'.
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

  it('1 · update · RSUMAD → 0426/0427/0426+0427 según importes · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial, CASILLA_AEAT_OFICIAL_FLAG_KEY } =
      await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-solo-titular',
      importeTitular: 1500,
      importeEmpresa: 0,
    });
    await seedAportacion(db, {
      id: 'ap-solo-empresa',
      importeTitular: 0,
      importeEmpresa: 5000,
    });
    await seedAportacion(db, {
      id: 'ap-ambos',
      importeTitular: 1200,
      importeEmpresa: 1800,
    });

    const report = await fixCasillaAEATOficial();

    expect(report.skipped).toBe(false);
    expect(report.updated).toBe(3);
    expect(report.errors).toEqual([]);

    expect((await db.get('aportacionesPlan', 'ap-solo-titular')).casillaAEAT).toBe('0426');
    expect((await db.get('aportacionesPlan', 'ap-solo-empresa')).casillaAEAT).toBe('0427');
    expect((await db.get('aportacionesPlan', 'ap-ambos')).casillaAEAT).toBe('0426/0427');

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

    const second = await fixCasillaAEATOficial();
    expect(second.skipped).toBe(true);
    expect(second.updated).toBe(0);

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

    expect((await db.get('aportacionesPlan', 'ap-cero')).casillaAEAT).toBe('RSUMAD');
  });

  it('6 · caso Jose 2024 · titular=1396.68 + empresa=1862.16 → 0426/0427', async () => {
    const { initDB } = await import('../../db');
    const { fixCasillaAEATOficial } = await import('../fixCasillaAEATOficial');

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-jose-2024',
      ejercicioFiscal: 2024,
      importeTitular: 1396.68,
      importeEmpresa: 1862.16,
      origen: 'xml_aeat',
      casillaAEAT: 'RSUMAD',
    });

    const report = await fixCasillaAEATOficial();
    expect(report.updated).toBe(1);

    const after = await db.get('aportacionesPlan', 'ap-jose-2024');
    expect(after.casillaAEAT).toBe('0426/0427');
    // Importes intactos (la migración NO toca importes).
    expect(after.importeTitular).toBe(1396.68);
    expect(after.importeEmpresa).toBe(1862.16);
  });
});
