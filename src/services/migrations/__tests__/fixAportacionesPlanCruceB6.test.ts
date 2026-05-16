/**
 * Tests · fixAportacionesPlanCruceB6 (FIX-B6).
 *
 * Casos cubiertos ·
 *   1. Swap · registros con origen='xml_aeat' invierten importeTitular ↔
 *      importeEmpresa · flag escrito · skipped=false.
 *   2. Skip-on-flag · 2ª ejecución no toca nada · skipped=true · swapped=0.
 *   3. Non-XML records · registros con origen!='xml_aeat' permanecen
 *      intactos.
 *   4. Caso Jose 2024 · titular=1862.16, empresa=1396.68 → titular=1396.68,
 *      empresa=1862.16 · invariante de suma se mantiene (3258.84).
 *   5. Ambos importes a 0 · no se cuenta como swap (no-op por registro
 *      pero el flag igualmente se escribe).
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('fixAportacionesPlanCruceB6', () => {
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
      origen: 'manual' | 'xml_aeat' | 'nomina' | 'indexa' | 'migrado_v60';
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
      casillaAEAT: 'RSUMAD',
      fechaCreacion: '2026-04-01T00:00:00Z',
      fechaActualizacion: '2026-04-01T00:00:00Z',
    });
  }

  it('1 · swap · registros xml_aeat invierten titular ↔ empresa · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixAportacionesPlanCruceB6, B6_MIGRATION_FLAG_KEY } = await import(
      '../fixAportacionesPlanCruceB6'
    );

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-jose-2024',
      importeTitular: 1862.16,
      importeEmpresa: 1396.68,
      origen: 'xml_aeat',
    });

    const report = await fixAportacionesPlanCruceB6();

    expect(report.skipped).toBe(false);
    expect(report.swapped).toBe(1);
    expect(report.errors).toEqual([]);

    const after = await db.get('aportacionesPlan', 'ap-jose-2024');
    expect(after.importeTitular).toBe(1396.68);
    expect(after.importeEmpresa).toBe(1862.16);
    // Invariante de suma · total = titular + empresa preservado.
    expect(after.importeTitular + after.importeEmpresa).toBeCloseTo(3258.84, 2);

    const flag = await db.get('keyval', B6_MIGRATION_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · skip-on-flag · 2ª ejecución no toca nada · skipped=true', async () => {
    const { initDB } = await import('../../db');
    const { fixAportacionesPlanCruceB6 } = await import(
      '../fixAportacionesPlanCruceB6'
    );

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-1',
      importeTitular: 1862.16,
      importeEmpresa: 1396.68,
      origen: 'xml_aeat',
    });

    const first = await fixAportacionesPlanCruceB6();
    expect(first.skipped).toBe(false);
    expect(first.swapped).toBe(1);

    // Tras el 1.º run, los valores quedaron volteados. Un 2.º run NO debe
    // volverlos a invertir (eso reintroduciría el bug).
    const second = await fixAportacionesPlanCruceB6();
    expect(second.skipped).toBe(true);
    expect(second.swapped).toBe(0);
    expect(second.errors).toEqual([]);

    const after = await db.get('aportacionesPlan', 'ap-1');
    expect(after.importeTitular).toBe(1396.68);
    expect(after.importeEmpresa).toBe(1862.16);
  });

  it('3 · registros origen!=xml_aeat permanecen intactos', async () => {
    const { initDB } = await import('../../db');
    const { fixAportacionesPlanCruceB6 } = await import(
      '../fixAportacionesPlanCruceB6'
    );

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-xml',
      importeTitular: 100,
      importeEmpresa: 200,
      origen: 'xml_aeat',
    });
    await seedAportacion(db, {
      id: 'ap-manual',
      importeTitular: 500,
      importeEmpresa: 700,
      origen: 'manual',
    });
    await seedAportacion(db, {
      id: 'ap-nomina',
      importeTitular: 1000,
      importeEmpresa: 0,
      origen: 'nomina' as any,
    });

    const report = await fixAportacionesPlanCruceB6();

    expect(report.swapped).toBe(1);
    expect(report.errors).toEqual([]);

    const xml = await db.get('aportacionesPlan', 'ap-xml');
    expect(xml.importeTitular).toBe(200);
    expect(xml.importeEmpresa).toBe(100);

    const manual = await db.get('aportacionesPlan', 'ap-manual');
    expect(manual.importeTitular).toBe(500);
    expect(manual.importeEmpresa).toBe(700);

    const nomina = await db.get('aportacionesPlan', 'ap-nomina');
    expect(nomina.importeTitular).toBe(1000);
    expect(nomina.importeEmpresa).toBe(0);
  });

  it('4 · varios registros xml_aeat de distintos ejercicios · todos volteados', async () => {
    const { initDB } = await import('../../db');
    const { fixAportacionesPlanCruceB6 } = await import(
      '../fixAportacionesPlanCruceB6'
    );

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-2022',
      ejercicioFiscal: 2022,
      importeTitular: 1708.8,
      importeEmpresa: 1391.2,
      origen: 'xml_aeat',
    });
    await seedAportacion(db, {
      id: 'ap-2023',
      ejercicioFiscal: 2023,
      importeTitular: 1806.24,
      importeEmpresa: 1452.6,
      origen: 'xml_aeat',
    });
    await seedAportacion(db, {
      id: 'ap-2024',
      ejercicioFiscal: 2024,
      importeTitular: 1862.16,
      importeEmpresa: 1396.68,
      origen: 'xml_aeat',
    });

    const report = await fixAportacionesPlanCruceB6();
    expect(report.swapped).toBe(3);

    const a2022 = await db.get('aportacionesPlan', 'ap-2022');
    expect(a2022.importeTitular).toBe(1391.2);
    expect(a2022.importeEmpresa).toBe(1708.8);

    const a2023 = await db.get('aportacionesPlan', 'ap-2023');
    expect(a2023.importeTitular).toBe(1452.6);
    expect(a2023.importeEmpresa).toBe(1806.24);

    const a2024 = await db.get('aportacionesPlan', 'ap-2024');
    expect(a2024.importeTitular).toBe(1396.68);
    expect(a2024.importeEmpresa).toBe(1862.16);
  });

  it('5 · ambos importes a 0 · no cuenta como swap · flag igualmente escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixAportacionesPlanCruceB6, B6_MIGRATION_FLAG_KEY } = await import(
      '../fixAportacionesPlanCruceB6'
    );

    const db = await initDB();
    await seedAportacion(db, {
      id: 'ap-zero',
      importeTitular: 0,
      importeEmpresa: 0,
      origen: 'xml_aeat',
    });

    const report = await fixAportacionesPlanCruceB6();
    expect(report.skipped).toBe(false);
    expect(report.swapped).toBe(0);
    expect(report.errors).toEqual([]);

    const flag = await db.get('keyval', B6_MIGRATION_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('6 · DB vacía · skipped=false · swapped=0 · flag escrito', async () => {
    const { initDB } = await import('../../db');
    const { fixAportacionesPlanCruceB6, B6_MIGRATION_FLAG_KEY } = await import(
      '../fixAportacionesPlanCruceB6'
    );

    const db = await initDB();

    const report = await fixAportacionesPlanCruceB6();
    expect(report.skipped).toBe(false);
    expect(report.swapped).toBe(0);
    expect(report.errors).toEqual([]);

    const flag = await db.get('keyval', B6_MIGRATION_FLAG_KEY);
    expect(flag).toBe('completed');
  });
});
