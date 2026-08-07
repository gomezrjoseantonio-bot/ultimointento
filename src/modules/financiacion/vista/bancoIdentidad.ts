// Identidad visual del banco · §12.5 de la guía v5.
//
// El logo sale de `Prestamo.banco` y de nada más. Antes se adivinaba de la
// primera palabra de `prestamo.nombre` (`helpers.ts · bancoFromNombre`), así
// que «Santander 78.500» pintaba el rojo del Santander por casualidad y
// «Préstamo coche» pintaba un genérico aunque el préstamo supiera su banco.
// Un préstamo sin banco apuntado se dice, no se inventa.

/** Las marcas con color oficial en la guía · el resto va en neutro. */
export type MarcaBanco =
  | 'santander'
  | 'sabadell'
  | 'unicaja'
  | 'bbva'
  | 'ing'
  | 'caixabank';

export interface IdentidadBanco {
  /** Nombre tal cual lo guardó el usuario · '' si el préstamo no lo trae. */
  nombre: string;
  /** Marca reconocida · `null` si no está en la guía o no hay banco. */
  marca: MarcaBanco | null;
  /** Las 2-3 letras del cuadradito · '—' si no hay banco apuntado. */
  abbr: string;
}

const MARCAS: Array<{ marca: MarcaBanco; claves: string[]; abbr: string }> = [
  { marca: 'santander', claves: ['santander'], abbr: 'SA' },
  { marca: 'sabadell', claves: ['sabadell'], abbr: 'SB' },
  { marca: 'unicaja', claves: ['unicaja'], abbr: 'UN' },
  { marca: 'bbva', claves: ['bbva'], abbr: 'BB' },
  { marca: 'ing', claves: ['ing'], abbr: 'ING' },
  { marca: 'caixabank', claves: ['caixabank', 'caixa'], abbr: 'CX' },
];

const iniciales = (nombre: string): string =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join('')
    .slice(0, 2)
    .toUpperCase();

/**
 * La identidad de un banco a partir del campo `banco` del préstamo.
 *
 * El emparejamiento con la marca se hace por palabra completa: `'ING'` no debe
 * pegar dentro de «Bankinter» ni de «Banco Sabadell».
 */
export function identidadBanco(banco: string | undefined): IdentidadBanco {
  const nombre = (banco ?? '').trim();
  if (!nombre) return { nombre: '', marca: null, abbr: '—' };

  const palabras = nombre.toLowerCase().split(/[^a-záéíóúñ]+/i).filter(Boolean);
  const encontrada = MARCAS.find((m) => m.claves.some((c) => palabras.includes(c)));
  if (encontrada) {
    return { nombre, marca: encontrada.marca, abbr: encontrada.abbr };
  }
  return { nombre, marca: null, abbr: iniciales(nombre) || '—' };
}
