// Fiscalidad DERIVADA del concepto (§3.2 · decisión Jose). La familia fiscal no
// se pregunta: la trae el concepto. Se enuncia como lo que es —"cuenta como
// suministro · deducible"— e informativa, no editable. Para restar un gasto
// PREVISTO en la previsión de impuestos hay que saber si es deducible y cómo
// cuenta: un suministro se resta entero, una mejora no se resta y se amortiza al
// 3 %, el mobiliario al 10 %, el alquiler de la vivienda propia no se resta.
//
// ÚNICAS EXCEPCIONES que preguntan: la derrama (conservación si arregla lo que
// ya había · mejora si añade algo nuevo) y el concepto personalizado (no hay
// catálogo que lo diga). Eso se guarda en el único campo opcional
// `familiaFiscalManual`.
//
// Desde la unificación (`services/conceptos`) esto deriva del CONCEPTO y no del
// par (`tipoFamilia`, `subtipo`). El par sigue entrando por la puerta de atrás
// —se traduce— mientras queden registros o pantallas que lo usen. Y quién
// pregunta ya no es una lista escrita aquí: pregunta el que el catálogo marca
// como `pregunta` (la derrama) o como personalizado. Antes preguntaba cualquier
// subtipo llamado `otros`, aunque la capa de persistencia ya hubiera decidido su
// casilla — justo la clase de desacuerdo que la unificación viene a quitar.

import type { FamiliaFiscal } from '../../../../../types/compromisosRecurrentes';
import { conceptoPorId } from '../../../../../services/conceptos/catalogoConceptos';
import type { FamiliaId } from '../../../../../services/conceptos/catalogoConceptos';
import { resolverConcepto } from '../../../../../services/conceptos/mapaLegacy';

export type { FamiliaFiscal };

export type TratamientoFiscal =
  | 'deducibleDirecto'
  | 'amortizable3'
  | 'amortizable10'
  | 'noDeducible';

export interface FamiliaFiscalMeta {
  id: FamiliaFiscal;
  label: string;
  tratamiento: TratamientoFiscal;
}

export const FAMILIAS_FISCALES: FamiliaFiscalMeta[] = [
  { id: 'comunidad', label: 'Comunidad', tratamiento: 'deducibleDirecto' },
  { id: 'ibi_tasas', label: 'IBI y tasas', tratamiento: 'deducibleDirecto' },
  { id: 'seguros', label: 'Seguros', tratamiento: 'deducibleDirecto' },
  { id: 'suministros', label: 'Suministros', tratamiento: 'deducibleDirecto' },
  { id: 'reparaciones_conservacion', label: 'Reparaciones y conservación', tratamiento: 'deducibleDirecto' },
  { id: 'servicios_profesionales', label: 'Servicios profesionales', tratamiento: 'deducibleDirecto' },
  { id: 'intereses_financiacion', label: 'Intereses de financiación', tratamiento: 'deducibleDirecto' },
  { id: 'mejora', label: 'Mejora', tratamiento: 'amortizable3' },
  { id: 'amortizacion_muebles', label: 'Mobiliario y enseres', tratamiento: 'amortizable10' },
  { id: 'no_deducible', label: 'No deducible', tratamiento: 'noDeducible' },
];

const META = new Map(FAMILIAS_FISCALES.map((f) => [f.id, f]));

/**
 * Familia fiscal que trae cada familia del catálogo unificado.
 *
 * Las que salen `no_deducible` no es que estén sin clasificar: es que un
 * gimnasio, una suscripción o la compra del súper no se restan de ningún
 * rendimiento. El alquiler de la vivienda propia tampoco — alimenta la
 * deducción autonómica, que es otra cosa y va por su lado.
 */
const FAMILIA_FISCAL_DE: Record<FamiliaId, FamiliaFiscal> = {
  alquiler: 'no_deducible',
  tributos: 'ibi_tasas',
  comunidad: 'comunidad',
  suministros: 'suministros',
  seguros: 'seguros',
  cuotas: 'no_deducible',
  suscripciones: 'no_deducible',
  dia_a_dia: 'no_deducible',
  gestion: 'servicios_profesionales',
  reparacion: 'reparaciones_conservacion',
  // Limpieza, lavandería, consumibles… · casilla 0112 «servicios personales».
  servicios: 'servicios_profesionales',
  mobiliario: 'amortizacion_muebles',
  otros: 'no_deducible',
};

/** El concepto al que se refiere una fila · acepta lo viejo y lo nuevo. */
function idDeConcepto(
  conceptoOFamilia: string | undefined,
  subtipo?: string,
): string | undefined {
  if (subtipo !== undefined) return resolverConcepto(conceptoOFamilia, subtipo) ?? undefined;
  return conceptoOFamilia;
}

/**
 * ¿Este concepto PREGUNTA la familia fiscal?
 *
 * Sólo dos: la derrama (conservación vs mejora · lo dice el acta, no el
 * concepto) y el personalizado (lo escribe el usuario, no hay catálogo que lo
 * diga). Un concepto desconocido también pregunta, porque no se puede derivar
 * nada de él.
 */
export function conceptoPregunta(conceptoOFamilia: string | undefined, subtipo?: string): boolean {
  const c = conceptoPorId(idDeConcepto(conceptoOFamilia, subtipo));
  if (!c) return true;
  return c.esPersonalizado === true || c.inmueble?.estado === 'pregunta';
}

export interface FiscalResuelta {
  /** Familia efectiva · null si el concepto pregunta y aún no se ha respondido. */
  familia: FamiliaFiscal | null;
  label: string;
  tratamiento: TratamientoFiscal;
  /** Frase informativa: "cuenta como suministro · deducible". */
  frase: string;
  /** El concepto pide que el usuario elija la familia (derrama · personalizado). */
  pregunta: boolean;
  /** Sólo para la derrama: se ofrece conservación vs mejora. */
  esDerrama: boolean;
}

function fraseDeTratamiento(t: TratamientoFiscal): string {
  if (t === 'deducibleDirecto') return 'deducible';
  if (t === 'amortizable3') return 'no se resta · se amortiza al 3 %';
  if (t === 'amortizable10') return 'no se resta · se amortiza al 10 % en diez años';
  return 'no deducible';
}

/**
 * Resuelve la fiscalidad de un compromiso a partir de su concepto y, si el
 * concepto pregunta, de la elección manual guardada (`familiaFiscalManual`).
 *
 * Se llama de dos formas mientras dure la transición:
 *   `fiscalidadDeConcepto('seguro_vida', undefined, manual)`  · concepto nuevo
 *   `fiscalidadDeConcepto('seguros', 'vida', manual)`         · par legacy
 */
export function fiscalidadDeConcepto(
  conceptoOFamilia: string | undefined,
  subtipo?: string,
  familiaFiscalManual?: FamiliaFiscal,
): FiscalResuelta {
  const concepto = conceptoPorId(idDeConcepto(conceptoOFamilia, subtipo));
  const pregunta = concepto
    ? concepto.esPersonalizado === true || concepto.inmueble?.estado === 'pregunta'
    : true;
  const esDerrama = concepto?.id === 'derrama';

  // Una elección manual SIEMPRE manda (la fija la excepción que pregunta, o el
  // alta del seguro de vida vinculado a hipoteca → financiación). Si no la hay,
  // los conceptos que preguntan quedan sin resolver y el resto derivan de su
  // familia.
  const familia: FamiliaFiscal | null =
    familiaFiscalManual ??
    (pregunta || !concepto ? null : FAMILIA_FISCAL_DE[concepto.familia]);

  if (familia == null) {
    return {
      familia: null,
      label: '—',
      tratamiento: 'noDeducible',
      frase: esDerrama
        ? 'la derrama: ¿conservación o mejora? · elígelo abajo'
        : 'sin clasificar · elige cómo cuenta abajo',
      pregunta,
      esDerrama,
    };
  }

  const meta = META.get(familia)!;
  return {
    familia,
    label: meta.label,
    tratamiento: meta.tratamiento,
    frase: `cuenta como ${meta.label.toLowerCase()} · ${fraseDeTratamiento(meta.tratamiento)}`,
    pregunta,
    esDerrama,
  };
}
