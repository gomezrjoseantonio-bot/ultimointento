// ============================================================================
// ATLAS · TAREA 18.0 · Fallback estatal · cifras Art. 56-61 LIRPF + escala
// ============================================================================
//
// Paquete `BASE_ESTATAL_RULES` que sirve como fallback cuando la CCAA del
// titular no está implementada todavía o no aprobó cifras propias. Las
// cifras aquí provienen exclusivamente de la Ley 35/2006 (LIRPF) y NO
// son inventadas (regla 0.2 spec).
//
// Estructura · sigue `CcaaRules` con:
//   - `minimoPersonalFamiliar` · cifras estatales Art. 57-60 LIRPF
//   - `escalaAutonomica` · escala supletoria DT 15ª LIRPF (idéntica en
//     límites a la estatal del Art. 63 · tipo máximo 22.5%)
//   - `deducciones[]` · vacío · las deducciones autonómicas, por
//     definición, las regula cada CCAA · si el titular reside en una CCAA
//     no implementada, ATLAS no aplica deducciones autonómicas (sólo las
//     estatales · que NO viven aquí · siguen su propia ruta en
//     `irpfCalculationService`).
// ============================================================================

import type { CcaaRules } from '../tipos';

const FUENTE_LIRPF = 'Ley 35/2006 IRPF · arts. 56-63 + DT 15ª · BOE-A-2006-20764 (consolidado)';

export const BASE_ESTATAL_RULES: CcaaRules = {
  ccaa: 'Estatal (fallback)',
  codigoIso: 'ES',
  fuenteOficialMinimos: FUENTE_LIRPF,
  fuenteOficialEscala: FUENTE_LIRPF,

  // ─── Mínimos personales y familiares · LIRPF arts. 57-60 ─────────────────
  // Cifras vigentes 2024-2025 · sin variación autonómica.
  minimoPersonalFamiliar: {
    minimoContribuyente: 5550, // Art. 57.1 LIRPF
    bonoMayor65: 1150, // Art. 57.2 LIRPF
    bonoMayor75Adicional: 1400, // Art. 57.2 LIRPF (acumulativo al ≥65)

    // Art. 58.1 LIRPF · escala progresiva por hijo
    descendiente1: 2400,
    descendiente2: 2700,
    descendiente3: 4000,
    descendiente4Plus: 4500,
    // Art. 58.2 LIRPF · adicional por descendiente menor de 3 años
    descendienteMenor3Extra: 2800,

    // Art. 59 LIRPF · ascendientes
    ascendienteMayor65: 1150,
    ascendienteMayor75Adicional: 1400,

    // Art. 60 LIRPF · discapacidad
    discapacidad33a65: 3000,
    discapacidad65Plus: 9000,
    discapacidadGastosAsistencia: 3000,
  },

  // ─── Escala supletoria · DT 15ª LIRPF ────────────────────────────────────
  // Aplica cuando una CCAA no aprueba escala propia · idéntica en tramos a la
  // estatal del Art. 63.1 · tipo máximo 22.5%.
  escalaAutonomica: [
    { baseHasta: 12450, tipoMarginal: 0.095 },
    { baseHasta: 20200, tipoMarginal: 0.12 },
    { baseHasta: 35200, tipoMarginal: 0.15 },
    { baseHasta: 60000, tipoMarginal: 0.185 },
    { baseHasta: 300000, tipoMarginal: 0.225 },
    { baseHasta: Infinity, tipoMarginal: 0.225 },
  ],

  // ─── Deducciones autonómicas ─────────────────────────────────────────────
  // Vacío por construcción · las deducciones autonómicas las regula cada
  // CCAA · este fallback NO aplica ninguna.
  deducciones: [],

  verified: true,
  notasMigracion: [
    'Fallback estatal · sin variaciones autonómicas · usado cuando el titular reside en una CCAA aún no implementada en el módulo `ccaaRules/`.',
    'Si el cálculo IRPF cae aquí, `irpfCalculationService` debe emitir un warning indicando la CCAA original y que se aplicó la supletoria.',
  ],
};

/**
 * Escala estatal · Art. 63.1 LIRPF · expuesta para uso en
 * `irpfCalculationService` (cuotaEstatal). NO confundir con la supletoria
 * autonómica de DT 15ª aunque coincida en límites · son escalas legalmente
 * distintas que se suman.
 */
export const ESCALA_ESTATAL_GENERAL: CcaaRules['escalaAutonomica'] = [
  { baseHasta: 12450, tipoMarginal: 0.095 },
  { baseHasta: 20200, tipoMarginal: 0.12 },
  { baseHasta: 35200, tipoMarginal: 0.15 },
  { baseHasta: 60000, tipoMarginal: 0.185 },
  { baseHasta: 300000, tipoMarginal: 0.225 },
  { baseHasta: Infinity, tipoMarginal: 0.245 },
];

export const FUENTE_ESCALA_ESTATAL = 'Art. 63.1 LIRPF · escala estatal general 2024-2025';
