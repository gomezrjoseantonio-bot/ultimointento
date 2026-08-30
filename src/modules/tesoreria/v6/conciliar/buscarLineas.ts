// ============================================================================
// Buscar en el extracto · y los atajos que salen del propio fichero
// ============================================================================
//
// Con 95 líneas en «te necesitan», contestarlas de una en una no es un trabajo
// razonable, y la pantalla no ofrecía otra cosa: ni buscador ni forma de coger
// varias. Esto es la mitad de dato de ese arreglo (la otra mitad es la barra de
// selección de `PanelConciliar`).
//
// ── Por qué los atajos se calculan y no se escriben ─────────────────────────
//
// La tentación es una lista fija: Bizum, Préstamos, Tarjeta. Se queda muerta el
// día que el usuario sube un extracto sin bizums —un botón que no filtra nada—
// y se queda corta el día que sube uno lleno de recibos de una comercializadora
// que a nadie se le ocurrió poner en la lista. Contando palabras sobre las
// líneas que hay DELANTE, el atajo siempre corresponde a algo que está ahí, y
// el número que lleva al lado es verdad por construcción.
//
// Un atajo que alcanza a una sola línea no es un atajo: es la línea. Por eso el
// mínimo son dos.
// ============================================================================

import type { LineaExtracto } from '../extractoSesion';

/** Un botón de un clic · «Bizum · 3». */
export interface AtajoDeBusqueda {
  /** Lo que se lee en el botón. */
  etiqueta: string;
  /** Lo que se mete en el buscador al pulsarlo. */
  consulta: string;
  /** A cuántas líneas alcanza · se enseña, así que tiene que ser cierto. */
  cuantas: number;
}

/**
 * Texto comparable · sin acentos, sin mayúsculas.
 *
 * Nadie escribe los acentos en un buscador, y el banco los pone a veces sí y a
 * veces no dentro de la misma cuenta («Aroa Gómez» y «AROA GOMEZ» son la misma
 * persona en dos líneas seguidas).
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Todo lo que una línea ofrece para ser encontrada · su texto y su importe. */
function materialDeBusqueda(l: LineaExtracto): string {
  // El importe entra con punto y con coma: en pantalla se lee «−70,48 €» y es
  // así como el usuario lo va a teclear, pero el dato es un número JS.
  const conPunto = String(l.importe);
  const conComa = conPunto.replace('.', ',');
  return normalizar(`${l.textoBanco} ${l.fecha} ${conPunto} ${conComa}`);
}

/**
 * Las líneas que casan con lo que el usuario ha escrito.
 *
 * Varias palabras piden TODAS, no cualquiera: quien escribe «bizum aroa» está
 * estrechando, no ampliando. Sin consulta devuelve todo — un buscador vacío no
 * esconde nada.
 */
export function filtrarPorTexto(lineas: LineaExtracto[], consulta: string): LineaExtracto[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [...lineas];
  return lineas.filter((l) => {
    const material = materialDeBusqueda(l);
    return palabras.every((p) => material.includes(p));
  });
}

/**
 * Palabras que no distinguen nada · no merecen un botón.
 *
 * Las de relleno del castellano y las cuatro que el banco repite en todas las
 * líneas de cualquier extracto («recibo», «compra», «pago»…): un atajo que
 * alcanza a las 95 no ayuda a separar ninguna.
 */
const RELLENO = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'en', 'a', 'al', 'por', 'para', 'con', 'su',
  'sus', 'un', 'una', 'que', 'se', 'mes', 'cta', 'cuenta', 'recibo', 'pago', 'compra', 'favor',
  'sa', 'sl', 'slu', 'sau', 'sac',
]);

/** Cuántos atajos caben en la barra sin convertirla en otra lista. */
const CUANTOS_ATAJOS = 4;

/**
 * Los atajos de este extracto · las palabras que de verdad se repiten.
 *
 * Se cuenta en cuántas LÍNEAS DISTINTAS aparece cada palabra, no cuántas veces
 * aparece: «gas gas power» en una sola línea no la hace un atajo de tres.
 */
export function atajosDeBusqueda(lineas: LineaExtracto[]): AtajoDeBusqueda[] {
  const enCuantasLineas = new Map<string, number>();
  const comoSeEscribe = new Map<string, string>();

  for (const l of lineas) {
    const vistas = new Set<string>();
    for (const bruta of l.textoBanco.split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/)) {
      const palabra = normalizar(bruta);
      // Fuera lo corto, lo que lleva dígitos (números de recibo, años, CUPS) y
      // el relleno. Lo que queda es el nombre de algo.
      if (palabra.length < 3 || /\d/.test(palabra) || RELLENO.has(palabra)) continue;
      if (vistas.has(palabra)) continue;
      vistas.add(palabra);
      enCuantasLineas.set(palabra, (enCuantasLineas.get(palabra) ?? 0) + 1);
      if (!comoSeEscribe.has(palabra)) comoSeEscribe.set(palabra, bruta);
    }
  }

  return Array.from(enCuantasLineas.entries())
    .filter(([, cuantas]) => cuantas > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, CUANTOS_ATAJOS)
    .map(([palabra, cuantas]) => ({
      // Se enseña como lo escribe el banco («Bizum», no «bizum»), pero se busca
      // en normalizado: el botón tiene que encontrar también las que el banco
      // escribió en mayúsculas.
      etiqueta: comoSeEscribe.get(palabra) ?? palabra,
      consulta: palabra,
      cuantas,
    }));
}
