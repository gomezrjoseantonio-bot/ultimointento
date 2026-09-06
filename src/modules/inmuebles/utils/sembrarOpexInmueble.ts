// ============================================================================
// R4 · Semillado de OPEX al poner un inmueble operativo (Jose, 20 ago 2026)
// ============================================================================
//
// Cuando un inmueble pasa a `operativo`, se SUGIEREN sus gastos típicos según la
// modalidad (comunidad, IBI, seguros, suministros…). Nada se crea a ciegas: el
// usuario marca, rellena importe/cuenta/periodicidad y confirma. Cada fila
// confirmada nace como un `CompromisoRecurrente` de ámbito inmueble; si lleva
// importe y cuenta, nace `activo` y genera sus previsiones; si no, nace
// `preparado` y espera a completarse.
//
// Reutiliza lo que ya existe: el catálogo por modalidad (`catalogoModalidadInmueble`),
// la resolución de concepto unificado, y el servicio de compromisos recurrentes
// (que ya sabe generar las previsiones). Ver docs §9 quinquies bis + §9 quinquies.
// ============================================================================

import type { ModoExplotacionAlquiler } from '../../../services/db';
import type { CompromisoRecurrente, PatronRecurrente } from '../../../types/compromisosRecurrentes';
import { labelClasificacion, type Ambito } from '../../../services/catalogo/catalogoUnico';
import {
  catalogoDelInmueble,
  restarYaDados,
  type ConceptoInmuebleRef,
} from '../wizards/utils/catalogoModalidadInmueble';
import {
  crearCompromiso,
  listarCompromisos,
} from '../../../services/personal/compromisosRecurrentesService';
import { getContractsByProperty } from '../../../services/contractService';

export type Periodicidad = 'mensual' | 'trimestral' | 'anual';

// ─── Helpers puros (con tests) ───────────────────────────────────────────────

/** La ref de catálogo (tipo:subtipo) que representa un compromiso ya dado de alta. */
export function refDeCompromiso(
  c: Pick<CompromisoRecurrente, 'familia' | 'subtipo'>,
): ConceptoInmuebleRef | null {
  if (!c.familia) return null;
  return { tipoId: c.familia, subtipoId: c.subtipo ?? '' };
}

/** Etiqueta legible de un concepto del catálogo · «Suministro · Luz». */
export function etiquetaConcepto(ref: ConceptoInmuebleRef): string {
  return labelClasificacion(ref.tipoId, ref.subtipoId || undefined);
}

/** Periodicidad por defecto sugerida · lo anual es anual, el resto mensual. */
export function periodicidadPorDefecto(ref: ConceptoInmuebleRef): Periodicidad {
  const anuales = new Set(['ibi', 'basuras', 'licencia_turistica']);
  if (ref.tipoId === 'seguros_alarmas' && ref.subtipoId !== 'alarma') return 'anual';
  if (ref.tipoId === 'impuestos_tasas' && anuales.has(ref.subtipoId)) return 'anual';
  return 'mensual';
}

/** El patrón de calendario que corresponde a una periodicidad. */
export function patronDePeriodicidad(p: Periodicidad): PatronRecurrente {
  switch (p) {
    case 'anual':
      return { tipo: 'anualMesesConcretos', mesesPago: [1], diaPago: 1 };
    case 'trimestral':
      return { tipo: 'cadaNMeses', cadaNMeses: 3, mesAncla: 1, dia: 1 };
    case 'mensual':
    default:
      return { tipo: 'mensualDiaFijo', dia: 1 };
  }
}

export interface OpcionesSkeleton {
  inmuebleId: number;
  cuentaCargo: number;
  importe: number;
  periodicidad: Periodicidad;
  fechaInicio: string; // ISO yyyy-mm-dd
}

/**
 * El `CompromisoRecurrente` que nace de una sugerencia. Misma clasificación que
 * el alta manual (`ListadoGastosRecurrentes.crearGasto`): familia + subtipo del
 * catálogo único. Nace `activo` si lleva importe (genera previsiones);
 * `preparado` si no (espera a completarse).
 */
export function construirSkeletonOpex(
  ref: ConceptoInmuebleRef,
  opts: OpcionesSkeleton,
): Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'> {
  const ambito: Ambito = 'inmueble';
  const estado: CompromisoRecurrente['estado'] = opts.importe > 0 ? 'activo' : 'preparado';

  return {
    ambito,
    inmuebleId: opts.inmuebleId,
    alias: etiquetaConcepto(ref),
    familia: ref.tipoId,
    subtipo: ref.subtipoId || undefined,
    proveedor: { nombre: '' },
    patron: patronDePeriodicidad(opts.periodicidad),
    importe: { modo: 'fijo', importe: opts.importe },
    cuentaCargo: opts.cuentaCargo,
    conceptoBancario: '',
    metodoPago: 'domiciliacion',
    responsable: 'titular',
    fechaInicio: opts.fechaInicio,
    estado,
  } as unknown as Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;
}

// ─── IO ──────────────────────────────────────────────────────────────────────

/**
 * Los conceptos que faltan por dar de alta en un inmueble.
 *
 * El subtipo lo pone el CONTRATO, no el modo: el modo solo sabe de la forma de
 * la unidad, y derivarlo de él dejaba a una media estancia con el catálogo de
 * vivienda completa —siete conceptos en vez de dieciséis, cinco de ellos sin
 * aparecer siquiera entre los disponibles—. Es el mismo `catalogoDelInmueble`
 * que usa la ficha, para que las dos pantallas no puedan volver a discrepar.
 */
export async function conceptosASembrar(
  inmuebleId: number,
  modo: ModoExplotacionAlquiler,
  hoy: Date = new Date(),
): Promise<ConceptoInmuebleRef[]> {
  const contratos = await getContractsByProperty(inmuebleId);
  const precargados = catalogoDelInmueble(contratos, modo, hoy).precargados;
  const existentes = await listarCompromisos({ ambito: 'inmueble', inmuebleId });
  const yaDados = existentes
    .map((c) => refDeCompromiso(c))
    .filter((r): r is ConceptoInmuebleRef => r != null);
  return restarYaDados(precargados, yaDados);
}

/** ¿El inmueble ya tiene algún gasto recurrente? · para el auto-abrir la 1ª vez. */
export async function inmuebleTieneOpex(inmuebleId: number): Promise<boolean> {
  const existentes = await listarCompromisos({ ambito: 'inmueble', inmuebleId });
  return existentes.length > 0;
}

export interface FilaSemilla {
  ref: ConceptoInmuebleRef;
  importe: number;
  periodicidad: Periodicidad;
  cuentaCargo: number;
}

export interface ResultadoSemilla {
  creados: number;
  activos: number;
}

/** Da de alta los gastos marcados. Los que llevan importe generan previsiones. */
export async function sembrarOpex(
  inmuebleId: number,
  filas: FilaSemilla[],
  fechaInicio: string,
): Promise<ResultadoSemilla> {
  let creados = 0;
  let activos = 0;
  for (const f of filas) {
    const skeleton = construirSkeletonOpex(f.ref, {
      inmuebleId,
      cuentaCargo: f.cuentaCargo,
      importe: f.importe,
      periodicidad: f.periodicidad,
      fechaInicio,
    });
    const creado = await crearCompromiso(skeleton);
    creados += 1;
    if (creado.estado === 'activo') activos += 1;
  }
  return { creados, activos };
}
