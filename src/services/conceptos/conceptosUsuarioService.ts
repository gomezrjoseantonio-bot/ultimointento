// ============================================================================
// PASO 5 · Conceptos propios del usuario · Ajustes → Conceptos
// ============================================================================
//
// El catálogo de fábrica no puede cubrirlo todo. Aquí se guarda lo que el
// usuario le añade encima: conceptos propios, nombres cambiados y los que no
// quiere que se le sigan ofreciendo.
//
// ── Qué se puede tocar y qué no ────────────────────────────────────────────
//
// Se puede: el NOMBRE (cómo lo llamas tú) y si aparece o no en los selectores.
// Se puede AÑADIR un concepto a una familia, diciendo en qué ámbitos vive.
//
// No se puede: la proyección. Ni la categoría ni la casilla AEAT se escriben
// desde una pantalla de ajustes — un concepto propio HEREDA la de su familia
// (`donanteDe`). Si se pudiera teclear la casilla, Ajustes pasaría a ser un
// sitio desde el que cambiar la declaración sin enterarse, y toda la cadena de
// los pasos 1-4 existe justamente para que eso no pase.
//
// Tampoco se puede BORRAR un concepto de fábrica, ni pisarlo con uno propio
// del mismo id: hay gastos apuntando a él. Ocultar es «no me lo ofrezcas más»;
// los gastos que ya lo usan lo conservan y se siguen clasificando igual.
//
// Se guarda en `keyval` bajo una única clave: son cuatro cosas contadas y un
// store propio pediría subir `DB_VERSION` para nada.
// ============================================================================

import { initDB } from '../db';
import {
  FAMILIAS,
  conceptoPorId,
  donanteDe,
  registrarConceptosDeUsuario,
} from './catalogoConceptos';
import type { AjusteConcepto, Ambito, ConceptoPropio, FamiliaId } from './catalogoConceptos';
import { CONCEPTOS_BASE } from './conceptosBase';

const CLAVE = 'conceptosUsuario';

export interface ConceptosUsuario {
  propios: ConceptoPropio[];
  /** `idConcepto` → retoque. Sólo lleva los que de verdad se han tocado. */
  ajustes: Record<string, AjusteConcepto>;
}

const VACIO: ConceptosUsuario = { propios: [], ajustes: {} };

/** Lo guardado, o el vacío · nunca lanza: sin esto no se puede pintar nada. */
export async function leerConceptosUsuario(): Promise<ConceptosUsuario> {
  try {
    const db = await initDB();
    const dato = (await db.get('keyval', CLAVE)) as ConceptosUsuario | undefined;
    if (!dato || !Array.isArray(dato.propios)) return VACIO;
    return { propios: dato.propios, ajustes: dato.ajustes ?? {} };
  } catch {
    return VACIO;
  }
}

async function guardar(datos: ConceptosUsuario): Promise<void> {
  const db = await initDB();
  // `keyval` lleva la clave FUERA del valor (sin keyPath) · el tercer argumento.
  await db.put('keyval', datos as never, CLAVE);
  registrarConceptosDeUsuario(datos.propios, datos.ajustes);
}

/** Aplica lo guardado al catálogo en memoria · lo llama el arranque. */
export async function cargarConceptosUsuario(): Promise<ConceptosUsuario> {
  const datos = await leerConceptosUsuario();
  registrarConceptosDeUsuario(datos.propios, datos.ajustes);
  return datos;
}

// ─── Alta ───────────────────────────────────────────────────────────────────

/**
 * Un id estable a partir del nombre.
 *
 * Con prefijo `usr_` para que se distinga de un vistazo en cualquier registro
 * de qué lado viene, y sin acentos ni espacios porque este id se PERSISTE en
 * cada gasto y se compara en crudo.
 */
export function idDeConceptoPropio(label: string): string {
  const base = (label ?? '')
    .normalize('NFD')
    // Escapado, no el carácter combinante literal · así sobrevive a un
    // copia-pega o a un editor que normalice el fichero.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `usr_${base || 'concepto'}`;
}

export type MotivoRechazo =
  | 'sin_nombre'
  | 'sin_ambito'
  | 'familia_desconocida'
  | 'familia_sin_ambito'
  | 'id_ocupado';

/**
 * ¿Se puede dar de alta? Devuelve el motivo si no · nunca «casi».
 *
 * `familia_sin_ambito` es el que evita el fallo de siempre: pedir un concepto
 * de «Servicios y explotación» en personal no tiene de quién heredar, así que
 * nacería sin saber clasificarse y desaparecería de su propia pantalla.
 */
export function puedeCrear(
  familia: string,
  label: string,
  ambitos: readonly Ambito[],
  existentes: readonly ConceptoPropio[] = [],
): { ok: true; id: string } | { ok: false; motivo: MotivoRechazo } {
  if (!label.trim()) return { ok: false, motivo: 'sin_nombre' };
  if (ambitos.length === 0) return { ok: false, motivo: 'sin_ambito' };
  if (!FAMILIAS.some((f) => f.id === familia)) return { ok: false, motivo: 'familia_desconocida' };
  for (const a of ambitos) {
    if (!donanteDe(familia as FamiliaId, a)) return { ok: false, motivo: 'familia_sin_ambito' };
  }
  const id = idDeConceptoPropio(label);
  const ocupado =
    CONCEPTOS_BASE.some((c) => c.id === id) || existentes.some((p) => p.id === id);
  if (ocupado) return { ok: false, motivo: 'id_ocupado' };
  return { ok: true, id };
}

export const EXPLICACION_RECHAZO: Record<MotivoRechazo, string> = {
  sin_nombre: 'Ponle un nombre',
  sin_ambito: 'Di dónde se usa · en tus gastos, en los de un inmueble, o en los dos',
  familia_desconocida: 'Esa familia no existe',
  familia_sin_ambito:
    'Esa familia no existe en ese ámbito · no habría de dónde sacar cómo se clasifica',
  id_ocupado: 'Ya hay un concepto que se llama así',
};

/** Da de alta un concepto propio. Lanza con el motivo si no se puede. */
export async function crearConceptoPropio(
  familia: string,
  label: string,
  ambitos: readonly Ambito[],
): Promise<ConceptosUsuario> {
  const datos = await leerConceptosUsuario();
  const v = puedeCrear(familia, label, ambitos, datos.propios);
  if (!v.ok) throw new Error(EXPLICACION_RECHAZO[v.motivo]);
  const nuevos: ConceptosUsuario = {
    ...datos,
    propios: [
      ...datos.propios,
      { id: v.id, familia: familia as FamiliaId, label: label.trim(), ambitos: [...ambitos] },
    ],
  };
  await guardar(nuevos);
  return nuevos;
}

/**
 * Retira un concepto PROPIO.
 *
 * Sólo los propios y sólo si no los usa ningún gasto · el catálogo de fábrica
 * no se toca. Un concepto en uso no se borra, se oculta: borrarlo dejaría a
 * esos gastos apuntando a un id que ya no existe, que es justo el estado del
 * que salió toda esta tarea.
 */
export async function borrarConceptoPropio(id: string): Promise<ConceptosUsuario> {
  const db = await initDB();
  const gastos = ((await db.getAll('compromisosRecurrentes')) ?? []) as Array<{
    concepto?: string;
  }>;
  const enUso = gastos.filter((g) => g.concepto === id).length;
  if (enUso > 0) {
    throw new Error(
      `Lo usan ${enUso} gasto${enUso === 1 ? '' : 's'} · cámbialos de concepto o escóndelo en vez de borrarlo`,
    );
  }
  const datos = await leerConceptosUsuario();
  const nuevos: ConceptosUsuario = { ...datos, propios: datos.propios.filter((p) => p.id !== id) };
  const resto = Object.fromEntries(Object.entries(nuevos.ajustes).filter(([k]) => k !== id));
  await guardar({ ...nuevos, ajustes: resto });
  return { ...nuevos, ajustes: resto };
}

// ─── Retoques ───────────────────────────────────────────────────────────────

/** Cambia el nombre · vacío o igual al de fábrica lo deja como estaba. */
export async function renombrar(id: string, label: string): Promise<ConceptosUsuario> {
  const datos = await leerConceptosUsuario();
  const propio = datos.propios.find((p) => p.id === id);
  if (propio) {
    // Un propio no necesita retoque: se le cambia el nombre y ya.
    const nuevos = {
      ...datos,
      propios: datos.propios.map((p) => (p.id === id ? { ...p, label: label.trim() || p.label } : p)),
    };
    await guardar(nuevos);
    return nuevos;
  }
  const deFabrica = CONCEPTOS_BASE.find((c) => c.id === id);
  if (!deFabrica) throw new Error('Ese concepto no existe');
  const limpio = label.trim();
  const ajuste = { ...(datos.ajustes[id] ?? {}) };
  if (!limpio || limpio === deFabrica.label) delete ajuste.label;
  else ajuste.label = limpio;
  const nuevos = { ...datos, ajustes: sinVacios({ ...datos.ajustes, [id]: ajuste }) };
  await guardar(nuevos);
  return nuevos;
}

/** Lo saca (o lo devuelve) a los selectores. */
export async function ocultar(id: string, oculto: boolean): Promise<ConceptosUsuario> {
  if (!conceptoPorId(id)) throw new Error('Ese concepto no existe');
  const datos = await leerConceptosUsuario();
  const ajuste = { ...(datos.ajustes[id] ?? {}) };
  if (oculto) ajuste.oculto = true;
  else delete ajuste.oculto;
  const nuevos = { ...datos, ajustes: sinVacios({ ...datos.ajustes, [id]: ajuste }) };
  await guardar(nuevos);
  return nuevos;
}

/** Un retoque sin nada dentro no es un retoque · se cae del mapa. */
function sinVacios(
  ajustes: Record<string, AjusteConcepto>,
): Record<string, AjusteConcepto> {
  return Object.fromEntries(
    Object.entries(ajustes).filter(([, a]) => Object.keys(a).length > 0),
  );
}

/**
 * Cambia familia, nombre y ámbitos de un concepto PROPIO.
 *
 * De los de fábrica sólo se puede cambiar el nombre (`renombrar`): su familia
 * decide su casilla AEAT y moverlos reescribiría en silencio cómo declara todo
 * el que los use. Los tuyos los pusiste tú, así que equivocarte al darlos de
 * alta no puede ser definitivo.
 *
 * El `id` NO cambia aunque cambie el nombre: es lo que llevan guardado los
 * gastos. Cambiarlo los dejaría apuntando a nada.
 */
export async function editarConceptoPropio(
  id: string,
  cambios: { familia: string; label: string; ambitos: readonly Ambito[] },
): Promise<ConceptosUsuario> {
  const datos = await leerConceptosUsuario();
  if (!datos.propios.some((p) => p.id === id)) {
    throw new Error('Ese concepto viene de fábrica · sólo se le puede cambiar el nombre');
  }
  if (!cambios.label.trim()) throw new Error(EXPLICACION_RECHAZO.sin_nombre);
  if (cambios.ambitos.length === 0) throw new Error(EXPLICACION_RECHAZO.sin_ambito);
  if (!FAMILIAS.some((f) => f.id === cambios.familia)) {
    throw new Error(EXPLICACION_RECHAZO.familia_desconocida);
  }
  for (const a of cambios.ambitos) {
    if (!donanteDe(cambios.familia as FamiliaId, a)) {
      throw new Error(EXPLICACION_RECHAZO.familia_sin_ambito);
    }
  }
  const nuevos: ConceptosUsuario = {
    ...datos,
    propios: datos.propios.map((p) =>
      p.id === id
        ? {
            ...p,
            familia: cambios.familia as FamiliaId,
            label: cambios.label.trim(),
            ambitos: [...cambios.ambitos],
          }
        : p,
    ),
  };
  await guardar(nuevos);
  return nuevos;
}
