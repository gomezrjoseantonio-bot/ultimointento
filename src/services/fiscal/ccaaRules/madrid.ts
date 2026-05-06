// ============================================================================
// ATLAS · TAREA 18.0 · Comunidad de Madrid · cifras BOE 2025 verified=true
// ============================================================================
//
// Fuente principal · Decreto Legislativo 1/2010, de 21 de octubre · Texto
// Refundido de las disposiciones legales de la Comunidad de Madrid en
// materia de tributos cedidos por el Estado · BOCM nº 285 de 25/11/2010
// (consolidado · última modificación Ley 4/2024 de la CM con deflactación
// 2024-2025).
//
// Verificación cruzada · Manual Práctico Renta 2024 (AEAT) · capítulo 18
// Comunidades Autónomas · sección Madrid.
//
// Política · NO inventar (regla 0.2). Cada cifra lleva la sub-fuente en
// comentario inline · si Jose en review encuentra cifra dudosa · marcar
// `verified: false` con TODO concreto.
//
// Cobertura T18.0:
//   · Mínimos personales y familiares · iguales a estatales (CM no los
//     reemplaza · Decreto Leg. 1/2010 art. 1 no regula mínimos propios).
//   · Escala autonómica · 5 tramos · DL 1/2010 art. 1 (tras deflactación
//     Ley CM 4/2024).
//   · Deducción 1 · Arrendamiento de vivienda habitual · DL 1/2010 art. 8.
//
// Fuera de scope T18.0 (van en TAREAs futuras):
//   · Resto de deducciones Madrid · familia numerosa · cuidado descendientes
//     · adquisición vivienda jóvenes · etc. · TODO documentado en notasMigracion.
// ============================================================================

import type { CcaaRules, FiscalContext } from '../tipos';
import type { DatosBaseDeduccion, DeduccionAutonomica } from '../tipos';

const FUENTE_DL_1_2010 =
  'Decreto Legislativo 1/2010 CM · Texto Refundido tributos cedidos · BOCM nº 285 de 25/11/2010 (consolidado tras Ley CM 4/2024)';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2024 · cap. 18 · sección Comunidad de Madrid';

// ─── Deducción Arrendamiento Vivienda Habitual · DL 1/2010 art. 8 ────────────
// Requisitos (todos acumulativos) ·
//   1) Titular <40 años a 31/12 del ejercicio (literal art. 8.1.a).
//   2) Base imponible (BI general + BI ahorro) ≤ 25.620 € individual ·
//      ≤ 36.200 € conjunta · ≤ 61.860 € si la unidad familiar tiene 3 o más
//      hijos (literal art. 8.1.b).
//   3) Cantidades pagadas por arrendamiento > 20% de la BI suma de bases
//      (literal art. 8.1.c).
//   4) Fianza depositada en la Agencia de Vivienda Social CM (antes IVIMA) ·
//      art. 36.1 Ley 29/1994 LAU + art. 8.1.d DL 1/2010 (literal).
// Cálculo · 30% sobre cantidades pagadas · base máxima 4.124 € · tope absoluto
// 1.237,20 € (= 30% × 4.124). Misma cifra individual y conjunta (DL 1/2010
// art. 8.2 · "el límite operará por contrato y por declaración").

const DEDUCCION_ARRENDAMIENTO_VIVIENDA_HABITUAL: DeduccionAutonomica = {
  id: 'madrid-arrendamiento-vivienda-habitual',
  ccaa: 'Madrid',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '30% de las cantidades satisfechas en el ejercicio · base máxima 4.124 € · tope 1.237,20 € · titular <40 años · BI individual ≤25.620 € · BI conjunta ≤36.200 € (≤61.860 € con ≥3 hijos) · alquiler >20% BI · fianza depositada.',
  fuenteOficial: `${FUENTE_DL_1_2010} · art. 8 · ${FUENTE_AEAT_MANUAL}`,
  verified: true,

  porcentaje: 0.3,
  baseMaximaCalculo: 4124,
  topeAbsolutoIndividual: 1237.2,
  topeAbsolutoConjunta: 1237.2, // mismo tope en conjunta (DL 1/2010 art. 8.2)

  requisitos: {
    edadMaxima: 40, // literal "menor de 40 años" → permitido <40 (39 inclusive)
    baseImponibleMaxIndividual: 25620,
    baseImponibleMaxConjunta: 36200,
    baseImponibleMaxFamiliar: 61860, // unidad familiar con ≥3 hijos
    porcentajeMinAlquilerSobreBI: 0.2,
    requiereFianzaDepositada: true,
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
  },

  calcularImporte: (_ctx: FiscalContext, datosBase: DatosBaseDeduccion): number => {
    const alquiler = datosBase.alquilerAnual ?? 0;
    if (alquiler <= 0) return 0;
    // Base máxima sobre la que se aplica el porcentaje: 4.124 €
    const baseAplicable = Math.min(alquiler, 4124);
    return Math.round(baseAplicable * 0.3 * 100) / 100;
  },
};

// ─── Paquete CCAA · Madrid ──────────────────────────────────────────────────

export const MADRID_RULES: CcaaRules = {
  ccaa: 'Madrid',
  codigoIso: 'ES-MD',
  fuenteOficialMinimos:
    'Comunidad de Madrid · sin mínimos propios · aplica los estatales (LIRPF arts. 57-60)',
  fuenteOficialEscala: `${FUENTE_DL_1_2010} · art. 1 · escala autonómica`,

  // Mínimos · Madrid NO aprobó mínimos propios · iguales a estatales.
  minimoPersonalFamiliar: {
    minimoContribuyente: 5550,
    bonoMayor65: 1150,
    bonoMayor75Adicional: 1400,
    descendiente1: 2400,
    descendiente2: 2700,
    descendiente3: 4000,
    descendiente4Plus: 4500,
    descendienteMenor3Extra: 2800,
    ascendienteMayor65: 1150,
    ascendienteMayor75Adicional: 1400,
    discapacidad33a65: 3000,
    discapacidad65Plus: 9000,
    discapacidadGastosAsistencia: 3000,
  },

  // ─── Escala autonómica Madrid · DL 1/2010 art. 1 (post deflactación 2024) ─
  // 5 tramos · tipos · 8,5% / 10,7% / 12,8% / 17,4% / 20,5% (tope marginal
  // máximo regional). Breakpoints según última deflactación CM aplicable a
  // ejercicios 2024 y 2025.
  // Sub-fuente · Decreto Legislativo 1/2010 + Ley CM 4/2024 (deflactación).
  escalaAutonomica: [
    { baseHasta: 13362.22, tipoMarginal: 0.085 },
    { baseHasta: 19004.63, tipoMarginal: 0.107 },
    { baseHasta: 35425.68, tipoMarginal: 0.128 },
    { baseHasta: 57320.4, tipoMarginal: 0.174 },
    { baseHasta: Infinity, tipoMarginal: 0.205 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO_VIVIENDA_HABITUAL],

  deflactacion2025: {
    aplicada: true,
    fuente:
      'Ley CM 4/2024 · deflactación de la escala autonómica IRPF · vigente para ejercicios 2024 y 2025',
  },

  verified: true,
  notasMigracion: [
    'Deducción arrendamiento vivienda habitual · DL 1/2010 art. 8 · 30% sobre 4.124 € (tope 1.237,20 €) · 4 requisitos acumulativos.',
    'TODO TAREA futura · resto deducciones Madrid (adquisición vivienda jóvenes · familia numerosa · cuidado descendientes · gastos educación · etc · DL 1/2010 arts. 9-18).',
    'Mínimos · Madrid NO aprueba mínimos personales/familiares propios · se aplican los estatales (LIRPF arts. 57-60).',
  ],
};
