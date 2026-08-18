// ============================================================================
// El extracto de una TARJETA de crédito · §3 (Fase 3a)
// ============================================================================
//
// El extracto de la tarjeta (Carrefour) llega en PDF y lista sus compras del
// periodo: fecha · concepto · importe. No es un extracto BANCARIO —el import de
// banco solo lee CSV/XLS y va atado a una cuenta—, así que se lee aparte y sirve
// para CONCILIAR las piezas de la tarjeta (previsto/confirmado → conciliado).
//
// El parser (`parsearLineasCarrefour`) es PURO —trabaja sobre las líneas de
// texto ya extraídas— para poder probarlo sin un PDF. La lectura del PDF
// (`leerExtractoTarjeta`) es una capa fina encima, con `pdfjs`.
// ============================================================================

/** Una compra del extracto de la tarjeta. */
export interface LineaExtractoTarjeta {
  /** ISO `YYYY-MM-DD`. */
  fecha: string;
  /** El texto LITERAL del extracto. */
  concepto: string;
  /** Magnitud del cargo · positiva (una devolución vendría negativa). */
  importe: number;
}

// `DD/MM/YYYY <concepto...> <importe>[ €]` · el importe es el ÚLTIMO número con
// dos decimales de la línea (formato español: 1.667,13 · 20,89 · -12,50).
const RE_LINEA = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*€?$/;

/** Un importe español a número · `1.667,13` → 1667.13. */
export function importeEspañol(texto: string): number {
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

/**
 * Saca las compras de las líneas de texto del extracto.
 *
 * Solo las que EMPIEZAN por una fecha `DD/MM/YYYY`; las de cabecera, totales
 * ("Total compras…") y pie no empiezan por fecha, así que caen solas. El importe
 * 0 es ruido y no se emite.
 */
export function parsearLineasCarrefour(lineas: string[]): LineaExtractoTarjeta[] {
  const out: LineaExtractoTarjeta[] = [];
  for (const raw of lineas) {
    const m = RE_LINEA.exec((raw ?? '').trim());
    if (!m) continue;
    const [, dd, mm, yyyy, concepto, imp] = m;
    const importe = importeEspañol(imp);
    if (!Number.isFinite(importe) || importe === 0) continue;
    out.push({ fecha: `${yyyy}-${mm}-${dd}`, concepto: concepto.trim(), importe });
  }
  return out;
}

/** Reconstruye las líneas de una página agrupando por Y y ordenando por X. */
function lineasDePagina(items: Array<{ str: string; x: number; y: number }>): string[] {
  const filas = new Map<number, Array<{ str: string; x: number }>>();
  for (const it of items) {
    const y = Math.round(it.y);
    const fila = filas.get(y) ?? [];
    fila.push({ str: it.str, x: it.x });
    filas.set(y, fila);
  }
  return Array.from(filas.entries())
    .sort((a, b) => b[0] - a[0]) // de arriba a abajo
    .map(([, fila]) =>
      fila
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
}

/**
 * Lee el PDF del extracto de una tarjeta y devuelve sus compras.
 *
 * Mismo `pdfjs` que el resto de la app (`aeatParserService`). Puro de red: no
 * sube nada, todo se resuelve en el navegador.
 */
export async function leerExtractoTarjeta(file: File): Promise<LineaExtractoTarjeta[]> {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  const lineas: string[] = [];
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => {
        if (!('str' in it)) return null;
        const str = String(it.str ?? '').trim();
        const t = Array.isArray(it.transform) ? it.transform : [];
        return str ? { str, x: Number(t[4]) || 0, y: Number(t[5]) || 0 } : null;
      })
      .filter((it): it is { str: string; x: number; y: number } => Boolean(it));
    lineas.push(...lineasDePagina(items));
  }

  return parsearLineasCarrefour(lineas);
}
