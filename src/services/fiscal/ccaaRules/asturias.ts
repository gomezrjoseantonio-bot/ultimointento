// ============================================================================
// ATLAS · TAREA 18.2 · Principado de Asturias · cifras BOE/AEAT 2025
// ============================================================================
//
// ⚠️ NOVEDAD 2025 · Asturias estableció mínimos personales y familiares
// AUTONÓMICOS PROPIOS por primera vez. Pre-investigación NO localizó
// cifras al 100% · provisional `verified=false` paquete · usamos estatales
// hasta auditar BOPA.
//
// Fuentes principales ·
//   · Decreto Legislativo 2/2014 (22 octubre) Asturias · texto refundido
//     tributos cedidos · BOPA/BOE.
//   · Manual Práctico AEAT 2025 · sección Asturias.
//
// Cobertura T18.2:
//   · Mínimos personales y familiares · TODO BOPA · provisional estatales.
//   · Escala autonómica · 8 tramos · 10% min · 25,5% max · TODO valores
//     intermedios · `verified=false`.
//   · Deducción 1 · Arrendamiento vivienda habitual · 3 modalidades ·
//     general (10%/500 €) · jóvenes/familia/violencia (30%/1.500 €) ·
//     despoblación (30%/1.500 €) · BI ≤35.000 indiv / ≤45.000 conjunta.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_2_2014 =
  'Decreto Legislativo 2/2014 (22/10/2014) Asturias · texto refundido tributos cedidos · BOPA/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Asturias';
const URL_AEAT_ASTURIAS =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-asturias.html';

// ─── Deducción Arrendamiento Vivienda Habitual · 3 modalidades ────────────
// Modalidad A · base 10% / 500 €
// Modalidad B · jóvenes ≤35 / familia numerosa / familia monoparental /
//                víctima violencia género · 30% / 1.500 €
// Modalidad C · despoblación · concejo en riesgo · 30% / 1.500 €
// Requisitos · BI ≤35.000 indiv / ≤45.000 conjunta · NIF arrendador.

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'asturias-arrendamiento-vivienda-habitual',
  ccaa: 'Asturias',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '10% (tope 500 €) modalidad base · 30% (tope 1.500 €) modalidad incrementada si jóvenes ≤35 · familia numerosa · familia monoparental · víctima violencia género · O modalidad despoblación si vivienda en concejo asturiano en riesgo · BI ≤35.000 individual / ≤45.000 conjunta · NIF arrendador en autoliquidación.',
  fuenteOficial: `${FUENTE_DL_2_2014} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_ASTURIAS}`,
  verified: true,

  // Tope al máximo posible · `calcularImporte` selecciona 500 / 1.500.
  porcentaje: 0.1,
  topeAbsolutoIndividual: 1500,
  topeAbsolutoConjunta: 1500,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    baseImponibleMaxIndividual: 35000,
    baseImponibleMaxConjunta: 45000,
  },

  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    const esJoven = ctx.edadActual !== null && ctx.edadActual <= 35;
    const esFamiliaNumerosa =
      datosBase.familiaNumerosa !== undefined && datosBase.familiaNumerosa !== false;
    const esMonoparental = datosBase.familiaMonoparental === true;
    const esVictimaViolencia = datosBase.esVictimaViolenciaGenero === true;
    const esDespoblamiento = datosBase.viviendaEnZonaDespoblamiento === true;

    const cumpleIncrementada =
      esJoven || esFamiliaNumerosa || esMonoparental || esVictimaViolencia;
    const aplicaModalidadIncrementada = cumpleIncrementada || esDespoblamiento;

    const porcentaje = aplicaModalidadIncrementada ? 0.3 : 0.1;
    const tope = aplicaModalidadIncrementada ? 1500 : 500;
    const importe = cantidad * porcentaje;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Asturias ───────────────────────────────────────────────

export const ASTURIAS_RULES: CcaaRules = {
  ccaa: 'Asturias',
  codigoIso: 'ES-AS',
  fuenteOficialMinimos:
    'Asturias · novedad 2025 · mínimos autonómicos propios · TODO T18.x · BOPA · provisional estatales',
  fuenteOficialEscala: `${FUENTE_DL_2_2014} · escala 8 tramos · 10% min · 25,5% max · TODO valores intermedios`,

  // TODO T18.x · cifras esperadas según fuentes secundarias ·
  // contribuyente 6.105 € · bono ≥65 1.265 € · bono ≥75 1.540 €.
  // Hasta verificación oficial BOPA · usamos estatales.
  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 8 tramos · 10% min · 25,5% max · TODO valores ─
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.1 },
    { baseHasta: 17707.2, tipoMarginal: 0.12 },
    { baseHasta: 33007.2, tipoMarginal: 0.14 },
    { baseHasta: 53407.2, tipoMarginal: 0.185 },
    { baseHasta: 70000, tipoMarginal: 0.215 },
    { baseHasta: 90000, tipoMarginal: 0.225 },
    { baseHasta: 175000, tipoMarginal: 0.245 },
    { baseHasta: Infinity, tipoMarginal: 0.255 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · auditar escala 8 tramos + mínimos propios
  notasMigracion: [
    'Deducción arrendamiento · 3 modalidades · 10/30% · 500/1.500 € · BI ≤35k/45k · `verified=true` por DL 2/2014 + Manual AEAT 2025.',
    '⚠️ NOVEDAD 2025 · Asturias estableció mínimos autonómicos propios · TODO T18.x · auditar BOPA · provisional usamos estatales (ATLAS no aplicará el bono propio hasta verificar).',
    'TODO T18.x · auditar 8 tramos exactos escala autonómica Asturias.',
    'TODO T18.x · localizar lista oficial concejos en riesgo de despoblamiento Asturias para validar `viviendaEnZonaDespoblamiento`.',
    'TODO T18.x · resto deducciones Asturias · adquisición o adecuación vivienda discapacidad · familia numerosa o monoparental.',
  ],
};
