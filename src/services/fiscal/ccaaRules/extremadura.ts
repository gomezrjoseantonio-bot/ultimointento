// ============================================================================
// ATLAS · TAREA 18.3 · Extremadura · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2018 (10 abril) Extremadura · texto refundido
//     tributos cedidos · DOE/BOE · consolidado.
//   · Manual Práctico AEAT 2025 · sección Comunidad Autónoma de Extremadura.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-extremadura/arrendamiento-vivienda-habitual.html`.
//
// Cobertura T18.3:
//   · Mínimos personales y familiares · TODO · provisional estatales.
//   · Escala autonómica · 9 tramos · 8% min · 25% max · modificada por
//     Decreto septiembre 2023 · TODO valores intermedios.
//   · Deducción 1 · Arrendamiento vivienda habitual · DL 1/2018 arts. 9 ·
//     12 bis · 13 · 30% · 1.000 € base / 1.500 € rural (<3.000 hab) ·
//     <36 / familia numerosa / ascendiente sep · 2 hijos / disc ≥65% ·
//     BI ≤30.000 indiv / ≤45.000 conjunta · NO otra vivienda <75 km ·
//     EXENCIÓN BI si rural <3.000 + familia numerosa o ascendiente 2 hijos.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2018 =
  'Decreto Legislativo 1/2018 (10/04/2018) Extremadura · texto refundido tributos cedidos · DOE/BOE · consolidado · escala modificada por Decreto septiembre 2023';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Extremadura';
const URL_AEAT_EXTREMADURA =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-extremadura/arrendamiento-vivienda-habitual.html';

// ─── Deducción Arrendamiento Vivienda Habitual · arts. 9, 12 bis, 13 ──────
// Cálculo · 30% × cantidades · tope 1.000 € general · 1.500 € rural (<3.000 hab).
// Requisitos AND ·
//   · Edad <36 O familia numerosa O ascendiente separado/sin matrimonio
//     con 2 hijos sin alimentos O discapacidad ≥65% (OR perfil)
//   · BI ≤30.000 individual / ≤45.000 conjunta · EXCEPCIÓN si rural <3.000
//     hab + familia numerosa O ascendiente 2 hijos · NO se aplica límite BI.
//   · NO ser titular >50% otra vivienda <75 km

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'extremadura-arrendamiento-vivienda-habitual',
  ccaa: 'Extremadura',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '30% de cantidades satisfechas · tope 1.000 € general · tope 1.500 € si vivienda en municipio <3.000 hab · <36 años O familia numerosa O ascendiente separado con 2 hijos sin alimentos O discapacidad ≥65% · BI ≤30.000 individual / ≤45.000 conjunta · NO otra vivienda >50% propiedad <75 km · EXCEPCIÓN BI si rural <3.000 hab + familia numerosa o ascendiente 2 hijos · tope conjunto 1.000 € por vivienda entre titulares.',
  fuenteOficial: `${FUENTE_DL_1_2018} · arts. 9, 12 bis, 13 · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_EXTREMADURA}`,
  verified: true,

  porcentaje: 0.3,
  // Tope al máximo posible (1.500 €) · `calcularImporte` selecciona efectivo.
  topeAbsolutoIndividual: 1500,
  topeAbsolutoConjunta: 1500,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    requiereNoPropiedadMasMitadOtraVivienda: true,
    baseImponibleMaxIndividual: 30000,
    baseImponibleMaxConjunta: 45000,
    condicionesElegibilidadOR: [
      { edadMaxima: 36 },
      { requiereFamiliaNumerosa: 'general' },
      { requiereDiscapacidad: { gradoMinimo: 65 } },
      // TODO T18.x · ascendiente separado/sin matrimonio con 2 hijos sin
      // alimentos · usamos `requiereFamiliaMonoparental` como aproximación
      // imperfecta (NO es lo mismo · pero cubre el caso más común).
      { requiereFamiliaMonoparental: true },
    ],
    // Excepción BI rural · si vivienda en <3.000 hab Y (familia numerosa O
    // ascendiente con 2 hijos) · se exime del check BI.
    excepcionBIRural: {
      poblacionMaxima: 3000,
      requiereFamiliaNumerosa: true,
      requiereAscendienteCon2Hijos: true,
    },
  },

  calcularImporte: (_ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    const poblacion = datosBase.municipioPoblacionHabitantes;
    const esRural = poblacion !== undefined && poblacion < 3000;
    const tope = esRural ? 1500 : 1000;
    const importe = cantidad * 0.3;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Extremadura ────────────────────────────────────────────

export const EXTREMADURA_RULES: CcaaRules = {
  ccaa: 'Extremadura',
  codigoIso: 'ES-EX',
  fuenteOficialMinimos: `${FUENTE_DL_1_2018} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_1_2018} · escala 9 tramos · 8% min · 25% max · modificada Decreto sept 2023 · vigente 2025 · TODO valores`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 9 tramos · 8% min · 25% max · TODO valores ───
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.08 },
    { baseHasta: 20200, tipoMarginal: 0.105 },
    { baseHasta: 24200, tipoMarginal: 0.135 },
    { baseHasta: 35200, tipoMarginal: 0.165 },
    { baseHasta: 60000, tipoMarginal: 0.205 },
    { baseHasta: 80200, tipoMarginal: 0.225 },
    { baseHasta: 99200, tipoMarginal: 0.235 },
    { baseHasta: 120200, tipoMarginal: 0.24 },
    { baseHasta: Infinity, tipoMarginal: 0.25 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · auditar escala 9 tramos
  notasMigracion: [
    'Deducción arrendamiento · 30% · 1.000/1.500 € (rural <3.000 hab) · BI ≤30/45k indiv/conjunta · EXENCIÓN BI si rural+familia numerosa o ascendiente 2 hijos · `verified=true` por DL 1/2018 + Manual AEAT 2025.',
    'TODO T18.x · auditar 9 tramos exactos escala autonómica Extremadura · valores estimados.',
    'TODO T18.x · refinar `condicionesElegibilidadOR` · "ascendiente separado con 2 hijos sin alimentos" usa `requiereFamiliaMonoparental` como aproximación · ampliar `DatosBaseDeduccion` con flag específico cuando aparezca caso.',
    'TODO T18.x · localizar lista oficial municipios <3.000 hab Extremadura.',
    'TODO T18.x · implementar tope conjunto 1.000 € por vivienda entre titulares (el motor hoy aplica 1.000 € por contrato individual · si hay 2+ titulares con derecho · regla "no superar 1.000 € entre todos" · refactor cuando aparezca caso).',
    'TODO T18.x · resto deducciones · residencia habitual municipios <3.000 hab · descendientes · familia numerosa · adquisición vivienda jóvenes.',
  ],
};
