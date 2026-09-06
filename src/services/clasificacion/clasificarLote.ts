// ============================================================================
// E2.4.2 · El motor sobre un LOTE · carga el contexto una vez y escribe en la línea
// ============================================================================
//
// `clasificarLinea` es puro; esto es lo que lee la base para dárselo:
// cuentas (IBAN propios), tarjetas (cuatro últimos), quién es el titular. Se
// lee una vez por lote, no por línea.
//
// Lo que se escribe: SOLO `lineasExtracto.clasificacion`. Ni movimientos ni
// decisiones: la clasificación viaja en la línea y la hereda el movimiento
// cuando nace (`movementNuevoDesdeLinea`). Re-analizar un lote (retomar) la
// recalcula con lo que el usuario haya enseñado entre medias.
// ============================================================================

import type { Account, LineaExtractoPersistida } from '../db';
import type { Tarjeta } from '../../types/tarjetas';
import type { SugerenciaPorLinea, LoQueSeReconocePorLinea } from '../lineaComoMovimiento';
import { entraAlMatcheo, movementDesdeLinea } from '../lineaComoMovimiento';
import { nombresDelTitular, type QuienEsElTitular } from '../deterministas/traspasosPropios';
import { clasificarLinea, type ClasificacionLinea, type ContextoClasificacion } from './clasificarLinea';

/** Lo que hace falta de la base · para poder probar sin IndexedDB. */
export interface BaseParaClasificar {
  getAll(store: string): Promise<unknown[]>;
  get(store: string, key: unknown): Promise<unknown>;
  put(store: string, valor: unknown): Promise<unknown>;
}

export interface ContextoDelLote {
  cuentas: ContextoClasificacion['cuentas'];
  tarjetas: ContextoClasificacion['tarjetas'];
  nombresTitular: string[];
}

/** Una lectura por store · si una falla, esa señal aporta cero y el resto sigue. */
export async function contextoDelLote(db: BaseParaClasificar): Promise<ContextoDelLote> {
  const leer = async <T>(store: string): Promise<T[]> => {
    try {
      return ((await db.getAll(store)) ?? []) as T[];
    } catch (err) {
      console.warn(`[clasificacion] no se pudo leer '${store}'`, err);
      return [];
    }
  };
  const [cuentas, tarjetas, personas] = await Promise.all([
    leer<Account>('accounts'),
    leer<Tarjeta>('tarjetas'),
    leer<QuienEsElTitular>('personalData'),
  ]);
  return { cuentas, tarjetas, nombresTitular: nombresDelTitular(personas, cuentas) };
}

/**
 * Los 4 ejes de cada línea que entra al matcheo · por `lineaId`. Puro dado el
 * contexto: lo que dice el sugeridor y el reconocedor entra como señal.
 */
export function clasificarLineas(
  lineas: readonly LineaExtractoPersistida[],
  senales: {
    suggestions?: ReadonlyMap<number, SugerenciaPorLinea[]>;
    reconocido?: LoQueSeReconocePorLinea;
  },
  ctx: ContextoDelLote,
): Map<number, ClasificacionLinea> {
  const out = new Map<number, ClasificacionLinea>();
  for (const linea of lineas) {
    if (!entraAlMatcheo(linea)) continue;
    const lineaId = linea.id as number;
    const m = movementDesdeLinea(linea);
    out.set(
      lineaId,
      clasificarLinea(m, {
        sugerencias: senales.suggestions?.get(lineaId),
        origen: senales.reconocido?.origenes.get(lineaId),
        atribucion: senales.reconocido?.atribuciones.get(lineaId),
        cuentas: ctx.cuentas,
        tarjetas: ctx.tarjetas,
        nombresTitular: ctx.nombresTitular,
      }),
    );
  }
  return out;
}

/**
 * Escribe la clasificación en cada línea · solo si cambió, para no reescribir
 * filas que ya la tenían igual (retomar un lote sin novedades).
 */
export async function guardarClasificacionEnLineas(
  db: BaseParaClasificar,
  clasificacion: ReadonlyMap<number, ClasificacionLinea>,
  ahora: string,
): Promise<number> {
  let escritas = 0;
  for (const [lineaId, c] of clasificacion) {
    const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
    if (!linea) continue;
    if (JSON.stringify(linea.clasificacion) === JSON.stringify(c)) continue;
    await db.put('lineasExtracto', { ...linea, clasificacion: c, updatedAt: ahora });
    escritas++;
  }
  return escritas;
}
