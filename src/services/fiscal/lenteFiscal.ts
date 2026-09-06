// ============================================================================
// E2.4.1c · LENTE FISCAL · lo que la casilla AEAT dice de una familia
// ============================================================================
//
// El catálogo único (`catalogo/catalogoUnico.ts`) NO lleva fiscalidad: ni
// casilla ni deducibilidad (DEFINITIVO · principio 3). Eso vive AQUÍ, como una
// lente que se pone encima leyendo familia + subtipo + contexto (el ámbito). Es
// el único sitio de la aplicación donde una clasificación se convierte en
// casilla del Modelo 100; antes lo decidían tres tablas que no se ponían de
// acuerdo (`categoryCatalog.casillaAEAT`, `CATEGORIA_A_CASILLA`,
// `resolveCasillaAEAT`), y una cuarta traducía en sentido contrario.
//
// ── Qué decide ──────────────────────────────────────────────────────────────
//
//   casillaDe        familia + subtipo + ámbito → casilla de gasto del inmueble
//   tratamientoDe    cómo cuenta en la previsión de impuestos (se resta entero ·
//                    se amortiza al 3 % · al 10 % · no se resta)
//   storeDestinoDe   en qué tabla nace la línea al materializarse (gasto ·
//                    mejora · mueble) · es tratamiento fiscal, no catálogo
//   clasificacionDeCasilla  el camino inverso, para lo que ENTRA por casilla
//                    (una declaración importada) y hay que etiquetar
//
// Sólo un gasto de ÁMBITO INMUEBLE tiene casilla de gasto. El personal no se
// resta de ningún rendimiento: `casillaDe` devuelve `undefined` y
// `tratamientoDe` dice `noDeducible`. El alquiler de la vivienda propia tampoco
// va por aquí (alimenta la deducción autonómica, otra cosa).
//
// La cuota del préstamo (`prestamo_hipoteca`) es cargo entero (DEFINITIVO ·
// principio 6): el interés deducible (0105) lo pone el módulo de préstamos desde
// el cuadro, no esta lente. Por eso `prestamo_hipoteca` no tiene casilla aquí.
// ============================================================================

import type { AEATBox } from '../db/types-contratos';
import type { Ambito, FamiliaId } from '../catalogo/catalogoUnico';

export type TratamientoFiscal = 'deducibleDirecto' | 'amortizable3' | 'amortizable10' | 'noDeducible';

export type StoreDestino = 'gastosInmueble' | 'mejorasInmueble' | 'mueblesInmueble';

export interface ContextoFiscal {
  familia?: FamiliaId | null;
  subtipo?: string | null;
  ambito?: Ambito | null;
}

/** Casillas de GASTO deducible del inmueble en el Modelo 100. */
export const CASILLA_INTERESES: AEATBox = '0105';
export const CASILLA_REPARACION: AEATBox = '0106';
export const CASILLA_COMUNIDAD: AEATBox = '0109';
export const CASILLA_SERVICIOS: AEATBox = '0112';
export const CASILLA_SUMINISTROS: AEATBox = '0113';
export const CASILLA_SEGUROS: AEATBox = '0114';
export const CASILLA_TRIBUTOS: AEATBox = '0115';
export const CASILLA_MOBILIARIO: AEATBox = '0117';

/**
 * La casilla de gasto que le toca a un gasto de INMUEBLE por su familia.
 *
 * `undefined` = no es un gasto que se reste por casilla: ámbito personal, una
 * mejora (se amortiza en su tabla, no es casilla de gasto), la cuota del
 * préstamo (el interés lo pone el cuadro), o una familia que no deduce.
 */
export function casillaDe(c: ContextoFiscal): AEATBox | undefined {
  if (c.ambito !== 'inmueble' || !c.familia) return undefined;
  switch (c.familia) {
    case 'comunidad':
      return CASILLA_COMUNIDAD;
    case 'suministro':
      return CASILLA_SUMINISTROS;
    case 'seguros_alarmas':
      // El seguro de VIDA sólo cuenta en un inmueble si lo exige la hipoteca: va
      // con los gastos de financiación. La alarma es un servicio, no un seguro.
      if (c.subtipo === 'vida') return CASILLA_INTERESES;
      if (c.subtipo === 'alarma') return CASILLA_SERVICIOS;
      return CASILLA_SEGUROS;
    case 'impuestos_tasas':
      return CASILLA_TRIBUTOS;
    case 'reparacion_mantenimiento':
      return CASILLA_REPARACION;
    case 'gestion':
    case 'limpieza':
      return CASILLA_SERVICIOS;
    case 'mobiliario_enseres':
      return CASILLA_MOBILIARIO;
    // La reforma se amortiza (tabla de mejoras) · el préstamo lo lleva el cuadro ·
    // el resto no se resta del rendimiento del inmueble.
    case 'reforma_mejora':
    case 'prestamo_hipoteca':
    default:
      return undefined;
  }
}

/** En qué tabla nace la línea de un gasto de inmueble al materializarse. */
export function storeDestinoDe(familia: FamiliaId | null | undefined): StoreDestino {
  if (familia === 'reforma_mejora') return 'mejorasInmueble';
  if (familia === 'mobiliario_enseres') return 'mueblesInmueble';
  return 'gastosInmueble';
}

/** Cómo cuenta el gasto en la previsión de impuestos. */
export function tratamientoDe(c: ContextoFiscal): TratamientoFiscal {
  if (c.ambito !== 'inmueble' || !c.familia) return 'noDeducible';
  if (c.familia === 'reforma_mejora') return 'amortizable3';
  if (c.familia === 'mobiliario_enseres') return 'amortizable10';
  return casillaDe(c) ? 'deducibleDirecto' : 'noDeducible';
}

const LABEL_TRATAMIENTO: Readonly<Record<TratamientoFiscal, string>> = {
  deducibleDirecto: 'deducible',
  amortizable3: 'no se resta · se amortiza al 3 %',
  amortizable10: 'no se resta · se amortiza al 10 % en diez años',
  noDeducible: 'no deducible',
};

const LABEL_CASILLA: Readonly<Partial<Record<AEATBox, string>>> = {
  '0105': 'intereses y gastos de financiación',
  '0106': 'reparación y conservación',
  '0109': 'comunidad',
  '0112': 'servicios',
  '0113': 'suministros',
  '0114': 'seguros',
  '0115': 'tributos y tasas',
  '0117': 'mobiliario y enseres',
};

export interface FiscalResuelta {
  casilla?: AEATBox;
  tratamiento: TratamientoFiscal;
  /** «cuenta como suministros · deducible» · lo que enseña una fila. */
  frase: string;
}

/** La lectura fiscal completa de una clasificación · para la ficha. */
export function fiscalidadDe(c: ContextoFiscal): FiscalResuelta {
  const tratamiento = tratamientoDe(c);
  const casilla = casillaDe(c);
  if (!c.familia) return { casilla, tratamiento, frase: 'sin clasificar' };
  if (c.ambito !== 'inmueble') return { casilla, tratamiento, frase: 'gasto personal · no deducible' };
  const que =
    c.familia === 'reforma_mejora' ? 'mejora' : (casilla && LABEL_CASILLA[casilla]) ?? undefined;
  const frase = que ? `cuenta como ${que} · ${LABEL_TRATAMIENTO[tratamiento]}` : LABEL_TRATAMIENTO[tratamiento];
  return { casilla, tratamiento, frase };
}

/**
 * El camino inverso: una casilla del Modelo 100 → familia (+ subtipo) del
 * catálogo. Para lo que ENTRA por casilla (una declaración importada) y hay
 * que etiquetar con el catálogo único.
 */
export function clasificacionDeCasilla(
  casilla: string | null | undefined,
): { familia: FamiliaId; subtipo?: string } | undefined {
  switch (casilla) {
    case '0105':
      return { familia: 'prestamo_hipoteca' };
    case '0106':
      return { familia: 'reparacion_mantenimiento' };
    case '0109':
      return { familia: 'comunidad' };
    case '0112':
      return { familia: 'gestion' };
    case '0113':
      return { familia: 'suministro' };
    case '0114':
      return { familia: 'seguros_alarmas' };
    case '0115':
      return { familia: 'impuestos_tasas' };
    case '0117':
      return { familia: 'mobiliario_enseres' };
    default:
      return undefined;
  }
}
