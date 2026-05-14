// S-FISCAL-FIXES Fix 3 · N3 imputación renta a disposición
// Spec docs/specs/S-FISCAL-FIXES-1-4.md §5
//
// Fórmula AEAT (Art. 85 LIRPF) · imputación = VC × tipo × días_disposición / días_año
// · tipo = 1,1% si VC revisado en últimos 10 años (o si declaración revisada) · 2% en otro caso
// · días_disposición = total - alquilado - obras

import { initDB } from './db';

export type TipoImputacion = 1.1 | 2.0;

export interface ImputacionRentaDesglose {
  valorCatastral: number;
  valorCatastralRevisado: boolean;
  tipoAplicable: TipoImputacion;
  diasDisposicion: number;
  diasAnio: number;
  formula: string;
}

export interface ImputacionRentaResult {
  imputacion: number;
  desglose: ImputacionRentaDesglose;
  alertas: string[];
}

export function esBisiesto(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function vcRevisadoEnUltimos10Anios(
  fechaRevision: string | undefined,
  anio: number,
): boolean {
  if (!fechaRevision) return false;
  const fecha = new Date(fechaRevision);
  if (Number.isNaN(fecha.getTime())) return false;
  const anioRevision = fecha.getFullYear();
  return anio - anioRevision <= 10 && anio >= anioRevision;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface ImputacionInput {
  /** Días a disposición del titular (no alquilados ni en obras). */
  diasDisposicion: number;
  /** Valor catastral total del inmueble (proporcional a la titularidad). */
  valorCatastral: number;
  /** True si VC revisado/Catastro post-1994 o revisado en últimos 10 años. */
  revisado: boolean;
  /** Año del ejercicio (para detectar bisiesto). */
  anio: number;
}

export function computeImputacion(input: ImputacionInput): ImputacionRentaResult {
  const diasAnio = esBisiesto(input.anio) ? 366 : 365;
  const diasDisposicion = Math.max(0, Math.min(diasAnio, Math.round(input.diasDisposicion)));

  if (diasDisposicion === 0) {
    return {
      imputacion: 0,
      desglose: {
        valorCatastral: input.valorCatastral,
        valorCatastralRevisado: input.revisado,
        tipoAplicable: input.revisado ? 1.1 : 2.0,
        diasDisposicion: 0,
        diasAnio,
        formula: 'sin días de disposición · imputación = 0',
      },
      alertas: [],
    };
  }

  const vc = toNum(input.valorCatastral);
  if (vc <= 0) {
    return {
      imputacion: 0,
      desglose: {
        valorCatastral: 0,
        valorCatastralRevisado: input.revisado,
        tipoAplicable: input.revisado ? 1.1 : 2.0,
        diasDisposicion,
        diasAnio,
        formula: 'sin VC · imputación = 0',
      },
      alertas: [
        'Valor catastral no informado · imputación no se puede calcular · revisa la ficha del inmueble',
      ],
    };
  }

  const tipoAplicable: TipoImputacion = input.revisado ? 1.1 : 2.0;
  const imputacion = round2((vc * (tipoAplicable / 100) * diasDisposicion) / diasAnio);

  return {
    imputacion,
    desglose: {
      valorCatastral: vc,
      valorCatastralRevisado: input.revisado,
      tipoAplicable,
      diasDisposicion,
      diasAnio,
      formula: `${vc} × ${tipoAplicable}% × ${diasDisposicion}/${diasAnio}`,
    },
    alertas: [],
  };
}

export async function calcularImputacion(
  propertyId: number,
  anio: number,
): Promise<ImputacionRentaResult> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  if (!property) throw new Error(`Property ${propertyId} no existe`);

  const fiscalData = (property as any).fiscalData;
  const aeat = (property as any).aeatAmortization;

  const diasAnio = esBisiesto(anio) ? 366 : 365;

  // Días a disposición del titular = total − alquilado − obras
  // Lee de propertyDays si existe (caso real) · si no, asume todo a disposición
  let diasDisposicion = diasAnio;
  try {
    const rows = await db.getAllFromIndex('propertyDays', 'property-year', [propertyId, anio]);
    const pd = rows?.[0];
    if (pd) {
      const total = pd.daysAvailable && pd.daysAvailable > 0 ? pd.daysAvailable : diasAnio;
      const alquilado = pd.daysRented ?? 0;
      const enObras = pd.daysUnderRenovation ?? 0;
      diasDisposicion = Math.max(0, total - alquilado - enObras);
    }
  } catch {
    // Sin propertyDays · mantenemos diasAnio (todo a disposición)
  }

  const valorCatastral = toNum(fiscalData?.cadastralValue ?? aeat?.cadastralValue);

  // Revisado: bandera explícita en fiscalData, fiscalidad o cálculo desde fecha revisión.
  const revisadoExplicito =
    Boolean(fiscalData?.cadastralRevised) ||
    Boolean((property as any).fiscalidad?.catastro_revisado_post_1994);
  const revisadoPorFecha = vcRevisadoEnUltimos10Anios(fiscalData?.cadastralRevisionDate, anio);
  const revisado = revisadoExplicito || revisadoPorFecha;

  return computeImputacion({ diasDisposicion, valorCatastral, revisado, anio });
}
