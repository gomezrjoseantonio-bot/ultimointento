/**
 * Consolidación Contratos → Alquileres · Fase B · resolución del alias de ruta.
 *
 * Función PURA (sin JSX) que traduce un path del alias visual `/alquileres`
 * a la ruta canónica `/contratos`, conservando el sufijo de ruta
 * (`/alquileres/nuevo` → `/contratos/nuevo`) y el query string
 * (`?tab=vigentes`, `?inmueble=3`), que `<Navigate>` no preserva por defecto.
 *
 * La marca visual del módulo es "Alquileres"; la ruta canónica sigue siendo
 * `/contratos` (no se renombra la ruta · spec §3/§12.5).
 *
 * @param pathname p.ej. `/alquileres` o `/alquileres/nuevo`.
 * @param search   query string incluyendo `?` (o cadena vacía).
 * @returns destino canónico bajo `/contratos`, con sufijo y query preservados.
 */
export function resolveAlquileresRedirect(pathname: string, search: string): string {
  const resto = pathname.replace(/^\/alquileres/, '');
  return `/contratos${resto}${search}`;
}
