// ============================================================================
// E3.1c · El catálogo VIVE EN EL STORE · un catálogo nacional + lo que crees tú
// ============================================================================
//
// Hasta aquí las 308 entidades solo existían dentro del código, y eso tenía un
// problema que no se arregla explicándolo: si quieres añadir un proveedor nuevo
// o corregir uno, no hay dónde. Un fichero en el código no se edita desde la
// app.
//
// Así que el fichero pasa a ser lo que debió ser desde el principio: la SEMILLA
// con la que arranca la tabla. Al abrir la base se vuelca a `proveedores`, y a
// partir de ahí manda el store. Añadir un proveedor es escribir una fila.
//
// Idempotente y respetuoso, en este orden:
//   · si el NIF no está, se crea con `origen: 'nacional'`;
//   · si está y lo tocaste tú (`origen: 'cliente'`), NO se toca. Tu corrección
//     manda sobre la semilla, siempre;
//   · si está como `'nacional'` y sigue igual, se refresca (así publicar una
//     versión nueva del catálogo llega a quien ya lo tenía);
//   · nunca se pisan los `tipos` AEAT ni el `createdAt`.
//
// Las entidades sin CIF no se siembran: la clave del store es el NIF y sin él
// no hay fila. Siguen viviendo en la semilla del código para el cruce por
// nombre, que es donde sirven.
// ============================================================================

import type { Proveedor } from '../db/types-proveedores';
import { claveDeProveedor } from '../db/types-proveedores';
import { semillaDelCatalogo } from './entidadesNacionales';

/** Lo mínimo de la base · para poder probar sin IndexedDB. */
export interface BaseParaSembrar {
  getAll(store: string): Promise<unknown[]>;
  put(store: string, valor: unknown): Promise<unknown>;
}

export interface ResultadoSiembra {
  creados: number;
  refrescados: number;
  respetados: number;
}

/**
 * Vuelca la semilla del catálogo nacional al store `proveedores`.
 *
 * Devuelve el recuento para poder decir en cristiano qué pasó. No lanza nunca:
 * si una fila falla, se avisa y se sigue con las demás — media siembra es mejor
 * que ninguna, y la próxima apertura la completa.
 */
export async function sembrarCatalogoNacional(
  db: BaseParaSembrar,
  avisar: (mensaje: string, err?: unknown) => void = () => {},
): Promise<ResultadoSiembra> {
  const out: ResultadoSiembra = { creados: 0, refrescados: 0, respetados: 0 };
  let existentes: Proveedor[] = [];
  try {
    existentes = ((await db.getAll('proveedores')) ?? []) as Proveedor[];
  } catch (err) {
    avisar('no se pudo leer `proveedores` · el catálogo no se siembra esta vez', err);
    return out;
  }
  const porNif = new Map(existentes.map((p) => [claveDeProveedor(p.nif ?? ''), p]));
  const ahora = new Date().toISOString();

  for (const e of semillaDelCatalogo()) {
    if (!e.nif) continue;
    const nif = claveDeProveedor(e.nif);
    const ya = porNif.get(nif);
    // Lo que tocaste tú no se toca. Es la regla que hace que sembrar sea seguro
    // en cada apertura: la semilla nunca pisa una corrección.
    if (ya && ya.origen !== 'nacional') {
      out.respetados++;
      continue;
    }
    const fila: Proveedor = {
      ...(ya ?? {}),
      nif,
      nombre: ya?.nombre ?? e.nombre,
      tipos: ya?.tipos ?? [],
      familia: e.familia,
      ...(e.subtipo ? { subtipo: e.subtipo } : {}),
      ...(e.ambito ? { ambito: e.ambito } : {}),
      alias: Array.from(new Set([...(ya?.alias ?? []), ...e.alias])),
      confirmaciones: ya?.confirmaciones ?? 0,
      origen: 'nacional',
      sinNombre: false,
      createdAt: ya?.createdAt ?? ahora,
      updatedAt: ahora,
    };
    try {
      await db.put('proveedores', fila);
      if (ya) out.refrescados++;
      else out.creados++;
    } catch (err) {
      avisar(`no se pudo sembrar el proveedor ${nif}`, err);
    }
  }
  return out;
}

/**
 * La siembra tal como la llama el arranque de la base · con su aviso en
 * consola y sin poder tumbar la apertura pase lo que pase.
 */
export async function sembrarCatalogoEnApertura(db: BaseParaSembrar): Promise<void> {
  try {
    const r = await sembrarCatalogoNacional(db, (mensaje, err) =>
      console.warn(`[catálogo nacional] ${mensaje}`, err),
    );
    if (r.creados > 0 || r.refrescados > 0) {
      console.log(
        `[catálogo nacional] ${r.creados} nuevos · ${r.refrescados} actualizados · ${r.respetados} tuyos respetados`,
      );
    }
  } catch (err) {
    console.warn('[catálogo nacional] la siembra falló · se sigue sin ella', err);
  }
}
