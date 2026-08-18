// ============================================================================
// Lector universal del extracto de una TARJETA · §3
// ============================================================================
//
// UN solo sitio para subir extractos, y no atado a un emisor. El extracto de la
// tarjeta llega en PDF, en Excel o en CSV, y cada banco lo maqueta a su manera
// (la Carrefour no se parece al Santander, y algunos vienen escaneados). Por eso
// no hay un parser a medida:
//
//   · PDF   → lo lee la IA (`functions/chat.js`, tipo `scan_extracto`), que
//             saca fecha · concepto · importe de cualquier maquetación.
//   · XLS/CSV → lo lee el MISMO parser de banco (SheetJS) que ya usamos.
//
// Las dos vías desembocan en la misma lista de `LineaExtractoTarjeta`, que luego
// concilia `conciliarExtractoTarjeta` (previsto/confirmado → conciliado).
// ============================================================================

import { callScanChat } from '../scanChatService';
import { BankParserService } from '../../features/inbox/importers/bankParser';
import type { ParsedMovement } from '../../types/bankProfiles';

/** Una compra del extracto de la tarjeta. */
export interface LineaExtractoTarjeta {
  /** ISO `YYYY-MM-DD`. */
  fecha: string;
  /** El texto LITERAL del extracto. */
  concepto: string;
  /** Importe · positivo = compra/cargo · negativo = abono/devolución. */
  importe: number;
}

/** Un importe español a número · `1.667,13` → 1667.13. */
export function importeEspañol(texto: string): number {
  return Number(String(texto).replace(/\./g, '').replace(',', '.'));
}

/** ¿El fichero es un PDF? · por tipo MIME o por extensión. */
export function esPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Un `Date` (o texto de fecha) a ISO `YYYY-MM-DD`, o `null` si no hay fecha. */
function aIso(fecha: unknown): string | null {
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    return fecha.toISOString().slice(0, 10);
  }
  if (typeof fecha === 'string') {
    const s = fecha.trim();
    // Ya ISO.
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    // DD/MM/YYYY o DD-MM-YYYY.
    const es = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (es) return `${es[3]}-${es[2].padStart(2, '0')}-${es[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Normaliza lo que devuelve la IA (`scan_extracto`) a líneas del extracto.
 *
 * Puro para poder probarlo sin llamar a la red. Acepta `{ lineas: [...] }` o
 * directamente un array. Descarta lo que no tenga fecha, concepto e importe.
 */
export function lineasDeIA(extraido: unknown): LineaExtractoTarjeta[] {
  const bruto = Array.isArray(extraido)
    ? extraido
    : Array.isArray((extraido as { lineas?: unknown })?.lineas)
      ? (extraido as { lineas: unknown[] }).lineas
      : [];
  const lineas: LineaExtractoTarjeta[] = [];
  for (const item of bruto) {
    const o = item as { fecha?: unknown; concepto?: unknown; importe?: unknown };
    const fecha = aIso(o?.fecha);
    const importe = typeof o?.importe === 'number' ? o.importe : Number(o?.importe);
    const concepto = typeof o?.concepto === 'string' ? o.concepto.trim() : '';
    if (!fecha || !concepto || !Number.isFinite(importe) || importe === 0) continue;
    lineas.push({ fecha, concepto, importe });
  }
  return lineas;
}

/**
 * Convierte los movimientos que saca SheetJS (XLS/CSV) en líneas del extracto.
 *
 * El parser de banco ya normaliza fecha, importe y descripción; aquí solo se
 * adapta la forma. Puro y sin red, como `lineasDeIA`.
 */
export function lineasDeMovimientos(movimientos: ParsedMovement[]): LineaExtractoTarjeta[] {
  const lineas: LineaExtractoTarjeta[] = [];
  for (const m of movimientos ?? []) {
    const fecha = aIso(m?.date);
    const importe = typeof m?.amount === 'number' ? m.amount : Number(m?.amount);
    const concepto = (m?.description ?? m?.counterparty ?? '').trim();
    if (!fecha || !concepto || !Number.isFinite(importe) || importe === 0) continue;
    lineas.push({ fecha, concepto, importe });
  }
  return lineas;
}

/**
 * Lee el extracto de una tarjeta desde cualquier fichero soportado.
 *
 * PDF → IA; XLS/CSV → SheetJS. Devuelve la lista de líneas ya normalizada. Si el
 * fichero no da ninguna línea, devuelve `[]` (la UI avisa de que no se pudo leer).
 */
export async function leerExtractoTarjeta(file: File): Promise<LineaExtractoTarjeta[]> {
  if (esPdf(file)) {
    const r = await callScanChat(file, 'application/pdf', 'scan_extracto');
    if (!r.ok) throw new Error(r.error || 'No se pudo leer el PDF del extracto.');
    return lineasDeIA(r.extraido);
  }
  const parsed = await new BankParserService().parseFile(file);
  return lineasDeMovimientos(parsed.movements ?? []);
}
