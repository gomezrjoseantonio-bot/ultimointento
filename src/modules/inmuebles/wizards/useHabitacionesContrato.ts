// R3 · las habitaciones del contrato salen de la explotación del inmueble
// (nombre + renta objetivo). Hook aparte para no engordar el wizard.

import { useEffect, useState } from 'react';
import type { ExplotacionAlquiler } from '../../../services/db';
import { getExplotacionDeInmueble } from '../../../services/explotacionAlquilerService';
import { opcionesHabitacionContrato, type OpcionHabitacion } from './contratoWizardHelpers';

/**
 * Opciones de habitación para el `<select>` del wizard. Con explotación por
 * habitaciones manda su lista (id real + nombre + renta objetivo); si no, se cae
 * al conteo legacy de `bedrooms` con ids `hab-N`. Devuelve `[]` cuando no hay
 * habitaciones que ofrecer.
 */
export function useHabitacionesContrato(
  inmuebleId: number | null,
  bedrooms: number,
): OpcionHabitacion[] {
  const [explotacion, setExplotacion] = useState<ExplotacionAlquiler | undefined>();
  useEffect(() => {
    if (inmuebleId == null) {
      setExplotacion(undefined);
      return;
    }
    let vivo = true;
    getExplotacionDeInmueble(inmuebleId)
      .then((e) => {
        if (vivo) setExplotacion(e);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [inmuebleId]);

  return opcionesHabitacionContrato(explotacion, bedrooms);
}
