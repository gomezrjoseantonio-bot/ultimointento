// Lo que trae la ficha al abrirse desde el extracto · una línea, o la primera
// de varias, y nada si no hay ninguna.
//
// Rediseño de Conciliar (P1 · Jose): el botón de piso de una entidad abre ESTA
// misma ficha, prerrellenada con el piso elegido y con lo que el motor ya sabe
// (familia y subtipo de la línea), y el usuario confirma ahí. La ficha sigue
// siendo lo único que escribe; aquí no se inventa ningún flujo nuevo.

import type { LineaExtracto } from './extractoSesion';
import type { ValoresFicha } from './FichaMovimiento';

export interface PisoPrefijado {
  /** `null` = es personal, sin piso. */
  inmuebleId: number | null;
}

export function prerrellenoDeFicha(
  creando: LineaExtracto | null,
  clasificandoVarias: LineaExtracto[] | null,
  cuentaId: number | null,
  piso?: PisoPrefijado,
): Partial<ValoresFicha> | undefined {
  const l = creando ?? clasificandoVarias?.[0];
  if (!l) return undefined;
  const c = l.clasificacion;
  const conFamilia = c?.familia && c.naturaleza !== 'movimiento_interno';
  return {
    tipo: l.importe >= 0 ? 'ingreso' : 'gasto',
    concepto: l.textoBanco,
    importe: l.importe,
    fecha: l.fecha,
    cuentaId,
    ...(conFamilia ? { familia: c.familia, subtipo: c.subtipo ?? '' } : {}),
    ...(piso ? { inmuebleId: piso.inmuebleId } : c?.inmuebleId != null ? { inmuebleId: c.inmuebleId } : {}),
  };
}
