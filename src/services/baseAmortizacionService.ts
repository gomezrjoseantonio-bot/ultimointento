// S-FISCAL-FIXES Fix 2 · N2 max() base amortización · N1 mejoras enteras
// Spec docs/specs/S-FISCAL-FIXES-1-4.md §4
//
// Regla N2 · base = max(por_coste, por_vc_construccion)
//   por_coste = (precio + gastos) × %construcción
//   por_vc_construccion = valor catastral construcción
// Regla N1 · mejoras ENTERAS · NO se les aplica %construcción
//   base_final = max(por_coste, por_vc) + mejoras_acumuladas

import { initDB } from './db';
import { getTotalMejorasHastaEjercicio } from './mejoraActivoService';
// V82 · Bloque C · la base amortizable es un dato por ejercicio (casilla 0130).
import { baseAmortizableEjercicioService } from './baseAmortizableEjercicioService';
import type { BaseAmortizableOrigen } from './db';

export interface BaseAmortizacionDesglose {
  precioAdquisicion: number;
  gastosAdquisicion: number;
  porcentajeConstruccion: number;
  baseporCoste: number;
  baseporVC: number;
  mejorasAcumuladas: number;
}

export interface BaseAmortizacionResult {
  base: number;
  metodo: 'por_coste' | 'por_vc_construccion';
  desglose: BaseAmortizacionDesglose;
  // V82 · Bloque C · procedencia de la base cuando viene del store por ejercicio.
  /** Origen de la base del ejercicio, si se usó el dato por ejercicio (casilla 0130). */
  origenEjercicio?: BaseAmortizableOrigen;
  /** `true` → el año está en conflicto (0130 ≠ campo único): cálculo BLOQUEADO. */
  bloqueado?: boolean;
  /** `true` → la base se heredó/es del campo único, sin verificar. */
  heredada?: boolean;
  /** Base calculada por la regla N2 (max coste/VC + mejoras), antes del override 0130. */
  baseCalculada?: number;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumarGastosAdquisicion = (ac: any | undefined): number => {
  if (!ac) return 0;
  const fixed =
    toNum(ac.itp) +
    toNum(ac.iva) +
    toNum(ac.notary) +
    toNum(ac.registry) +
    toNum(ac.management) +
    toNum(ac.psi) +
    toNum(ac.realEstate);
  const otros = Array.isArray(ac.other)
    ? ac.other.reduce((s: number, i: any) => s + toNum(i?.amount), 0)
    : 0;
  return fixed + otros;
};

export async function calcularBaseAmortizacion(
  propertyId: number,
  hastaAnio: number,
): Promise<BaseAmortizacionResult> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  if (!property) throw new Error(`Property ${propertyId} no existe`);

  const aeat = (property as any).aeatAmortization;
  const fiscalData = (property as any).fiscalData;
  const acquisitionType: 'onerosa' | 'lucrativa' | 'mixta' = aeat?.acquisitionType ?? 'onerosa';

  // Datos adquisición · onerosa/mixta usan precio + gastos · lucrativa usa ISD + impuestos + gastos inherentes
  let precio = 0;
  let gastos = 0;
  if (acquisitionType === 'lucrativa') {
    precio = toNum(aeat?.lucrativoAcquisition?.isdValue);
    gastos =
      toNum(aeat?.lucrativoAcquisition?.isdTax) +
      toNum(aeat?.lucrativoAcquisition?.inherentExpenses);
  } else {
    precio = toNum(
      aeat?.onerosoAcquisition?.acquisitionAmount ?? (property as any).acquisitionCosts?.price,
    );
    gastos = toNum(
      aeat?.onerosoAcquisition?.acquisitionExpenses ??
        sumarGastosAdquisicion((property as any).acquisitionCosts),
    );
  }

  // Datos catastrales
  const vcTotal = toNum(aeat?.cadastralValue ?? fiscalData?.cadastralValue);
  const vcConstruccion = toNum(
    aeat?.constructionCadastralValue ?? fiscalData?.constructionCadastralValue,
  );

  // % construcción: recalcular desde VC con precisión interna (Fix 4) si ambos
  // valores están disponibles · si no, usar el declarado en ficha.
  let porcentajeConstruccion = 0;
  if (vcTotal > 0 && vcConstruccion > 0) {
    porcentajeConstruccion = (vcConstruccion / vcTotal) * 100;
  } else {
    porcentajeConstruccion = toNum(
      aeat?.constructionPercentage ?? fiscalData?.constructionPercentage,
    );
  }

  const baseporCoste = (precio + gastos) * (porcentajeConstruccion / 100);
  const baseporVC = vcConstruccion;

  const baseSinMejoras = Math.max(baseporCoste, baseporVC);
  const metodo: 'por_coste' | 'por_vc_construccion' =
    baseporCoste >= baseporVC ? 'por_coste' : 'por_vc_construccion';

  const mejorasAcumuladas = await getTotalMejorasHastaEjercicio(propertyId, hastaAnio);

  // Regla N1 · mejoras se suman ENTERAS
  const baseCalculada = baseSinMejoras + mejorasAcumuladas;

  // V82 · Bloque C · la casilla 0130 declarada de cada año es la VERDAD de la base.
  // Si existe base por ejercicio (propia o heredada de un año con dato), sustituye
  // a la calculada. El fallback al campo único (`campo_unico`) NO sustituye — la
  // regla N2 calculada es más rica. Un año en conflicto se devuelve con
  // `bloqueado: true` para que el consumidor (venta) lo declare y no dé cifra firme.
  // Defensivo: si la lectura por ejercicio falla (store no disponible), se
  // mantiene la base calculada (comportamiento previo · no rompe el cálculo).
  let base = baseCalculada;
  let origenEjercicio: BaseAmortizableOrigen | undefined;
  let bloqueado: boolean | undefined;
  let heredada: boolean | undefined;
  try {
    const perEj = await baseAmortizableEjercicioService.getBaseParaCalculo(
      propertyId,
      hastaAnio,
      property as any,
    );
    if ((perEj.fuente === 'propio' || perEj.fuente === 'heredado') && perEj.base != null) {
      base = perEj.base;
      origenEjercicio = perEj.origen;
      bloqueado = perEj.bloqueado;
      heredada = perEj.heredada;
    }
  } catch {
    // sin override
  }

  return {
    base,
    metodo,
    desglose: {
      precioAdquisicion: precio,
      gastosAdquisicion: gastos,
      porcentajeConstruccion,
      baseporCoste,
      baseporVC,
      mejorasAcumuladas,
    },
    origenEjercicio,
    bloqueado,
    heredada,
    baseCalculada,
  };
}
