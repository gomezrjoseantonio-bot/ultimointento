// ============================================================================
// ATLAS · TAREA 18.3 · Castilla-La Mancha · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2024 CLM · texto refundido tributos cedidos.
//   · Manual Práctico AEAT 2025 · sección Castilla-La Mancha.
//
// ★ HALLAZGO ESPECIAL · CLM tiene 4 modalidades de arrendamiento
// INCOMPATIBLES entre sí (jóvenes · familia numerosa · familia monoparental
// · discapacidad ≥65%). Mismo % y tope para las 4 (15%/500 € · 20%/612 €
// rural). El cliente que cumple varias modalidades · solo aplica UNA · la
// más favorable. Implementación · 1 sola DeduccionAutonomica con
// `condicionesElegibilidadOR` cubre los 4 perfiles + `calcularImporte`
// custom selecciona porcentaje incrementado si vivienda en municipio rural.
//
// Cobertura T18.3:
//   · Mínimos personales y familiares · TODO · provisional estatales.
//   · Escala autonómica · 5 tramos · 9,5% min · 22,5% max · TODO valores.
//   · Deducción 1 · Arrendamiento vivienda habitual (4 modalidades unificadas
//     en 1 deducción) · 15%/500 € · 20%/612 € rural · BI ≤12.500 indiv /
//     ≤25.000 conjunta (★ los topes BI MÁS BAJOS de España).
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2024 =
  'Decreto Legislativo 1/2024 CLM · texto refundido tributos cedidos · DOCM/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Castilla-La Mancha';
const URL_AEAT_CLM =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-castilla-mancha.html';

// ─── Deducción Arrendamiento Vivienda Habitual · 4 modalidades unificadas ──
// Modalidad 1 · Jóvenes <36 años
// Modalidad 2 · Familia numerosa
// Modalidad 3 · Familia monoparental
// Modalidad 4 · Discapacidad ≥65%
// Las 4 modalidades comparten · 15% / 500 € (20% / 612 € si vivienda en
// municipio ≤2.500 hab O 2.500-10.000 a >30 km de ciudad >50.000).
// BI ≤12.500 individual / ≤25.000 conjunta.
// Si el cliente cumple varias modalidades · aplica UNA · misma cuantía ·
// "selección" automática · `condicionesElegibilidadOR` detecta cualquiera.

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'clm-arrendamiento-vivienda-habitual',
  ccaa: 'Castilla-La Mancha',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '15% (tope 500 €) base · 20% (tope 612 €) si vivienda en municipio ≤2.500 hab o 2.500-10.000 a >30 km de ciudad >50.000 · 4 modalidades INCOMPATIBLES (jóvenes <36 · familia numerosa · familia monoparental · discapacidad ≥65%) · UNA aplicable a la vez · misma cuantía · BI ≤12.500 individual / ≤25.000 conjunta (★ los topes BI MÁS BAJOS de España).',
  fuenteOficial: `${FUENTE_DL_1_2024} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_CLM}`,
  verified: true,

  // Tope al máximo posible (612 €) · `calcularImporte` selecciona efectivo.
  porcentaje: 0.15,
  topeAbsolutoIndividual: 612,
  topeAbsolutoConjunta: 612,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    baseImponibleMaxIndividual: 12500,
    baseImponibleMaxConjunta: 25000,
    // 4 modalidades · al menos UNA debe cumplirse para ser elegible
    condicionesElegibilidadOR: [
      { edadMaxima: 36 }, // <36 jóvenes
      { requiereFamiliaNumerosa: 'general' },
      { requiereFamiliaMonoparental: true },
      { requiereDiscapacidad: { gradoMinimo: 65 } },
    ],
  },

  calcularImporte: (_ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    // Modalidad incrementada · municipio ≤2.500 hab · TODO ampliar para
    // 2.500-10.000 con distancia >30 km a ciudad >50.000.
    const poblacion = datosBase.municipioPoblacionHabitantes;
    const enRuralIncrementada = poblacion !== undefined && poblacion <= 2500;
    const porcentaje = enRuralIncrementada ? 0.2 : 0.15;
    const tope = enRuralIncrementada ? 612 : 500;
    const importe = cantidad * porcentaje;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Castilla-La Mancha ─────────────────────────────────────

export const CASTILLA_LA_MANCHA_RULES: CcaaRules = {
  ccaa: 'Castilla-La Mancha',
  codigoIso: 'ES-CM',
  fuenteOficialMinimos: `${FUENTE_DL_1_2024} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_1_2024} · escala 5 tramos · 9,5% min · 22,5% max · TODO valores`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 5 tramos · 9,5% min · 22,5% max · TODO ────────
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.095 },
    { baseHasta: 20200, tipoMarginal: 0.12 },
    { baseHasta: 35200, tipoMarginal: 0.15 },
    { baseHasta: 60000, tipoMarginal: 0.185 },
    { baseHasta: Infinity, tipoMarginal: 0.225 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · auditar escala 5 tramos + BI máx
  notasMigracion: [
    'Deducción arrendamiento · 4 modalidades INCOMPATIBLES unificadas en 1 · 15%/500 € base · 20%/612 € rural · BI ≤12.500/25.000 (★ los topes MÁS BAJOS de España) · `verified=true` por DL 1/2024 + Manual AEAT 2025.',
    'TODO T18.x · auditar 5 tramos exactos escala autonómica CLM.',
    'TODO T18.x · ampliar lógica modalidad rural · CLM modela también 2.500-10.000 hab a >30 km de ciudad >50.000 · necesita lista oficial municipios + cálculo de distancias.',
    'TODO T18.x · localizar lista oficial municipios CLM ≤2.500 hab y entre 2.500-10.000 a >30 km capital provincia.',
    'TODO T18.x · resto deducciones CLM · adquisición vivienda jóvenes ≤36 · arrendamiento dación en pago · familia numerosa · familias monoparentales (no asociadas a alquiler).',
  ],
};
