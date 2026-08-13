// §modelo del apunte · cómo se nombra un previsto en el drawer de import.
//
// Reutiliza el adaptador canónico (`eventoAItem`) para que un previsto se lea
// IGUAL aquí que en Tesorería y el Panel: título = quién · qué es · inmueble.
// Antes el drawer pintaba su `description` en crudo.

import { eventoAItem } from '../../../services/punteo/punteoAdapter';
import type { TreasuryEvent } from '../../../services/db';

export function nombrarPrevisto(
  ev: TreasuryEvent,
  aliasInmueble?: (id: number | string) => string | undefined,
): string {
  // Sin id no se puede adaptar (aún no persistido) · queda su texto, que algo dice.
  if (ev.id == null) return ev.description ?? 'un previsto';
  const it = eventoAItem(ev as TreasuryEvent & { id: number }, aliasInmueble);
  let label = it.concepto;
  if (it.detalle) label += ` · ${it.detalle}`;
  // El inmueble solo si no lo dice ya el título/detalle (no repetirlo).
  if (it.activo?.alias && !label.includes(it.activo.alias)) label += ` · ${it.activo.alias}`;
  return label;
}
