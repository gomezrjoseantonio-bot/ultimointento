// ============================================================================
// ATLAS · TAREA 18.2 · Cantabria · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 62/2008 (19 junio) Cantabria · texto refundido
//     tributos cedidos · BOC/BOE · modificaciones posteriores.
//   · Manual Práctico AEAT 2025 · sección Cantabria.
//
// Cobertura T18.2:
//   · Mínimos personales y familiares · TODO · provisional estatales.
//   · Escala autonómica · 6 tramos · 8,5% min · 24,5% max · TODO valores
//     intermedios · modificada con efectos 1/1/2024 · vigencia 2025
//     pendiente de verificación.
//   · Deducción 1 · Arrendamiento vivienda habitual · 10% · tope 300 €
//     individual / 600 € conjunta · ≤35 / ≥65 / víctima violencia · BI
//     máx PENDIENTE pre-investigación · `verified=false` deducción.
//   · Deducción 2 · TODO arrendamiento despoblamiento (modalidad reforzada).
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_62_2008 =
  'Decreto Legislativo 62/2008 (19/06/2008) Cantabria · texto refundido tributos cedidos · BOC/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Cantabria';
const URL_AEAT_CANTABRIA =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-cantabria.html';

// ─── Deducción Arrendamiento Vivienda Habitual ─────────────────────────────
// Pre-investigación NO localizó tope BI exacto · marcamos `verified=false`
// a nivel deducción · motor sigue evaluando los demás requisitos pero el
// flag queda explícito para Jose en review.

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'cantabria-arrendamiento-vivienda-habitual',
  ccaa: 'Cantabria',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '10% de cantidades satisfechas · tope 300 € individual / 600 € conjunta · ≤35 años · ≥65 años · víctima violencia doméstica/terrorismo · BI máx · TODO pre-investigación NO localizó cifra exacta · incompatible con específica arrendamiento municipios riesgo despoblamiento Cantabria (misma vivienda).',
  fuenteOficial: `${FUENTE_DL_62_2008} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_CANTABRIA}`,
  verified: false, // BI máx no localizado · `verified=false` deducción

  porcentaje: 0.1,
  topeAbsolutoIndividual: 300,
  topeAbsolutoConjunta: 600,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    condicionesElegibilidadOR: [
      { edadMaxima: 36 }, // ≤35
      { edadMinima: 65 }, // ≥65
    ],
    // TODO T18.x · BI máx · pre-investigación NO localizó cifra · CC en
    // próxima auditoría debe consultar Manual AEAT 2025 + Decreto Cantabria
    // y setear `baseImponibleMaxIndividual`/`Conjunta`. Sin ese tope
    // ATLAS aceptará cualquier BI · documentado en notasMigracion.
    // TODO T18.x · víctima violencia/terrorismo como condición OR adicional ·
    // ampliar `DatosBaseDeduccion` con flag específico.
  },
};

// ─── Paquete CCAA · Cantabria ──────────────────────────────────────────────

export const CANTABRIA_RULES: CcaaRules = {
  ccaa: 'Cantabria',
  codigoIso: 'ES-CB',
  fuenteOficialMinimos: `${FUENTE_DL_62_2008} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_62_2008} · escala 6 tramos · 8,5% min · 24,5% max · modificada 1/1/2024 · TODO vigencia 2025`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 6 tramos · 8,5% min · 24,5% max · TODO ────────
  escalaAutonomica: [
    { baseHasta: 13000, tipoMarginal: 0.085 },
    { baseHasta: 21000, tipoMarginal: 0.11 },
    { baseHasta: 35200, tipoMarginal: 0.145 },
    { baseHasta: 60000, tipoMarginal: 0.185 },
    { baseHasta: 90000, tipoMarginal: 0.225 },
    { baseHasta: Infinity, tipoMarginal: 0.245 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · BI máx + 6 tramos
  notasMigracion: [
    'Deducción arrendamiento · 10% · 300/600 € · ≤35 o ≥65 · `verified=false` deducción · BI máx no localizado en pre-investigación · CC en T18.x debe completar.',
    'TODO CRÍTICO · localizar BI máx para deducción arrendamiento Cantabria contra Manual AEAT 2025 + Decreto.',
    'TODO T18.x · auditar 6 tramos exactos escala autonómica Cantabria · vigencia 2025 (modificada 1/1/2024).',
    'TODO T18.x · localizar lista oficial municipios riesgo despoblamiento Cantabria.',
    'TODO T18.x · implementar deducción reforzada por arrendamiento en municipios riesgo despoblamiento (incompatible con la general para misma vivienda).',
    'TODO T18.x · ampliar `DatosBaseDeduccion` con flag víctima violencia doméstica/terrorismo.',
    'TODO T18.x · resto deducciones Cantabria · adquisición/rehabilitación vivienda habitual.',
  ],
};
