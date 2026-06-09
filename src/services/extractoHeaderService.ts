/**
 * Lector de CABECERA de extracto bancario (FIX PUNTO 4 · P12).
 *
 * El fichero de extracto trae, antes de los movimientos, una cabecera con la
 * identidad de la cuenta: banco · IBAN · titular · saldo y fecha (verificado en
 * Santander · "CUENTA SANTANDER" · "ES54…8676" · "36.550,00 EUR · 09/06/2026").
 * Este servicio LEE esa cabecera para que el importador pueda:
 *   · casar el extracto con una cuenta existente por IBAN (sin preguntar), o
 *   · ofrecer crear la cuenta al vuelo con esos datos (saldo + fecha incluidos).
 *
 * Es un lector INDEPENDIENTE · NO toca el parser de movimientos del importador
 * (`bankParser`/`bankStatementOrchestrator`): solo mira las primeras filas en
 * busca de etiquetas. Si no encuentra IBAN, devuelve un resultado vacío y el
 * importador cae al selector de "cuenta destino" de respaldo.
 *
 * Ejes (§3.9) · el saldo/fecha de la cabecera es el saldo de HOY de la cuenta
 * (PRESENTE) · los movimientos siguen alimentando `movements`. Sin backfill.
 */
import { parseEsNumber } from '../utils/numberUtils';
import { validateIbanEs, normalizeIban, detectBankByIBAN } from '../utils/accountHelpers';

export interface ExtractoHeader {
  /** IBAN normalizado y validado (ES + 22) · clave para casar la cuenta. */
  iban?: string;
  /** Nombre del banco (derivado del IBAN o del texto de cabecera). */
  banco?: string;
  /** Titular de la cuenta (informativo). */
  titular?: string;
  /** Saldo de la cabecera → saldo inicial de la cuenta al crearla. */
  saldo?: number;
  /** Fecha del saldo · YYYY-MM-DD · TZ-safe (NO usa `new Date(str)`). */
  fecha?: string;
}

// Solo miramos las primeras filas · la cabecera vive antes de los movimientos.
const MAX_FILAS_CABECERA = 25;

// ── Normalizadores TZ-safe ────────────────────────────────────────────────────

/**
 * dd/mm/yyyy o yyyy-mm-dd → "YYYY-MM-DD" sin `new Date(string)` (que parsea en
 * UTC y desplaza el día · mismo off-by-one que P3). Formato español: dd/mm.
 */
export function normalizeFechaCabecera(raw: string): string | undefined {
  const s = (raw || '').trim();
  // ISO (yyyy-mm-dd) primero · si no, dd/mm/yyyy (formato español).
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mes = m[2].padStart(2, '0');
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    if (Number(mes) >= 1 && Number(mes) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${mes}-${d}`;
    }
  }
  return undefined;
}

const IBAN_RE = /ES\d{2}(?:[ -]?\d){20}/i;

function buscarIban(texto: string): string | undefined {
  const m = texto.match(IBAN_RE);
  if (!m) return undefined;
  const candidato = normalizeIban(m[0]);
  return validateIbanEs(candidato).ok ? candidato : undefined;
}

const LABEL_SALDO = /saldo/i;
const LABEL_FECHA = /fecha/i;
const LABEL_TITULAR = /titular|nombre/i;

const NUM_RE = /-?\d[\d.\s]*,\d{2}|-?\d[\d.\s]*\d|\d+/;

function esCeldaNumerica(cell: string): boolean {
  return /\d/.test(cell) && /[.,]\d{2}\b/.test(cell.replace(/eur|€/gi, '').trim());
}

/**
 * Extrae la cabecera de una rejilla de celdas (primeras filas del fichero).
 * Pura y testeable · `extractExtractoHeader` solo aporta la lectura del File.
 */
export function parseHeaderGrid(rows: string[][]): ExtractoHeader {
  const grid = rows
    .slice(0, MAX_FILAS_CABECERA)
    .map((r) => r.map((c) => (c == null ? '' : String(c))));
  const flat = grid.flat();
  const flatText = flat.join('  ');

  const header: ExtractoHeader = {};

  // 1. IBAN · señal principal.
  header.iban = buscarIban(flatText);

  // 2. Banco · del IBAN (fiable) o de un "CUENTA <BANCO>" / nombre en el texto.
  if (header.iban) {
    header.banco = detectBankByIBAN(header.iban)?.name ?? undefined;
  }
  if (!header.banco) {
    const mCuenta = flatText.match(/cuenta\s+([A-Za-zÁÉÍÓÚÑ&.\- ]{3,30})/i);
    if (mCuenta) header.banco = mCuenta[1].trim().replace(/\s{2,}.*$/, '');
  }

  // 3. Recorre celdas buscando etiquetas y su valor (en la misma celda tras el
  //    label, o en la siguiente celda no vacía de la fila).
  const valorTrasLabel = (row: string[], idx: number, label: RegExp): string | undefined => {
    const propia = row[idx].replace(label, '').replace(/[:·\-]/g, ' ').trim();
    if (propia) return propia;
    for (let j = idx + 1; j < row.length; j++) {
      if (row[j] && row[j].trim()) return row[j].trim();
    }
    return undefined;
  };

  for (const row of grid) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      if (!cell) continue;

      if (header.saldo == null && LABEL_SALDO.test(cell)) {
        const v = valorTrasLabel(row, i, LABEL_SALDO);
        const num = v ? v.match(NUM_RE)?.[0] : undefined;
        if (num) {
          const parsed = parseEsNumber(num);
          if (parsed.value != null) header.saldo = parsed.value;
        }
      }

      if (header.fecha == null && LABEL_FECHA.test(cell)) {
        const v = valorTrasLabel(row, i, LABEL_FECHA) ?? cell;
        const f = normalizeFechaCabecera(v);
        if (f) header.fecha = f;
      }

      if (header.titular == null && LABEL_TITULAR.test(cell)) {
        const v = valorTrasLabel(row, i, LABEL_TITULAR);
        // Un titular no es ni un IBAN ni un número.
        if (v && !IBAN_RE.test(v) && !esCeldaNumerica(v)) header.titular = v;
      }
    }
  }

  // 4. Fecha de respaldo · cualquier dd/mm/yyyy en la cabecera si no había label.
  if (!header.fecha) {
    const f = normalizeFechaCabecera(flatText);
    if (f) header.fecha = f;
  }

  return header;
}

// ── Lectura del File → rejilla ────────────────────────────────────────────────

function splitDelimited(line: string): string[] {
  // Detecta el delimitador más probable de la línea (; , o tab).
  const delim = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
  return line.split(delim).map((c) => c.replace(/^"|"$/g, '').trim());
}

async function readGrid(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    return text
      .split(/\r?\n/)
      .slice(0, MAX_FILAS_CABECERA)
      .map(splitDelimited);
  }
  // XLS/XLSX · reutiliza la librería ya presente en el bundle (dynamic import).
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  }) as unknown[][];
  return rows.slice(0, MAX_FILAS_CABECERA).map((r) => r.map((c) => (c == null ? '' : String(c))));
}

/**
 * Lee la cabecera de un fichero de extracto. Nunca lanza · si no puede leer el
 * fichero o no hay cabecera reconocible devuelve `{}` (el importador cae al
 * selector de respaldo).
 */
export async function extractExtractoHeader(file: File): Promise<ExtractoHeader> {
  try {
    const grid = await readGrid(file);
    return parseHeaderGrid(grid);
  } catch {
    return {};
  }
}
