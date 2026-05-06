// ============================================================================
// ATLAS · TAREA 18.1 · Castilla y León · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2013 (12 septiembre) Castilla y León · texto
//     refundido tributos cedidos · BOCYL (consolidado).
//   · Manual Práctico AEAT 2025 · sección Castilla y León.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-castilla-leon/arrendamiento-vivienda-habitual-jovenes.html`.
//   · `https://tributos.jcyl.es`.
//
// Cobertura T18.1:
//   · Mínimos personales y familiares · idénticos a estatales (Manual
//     Práctico AEAT 2025 · "Castilla y León y Cataluña han fijado importes
//     de idéntica cuantía a la Ley del IRPF").
//   · Escala autonómica · 5 tramos · 9% min · 21,5% max · TODO valores
//     intermedios.
//   · Deducción 1 · Arrendamiento vivienda habitual jóvenes · 20% (459 €) ·
//     25% (612 €) si rural · ≤35 años · BI ≤18.900 / 31.500 · CyL deduce
//     ayudas bono alquiler joven antes de aplicar tope.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2013 =
  'Decreto Legislativo 1/2013 (12/09/2013) Castilla y León · texto refundido tributos cedidos · BOCYL · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Castilla y León';
const URL_AEAT_CYL =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-castilla-leon/arrendamiento-vivienda-habitual-jovenes.html';
const URL_TRIBUTOS_JCYL = 'https://tributos.jcyl.es';

// ─── Deducción Arrendamiento Vivienda Habitual Jóvenes ─────────────────────
// CyL · particularidad · las ayudas públicas de bono alquiler joven se
// RESTAN de las cantidades pagadas antes de aplicar % y tope · evita
// duplicidad subvención + deducción.

const DEDUCCION_ARRENDAMIENTO_JOVENES: DeduccionAutonomica = {
  id: 'cyl-arrendamiento-vivienda-habitual-jovenes',
  ccaa: 'Castilla y León',
  nombre: 'Arrendamiento de vivienda habitual por jóvenes',
  descripcion:
    '20% (tope 459 €) base · 25% (tope 612 €) en municipio rural ≤10.000 habitantes (o ≤3.000 con distancia >30 km de capital) · ≤35 años · BI ≤18.900 individual / ≤31.500 conjunta (BI = total - mínimo personal y familiar) · CyL resta ayudas bono alquiler joven antes del tope.',
  fuenteOficial: `${FUENTE_DL_1_2013} · arts. 7.4, 7.5 y 10 · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_CYL} · ${URL_TRIBUTOS_JCYL}`,
  verified: true,

  porcentaje: 0.2,
  topeAbsolutoIndividual: 459,
  topeAbsolutoConjunta: 459, // tope individual mismo en conjunta · doble si ambos cumplen (TODO confirmar manual)

  requisitos: {
    edadMaxima: 36, // "menor de 36 años" → permitido <36 (35 inclusive)
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    baseImponibleMaxIndividual: 18900,
    baseImponibleMaxConjunta: 31500,
    // TODO T18.x · municipio rural · ampliar `DatosBaseDeduccion` con
    // `municipioRuralCyL` para distinguir 25%/612 € vs 20%/459 €. Hoy se
    // aplica 20%/459 € por defecto.
  },

  // Cálculo · resta ayudas bono alquiler joven ANTES de aplicar % y tope
  // (DL 1/2013 art. 7.5 · "se descontarán de la cuantía las ayudas
  // públicas otorgadas al contribuyente por arrendamiento").
  calcularImporte: (_ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    const ayudas = datosBase.ayudasPublicasArrendamiento ?? 0;
    const baseDeduccion = Math.max(0, cantidad - ayudas);
    if (baseDeduccion <= 0) return 0;
    // % rural · TODO T18.x · `municipioRuralCyL` flag · hoy 20% por defecto.
    const porcentaje = 0.2;
    const tope = 459;
    const importe = baseDeduccion * porcentaje;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Castilla y León ────────────────────────────────────────

export const CASTILLA_Y_LEON_RULES: CcaaRules = {
  ccaa: 'Castilla y León',
  codigoIso: 'ES-CL',
  fuenteOficialMinimos: `${FUENTE_AEAT_MANUAL} · "Castilla y León ha fijado importes para el mínimo personal y familiar de idéntica cuantía a los establecidos en la Ley del IRPF"`,
  fuenteOficialEscala: `${FUENTE_DL_1_2013} · 5 tramos · 9%-21,5% · TODO valores intermedios`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 5 tramos · 9% min · 21,5% max ──────────────────
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.09 },
    { baseHasta: 20200, tipoMarginal: 0.12 },
    { baseHasta: 35200, tipoMarginal: 0.14 },
    { baseHasta: 53407.2, tipoMarginal: 0.185 },
    { baseHasta: Infinity, tipoMarginal: 0.215 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO_JOVENES],

  verified: false, // TODO T18.x · auditar 5 tramos exactos
  notasMigracion: [
    'Mínimos · idénticos a estatales (Manual AEAT 2025 confirma).',
    'Deducción arrendamiento jóvenes · 20%/459 € (25%/612 € rural) · ≤35 · BI ≤18,9k/31,5k · resta ayudas bono alquiler antes del tope · `verified=true` por cifras Manual AEAT + DL 1/2013.',
    'TODO T18.x · 5 tramos exactos escala CyL (9%-21,5%) · pre-investigación localizó rango · valores intermedios estimados.',
    'TODO T18.x · ampliar `DatosBaseDeduccion` con `municipioRuralCyL` para diferenciar 20%/459 vs 25%/612 (rural ≤10.000 habitantes o ≤3.000 si dista >30 km capital).',
    'TODO T18.x · resto deducciones · adquisición vivienda nueva construcción 7,5% · nacimiento/adopción (1.010-2.351 € · doble en discapacidad ≥33%) · adopción · rehabilitación subvencionada · adquisición/rehabilitación rural ≤36 · familias numerosas · empleado hogar · I+D+i.',
  ],
};
