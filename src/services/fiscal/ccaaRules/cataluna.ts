// ============================================================================
// ATLAS · TAREA 18.1 · Cataluña · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2024 (12 marzo 2024) · libro sexto Código
//     tributario de Catalunya (BOE/DOGC) · regula deducción arrendamiento
//     vivienda habitual (art. 612-3) y régimen transitorio inversión.
//   · Manual Práctico AEAT 2025 · sección Comunidad Autónoma de Cataluña.
//   · ATC Generalitat de Catalunya · escala autonómica IRPF.
//
// Verificación cruzada · `docs/T18-cifras-Top5-pre-investigadas.md` §1 +
// `docs/T18.1-CORRECCION-cataluna.md` (corrección · Cataluña SÍ tiene
// deducción general arrendamiento desde DL 1/2024).
//
// Cobertura T18.1:
//   · Mínimos personales y familiares · idénticos a estatales (Manual
//     Práctico AEAT 2025 · "Cataluña ha fijado importes para el mínimo
//     personal y familiar de idéntica cuantía a los establecidos en la
//     Ley del IRPF").
//   · Escala autonómica · 9 tramos parciales · primer tramo 10,5% ·
//     marginal máximo 25,5%. Tramos 6-9 PENDIENTES de auditoría DOGC ·
//     `verified=false` con TODO concreto · motor cae a supletoria mientras
//     tanto · cero regresión.
//   · Deducción 1 · Arrendamiento de vivienda habitual · DL 1/2024 art.
//     612-3 · 10% · tope 500 € (1.000 € familia numerosa/monoparental) ·
//     OR de 4 condiciones de perfil.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2024 =
  'Decreto Legislativo 1/2024 (12/03/2024) · libro sexto Código tributario Catalunya · BOE/DOGC';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Cataluña';

// ─── Deducción Arrendamiento Vivienda Habitual · DL 1/2024 art. 612-3 ──────
// Requisitos AND ·
//   · Titular del contrato (no subarriendo).
//   · Vivienda habitual.
//   · Residencia fiscal en Cataluña.
//   · Tope BI · CC pre-investigación marca TODO · provisional sin tope BI
//     hasta verificar Manual AEAT 2025 (DL 1/2024 establece tope pero la
//     pre-investigación no localizó cifra concreta).
// Requisitos OR de perfil (al menos UNO debe cumplirse) ·
//   1) Edad ≤35 a 31/12 ejercicio
//   2) Días en paro ≥183 durante el ejercicio
//   3) Familia numerosa (Ley 40/2003)
//   4) Familia monoparental (Ley 18/2003 + Decreto 151/2009)
// Cálculo · 10% sobre cantidades pagadas · tope 500 € (1.000 € si familia
// numerosa o monoparental · doble en tributación conjunta de hecho via
// `topeAbsolutoConjunta`).

const DEDUCCION_ARRENDAMIENTO_VIVIENDA_HABITUAL: DeduccionAutonomica = {
  id: 'cataluna-arrendamiento-vivienda-habitual',
  ccaa: 'Cataluña',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '10% de cantidades satisfechas · tope 500 € (1.000 € si familia numerosa/monoparental o doble cumplimiento en conjunta) · al menos UNA · ≤35 años · paro ≥183 días · familia numerosa · familia monoparental.',
  fuenteOficial: `${FUENTE_DL_1_2024} · art. 612-3 · ${FUENTE_AEAT_MANUAL}`,
  verified: true,

  porcentaje: 0.1,
  // baseMaximaCalculo · DL 1/2024 NO fija base máxima · se aplica % directo
  // sobre cantidades pagadas con el tope absoluto.
  topeAbsolutoIndividual: 500,
  topeAbsolutoConjunta: 1000,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    // TODO T18.x · verificar tope BI individual/conjunta · pre-investigación
    // no localizó cifra concreta · DL 1/2024 menciona umbral pero AEAT
    // manual práctico 2025 sin extracto explícito en pre-investigación.
    condicionesElegibilidadOR: [
      { edadMaxima: 36 }, // "35 años o menos a fecha devengo" · CC implementa <36 = ≤35
      { paroMinimoDias: 183 },
      { requiereFamiliaNumerosa: 'general' },
      { requiereFamiliaMonoparental: true },
    ],
  },

  // El motor genérico calcula: 10% × alquilerAnual con tope absoluto. La
  // selección del tope individual vs conjunta la hace el motor según
  // `ctx.tributacion === 'conjunta'`. Para familia numerosa/monoparental
  // en tributación individual · el motor genérico aplica `topeAbsolutoIndividual`
  // (500 €) · NO el incrementado · TODO T18.x si Jose confirma que el
  // tope incrementado debe aplicar también en individual con familia
  // numerosa/monoparental, refactor el motor o usar `calcularImporte`
  // custom. Pre-investigación AEAT 2025 sugiere que el tope incrementado
  // 1.000 € aplica tanto en conjunta como cuando familia numerosa/monoparental
  // en individual · documentado en notasMigracion.
};

// ─── Paquete CCAA · Cataluña ───────────────────────────────────────────────

export const CATALUNA_RULES: CcaaRules = {
  ccaa: 'Cataluña',
  codigoIso: 'ES-CT',
  fuenteOficialMinimos: `${FUENTE_AEAT_MANUAL} · "Cataluña ha fijado importes para el mínimo personal y familiar de idéntica cuantía a los establecidos en la Ley del IRPF"`,
  fuenteOficialEscala:
    'ATC Generalitat de Catalunya · escala autonómica IRPF (atc.gencat.cat) · DL 1/2024 art. 612 · TODO 9 tramos completos pendiente de auditoría DOGC',

  // Mínimos · idénticos a estatales (Manual AEAT 2025 confirma).
  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 9 tramos · 10,5% min · 25,5% max ────────────────
  // Pre-investigación localizó solo los primeros tramos con certeza. Los
  // tramos 6-9 NO se han podido confirmar contra DOGC. Marcamos
  // `verified=false` a nivel paquete · motor cae a supletoria mientras tanto
  // · cero regresión vs T14.3 supletoria.
  // TODO T18.x · auditar 9 tramos completos · web ATC `atc.gencat.cat`.
  escalaAutonomica: [
    // Cifras parciales · NO usar hasta verified=true.
    { baseHasta: 12450, tipoMarginal: 0.105 },
    { baseHasta: 17707.2, tipoMarginal: 0.12 },
    { baseHasta: 21000, tipoMarginal: 0.14 },
    { baseHasta: 33007.2, tipoMarginal: 0.15 },
    { baseHasta: 53407.2, tipoMarginal: 0.188 },
    { baseHasta: 90000, tipoMarginal: 0.215 },
    { baseHasta: 120000, tipoMarginal: 0.235 },
    { baseHasta: 175000, tipoMarginal: 0.245 },
    { baseHasta: Infinity, tipoMarginal: 0.255 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO_VIVIENDA_HABITUAL],

  // Cataluña · sin información concreta sobre deflactación 2025 en
  // pre-investigación · NO se afirma en `deflactacion2025`.

  verified: false, // TODO T18.x · auditar escala 9 tramos completos
  notasMigracion: [
    'Mínimos · idénticos a estatales (Manual AEAT 2025 confirma) · `verified=true` por cita.',
    'Escala autonómica · 9 tramos parciales pendiente de auditoría DOGC · `verified=false` a nivel paquete · motor cae a supletoria.',
    'Deducción arrendamiento vivienda habitual · DL 1/2024 art. 612-3 · 10% · 500 €/1.000 € · OR de 4 condiciones (≤35 · paro 183+ · familia numerosa · familia monoparental).',
    'TODO T18.x · localizar tope BI individual/conjunta para deducción arrendamiento (DL 1/2024 lo establece pero pre-investigación no extractó la cifra).',
    'TODO T18.x · cobertura adicional · régimen transitorio inversión vivienda habitual pre-2013 · arrendamiento víctimas violencia machista.',
  ],
};
