// «Clasificar las N como…» · el estado de VISTA de abrir la ficha una vez para
// varias líneas, con o sin piso prefijado (P1 · rediseño de Conciliar). Vive
// fuera del drawer para que el drawer no crezca: es un par de `useState` y dos
// gestos, sin JSX y sin escribir nada. Quien escribe sigue siendo la ficha.

import { useCallback, useState } from 'react';
import type { LineaExtracto } from './extractoSesion';
import type { PisoPrefijado } from './prerrellenoDeFicha';

export function useClasificarVarias(lineas: LineaExtracto[]) {
  // Las elegidas que se van a clasificar de un gesto · la ficha se abre UNA vez
  // y su concepto se aplica a todas, con el importe y la fecha de cada una.
  const [clasificandoVarias, setClasificandoVarias] = useState<LineaExtracto[] | null>(null);
  /** El piso con el que se abre la ficha desde una entidad · `undefined` = ninguno prefijado. */
  const [pisoPrefijado, setPisoPrefijado] = useState<PisoPrefijado | undefined>(undefined);

  const abrir = useCallback(
    (lineaIds: number[], piso?: PisoPrefijado) => {
      setPisoPrefijado(piso);
      setClasificandoVarias(lineas.filter((l) => lineaIds.includes(l.lineaId)));
    },
    [lineas],
  );
  const cerrar = useCallback(() => {
    setClasificandoVarias(null);
    setPisoPrefijado(undefined);
  }, []);

  return { clasificandoVarias, pisoPrefijado, abrir, cerrar };
}
