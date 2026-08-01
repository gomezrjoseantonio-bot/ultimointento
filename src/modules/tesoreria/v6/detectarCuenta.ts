// ============================================================================
// Tesorería V6 · §4.7 · "la cuenta se detecta por el IBAN del fichero"
// ============================================================================
//
// Solo hace falta en la puerta GLOBAL (desde el hero). Entrando por una cuenta,
// la cuenta ya está fijada y esto no se ejecuta.
//
// El emparejador de perfiles (`bankProfileMatcher`) ya saca el BANCO del IBAN,
// pero eso no basta: con dos cuentas en el mismo banco acertaría el perfil y
// erraría la cuenta, que es la que mueve saldos. Aquí se busca el IBAN completo.
//
// Es una ayuda, no una autoridad: si no se detecta nada, o si hay más de una
// cuenta candidata, la UI pide elegir. Importar en la cuenta equivocada falsea
// todos los saldos y no se deshace solo, así que ante duda no se adivina.
// ============================================================================

import type { Account } from '../../../services/db';

/** IBAN español: ES + 2 de control + 20 dígitos, con separadores opcionales. */
const IBAN_ES = /ES\s*\d{2}(?:[\s-]*\d){20}/gi;

/** Cuántos bytes del fichero se miran · el IBAN va siempre en la cabecera. */
const MUESTRA_BYTES = 64 * 1024;

export function normalizarIban(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** IBANs que aparecen en un texto, normalizados y sin repetir. */
export function ibansEn(texto: string): string[] {
  const encontrados = texto.match(IBAN_ES) ?? [];
  return Array.from(new Set(encontrados.map(normalizarIban)));
}

export type DeteccionCuenta =
  | { estado: 'detectada'; cuenta: Account }
  | { estado: 'sin-iban' }
  | { estado: 'iban-desconocido'; iban: string }
  | { estado: 'ambigua'; cuentas: Account[] };

/**
 * Cruza los IBANs del texto con las cuentas del usuario.
 *
 * Exportada aparte de la lectura del fichero para poder probar el cruce sin
 * fabricar `File`s.
 */
export function cuentaPorIban(texto: string, cuentas: Account[]): DeteccionCuenta {
  const ibans = ibansEn(texto);
  if (ibans.length === 0) return { estado: 'sin-iban' };

  const porIban = new Map<string, Account>();
  for (const c of cuentas) {
    if (c.status === 'DELETED' || !c.iban) continue;
    porIban.set(normalizarIban(c.iban), c);
  }

  const casan: Account[] = [];
  for (const iban of ibans) {
    const c = porIban.get(iban);
    if (c && !casan.some((x) => x.id === c.id)) casan.push(c);
  }

  if (casan.length === 1) return { estado: 'detectada', cuenta: casan[0] };
  if (casan.length > 1) return { estado: 'ambigua', cuentas: casan };
  return { estado: 'iban-desconocido', iban: ibans[0] };
}

/**
 * Lee la cabecera del fichero y detecta la cuenta.
 *
 * Se leen solo los primeros 64 KB: el IBAN va arriba en todos los formatos, y
 * un extracto anual en Excel puede pesar varios MB que no hace falta traer a
 * memoria. En XLSX el contenido va comprimido y esta lectura no verá el IBAN —
 * es un caso conocido y por eso el fallo es siempre "elige la cuenta", nunca
 * una cuenta equivocada.
 */
export async function detectarCuenta(file: File, cuentas: Account[]): Promise<DeteccionCuenta> {
  try {
    const trozo = file.slice(0, MUESTRA_BYTES);
    const texto = await trozo.text();
    return cuentaPorIban(texto, cuentas);
  } catch {
    return { estado: 'sin-iban' };
  }
}
