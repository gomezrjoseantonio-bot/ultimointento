// PR5-HOTFIX v2 · Catálogo canónico de categorías de movimientos
//
// Fuente única de verdad para la taxonomía de categorías usada en:
//   - Modal "+ Añadir movimiento" (Conciliación)
//   - Modal "Nueva regla OPEX" (Inmuebles)
//   - Mapeo a stores de inmueble (gastosInmueble / mejorasInmueble / mueblesInmueble)
//   - Defaults de documentación (factura / justificante)
//
// El identificador canónico `key` se persiste en `TreasuryEvent.categoryKey` /
// `Movement.categoryKey` / `GastoInmueble.categoryKey`. El `categoryLabel`
// previo se mantiene por compatibilidad con datos antiguos.
//
// Nuevas categorías / reglas → ampliar este fichero, nunca hardcodear listas en
// componentes.
//
// Grupos canónicos:
//   2 ingresos (Alquiler · Otros ingresos)
//   10 gastos de inmueble (Reparación · Mejora · Mobiliario · Comunidad ·
//      Seguro · Suministro · IBI · Basuras · Servicio · Otros)
//   1 gasto personal
//   4 sub-tipos de suministro (luz / agua / gas / internet)
//
// Financiación y Traspaso NO usan catálogo de categorías (selector de préstamo
// y cuenta destino respectivamente).

import {
  Home,
  Wrench,
  Hammer,
  Armchair,
  Users,
  Shield,
  Zap,
  Building2,
  Trash2,
  Briefcase,
  ShoppingBag,
  Tag,
  Trophy,
  Droplet,
  Flame,
  Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type MovementType = 'ingreso' | 'gasto' | 'financiacion' | 'traspaso';
export type Ambito = 'personal' | 'inmueble';
export type CategoryStoreName = 'gastosInmueble' | 'mejorasInmueble' | 'mueblesInmueble';

export interface CategoryDef {
  /** Identificador canónico para persistir en DB. Estable aunque cambie el label. */
  key: string;
  /** Etiqueta visible al usuario. */
  label: string;
  /** Icono lucide para cards y pills. */
  icon: LucideIcon;
  /** Tipo de movimiento al que pertenece. */
  tipo: MovementType;
  /** Ámbito (personal, inmueble o ambos). */
  ambito: Ambito | 'ambos';
  /** Casilla AEAT por defecto para deducción (solo gastos de inmueble). */
  casillaAEAT?: string;
  /** Store de destino al materializar la línea (solo gastos de inmueble). */
  storeName?: CategoryStoreName;
  /** Si aparece como opción en "Nueva regla OPEX". */
  availableInOpex: boolean;
  /** Si el modal debe exigir seleccionar inmueble cuando esta categoría está activa. */
  requiereInmueble: boolean;
  /** Si muestra selector secundario (p. ej. luz/agua/gas/internet para Suministro). */
  hasSubtype: boolean;
}

export interface SubtypeDef {
  key: string;
  label: string;
  icon: LucideIcon;
}

// ══════════════════════════════════════════════════════════
// INGRESOS · 2 categorías
// ══════════════════════════════════════════════════════════

export const INGRESO_CATEGORIES: CategoryDef[] = [
  {
    key: 'alquiler',
    label: 'Alquiler',
    icon: Home,
    tipo: 'ingreso',
    ambito: 'inmueble',
    availableInOpex: false,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'otros_ingresos',
    label: 'Otros ingresos',
    icon: Trophy,
    tipo: 'ingreso',
    ambito: 'ambos',
    availableInOpex: false,
    requiereInmueble: false,
    hasSubtype: false,
  },
];

// Nota: las nóminas se registran desde Gestión Personal, NO desde este modal.

// ══════════════════════════════════════════════════════════
// GASTOS DE INMUEBLE · 10 categorías
// ══════════════════════════════════════════════════════════

export const GASTO_INMUEBLE_CATEGORIES: CategoryDef[] = [
  {
    key: 'reparacion_inmueble',
    label: 'Reparación',
    icon: Wrench,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0106',
    storeName: 'gastosInmueble',
    availableInOpex: false,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'mejora_inmueble',
    label: 'Mejora',
    icon: Hammer,
    tipo: 'gasto',
    ambito: 'inmueble',
    storeName: 'mejorasInmueble',
    availableInOpex: false,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'mobiliario_inmueble',
    label: 'Mobiliario',
    icon: Armchair,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0117',
    storeName: 'mueblesInmueble',
    availableInOpex: false,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'comunidad_inmueble',
    label: 'Comunidad',
    icon: Users,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0109',
    storeName: 'gastosInmueble',
    availableInOpex: true,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'seguro_inmueble',
    label: 'Seguro',
    icon: Shield,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0114',
    storeName: 'gastosInmueble',
    availableInOpex: true,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'suministro_inmueble',
    label: 'Suministro',
    icon: Zap,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0113',
    storeName: 'gastosInmueble',
    availableInOpex: true,
    requiereInmueble: true,
    hasSubtype: true,
  },
  {
    key: 'ibi_inmueble',
    label: 'IBI',
    icon: Building2,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0115',
    storeName: 'gastosInmueble',
    availableInOpex: true,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'basuras_inmueble',
    label: 'Basuras',
    icon: Trash2,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0115',
    storeName: 'gastosInmueble',
    availableInOpex: true,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'servicio_inmueble',
    label: 'Servicio',
    icon: Briefcase,
    tipo: 'gasto',
    ambito: 'inmueble',
    casillaAEAT: '0108',
    storeName: 'gastosInmueble',
    availableInOpex: true,
    requiereInmueble: true,
    hasSubtype: false,
  },
  {
    key: 'otros_inmueble',
    label: 'Otros',
    icon: Tag,
    tipo: 'gasto',
    ambito: 'inmueble',
    storeName: 'gastosInmueble',
    availableInOpex: false,
    requiereInmueble: true,
    hasSubtype: false,
  },
];

// ══════════════════════════════════════════════════════════
// GASTOS PERSONALES · 1 categoría
// ══════════════════════════════════════════════════════════

export const GASTO_PERSONAL_CATEGORIES: CategoryDef[] = [
  {
    key: 'gasto_personal',
    label: 'Gasto personal',
    icon: ShoppingBag,
    tipo: 'gasto',
    ambito: 'personal',
    availableInOpex: false,
    requiereInmueble: false,
    hasSubtype: false,
  },
];

// ══════════════════════════════════════════════════════════
// SUB-TIPOS DE SUMINISTRO · 4 opciones
// ══════════════════════════════════════════════════════════

export const SUMINISTRO_SUBTYPES: SubtypeDef[] = [
  { key: 'luz', label: 'Luz', icon: Zap },
  { key: 'agua', label: 'Agua', icon: Droplet },
  { key: 'gas', label: 'Gas', icon: Flame },
  { key: 'internet', label: 'Internet', icon: Wifi },
];

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

export function getAllCategories(): CategoryDef[] {
  return [
    ...INGRESO_CATEGORIES,
    ...GASTO_INMUEBLE_CATEGORIES,
    ...GASTO_PERSONAL_CATEGORIES,
  ];
}

/**
 * Categorías a mostrar en el modal "Añadir movimiento" según tipo + ámbito.
 * Devuelve array vacío para tipo=financiacion o tipo=traspaso (no usan catálogo).
 */
export function getCategoriesForModal(
  tipo: MovementType,
  ambito?: Ambito,
): CategoryDef[] {
  if (tipo === 'ingreso') {
    if (ambito === 'personal') {
      return INGRESO_CATEGORIES.filter((c) => c.ambito === 'personal' || c.ambito === 'ambos');
    }
    if (ambito === 'inmueble') {
      return INGRESO_CATEGORIES.filter((c) => c.ambito === 'inmueble' || c.ambito === 'ambos');
    }
    return INGRESO_CATEGORIES;
  }
  if (tipo === 'gasto') {
    if (ambito === 'personal') return GASTO_PERSONAL_CATEGORIES;
    if (ambito === 'inmueble') return GASTO_INMUEBLE_CATEGORIES;
    return [...GASTO_INMUEBLE_CATEGORIES, ...GASTO_PERSONAL_CATEGORIES];
  }
  return [];
}

export function getCategoryByKey(key?: string | null): CategoryDef | undefined {
  if (!key) return undefined;
  return getAllCategories().find((c) => c.key === key);
}

/** Categorías que pueden registrarse como regla OPEX recurrente. */
export function getOpexCategories(): CategoryDef[] {
  return getAllCategories().filter((c) => c.availableInOpex);
}

export function getSubtypeByKey(key?: string | null): SubtypeDef | undefined {
  if (!key) return undefined;
  return SUMINISTRO_SUBTYPES.find((s) => s.key === key);
}

/**
 * Mapeo best-effort desde un `categoryLabel` legado (string libre del modal
 * antiguo) al `key` canónico del catálogo. Se usa al leer datos previos a la
 * migración a `categoryKey`.
 *
 * Si no encuentra match claro, devuelve undefined (el código upstream ya
 * tolera categorías no mapeadas).
 */
export function inferCategoryFromLegacyLabel(label?: string | null): CategoryDef | undefined {
  if (!label) return undefined;
  const n = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!n) return undefined;

  if (n.includes('alquiler') || n.includes('renta')) return getCategoryByKey('alquiler');
  if (n.includes('otros ingreso') || n.includes('otro ingreso')) return getCategoryByKey('otros_ingresos');

  if (n.includes('reparacion')) return getCategoryByKey('reparacion_inmueble');
  if (n.includes('mejora')) return getCategoryByKey('mejora_inmueble');
  if (n.includes('mobiliario') || n.includes('muebles')) return getCategoryByKey('mobiliario_inmueble');
  if (n.includes('comunidad')) return getCategoryByKey('comunidad_inmueble');
  if (n.includes('seguro')) return getCategoryByKey('seguro_inmueble');
  if (n.includes('suministro')) return getCategoryByKey('suministro_inmueble');
  if (n.includes('basura')) return getCategoryByKey('basuras_inmueble');
  if (n.includes('ibi') || n.includes('tribut')) return getCategoryByKey('ibi_inmueble');
  if (n.includes('servicio')) return getCategoryByKey('servicio_inmueble');

  if (n.includes('gasto personal') || n === 'personal') return getCategoryByKey('gasto_personal');

  return undefined;
}

/**
 * Resuelve el CategoryDef efectivo de un registro que puede tener `categoryKey`
 * (nuevo) o solo `categoryLabel` (legado).
 */
export function resolveCategoryFromRecord(record: {
  categoryKey?: string | null;
  categoryLabel?: string | null;
}): CategoryDef | undefined {
  if (record.categoryKey) {
    const def = getCategoryByKey(record.categoryKey);
    if (def) return def;
  }
  return inferCategoryFromLegacyLabel(record.categoryLabel);
}

/**
 * Keys especiales para las dos patas de un traspaso entre cuentas propias.
 * NO aparecen en `getAllCategories()` — no son categorías visibles; son
 * marcadores para excluirlas de los KPIs.
 */
export const TRANSFER_KEYS = {
  SALIDA: 'traspaso_salida',
  ENTRADA: 'traspaso_entrada',
} as const;

export function isTransferKey(key?: string | null): boolean {
  return key === TRANSFER_KEYS.SALIDA || key === TRANSFER_KEYS.ENTRADA;
}
