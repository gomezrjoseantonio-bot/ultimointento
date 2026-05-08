/**
 * PR-C4 · tests para `runV70NominaHistorialMigration`.
 *
 * Cubre los casos pedidos en review Copilot #1295:
 *   1. Crea `historial[0]` cuando falta · keyval flag escrito
 *   2. NO toca nóminas que ya tienen historial
 *   3. Idempotente · 2ª ejecución skipped
 *   4. Backfill respeta `fechaAntiguedad` cuando existe (fallback a fechaCreacion)
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

const MIGRATION_KEY = 'migration_v70_nomina_historial_v1';

// Plantilla mínima válida para crear un registro tipo='nomina' en `ingresos`.
function nominaRecord(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tipo: 'nomina',
    personalDataId: 1,
    titular: 'yo',
    nombre: 'Test',
    fechaAntiguedad: '2020-01-01',
    salarioBrutoAnual: 30000,
    distribucion: { tipo: 'doce', meses: 12 },
    variables: [],
    bonus: [],
    beneficiosSociales: [],
    retencion: {
      irpfPorcentaje: 15,
      ss: {
        baseCotizacionMensual: 4909.5,
        contingenciasComunes: 4.7,
        desempleo: 1.55,
        formacionProfesional: 0.1,
        mei: 0.13,
        overrideManual: false,
      },
    },
    deduccionesAdicionales: [],
    cuentaAbono: 1,
    reglaCobroDia: { tipo: 'fijo', dia: 28 },
    activa: true,
    fechaCreacion: '2024-01-01T00:00:00.000Z',
    fechaActualizacion: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('runV70NominaHistorialMigration · PR-C4', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('1 · crea historial[0] para nóminas sin historial · escribe flag · migrados=N', async () => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    await db.add('ingresos', nominaRecord({ salarioBrutoAnual: 30000 }) as any);
    await db.add('ingresos', nominaRecord({ salarioBrutoAnual: 42000 }) as any);

    const { runV70NominaHistorialMigration } = await import('../v70-nomina-historial');
    const report = await runV70NominaHistorialMigration();

    expect(report.skipped).toBe(false);
    expect(report.total).toBe(2);
    expect(report.migrados).toBe(2);
    expect(report.yaTenian).toBe(0);

    // Ambas nóminas tienen historial[0] con snapshot.salarioBrutoAnual correcto.
    const todas = await db.getAllFromIndex('ingresos', 'tipo', 'nomina');
    for (const n of todas as any[]) {
      expect(Array.isArray(n.historial)).toBe(true);
      expect(n.historial.length).toBe(1);
      expect(n.historial[0].snapshot.salarioBrutoAnual).toBe(n.salarioBrutoAnual);
      expect(n.historial[0].vigenciaDesde).toBe('2020-01-01');
      expect(typeof n.historial[0].id).toBe('string');
    }

    // Flag escrito.
    const flag = await db.get('keyval', MIGRATION_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · NO toca nóminas que ya tienen historial poblado', async () => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    const historialPrevio = [
      {
        id: 'h-existente',
        vigenciaDesde: '2025-04-01',
        motivo: 'Cambio previo',
        snapshot: { salarioBrutoAnual: 40000 },
        createdAt: '2025-04-01T00:00:00.000Z',
      },
    ];
    await db.add(
      'ingresos',
      nominaRecord({ salarioBrutoAnual: 40000, historial: historialPrevio }) as any,
    );

    const { runV70NominaHistorialMigration } = await import('../v70-nomina-historial');
    const report = await runV70NominaHistorialMigration();

    expect(report.skipped).toBe(false);
    expect(report.total).toBe(1);
    expect(report.migrados).toBe(0);
    expect(report.yaTenian).toBe(1);

    const todas = await db.getAllFromIndex('ingresos', 'tipo', 'nomina');
    expect((todas[0] as any).historial).toEqual(historialPrevio);
  });

  it('3 · idempotente · 2ª ejecución skipped=true · sin cambios', async () => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    await db.add('ingresos', nominaRecord({ salarioBrutoAnual: 30000 }) as any);

    const { runV70NominaHistorialMigration } = await import('../v70-nomina-historial');

    const r1 = await runV70NominaHistorialMigration();
    expect(r1.skipped).toBe(false);
    expect(r1.migrados).toBe(1);

    // Snapshot del historial tras 1ª ejecución.
    const tras1 = await db.getAllFromIndex('ingresos', 'tipo', 'nomina');
    const historialTras1 = (tras1[0] as any).historial;

    const r2 = await runV70NominaHistorialMigration();
    expect(r2.skipped).toBe(true);
    // total/migrados quedan en 0 porque sale temprano por el flag.
    expect(r2.migrados).toBe(0);

    // El historial NO se duplica ni se modifica.
    const tras2 = await db.getAllFromIndex('ingresos', 'tipo', 'nomina');
    expect((tras2[0] as any).historial).toEqual(historialTras1);
  });

  it('4 · vigenciaDesde fallback a fechaCreacion cuando no hay fechaAntiguedad', async () => {
    const { initDB } = await import('../../db');
    const db = await initDB();
    // fechaAntiguedad ausente · debe caer a fechaCreacion.
    await db.add(
      'ingresos',
      nominaRecord({ salarioBrutoAnual: 30000, fechaAntiguedad: undefined }) as any,
    );

    const { runV70NominaHistorialMigration } = await import('../v70-nomina-historial');
    await runV70NominaHistorialMigration();

    const todas = await db.getAllFromIndex('ingresos', 'tipo', 'nomina');
    expect((todas[0] as any).historial[0].vigenciaDesde).toBe('2024-01-01');
  });
});
