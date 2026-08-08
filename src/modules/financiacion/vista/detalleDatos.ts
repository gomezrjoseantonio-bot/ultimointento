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
import { tinDelTramo } from '../../../services/prestamos/tinDelTramo';
import {
  estaAplicada,
  puntosDe,
  reduccionPorBonificaciones,
} from '../../../services/bonificaciones/tinEfectivo';
import {
  getCuota,
  getFechaVencimiento,
  getPrincipalInicial,
} from '../../../services/prestamos/lecturas';

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

export interface ResumenBonificaciones {
  lista: BonificacionDetalle[];
  /** Lo que rebajan en total · ya con el tope y el modo cascada aplicados. */
  rebajaTotal: number;
  /** El tope del anexo, en puntos · `null` si el préstamo no dice ninguno. */
  tope: number | null;
}

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
 */
export function resumenBonificaciones(
  prestamo: Prestamo,
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

  return {
    lista,
    rebajaTotal: reduccionPorBonificaciones(prestamo.bonificaciones, prestamo),
    tope: tope && tope > 0 ? tope : null,
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
