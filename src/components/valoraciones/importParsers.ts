// src/components/valoraciones/importParsers.ts
// T-VALORACIONES PR3 (review Copilot) · funciones puras de parsing y
// normalización extraídas del wizard para poder testearlas sin FileReader/JSDOM.

import * as XLSX from 'xlsx';

/**
 * Normaliza distintos formatos de fecha a YYYY-MM-DD.
 * Acepta · Excel serial · ISO YYYY-MM · ISO YYYY-MM-DD · DD/MM/YYYY ·
 * DD-MM-YYYY · Date parseable. Devuelve '' si no se puede normalizar.
 */
export function normalizeFecha(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m) {
      const d = parsed.d || 1;
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ym = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, '0')}-01`;
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Normaliza valores monetarios a `number`. Maneja formato europeo
 * (1.234,56), americano (1,234.56), símbolos monetarios (€, $, £)
 * y espacios. Devuelve `NaN` si no se puede parsear.
 */
export function normalizeValor(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const s = String(value || '').trim();
  if (!s) return NaN;
  const hasComma = s.includes(',');
  const cleaned = s
    .replace(/[€$£\s]/g, '')
    .replace(/[a-zA-Z]/g, '');
  const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Detecta columnas `fecha` y `valor` en los headers (case-insensitive).
 * Acepta aliases · 'fecha'/'date'/'mes'/'periodo' y 'valor'/'value'/
 * 'importe'/'saldo'/'amount'/'valor_eur'. Si no encuentra coincidencia,
 * asume las dos primeras columnas en orden.
 */
export function detectColumns(headers: string[]): { fechaCol: string; valorCol: string } {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const fechaIdx = lower.findIndex((h) =>
    ['fecha', 'date', 'mes', 'periodo', 'periodo_valoracion'].includes(h),
  );
  const valorIdx = lower.findIndex((h) =>
    ['valor', 'value', 'importe', 'saldo', 'amount', 'valor_eur'].includes(h),
  );
  return {
    fechaCol: headers[fechaIdx >= 0 ? fechaIdx : 0],
    valorCol: headers[valorIdx >= 0 ? valorIdx : 1],
  };
}

/**
 * Detecta el delimitador de un CSV inspeccionando las primeras líneas.
 * Cuenta `,`, `;`, `\t`, `|` en la cabecera + 2 filas siguientes y
 * devuelve el más frecuente. Default · coma. Crítico para CSVs
 * europeos que usan `;` (ya que `,` se usa como separador decimal).
 */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).slice(0, 3).filter((l) => l.length > 0);
  if (lines.length === 0) return ',';
  const candidates = [',', ';', '\t', '|'];
  let bestDelim = ',';
  let bestCount = 0;
  for (const delim of candidates) {
    // Cuenta apariciones del delimitador FUERA de comillas (heurística simple
    // · respeta `"1.234,56"` cuando el delim es `,`).
    let count = 0;
    for (const line of lines) {
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes && ch === delim) {
          count++;
        }
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestDelim = delim;
    }
  }
  return bestDelim;
}

/** Resultado del parser de una fila */
export interface ParsedImportRow {
  fecha: string; // YYYY-MM-DD vacío si inválida
  valor: number; // NaN si inválido
  raw: { fechaRaw: unknown; valorRaw: unknown };
  invalid?: 'fecha' | 'valor';
}

/**
 * Parser de una fila a `ParsedImportRow`. Reglas de invalidación:
 * - `fecha` vacía → invalid='fecha'
 * - `valor` no finito O `valor < 0` → invalid='valor'
 *   (alineado con `validateValoracionInput` · permite valor=0 para
 *   activos liquidados · review Copilot)
 */
export function parseRow(fechaRaw: unknown, valorRaw: unknown): ParsedImportRow {
  const fecha = normalizeFecha(fechaRaw);
  const valor = normalizeValor(valorRaw);
  const row: ParsedImportRow = { fecha, valor, raw: { fechaRaw, valorRaw } };
  if (!fecha) row.invalid = 'fecha';
  else if (!Number.isFinite(valor) || valor < 0) row.invalid = 'valor';
  return row;
}
