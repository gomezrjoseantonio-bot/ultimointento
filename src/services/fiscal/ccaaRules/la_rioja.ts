// ============================================================================
// ATLAS · TAREA 18.3 · La Rioja · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Texto Refundido tributos cedidos La Rioja · BOR/BOE · consolidado.
//   · Manual Práctico AEAT 2025 · sección Comunidad Autónoma de La Rioja.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-rioja.html`.
//
// Cobertura T18.3:
//   · Mínimos personales y familiares · TODO · provisional estatales.
//   · Escala autonómica · 5 tramos · TODO valores intermedios.
//   · Deducción 1 · Arrendamiento vivienda habitual jóvenes <36 · 10%
//     general (tope 300 €) · 20% rural (tope 400 €) · BI ≤18.030 / ≤30.050 ·
//     ITP/AJD presentado.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_TR_LA_RIOJA =
  'Texto Refundido tributos cedidos La Rioja · BOR/BOE · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de La Rioja';
const URL_AEAT_LA_RIOJA =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-rioja.html';

// ─── Deducción Arrendamiento Vivienda Habitual · jóvenes <36 ──────────────

const DEDUCCION_ARRENDAMIENTO_JOVENES: DeduccionAutonomica = {
  id: 'la-rioja-arrendamiento-vivienda-habitual-jovenes',
  ccaa: 'La Rioja',
  nombre: 'Arrendamiento de vivienda habitual jóvenes <36',
  descripcion:
    '10% de cantidades satisfechas · tope 300 € por contrato · 20% (tope 400 €) si vivienda en pequeño municipio La Rioja (lista oficial CCAA) · <36 años · BI ≤18.030 individual / ≤30.050 conjunta · BI ahorro ≤1.800 € · ITP/AJD del contrato presentado.',
  fuenteOficial: `${FUENTE_TR_LA_RIOJA} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_LA_RIOJA}`,
  verified: false, // TODO · BI máx exact a confirmar contra Manual AEAT 2025

  porcentaje: 0.1,
  // Tope al máximo posible (400 €) · `calcularImporte` selecciona efectivo.
  topeAbsolutoIndividual: 400,
  topeAbsolutoConjunta: 400,

  requisitos: {
    edadMaxima: 36, // <36
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    requiereItpAjdPresentado: true,
    baseImponibleMaxIndividual: 18030,
    baseImponibleMaxConjunta: 30050,
  },

  calcularImporte: (_ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    // Modalidad reforzada · pequeño municipio La Rioja · porcentaje 20%
    // y tope 400 €. Sin lista oficial · usamos `municipioPoblacionHabitantes`
    // ≤2.500 como aproximación (TODO T18.x · lista oficial CCAA).
    const poblacion = datosBase.municipioPoblacionHabitantes;
    const esRuralReforzado = poblacion !== undefined && poblacion <= 2500;
    const porcentaje = esRuralReforzado ? 0.2 : 0.1;
    const tope = esRuralReforzado ? 400 : 300;
    const importe = cantidad * porcentaje;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · La Rioja ───────────────────────────────────────────────

export const LA_RIOJA_RULES: CcaaRules = {
  ccaa: 'La Rioja',
  codigoIso: 'ES-RI',
  fuenteOficialMinimos: `${FUENTE_TR_LA_RIOJA} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_TR_LA_RIOJA} · escala 5 tramos · TODO valores`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 5 tramos · TODO valores intermedios ────────────
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.08 },
    { baseHasta: 20200, tipoMarginal: 0.106 },
    { baseHasta: 35200, tipoMarginal: 0.135 },
    { baseHasta: 60000, tipoMarginal: 0.179 },
    { baseHasta: Infinity, tipoMarginal: 0.225 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO_JOVENES],

  verified: false, // TODO T18.x · auditar escala 5 tramos + BI máx
  notasMigracion: [
    'Deducción arrendamiento jóvenes · 10/20% · 300/400 € · <36 · ITP/AJD presentado · `verified=false` por BI máx exact pendiente Manual AEAT 2025.',
    'TODO T18.x · auditar 5 tramos exactos escala autonómica La Rioja · verificar número de tramos.',
    'TODO T18.x · localizar lista oficial pequeños municipios La Rioja con derecho a deducción reforzada (20%/400€) · usamos ≤2.500 hab como aproximación.',
    'TODO T18.x · auditar BI máx exact (18.030/30.050) contra Manual AEAT 2025.',
    'TODO T18.x · resto deducciones La Rioja · adquisición/construcción/rehabilitación vivienda en pequeños municipios · acceso internet · suministros luz/gas · escuelas infantiles 0-3 · inicio actividad emprendedores · 2ª vivienda rural · intereses préstamos jóvenes <30 · vehículos eléctricos · acciones empresas riojanas.',
  ],
};
