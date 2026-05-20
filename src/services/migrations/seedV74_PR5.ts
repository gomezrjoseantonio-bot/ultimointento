// ============================================================================
// T-VALORACIONES PR5 · Seed migración inmuebles
// ============================================================================
//
// Para cada inmueble activo en el store `properties` que tenga un campo
// legacy de valoración, crea una entrada en `valoracionesActivos` con
// `origen: 'seed_legacy_field_v74'`. Inmuebles vendidos/inactivos se
// saltan (su valoración a fecha de venta vive en `property_sales`).
//
// Jerarquía de campos (de mejor a menos preferido) · NO migra fiscales
// (valorCatastral, precioCompra/valorAdquisicion como dato canónico del
// IRPF · se quedan en su store):
//   1. valor_actual / valorActual          → mercado actual reciente
//   2. currentValue / marketValue          → alias inglés
//   3. estimatedValue / valuation          → alias menos comunes
//   4. compra.valor_actual                 → anidado en sub-objeto compra
//   5. acquisitionCosts.currentValue       → anidado en acquisitionCosts
//   6. tasacion                            → pericial · esAnchorFiscal=TRUE
//   7. acquisitionCosts.price              → coste de compra · fallback
//   8. compra.precio_compra                → coste de compra · fallback
//
// Reglas:
// - Valor finito ESTRICTAMENTE > 0 (legacy 0 = sin dato · review Copilot PR4)
// - Inmueble vendido o `state !== 'activo'` se salta
// - Si el inmueble ya tiene una valoración en `valoracionesActivos`
//   (Jose pudo importar manualmente vía wizard PR3) · se salta
// - Cuando se cae al fallback `tasacion` · esAnchorFiscal=true · señala
//   que es un anchor pericial fiscal
// - Cuando se cae al fallback de coste de adquisición · nota indica
//   "revisar" porque es un valor histórico de compra, no de mercado
//
// Idempotente vía keyval `migration_v74_pr5_seed_done`.

import { initDB } from '../db';
import { bulkInsert } from '../valoracionesService';
import type { ValoracionInput } from '../../types/valoracionActivo';

const MIGRATION_KEY = 'migration_v74_pr5_seed_done';
const SNAPSHOT_KEY = 'atlas_seed_v74_pr5_snapshot';

export interface SeedV74PR5Report {
  inmueblesTotal: number;
  inmueblesActivos: number;
  inmueblesSeeded: number;
  inmueblesSeededComoAnchorFiscal: number;
  inmueblesSkippedSinValor: number;
  inmueblesSkippedYaTienen: number;
  inmueblesSkippedNoActivos: number;
  skipped: boolean;
}

/**
 * Resuelve el mejor valor disponible para un inmueble + indica si la
 * fuente es una tasación pericial (esAnchorFiscal=true).
 *
 * Exportada para tests · función pura sin side effects.
 */
export function extractValorInmueble(p: any): {
  valor: number | null;
  fuente: string;
  esAnchorFiscal: boolean;
} {
  const v = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

  // Mercado actual · ordenado por preferencia
  if (v(p?.valor_actual)) return { valor: p.valor_actual, fuente: 'valor_actual', esAnchorFiscal: false };
  if (v(p?.valorActual)) return { valor: p.valorActual, fuente: 'valorActual', esAnchorFiscal: false };
  if (v(p?.currentValue)) return { valor: p.currentValue, fuente: 'currentValue', esAnchorFiscal: false };
  if (v(p?.marketValue)) return { valor: p.marketValue, fuente: 'marketValue', esAnchorFiscal: false };
  if (v(p?.estimatedValue)) return { valor: p.estimatedValue, fuente: 'estimatedValue', esAnchorFiscal: false };
  if (v(p?.valuation)) return { valor: p.valuation, fuente: 'valuation', esAnchorFiscal: false };
  if (v(p?.compra?.valor_actual)) return { valor: p.compra.valor_actual, fuente: 'compra.valor_actual', esAnchorFiscal: false };
  if (v(p?.acquisitionCosts?.currentValue)) return { valor: p.acquisitionCosts.currentValue, fuente: 'acquisitionCosts.currentValue', esAnchorFiscal: false };

  // Tasación pericial · valor fiscal de referencia
  if (v(p?.tasacion)) return { valor: p.tasacion, fuente: 'tasacion (pericial)', esAnchorFiscal: true };

  // Fallback · coste de compra · NO es mercado actual · nota "revisar"
  if (v(p?.acquisitionCosts?.price))
    return { valor: p.acquisitionCosts.price, fuente: 'acquisitionCosts.price (coste de compra · revisar)', esAnchorFiscal: false };
  if (v(p?.compra?.precio_compra))
    return { valor: p.compra.precio_compra, fuente: 'compra.precio_compra (coste de compra · revisar)', esAnchorFiscal: false };

  return { valor: null, fuente: 'sin valor detectado', esAnchorFiscal: false };
}

/**
 * Resuelve la fecha de la valoración seed con preferencia · valor más
 * reciente disponible en el record (created_at / updated_at /
 * compra.fecha_compra / hoy).
 */
function fechaParaSeed(p: any, today: string): string {
  const candidates: unknown[] = [
    p?.updated_at,
    p?.fechaActualizacion,
    p?.compra?.fecha_compra,
    p?.compra?.fechaCompra,
    p?.acquisitionCosts?.purchaseDate,
    p?.created_at,
    p?.fechaCreacion,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string' || c.length === 0) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(c)) return c.slice(0, 10);
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return today;
}

export async function runSeedV74PR5(): Promise<SeedV74PR5Report> {
  const report: SeedV74PR5Report = {
    inmueblesTotal: 0,
    inmueblesActivos: 0,
    inmueblesSeeded: 0,
    inmueblesSeededComoAnchorFiscal: 0,
    inmueblesSkippedSinValor: 0,
    inmueblesSkippedYaTienen: 0,
    inmueblesSkippedNoActivos: 0,
    skipped: false,
  };

  try {
    const db = await initDB();

    // Idempotencia
    const status = await db.get('keyval', MIGRATION_KEY);
    if (status === 'completed') {
      report.skipped = true;
      return report;
    }

    // Activos que ya tienen valoración en el store nuevo (manual o seed
    // previo · respetamos su valor sin sobrescribir).
    const allValoraciones = (await (db as any).getAll('valoracionesActivos')) as Array<{
      activoId: string;
      tipoActivo: string;
      deletedAt?: string | null;
    }>;
    const existingKeys = new Set<string>();
    for (const v of allValoraciones) {
      if (v.deletedAt) continue;
      if (v.tipoActivo === 'inmueble') existingKeys.add(String(v.activoId));
    }

    // Snapshot best-effort
    const properties = ((await (db as any).getAll('properties')) as any[]) ?? [];
    report.inmueblesTotal = properties.length;
    try {
      localStorage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          inmueblesCount: properties.length,
        }),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[Seed v74-PR5] Snapshot localStorage falló (cuota?):', err);
    }

    const today = new Date().toISOString().split('T')[0];
    const inputs: ValoracionInput[] = [];

    for (const inmueble of properties) {
      const id = inmueble?.id;
      if (id == null) continue;
      const idStr = String(id);

      // Solo inmuebles activos · vendidos tienen su valoración a fecha
      // de venta en `property_sales`, no se duplica aquí.
      if (inmueble.state !== 'activo') {
        report.inmueblesSkippedNoActivos++;
        continue;
      }
      report.inmueblesActivos++;

      if (existingKeys.has(idStr)) {
        report.inmueblesSkippedYaTienen++;
        continue;
      }

      const { valor, fuente, esAnchorFiscal } = extractValorInmueble(inmueble);
      if (valor === null) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Seed v74-PR5] Inmueble ${idStr} (${inmueble.alias || inmueble.address || '?'}) sin valor detectado · saltando`,
        );
        report.inmueblesSkippedSinValor++;
        continue;
      }

      const fecha = fechaParaSeed(inmueble, today);
      const nombre = inmueble.alias || inmueble.address || `Inmueble ${idStr}`;
      inputs.push({
        activoId: idStr,
        tipoActivo: 'inmueble',
        fecha,
        valor,
        origen: 'seed_legacy_field_v74',
        esAnchorFiscal,
        notas: `Seed desde properties.${fuente} · id ${idStr} · "${nombre}"`,
      });
      report.inmueblesSeeded++;
      if (esAnchorFiscal) report.inmueblesSeededComoAnchorFiscal++;
    }

    if (inputs.length > 0) {
      await bulkInsert(inputs);
    }

    await db.put('keyval', 'completed', MIGRATION_KEY);
    // eslint-disable-next-line no-console
    console.info('[Seed v74-PR5]', report);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Seed v74-PR5] ERROR · sin completar · reintentará en próximo arranque', err);
  }

  return report;
}
