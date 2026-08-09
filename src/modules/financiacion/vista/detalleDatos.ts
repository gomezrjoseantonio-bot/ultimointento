// Lo que el detalle de un préstamo necesita saber · Entregable B.
//
// Igual que la cartera: aquí no se calcula, se LEE del cuadro de
// `generarCuadro` y de las reglas que ya existen en `services/`. Las
// bonificaciones las suma `reduccionPorBonificaciones` —con su tope y su modo
// cascada—, no una suma escrita aquí: era una de las cuatro copias de la misma
// regla que la tarea del motor está desmontando.

import type { Bonificacion, Prestamo } from '../../../types/prestamos';
import type { Cumplimiento } from '../../../services/bonificaciones/cumplimiento';
import { textoDeCumplimiento } from '../textoBonificacion';
import type { Cuadro } from '../../../services/prestamos/cuadro';
import { tramosDeTipo, type TramoDeTipo } from '../../../services/prestamos/tramosDeTipo';
import {
  rebajanEnTramo,
  tinDelTramo,
  tinDelTramoSiRevisaranHoy,
} from '../../../services/prestamos/tinDelTramo';
import {
  bonificacionesQueCuentan,
  estaAplicada,
  puntosDe,
  reduccionPorBonificaciones,
} from '../../../services/bonificaciones/tinEfectivo';
import {
  getCuota,
  getFechaVencimiento,
  getPrincipalInicial,
} from '../../../services/prestamos/lecturas';
import type { Revision } from '../../../services/bonificaciones/revisionDelBanco';
import { diaMesAnio, mesAnio } from './formato';

// ─── La línea de tiempo de los tramos ───────────────────────────────────────

export interface TramoDetalle {
  tramo: TramoDeTipo;
  /** El TIN que se paga · bonificaciones y tope incluidos. */
  tin: number;
  /** El TIN antes de bonificar · para tacharlo si difiere. */
  tinTeorico: number;
  /** La cuota del cuadro en ese tramo. */
  cuota: number;
  /** Desde cuándo rige · ISO. */
  desde: string;
  /** Hasta cuándo · ISO · el arranque del siguiente o el vencimiento. */
  hasta: string;
  /** Cuánto ocupa en la barra · 0..100. */
  anchoPct: number;
  /**
   * El índice de ESTE tramo · `null` en uno fijo.
   *
   * Sale del tramo, no de `prestamo.valorIndiceActual`. La ficha enseñaba ese
   * campo debajo de todos los tramos variables, así que un tramo nacido de una
   * revisión apuntada al 2,000 % seguía anunciando el índice del alta.
   */
  indice: number | null;
}

export interface LineaDeTiempo {
  tramos: TramoDetalle[];
  firma: string;
  fin: string;
  /** Dónde cae hoy en la barra · 0..100 · `null` si queda fuera. */
  hoyPct: number | null;
}

const mesesEntre = (desde: string, hasta: string): number => {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + (d2 - d1) / 30;
};

/**
 * Los tramos de tipo de un préstamo, medidos para pintarlos.
 *
 * Un fijo devuelve uno solo que ocupa la barra entera —«sin sorpresas»— y un
 * mixto devuelve el fijo y el variable con su reparto real, que es lo que hace
 * ver de un vistazo cuánto teaser queda.
 */
export function lineaDeTiempo(
  prestamo: Prestamo,
  cuadro: Cuadro,
  hoy: string,
): LineaDeTiempo {
  const firma = prestamo.fechaFirma?.slice(0, 10) || '';
  const fin = getFechaVencimiento(cuadro) ?? firma;
  const brutos = tramosDeTipo(prestamo);
  const total = Math.max(1, mesesEntre(firma, fin));

  const diferencial =
    typeof prestamo.diferencial === 'number' && Number.isFinite(prestamo.diferencial)
      ? prestamo.diferencial
      : 0;

  const tramos: TramoDetalle[] = brutos.map((t, i) => {
    const desde = t.desde || firma;
    const hasta = brutos[i + 1]?.desde ?? fin;
    return {
      tramo: t,
      tin: tinDelTramo(prestamo, t),
      tinTeorico: t.tinBase,
      cuota: getCuota(cuadro, desde),
      desde,
      hasta,
      anchoPct: Math.max(0, Math.min(100, (mesesEntre(desde, hasta) / total) * 100)),
      indice: t.variable ? Math.round((t.tinBase - diferencial) * 10000) / 10000 : null,
    };
  });

  const transcurrido = mesesEntre(firma, hoy);
  const hoyPct =
    transcurrido >= 0 && transcurrido <= total ? (transcurrido / total) * 100 : null;

  return { tramos, firma, fin, hoyPct };
}

// ─── Bonificaciones ─────────────────────────────────────────────────────────

export interface BonificacionDetalle {
  bonificacion: Bonificacion;
  /** Si el banco la está aplicando hoy. */
  alcanzada: boolean;
  /** Lo que rebaja, en puntos porcentuales · siempre positivo. */
  puntos: number;
  /**
   * Lo que los movimientos DEMUESTRAN · `undefined` mientras no se han mirado.
   *
   * Es otra pregunta distinta de `alcanzada`, y cruzarlas es el error que esta
   * pantalla venía cometiendo. Lo que el banco aplica es un hecho del contrato;
   * si la condición se está cumpliendo lo dicen tus movimientos, y pueden no
   * coincidir — justo cuando conviene enterarse *(Jose · 6 ago 2026: «aquí se
   * debe decir las bonificaciones que propone el banco, y tú luego comprobarás
   * las que existen»)*.
   */
  veredicto?: Cumplimiento['veredicto'];
  /**
   * Lo que dicen los movimientos, en una línea de castellano.
   *
   * Lo escribe `textoDeCumplimiento`, que ya sabía decirlo: cuántos meses de
   * cuántos llegan, qué falta para el mínimo, y qué gasto está hecho pero aún
   * no consta. Aquí se estaba reinventando con un `motivo` a secas.
   */
  explicacion?: string;
}

/**
 * Si el banco y tus movimientos dicen cosas distintas de esta bonificación.
 *
 * Son dos preguntas —lo que el banco APLICA es un hecho del contrato; si la
 * CUMPLES lo dicen tus recibos— y cuando no coinciden es justo cuando hay que
 * enterarse: te la aplican y no la demuestras (la pierdes en la próxima
 * revisión), o la cumples y no te la aplican (pagas de más).
 *
 * `no_verificable` no es discrepancia: no afirma lo contrario, dice que no se ha
 * podido mirar.
 */
export function hayDiscrepancia(b: BonificacionDetalle): boolean {
  if (b.veredicto == null || b.veredicto === 'no_verificable') return false;
  return (b.veredicto === 'cumple') !== b.alcanzada;
}

/**
 * Cuándo se pierde una bonificación que hoy te aplican y no demuestras.
 *
 * `proximaRevision` puede contestar con precisión de MES —`2026-08`, cuando la
 * escritura solo dice el periodo—, y entonces no hay día que enseñar:
 * `diaMesAnio` exige diez caracteres y escribía «la pierdes el —». Se mira la
 * precisión que la propia revisión trae en vez de adivinarla de la longitud del
 * texto, que es lo que lo hace fiable.
 */
export function cuandoSePierde(proxima: Revision | null): string {
  if (!proxima?.fecha) return 'te la aplican · no la demuestras';
  return proxima.precision === 'dia'
    ? `la pierdes el ${diaMesAnio(proxima.fecha)}`
    : `la pierdes en ${mesAnio(proxima.fecha)}`;
}

export interface ResumenBonificaciones {
  lista: BonificacionDetalle[];
  /** Lo que rebajan en total · ya con el tope y el modo cascada aplicados. */
  rebajaTotal: number;
  /** El tope del anexo, en puntos · `null` si el préstamo no dice ninguno. */
  tope: number | null;
  /**
   * Si rebajan el tramo que corre HOY.
   *
   * En la mixta de Jose no lo hacen: la escritura dice «en el SEGUNDO y en los
   * sucesivos periodos de interés», así que durante los 36 meses al 2,600 % da
   * igual el anexo entero. La ficha decía «tu tipo de hoy 3,60 → 2,60 %», que
   * es falso por los dos lados — ni hoy paga 3,60 ni las bonificaciones le
   * están bajando nada. Lo que se juega ahí se cobra en la primera revisión.
   */
  rebajanHoy: boolean;
  /** El día en que empiezan a rebajar · solo cuando hoy todavía no lo hacen. */
  rebajanDesde?: string;
  /**
   * Las que SUMAN a `rebajaTotal` · exactamente las que ese número cuenta.
   *
   * Viven en la tarjeta del tipo de interés, no en la de bonificaciones. Es el
   * reparto que pidió Jose *(9 ago 2026)*: *«las bonificaciones aquí son para
   * el periodo posterior… una vez se validen pasarán a la pestaña de tipo de
   * interés, como las que se están aplicando»*. Y arregla el «check con un “no
   * se cumple” al lado»: mientras la misma fila contestaba las dos preguntas,
   * la tarjeta parecía contradecirse consigo misma.
   *
   * Salen de `bonificacionesQueCuentan`, la misma función que alimenta
   * `rebajaTotal`, y no de un `filter(alcanzada)` escrito aquí. En modo
   * `CASCADA` la primera no aplicada corta las de debajo, así que filtrar por
   * estado listaría bonificaciones que no suman al número de al lado — otra
   * contradicción en la misma pantalla, que es justo lo que este reparto venía
   * a quitar.
   *
   * Lo que NO dicen es que tu tipo de hoy sea el que es por ellas: en el tramo
   * fijo de una mixta el banco las tiene concedidas y no rebajan nada hasta la
   * primera revisión. Eso lo dice `rebajanHoy`, y la pantalla lo pregunta antes
   * de enseñarlas.
   */
  aplicadas: BonificacionDetalle[];
  /** El tipo del tramo bonificable ANTES de bonificar · `null` si no hay. */
  tinSinBonificar: number | null;
  /** Ese mismo tramo con las que el banco aplica hoy. */
  tinConLasQueTienes: number | null;
  /**
   * Y con las que TUS MOVIMIENTOS sostienen · `null` mientras no se han mirado.
   *
   * Es la cifra que faltaba. La tarjeta anunciaba la rebaja entera dando por
   * hechas las cuatro bonificaciones mientras dos de sus propias filas decían
   * que se van a perder: el titular contradecía a la lista que tenía debajo.
   * Se recalcula entero (no se suman «los puntos en riesgo») porque con un tope
   * perder una bonificación puede no costar ni un céntimo.
   */
  tinSiRevisaranHoy: number | null;
}

/** El tramo que corre hoy · el último que ya ha empezado. */
const tramoDeHoy = (tramos: TramoDeTipo[], hoy: string): TramoDeTipo | undefined =>
  [...tramos].reverse().find((t) => (t.desde || '') <= hoy) ?? tramos[0];

/**
 * Las bonificaciones del préstamo y lo que consiguen.
 *
 * Se listan TODAS, no solo las alcanzadas: las que faltan son justo las que
 * puedes ir a buscar, y esconderlas deja la tarjeta diciendo que ya no hay nada
 * que hacer. La rebaja total la calcula el servicio, con su tope.
 *
 * Con `cumplimientos` cada una lleva además lo que dicen tus movimientos. Sin
 * ellos la lista sigue saliendo —el contrato se sabe sin mirar la tesorería—,
 * solo que sin veredicto.
 *
 * Y sobre QUÉ tramo rebajan lo decide `rebajanEnTramo`, no esta pantalla: es la
 * misma pregunta que se hace el cuadro, y ya sabemos lo que pasa cuando la
 * misma regla se escribe en dos sitios.
 */
export function resumenBonificaciones(
  prestamo: Prestamo,
  hoy: string,
  cumplimientos?: Cumplimiento[]
): ResumenBonificaciones {
  const porId = new Map((cumplimientos ?? []).map((c) => [c.bonificacionId, c]));
  const lista = (prestamo.bonificaciones ?? []).map((b) => {
    const c = porId.get(b.id);
    return {
      bonificacion: b,
      alcanzada: estaAplicada(b),
      puntos: puntosDe(b),
      veredicto: c?.veredicto,
      explicacion: c ? textoDeCumplimiento(c) : undefined,
    };
  });

  const tope = Number.isFinite(Number(prestamo.topeBonificacionesTotal))
    ? Math.abs(Number(prestamo.topeBonificacionesTotal))
    : null;

  // Las que de verdad suman · en cascada no son «las aplicadas», y esa
  // diferencia se ve en pantalla: un chip por una bonificación que no cuenta.
  const cuentan = new Set(
    bonificacionesQueCuentan(prestamo.bonificaciones, prestamo.modoBonificaciones).map((b) => b.id)
  );

  const tramos = tramosDeTipo(prestamo);
  const ahora = tramoDeHoy(tramos, hoy);
  const rebajanHoy = ahora ? rebajanEnTramo(prestamo, ahora) : true;
  // Si hoy no rebajan, el primero que lo hará · es sobre ese tramo sobre el que
  // hay algo que contar, y su fecha es la respuesta a «¿entonces cuándo?».
  const futuro = rebajanHoy
    ? undefined
    : tramos.find((t) => rebajanEnTramo(prestamo, t) && (t.desde || '') > hoy);
  const bonificable = rebajanHoy ? ahora : futuro;

  return {
    lista,
    aplicadas: lista.filter((b) => cuentan.has(b.bonificacion.id)),
    rebajaTotal: reduccionPorBonificaciones(prestamo.bonificaciones, prestamo),
    tope: tope && tope > 0 ? tope : null,
    rebajanHoy,
    rebajanDesde: futuro?.desde || undefined,
    tinSinBonificar: bonificable ? bonificable.tinBase : null,
    tinConLasQueTienes: bonificable ? tinDelTramo(prestamo, bonificable) : null,
    tinSiRevisaranHoy:
      bonificable && cumplimientos
        ? tinDelTramoSiRevisaranHoy(prestamo, bonificable, cumplimientos)
        : null,
  };
}

// ─── Destino y fiscalidad ───────────────────────────────────────────────────

export interface Fiscalidad {
  /**
   * Si sus intereses reducen el IRPF · `null` mientras no se sabe.
   *
   * El tercer estado no es un lujo: saberlo exige leer los contratos, que llega
   * después de pintar. Con un `false` provisional la ficha diría «no deducible»
   * durante un instante y luego cambiaría de opinión, y el que lo lea en ese
   * instante se lleva la respuesta contraria.
   */
  deducible: boolean | null;
  /** Qué parte del capital deduce · 0..100. */
  pctDeducible: number;
  /** El destino, en palabras. */
  destino: string;
  /** Por qué NO es deducible · solo cuando no lo es. */
  motivo?: string;
}

const ETIQUETA_DESTINO: Record<string, string> = {
  ADQUISICION: 'adquisición de inmueble',
  REFORMA: 'reforma de inmueble',
  CANCELACION_DEUDA: 'cancelación de deuda',
  INVERSION: 'inversión',
  PERSONAL: 'uso personal',
  OTRA: 'otro destino',
};

/**
 * Si los intereses reducen el IRPF, y por qué no cuando no lo hacen.
 *
 * **Lo que deduce no es el destino, es el alquiler** *(Jose · 8 ago 2026)*. El
 * destino traza el capital a un inmueble y dice qué fracción; lo que abre la
 * casilla 0105 es que ese inmueble produzca renta. Esta función contestaba solo
 * la primera mitad, y encima el motivo que escribía cuando decía «no» hablaba
 * de «un inmueble en alquiler» que no se miraba en ninguna parte.
 *
 * `inmueblesAlquilados` en `undefined` significa «todavía no se sabe», no «no
 * hay ninguno»: los contratos se leen en paralelo y llegan después.
 */
export function fiscalidadDe(
  prestamo: Prestamo,
  inmueblesAlquilados: ReadonlySet<string> | undefined
): Fiscalidad {
  const destinos = prestamo.destinos ?? [];
  const principal = prestamo.principalInicial || 0;

  const destino =
    destinos.length === 0
      ? 'sin destino apuntado'
      : [...new Set(destinos.map((d) => ETIQUETA_DESTINO[d.tipo] ?? d.tipo))].join(' · ');

  if (inmueblesAlquilados === undefined) {
    return { deducible: null, pctDeducible: 0, destino };
  }

  const aInmueble = destinos.filter(
    (d) => d.inmuebleId && (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA')
  );
  const enAlquiler = aInmueble.filter((d) => inmueblesAlquilados.has(String(d.inmuebleId)));
  const trazado = enAlquiler.reduce((s, d) => s + d.importe, 0);

  if (principal > 0 && trazado > 0) {
    return {
      deducible: true,
      pctDeducible: Math.min(100, (trazado / principal) * 100),
      destino,
    };
  }

  const motivo =
    destinos.length === 0
      ? 'el préstamo no tiene destinos apuntados, así que no se puede trazar su capital a ningún inmueble'
      : aInmueble.length === 0
        ? 'el capital no está trazado a la compra ni a la reforma de un inmueble'
        : 'el inmueble que financia no está alquilado · los intereses reducen el IRPF mientras produce rendimientos de alquiler, no por haberlo comprado';

  return { deducible: false, pctDeducible: 0, destino, motivo };
}

// ─── Condiciones del banco ──────────────────────────────────────────────────

export interface Condicion {
  clave: string;
  valor: string;
}

const eur = (n: number): string =>
  `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n))} €`;

const pctCond = (n: number): string => `${n.toFixed(2).replace('.', ',')} %`;

const ETIQUETA_GARANTIA: Record<string, string> = {
  HIPOTECARIA: 'hipotecaria',
  PERSONAL: 'personal',
  PIGNORATICIA: 'pignoraticia',
};

/**
 * Lo que dice el papel del banco · solo los campos que el préstamo trae.
 *
 * Un campo ausente no se enseña con un «—»: seis huecos vacíos no informan de
 * nada y ocupan la tarjeta entera.
 */
export function condicionesDe(prestamo: Prestamo, cuadro: Cuadro): Condicion[] {
  const filas: Condicion[] = [
    { clave: 'Importe inicial', valor: eur(getPrincipalInicial(cuadro)) },
    { clave: 'Plazo', valor: `${prestamo.plazoMesesTotal} meses` },
    { clave: 'Base de cálculo', valor: prestamo.baseCalculoIntereses ?? '30/360' },
  ];

  const numero = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  const demora = numero(prestamo.interesDemoraPct);
  if (demora != null) filas.push({ clave: 'Interés de demora', valor: pctCond(demora) });

  const apertura = numero(prestamo.comisionApertura);
  if (apertura != null) filas.push({ clave: 'Comisión de apertura', valor: pctCond(apertura) });

  const anticipada = numero(prestamo.comisionAmortizacionAnticipada);
  if (anticipada != null) filas.push({ clave: 'Amort. anticipada', valor: pctCond(anticipada) });

  const cancelacion = numero(prestamo.comisionCancelacionTotal);
  if (cancelacion != null) filas.push({ clave: 'Cancelación total', valor: pctCond(cancelacion) });

  const reclamacion = numero(prestamo.gastoReclamacionImpago);
  if (reclamacion != null) filas.push({ clave: 'Reclamación de impago', valor: eur(reclamacion) });

  const garantias = prestamo.garantias ?? [];
  if (garantias.length > 0) {
    filas.push({
      clave: 'Garantía',
      valor: [...new Set(garantias.map((g) => ETIQUETA_GARANTIA[g.tipo] ?? g.tipo))].join(' · '),
    });
  }

  // La tarjeta es una rejilla de dos columnas y tres filas · más de seis
  // condiciones la desbordarían y la vista tiene que caber sin scroll.
  return filas.slice(0, 6);
}
