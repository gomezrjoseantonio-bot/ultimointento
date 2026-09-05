// ============================================================================
// El ámbito de un préstamo, dicho en el vocabulario del catálogo único
// ============================================================================
//
// `Prestamo.ambito` sigue en mayúsculas ('PERSONAL' | 'INMUEBLE'): el dominio
// de financiación queda FUERA del alcance de E2.4.1. Pero lo que un préstamo
// engendra —sus cuotas previstas, el movimiento de una cancelación— son
// `TreasuryEvent`/`Movement`, y esos llevan el eje 4 del catálogo en
// minúsculas. Ésta es la ÚNICA traducción entre los dos; no se repite en cada
// pantalla.
//
// TODO(E2.4.x): retirar cuando `Prestamo.ambito` pase al catálogo único.
// ============================================================================

import type { Ambito } from '../catalogo/catalogoUnico';

export function ambitoDelPrestamo(prestamo: { ambito?: 'PERSONAL' | 'INMUEBLE' | null }): Ambito {
  return prestamo.ambito === 'INMUEBLE' ? 'inmueble' : 'personal';
}
