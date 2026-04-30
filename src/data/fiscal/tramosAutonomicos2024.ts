// ============================================================================
// ATLAS · TAREA 14.3 · Tramos IRPF 2024 · escala estatal y autonómicas
// ============================================================================
//
// Cierra GAP 5.1 (AUDIT-T14) · `comunidadAutonoma` ignorada por
// `irpfCalculationService` · reducciones autonómicas no aplicadas.
//
// El IRPF se compone de dos escalas independientes (arts. 63 y 65 LIRPF):
//   1) Escala ESTATAL · idéntica para todos los contribuyentes.
//   2) Escala AUTONÓMICA · cada CCAA puede modificar la suya. Cuando una
//      CCAA no la regula expresamente, se aplica la escala supletoria de la
//      Disposición Transitoria 15ª LIRPF, que coincide en límites con la
//      estatal.
//
// La cuota total se calcula sumando las cuotas independientes:
//   cuotaTotal = cuotaPorTramos(base, ESCALA_ESTATAL)
//              + cuotaPorTramos(base, ESCALA_AUTONOMICA_<CCAA>)
//
// Política de "NO INVENTAR" (spec §0.2 + §3.3): las escalas autonómicas
// específicas de Madrid · Asturias · Cataluña se incluyen como estructura
// con `verified: false` · solo se aplican cuando Jose audita y flippa el
// flag a true. Mientras `verified: false`, el motor de IRPF cae al
// supletorio (DT 15ª LIRPF · idéntico al comportamiento previo a T14.3) y
// añade un warning a la declaración indicando el motivo.
// ============================================================================

export interface EscalaTramos {
  tramos: Array<{ hasta: number; tipo: number }>;
  verified: boolean;
  fuente: string;
}

// ─── Escala estatal general 2024 (art. 63 LIRPF) ────────────────────────────
// Mitad estatal del IRPF general · vigente para ejercicios 2024 y 2025.
export const ESCALA_ESTATAL_GENERAL_2024: EscalaTramos = {
  tramos: [
    { hasta: 12450, tipo: 0.095 },
    { hasta: 20200, tipo: 0.12 },
    { hasta: 35200, tipo: 0.15 },
    { hasta: 60000, tipo: 0.185 },
    { hasta: 300000, tipo: 0.225 },
    { hasta: Infinity, tipo: 0.245 },
  ],
  verified: true,
  fuente: 'Art. 63.1 LIRPF (Ley 35/2006) · escala estatal general 2024',
};

// ─── Escala autonómica supletoria 2024 (DT 15ª LIRPF) ───────────────────────
// Aplicable cuando una CCAA no ha aprobado escala propia · idéntica en
// límites a la estatal · tipo máximo 22.5%.
export const ESCALA_AUTONOMICA_SUPLETORIA_2024: EscalaTramos = {
  tramos: [
    { hasta: 12450, tipo: 0.095 },
    { hasta: 20200, tipo: 0.12 },
    { hasta: 35200, tipo: 0.15 },
    { hasta: 60000, tipo: 0.185 },
    { hasta: 300000, tipo: 0.225 },
    { hasta: Infinity, tipo: 0.225 },
  ],
  verified: true,
  fuente: 'DT 15ª LIRPF · escala autonómica supletoria',
};

// ─── Escalas autonómicas específicas 2024 ───────────────────────────────────
//
// IMPORTANTE: todas las entradas se inicializan con `verified: false`. El
// motor de IRPF NO las aplica hasta que Jose audita los valores con la
// fuente legal (BO autonómico · texto refundido) y flippa `verified: true`.
//
// Mientras `verified: false`:
//   - El motor cae a `ESCALA_AUTONOMICA_SUPLETORIA_2024`.
//   - La declaración recibe un warning explicando el motivo.
//   - El usuario sigue con cálculo equivalente al comportamiento previo
//     a T14.3 (no hay regresión silenciosa).
//
// Cómo verificar y activar:
//   1) Localizar BO oficial autonómico (CM · Asturias · DOGC).
//   2) Reemplazar tramos parciales por la tabla completa.
//   3) Cambiar `verified: false` → `true` y actualizar `fuente`.

export const TABLAS_AUTONOMICAS_2024: Record<string, EscalaTramos> = {
  // ─── Comunidad de Madrid ──────────────────────────────────────────────
  // Datos parciales encontrados en fuentes secundarias (taxdown · idealista
  // · raisin) · 5 tramos · mínimo 8.5% · máximo 20.5%.
  // Tramos 1-3 confirmados parcialmente · tramos 4-5 SIN VERIFICAR.
  // Hasta auditoría Jose, motor cae a supletoria.
  Madrid: {
    tramos: [
      { hasta: 12960, tipo: 0.085 },
      { hasta: 19500, tipo: 0.107 },
      { hasta: 35500, tipo: 0.128 },
      // TODO tramos 4 y 5 (hasta máximo 20.5%) · auditar BOCM
      { hasta: Infinity, tipo: 0.205 },
    ],
    verified: false,
    fuente: 'TODO · auditar Texto Refundido tributos cedidos CM (Decreto Legislativo 1/2010 + modificaciones) · valores parciales pendientes',
  },

  // ─── Principado de Asturias ───────────────────────────────────────────
  // Datos parciales encontrados · 8 tramos · mínimo 9-10% · máximo 25.5%.
  // Tramos 1-4 con valores parciales (9.00 / 12.00 / 14.00 / 19.20) ·
  // tramos 5-8 SIN VERIFICAR.
  Asturias: {
    tramos: [
      { hasta: 12450, tipo: 0.09 },
      { hasta: 17707.2, tipo: 0.12 },
      { hasta: 33007.2, tipo: 0.14 },
      { hasta: 50000, tipo: 0.192 },
      // TODO tramos 5-8 (hasta máximo 25.5%) · auditar Decreto Legislativo 2/2014
      { hasta: Infinity, tipo: 0.255 },
    ],
    verified: false,
    fuente: 'TODO · auditar Decreto Legislativo 2/2014 Asturias art. 2 · valores parciales pendientes',
  },

  // ─── Cataluña ──────────────────────────────────────────────────────────
  // Datos contradictorios entre fuentes (8 vs 9 tramos · mínimo 9.5 vs
  // 10.5%). Sin verificación posible · placeholder.
  Cataluña: {
    tramos: [
      // TODO tramos completos · auditar DOGC · Ley reguladora tributos
      // cedidos Cataluña + última modificación
      { hasta: Infinity, tipo: 0.255 },
    ],
    verified: false,
    fuente: 'TODO · sin verificar · escala autonómica Cataluña 2024',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normaliza el nombre de la CCAA · quita acentos · trim · capitaliza.
 * Soporta variantes habituales · 'Madrid' · 'madrid' · 'Comunidad de Madrid'
 * · 'Cataluña' · 'Catalunya' · 'cataluna'.
 */
export function normalizeCCAA(ccaa: string | null | undefined): string | null {
  if (!ccaa) return null;
  const cleaned = ccaa
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (!cleaned) return null;

  if (cleaned.includes('madrid')) return 'Madrid';
  if (cleaned.includes('asturi')) return 'Asturias';
  if (cleaned.includes('catalu')) return 'Cataluña';
  // Devuelve la cadena original con primera letra mayúscula como fallback
  return ccaa.trim().charAt(0).toUpperCase() + ccaa.trim().slice(1);
}

/**
 * Obtiene la escala autonómica aplicable para una CCAA y año.
 * Si la escala específica no existe o `verified: false`, devuelve la
 * supletoria (DT 15ª LIRPF) y un motivo en `reason`.
 */
export function getEscalaAutonomica(
  ccaa: string | null | undefined,
  año: number = 2024,
): { escala: EscalaTramos; aplicada: boolean; reason?: string } {
  if (año !== 2024 && año !== 2025) {
    return {
      escala: ESCALA_AUTONOMICA_SUPLETORIA_2024,
      aplicada: false,
      reason: `año ${año} sin tabla disponible · usando supletoria`,
    };
  }

  const key = normalizeCCAA(ccaa);
  if (!key) {
    return {
      escala: ESCALA_AUTONOMICA_SUPLETORIA_2024,
      aplicada: false,
      reason: 'CCAA no informada · usando supletoria',
    };
  }

  const tabla = TABLAS_AUTONOMICAS_2024[key];
  if (!tabla) {
    return {
      escala: ESCALA_AUTONOMICA_SUPLETORIA_2024,
      aplicada: false,
      reason: `CCAA ${key} sin tabla soportada · usando supletoria`,
    };
  }

  if (!tabla.verified) {
    return {
      escala: ESCALA_AUTONOMICA_SUPLETORIA_2024,
      aplicada: false,
      reason: `CCAA ${key} con tabla pendiente de auditar (verified=false) · usando supletoria`,
    };
  }

  return { escala: tabla, aplicada: true };
}
