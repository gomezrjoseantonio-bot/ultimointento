// ============================================================================
// PR-C4 · Migración V70 · historial inicial en Nomina
// ============================================================================
//
// Crea una entrada inicial en `Nomina.historial` para todos los registros
// existentes en `ingresos` con `tipo='nomina'` que NO tengan `historial`
// o lo tengan vacío. La entrada captura los valores retributivos vigentes
// con `vigenciaDesde = fechaAntiguedad ?? fechaCreacion` (fallback
// '1970-01-01' si ambos son null).
//
// Idempotente: keyval 'migration_v70_nomina_historial_v1'.
// No destructiva: campos top-level se mantienen intactos.
//
// Patrón calcado de `v68-tipoFamilia.ts` para coherencia con el resto
// del proyecto.
// ============================================================================

import { initDB } from '../db';
import type { Nomina, NominaHistorialEntry, NominaRetributivoSnapshot } from '../../types/personal';

const MIGRATION_KEY = 'migration_v70_nomina_historial_v1';
const BATCH_SIZE = 100;

export interface V70MigrationReport {
  total: number;
  migrados: number;
  yaTenian: number;
  skipped: boolean;
}

const genId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Construye el snapshot retributivo a partir del estado actual de la nómina.
 * Solo incluye campos que NO sean undefined para evitar persistir
 * `undefined` explícito en IndexedDB.
 */
function buildSnapshotFromTopLevel(n: Nomina): NominaRetributivoSnapshot {
  const snap: NominaRetributivoSnapshot = {
    salarioBrutoAnual: n.salarioBrutoAnual,
  };
  if (n.variables !== undefined) snap.variables = n.variables;
  if (n.bonus !== undefined) snap.bonus = n.bonus;
  if (n.pagasExtra !== undefined) snap.pagasExtra = n.pagasExtra;
  if (n.variableObjetivo !== undefined) snap.variableObjetivo = n.variableObjetivo;
  if (n.bonusObjetivo !== undefined) snap.bonusObjetivo = n.bonusObjetivo;
  if (n.retribucionEspecieAnual !== undefined) snap.retribucionEspecieAnual = n.retribucionEspecieAnual;
  if (n.aportacionEmpresaPlanPensionesAnual !== undefined) {
    snap.aportacionEmpresaPlanPensionesAnual = n.aportacionEmpresaPlanPensionesAnual;
  }
  if (n.planPensiones !== undefined) snap.planPensiones = n.planPensiones;
  return snap;
}

export async function runV70NominaHistorialMigration(): Promise<V70MigrationReport> {
  const report: V70MigrationReport = {
    total: 0,
    migrados: 0,
    yaTenian: 0,
    skipped: false,
  };

  try {
    const db = await initDB();

    // Idempotencia: si ya se ejecutó, salir
    const status = await db.get('keyval', MIGRATION_KEY);
    if (status === 'completed') {
      report.skipped = true;
      return report;
    }

    // Cargar todas las nóminas (registros con tipo='nomina' en `ingresos`).
    const ingresosNomina = await db.getAllFromIndex('ingresos', 'tipo', 'nomina');
    const nominas = (ingresosNomina ?? []) as Nomina[];
    report.total = nominas.length;

    // Filtrar las que aún no tienen historial poblado.
    const sinHistorial = nominas.filter((n) => !n.historial || n.historial.length === 0);
    report.yaTenian = nominas.length - sinHistorial.length;

    if (sinHistorial.length === 0) {
      await db.put('keyval', 'completed', MIGRATION_KEY);
      // eslint-disable-next-line no-console
      console.info('[PR-C4 migration v70]', { ...report, skipped: false });
      return report;
    }

    const ahora = new Date().toISOString();

    for (let i = 0; i < sinHistorial.length; i += BATCH_SIZE) {
      const lote = sinHistorial.slice(i, i + BATCH_SIZE);

      for (const n of lote) {
        if (n.id == null) continue;
        const vigenciaDesdeRaw =
          n.fechaAntiguedad ??
          n.fechaCreacion ??
          '1970-01-01';
        const vigenciaDesde = vigenciaDesdeRaw.slice(0, 10);

        const entrada: NominaHistorialEntry = {
          id: genId(),
          vigenciaDesde,
          motivo: 'Snapshot inicial (migración V70)',
          snapshot: buildSnapshotFromTopLevel(n),
          createdAt: ahora,
        };

        const updated: Nomina = {
          ...n,
          historial: [entrada],
        };

        await db.put('ingresos', updated as any);
        report.migrados++;
      }

      if (sinHistorial.length > BATCH_SIZE) {
        // Cede event loop entre lotes para no bloquear UI en arranques con
        // muchas nóminas (caso poco frecuente · 1-3 nóminas típico).
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    await db.put('keyval', 'completed', MIGRATION_KEY);
    // eslint-disable-next-line no-console
    console.info('[PR-C4 migration v70]', report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PR-C4 migration v70] ERROR · sin completar', err);
    // No marcamos como completed: re-intentará en próximo arranque.
  }

  return report;
}
