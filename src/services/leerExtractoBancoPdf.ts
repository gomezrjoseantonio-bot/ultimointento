// ============================================================================
// Leer un extracto de CUENTA bancaria en PDF con la IA
// ============================================================================
//
// El import de banco lee CSV/XLS/N43 con SheetJS, pero algunos bancos solo dan
// el extracto en PDF (o escaneado). La IA (`functions/chat.js`, tipo
// `scan_extracto_banco`) lo lee y devuelve sus líneas ya con el signo de banco
// —negativo si sale dinero, positivo si entra—, que es justo la forma de un
// `ParsedMovement`. Desde ahí sigue el MISMO camino que un xls: se insertan, se
// emparejan y se revisan en el drawer.
// ============================================================================

import { callScanChat } from './scanChatService';
import type { ParsedMovement } from '../types/bankProfiles';

/** Una fecha (`Date` o texto DD/MM/YYYY o ISO) a ISO `YYYY-MM-DD`, o `null`. */
function aIso(fecha: unknown): string | null {
  if (typeof fecha === 'string') {
    const s = fecha.trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const es = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (es) return `${es[3]}-${es[2].padStart(2, '0')}-${es[1].padStart(2, '0')}`;
  }
  return null;
}

/** Normaliza lo que devuelve la IA a `ParsedMovement[]`. Puro, testeable. */
export function movimientosDeIABanco(extraido: unknown): ParsedMovement[] {
  const bruto = Array.isArray(extraido)
    ? extraido
    : Array.isArray((extraido as { lineas?: unknown })?.lineas)
      ? (extraido as { lineas: unknown[] }).lineas
      : [];
  const movs: ParsedMovement[] = [];
  for (const item of bruto) {
    const o = item as { fecha?: unknown; concepto?: unknown; importe?: unknown };
    const fecha = aIso(o?.fecha);
    const amount = typeof o?.importe === 'number' ? o.importe : Number(o?.importe);
    const description = typeof o?.concepto === 'string' ? o.concepto.trim() : '';
    if (!fecha || !description || !Number.isFinite(amount) || amount === 0) continue;
    movs.push({ date: new Date(`${fecha}T00:00:00Z`), amount, description });
  }
  return movs;
}

/** Lee el PDF del extracto de una cuenta y devuelve sus movimientos. */
export async function leerExtractoBancoPdf(file: File): Promise<ParsedMovement[]> {
  const r = await callScanChat(file, 'application/pdf', 'scan_extracto_banco');
  if (!r.ok) throw new Error(r.error || 'No se pudo leer el PDF del extracto.');
  return movimientosDeIABanco(r.extraido);
}
