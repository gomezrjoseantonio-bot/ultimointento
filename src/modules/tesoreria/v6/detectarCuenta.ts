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
//
// E2.4.2 · Paso 0 · hasta aquí se leían los primeros 64 KB del fichero COMO
// TEXTO. Un XLS/XLSX es un ZIP, así que el IBAN no aparecía y Sabadell, Unicaja
// e ING caían siempre al selector: «solo autodetectaba Santander» (CSV). Ahora
// la cabecera la lee `extractoHeaderService` (P12 · abre CSV y Excel), que
// además saca banco, titular, saldo y fecha: cuando el IBAN no es de ninguna
// cuenta (`iban-desconocido`) viajan con la señal, para que quien la reciba
// pueda ofrecer crear la cuenta con todo relleno. Lo que la UI haga con eso es
// capa visual, aparte.
// ============================================================================

import type { Account } from '../../../services/db';
import { parseHeaderGrid, readGrid, type ExtractoHeader } from '../../../services/extractoHeaderService';

/** IBAN español: ES + 2 de control + 20 dígitos, con separadores opcionales. */
const IBAN_ES = /ES\s*\d{2}(?:[\s-]*\d){20}/gi;

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
  | {
      estado: 'iban-desconocido';
      iban: string;
      /**
       * E2.4.2 · lo que la cabecera dice de esa cuenta que aún no existe ·
       * banco, titular, saldo y fecha. Es la señal para «crear la cuenta con
       * banco + IBAN ya rellenos» en vez de pedir elegir a ciegas.
       */
      cabecera?: ExtractoHeader;
    }
  | { estado: 'ambigua'; cuentas: Account[] };

/**
 * Cruza los IBANs del texto con las cuentas del usuario.
 *
 * Exportada aparte de la lectura del fichero para poder probar el cruce sin
 * fabricar `File`s.
 */
export function cuentaPorIban(texto: string, cuentas: Account[], cabecera?: ExtractoHeader): DeteccionCuenta {
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
  return { estado: 'iban-desconocido', iban: ibans[0], ...(cabecera ? { cabecera } : {}) };
}

/**
 * Lee la cabecera del fichero y detecta la cuenta.
 *
 * CSV, TXT, XLS y XLSX: `readGrid` abre el libro cuando hace falta y devuelve
 * las primeras filas. El IBAN va arriba en todos los formatos; un extracto
 * anual no se trae entero a memoria. Si el fichero no se puede leer, el fallo
 * es siempre "elige la cuenta", nunca una cuenta equivocada.
 */
export async function detectarCuenta(file: File, cuentas: Account[]): Promise<DeteccionCuenta> {
  try {
    const grid = await readGrid(file);
    const texto = grid.map((fila) => fila.join(' ')).join('\n');
    const cabecera = parseHeaderGrid(grid);
    return cuentaPorIban(texto, cuentas, cabecera);
  } catch {
    return { estado: 'sin-iban' };
  }
}
