// ============================================================================
// ATLAS · TAREA 18.3 · Canarias (régimen REF) · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2009 (21 abril) Canarias · texto refundido
//     tributos cedidos · BOC/BOE · consolidado.
//   · Manual Práctico AEAT 2025 · sección Comunidad Autónoma de Canarias.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-canarias/alquiler-vivienda-habitual.html`.
//
// Cobertura T18.3:
//   · Mínimos personales y familiares · TODO · provisional estatales.
//   · Escala autonómica · 7 tramos · 9% min · 26% max · TODO valores
//     intermedios · `verified=false` paquete.
//   · Deducción 1 · Alquiler vivienda habitual · DL 1/2009 art. 15 · 24%
//     · tope 740 €/760 € · alquiler >10% BI · referencia catastral + NIF
//     arrendador + canon anual.
//
// ⚠️ Discrepancia BI máx · pre-investigación localizó 45.500 € en una
// fuente y 46.455 € en otra · marcamos `verified=false` deducción y
// usamos 45.500 € como conservador hasta auditoría Manual AEAT 2025.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2009 =
  'Decreto Legislativo 1/2009 (21/04/2009) Canarias · texto refundido tributos cedidos · BOC/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Canarias';
const URL_AEAT_CANARIAS =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-canarias/alquiler-vivienda-habitual.html';

// ─── Deducción Alquiler Vivienda Habitual · DL 1/2009 art. 15 ──────────────
// Requisitos AND ·
//   · Alquiler anual > 10% BI general+ahorro (★ específico Canarias)
//   · Referencia catastral en autoliquidación · NIF arrendador · canon anual
//   · BI ≤45.500 individual (TODO discrepancia 45.500 vs 46.455 · verificar)
// Cálculo · 24% × cantidades · tope 740 € (760 € si <40 o ≥75 años).

const DEDUCCION_ALQUILER: DeduccionAutonomica = {
  id: 'canarias-alquiler-vivienda-habitual',
  ccaa: 'Canarias',
  nombre: 'Alquiler de vivienda habitual',
  descripcion:
    '24% de cantidades satisfechas · tope 740 € (760 € si <40 o ≥75 años) · alquiler anual > 10% de BI (general + ahorro) · BI ≤45.500 € individual · referencia catastral + NIF arrendador + canon anual obligatorios.',
  fuenteOficial: `${FUENTE_DL_1_2009} · art. 15 · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_CANARIAS}`,
  verified: false, // TODO · resolver discrepancia BI máx 45.500 vs 46.455

  porcentaje: 0.24,
  // Tope al máximo posible (760 €) · `calcularImporte` selecciona efectivo.
  topeAbsolutoIndividual: 760,
  topeAbsolutoConjunta: 760,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    requiereReferenciaCatastral: true,
    porcentajeMinAlquilerSobreBI: 0.1, // ★ específico Canarias · alquiler >10% BI
    baseImponibleMaxIndividual: 45500, // TODO discrepancia 45.500 vs 46.455
    baseImponibleMaxConjunta: 60500, // TODO verificar 60.500 vs 61.770
  },

  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    // Tope incrementado · <40 o ≥75 años.
    const edad = ctx.edadActual;
    const tope = (edad !== null && (edad < 40 || edad >= 75)) ? 760 : 740;
    const importe = cantidad * 0.24;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Canarias ───────────────────────────────────────────────

export const CANARIAS_RULES: CcaaRules = {
  ccaa: 'Canarias',
  codigoIso: 'ES-CN',
  fuenteOficialMinimos: `${FUENTE_DL_1_2009} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_1_2009} · escala 7 tramos · 9% min · 26% max · TODO valores intermedios`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 7 tramos · 9% min · 26% max · TODO ────────────
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.09 },
    { baseHasta: 17707.2, tipoMarginal: 0.115 },
    { baseHasta: 33007.2, tipoMarginal: 0.14 },
    { baseHasta: 53407.2, tipoMarginal: 0.185 },
    { baseHasta: 90000, tipoMarginal: 0.235 },
    { baseHasta: 175000, tipoMarginal: 0.245 },
    { baseHasta: Infinity, tipoMarginal: 0.26 },
  ],

  deducciones: [DEDUCCION_ALQUILER],

  verified: false, // TODO T18.x · auditar escala 7 tramos + BI máx
  notasMigracion: [
    'Deducción alquiler · 24% · 740/760 € · alquiler >10% BI · referencia catastral · `verified=false` deducción · discrepancia BI 45.500 vs 46.455 pendiente auditoría.',
    '⚠️ Régimen REF · Canarias tiene Régimen Económico Fiscal especial · NO afecta IRPF directamente pero puede tener peculiaridades en algunas deducciones · CC consultó Manual AEAT 2025 · principal IRPF general.',
    'TODO T18.x · resolver discrepancia BI máx 45.500 vs 46.455 (mismo Manual AEAT entre 2 secciones).',
    'TODO T18.x · auditar 7 tramos exactos escala autonómica Canarias (9%-26%).',
    'TODO T18.x · auditar mínimos autonómicos vs estatales.',
    'TODO T18.x · resto deducciones · arrendamiento dación en pago (25%/1.200 €) · puesta arrendamiento arrendador (1.000 €/inmueble · max 5) · gastos adecuación inmueble · primas seguro impago · traslado entre islas · descendientes <6 conciliación · municipio riesgo despoblación.',
  ],
};
