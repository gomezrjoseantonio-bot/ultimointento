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
  const base = baseSinMejoras + mejorasAcumuladas;

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
  };
}
