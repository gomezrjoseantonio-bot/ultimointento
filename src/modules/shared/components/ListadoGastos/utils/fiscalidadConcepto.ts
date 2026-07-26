// Fiscalidad DERIVADA del concepto (§3.2 · decisión Jose). La familia fiscal no
// se pregunta: la trae el concepto del catálogo (su "casillaAEAT"). Se enuncia
// como lo que es —"cuenta como suministro · deducible"— e informativa, no
// editable. Para restar un gasto PREVISTO en la previsión de impuestos hay que
// saber si es deducible y cómo cuenta: un suministro se resta entero, una mejora
// no se resta y se amortiza al 3 %, el alquiler de la vivienda propia no se resta.
//
// ÚNICA EXCEPCIÓN que pregunta: la derrama (conservación si arregla lo que ya
// había · mejora si añade algo nuevo) y el concepto "Otro" (no hay catálogo que
// lo diga). Eso se guarda en el único campo opcional `familiaFiscalManual`.

import type { FamiliaFiscal } from '../../../../../types/compromisosRecurrentes';

export type { FamiliaFiscal };

export type TratamientoFiscal = 'deducibleDirecto' | 'amortizable3' | 'noDeducible';

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
  { id: 'no_deducible', label: 'No deducible', tratamiento: 'noDeducible' },
];

const META = new Map(FAMILIAS_FISCALES.map((f) => [f.id, f]));

/** Familia fiscal base que trae cada FAMILIA de catálogo (tipoFamilia). */
function familiaBaseDe(tipoFamilia: string | undefined): FamiliaFiscal {
  switch (tipoFamilia) {
    case 'comunidad':
      return 'comunidad';
    case 'tributos':
      return 'ibi_tasas';
    case 'seguros':
      return 'seguros';
    case 'suministros':
      return 'suministros';
    case 'gestion':
      return 'servicios_profesionales';
    case 'reparacion':
      return 'reparaciones_conservacion';
    default:
      return 'no_deducible';
  }
}

/** ¿Este concepto PREGUNTA la familia (derrama · «Otro»)? §3 decisión Jose. */
export function conceptoPregunta(tipoFamilia: string | undefined, subtipo: string | undefined): boolean {
  const esDerrama = tipoFamilia === 'comunidad' && subtipo === 'derrama';
  const esOtro = tipoFamilia === 'otros' || subtipo === 'otros' || subtipo === 'personalizado';
  return esDerrama || esOtro;
}

export interface FiscalResuelta {
  /** Familia efectiva · null si el concepto pregunta y aún no se ha respondido. */
  familia: FamiliaFiscal | null;
  label: string;
  tratamiento: TratamientoFiscal;
  /** Frase informativa: "cuenta como suministro · deducible". */
  frase: string;
  /** El concepto pide que el usuario elija la familia (derrama · Otro). */
  pregunta: boolean;
  /** Sólo para la derrama: se ofrece conservación vs mejora. */
  esDerrama: boolean;
}

function fraseDeTratamiento(t: TratamientoFiscal): string {
  if (t === 'deducibleDirecto') return 'deducible';
  if (t === 'amortizable3') return 'no se resta · se amortiza al 3 %';
  return 'no deducible';
}

/**
 * Resuelve la fiscalidad de un compromiso a partir de su concepto y, si el
 * concepto pregunta, de la elección manual guardada (`familiaFiscalManual`).
 */
export function fiscalidadDeConcepto(
  tipoFamilia: string | undefined,
  subtipo: string | undefined,
  familiaFiscalManual?: FamiliaFiscal,
): FiscalResuelta {
  const pregunta = conceptoPregunta(tipoFamilia, subtipo);
  const esDerrama = tipoFamilia === 'comunidad' && subtipo === 'derrama';

  const familia: FamiliaFiscal | null = pregunta
    ? familiaFiscalManual ?? null
    : familiaBaseDe(tipoFamilia);

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
