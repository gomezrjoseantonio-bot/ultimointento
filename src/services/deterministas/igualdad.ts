// Qué significa «igual» aquí · y por qué no es `===`.
//
// Esta fase no aproxima, pero dos datos que representan la misma realidad pueden
// no ser idénticos byte a byte:
//
//   · Las FECHAS llegan como ISO con hora («2026-08-01T00:00:00.000Z») o sin
//     ella. Comparar la cadena entera haría que el mismo día no fuese el mismo
//     día. Se comparan los diez primeros caracteres, que es la fecha.
//
//   · Los IMPORTES son céntimos guardados en coma flotante. 454.66 escrito por
//     dos caminos distintos puede diferir en 1e-13, y el signo del extracto
//     (negativo en un cargo) no tiene por qué coincidir con el del cuadro
//     (magnitud). Se comparan MAGNITUDES redondeadas al céntimo.
//
// Esto no es una tolerancia: medio céntimo de diferencia sigue sin cuadrar. Es
// leer el mismo número escrito de dos maneras.

/** El día, ignorando la hora y el huso. */
export function mismoDia(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.slice(0, 10) === b.slice(0, 10);
}

/** Céntimos exactos, en magnitud · el signo lo pone de qué lado se mire. */
export function mismoImporte(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.round(Math.abs(a) * 100) === Math.round(Math.abs(b) * 100);
}
