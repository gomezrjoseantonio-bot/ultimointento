// ============================================================================
// ATLAS · TAREA 18.2 · Aragón · cifras BOE/AEAT 2025 · ★ CASO ESPECIAL
// ============================================================================
//
// ⚠️ HALLAZGO CRÍTICO · Aragón es la ÚNICA CCAA de régimen común que NO
// tiene deducción general por alquiler de vivienda habitual para inquilinos.
// Solo dispone de modalidades específicas (dación en pago · arrendador
// vivienda social).
//
// Implementación · una "deducción placeholder" con `noAplicableEnCcaaMotivo`
// que SIEMPRE devuelve no elegible con motivo claro · UX informativa.
// Más dos deducciones nicho documentadas como TODO para cliente concreto.
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2005 (26 septiembre) Aragón · texto refundido
//     tributos cedidos · BOA/BOE.
//   · Manual Práctico AEAT 2025 · sección Aragón.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-aragon.html`.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2005 =
  'Decreto Legislativo 1/2005 (26/09/2005) Aragón · texto refundido tributos cedidos · BOA/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Aragón';
const URL_AEAT_ARAGON =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-aragon.html';

// ─── Deducción placeholder · NO existe deducción general arrendamiento ────
// Cuando ATLAS evalúa una cliente Aragón con alquiler · esta deducción
// devuelve siempre no elegible con motivo de UX claro. Evita que el
// cliente espere una deducción que la ley NO contempla.

const DEDUCCION_PLACEHOLDER_NO_GENERAL: DeduccionAutonomica = {
  id: 'aragon-arrendamiento-vivienda-habitual-NO-DISPONIBLE',
  ccaa: 'Aragón',
  nombre: 'Arrendamiento de vivienda habitual (no disponible en Aragón)',
  descripcion:
    'Aragón NO tiene deducción general por alquiler de vivienda habitual para inquilinos. Solo dispone de modalidades específicas · arrendamiento vinculado a dación en pago (cliente que perdió su vivienda) y arrendamiento de vivienda social (deducción del arrendador, NO del inquilino).',
  fuenteOficial: `${FUENTE_DL_1_2005} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_ARAGON}`,
  verified: true,
  porcentaje: 0,
  topeAbsolutoIndividual: 0,
  requisitos: {},
  noAplicableEnCcaaMotivo:
    'Aragón no tiene deducción general arrendamiento vivienda habitual · solo casos específicos · dación en pago / vivienda social arrendador',
};

// ─── Paquete CCAA · Aragón ─────────────────────────────────────────────────

export const ARAGON_RULES: CcaaRules = {
  ccaa: 'Aragón',
  codigoIso: 'ES-AR',
  fuenteOficialMinimos: `${FUENTE_DL_1_2005} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_1_2005} · escala autonómica · 9 tramos · 9,5% min · 25,5% max · TODO valores intermedios`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 9 tramos · 9,5% min · 25,5% max ───────────────
  // TODO T18.x · valores intermedios · pre-investigación localizó rango.
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.095 },
    { baseHasta: 20200, tipoMarginal: 0.12 },
    { baseHasta: 34000, tipoMarginal: 0.145 },
    { baseHasta: 50000, tipoMarginal: 0.185 },
    { baseHasta: 60000, tipoMarginal: 0.215 },
    { baseHasta: 80000, tipoMarginal: 0.225 },
    { baseHasta: 100000, tipoMarginal: 0.235 },
    { baseHasta: 150000, tipoMarginal: 0.245 },
    { baseHasta: Infinity, tipoMarginal: 0.255 },
  ],

  deducciones: [DEDUCCION_PLACEHOLDER_NO_GENERAL],

  verified: false, // TODO T18.x · auditar escala 9 tramos + mínimos
  notasMigracion: [
    '⚠️ HALLAZGO ESPECIAL · Aragón NO tiene deducción general arrendamiento · única CCAA régimen común sin esta deducción.',
    'Cliente Aragón inquilino general → ATLAS responde NO ELEGIBLE con motivo de UX · "Aragón no tiene deducción general arrendamiento · solo dación en pago / vivienda social".',
    'TODO T18.x · implementar deducción "arrendamiento vinculado a dación en pago" (caso nicho · cliente perdió vivienda · ampliar `DatosBaseDeduccion` con flag `esDacionEnPago`).',
    'TODO T18.x · implementar deducción "arrendamiento vivienda social arrendador" (deducción del arrendador · ampliar `DatosBaseDeduccion` con flag `esArrendadorViviendaSocial`).',
    'TODO T18.x · auditar 9 tramos exactos escala autonómica Aragón.',
    'TODO T18.x · resto deducciones Aragón · familias numerosas · descendientes · adquisición vivienda jóvenes · obras eficiencia energética.',
  ],
};
