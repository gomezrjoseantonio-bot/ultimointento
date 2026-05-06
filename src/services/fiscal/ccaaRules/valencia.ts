// ============================================================================
// ATLAS · TAREA 18.1 · Comunitat Valenciana · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Ley 13/1997 (23 diciembre) Generalitat Valenciana · Texto Refundido
//     tributos cedidos · DOGV (consolidado tras Ley 12/2024 GV).
//   · Manual Práctico AEAT 2025 · sección Comunitat Valenciana.
//   · Hisenda GVA · `https://hisenda.gva.es/es/web/tributos/beneficis-fiscals-2025`.
//
// Cobertura T18.1:
//   · Mínimos personales y familiares · pre-investigación NO localizó
//     diferencia con estatales · provisional `verified=false` a nivel
//     paquete · estatales como base.
//   · Escala autonómica · 9 tramos · 10% min · 29,5% max ★ tipo más alto
//     de España · TODO valores intermedios.
//   · Deducción 1 · Arrendamiento vivienda habitual · 20% / 25% / 30% ·
//     800 / 950 / 1.100 € · reducción progresiva BI 27k-30k individual /
//     44k-47k conjunta · CRÍTICO según spec.
// ============================================================================

import type {
  CcaaRules,
  DatosBaseDeduccion,
  DeduccionAutonomica,
  FiscalContext,
} from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_LEY_13_1997 =
  'Ley 13/1997 GV · Texto Refundido tributos cedidos · DOGV (consolidado tras Ley 12/2024 GV)';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunitat Valenciana';
const URL_AEAT_VALENCIA =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunitat-valenciana.html';
const URL_HISENDA_GVA =
  'https://hisenda.gva.es/es/web/tributos/beneficis-fiscals-2025';

// ─── Helpers (puros · idempotentes) ────────────────────────────────────────

/**
 * Cuenta condiciones de Valencia cumplidas (max 3) · cada condición eleva
 * el porcentaje/tope (0 → 20/800 · 1 → 25/950 · 2+ → 30/1.100).
 *   · Edad ≤35 años a 31/12 ejercicio
 *   · Discapacidad física/sensorial ≥65% o psíquica ≥33% (modelado como
 *     `discapacidadTitular === 'mas65'` o `'entre33y65'`)
 *   · Víctima de violencia de género
 */
function contarCondicionesValencia(
  ctx: FiscalContext,
  datosBase: DatosBaseDeduccion,
): number {
  let n = 0;
  if (ctx.edadActual !== null && ctx.edadActual <= 35) n += 1;
  if (
    ctx.discapacidadTitular === 'mas65' ||
    ctx.discapacidadTitular === 'entre33y65'
  ) {
    n += 1;
  }
  if (datosBase.esVictimaViolenciaGenero === true) n += 1;
  return n;
}

/**
 * Reducción progresiva por BI (Ley 13/1997 GV art. 4.1.n) ·
 *   · BI ≤ 27.000 (individual) / 44.000 (conjunta) → factor 1
 *   · BI ≥ 30.000 / 47.000 → factor 0 (no aplica · NO elegible)
 *   · Entre ambos · factor lineal `1 - (BI - inicio) / (fin - inicio)`
 */
function factorReduccionProgresivaValencia(
  bi: number,
  esConjunta: boolean,
): number {
  const inicio = esConjunta ? 44000 : 27000;
  const fin = esConjunta ? 47000 : 30000;
  if (bi <= inicio) return 1;
  if (bi >= fin) return 0;
  return 1 - (bi - inicio) / (fin - inicio);
}

// ─── Deducción Arrendamiento Vivienda Habitual · Ley 13/1997 art. 4.1.n ────

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'valencia-arrendamiento-vivienda-habitual',
  ccaa: 'Comunitat Valenciana',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '20% (tope 800 €) base · 25% (tope 950 €) si reúne 1 condición · 30% (tope 1.100 €) si reúne 2+ · condiciones · ≤35 años · discapacidad ≥33% psíquica/≥65% física · víctima violencia género · BI ≤27.000 individual (reducción progresiva 27k-30k) / ≤44.000 conjunta (reducción 44k-47k) · contrato posterior 23/04/1998 · duración ≥1 año · NO propietario otra vivienda <50 km · pagos trazables.',
  fuenteOficial: `${FUENTE_LEY_13_1997} · art. 4.1.n · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_VALENCIA} · ${URL_HISENDA_GVA}`,
  verified: true,

  // Estos campos se documentan para metadatos pero el cálculo real va
  // por `calcularImporte` (porcentajes/topes variables según condiciones
  // cumplidas + reducción progresiva BI).
  // T18.1 fix · `topeAbsoluto*` al MÁXIMO posible (1.100 €) · `calcularImporte`
  // selecciona el tope efectivo (800 / 950 / 1.100 según condiciones) ·
  // evita doble tope que recortaba 950/1100 a 800.
  porcentaje: 0.2,
  topeAbsolutoIndividual: 1100,
  topeAbsolutoConjunta: 1100,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    duracionContratoMinAnios: 1,
    // BI máximo · estrictamente menor que 30.000 / 47.000 · en BI=30.000
    // (umbral) la fórmula progresiva da factor 0 (importe=0) · alineamos
    // elegibilidad para evitar el caso confuso de "elegible con importe 0".
    // Usamos 29999.99 / 46999.99 (precisión céntimo · suficiente para BI
    // fiscal). T18.1 fix Copilot · alinear umbral con factor 0 de fórmula.
    baseImponibleMaxIndividual: 29999.99,
    baseImponibleMaxConjunta: 46999.99,
    // TODO T18.x · contrato posterior 23/04/1998 · NO propietario <50 km ·
    // pagos trazables · ampliar `DatosBaseDeduccion` con flags concretos
    // cuando aparezca el wizard fiscal · hoy no se evalúan (se asumen
    // cumplidos por el flujo de uso). Pre-investigación deja TODO.
  },

  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;

    const condiciones = contarCondicionesValencia(ctx, datosBase);
    let porcentaje: number;
    let tope: number;
    if (condiciones >= 2) {
      porcentaje = 0.3;
      tope = 1100;
    } else if (condiciones === 1) {
      porcentaje = 0.25;
      tope = 950;
    } else {
      porcentaje = 0.2;
      tope = 800;
    }

    const esConjunta = ctx.tributacion === 'conjunta';
    const biRef = esConjunta && datosBase.baseImponibleConjunta !== undefined
      ? datosBase.baseImponibleConjunta
      : datosBase.baseImponibleIndividual;
    const factor = factorReduccionProgresivaValencia(biRef, esConjunta);

    const importeBruto = cantidad * porcentaje * factor;
    const importeFinal = Math.min(importeBruto, tope);
    return Math.round(importeFinal * 100) / 100;
  },
};

// ─── Deducción Primera Adquisición Vivienda Habitual · ≤35 años ────────────

const DEDUCCION_PRIMERA_ADQUISICION: DeduccionAutonomica = {
  id: 'valencia-primera-adquisicion-vivienda-habitual-jovenes',
  ccaa: 'Comunitat Valenciana',
  nombre: 'Primera adquisición de vivienda habitual · contribuyentes ≤35 años',
  descripcion:
    '5% sobre cantidades satisfechas (excluye intereses) · primera vivienda · ≤35 años a 31/12 · BI ≤27.000 individual / ≤44.000 conjunta (con reducción progresiva hasta 30k/47k) · pagos trazables.',
  fuenteOficial: `${FUENTE_LEY_13_1997} · ${FUENTE_AEAT_MANUAL}`,
  verified: true,

  porcentaje: 0.05,
  topeAbsolutoIndividual: Number.POSITIVE_INFINITY, // sin tope absoluto · solo BI cap

  requisitos: {
    edadMaxima: 36, // ≤35
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    baseImponibleMaxIndividual: 29999.99,
    baseImponibleMaxConjunta: 46999.99,
    // TODO T18.x · primera vivienda · patrimonio aumenta · pagos trazables
    // · ampliar `DatosBaseDeduccion` con flags · hoy se asumen cumplidos.
  },

  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.inversionViviendaHabitualAnual ?? 0;
    if (cantidad <= 0) return 0;
    const esConjunta = ctx.tributacion === 'conjunta';
    const biRef = esConjunta && datosBase.baseImponibleConjunta !== undefined
      ? datosBase.baseImponibleConjunta
      : datosBase.baseImponibleIndividual;
    const factor = factorReduccionProgresivaValencia(biRef, esConjunta);
    return Math.round(cantidad * 0.05 * factor * 100) / 100;
  },
};

// ─── Paquete CCAA · Comunitat Valenciana ───────────────────────────────────

export const VALENCIA_RULES: CcaaRules = {
  ccaa: 'Comunitat Valenciana',
  codigoIso: 'ES-VC',
  fuenteOficialMinimos:
    'Ley 13/1997 GV · TODO T18.x · auditar mínimos autonómicos vs estatales · pre-investigación NO localizó diferencia',
  fuenteOficialEscala:
    'Ley 13/1997 GV · 9 tramos · TODO T18.x · auditar valores intermedios · pre-investigación localizó rango (10%-29,5%)',

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 9 tramos · 10% min · 29,5% max ★ máximo España ─
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.1 },
    { baseHasta: 17000, tipoMarginal: 0.11 },
    { baseHasta: 30000, tipoMarginal: 0.135 },
    { baseHasta: 50000, tipoMarginal: 0.18 },
    { baseHasta: 65000, tipoMarginal: 0.235 },
    { baseHasta: 80000, tipoMarginal: 0.245 },
    { baseHasta: 120000, tipoMarginal: 0.255 },
    { baseHasta: 175000, tipoMarginal: 0.275 },
    { baseHasta: Infinity, tipoMarginal: 0.295 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO, DEDUCCION_PRIMERA_ADQUISICION],

  verified: false, // TODO T18.x · escala 9 tramos exactos + mínimos autonómicos
  notasMigracion: [
    'Deducción arrendamiento · 20%/25%/30% · 800/950/1.100 € · reducción progresiva BI 27k-30k indiv / 44k-47k conjunta (Ley 13/1997 art. 4.1.n) · `verified=true` por cifras AEAT 2025.',
    'Deducción primera adquisición ≤35 · 5% · BI ≤27/44k progresivo · `verified=true`.',
    'TODO T18.x · 9 tramos exactos escala autonómica Valencia (10%-29,5%) · pre-investigación localizó rango y número de tramos · valores intermedios estimados · `verified=false` a nivel paquete.',
    'TODO T18.x · auditar mínimos autonómicos Ley 13/1997 vs estatales.',
    'TODO T18.x · ampliar `DatosBaseDeduccion` con `contratoPosterior1998` · `noPropietarioOtraVivienda50km` · `pagosTrazables` · `primeraVivienda` · `patrimonioAumentaCantidadInvertida`.',
    'TODO T18.x · resto deducciones Valencia · 2+ descendientes (10% cuota íntegra autonómica · BI ≤30k) · obras conservación 20% · incremento intereses hipoteca · autoconsumo eléctrico.',
  ],
};
