// ============================================================================
// ATLAS · TAREA 18.1 · Illes Balears · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decret legislatiu Illes Balears (texto refundido tributos cedidos) ·
//     consolidado tras última deflactación (BOE/BOIB).
//   · Manual Práctico AEAT 2025 · sección Illes Balears.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/illes-balears.html`.
//
// Cobertura T18.1:
//   · Mínimos personales y familiares · TODO auditoría · provisional
//     estatales · `verified=false` a nivel paquete.
//   · Escala autonómica · 9 tramos · 9% min · 24,75% max · TODO valores
//     intermedios · pre-investigación confirma rango y reducción 0,5/0,25
//     puntos en 2024.
//   · Deducción 1 · Arrendamiento vivienda habitual · 15% (530 €) base ·
//     20% (650 €) incrementado · BI ≤33.000 / 52.800 · 39.600 / 63.360
//     familia numerosa.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_BALEARES =
  'Decret legislatiu Illes Balears · texto refundido tributos cedidos · BOE/BOIB · consolidado';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Illes Balears';
const URL_AEAT_BALEARES =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/illes-balears.html';

// ─── Deducción Arrendamiento Vivienda Habitual ─────────────────────────────

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'baleares-arrendamiento-vivienda-habitual',
  ccaa: 'Illes Balears',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '15% (tope 530 €) base · perfil base · menor de 36 años (≤35) o mayor de 65 sin actividad laboral/profesional · 20% (tope 650 €) si cumple UNA condición incrementadora · ≤30 años · discapacidad ≥33% · familia numerosa · familia monoparental con 2+ hijos · autónomo dado de alta ≥183 días · contrato ≥1 año · BI ≤33.000 indiv / ≤52.800 conjunta · ≤39.600 / ≤63.360 familia numerosa.',
  fuenteOficial: `${FUENTE_DL_BALEARES} · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_BALEARES}`,
  verified: true,

  // Cálculo en `calcularImporte` por la diferencia base/incrementado.
  porcentaje: 0.15,
  // T18.1 fix · `topeAbsoluto*` al MÁXIMO posible (650 € incrementado) ·
  // `calcularImporte` selecciona el tope efectivo (530 / 650) · evita doble
  // tope que recortaba 650 a 530.
  topeAbsolutoIndividual: 650,
  topeAbsolutoConjunta: 650,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    duracionContratoMinAnios: 1,
    baseImponibleMaxIndividual: 33000,
    baseImponibleMaxConjunta: 52800,
    baseImponibleMaxFamiliar: 63360, // tope cuando familia numerosa (conjunta) ·
    // TODO T18.x · `baseImponibleMaxFamiliar` modela conjunta familia numerosa
    // · pre-investigación cita 39.600 individual + 63.360 conjunta · motor
    // hoy aplica el mayor cuando tieneTresMasHijos · funcional pero
    // simplificación · refactor cuando aparezca caso.
    condicionesElegibilidadOR: [
      { edadMaxima: 36 }, // <36 = ≤35 (literal "menor de 36 años") · TODO precisar contra Manual AEAT
      { edadMinima: 65 }, // ≥65 SIN actividad laboral/profesional (no modelable hoy)
    ],
  },

  // Tope incrementado · 20%/650 si UNA condición incrementadora cumple.
  // Condiciones incrementadoras (Manual AEAT 2025 · Baleares) ·
  //   · ≤30 años · discapacidad ≥33% titular · ascendiente/descendiente con
  //     mínimo discapacidad · familia numerosa · familia monoparental con
  //     2+ hijos · autónomo dado de alta ≥183 días.
  calcularImporte: (ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;

    const tieneFamiliaNumerosa =
      datosBase.familiaNumerosa !== undefined && datosBase.familiaNumerosa !== false;
    const cumpleIncrementado =
      (ctx.edadActual !== null && ctx.edadActual <= 30) ||
      ctx.discapacidadTitular === 'entre33y65' ||
      ctx.discapacidadTitular === 'mas65' ||
      tieneFamiliaNumerosa ||
      datosBase.familiaMonoparental === true;

    const porcentaje = cumpleIncrementado ? 0.2 : 0.15;
    const tope = cumpleIncrementado ? 650 : 530;
    const importe = cantidad * porcentaje;
    return Math.round(Math.min(importe, tope) * 100) / 100;
  },
};

// ─── Paquete CCAA · Illes Balears ──────────────────────────────────────────

export const BALEARES_RULES: CcaaRules = {
  ccaa: 'Illes Balears',
  codigoIso: 'ES-IB',
  fuenteOficialMinimos:
    'Decret legislatiu Illes Balears · TODO T18.x · auditar mínimos autonómicos vs estatales',
  fuenteOficialEscala:
    'Decret legislatiu Illes Balears · 9 tramos · 9%-24,75% · reducción 0,5 puntos BI ≤30k · 0,25 BI >30k aplicada en 2024 · TODO valores intermedios',

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 9 tramos · 9% min · 24,75% max ─────────────────
  escalaAutonomica: [
    { baseHasta: 10000, tipoMarginal: 0.09 },
    { baseHasta: 18000, tipoMarginal: 0.115 },
    { baseHasta: 30000, tipoMarginal: 0.145 },
    { baseHasta: 48000, tipoMarginal: 0.175 },
    { baseHasta: 70000, tipoMarginal: 0.195 },
    { baseHasta: 90000, tipoMarginal: 0.225 },
    { baseHasta: 120000, tipoMarginal: 0.235 },
    { baseHasta: 175000, tipoMarginal: 0.2425 },
    { baseHasta: Infinity, tipoMarginal: 0.2475 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · 9 tramos exactos + mínimos
  notasMigracion: [
    'Deducción arrendamiento · 15%/20% · 530/650 € · BI ≤33k/52,8k indiv/conjunta · `verified=true` por cifras AEAT 2025.',
    'TODO T18.x · 9 tramos exactos escala autonómica Baleares (9%-24,75% post deflactación 2024) · valores intermedios estimados.',
    'TODO T18.x · auditar mínimos autonómicos Decret legislatiu vs estatales.',
    'TODO T18.x · verificar URL AEAT 2025 Baleares (pre-investigación citó 2024 · cifras suelen mantenerse pero validar).',
    'TODO T18.x · resto deducciones · arrendador vivienda permanente (clientes ATLAS propietarios) · adquisición primera vivienda familias numerosas/monoparentales · acogimiento mayores · vivienda protegida · rehabilitación centros históricos · descendientes <6 (conciliación) · cambio residencia entre islas.',
    'TODO T18.x · ampliar `DatosBaseDeduccion` con `propiedadOtraViviendaMenos70Km` · `actividadLaboralProfesional` · `autonomoActivo183Dias` para cumplir requisitos AEAT al pie de la letra.',
  ],
};
