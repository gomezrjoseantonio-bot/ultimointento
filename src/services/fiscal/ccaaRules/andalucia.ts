// ============================================================================
// ATLAS · TAREA 18.1 · Andalucía · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Ley 5/2021 (20 julio) Tributos Cedidos de Andalucía · BOE-A-2021-12567 ·
//     consolidado tras Ley 8/2025 (22 diciembre).
//   · Manual Práctico AEAT 2025 · sección Comunidad Autónoma de Andalucía.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/10-cumplimentacion-irpf-deducciones-autonomicas/10_1-andalucia/10_1_3-cantidades-invertidas-alquiler-vivienda-habitual.html`.
//
// Cobertura T18.1:
//   · Mínimos personales y familiares · pre-investigación NO localizó
//     diferencia con estatales · provisional `verified=false` a nivel
//     paquete · motor usa estatales como base hasta auditoría Ley 5/2021.
//   · Escala autonómica · 5 tramos · 9,5% min · 22,5% max · TODOs
//     concretos por tramo (pre-investigación localizó rango y número de
//     tramos · no valores intermedios).
//   · Deducción 1 · Cantidades invertidas en alquiler vivienda habitual ·
//     Ley 5/2021 art. concreto · 15% · tope 1.200 € (1.500 € discapacidad)
//     · ≤35 OR ≥65 OR víctima violencia/terrorismo · BI ≤25.000/30.000.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_LEY_5_2021 =
  'Ley 5/2021 (20/07/2021) Tributos Cedidos de Andalucía · BOE-A-2021-12567 · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Comunidad Autónoma de Andalucía';
const URL_AEAT_ARRENDAMIENTO =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-ayuda-presentacion/irpf-2025/10-cumplimentacion-irpf-deducciones-autonomicas/10_1-andalucia/10_1_3-cantidades-invertidas-alquiler-vivienda-habitual.html';

// ─── Deducción Arrendamiento Vivienda Habitual ─────────────────────────────

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'andalucia-arrendamiento-vivienda-habitual',
  ccaa: 'Andalucía',
  nombre: 'Cantidades invertidas en alquiler vivienda habitual',
  descripcion:
    '15% de cantidades satisfechas · tope 1.200 € (1.500 € si discapacidad) · ≤35 O ≥65 años (o víctima violencia/terrorismo) · BI ≤25.000 € individual / ≤30.000 € conjunta · NIF arrendador en autoliquidación.',
  fuenteOficial: `${FUENTE_LEY_5_2021} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_ARRENDAMIENTO}`,
  verified: true,

  porcentaje: 0.15,
  // T18.1 fix · `topeAbsoluto*` al MÁXIMO posible (1.500 € si discapacidad)
  // · `calcularImporte` selecciona el tope efectivo (1.200 / 1.500) · evita
  // doble tope que recortaba 1.500 a 1.200.
  topeAbsolutoIndividual: 1500,
  topeAbsolutoConjunta: 1500,
  // baseMaximaCalculo · NO definida · 15% × cantidades pagadas con tope absoluto.

  requisitos: {
    baseImponibleMaxIndividual: 25000,
    baseImponibleMaxConjunta: 30000,
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    condicionesElegibilidadOR: [
      { edadMaxima: 36 }, // ≤35 años
      { edadMinima: 65 }, // ≥65 años · usamos edadMinima sobre el OR · sin tope superior
    ],
    // TODO T18.x · víctima violencia/terrorismo · ampliar
    // `DatosBaseDeduccion` con flag específico · pre-investigación
    // confirma como condición OR adicional · hoy se evalúa solo con edad.
  },

  // Tope incrementado por discapacidad · si datosBase indica discapacidad
  // titular con grado ≥33% · usar tope 1.500 €. El motor genérico usa
  // `topeAbsolutoIndividual` por defecto · usamos `calcularImporte` para
  // diferenciar el tope cuando hay discapacidad acreditada.
  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    const importe15 = cantidad * 0.15;
    const tieneDiscapacidad =
      ctx.discapacidadTitular === 'entre33y65' ||
      ctx.discapacidadTitular === 'mas65';
    const tope = tieneDiscapacidad ? 1500 : 1200;
    return Math.round(Math.min(importe15, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Andalucía ──────────────────────────────────────────────

export const ANDALUCIA_RULES: CcaaRules = {
  ccaa: 'Andalucía',
  codigoIso: 'ES-AN',
  fuenteOficialMinimos:
    'Ley 5/2021 Tributos Cedidos Andalucía · TODO T18.x · auditar mínimos autonómicos vs estatales',
  fuenteOficialEscala:
    'Ley 5/2021 Tributos Cedidos Andalucía · 5 tramos · TODO T18.x · auditar valores por tramo',

  // Pre-investigación NO confirmó diferencia · provisional · usamos estatales
  // y marcamos `verified=false` a nivel paquete.
  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 5 tramos · 9,5% min · 22,5% max · TODO valores ──
  // TODO T18.x · auditar Ley 5/2021 / Hacienda Junta de Andalucía · valores
  // por tramo · pre-investigación localizó rango pero no breakpoints.
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.095 },
    { baseHasta: 20200, tipoMarginal: 0.12 },
    { baseHasta: 35200, tipoMarginal: 0.15 },
    { baseHasta: 60000, tipoMarginal: 0.185 },
    { baseHasta: Infinity, tipoMarginal: 0.225 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · auditar mínimos + 5 tramos exactos
  notasMigracion: [
    'Deducción arrendamiento vivienda habitual · 15% · 1.200 €/1.500 € (discapacidad) · ≤35 o ≥65 · BI ≤25.000/30.000 · cifras AEAT 2025 verificadas.',
    'TODO T18.x · auditar mínimos autonómicos Ley 5/2021 vs estatales · pre-investigación NO localizó diferencia · provisional usamos estatales.',
    'TODO T18.x · auditar 5 tramos exactos escala autonómica · pre-investigación localizó rango pero no breakpoints.',
    'TODO T18.x · víctima violencia/terrorismo como condición OR adicional · ampliar `DatosBaseDeduccion`.',
    'TODO T18.x · resto de deducciones Andalucía · vivienda protegida (2%/6%) · nacimiento/adopción · familia monoparental · gastos defensa jurídica laboral · veterinarios · idiomas/informática descendientes · gimnasio.',
  ],
};
