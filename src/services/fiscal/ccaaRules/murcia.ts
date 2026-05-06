// ============================================================================
// ATLAS · TAREA 18.2 · Región de Murcia · cifras BOE/AEAT 2025
// ============================================================================
//
// Fuentes principales ·
//   · Decreto Legislativo 1/2010 (5 noviembre) Murcia · texto refundido
//     tributos cedidos · BORM/BOE · MODIFICADO por Ley 3/2025 (23 julio)
//     con efectos 1/1/2025 · BI máx subió 24.380 → 40.000 €.
//   · Manual Práctico AEAT 2025 · sección Murcia.
//   · `https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-region-murcia/arrendamiento-vivienda-habitual.html`.
//
// Cobertura T18.2:
//   · Mínimos personales y familiares · TODO · provisional estatales.
//   · Escala autonómica · 5 tramos · TODO valores intermedios.
//   · Deducción 1 · Arrendamiento vivienda habitual · 10% · tope 300 € ·
//     BI ≤40.000 € · BI ahorro ≤1.800 € · contrato ITP/AJD presentado ·
//     pagos trazables (NO efectivo) · NO ser titular >50% otra vivienda ·
//     prorrateo entre titulares.
// ============================================================================

import type { CcaaRules, DeduccionAutonomica } from '../tipos';
import { BASE_ESTATAL_RULES } from './_base_estatal';

const FUENTE_DL_1_2010 =
  'Decreto Legislativo 1/2010 (05/11/2010) Murcia · texto refundido tributos cedidos · BORM/BOE · MODIFICADO por Ley 3/2025 (23/07/2025) · efectos 1/1/2025';
const FUENTE_AEAT_MANUAL =
  'AEAT Manual Práctico Renta 2025 · sección Región de Murcia';
const URL_AEAT_MURCIA =
  'https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025-deducciones-autonomicas/comunidad-autonoma-region-murcia/arrendamiento-vivienda-habitual.html';

// ─── Deducción Arrendamiento Vivienda Habitual · DL 1/2010 art. 1.Trece ───
// Modificado por Ley 3/2025 con efectos 1/1/2025 · BI máx subió de 24.380
// a 40.000 € · vigencia indefinida.
//
// Requisitos AND ·
//   · BI general - mínimo personal y familiar ≤40.000 €
//   · BI ahorro ≤1.800 €
//   · Vivienda situada en Murcia · habitual del contribuyente
//   · Contrato modelo ITP y AJD presentado
//   · Pagos trazables · NO efectivo
//   · NI contribuyente NI miembros UF titulares >50% otra vivienda
//   · Incompatible con deducción inversión vivienda mismo periodo
//
// Cálculo · 10% sobre cantidades NO subvencionadas · tope 300 € por
// contrato · si 2+ titulares con derecho · 300 € se prorratea por
// partes iguales (modelado en notasMigracion · ATLAS evalúa por titular).

const DEDUCCION_ARRENDAMIENTO: DeduccionAutonomica = {
  id: 'murcia-arrendamiento-vivienda-habitual',
  ccaa: 'Murcia',
  nombre: 'Arrendamiento de vivienda habitual',
  descripcion:
    '10% de cantidades NO subvencionadas · tope 300 € por contrato · BI general ≤40.000 € (Ley 3/2025 · subió desde 24.380 €) · BI ahorro ≤1.800 € · vivienda situada en Murcia · contrato ITP/AJD presentado · pagos trazables (NO efectivo) · NI contribuyente NI UF titulares >50% otra vivienda · incompatible con inversión vivienda mismo periodo · prorrateo entre titulares.',
  fuenteOficial: `${FUENTE_DL_1_2010} · art. 1.Trece · ${FUENTE_AEAT_MANUAL} · ${URL_AEAT_MURCIA}`,
  verified: true,

  porcentaje: 0.1,
  topeAbsolutoIndividual: 300,
  topeAbsolutoConjunta: 300,

  requisitos: {
    requiereTipoVivienda: 'habitual',
    requiereResidenciaFiscalCcaa: true,
    requiereTitularContrato: true,
    baseImponibleMaxIndividual: 40000,
    baseImponibleMaxConjunta: 40000,
    requiereItpAjdPresentado: true,
    requierePagosTrazables: true,
    requiereNoPropiedadMasMitadOtraVivienda: true,
  },

  // Cálculo · 10% × cantidades NO subvencionadas · resta ayudas si las
  // hay · tope 300 €.
  calcularImporte: (_ctx, datosBase) => {
    const cantidad = datosBase.alquilerAnual ?? 0;
    if (cantidad <= 0) return 0;
    const subvenciones = datosBase.ayudasPublicasArrendamiento ?? 0;
    const baseDeduccion = Math.max(0, cantidad - subvenciones);
    if (baseDeduccion <= 0) return 0;
    const importe = baseDeduccion * 0.1;
    return Math.round(Math.min(importe, 300) * 100) / 100;
  },
};

// ─── Paquete CCAA · Murcia ─────────────────────────────────────────────────

export const MURCIA_RULES: CcaaRules = {
  ccaa: 'Murcia',
  codigoIso: 'ES-MC',
  fuenteOficialMinimos: `${FUENTE_DL_1_2010} · TODO T18.x · auditar mínimos vs estatales`,
  fuenteOficialEscala: `${FUENTE_DL_1_2010} · escala 5 tramos · TODO valores por tramo`,

  minimoPersonalFamiliar: BASE_ESTATAL_RULES.minimoPersonalFamiliar,

  // ─── Escala autonómica · 5 tramos · TODO valores intermedios ───────────
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.095 },
    { baseHasta: 20200, tipoMarginal: 0.115 },
    { baseHasta: 35200, tipoMarginal: 0.135 },
    { baseHasta: 60000, tipoMarginal: 0.18 },
    { baseHasta: Infinity, tipoMarginal: 0.225 },
  ],

  deducciones: [DEDUCCION_ARRENDAMIENTO],

  verified: false, // TODO T18.x · auditar escala 5 tramos + mínimos
  notasMigracion: [
    'Deducción arrendamiento · 10% · 300 € · BI ≤40.000 € (Ley 3/2025 · subió desde 24.380) · ITP/AJD presentado · pagos trazables · NO >50% otra vivienda · `verified=true` por Manual AEAT 2025.',
    '⚠️ Cifra crítica · BI máx 40.000 € (Ley 3/2025) · NO 24.380 € de fuentes antiguas · CC validó contra AEAT Manual 2025.',
    'TODO T18.x · auditar 5 tramos exactos escala autonómica Murcia.',
    'TODO T18.x · localizar deducción jóvenes ≤40 inversión vivienda · pre-investigación localizó ~5% pero requiere validación.',
    'TODO T18.x · prorrateo entre titulares · ATLAS hoy aplica 300 € por titular · si 2 titulares con derecho la fuente oficial dice prorrateo por partes iguales · refactor cuando aparezca caso real.',
    'TODO T18.x · resto deducciones Murcia · familia numerosa adquisición vivienda · autoconsumo/renovables · subvenciones zonas emergencia · vehículo eléctrico (Ley 3/2025) · puntos recarga · gimnasio · óptica · enfermedades raras.',
  ],
};
