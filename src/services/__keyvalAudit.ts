/**
 * TAREA 15.1 · utilidad interna de auditoría del store `keyval`.
 *
 * Prefijo `__` indica herramienta de desarrollo · NO importar desde código
 * de producción. Únicos consumidores legítimos:
 *   - `src/pages/dev/KeyvalAudit.tsx` (página DEV-only `/dev/keyval-audit`)
 *   - tests
 *
 * No muta ni borra nada · solo lee `keyval` y devuelve un report
 * clasificado según `docs/AUDIT-T15-keyval.md` §4.
 */

import { initDB } from './db';

export type KeyvalCategory = 'A' | 'B' | 'C' | 'D' | 'unknown';

export type KeyvalRecommendation =
  | 'KEEP'
  | 'DELETE'
  | 'MOVE'
  | 'TODO_T14'
  | 'TODO_PROYECCION'
  | 'TODO_REVIEW';

export type KeyvalValueType =
  | 'string'
  | 'number'
  | 'object'
  | 'array'
  | 'boolean'
  | 'null'
  | 'undefined';

export interface KeyvalAuditEntry {
  key: string;
  category: KeyvalCategory;
  valueType: KeyvalValueType;
  byteSize: number;
  recommendation: KeyvalRecommendation;
  reason: string;
}

export interface KeyvalAuditReport {
  totalKeys: number;
  byCategory: Record<KeyvalCategory, number>;
  entries: KeyvalAuditEntry[];
  unknownKeys: string[];
}

interface ClassificationRule {
  match: (key: string) => boolean;
  category: KeyvalCategory;
  recommendation: KeyvalRecommendation;
  reason: string;
}

const RULES: ClassificationRule[] = [
  {
    match: (k) => k === 'matchingConfig',
    category: 'A',
    recommendation: 'KEEP',
    reason: 'Configuración real · destino canónico V63 · usada por budgetMatchingService y transferDetectionService',
  },
  {
    match: (k) => k === 'dashboardConfiguration',
    category: 'A',
    recommendation: 'KEEP',
    reason: 'Configuración real del dashboard del usuario',
  },
  {
    match: (k) => k === 'base-assumptions',
    category: 'A',
    recommendation: 'TODO_PROYECCION',
    reason: 'Configuración de proyección · módulo legacy horizon/proyeccion/ · revisitar en T21',
  },
  {
    match: (k) => k === 'base-projection',
    category: 'B',
    recommendation: 'TODO_PROYECCION',
    reason: 'Cache recalculable de proyección · módulo legacy · esperar a T21 antes de borrar',
  },
  {
    match: (k) => k === 'proveedor-contraparte-migration',
    category: 'D',
    recommendation: 'DELETE',
    reason: 'Flag migración one-shot consumida (D2) · candidata a borrar en sub-tarea 15.2',
  },
  {
    match: (k) => k === 'migration_orphaned_inmueble_ids_v1',
    category: 'D',
    recommendation: 'KEEP',
    reason: 'Flag migración recurrente (D1) · puede re-correr si quedan huérfanos · NO borrar',
  },
  {
    match: (k) => k === 'configFiscal',
    category: 'unknown',
    recommendation: 'TODO_T14',
    reason: 'Documentada en JSDoc db.ts:2115 pero sin escritores ni lectores activos · pertenece a T14 (configuración fiscal) · NO tocar en T15',
  },
  {
    match: (k) => k === 'kpiConfig_horizon' || k === 'kpiConfig_pulse',
    category: 'unknown',
    recommendation: 'TODO_REVIEW',
    reason: 'kpiService es stub no-op tras V62 · sin lectores activos · si existe registro es residual · candidato a borrar tras confirmación Jose',
  },
  {
    match: (k) => /^kpiConfig_/.test(k),
    category: 'unknown',
    recommendation: 'TODO_REVIEW',
    reason: 'Variante kpiConfig_* no documentada · kpiService es stub · candidato a borrar tras revisión',
  },
  {
    match: (k) => /^planpagos_/.test(k),
    category: 'C',
    recommendation: 'MOVE',
    reason: 'Datos del usuario disfrazados de configuración · debería vivir en prestamos.planPagos · sub-tarea 15.3 si confirmada',
  },
];

function classify(key: string): Pick<KeyvalAuditEntry, 'category' | 'recommendation' | 'reason'> {
  for (const rule of RULES) {
    if (rule.match(key)) {
      return {
        category: rule.category,
        recommendation: rule.recommendation,
        reason: rule.reason,
      };
    }
  }
  return {
    category: 'unknown',
    recommendation: 'TODO_REVIEW',
    reason: 'Clave no clasificada en el catálogo de T15.1 · requiere decisión Jose',
  };
}

function detectValueType(value: unknown): KeyvalValueType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') {
    return t;
  }
  return 'object';
}

function approximateByteSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return 0;
    // UTF-8 byte length approximation
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
}

function emptyByCategory(): Record<KeyvalCategory, number> {
  return { A: 0, B: 0, C: 0, D: 0, unknown: 0 };
}

export async function auditKeyval(): Promise<KeyvalAuditReport> {
  const db = await initDB();

  const rawKeys = (await db.getAllKeys('keyval')) as IDBValidKey[];
  const keys = rawKeys.map((k) => String(k));

  const entries: KeyvalAuditEntry[] = [];
  const byCategory = emptyByCategory();
  const unknownKeys: string[] = [];

  for (const key of keys) {
    const value = await db.get('keyval', key);
    const { category, recommendation, reason } = classify(key);

    const entry: KeyvalAuditEntry = {
      key,
      category,
      valueType: detectValueType(value),
      byteSize: approximateByteSize(value),
      recommendation,
      reason,
    };
    entries.push(entry);
    byCategory[category] += 1;
    if (category === 'unknown') {
      unknownKeys.push(key);
    }
  }

  // Stable ordering · category A → B → C → D → unknown · then alphabetical
  const order: Record<KeyvalCategory, number> = { A: 0, B: 1, C: 2, D: 3, unknown: 4 };
  entries.sort((a, b) => {
    const diff = order[a.category] - order[b.category];
    if (diff !== 0) return diff;
    return a.key.localeCompare(b.key);
  });

  return {
    totalKeys: keys.length,
    byCategory,
    entries,
    unknownKeys,
  };
}

/**
 * Helper · lectura del valor de una clave concreta para inspección desde
 * la página `/dev/keyval-audit`. Devuelve el valor crudo (no clona) y el
 * size aproximado para mostrar en panel.
 */
export async function readKeyvalValue(key: string): Promise<{ value: unknown; byteSize: number }> {
  const db = await initDB();
  const value = await db.get('keyval', key);
  return { value, byteSize: approximateByteSize(value) };
}
