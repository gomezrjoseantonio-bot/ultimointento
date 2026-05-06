// ============================================================================
// T34/T35-fix-2 · Tests · helper buildCategoriaPersonal + cleanup migration
// ============================================================================
//
// Cubre los 6 casos del spec §2.3:
//   1. buildCategoriaPersonal('dia_a_dia', 'otros') → 'dia_a_dia.otros'
//   2. buildCategoriaPersonal('seguros_cuotas', 'seguro_otros') → 'seguros_cuotas.seguro_otros'
//   3. buildCategoriaPersonal('vivienda', 'suministros') → 'vivienda.suministros' (sin regresión)
//   4. cleanup migra 'otros.otros' (tipoFamilia=dia_a_dia) → 'dia_a_dia.otros'
//   5. cleanup idempotente · 2ª ejecución no toca nada (skipped=true)
//   6. cleanup NO toca registros con categoría coherente
// ============================================================================

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('T34/T35-fix-2 · helper buildCategoriaPersonal', () => {
  it('1 · dia_a_dia + otros → dia_a_dia.otros (NO otros.otros)', async () => {
    const { buildCategoriaPersonal } = await import(
      '../../../modules/personal/wizards/utils/familyMapping'
    );
    expect(buildCategoriaPersonal('dia_a_dia', 'otros')).toBe('dia_a_dia.otros');
  });

  it('2 · seguros_cuotas + seguro_otros → seguros_cuotas.seguro_otros (NO otros.seguro_otros)', async () => {
    const { buildCategoriaPersonal } = await import(
      '../../../modules/personal/wizards/utils/familyMapping'
    );
    expect(buildCategoriaPersonal('seguros_cuotas', 'seguro_otros')).toBe(
      'seguros_cuotas.seguro_otros',
    );
  });

  it('3 · vivienda + suministros → vivienda.suministros (sin regresión)', async () => {
    const { buildCategoriaPersonal } = await import(
      '../../../modules/personal/wizards/utils/familyMapping'
    );
    expect(buildCategoriaPersonal('vivienda', 'suministros')).toBe(
      'vivienda.suministros',
    );
  });
});

describe('T34/T35-fix-2 · cleanupCategoriasT34T35Fix2', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedCompromiso(
    db: any,
    overrides: Partial<{
      ambito: 'personal' | 'inmueble';
      alias: string;
      tipo: string;
      subtipo: string;
      tipoFamilia: string;
      categoria: string;
    }>,
  ): Promise<number> {
    const base = {
      ambito: 'personal' as const,
      personalDataId: 1,
      alias: 'Compromiso test',
      tipo: 'otros',
      subtipo: 'otros',
      tipoFamilia: 'otros',
      categoria: 'otros.otros',
      proveedor: { nombre: 'Test' },
      patron: { tipo: 'mensualDiaFijo', dia: 1 },
      importe: { modo: 'fijo', importe: 10 },
      variacion: { tipo: 'sinVariacion' },
      cuentaCargo: 1,
      conceptoBancario: 'TEST',
      metodoPago: 'domiciliacion',
      bolsaPresupuesto: 'necesidades',
      responsable: 'titular',
      fechaInicio: '2026-01-01',
      estado: 'activo',
      derivadoDe: { fuente: 'manual' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
    return await db.add('compromisosRecurrentes', base);
  }

  it('4 · cleanup migra otros.otros (tipoFamilia=dia_a_dia, subtipo=otros) → dia_a_dia.otros', async () => {
    const { initDB } = await import('../../db');
    const { cleanupCategoriasT34T35Fix2, T34_T35_FIX2_FLAG_KEY } = await import(
      '../cleanupCategoriasT34T35fix2'
    );

    const db = await initDB();
    const id = await seedCompromiso(db, {
      alias: 'Día a día · Otros',
      tipo: 'otros',
      subtipo: 'otros',
      tipoFamilia: 'dia_a_dia',
      categoria: 'otros.otros',
    });

    const idSeguros = await seedCompromiso(db, {
      alias: 'Segurcaixa',
      tipo: 'seguro',
      subtipo: 'seguro_otros',
      tipoFamilia: 'seguros_cuotas',
      categoria: 'otros.seguro_otros',
    });

    const report = await cleanupCategoriasT34T35Fix2();

    expect(report.skipped).toBe(false);
    expect(report.caso1Corregidos).toBe(1);
    expect(report.caso2Corregidos).toBe(1);
    expect(report.errors).toEqual([]);

    const c1 = await db.get('compromisosRecurrentes', id);
    expect(c1?.categoria).toBe('dia_a_dia.otros');

    const c2 = await db.get('compromisosRecurrentes', idSeguros);
    expect(c2?.categoria).toBe('seguros_cuotas.seguro_otros');

    const flag = await db.get('keyval', T34_T35_FIX2_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('5 · idempotente · 2ª ejecución skip silencioso · no toca nada', async () => {
    const { initDB } = await import('../../db');
    const { cleanupCategoriasT34T35Fix2 } = await import(
      '../cleanupCategoriasT34T35fix2'
    );

    const db = await initDB();
    const id = await seedCompromiso(db, {
      alias: 'Día a día · Otros',
      subtipo: 'otros',
      tipoFamilia: 'dia_a_dia',
      categoria: 'otros.otros',
    });

    const first = await cleanupCategoriasT34T35Fix2();
    expect(first.skipped).toBe(false);
    expect(first.caso1Corregidos).toBe(1);

    // Re-introducir un registro con el patrón buggy DESPUÉS del primer run.
    // El cleanup debe hacer skip (flag presente) y NO tocarlo.
    const idNuevo = await seedCompromiso(db, {
      alias: 'Día a día · Otros (post-cleanup)',
      subtipo: 'otros',
      tipoFamilia: 'dia_a_dia',
      categoria: 'otros.otros',
    });

    const second = await cleanupCategoriasT34T35Fix2();
    expect(second.skipped).toBe(true);
    expect(second.caso1Corregidos).toBe(0);
    expect(second.caso2Corregidos).toBe(0);
    expect(second.errors).toEqual([]);

    // Primer registro · ya corregido en run 1 · sigue OK
    const c1 = await db.get('compromisosRecurrentes', id);
    expect(c1?.categoria).toBe('dia_a_dia.otros');

    // Segundo registro · sembrado tras flag · NO se toca (idempotencia estricta)
    const c2 = await db.get('compromisosRecurrentes', idNuevo);
    expect(c2?.categoria).toBe('otros.otros');
  });

  it('6 · NO toca registros con categoría coherente ni patrones fuera del alcance', async () => {
    const { initDB } = await import('../../db');
    const { cleanupCategoriasT34T35Fix2 } = await import(
      '../cleanupCategoriasT34T35fix2'
    );

    const db = await initDB();

    // Categoría coherente · no debe tocarse
    const idVivienda = await seedCompromiso(db, {
      alias: 'Luz',
      tipo: 'suministro',
      subtipo: 'luz',
      tipoFamilia: 'suministros',
      categoria: 'suministros.luz',
    });

    // categoria=otros.otros pero tipoFamilia='otros' (legítimo "otros · otros")
    const idOtrosLeg = await seedCompromiso(db, {
      alias: 'Otros legítimo',
      tipo: 'otros',
      subtipo: 'otros',
      tipoFamilia: 'otros',
      categoria: 'otros.otros',
    });

    // categoria=otros.foo · subtipo distinto · fuera del alcance documentado
    const idFuera = await seedCompromiso(db, {
      alias: 'Caso 3 sospechoso',
      tipo: 'otros',
      subtipo: 'gimnasio',
      tipoFamilia: 'seguros_cuotas',
      categoria: 'otros.gimnasio',
    });

    const report = await cleanupCategoriasT34T35Fix2();

    expect(report.skipped).toBe(false);
    expect(report.caso1Corregidos).toBe(0);
    expect(report.caso2Corregidos).toBe(0);

    const v = await db.get('compromisosRecurrentes', idVivienda);
    expect(v?.categoria).toBe('suministros.luz');

    const o = await db.get('compromisosRecurrentes', idOtrosLeg);
    expect(o?.categoria).toBe('otros.otros');

    const f = await db.get('compromisosRecurrentes', idFuera);
    expect(f?.categoria).toBe('otros.gimnasio');
  });
});
