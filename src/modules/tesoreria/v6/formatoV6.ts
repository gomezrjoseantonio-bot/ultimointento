// Formato de importe único de Tesorería V6 (§5, regla vinculante).
//
//   miles con punto · dos decimales SOLO si los hay · signo explícito cuando
//   indica dirección:  +1.000 €   −38,20 €   24.465,80 €
//
// El signo menos es U+2212 (−), no el guion del teclado: en tipografía tabular
// el guion queda corto y descentrado junto a las cifras.

const MENOS = '−';

/**
 * Decimales solo si los hay · `1000` → "1.000" · `38.2` → "38,20".
 *
 * Agrupado a mano en vez de `toLocaleString('es-ES')`: §5 fija un formato
 * español CONCRETO, no "el del locale del usuario", y hay entornos con ICU
 * reducido (el Node de los tests, sin ir más lejos) donde `es-ES` aplica la
 * coma decimal pero se salta el separador de miles. A mano sale igual en el
 * navegador y en los tests.
 */
function cifra(n: number): string {
  const centimos = Math.round(Math.abs(n) * 100);
  const enteros = Math.floor(centimos / 100);
  const resto = centimos % 100;
  const miles = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return resto === 0 ? miles : `${miles},${String(resto).padStart(2, '0')}`;
}

/**
 * Importe con signo · para movimientos, donde el signo dice la dirección.
 * `+650 €` · `−38,20 €`. El cero sale sin signo.
 */
export function importeConSigno(n: number, conEuro = true): string {
  const signo = n > 0 ? '+' : n < 0 ? MENOS : '';
  return `${signo}${cifra(n)}${conEuro ? ' €' : ''}`;
}

/**
 * Importe sin signo positivo · para saldos y cierres, donde el número no
 * indica dirección sino cuánto hay. Un saldo negativo sí lleva su menos.
 */
export function importeSaldo(n: number, conEuro = true): string {
  const signo = n < 0 ? MENOS : '';
  return `${signo}${cifra(n)}${conEuro ? ' €' : ''}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Nombre del mes en minúscula · sentence case lo aplica quien lo pinta. */
export function nombreMes(month0: number): string {
  return MESES[((month0 % 12) + 12) % 12];
}

/** Abreviatura de 3 letras para el rango ("jul – dic 2026"). */
export function mesCorto(month0: number): string {
  return nombreMes(month0).slice(0, 3);
}

/** Rango de la rejilla de meses · "jul – dic 2026" · "nov 2026 – abr 2027". */
export function rangoMeses(
  desde: { year: number; month0: number },
  hasta: { year: number; month0: number }
): string {
  const a = mesCorto(desde.month0);
  const b = mesCorto(hasta.month0);
  return desde.year === hasta.year
    ? `${a} – ${b} ${hasta.year}`
    : `${a} ${desde.year} – ${b} ${hasta.year}`;
}

/** "jueves · 30 jul 2026" para el hero. */
export function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dia = d.toLocaleDateString('es-ES', { weekday: 'long' });
  return `${dia} · ${d.getDate()} ${mesCorto(d.getMonth())} ${d.getFullYear()}`;
}

/** "el 22 de julio" para el aviso de cuenta corta. */
export function diaYMes(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  // "5 ago", no "5 de agosto": va dentro del pie de la tarjeta de cuenta, junto
  // a un importe que con decimales ya es largo. Escrito entero, la frase se
  // partía en tres líneas y descuadraba la tarjeta contra las de al lado.
  return `${d.getDate()} ${nombreMes(d.getMonth()).slice(0, 3)}`;
}


/**
 * "Jueves 30" · §9.
 *
 * Para la cabecera del día dentro del drawer del mes, donde el mes y el año ya
 * están dichos dos veces más arriba.
 */
export function diaSemanaYNumero(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${dias[new Date(y, m - 1, d).getDay()]} ${d}`;
}
