// ============================================================================
// E3.1 · §7.3 · CATÁLOGO NACIONAL · el servicio
// ============================================================================
//
// La pieza que hace que «nadie tenga que añadir WIZINK a una lista». Tres
// capas, y se preguntan en este orden:
//
//   1 · APRENDIDO · lo que este cliente (o cualquiera, el día que esto viaje a
//       un servidor) ha confirmado sobre un NIF o un nombre. Store
//       `catalogoProveedores`, con recuento de confirmaciones.
//   2 · SEMILLA · `entidadesNacionales.ts` · lo que viaja en el código.
//   3 · PROVEEDORES DEL IRPF · el store `proveedores` del propio cliente, por
//       NIF. Trae el NIF de sus albañiles y fontaneros, que no están —ni van a
//       estar— en un catálogo nacional.
//
// Lo que devuelve NO es una decisión: es un `Parcial` que el motor aplica en
// su paso 2 (identificador) con las mismas reglas de signo que todo lo demás.
//
// Puro salvo `cargarCatalogo` y `aprenderEnCatalogo`, que son las dos únicas
// que tocan la base.
// ============================================================================

import type { FamiliaId, Ambito } from '../catalogo/catalogoUnico';
import { esFamiliaId } from '../catalogo/catalogoUnico';
import {
  CATALOGO_NACIONAL_SEMILLA,
  claveDeNombreCatalogo,
  MINIMO_ALIAS,
  type EntidadNacional,
} from './entidadesNacionales';

/** Una fila APRENDIDA · lo mismo que la semilla, más de dónde salió. */
export interface EntradaCatalogoProveedor extends EntidadNacional {
  id?: number;
  /** `nif:A95554630` o `nombre:WIZINK` · la clave con la que se aprendió. */
  clave: string;
  /** Cuántas veces se ha confirmado · una sola confirmación ya vale, pero manda la más confirmada. */
  confirmaciones: number;
  /** `semilla` nunca se persiste; `aprendido` es del cliente; `irpf` sale del store `proveedores`. */
  procedencia: 'aprendido' | 'irpf';
  createdAt: string;
  updatedAt: string;
}

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
      if (e.nif) {
        const nif = e.nif.toUpperCase().replace(/[\s.\-/]/g, '');
        if (!porNif.has(nif)) porNif.set(nif, e);
      }
      for (const a of e.alias) {
        const clave = claveDeNombreCatalogo(a);
        if (clave.length < MINIMO_ALIAS || vistos.has(clave)) continue;
        vistos.add(clave);
        alias.push([clave, e] as const);
      }
    }
  }
  // El alias más largo primero: «BANKINTERCONSUMERFINANCE» antes que «BANKINTER».
  alias.sort((a, b) => b[0].length - a[0].length);
  return { porNif, porAlias: alias };
}

/** El catálogo de fábrica · sin base, sin cliente. Para tests y para el arranque en frío. */
export function catalogoDeFabrica(): CatalogoNacional {
  return construirCatalogo(CATALOGO_NACIONAL_SEMILLA);
}

// ─── consultar ──────────────────────────────────────────────────────────────

/** La entidad de un NIF · `undefined` si el catálogo no lo conoce. */
export function porNif(cat: CatalogoNacional, nif: string | null | undefined): EntidadNacional | undefined {
  if (!nif) return undefined;
  return cat.porNif.get(nif.toUpperCase().replace(/[\s.\-/]/g, ''));
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

/** La clave con la que se guarda lo aprendido · el NIF si lo hay, si no el nombre. */
export function claveDeEntrada(e: { nif?: string; nombre: string }): string {
  return e.nif ? `nif:${e.nif.toUpperCase().replace(/[\s.\-/]/g, '')}` : `nombre:${claveDeNombreCatalogo(e.nombre)}`;
}

/** Lo mínimo de la base que hace falta · para poder probar sin IndexedDB. */
export interface BaseParaCatalogo {
  getAll(store: string): Promise<unknown[]>;
  put(store: string, value: unknown): Promise<unknown>;
}

/**
 * Las tres capas leídas de la base, ya construidas. Si algo falla se AVISA y se
 * sigue con lo que haya (§P1.d: un fallo no puede degradar en silencio).
 */
export async function cargarCatalogo(
  db: BaseParaCatalogo,
  avisar: (mensaje: string, err: unknown) => void = () => {},
): Promise<CatalogoNacional> {
  const leer = async <T>(store: string): Promise<T[]> => {
    try {
      return ((await db.getAll(store)) ?? []) as T[];
    } catch (err) {
      avisar(`no se pudo leer '${store}' para el catálogo nacional · se sigue sin esa capa`, err);
      return [];
    }
  };
  const [aprendido, proveedores] = await Promise.all([
    leer<EntradaCatalogoProveedor>('catalogoProveedores'),
    leer<ProveedorIrpf>('proveedores'),
  ]);
  const ordenado = aprendido
    .filter((e) => esFamiliaId(e.familia))
    .slice()
    .sort((a, b) => (b.confirmaciones ?? 0) - (a.confirmaciones ?? 0));
  return construirCatalogo(ordenado, CATALOGO_NACIONAL_SEMILLA, desdeProveedoresIrpf(proveedores));
}

/** Lo que el store `proveedores` guarda hoy · `tipos` es AEAT, `familia` es del catálogo único. */
export interface ProveedorIrpf {
  nif: string;
  nombre?: string;
  tipos?: string[];
  familia?: string;
  subtipo?: string;
  sinNombre?: boolean;
}

/**
 * Los proveedores del IRPF como entidades de catálogo · SOLO por NIF.
 *
 * ⚠️ Estos son los albañiles y administradores de ESTE cliente, no marcas
 * nacionales, y hoy llegan casi todos `sinNombre` (13 de 13 en el snapshot de
 * sep-2026): sin nombre no hay alias, así que aportan la clave fuerte (NIF) y
 * nada más. Su familia sale de `familia` si ya la tienen y, si no, del `tipos`
 * AEAT que sí traen.
 */
export function desdeProveedoresIrpf(proveedores: readonly ProveedorIrpf[]): EntidadNacional[] {
  const out: EntidadNacional[] = [];
  for (const p of proveedores) {
    if (!p.nif) continue;
    const familia = esFamiliaId(p.familia) ? p.familia : familiaDeTipoAeat(p.tipos);
    if (!familia) continue;
    out.push({
      nombre: p.nombre?.trim() || `Proveedor ${p.nif}`,
      nif: p.nif,
      alias: p.nombre?.trim() && !p.sinNombre ? [p.nombre.trim()] : [],
      familia,
      ...(p.subtipo ? { subtipo: p.subtipo } : {}),
      ambito: 'inmueble' as Ambito,
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

/**
 * Guarda lo que un cliente acaba de enseñar · WiZink lo enseña el primero y lo
 * heredan los demás. Si la entrada ya existía, SUMA una confirmación en vez de
 * duplicarla. Idempotente por `clave`.
 */
export async function aprenderEnCatalogo(
  db: BaseParaCatalogo,
  entrada: Omit<EntradaCatalogoProveedor, 'id' | 'clave' | 'confirmaciones' | 'procedencia' | 'createdAt' | 'updatedAt'>,
  avisar: (mensaje: string, err: unknown) => void = () => {},
): Promise<EntradaCatalogoProveedor | undefined> {
  const clave = claveDeEntrada(entrada);
  const ahora = new Date().toISOString();
  try {
    const todas = ((await db.getAll('catalogoProveedores')) ?? []) as EntradaCatalogoProveedor[];
    const ya = todas.find((e) => e.clave === clave);
    const fila: EntradaCatalogoProveedor = ya
      ? { ...ya, ...entrada, alias: unirAlias(ya.alias, entrada.alias), confirmaciones: (ya.confirmaciones ?? 0) + 1, updatedAt: ahora }
      : { ...entrada, clave, confirmaciones: 1, procedencia: 'aprendido', createdAt: ahora, updatedAt: ahora };
    await db.put('catalogoProveedores', fila);
    return fila;
  } catch (err) {
    avisar('no se pudo guardar lo aprendido en el catálogo nacional', err);
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
