// Importar gastos de un Excel/CSV (mockup v2_3 · «Importar de Excel»). Helpers
// puros: reconocer qué columna es qué por el encabezado, parsear el importe en
// formato español, y traducir la periodicidad a meses de la rejilla. El parseo
// del fichero (SheetJS) y la UI viven en ImportarGastosModal.

import { mesesDeAtajo } from './rejillaMeses';

export type CampoGasto = 'concepto' | 'proveedor' | 'importe' | 'periodicidad' | 'cuenta' | 'cups';

export type MapeoColumnas = Record<CampoGasto, string | null>;

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// Sinónimos de encabezado por campo (se busca por inclusión sobre el header).
const SINONIMOS: Record<CampoGasto, string[]> = {
  concepto: ['concepto', 'nombre', 'gasto', 'descripcion', 'descripción'],
  proveedor: ['proveedor', 'compania', 'compañia', 'compania', 'emisor', 'acreedor'],
  importe: ['importe', 'cantidad', 'coste', 'precio', 'euros', 'eur', '€'],
  periodicidad: ['periodicidad', 'cada cuanto', 'frecuencia', 'periodo', 'cuando'],
  cuenta: ['cuenta', 'cargo', 'banco', 'iban'],
  cups: ['cups', 'contrato', 'poliza', 'póliza', 'referencia'],
};

/** Reconoce, para cada campo, qué encabezado del fichero le corresponde. */
export function autoMapColumns(headers: string[]): MapeoColumnas {
  const mapeo: MapeoColumnas = {
    concepto: null,
    proveedor: null,
    importe: null,
    periodicidad: null,
    cuenta: null,
    cups: null,
  };
  const usados = new Set<string>();
  (Object.keys(SINONIMOS) as CampoGasto[]).forEach((campo) => {
    const hit = headers.find(
      (h) => !usados.has(h) && SINONIMOS[campo].some((syn) => norm(h).includes(syn)),
    );
    if (hit) {
      mapeo[campo] = hit;
      usados.add(hit);
    }
  });
  return mapeo;
}

/** Cuántos campos se han reconocido (para el «N de M reconocidas»). */
export function nReconocidas(mapeo: MapeoColumnas): number {
  return (Object.values(mapeo) as (string | null)[]).filter(Boolean).length;
}

/** Parsea un importe en formato español ("1.234,56 €") → número, o null. */
export function parseImporteEs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^0-9.,-]/g, '').trim();
  if (!s) return null;
  // "1.234,56" → "1234.56" · "46,78" → "46.78" · "46.78" → "46.78"
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalizado);
  return Number.isNaN(n) ? null : n;
}

/** Traduce una periodicidad de texto a los meses marcados de la rejilla. */
export function periodicidadAMeses(texto: string | undefined): number[] {
  const s = norm(texto ?? '');
  if (!s) return mesesDeAtajo('todos');
  if (/(bimestr|un mes si|cada 2|cada dos)/.test(s)) return mesesDeAtajo('cada2');
  if (/(trimestr|cada 3|cada tres)/.test(s)) return mesesDeAtajo('cada3');
  if (/(cuatrimestr|cada 4|cada cuatro)/.test(s)) return mesesDeAtajo('cada4');
  if (/(semestr|cada 6|cada seis)/.test(s)) return mesesDeAtajo('cada6');
  if (/(anual|una vez|al ano|al año|year)/.test(s)) return mesesDeAtajo('unaVezAlAnio');
  // mensual / todos los meses / por defecto
  return mesesDeAtajo('todos');
}

/** Etiqueta legible de la periodicidad reconocida (para el preview). */
export function etiquetaPeriodicidad(meses: number[]): string {
  if (meses.length === 12) return 'Todos los meses';
  if (meses.length === 6) return 'Un mes sí, uno no';
  if (meses.length === 4) return 'Trimestral';
  if (meses.length === 3) return 'Cuatrimestral';
  if (meses.length === 2) return 'Semestral';
  if (meses.length === 1) return 'Una vez al año';
  return `${meses.length} cargos/año`;
}
