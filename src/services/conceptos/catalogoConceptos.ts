// ============================================================================
// PASO 2 · Catálogo unificado de conceptos · un solo árbol
// ============================================================================
//
// Hasta aquí había DOS catálogos de presentación —uno personal y otro de
// inmueble— con familias distintas (6 y 9, de las que sólo `suministros` y
// `otros` coincidían) y con el mismo gasto clasificado de dos maneras según la
// pestaña en la que se diera de alta. De ahí salía el fallo que abrió esta
// tarea: un seguro de vida guardado con la familia `seguros`, que no existe en
// el catálogo personal, se volvía invisible en su propia pantalla.
//
// Aquí hay UN árbol: 13 familias, 60 conceptos con id único. Lo que cambiaba
// entre catálogos —la categoría— deja de estar en el concepto y pasa a ser una
// PROYECCIÓN por ámbito: el mismo concepto `luz` proyecta a
// `vivienda.suministros` en personal y a `inmueble.suministros` + la
// `categoryKey` `suministro_inmueble:luz` en inmueble.
//
// ── Lo que este fichero NO hace ─────────────────────────────────────────────
//
// No reasigna NADA. Cada proyección está copiada de lo que la app hace hoy:
// las personales de `TIPOS_GASTO_PERSONAL`, y las de inmueble de
// `TIPOS_GASTO_INMUEBLE_V2` (categoría) más `TRADUCCION_INMUEBLE`
// (`categoryKey`, que es quien decide la casilla AEAT vía `categoryCatalog`).
// El test de equivalencia lo comprueba par a par contra esas mismas fuentes, así
// que si alguien retoca una proyección a mano, la construcción se cae.
//
// La casilla AEAT sigue viviendo en `categoryCatalog.ts` y NO se escribe aquí.
// Ese fue el motivo de rehacer el diseño a mitad: la primera versión asignaba
// casillas a mano y en dos casos se desviaba de lo que la app ya hacía. Un
// catálogo que reordena conceptos no tiene por qué mover la declaración.
//
// ── Las cinco casillas que sí son nuevas ────────────────────────────────────
//
// Unificar abre combinaciones que antes no se podían elegir: `tasa_basuras`,
// `derrama`, `otros_comunidad` y `alarma` en personal, y `seguro_vida` en
// inmueble. Ninguna tiene proyección heredable, así que cada una copia la de su
// hermano de familia en ese ámbito y lo dice en un comentario. Son las únicas
// cinco líneas de este fichero que no salen de una fuente viva.
// ============================================================================

import type {
  BolsaPresupuesto,
  CategoriaGastoCompromiso,
  TipoCompromiso,
} from '../../types/compromisosRecurrentes';
import { CONCEPTOS_BASE } from './conceptosBase';

/**
 * Los Tipos (carpetas) del árbol unificado · P8a (Jose, 20 ago 2026).
 *
 * Reorganizado para coincidir con el catálogo acordado (§9 quater): «Día a día»
 * se rompe en Tipos propios (Supermercado, Transporte, Farmacia, Ocio, Viaje,
 * Restaurante, Ropa, Cuidado personal), «Cuotas» se funde en Suscripciones,
 * «Servicios» se reparte en Limpieza + Gestión, y salen Tipos nuevos
 * (Mantenimiento, Alarma, Limpieza). Hipoteca/préstamo NO está: nace en
 * Financiación y su cuota salta sola a tesorería, no se crea a mano aquí.
 */
export type FamiliaId =
  | 'comunidad'
  | 'tributos'
  | 'seguros'
  | 'reparacion'
  | 'mantenimiento'
  | 'suministros'
  | 'alarma'
  | 'gestion'
  | 'limpieza'
  | 'supermercado'
  | 'transporte'
  | 'farmacia'
  | 'suscripciones'
  | 'ocio'
  | 'viaje'
  | 'restaurante'
  | 'ropa'
  | 'cuidado_personal'
  | 'alquiler'
  | 'mobiliario'
  | 'otros';

export type Ambito = 'personal' | 'inmueble';

export interface Familia {
  id: FamiliaId;
  label: string;
  descripcion: string;
}

/**
 * Las familias, en orden de presentación.
 *
 * En qué ámbitos aparece cada una NO se declara: se deduce de si alguno de sus
 * conceptos proyecta a ese ámbito (`familiasDeAmbito`). Declararlo aparte sería
 * un segundo sitio donde equivocarse.
 */
export const FAMILIAS: readonly Familia[] = [
  { id: 'comunidad', label: 'Comunidad', descripcion: 'Cuota ordinaria · derramas' },
  { id: 'tributos', label: 'Impuestos', descripcion: 'IBI · basuras · licencia turística · circulación' },
  { id: 'seguros', label: 'Seguro', descripcion: 'Hogar · vida · impagos · decesos · vehículo · médico' },
  { id: 'reparacion', label: 'Reparación', descripcion: 'Vehículo · caldera · electrodomésticos' },
  { id: 'mantenimiento', label: 'Mantenimiento', descripcion: 'Caldera · vehículo · ITV' },
  { id: 'suministros', label: 'Suministro', descripcion: 'Luz · agua · gas · internet · móvil' },
  { id: 'alarma', label: 'Alarma', descripcion: 'Alarma y seguridad' },
  { id: 'gestion', label: 'Gestión', descripcion: 'Agencia · gestoría · asesoría · plataformas · consumibles' },
  { id: 'limpieza', label: 'Limpieza', descripcion: 'Zonas comunes · integral · lavandería' },
  { id: 'supermercado', label: 'Supermercado', descripcion: 'Alimentación · compra' },
  { id: 'transporte', label: 'Transporte', descripcion: 'Combustible' },
  { id: 'farmacia', label: 'Farmacia', descripcion: 'Farmacia · salud · médicos' },
  { id: 'suscripciones', label: 'Suscripciones', descripcion: 'Gimnasio · educación · ONG · streaming · cloud' },
  { id: 'ocio', label: 'Ocio', descripcion: 'Cine · planes · ocio' },
  { id: 'viaje', label: 'Viaje', descripcion: 'Viajes · escapadas' },
  { id: 'restaurante', label: 'Restaurante', descripcion: 'Restaurantes · cafeterías' },
  { id: 'ropa', label: 'Ropa y calzado', descripcion: 'Ropa · calzado' },
  { id: 'cuidado_personal', label: 'Cuidado personal', descripcion: 'Peluquería · cuidado personal' },
  { id: 'alquiler', label: 'Alquiler', descripcion: 'Vivienda · vehículo (renting)' },
  { id: 'mobiliario', label: 'Mobiliario y enseres', descripcion: 'Ropa de cama · menaje · muebles' },
  { id: 'otros', label: 'Otros', descripcion: 'Gastos personalizados' },
];

/** Cómo se clasifica el concepto cuando el gasto es del titular. */
export interface ProyeccionPersonal {
  categoria: CategoriaGastoCompromiso;
  /** Bolsa del 50/30/20. */
  bolsa: BolsaPresupuesto;
}

/** Cómo se clasifica el concepto cuando el gasto es de un inmueble. */
export interface ProyeccionInmueble {
  categoria: CategoriaGastoCompromiso;
  /**
   * `key` de `categoryCatalog.ts` · es QUIEN DECIDE LA CASILLA AEAT.
   *
   * `null` cuando el tratamiento no depende del concepto sino del hecho
   * concreto, y por tanto hay que preguntárselo al usuario al confirmar. Hoy
   * sólo la derrama: conservación (deducible) o mejora (se amortiza).
   */
  categoryKey: string | null;
  /** Variante dentro de la key · hoy sólo luz/gas/agua/internet/telefonía. */
  subtypeKey?: string;
  estado: 'ok' | 'pregunta';
}

export interface Concepto {
  /** Único en el sistema · sustituye al par (tipoFamilia, subtipo). */
  id: string;
  familia: FamiliaId;
  label: string;
  tipoCompromiso: TipoCompromiso;
  /** Presente ⇔ el concepto se puede elegir en gasto personal. */
  personal?: ProyeccionPersonal;
  /** Presente ⇔ el concepto se puede elegir en gasto de inmueble. */
  inmueble?: ProyeccionInmueble;
  /** El que rellena el usuario a mano · lleva descripción libre. */
  esPersonalizado?: boolean;
  /**
   * Fuera de los selectores · lo pone el usuario desde Ajustes.
   *
   * NO se borra ni se retira del catálogo: un gasto que ya lo usaba tiene que
   * seguir sabiendo clasificarse. Ocultar es «no me lo ofrezcas más», no «esto
   * no existe».
   */
  oculto?: boolean;
}

// El catálogo de fábrica · los 60 conceptos, en `conceptosBase.ts`.
export { CONCEPTOS_BASE as CONCEPTOS };

// ─── Lo que el usuario añade o retoca ───────────────────────────────────────
//
// El catálogo de fábrica no puede cubrirlo todo, así que Ajustes → Conceptos
// deja renombrar los que hay, esconder los que no se usan y añadir propios. Eso
// vive en la base (`conceptosUsuarioService`), pero se aplica AQUÍ, en memoria,
// por una razón concreta: todo lo que consulta el catálogo —el selector de la
// ficha, la agrupación de la lista, la migración— es síncrono. Volverlo async
// para leer un ajuste obligaría a tocar cada pantalla.
//
// Lo que un concepto propio NO puede traer es su propia casilla AEAT: hereda la
// proyección de su familia. Dejar escribir una casilla a mano sería dar a la
// pantalla de ajustes la capacidad de cambiar la declaración.

/** Retoque sobre un concepto de fábrica · lo poco que se puede cambiar. */
export interface AjusteConcepto {
  /** Cómo prefiere llamarlo el usuario. Vacío = el nombre de fábrica. */
  label?: string;
  /** Fuera de los selectores. NO borra: los gastos que ya lo usan lo conservan. */
  oculto?: boolean;
}

/** Un concepto que ha añadido el usuario · su proyección la hereda. */
export interface ConceptoPropio {
  id: string;
  familia: FamiliaId;
  label: string;
  ambitos: readonly Ambito[];
}

let EFECTIVOS: readonly Concepto[] = CONCEPTOS_BASE;
let PORID = new Map(CONCEPTOS_BASE.map((c) => [c.id, c]));
const FAMPORID = new Map(FAMILIAS.map((f) => [f.id, f]));

/**
 * De quién hereda la proyección un concepto propio de esta familia.
 *
 * El «otros» de la familia, porque es literalmente «cualquier otra cosa de
 * aquí» y ya tiene decidido su tratamiento. Si la familia no tiene uno
 * —`alquiler` no lo tiene— se usa su primer concepto en ese ámbito. Elegir el
 * donante por regla y no a mano es lo que impide que dar de alta un concepto
 * acabe inventando una casilla.
 */
export function donanteDe(familia: FamiliaId, ambito: Ambito): Concepto | undefined {
  const dela = CONCEPTOS_BASE.filter(
    (c) => c.familia === familia && (ambito === 'personal' ? c.personal : c.inmueble),
  );
  return dela.find((c) => c.id.startsWith('otros_') || c.esPersonalizado) ?? dela[0];
}

/** Monta el concepto propio con la proyección heredada de su familia. */
function materializar(p: ConceptoPropio): Concepto | null {
  const personal = p.ambitos.includes('personal')
    ? donanteDe(p.familia, 'personal')?.personal
    : undefined;
  const inmueble = p.ambitos.includes('inmueble')
    ? donanteDe(p.familia, 'inmueble')?.inmueble
    : undefined;
  // Sin proyección en ningún ámbito no se puede clasificar · no se registra.
  if (!personal && !inmueble) return null;
  const donante = donanteDe(p.familia, personal ? 'personal' : 'inmueble');
  return {
    id: p.id,
    familia: p.familia,
    label: p.label,
    tipoCompromiso: donante?.tipoCompromiso ?? 'otros',
    ...(personal ? { personal } : {}),
    ...(inmueble ? { inmueble } : {}),
  };
}

/**
 * Aplica los conceptos propios y los retoques · lo llama el arranque y Ajustes.
 *
 * Un propio con el id de uno de fábrica se ignora: pisarlo cambiaría en
 * silencio la clasificación de los gastos que ya lo usan.
 */
export function registrarConceptosDeUsuario(
  propios: readonly ConceptoPropio[] = [],
  ajustes: Readonly<Record<string, AjusteConcepto>> = {},
): void {
  const deFabrica = new Set(CONCEPTOS_BASE.map((c) => c.id));
  const añadidos = propios
    .filter((p) => !deFabrica.has(p.id))
    .map(materializar)
    .filter((c): c is Concepto => c !== null);

  const conRetoque = [...CONCEPTOS_BASE, ...añadidos].map((c) => {
    const a = ajustes[c.id];
    if (!a) return c;
    return { ...c, ...(a.label ? { label: a.label } : {}), ...(a.oculto ? { oculto: true } : {}) };
  });

  // Los propios se ordenan con los suyos · un selector que agrupa por familia
  // no puede tenerlos todos apelotonados al final.
  EFECTIVOS = FAMILIAS.flatMap((f) => conRetoque.filter((c) => c.familia === f.id));
  PORID = new Map(EFECTIVOS.map((c) => [c.id, c]));
}

/** El catálogo tal y como está hoy · de fábrica más lo del usuario. */
export function conceptosEfectivos(): readonly Concepto[] {
  return EFECTIVOS;
}

// ─── Consulta ───────────────────────────────────────────────────────────────

/** El concepto, o `undefined` si ese id no existe. */
export function conceptoPorId(id: string | undefined | null): Concepto | undefined {
  return id ? PORID.get(id) : undefined;
}

export function familiaPorId(id: string | undefined | null): Familia | undefined {
  return id ? FAMPORID.get(id as FamiliaId) : undefined;
}

/** Dónde se puede elegir · se deduce de qué proyecciones tiene. */
export function ambitosDe(c: Concepto): Ambito[] {
  const out: Ambito[] = [];
  if (c.personal) out.push('personal');
  if (c.inmueble) out.push('inmueble');
  return out;
}

/**
 * Los conceptos elegibles en un ámbito, en orden de catálogo.
 *
 * Los ocultos no salen · pero `conceptoPorId` SÍ los devuelve, para que un
 * gasto que ya usaba uno se siga viendo y clasificando como siempre.
 */
export function conceptosDeAmbito(ambito: Ambito): Concepto[] {
  return EFECTIVOS.filter(
    (c) => !c.oculto && (ambito === 'personal' ? c.personal : c.inmueble) !== undefined,
  );
}

/** Las familias con al menos un concepto en ese ámbito, en orden. */
export function familiasDeAmbito(ambito: Ambito): Familia[] {
  const vivas = new Set(conceptosDeAmbito(ambito).map((c) => c.familia));
  return FAMILIAS.filter((f) => vivas.has(f.id));
}

/** Los conceptos de una familia en un ámbito · lo que pinta un selector. */
export function conceptosDe(familia: FamiliaId, ambito: Ambito): Concepto[] {
  return conceptosDeAmbito(ambito).filter((c) => c.familia === familia);
}

/**
 * La clasificación que le toca a un gasto · `undefined` si ese concepto no se
 * puede usar en ese ámbito.
 *
 * `undefined` NO es "usa lo que haya": es que la combinación no existe, y quien
 * llame debe negarse a guardar en vez de improvisar una categoría. Esa es la
 * regla que faltaba y por la que un seguro de vida acabó en un ámbito donde su
 * familia no existía.
 */
export function proyectar(
  conceptoId: string | undefined | null,
  ambito: Ambito,
): ProyeccionPersonal | ProyeccionInmueble | undefined {
  const c = conceptoPorId(conceptoId);
  if (!c) return undefined;
  return ambito === 'personal' ? c.personal : c.inmueble;
}

/**
 * Conceptos cuyo tratamiento fiscal hay que preguntar al confirmar.
 * Hoy sólo la derrama · ver `ProyeccionInmueble.categoryKey`.
 */
export function requierenPregunta(): Concepto[] {
  return EFECTIVOS.filter((c) => c.inmueble?.estado === 'pregunta');
}

/**
 * Camino INVERSO: de lo persistido (`categoryKey` + `subtypeKey`) al concepto
 * que ve el usuario. Lo necesita la ficha de §4.5 para nacer rellena con la
 * clasificación que ya tiene el registro.
 *
 * Solo el ámbito INMUEBLE es invertible: ahí cada concepto lleva su propia
 * `categoryKey`. En personal la key es de brocha gorda (`gasto_personal_*`) y
 * la comparten familias enteras, así que la vuelta no es unívoca y se devuelve
 * `undefined` — que la ficha traduce como «Sin clasificar», la verdad, en vez
 * de inventar una familia y reclasificar a espaldas del usuario.
 *
 * También devuelve `undefined` cuando varias conceptos caen en la misma key
 * (p. ej. `servicio_inmueble`, que comparten limpieza, gestoría y alarma):
 * adivinar uno sería peor que no rellenar.
 */
export function conceptoDesdeClasificacion(
  categoryKey: string | null | undefined,
  subtypeKey: string | null | undefined,
  ambito: Ambito,
): { familia: FamiliaId; conceptoId: string } | undefined {
  if (!categoryKey || ambito !== 'inmueble') return undefined;
  const sub = subtypeKey ?? undefined;
  const candidatos = EFECTIVOS.filter(
    (c) => c.inmueble?.categoryKey === categoryKey && (c.inmueble?.subtypeKey ?? undefined) === sub,
  );
  if (candidatos.length !== 1) return undefined;
  return { familia: candidatos[0].familia, conceptoId: candidatos[0].id };
}
