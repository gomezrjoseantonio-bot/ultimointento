// ============================================================================
// T-VALORACIONES PR4 · Seed migración planes pensiones + inversiones
// ============================================================================
//
// Para cada activo en los stores `planesPensiones` (V65) y `inversiones` que
// tenga un campo legacy de valoración, crea una entrada en
// `valoracionesActivos` (store nuevo · v74) con `origen: 'seed_legacy_field_v74'`.
//
// Reglas:
// - `planesPensiones.valorActual` → tipoActivo='plan_pensiones'
// - `inversiones.valor_actual` → tipoActivo='inversion' o 'plan_pensiones' o
//   'deposito' según `inversiones.tipo`; subtipoInversion inferido si aplica
// - Fecha · `fechaUltimaValoracion` (plan) o `fecha_valoracion` (inversion)
//   o `today` (fallback)
// - Inversiones/planes sin valor finito > 0 · se saltan con warning
// - Si el activo ya tiene una valoración en `valoracionesActivos`, se salta
//   (no duplicamos · respeta lo que pudo importar Jose manualmente)
//
// Idempotente vía keyval `migration_v74_pr4_seed_done`. Se ejecuta UNA sola
// vez al arrancar la app post-merge.
//
// Snapshot pre-seed en `localStorage['atlas_seed_v74_pr4_snapshot']` para
// poder recuperar manualmente si algo va mal.

import { initDB } from '../db';
import { bulkInsert } from '../valoracionesService';
import type {
  ValoracionInput,
  SubtipoInversion,
  TipoActivoValoracion,
} from '../../types/valoracionActivo';

const MIGRATION_KEY = 'migration_v74_pr4_seed_done';
const SNAPSHOT_KEY = 'atlas_seed_v74_pr4_snapshot';

export interface SeedV74PR4Report {
  planesTotal: number;
  planesSeeded: number;
  planesSkippedSinValor: number;
  planesSkippedYaTienen: number;
  inversionesTotal: number;
  inversionesSeeded: number;
  inversionesSkippedSinValor: number;
  inversionesSkippedYaTienen: number;
  skipped: boolean;
}

/**
 * Mapea `inversiones.tipo` → (tipoActivo, subtipoInversion) en el schema v2.
 *
 * - accion, reit → inversion · accion
 * - etf → inversion · etf
 * - fondo_inversion → inversion · fondo
 * - crypto → inversion · crypto
 * - cuenta_remunerada, prestamo_p2p → inversion · sin subtipo
 * - deposito, deposito_plazo → deposito
 * - plan_pensiones, plan_empleo → plan_pensiones (legacy en inversiones)
 * - otro → otro
 */
export function mapInversionTipo(tipo: string): {
  tipoActivo: TipoActivoValoracion;
  subtipoInversion?: SubtipoInversion;
} {
  switch (tipo) {
    case 'accion':
    case 'reit':
      return { tipoActivo: 'inversion', subtipoInversion: 'accion' };
    case 'etf':
      return { tipoActivo: 'inversion', subtipoInversion: 'etf' };
    case 'fondo_inversion':
      return { tipoActivo: 'inversion', subtipoInversion: 'fondo' };
    case 'crypto':
      return { tipoActivo: 'inversion', subtipoInversion: 'crypto' };
    case 'cuenta_remunerada':
    case 'prestamo_p2p':
      return { tipoActivo: 'inversion' };
    case 'deposito':
    case 'deposito_plazo':
      return { tipoActivo: 'deposito' };
    case 'plan_pensiones':
    case 'plan-pensiones':
    case 'plan_empleo':
      return { tipoActivo: 'plan_pensiones' };
    case 'otro':
    default:
      return { tipoActivo: 'otro' };
  }
}

/**
 * Normaliza una fecha ISO (puede venir con timestamp) a YYYY-MM-DD.
 * Devuelve `today` si la fecha no es válida.
 */
function fechaToISODay(value: unknown, today: string): string {
  if (typeof value !== 'string' || value.length === 0) return today;
  // Si ya es YYYY-MM-DD, devolverlo directo.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return today;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Lee todas las valoraciones actuales y devuelve un Set de claves
 * `activoId|tipoActivo` que ya tienen al menos 1 valoración no borrada.
 */
async function buildExistingKeys(
  db: Awaited<ReturnType<typeof initDB>>,
): Promise<Set<string>> {
  const all = (await (db as any).getAll('valoracionesActivos')) as Array<{
    activoId: string;
    tipoActivo: TipoActivoValoracion;
    deletedAt?: string | null;
  }>;
  const out = new Set<string>();
  for (const v of all) {
    if (v.deletedAt) continue;
    out.add(`${String(v.activoId)}|${v.tipoActivo}`);
  }
  return out;
}

export async function runSeedV74PR4(): Promise<SeedV74PR4Report> {
  const report: SeedV74PR4Report = {
    planesTotal: 0,
    planesSeeded: 0,
    planesSkippedSinValor: 0,
    planesSkippedYaTienen: 0,
    inversionesTotal: 0,
    inversionesSeeded: 0,
    inversionesSkippedSinValor: 0,
    inversionesSkippedYaTienen: 0,
    skipped: false,
  };

  try {
    const db = await initDB();

    // Idempotencia.
    const status = await db.get('keyval', MIGRATION_KEY);
    if (status === 'completed') {
      report.skipped = true;
      return report;
    }

    // Pre-flight · activos que ya tienen valoración en el store nuevo
    // (Jose pudo haber importado manualmente via wizard PR3).
    const existingKeys = await buildExistingKeys(db);

    // Snapshot pre-seed · best-effort en localStorage.
    try {
      const planes = (await (db as any).getAll('planesPensiones')) as any[];
      const inversiones = (await (db as any).getAll('inversiones')) as any[];
      localStorage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          planesCount: planes.length,
          inversionesCount: inversiones.length,
        }),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Seed v74-PR4] Snapshot localStorage falló (cuota?):', err);
    }

    const today = new Date().toISOString().split('T')[0];
    const inputs: ValoracionInput[] = [];

    // ── PLANES PENSIONES (store V65) ────────────────────────────────────────
    const planes = ((await (db as any).getAll('planesPensiones')) as any[]) ?? [];
    report.planesTotal = planes.length;

    for (const plan of planes) {
      if (plan.estado === 'rescatado_total') continue; // rescatado · sin valor relevante
      const id = String(plan.id ?? '');
      if (!id) continue;
      const key = `${id}|plan_pensiones`;
      if (existingKeys.has(key)) {
        report.planesSkippedYaTienen++;
        continue;
      }
      const valor = typeof plan.valorActual === 'number' ? plan.valorActual : NaN;
      if (!Number.isFinite(valor) || valor < 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Seed v74-PR4] Plan ${id} (${plan.nombre ?? '?'}) sin valorActual válido · saltando`,
        );
        report.planesSkippedSinValor++;
        continue;
      }
      const fecha = fechaToISODay(plan.fechaUltimaValoracion ?? plan.fechaActualizacion, today);
      inputs.push({
        activoId: id,
        tipoActivo: 'plan_pensiones',
        fecha,
        valor,
        origen: 'seed_legacy_field_v74',
        notas: `Seed desde planesPensiones.valorActual · id ${id}${
          plan.gestoraActual ? ` · gestora ${plan.gestoraActual}` : ''
        }`,
      });
      report.planesSeeded++;
      // Reservar la key para que la misma corrida no duplique vía inversiones legacy.
      existingKeys.add(key);
    }

    // ── INVERSIONES (store generalista · acciones, ETFs, fondos, etc.) ──────
    const inversiones = ((await (db as any).getAll('inversiones')) as any[]) ?? [];
    report.inversionesTotal = inversiones.length;

    for (const inv of inversiones) {
      if (inv.activo === false) continue; // posiciones cerradas · valoración irrelevante
      const id = String(inv.id ?? '');
      if (!id) continue;
      const mapped = mapInversionTipo(String(inv.tipo ?? ''));
      const key = `${id}|${mapped.tipoActivo}`;
      if (existingKeys.has(key)) {
        report.inversionesSkippedYaTienen++;
        continue;
      }
      const valor = typeof inv.valor_actual === 'number' ? inv.valor_actual : NaN;
      if (!Number.isFinite(valor) || valor < 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Seed v74-PR4] Inversión ${id} (${inv.nombre ?? '?'}) sin valor_actual válido · saltando`,
        );
        report.inversionesSkippedSinValor++;
        continue;
      }
      const fecha = fechaToISODay(inv.fecha_valoracion ?? inv.updated_at, today);
      inputs.push({
        activoId: id,
        tipoActivo: mapped.tipoActivo,
        subtipoInversion: mapped.tipoActivo === 'inversion' ? mapped.subtipoInversion : undefined,
        fecha,
        valor,
        origen: 'seed_legacy_field_v74',
        notas: `Seed desde inversiones.valor_actual · id ${id} · tipo "${inv.tipo}"${
          mapped.subtipoInversion ? ` → ${mapped.tipoActivo}/${mapped.subtipoInversion}` : ''
        }`,
      });
      report.inversionesSeeded++;
      existingKeys.add(key);
    }

    if (inputs.length > 0) {
      await bulkInsert(inputs);
    }

    await db.put('keyval', 'completed', MIGRATION_KEY);
    // eslint-disable-next-line no-console
    console.info('[Seed v74-PR4]', report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Seed v74-PR4] ERROR · sin completar · reintentará en próximo arranque', err);
    // No marcamos como completed: re-intentará en próximo arranque.
  }

  return report;
}
