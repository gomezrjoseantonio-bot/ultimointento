// ============================================================================
// Lo que TIENES en un producto del banco · VOCABULARIO §6 ter
// ============================================================================
//
// La otra mitad de las condiciones de inversión. *«Es aportación en este caso,
// pero habrá otros que será tener X en el fondo o en el plan de pensiones del
// banco — por eso era clave la modelación de las bonificaciones»* *(Jose · 9
// ago 2026)*.
//
// Son **dos preguntas distintas y hay que poder hacer las dos**:
//
//   · **¿le aportas?** · lo dice tesorería, con los movimientos que salen de su
//     cuenta hacia el producto (`aportacionesDeTesoreria`);
//   · **¿tienes X con él?** · lo dice la POSICIÓN, que es lo que vale hoy.
//
// Y no son intercambiables. Un fondo al que llevas cinco años sin aportar puede
// tener 40.000 € dentro; y quien acaba de aportar 30.000 € este año todavía no
// los tiene si el mercado ha caído. Medir una con la otra da un veredicto sobre
// dinero que no se corresponde con la condición.
//
// Es el mismo reparto que ya tienen los seguros —«unas entidades bonifican por
// tenerlo, otras por el número, otras por el importe»— y la nómina, que admite
// «X al mes **o** Y al año»: la regla dice qué se pregunta, y basta con una.
// ============================================================================

import type { PosicionInversion, TipoPosicion } from '../../types/inversiones';

/** Lo que hay en una familia de productos, en un banco. */
export interface SaldoEnProducto {
  /** La entidad, normalizada · para poder comparar «Unicaja» con «UNICAJA S.A.». */
  entidad: string;
  /** Fondos o planes · son condiciones distintas del anexo. */
  familia: 'fondo' | 'plan';
  /** Lo que vale hoy · la suma de las posiciones vivas. */
  valor: number;
}

/**
 * El nombre del banco, comparable.
 *
 * «Unicaja Banco, S.A.» y «unicaja» son el mismo banco, y una condición que
 * exige un producto SUYO no se puede resolver comparando cadenas a pelo.
 */
const clave = (entidad: string): string =>
  entidad
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(banco|banca|s\.?a\.?|sa|caja)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

const FAMILIA: Partial<Record<TipoPosicion, 'fondo' | 'plan'>> = {
  fondo_inversion: 'fondo',
  plan_pensiones: 'plan',
  plan_empleo: 'plan',
};

/**
 * Lo que hay en cada (banco · familia), sumando las posiciones vivas.
 *
 * Una posición dada de baja no cuenta: si la rescataste, ya no tienes nada con
 * ese banco, y decir que sí daría por cumplida una condición que se perdió el
 * día del rescate.
 */
export function saldoEnElBanco(posiciones: PosicionInversion[]): SaldoEnProducto[] {
  const porClave = new Map<string, SaldoEnProducto>();

  for (const p of posiciones) {
    if (p.activo === false) continue;
    const familia = FAMILIA[p.tipo];
    if (!familia) continue;
    const entidad = clave(p.entidad ?? '');
    if (!entidad) continue;

    const k = `${entidad}|${familia}`;
    const previo = porClave.get(k);
    const valor = Number(p.valor_actual) || 0;
    porClave.set(k, {
      entidad,
      familia,
      valor: Math.round(((previo?.valor ?? 0) + valor) * 100) / 100,
    });
  }

  return [...porClave.values()];
}

/**
 * Lo que tienes con ESE banco en esa familia · `null` si no consta ninguna.
 *
 * `null` y no cero: no tener ninguna posición apuntada no es lo mismo que
 * tenerla a cero, y de un cero saldría un «no cumples» sobre algo que ATLAS no
 * ha mirado.
 */
export const saldoCon = (
  saldos: SaldoEnProducto[],
  entidad: string | undefined,
  familia: 'fondo' | 'plan'
): number | null => {
  const buscada = clave(entidad ?? '');
  if (!buscada) return null;
  const hallado = saldos.find((s) => s.entidad === buscada && s.familia === familia);
  return hallado ? hallado.valor : null;
};
