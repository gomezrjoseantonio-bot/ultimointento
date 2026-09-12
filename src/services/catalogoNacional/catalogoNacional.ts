// ============================================================================
// E3.1 · §7.3 · CATÁLOGO NACIONAL · el servicio
// ============================================================================
//
// La pieza que hace que «nadie tenga que añadir WIZINK a una lista». DOS capas
// (eran tres hasta E3.1b, cuando el store aparte se retiró), en este orden:
//
//   1 · LO QUE SABE EL CLIENTE · el store `proveedores`, indexado por NIF. UN
//       SOLO SITIO (E3.1b · decisión de Jose): ahí están tanto el NIF de su
//       fontanero como lo que ha confirmado sobre Iberdrola, con su recuento de
//       confirmaciones. Lo marcado `origen: 'nacional'` va anclado a un CIF de
//       EMPRESA y es lo único compartible el día que esto viaje a un servidor;
//       lo demás es un DNI y no sale de su navegador.
//   2 · EL FICHERO NACIONAL · las 308 entidades reales + el complemento, que
//       viajan en el CÓDIGO (`entidadesNacionales.semillaDelCatalogo`) para que
//       un cliente nuevo las tenga el día cero sin importar nada.
//
// Hubo un store aparte (`catalogoProveedores`) y se retiró en E3.1b: dejaba
// `familia`/`subtipo` en dos sitios para la misma pregunta («¿quién cobra y qué
// es?») sin aportar nada que `proveedores` no pudiera dar. Un proveedor es un
// proveedor.
//
// Lo que devuelve NO es una decisión: es un `Parcial` que el motor aplica en
// su paso 2 (identificador) con las mismas reglas de signo que todo lo demás.
//
// Puro salvo `cargarCatalogo` y `aprenderEnCatalogo`, que son las dos únicas
// que tocan la base.
// ============================================================================

import type { FamiliaId, Ambito } from '../catalogo/catalogoUnico';
import { esFamiliaId } from '../catalogo/catalogoUnico';
import { esCif } from '../identificadoresDelConcepto';
import { claveDeProveedor } from '../db/types-proveedores';
import {
  semillaDelCatalogo,
  claveDeNombreCatalogo,
  MINIMO_ALIAS,
  type EntidadNacional,
} from './entidadesNacionales';

/** Lo que el motor lleva en el bolsillo · se carga una vez por lote. */
export interface CatalogoNacional {
  porNif: ReadonlyMap<string, EntidadNacional>;
  /** Alias normalizados, de más largo a más corto · el más específico gana. */
  porAlias: ReadonlyArray<readonly [string, EntidadNacional]>;
}

/** El catálogo VACÍO · para los sitios que aún no lo cargan. */
export const CATALOGO_VACIO: CatalogoNacional = { porNif: new Map(), porAlias: [] };

// ─── construir ──────────────────────────────────────────────────────────────

/**
 * El catálogo en memoria a partir de las tres capas. El orden de `capas` es el
 * de fuerza: lo primero que casa manda, así que lo APRENDIDO va delante de la
 * semilla (si un cliente corrige a Iberdrola, su corrección gana).
 */
export function construirCatalogo(...capas: ReadonlyArray<readonly EntidadNacional[]>): CatalogoNacional {
  const porNif = new Map<string, EntidadNacional>();
  const alias: Array<readonly [string, EntidadNacional]> = [];
  const vistos = new Set<string>();
  for (const capa of capas) {
    for (const e of capa) {
      const nif = e.nif ? claveDeProveedor(e.nif) : undefined;
      if (nif && !porNif.has(nif)) porNif.set(nif, e);
      // Si una capa de MÁS peso ya conoce este NIF, sus alias apuntan a ELLA.
      // Sin esto, «la corrección del cliente manda» solo era cierta buscando
      // por NIF: el alias del fichero nacional seguía devolviendo la entidad
      // del fichero, así que la misma empresa se clasificaba de dos maneras
      // según el banco escribiera el CIF o el nombre.
      const destino = (nif ? porNif.get(nif) : undefined) ?? e;
      for (const a of e.alias) {
        const clave = claveDeNombreCatalogo(a);
        if (clave.length < MINIMO_ALIAS || vistos.has(clave)) continue;
        vistos.add(clave);
        alias.push([clave, destino] as const);
      }
    }
  }
  // El alias más largo primero: «BANKINTERCONSUMERFINANCE» antes que «BANKINTER».
  alias.sort((a, b) => b[0].length - a[0].length);
  return { porNif, porAlias: alias };
}

/** El catálogo de fábrica · sin base, sin cliente. Para tests y para el arranque en frío. */
export function catalogoDeFabrica(): CatalogoNacional {
  return construirCatalogo(semillaDelCatalogo());
}

// ─── consultar ──────────────────────────────────────────────────────────────

/** La entidad de un NIF · `undefined` si el catálogo no lo conoce. */
export function porNif(cat: CatalogoNacional, nif: string | null | undefined): EntidadNacional | undefined {
  if (!nif) return undefined;
  return cat.porNif.get(claveDeProveedor(nif));
}

/**
 * La entidad cuyo alias está CONTENIDO en el nombre que escribió el banco.
 * «FCC AQUALIA OVIEDO» → Aqualia por «AQUALI»; «BIP   DRIVE, S.A.» → Bip&Drive
 * por «BIPDRIVE». Gana el alias más largo que case.
 */
export function porNombre(cat: CatalogoNacional, nombre: string | null | undefined): EntidadNacional | undefined {
  if (!nombre) return undefined;
  const clave = claveDeNombreCatalogo(nombre);
  if (clave.length < MINIMO_ALIAS) return undefined;
  for (const [alias, entidad] of cat.porAlias) {
    if (clave.includes(alias)) return entidad;
  }
  return undefined;
}

// ─── aprender ───────────────────────────────────────────────────────────────


// ─── leer de la base ────────────────────────────────────────────────────────

/** Lo que el store `proveedores` guarda · `tipos` es AEAT, `familia` es del catálogo único. */
export interface ProveedorIrpf {
  nif: string;
  nombre?: string;
  tipos?: string[];
  familia?: string;
  subtipo?: string;
  ambito?: Ambito;
  alias?: string[];
  confirmaciones?: number;
  origen?: 'cliente' | 'nacional';
  sinNombre?: boolean;
}

/**
 * El catálogo con el que clasifica el motor: lo que sabe el cliente (store
 * `proveedores`) DELANTE del fichero nacional que viaja en el código.
 *
 * Delante a propósito: si el cliente corrige a Iberdrola, su corrección manda.
 * Y dentro de lo suyo, manda lo más confirmado. Si la lectura falla se AVISA y
 * se sigue con el fichero nacional (§P1.d: un fallo no degrada en silencio).
 */
export async function cargarCatalogo(
  db: { getAll(store: string): Promise<unknown[]> },
  avisar: (mensaje: string, err?: unknown) => void = () => {},
): Promise<CatalogoNacional> {
  let proveedores: ProveedorIrpf[] = [];
  try {
    proveedores = ((await db.getAll('proveedores')) ?? []) as ProveedorIrpf[];
  } catch (err) {
    avisar("no se pudo leer 'proveedores' · se clasifica solo con el catálogo nacional", err);
  }
  const delCliente = desdeProveedoresIrpf(proveedores).sort(
    (a, b) => (b.confirmaciones ?? 0) - (a.confirmaciones ?? 0),
  );
  return construirCatalogo(delCliente, semillaDelCatalogo());
}

/**
 * El store `proveedores` como entidades de catálogo · la clave es el NIF.
 *
 * Aquí caben las dos cosas, porque ahora es un solo sitio: los albañiles y
 * administradores de ESTE cliente (que llegan casi todos `sinNombre` — 13 de 13
 * en el snapshot de sep-2026, así que aportan la clave fuerte y nada más) y lo
 * que haya confirmado sobre una empresa nacional. Su familia sale de `familia`
 * si ya la tiene y, si no, del `tipos` AEAT que sí traen.
 */
export function desdeProveedoresIrpf(proveedores: readonly ProveedorIrpf[]): EntidadNacional[] {
  const out: EntidadNacional[] = [];
  for (const p of proveedores) {
    if (!p.nif) continue;
    const familia = esFamiliaId(p.familia) ? p.familia : familiaDeTipoAeat(p.tipos);
    if (!familia) continue;
    const nombre = p.nombre?.trim();
    out.push({
      nombre: nombre || `Proveedor ${p.nif}`,
      nif: p.nif,
      alias: unirAlias(p.alias ?? [], nombre && !p.sinNombre ? [nombre] : []),
      familia,
      ...(p.subtipo ? { subtipo: p.subtipo } : {}),
      // Sin ámbito dicho, lo del cliente cae en inmueble: es de donde salen sus
      // proveedores del IRPF. Lo nacional trae el suyo.
      ambito: (p.ambito ?? 'inmueble') as Ambito,
      ...(p.confirmaciones != null ? { confirmaciones: p.confirmaciones } : {}),
    });
  }
  return out;
}

/** El `tipos` AEAT del store `proveedores` traducido al catálogo único. */
function familiaDeTipoAeat(tipos: readonly string[] | undefined): FamiliaId | undefined {
  const t = new Set((tipos ?? []).map((x) => x.toLowerCase()));
  if (t.has('mejora')) return 'reforma_mejora';
  if (t.has('reparacion')) return 'reparacion_mantenimiento';
  if (t.has('gestion')) return 'gestion';
  if (t.has('servicios')) return 'suministro';
  return undefined;
}

// ─── aprender ───────────────────────────────────────────────────────────────

/** Lo mínimo de la base que hace falta · para poder probar sin IndexedDB. */
export interface BaseParaCatalogo {
  get(store: string, key: unknown): Promise<unknown>;
  put(store: string, value: unknown): Promise<unknown>;
}

/**
 * Guarda lo que un cliente acaba de enseñar sobre quien cobra · va al store
 * `proveedores`, que ya está indexado por NIF y es el único sitio donde vive
 * «quién cobra y qué es».
 *
 * Tres cosas que NO hace, y las tres importan:
 *   · no pisa el `tipos` AEAT que ese proveedor ya tuviera (eso es fiscal y lo
 *     escribe la declaración, no el motor);
 *   · no pisa una `familia` que el usuario ya hubiera puesto a mano;
 *   · no duplica: si el NIF ya está, SUMA una confirmación.
 *
 * `origen: 'nacional'` se COMPRUEBA aquí, no en quien llama: si el NIF no pasa
 * el dígito de control de un CIF de EMPRESA, la fila se degrada a `'cliente'`
 * y se avisa. Dejar la invariante en manos del llamador significa que el
 * próximo llamador puede romperla sin enterarse, y lo que está en juego es que
 * el DNI de una persona acabe marcado como compartible.
 *
 * Nunca lanza: aprender es oportunista y una confirmación no se rompe por esto.
 */
export async function aprenderEnCatalogo(
  db: BaseParaCatalogo,
  entrada: {
    nif: string;
    nombre?: string;
    alias?: string[];
    familia: FamiliaId;
    subtipo?: string;
    ambito?: Ambito;
    origen?: 'cliente' | 'nacional';
  },
  avisar: (mensaje: string, err: unknown) => void = () => {},
): Promise<ProveedorIrpf | undefined> {
  const nif = claveDeProveedor(entrada.nif);
  if (!nif) return undefined;
  // La frontera de privacidad se defiende AQUÍ · un DNI nunca es compartible.
  let origenPedido = entrada.origen ?? 'cliente';
  if (origenPedido === 'nacional' && !esCif(nif)) {
    avisar(`«${nif}» no es un CIF de empresa · se guarda como 'cliente', no compartible`, undefined);
    origenPedido = 'cliente';
  }
  const ahora = new Date().toISOString();
  try {
    const ya = (await db.get('proveedores', nif)) as ProveedorIrpf | undefined;
    const fila: ProveedorIrpf & { tipos: string[]; createdAt: string; updatedAt: string } = {
      ...(ya ?? { tipos: [], createdAt: ahora }),
      nif,
      tipos: ya?.tipos ?? [],
      // El nombre solo se rellena si no había uno bueno.
      ...(entrada.nombre && (!ya?.nombre || ya.sinNombre) ? { nombre: entrada.nombre, sinNombre: false } : {}),
      // La familia que el usuario ya hubiera puesto manda sobre la aprendida.
      familia: ya?.familia ?? entrada.familia,
      ...(ya?.subtipo ?? entrada.subtipo ? { subtipo: ya?.subtipo ?? entrada.subtipo } : {}),
      ...(ya?.ambito ?? entrada.ambito ? { ambito: (ya?.ambito ?? entrada.ambito) as Ambito } : {}),
      alias: unirAlias(ya?.alias ?? [], entrada.alias ?? []),
      confirmaciones: (ya?.confirmaciones ?? 0) + 1,
      origen: ya?.origen === 'nacional' ? 'nacional' : origenPedido,
      createdAt: (ya as { createdAt?: string } | undefined)?.createdAt ?? ahora,
      updatedAt: ahora,
    };
    await db.put('proveedores', fila);
    return fila;
  } catch (err) {
    avisar('no se pudo guardar lo aprendido sobre este proveedor', err);
    return undefined;
  }
}

function unirAlias(a: readonly string[], b: readonly string[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const x of [...a, ...b]) {
    const k = claveDeNombreCatalogo(x);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    out.push(x);
  }
  return out;
}
