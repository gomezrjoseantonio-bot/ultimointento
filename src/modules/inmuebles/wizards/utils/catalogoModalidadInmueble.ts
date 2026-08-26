// Mapa modalidad → catálogo sugerido (TAREA CC · GASTOS-RECURRENTES · §3.3).
//
// ATLAS ya sabe la modalidad porque está en el contrato (`Contract.modalidad` +
// `unidadTipo`), así que NO se pregunta. Este módulo decide, para un inmueble en
// alquiler, qué conceptos van MARCADOS (precargados · sugeridos) y cuáles quedan
// DISPONIBLES para añadir con un clic. Lo que no se precarga simplemente no está.
//
// IMPORTANTE (Fase 3): esto NO crea registros. Es una lista de sugerencias en
// pantalla · Jose marca lo que tiene, rellena importe/calendario/cuenta y guarda.
// Cada fila que llega a la base viene completa. El catálogo ofrece lo que aún no
// está dado de alta (el consumidor filtra los ya creados · ver `restarYaDados`).

import { conceptoPorId } from '../../../../services/conceptos/catalogoConceptos';
import { esCortaEstancia, type SubtipoAlquiler } from '../../../../services/db/types-alquiler';
import { resolverConcepto } from '../../../../services/conceptos/mapaLegacy';

/** Referencia a una entrada del catálogo (tipo + subtipo). */
export interface ConceptoInmuebleRef {
  tipoId: string;
  subtipoId: string;
}

export interface CatalogoModalidad {
  precargados: ConceptoInmuebleRef[];
  disponibles: ConceptoInmuebleRef[];
}

// Los tres «kinds» de catálogo de §3.3. Temporada y turístico comparten el de
// turístico.
export type CatalogoKind = 'viviendaCompleta' | 'habitaciones' | 'turistico';

const c = (tipoId: string, subtipoId: string): ConceptoInmuebleRef => ({ tipoId, subtipoId });

// ── Conceptos reutilizados ────────────────────────────────────────────────
const COMUNIDAD = c('comunidad', 'cuota_ordinaria');
const DERRAMAS = c('comunidad', 'derrama');
const IBI = c('tributos', 'ibi');
const BASURAS = c('tributos', 'tasa_basuras');
const LICENCIA_TURISTICA = c('tributos', 'licencia_turistica');
const SEGURO_HOGAR = c('seguros', 'hogar');
const SEGURO_IMPAGO = c('seguros', 'impago');
const GESTION_ALQUILER = c('gestion', 'honorarios_agencia');
const COMISION_PLATAFORMAS = c('gestion', 'comision_plataformas');
const LUZ = c('suministros', 'luz');
const AGUA = c('suministros', 'agua');
const GAS = c('suministros', 'gas');
const INTERNET = c('suministros', 'internet');
const TELEFONIA = c('suministros', 'telefonia');
const ALARMA = c('suministros', 'alarma');
const CALDERA = c('reparacion', 'mantenimiento_caldera');
const LIMPIEZA_ZONAS = c('servicios', 'limpieza_zonas_comunes');
const LIMPIEZA_ESTANCIA = c('servicios', 'limpieza_por_estancia');
// V6 · D3 · `ropa_cama_lavanderia` se desdobló: el servicio recurrente es
// Lavandería (Servicios y explotación) y el bien duradero es Ropa de cama y
// enseres (Mobiliario, amortizable). La sugerencia apunta al servicio, que es
// lo recurrente y lo que tiene sentido proponer de alta.
const ROPA_CAMA = c('servicios', 'lavanderia');
const CONSUMIBLES = c('servicios', 'consumibles_bienvenida');
const OTRO = c('otros', 'personalizado');

const SUMINISTROS = [LUZ, AGUA, GAS, INTERNET];

// ── §3.3 · Vivienda completa · precarga 7 · suministros NO ────────────────
const VIVIENDA_COMPLETA: CatalogoModalidad = {
  precargados: [COMUNIDAD, IBI, BASURAS, SEGURO_HOGAR, SEGURO_IMPAGO, DERRAMAS, GESTION_ALQUILER],
  // Los suministros los paga el inquilino → disponibles, no precargados.
  disponibles: [...SUMINISTROS, CALDERA, ALARMA, OTRO],
};

// ── §3.3 · Alquiler por habitaciones · precarga 13 ────────────────────────
const HABITACIONES: CatalogoModalidad = {
  precargados: [
    COMUNIDAD, IBI, BASURAS, SEGURO_HOGAR, SEGURO_IMPAGO,
    LUZ, AGUA, GAS, INTERNET,
    LIMPIEZA_ZONAS, CALDERA, DERRAMAS, GESTION_ALQUILER,
  ],
  disponibles: [TELEFONIA, ALARMA, OTRO],
};

// ── §3.3 · Temporada o turístico · precarga 16 (decisión Jose) ────────────
// De los 13 de habitaciones caen 2: seguro de IMPAGO (se cobra por adelantado,
// no hay inquilino que impague) y limpieza de ZONAS COMUNES (aquí es limpieza
// por estancia). GESTIÓN del alquiler SE QUEDA (un turístico gestionado por una
// empresa es de lo más normal). Entran los 5 turísticos. 13 − 2 + 5 = 16.
const TURISTICO: CatalogoModalidad = {
  precargados: [
    COMUNIDAD, IBI, BASURAS, SEGURO_HOGAR,
    LUZ, AGUA, GAS, INTERNET,
    CALDERA, DERRAMAS, GESTION_ALQUILER,
    LIMPIEZA_ESTANCIA, ROPA_CAMA, COMISION_PLATAFORMAS, CONSUMIBLES, LICENCIA_TURISTICA,
  ],
  disponibles: [ALARMA, OTRO],
};

/**
 * Decide qué catálogo aplica. La corta estancia manda sobre `unidadTipo` (un
 * piso completo alquilado por temporada usa el catálogo turístico).
 */
export function catalogoKindDeModalidad(
  modalidad: SubtipoAlquiler | undefined,
  unidadTipo: 'vivienda' | 'habitacion' | undefined,
): CatalogoKind {
  if (esCortaEstancia(modalidad)) return 'turistico';
  if (unidadTipo === 'habitacion') return 'habitaciones';
  return 'viviendaCompleta';
}

/**
 * Catálogo sugerido (precargados + disponibles) para la modalidad del contrato.
 * Fuente única de §3.3. Todas las refs apuntan a entradas reales del catálogo
 * (verificable con `findSubtipoInmueble`).
 */
export function catalogoSugeridoPorModalidad(
  modalidad: SubtipoAlquiler | undefined,
  unidadTipo: 'vivienda' | 'habitacion' | undefined,
): CatalogoModalidad {
  switch (catalogoKindDeModalidad(modalidad, unidadTipo)) {
    case 'turistico':
      return TURISTICO;
    case 'habitaciones':
      return HABITACIONES;
    case 'viviendaCompleta':
      return VIVIENDA_COMPLETA;
  }
}

const keyOf = (r: ConceptoInmuebleRef): string => `${r.tipoId}:${r.subtipoId}`;

/**
 * Quita de una lista de sugerencias los conceptos que YA están dados de alta.
 * "El catálogo ofrece lo que aún no está" (§3.3): el consumidor pasa las refs de
 * los compromisos existentes del inmueble y esto devuelve solo lo que falta.
 */
export function restarYaDados(
  sugeridos: ConceptoInmuebleRef[],
  yaDados: ConceptoInmuebleRef[],
): ConceptoInmuebleRef[] {
  const dados = new Set(yaDados.map(keyOf));
  return sugeridos.filter((r) => !dados.has(keyOf(r)));
}

/** true si la ref resuelve a un concepto del catálogo unificado (guard defensivo). */
export function refExisteEnCatalogo(r: ConceptoInmuebleRef): boolean {
  // P8c · se comprueba contra el catálogo vivo (conceptos/), no contra el 4º
  // catálogo retirado. El subtipoId suele ser ya el id de concepto; si no, se
  // traduce por el mapa de pares.
  const id = conceptoPorId(r.subtipoId) ? r.subtipoId : resolverConcepto(r.tipoId, r.subtipoId);
  return id != null && conceptoPorId(id) != null;
}
