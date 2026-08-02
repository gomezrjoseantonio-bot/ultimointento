// ============================================================================
// Punteo · agrupación y búsqueda de PRESENTACIÓN (Tesorería V6 · D2 bis)
// ============================================================================
//
// Vive aquí y NO en `services/punteo/punteoModel.ts` a propósito: el modelo
// canónico —los tres estados y su derivación— no se toca. Elegir si la lista se
// agrupa por fecha, por inmueble o por "qué es", y filtrar por un buscador, es
// decisión de pantalla, no de dominio.
//
// El orden DENTRO de cada grupo sigue siendo el canónico del modelo
// (`compararEnDia`: ingresos antes que gastos, luego por |importe|), para que
// cambiar de eje no cambie el orden interno.
// ============================================================================

import { compararEnDia, type ItemPunteo } from '../../../../services/punteo/punteoModel';
import { normalizeSearchText, matchesAmountQuery } from '../../../../utils/tesoreriaSearch';

/** Eje de agrupación de la lista. `fecha` es el de siempre. */
export type EjeAgrupacion = 'fecha' | 'inmueble' | 'que-es';

export const EJE_LABEL: Record<EjeAgrupacion, string> = {
  fecha: 'Fecha',
  inmueble: 'Inmueble',
  'que-es': 'Qué es',
};

export interface GrupoLista {
  /** Clave estable del grupo (fecha ISO, id de inmueble, etiqueta de origen). */
  clave: string;
  /** Título visible en la cabecera de la tarjeta. */
  titulo: string;
  items: ItemPunteo[];
  totalIngresos: number;
  totalGastos: number;
  /** Suma con signo · el subtotal que pide §4.4 en la cabecera. */
  subtotal: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Monta el grupo con los items **ya ordenados por quien llama**.
 *
 * No reordena: cada eje tiene su criterio. Agrupando por fecha, todo el grupo
 * es del mismo día y manda `compararEnDia`. Agrupando por inmueble o por qué
 * es, el grupo mezcla días y manda la fecha descendente (§4.4: "dentro de cada
 * grupo, orden por fecha descendente siempre"). Reordenar aquí con
 * `compararEnDia` —que no mira la fecha— se cargaba ese orden.
 */
function construirGrupo(clave: string, titulo: string, items: ItemPunteo[]): GrupoLista {
  const totalIngresos = round2(items.filter((i) => i.importe > 0).reduce((s, i) => s + i.importe, 0));
  const totalGastos = round2(items.filter((i) => i.importe < 0).reduce((s, i) => s + i.importe, 0));
  return {
    clave,
    titulo,
    items,
    totalIngresos,
    totalGastos,
    subtotal: round2(totalIngresos + totalGastos),
  };
}

/**
 * Agrupa por el eje pedido.
 *
 * Fecha · descendente, el día más reciente arriba (igual que `agruparPorDia`).
 * Inmueble y Qué es · alfabético, y **dentro de cada grupo por fecha
 * descendente**, como exige §4.4 ("dentro de cada grupo, orden por fecha
 * descendente siempre").
 */
export function agruparPorEje(items: ItemPunteo[], eje: EjeAgrupacion): GrupoLista[] {
  if (eje === 'fecha') {
    const porFecha = new Map<string, ItemPunteo[]>();
    for (const it of items) {
      const f = it.fecha.slice(0, 10);
      const arr = porFecha.get(f);
      if (arr) arr.push(it);
      else porFecha.set(f, [it]);
    }
    return Array.from(porFecha.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      // Todo el grupo es del mismo día → manda el orden canónico del día.
      .map(([fecha, arr]) => construirGrupo(fecha, fecha, arr.slice().sort(compararEnDia)));
  }

  const clave = (it: ItemPunteo): { clave: string; titulo: string } =>
    eje === 'inmueble'
      ? it.activo
        ? {
            clave: String(it.activo.inmuebleId),
            // Sin nombre real, la cabecera dice "Sin nombre" antes que inventar
            // un "Inmueble 3" que no significa nada para quien lee (§2.2).
            titulo: it.activo.alias ?? 'Sin nombre',
          }
        : { clave: '__personal__', titulo: 'Personal' }
      : { clave: it.origen, titulo: it.origen };

  const porClave = new Map<string, { titulo: string; items: ItemPunteo[] }>();
  for (const it of items) {
    const { clave: k, titulo } = clave(it);
    const g = porClave.get(k);
    if (g) g.items.push(it);
    else porClave.set(k, { titulo, items: [it] });
  }

  return Array.from(porClave.entries())
    .sort((a, b) => a[1].titulo.localeCompare(b[1].titulo, 'es'))
    .map(([k, { titulo, items: arr }]) =>
      construirGrupo(
        k,
        titulo,
        // El grupo mezcla días → fecha descendente primero (§4.4), y
        // `compararEnDia` solo desempata DENTRO del mismo día.
        arr.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || compararEnDia(a, b))
      )
    );
}

/**
 * Filtro del buscador de §4.4: concepto, inmueble, familia/concepto (`origen`)
 * e importe. Vacío = no filtra.
 */
export function filtrarPorBusqueda(items: ItemPunteo[], query: string): ItemPunteo[] {
  const q = normalizeSearchText(query);
  if (!q) return items;
  return items.filter((it) => {
    if (normalizeSearchText(it.concepto).includes(q)) return true;
    if (it.activo && normalizeSearchText(it.activo.alias).includes(q)) return true;
    if (normalizeSearchText(it.origen).includes(q)) return true;
    return matchesAmountQuery(it.importe, query);
  });
}
