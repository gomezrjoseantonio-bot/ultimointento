/**
 * Tests · backfillAportacionesNotas (Pulido T13 v4 final · issue 5).
 *
 * Casos cubiertos ·
 *   1. Backfill · casilla 0426 → "partícipe", 0427 → "empresa", 0426/0427 →
 *      combinadas. Flag escrito. skipped=false.
 *   2. Skip-on-flag · 2ª ejecución no toca nada.
 *   3. NO toca registros con notas ya presentes (idempotente).
 *   4. NO toca registros con origen != 'xml_aeat'.
 *   5. Casilla desconocida o vacía → nota genérica "XML AEAT".
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('backfillAportacionesNotas', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedAportacion(
    db: any,
    overrides: Partial<{
      id: string;
      ejercicioFiscal: number;
      casillaAEAT: string | undefined;
      origen: 'manual' | 'xml_aeat' | 'nomina_vinculada' | 'migrado_v60';
      notas: string | undefined;
    }> = {},
  ): Promise<void> {
    await db.put('aportacionesPlan', {
      id: overrides.id ?? 'ap-1',
      planId: 'plan-1',
      fecha: '2023-12-31',
      ejercicioFiscal: overrides.ejercicioFiscal ?? 2023,
      importeTitular: 1000,
      importeEmpresa: 0,
      origen: overrides.origen ?? 'xml_aeat',
      granularidad: 'anual',
      casillaAEAT: overrides.casillaAEAT,
      notas: overrides.notas,
      fechaCreacion: '2024-01-01T00:00:00Z',
      fechaActualizacion: '2024-01-01T00:00:00Z',
    });
  }

  it('1 · genera notas por casilla · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { backfillAportacionesNotas, APORTACIONES_NOTAS_BACKFILL_FLAG_KEY } =
      await import('../backfillAportacionesNotas');
    const db = await initDB();

    await seedAportacion(db, { id: 'ap-0426', ejercicioFiscal: 2023, casillaAEAT: '0426' });
    await seedAportacion(db, { id: 'ap-0427', ejercicioFiscal: 2023, casillaAEAT: '0427' });
    await seedAportacion(db, { id: 'ap-combo', ejercicioFiscal: 2024, casillaAEAT: '0426/0427' });

    const r = await backfillAportacionesNotas();
    expect(r.skipped).toBe(false);
    expect(r.updated).toBe(3);
    expect(r.errors).toEqual([]);

    const dbAfter = await initDB();
    const ap0426 = await dbAfter.get('aportacionesPlan', 'ap-0426');
    expect(ap0426?.notas).toBe('Importado de declaración IRPF 2023 (casilla 0426 · partícipe)');
    const ap0427 = await dbAfter.get('aportacionesPlan', 'ap-0427');
    expect(ap0427?.notas).toBe('Importado de declaración IRPF 2023 (casilla 0427 · empresa)');
    const apCombo = await dbAfter.get('aportacionesPlan', 'ap-combo');
    expect(apCombo?.notas).toBe('Importado de declaración IRPF 2024 (casillas 0426+0427)');

    const flag = await dbAfter.get('keyval', APORTACIONES_NOTAS_BACKFILL_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · skip-on-flag · 2ª ejecución no toca nada', async () => {
    const { initDB } = await import('../../db');
    const { backfillAportacionesNotas, APORTACIONES_NOTAS_BACKFILL_FLAG_KEY } =
      await import('../backfillAportacionesNotas');
    const db = await initDB();
    await db.put('keyval', 'completed', APORTACIONES_NOTAS_BACKFILL_FLAG_KEY);
    await seedAportacion(db, { id: 'ap-1', casillaAEAT: '0426' });

    const r = await backfillAportacionesNotas();
    expect(r.skipped).toBe(true);
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    const ap = await dbAfter.get('aportacionesPlan', 'ap-1');
    expect(ap?.notas).toBeUndefined();
  });

  it('3 · NO toca registros con notas ya presentes', async () => {
    const { initDB } = await import('../../db');
    const { backfillAportacionesNotas } = await import('../backfillAportacionesNotas');
    const db = await initDB();
    await seedAportacion(db, { id: 'ap-con-nota', casillaAEAT: '0426', notas: 'Nota manual existente' });
    await seedAportacion(db, { id: 'ap-sin-nota', casillaAEAT: '0427' });

    const r = await backfillAportacionesNotas();
    expect(r.updated).toBe(1); // solo ap-sin-nota

    const dbAfter = await initDB();
    expect((await dbAfter.get('aportacionesPlan', 'ap-con-nota'))?.notas).toBe('Nota manual existente');
    expect((await dbAfter.get('aportacionesPlan', 'ap-sin-nota'))?.notas).toContain('0427');
  });

  it('4 · NO toca registros con origen != xml_aeat', async () => {
    const { initDB } = await import('../../db');
    const { backfillAportacionesNotas } = await import('../backfillAportacionesNotas');
    const db = await initDB();
    await seedAportacion(db, { id: 'ap-manual', casillaAEAT: '0426', origen: 'manual' });
    await seedAportacion(db, { id: 'ap-mig', casillaAEAT: '0426', origen: 'migrado_v60' });

    const r = await backfillAportacionesNotas();
    expect(r.updated).toBe(0);

    const dbAfter = await initDB();
    expect((await dbAfter.get('aportacionesPlan', 'ap-manual'))?.notas).toBeUndefined();
    expect((await dbAfter.get('aportacionesPlan', 'ap-mig'))?.notas).toBeUndefined();
  });

  it('5 · casilla desconocida o vacía · nota genérica', async () => {
    const { initDB } = await import('../../db');
    const { backfillAportacionesNotas } = await import('../backfillAportacionesNotas');
    const db = await initDB();
    await seedAportacion(db, { id: 'ap-vacia', ejercicioFiscal: 2022, casillaAEAT: undefined });
    await seedAportacion(db, { id: 'ap-rara', ejercicioFiscal: 2022, casillaAEAT: 'XYZ' });

    const r = await backfillAportacionesNotas();
    expect(r.updated).toBe(2);

    const dbAfter = await initDB();
    expect((await dbAfter.get('aportacionesPlan', 'ap-vacia'))?.notas)
      .toBe('Importado de declaración IRPF 2022 (XML AEAT)');
    expect((await dbAfter.get('aportacionesPlan', 'ap-rara'))?.notas)
      .toBe('Importado de declaración IRPF 2022 (XML AEAT)');
  });
});
