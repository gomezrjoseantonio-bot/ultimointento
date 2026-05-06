// ============================================================================
// ATLAS · TAREA 18.2 · Galicia · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2011 (28 julio) Galicia · texto refundido
//     tributos cedidos · DOG/BOE.
//   · Manual Práctico AEAT 2025 · sección Comunidad Autónoma de Galicia.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-galicia/alquiler-vivienda-habitual.html`.
//   · Atriga · `https://www.atriga.gal/es_ES/informacion-tributaria/tributos/imposto-sobre-a-renda-das-persoas-fisicas/`.
//
// Cobertura T18.2:
//   · Mínimos personales y familiares · pre-investigación NO localizó
//     diferencia con estatales · provisional `verified=false` paquete ·
//     estatales como base.
//   · Escala autonómica · TODO valores intermedios · `verified=false`.
//   · Deducción 1 · Alquiler vivienda habitual · DL 1/2011 art. 5.Siete ·
//     10%/300 € base · 20%/600 € si 2+ hijos menores · doble si
//     discapacidad ≥33% (600/1.200 €) · ≤35 · BI ≤22.000 € · fianza IGVS.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2011 =
  'Decreto Legislativo 1/2011 (28/07/2011) Galicia · texto refundido tributos cedidos · DOG/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Galicia';
const URL_AEAT_GALICIA =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-galicia/alquiler-vivienda-habitual.html';

// ─── Deducción Alquiler Vivienda Habitual · DL 1/2011 art. 5.Siete ─────────
// Cálculos custom · porcentajes y topes variables ·
//   · 10% / 300 € · base
//   · 20% / 600 € · si 2 o más hijos menores
//   · DOBLE si arrendatario con discapacidad ≥33% · 600 € / 1.200 €
// Requisitos · ≤35 · BI ≤22.000 € · vivienda habitual · fianza depositada
// en Instituto Galego de Vivenda y Solo (IGVS) o copia denuncia.

const DEDUCCION_ALQUILER: DeduccionAutonomica = {
  id: 'galicia-alquiler-vivienda-habitual',
  ccaa: 'Galicia',
  nombre: 'Alquiler de vivienda habitual',
  descripcion:
    '10% (tope 300 €) base · 20% (tope 600 €) si 2 o más hijos menores · cuantías SE DUPLICAN si arrendatario con discapacidad ≥33% (600/1.200 €) · ≤35 años · BI ≤22.000 € (general - mínimo personal y familiar) · fianza depositada en IGVS.',
  fuenteOficial: `${FUENTE_DL_1_2011} · art. 5.Siete · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_GALICIA}`,
  verified: true,

  // Tope al máximo posible (1.200 €) · `calcularImporte` selecciona el
  // tope efectivo (300/600/1.200 según condiciones).
  porcentaje: 0.1,
  topeAbsolutoIndividual: 1200,
  topeAbsolutoConjunta: 1200,

  requisitos: {
    edadMaxima: 36, // ≤35
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    requiereFianzaDepositada: true,
    baseImponibleMaxIndividual: 22000,
    baseImponibleMaxConjunta: 22000,
  },

  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    const dosOMasHijosMenores = (datosBase.numeroHijosMenores ?? 0) >= 2;
    const tieneDiscapacidad =
      ctx.discapacidadTitular === 'entre33y65' ||
      ctx.discapacidadTitular === 'mas65';
    let porcentaje = 0.1;
    let tope = 300;
    if (dosOMasHijosMenores) {
      porcentaje = 0.2;
      tope = 600;
    }
    if (tieneDiscapacidad) {
      porcentaje *= 2;
      tope *= 2;
    }
    const importe = cantidad * porcentaje;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Galicia ────────────────────────────────────────────────

export const GALICIA_RULES: CcaaRules = {
  ccaa: 'Galicia',
  codigoIso: 'ES-GA',
  fuenteOficialMinimos: `${FUENTE_DL_1_2011} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_1_2011} · escala autonómica · TODO valores por tramo`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · TODO valores intermedios ──────────────────────
  // Pre-investigación NO localizó valores exactos por tramo · usamos
  // estructura supletoria · `verified=false` paquete · motor cae a
  // supletoria mientras tanto.
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.09 },
    { baseHasta: 20200, tipoMarginal: 0.115 },
    { baseHasta: 35200, tipoMarginal: 0.155 },
    { baseHasta: 60000, tipoMarginal: 0.185 },
    { baseHasta: Infinity, tipoMarginal: 0.225 },
  ],

  deducciones: [DEDUCCION_ALQUILER],

  verified: false, // TODO T18.x · auditar escala + mínimos
  notasMigracion: [
    'Deducción alquiler vivienda habitual · 10/20/40% · 300/600/1.200 € (doble si discapacidad ≥33%) · ≤35 · BI ≤22.000 € · `verified=true` por DL 1/2011 + Manual AEAT 2025.',
    'TODO T18.x · auditar 5 tramos exactos escala autonómica Galicia · web Atriga.',
    'TODO T18.x · auditar mínimos autonómicos vs estatales · pre-investigación NO localizó diferencia.',
    'TODO T18.x · resto deducciones Galicia · adecuación inmueble arrendamiento (15%/9.000 €) · climatización/ACS renovables (5%/280 €) · vivienda vacía propietario · rehabilitación centros históricos · contribuyentes discapacidad ≥65 · alta y cuota internet.',
  ],
};
