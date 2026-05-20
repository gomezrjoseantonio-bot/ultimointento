// ============================================================================
// T-VALORACIONES PR6 · Verificación de invariante post-seeds
// ============================================================================
//
// Tras los 3 seeds previos:
//   - PR1 (v73→v74) · rename store + transformación de los registros del
//     store anterior `valoraciones_historicas` → `valoracionesActivos`
//   - PR4 · seed planes pensiones + inversiones desde campos legacy
//   - PR5 · seed inmuebles desde campos legacy
//
// Esta auditoría verifica el invariante "todo activo ACTIVO debería
// tener ≥1 valoración en `valoracionesActivos`". Detecta:
//
//   1. Activos sin valoración · inmuebles `state=activo`, inversiones
//      `activo=true` cuyo `tipo` mapea a {inversion, plan_pensiones}
//      (deposito/otro no se chequean · sin store dedicado actual),
//      y planes con `estado !== rescatado_total` que NO tienen
//      ninguna valoración no borrada.
//   2. Valoraciones huérfanas · entradas en `valoracionesActivos` cuyo
//      `activoId` no matchea NINGÚN registro existente en el store
//      correspondiente · INCLUYE activos vendidos/cerrados/rescatados
//      (el activo existe pero no es "activo" · la valoración sigue
//      siendo legítima). Solo se considera huérfano si el activo NO
//      existe en absoluto.
//
// NO modifica datos · solo reporta. Se ejecuta al arrancar la app
// como side-effect logging:
//   - Silent si todo OK (cobertura 100%, sin huérfanos)
//   - Warning si hay activos sin valoración (Jose verá el log y podrá
//     importar histórico vía wizard PR3 desde la ficha)
//   - Error si hay huérfanas (indica bug · necesita atención)
//
// Idempotente · siempre se ejecuta (sin flag) porque la cobertura puede
// cambiar tras altas/bajas de activos · es útil como check vivo.
//
// Coste · `getAll` sobre `valoracionesActivos` materializa todos los
// registros en memoria al arrancar. Para histórico < 10k registros
// (caso típico Jose) el coste es despreciable. TODO si crece mucho ·
// migrar a `openCursor` sobre `idx_tipo` para iterar sin materializar.

import { initDB } from '../db';
import { mapInversionTipo } from './seedV74_PR4';
import type { TipoActivoValoracion } from '../../types/valoracionActivo';

export interface CoberturaItem {
  activoId: string;
  tipoActivo: TipoActivoValoracion;
  nombre: string;
}

export interface AuditV74PR6Report {
  /** Total de activos activos por tipo (solo los que cuentan en cobertura) */
  totalesPorTipo: Record<'inmueble' | 'inversion' | 'plan_pensiones', number>;
  /** Total con valoración por tipo */
  conValoracionPorTipo: Record<'inmueble' | 'inversion' | 'plan_pensiones', number>;
  /** % cobertura por tipo (0-100) */
  porcentajeCoberturaPorTipo: Record<'inmueble' | 'inversion' | 'plan_pensiones', number>;
  /** Activos activos sin ninguna valoración no borrada */
  sinValoracion: CoberturaItem[];
  /** Valoraciones huérfanas · activoId no existe en NINGÚN registro del store fuente */
  huerfanas: Array<{
    valoracionId: number;
    activoId: string;
    tipoActivo: TipoActivoValoracion;
  }>;
  /** Cobertura total · activos CON valoración / total activos × 100 */
  cobertura: number;
  /** true si la cobertura es 100% Y no hay huérfanas */
  ok: boolean;
  /** true si la auditoría falló por excepción interna · report parcial/degradado */
  errored?: boolean;
}

/**
 * Audita la cobertura de `valoracionesActivos` contra los stores de
 * activos. Lectura-only · no modifica datos.
 */
export async function auditValoracionesCobertura(): Promise<AuditV74PR6Report> {
  const report: AuditV74PR6Report = {
    totalesPorTipo: { inmueble: 0, inversion: 0, plan_pensiones: 0 },
    conValoracionPorTipo: { inmueble: 0, inversion: 0, plan_pensiones: 0 },
    porcentajeCoberturaPorTipo: { inmueble: 0, inversion: 0, plan_pensiones: 0 },
    sinValoracion: [],
    huerfanas: [],
    cobertura: 0,
    ok: false,
  };

  const db = await initDB();

  // Stores fuente · TODOS los registros (sin filtrar estado · necesario
  // para la detección de huérfanas).
  const [properties, inversiones, planes, valoraciones] = await Promise.all([
    (db as any).getAll('properties') as Promise<any[]>,
    (db as any).getAll('inversiones') as Promise<any[]>,
    (db as any).getAll('planesPensiones') as Promise<any[]>,
    (db as any).getAll('valoracionesActivos') as Promise<any[]>,
  ]);

  // ── Sets de IDs EXISTENTES en cada store (sin filtro de estado) ─────
  // Para detección de huérfanas · una valoración es huérfana solo si su
  // `activoId` NO existe en absoluto en el store fuente · NO si el
  // activo está vendido/cerrado/rescatado (review Copilot).
  const idsExistentes: Record<'inmueble' | 'inversion' | 'plan_pensiones', Set<string>> = {
    inmueble: new Set(),
    inversion: new Set(),
    plan_pensiones: new Set(),
  };
  for (const p of properties) {
    if (p?.id != null) idsExistentes.inmueble.add(String(p.id));
  }
  for (const inv of inversiones) {
    if (inv?.id == null) continue;
    // Una inversión legacy con tipo plan_pensiones existe en el store
    // `inversiones` pero su tipoActivo lógico es 'plan_pensiones'.
    const mapped = mapInversionTipo(String(inv.tipo ?? ''));
    if (mapped.tipoActivo === 'plan_pensiones' || mapped.tipoActivo === 'inversion') {
      idsExistentes[mapped.tipoActivo].add(String(inv.id));
    }
    // deposito/otro · NO incluidos para huérfanas chequeo (no se
    // contabilizan en cobertura · ver más abajo).
  }
  for (const plan of planes) {
    if (plan?.id != null) idsExistentes.plan_pensiones.add(String(plan.id));
  }

  // ── Set de claves activoId|tipoActivo CON ≥1 valoración no borrada ──
  const conValoracion = new Set<string>();
  for (const v of valoraciones) {
    if (v?.deletedAt) continue;
    const tipo = v?.tipoActivo as TipoActivoValoracion;
    if (tipo === 'inmueble' || tipo === 'inversion' || tipo === 'plan_pensiones') {
      conValoracion.add(`${String(v.activoId)}|${tipo}`);
    }
  }

  // ── Cobertura · solo activos ACTIVOS y solo tipos contabilizables ───

  // Inmuebles activos
  for (const p of properties) {
    if (p?.state !== 'activo' || p?.id == null) continue;
    const id = String(p.id);
    report.totalesPorTipo.inmueble++;
    if (conValoracion.has(`${id}|inmueble`)) {
      report.conValoracionPorTipo.inmueble++;
    } else {
      report.sinValoracion.push({
        activoId: id,
        tipoActivo: 'inmueble',
        nombre: p.alias || p.address || `Inmueble ${id}`,
      });
    }
  }

  // Inversiones activas · reusa `mapInversionTipo` (single source of truth ·
  // alineado con seedV74_PR4). Tipos `deposito` y `otro` NO se contabilizan
  // en cobertura · spec §7.1 (no hay store fuente dedicado).
  for (const inv of inversiones) {
    if (inv?.activo === false || inv?.id == null) continue;
    const mapped = mapInversionTipo(String(inv.tipo ?? ''));
    if (mapped.tipoActivo !== 'inversion' && mapped.tipoActivo !== 'plan_pensiones') {
      continue; // deposito/otro · skip
    }
    const id = String(inv.id);
    const tipoActivo = mapped.tipoActivo;
    report.totalesPorTipo[tipoActivo]++;
    if (conValoracion.has(`${id}|${tipoActivo}`)) {
      report.conValoracionPorTipo[tipoActivo]++;
    } else {
      report.sinValoracion.push({
        activoId: id,
        tipoActivo,
        nombre: inv.nombre || `Inversión ${id}`,
      });
    }
  }

  // Planes pensiones activos (store V65+)
  for (const plan of planes) {
    if (plan?.estado === 'rescatado_total' || plan?.id == null) continue;
    const id = String(plan.id);
    report.totalesPorTipo.plan_pensiones++;
    if (conValoracion.has(`${id}|plan_pensiones`)) {
      report.conValoracionPorTipo.plan_pensiones++;
    } else {
      report.sinValoracion.push({
        activoId: id,
        tipoActivo: 'plan_pensiones',
        nombre: plan.nombre + (plan.gestoraActual ? ` (${plan.gestoraActual})` : ''),
      });
    }
  }

  // ── Huérfanas · activoId NO existe en absoluto en el store fuente ───
  // (independiente del estado · vendido/cerrado/rescatado NO es
  // huérfano).
  for (const v of valoraciones) {
    if (v?.deletedAt) continue;
    const tipo = v?.tipoActivo as TipoActivoValoracion;
    if (tipo !== 'inmueble' && tipo !== 'inversion' && tipo !== 'plan_pensiones') continue;
    const id = String(v.activoId);
    if (!idsExistentes[tipo].has(id)) {
      report.huerfanas.push({ valoracionId: v.id as number, activoId: id, tipoActivo: tipo });
    }
  }

  // ── Porcentajes ─────────────────────────────────────────────────────
  for (const tipo of ['inmueble', 'inversion', 'plan_pensiones'] as const) {
    const total = report.totalesPorTipo[tipo];
    const con = report.conValoracionPorTipo[tipo];
    report.porcentajeCoberturaPorTipo[tipo] = total === 0 ? 100 : Math.round((con / total) * 100);
  }
  const totalGlobal =
    report.totalesPorTipo.inmueble + report.totalesPorTipo.inversion + report.totalesPorTipo.plan_pensiones;
  const conGlobal =
    report.conValoracionPorTipo.inmueble + report.conValoracionPorTipo.inversion + report.conValoracionPorTipo.plan_pensiones;
  report.cobertura = totalGlobal === 0 ? 100 : Math.round((conGlobal / totalGlobal) * 100);
  report.ok = report.sinValoracion.length === 0 && report.huerfanas.length === 0;

  return report;
}

/**
 * Ejecuta la auditoría y logea según el resultado:
 *   - OK · debug log silencioso
 *   - Activos sin valoración · warning + lista breve
 *   - Huérfanas · error + lista breve (indica bug)
 *   - Excepción interna · error + devuelve report degradado con
 *     `errored=true` y `ok=false` (NO re-lanza · review Copilot · es
 *     no-bloqueante por diseño).
 *
 * Se invoca en el bootstrap de la app tras los seeds. NO bloquea ni
 * fallea · solo reporta para que Jose vea qué está cubierto.
 */
export async function runAuditV74PR6(): Promise<AuditV74PR6Report> {
  try {
    const report = await auditValoracionesCobertura();

    if (report.ok) {
      // eslint-disable-next-line no-console
      console.info(
        `[ATLAS Audit v74-PR6] Cobertura ${report.cobertura}% · ${
          report.conValoracionPorTipo.inmueble +
          report.conValoracionPorTipo.inversion +
          report.conValoracionPorTipo.plan_pensiones
        } activos con valoración · 0 huérfanas`,
      );
      return report;
    }

    if (report.sinValoracion.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ATLAS Audit v74-PR6] ${report.sinValoracion.length} activo(s) sin valoración (cobertura global ${report.cobertura}%)`,
        report.sinValoracion.map((s) => `${s.tipoActivo}:${s.activoId} "${s.nombre}"`),
      );
    }

    if (report.huerfanas.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `[ATLAS Audit v74-PR6] ${report.huerfanas.length} valoración(es) huérfana(s) · activoId no existe en el store fuente`,
        report.huerfanas,
      );
    }

    return report;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ATLAS Audit v74-PR6] Error ejecutando auditoría', err);
    // No re-lanzamos · diseño no-bloqueante · devolvemos report
    // degradado con `errored=true` para que el caller pueda detectar
    // el fallo sin tener que envolver en try/catch externo.
    return {
      totalesPorTipo: { inmueble: 0, inversion: 0, plan_pensiones: 0 },
      conValoracionPorTipo: { inmueble: 0, inversion: 0, plan_pensiones: 0 },
      porcentajeCoberturaPorTipo: { inmueble: 0, inversion: 0, plan_pensiones: 0 },
      sinValoracion: [],
      huerfanas: [],
      cobertura: 0,
      ok: false,
      errored: true,
    };
  }
}
