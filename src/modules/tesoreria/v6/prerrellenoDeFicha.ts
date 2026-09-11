// §4.5 prerrellenada · lo que trae la ficha al abrirse desde el extracto: una
// línea sin cuadre («Crear movimiento») o varias elegidas («Clasificar las N
// como…»). Es la regla, no el formulario, y por eso está aparte del drawer.

import type { LineaExtracto } from './extractoSesion';
import type { ValoresFicha } from './FichaMovimiento';

/**
 * Con varias se prellena con la PRIMERA para que el formulario no salga en
 * blanco; el importe y la fecha de cada una los pone `valoresPorLinea` al
 * guardar, no éstos.
 */
export function prerrellenoDeFicha(
  creando: LineaExtracto | null,
  clasificandoVarias: LineaExtracto[] | null,
  cuentaId: number | null,
): Partial<ValoresFicha> | undefined {
  const l = creando ?? clasificandoVarias?.[0];
  if (!l) return undefined;
  return {
    tipo: l.importe >= 0 ? 'ingreso' : 'gasto',
    concepto: l.textoBanco,
    importe: l.importe,
    fecha: l.fecha,
    cuentaId,
  };
}
