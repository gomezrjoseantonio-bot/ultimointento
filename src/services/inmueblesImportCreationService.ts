// Onboarding día 0 · C4 · creación de inmuebles desde la plantilla.
//
// Patrón espejo de `contractImportCreationService`: valida filas, crea
// Properties idempotentemente (alias único) y devuelve un resultado con
// creados/saltados/errores para la pantalla de revisión.
import { initDB } from './db';
import type { Property } from './db';
import type { InmuebleTemplateRow } from './inmueblesTemplateParserService';

export interface ResultadoInmuebles {
  creados: number;
  saltados: number; // alias ya existente
  errores: Array<{ fila: number; alias: string; motivo: string }>;
  /** Avisos no bloqueantes (p.ej. financiado sin préstamo · a vincular luego). */
  avisos: Array<{ fila: number; alias: string; aviso: string }>;
  idsCreados: number[];
}

export const resultadoInmueblesVacio = (): ResultadoInmuebles => ({
  creados: 0,
  saltados: 0,
  errores: [],
  avisos: [],
  idsCreados: [],
});

export interface InmuebleRevision {
  row: InmuebleTemplateRow;
  valido: boolean;
  motivo?: string;
  avisos: string[];
}

/** Valida una fila sin crear nada · alimenta la tabla de revisión. */
export function revisarRow(row: InmuebleTemplateRow): InmuebleRevision {
  const avisos: string[] = [];
  if (!row.alias) return { row, valido: false, motivo: 'Falta el alias', avisos };
  if (row.precioCompra <= 0) return { row, valido: false, motivo: 'El precio de compra debe ser mayor que 0', avisos };

  if (row.importeFinanciado > 0) {
    avisos.push('Compra financiada · habrá que vincular el préstamo (el semáforo lo recordará)');
  }
  if (row.modoExplotacion === 'por_habitaciones' && !row.numeroHabitaciones) {
    avisos.push('Explotación por habitaciones sin nº de habitaciones · se podrá completar después');
  }
  return { row, valido: true, avisos };
}

export function revisarRows(rows: InmuebleTemplateRow[]): InmuebleRevision[] {
  return rows.map(revisarRow);
}

function rowToProperty(row: InmuebleTemplateRow): Omit<Property, 'id'> {
  const estructuraCompra: NonNullable<Property['estructuraCompra']> = {};
  if (row.aportacionPropia > 0) estructuraCompra.aportacionPropia = row.aportacionPropia;
  if (row.importeFinanciado > 0) estructuraCompra.importeFinanciado = row.importeFinanciado;

  return {
    alias: row.alias,
    address: row.direccion ?? '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: row.fechaCompra ?? '',
    cadastralReference: row.refCatastral ?? undefined,
    squareMeters: 0,
    bedrooms: row.numeroHabitaciones ?? 0,
    transmissionRegime: 'usada',
    state: 'activo',
    documents: [],
    porcentajePropiedad: 100,
    modoExplotacion: row.modoExplotacion,
    acquisitionCosts: { price: row.precioCompra, other: row.gastosCompra > 0 ? [{ concept: 'Gastos compra', amount: row.gastosCompra }] : undefined },
    ...(Object.keys(estructuraCompra).length > 0 ? { estructuraCompra } : {}),
    fiscalData: {
      cadastralValue: row.valorCatastral || undefined,
      constructionCadastralValue: row.valorCatastralConstruccion || undefined,
      constructionPercentage:
        row.valorCatastral > 0 ? (row.valorCatastralConstruccion / row.valorCatastral) * 100 : undefined,
    },
  };
}

/**
 * Crea las Properties de las filas válidas. Idempotente por alias: una fila con
 * un alias ya existente se cuenta como `saltado` (no duplica).
 */
export async function crearInmueblesDesdeRows(rows: InmuebleTemplateRow[]): Promise<ResultadoInmuebles> {
  const r = resultadoInmueblesVacio();
  const db = await initDB();
  const existentes = (await db.getAll('properties')) as Property[];
  const aliasExistentes = new Set(existentes.map((p) => (p.alias ?? '').trim().toLowerCase()));

  for (const row of rows) {
    const revision = revisarRow(row);
    if (!revision.valido) {
      r.errores.push({ fila: row.filaOriginal, alias: row.alias, motivo: revision.motivo ?? 'Fila inválida' });
      continue;
    }
    const aliasKey = row.alias.trim().toLowerCase();
    if (aliasExistentes.has(aliasKey)) {
      r.saltados += 1;
      continue;
    }
    const id = Number(await db.add('properties', rowToProperty(row)));
    aliasExistentes.add(aliasKey);
    r.creados += 1;
    r.idsCreados.push(id);
    for (const aviso of revision.avisos) r.avisos.push({ fila: row.filaOriginal, alias: row.alias, aviso });
  }
  return r;
}
