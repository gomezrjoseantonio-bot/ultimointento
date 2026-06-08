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

/** Etiqueta identificativa de la fila (alias o, si falta, dirección). */
const etiqueta = (row: InmuebleTemplateRow): string => row.alias || row.direccion || '(sin identificar)';

/** Valida una fila sin crear nada · alimenta la tabla de revisión. */
export function revisarRow(row: InmuebleTemplateRow): InmuebleRevision {
  const avisos: string[] = [];
  // Obligatorias SOLO · alias o dirección (+ tipo, que por defecto es "piso").
  if (!row.alias && !row.direccion) {
    return { row, valido: false, motivo: 'Falta el alias o la dirección', avisos };
  }

  if (row.importeFinanciado > 0) {
    avisos.push('Compra financiada · habrá que vincular el préstamo (el semáforo lo recordará)');
  }
  if (row.alquilerPorHabitaciones && !row.numeroHabitaciones) {
    avisos.push('Alquiler por habitaciones sin nº de habitaciones · se podrá completar después');
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

  const esPiso = row.tipoActivo === 'piso';
  const esParkingOTrastero = row.tipoActivo === 'parking' || row.tipoActivo === 'trastero';

  return {
    tipoActivo: row.tipoActivo,
    alias: row.alias || row.direccion || '',
    address: row.direccion ?? '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: row.fechaCompra ?? '',
    cadastralReference: row.refCatastral ?? undefined,
    squareMeters: row.m2 ?? 0,
    bedrooms: row.numeroHabitaciones ?? 0,
    bathrooms: row.banos ?? undefined,
    transmissionRegime: 'usada',
    state: 'activo',
    documents: [],
    porcentajePropiedad: row.porcentajePropiedad ?? 100,
    esUrbana: row.esUrbana,
    modoExplotacion: row.modoExplotacion,
    // Mismos campos que persiste el formulario real (InmueblePage).
    ...(esPiso ? { anexos: { tieneParking: row.tieneParking, tieneTrastero: row.tieneTrastero } } : {}),
    ...(!esParkingOTrastero && row.usoTipo ? { usoTipo: row.usoTipo } : {}),
    ...(esPiso && row.alquilerPorHabitaciones
      ? { alquilerPorHabitaciones: { activo: true, numeroHabitaciones: row.numeroHabitaciones ?? undefined } }
      : {}),
    acquisitionCosts: { price: row.precioCompra, other: row.gastosCompra > 0 ? [{ concept: 'Gastos compra', amount: row.gastosCompra }] : undefined },
    ...(Object.keys(estructuraCompra).length > 0 ? { estructuraCompra } : {}),
    fiscalData: {
      cadastralValue: row.valorCatastral || undefined,
      constructionCadastralValue: row.valorCatastralConstruccion || undefined,
      constructionPercentage:
        row.valorCatastral > 0 ? (row.valorCatastralConstruccion / row.valorCatastral) * 100 : undefined,
      cadastralRevised: row.valorCatastralRevisado,
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
  // Como una fila puede identificarse por alias O por dirección, la idempotencia
  // contempla AMBOS: una fila se considera duplicada si su clave coincide con el
  // alias o la dirección de un inmueble ya existente (o ya creado en este lote).
  const clavesExistentes = new Set<string>();
  const registrar = (alias?: string, direccion?: string | null) => {
    const a = (alias ?? '').trim().toLowerCase();
    if (a) clavesExistentes.add(a);
    const d = (direccion ?? '').trim().toLowerCase();
    if (d) clavesExistentes.add(d);
  };
  for (const p of existentes) registrar(p.alias, p.address);

  for (const row of rows) {
    const revision = revisarRow(row);
    const id_alias = etiqueta(row);
    if (!revision.valido) {
      r.errores.push({ fila: row.filaOriginal, alias: id_alias, motivo: revision.motivo ?? 'Fila inválida' });
      continue;
    }
    const aliasKey = (row.alias || row.direccion || '').trim().toLowerCase();
    if (aliasKey && clavesExistentes.has(aliasKey)) {
      r.saltados += 1;
      continue;
    }
    const id = Number(await db.add('properties', rowToProperty(row)));
    registrar(row.alias, row.direccion);
    r.creados += 1;
    r.idsCreados.push(id);
    for (const aviso of revision.avisos) r.avisos.push({ fila: row.filaOriginal, alias: id_alias, aviso });
  }
  return r;
}
