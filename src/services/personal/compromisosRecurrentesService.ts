// ============================================================================
// ATLAS Personal v1.1 · CompromisosRecurrentesService
// ============================================================================
//
// CRUD del catálogo `compromisosRecurrentes` + generación automática de
// eventos en `treasuryEvents` (regla de oro #1 · cada compromiso se da de
// alta UNA vez · genera N eventos automáticamente).
//
// Decisiones aplicadas:
//   G-01 · Schema único con discriminador `ambito` (personal | inmueble)
//   G-08 · Aprendizaje: las reglas de conciliación viven en otro store
//   Regla #2 · viviendaHabitual genera derivados aparte (NO via este service)
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import type {
  CompromisoRecurrente,
  PatronRecurrente,
  ImporteEvento,
  MotivoBaja,
  ValidationResult,
} from '../../types/compromisosRecurrentes';
import {
  expandirPatron,
  calcularImporte,
  aplicarVariacion,
} from './patronCalendario';
import { toISODateLocal } from '../../utils/recurrenceDateUtils';
import { listarTarjetas } from '../tarjetasService';
import {
  claveOrigenPrevision,
  esPrevisionDeCompromiso,
  esPrevisionIntocable,
} from './previsionesIdempotencia';
import {
  eventoDeRecibo,
  persistirRecibos,
  recibosPrevistos,
  tarjetaDelCompromiso,
  vaEnRecibo,
  ventanaDeRecibos,
} from './recibosDeTarjetaPrevistos';
import type { Tarjeta } from '../../types/tarjetas';

const STORE_COMPROMISOS = 'compromisosRecurrentes';
const STORE_TREASURY = 'treasuryEvents';

// Horizonte por defecto de la VENTANA MATERIALIZADA en `treasuryEvents` cuando
// nadie pide un horizonte explícito. NO es un límite del patrón: un compromiso
// se expande a demanda hasta donde pida quien pregunte (el Presupuesto pide 12
// meses, la proyección a largo plazo pide 20 años vía `opexCompromisosEngine` /
// `expandirPatron`, sin materializar). Los llamantes vivos (bootstrap de
// Tesorería) pasan su propio `hasta`; esta constante solo cubre el caso de un
// llamante directo que no especifica ventana.
const HORIZONTE_MESES_DEFECTO = 24;

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function listarCompromisos(
  filtro?: { ambito?: 'personal' | 'inmueble'; personalDataId?: number; inmuebleId?: number; soloActivos?: boolean },
): Promise<CompromisoRecurrente[]> {
  const db = await initDB();
  const all = await db.getAll(STORE_COMPROMISOS);
  return all.filter((c) => {
    if (filtro?.ambito && c.ambito !== filtro.ambito) return false;
    if (filtro?.personalDataId !== undefined && c.personalDataId !== filtro.personalDataId) return false;
    if (filtro?.inmuebleId !== undefined && c.inmuebleId !== filtro.inmuebleId) return false;
    if (filtro?.soloActivos && c.estado !== 'activo') return false;
    return true;
  });
}

export async function obtenerCompromiso(id: number): Promise<CompromisoRecurrente | undefined> {
  const db = await initDB();
  return db.get(STORE_COMPROMISOS, id);
}

export async function crearCompromiso(
  datos: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<CompromisoRecurrente> {
  // Validar invariantes (regla #2 + sección 6.5)
  const validacion = await puedeCrearCompromiso(datos);
  if (!validacion.ok) {
    throw new Error(`No se puede crear compromiso: ${validacion.motivo}`);
  }

  const db = await initDB();
  const ahora = new Date().toISOString();
  const compromiso: CompromisoRecurrente = {
    ...datos,
    createdAt: ahora,
    updatedAt: ahora,
  };
  const id = await db.add(STORE_COMPROMISOS, compromiso);
  const creado = { ...compromiso, id: id as number };

  // Genera eventos en treasuryEvents (regla #1)
  if (creado.estado === 'activo') {
    await regenerarEventosCompromiso(creado);
  }

  return creado;
}

export async function actualizarCompromiso(
  id: number,
  cambios: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>>,
): Promise<CompromisoRecurrente> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) throw new Error(`Compromiso ${id} no existe`);

  // Si está bloqueado por origen (derivado), solo permitir cambios desde el origen
  if (existente.derivadoDe?.bloqueado) {
    throw new Error(
      `Compromiso bloqueado · editar desde origen (${existente.derivadoDe.fuente})`,
    );
  }

  const actualizado: CompromisoRecurrente = {
    ...existente,
    ...cambios,
    id,
    createdAt: existente.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_COMPROMISOS, actualizado);

  // Re-genera eventos solo si cambia algo que afecta a la proyección
  await borrarEventosFuturosCompromiso(id);
  if (actualizado.estado === 'activo') {
    await regenerarEventosCompromiso(actualizado);
  }

  return actualizado;
}

/** Qué se copia al clonar gastos de otro inmueble (§ copiar · mockup v2_3). */
export interface OpcionesCopia {
  importes: boolean; // copiar los importes (si no, quedan vacíos)
  cuenta: boolean; // copiar la cuenta de cargo
}

/**
 * Copia los gastos (activos + preparados) de un inmueble ORIGEN a otro DESTINO.
 * Se añaden como NUEVOS y nacen `preparado` (no se toca nada de lo que ya tenga
 * el destino). Concepto, proveedor y calendario van siempre; el importe y la
 * cuenta según `opts`; CUPS, nº de contrato y repartos NO se copian (son propios
 * de cada inmueble · se revisan uno a uno después). Devuelve cuántos se crearon.
 */
export async function copiarGastosDeInmueble(
  inmuebleOrigenId: number,
  inmuebleDestinoId: number,
  opts: OpcionesCopia,
): Promise<number> {
  const origen = await listarCompromisos({ ambito: 'inmueble', inmuebleId: inmuebleOrigenId });
  const copiables = origen.filter((c) => c.estado === 'activo' || c.estado === 'preparado');
  let creados = 0;
  for (const c of copiables) {
    const nuevo: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'> = {
      ...c,
      inmuebleId: inmuebleDestinoId,
      estado: 'preparado',
      importe: opts.importes ? c.importe : { modo: 'fijo', importe: 0 },
      cuentaCargo: opts.cuenta ? c.cuentaCargo : 0,
      // Propios de cada inmueble · no se copian
      cups: undefined,
      numeroContrato: undefined,
      reparto: undefined,
      fechaFin: undefined,
      motivoBaja: undefined,
      derivadoDe: undefined,
    };
    // `id`/`createdAt`/`updatedAt` se descartan al ser Omit; borramos por si acaso.
    delete (nuevo as Partial<CompromisoRecurrente>).id;
    try {
      await crearCompromiso(nuevo);
      creados += 1;
    } catch {
      // Si alguno choca con una validación (p.ej. derivado), se salta.
    }
  }
  return creados;
}

export async function eliminarCompromiso(id: number): Promise<void> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) return;
  if (existente.derivadoDe?.bloqueado) {
    throw new Error('Compromiso bloqueado · eliminar desde origen');
  }
  await borrarEventosFuturosCompromiso(id);
  await db.delete(STORE_COMPROMISOS, id);
  // Si pagaba con crédito aplazado, su parte estaba dentro del recibo de la
  // tarjeta y no en previsiones suyas: sin rehacerlo, el recibo seguiría
  // cobrando un gasto que ya no existe. Solo en ese caso — rehacer el recibo
  // barre todos los eventos de tarjeta, y no hay por qué pagarlo al borrar una
  // domiciliación o un gasto con tarjeta de débito.
  if (vaEnRecibo(existente, await tarjetaDelCompromiso(existente))) {
    await regenerarRecibosDeTarjeta();
  }
}

// ─── Estados: preparado · baja · reactivación (secciones 2.3 y 2.4) ─────────

/**
 * ¿El compromiso ha tenido alguna vez un cargo CUADRADO (evento ejecutado y
 * ligado a un movimiento real)? Decide el destino del interruptor: apagar uno
 * que nunca cuadró → `preparado` (sin fecha); apagar uno que sí → `baja` con
 * fecha del último cobro. Ver §2.3.
 */
export async function tieneCargosCuadrados(compromisoId: number): Promise<boolean> {
  const db = await initDB();
  const idx = db.transaction(STORE_TREASURY, 'readonly').objectStore(STORE_TREASURY).index('sourceId');
  const eventos = (await idx.getAll(compromisoId)) as TreasuryEvent[];
  return eventos.some(
    (e) =>
      e.sourceType === 'gasto_recurrente' &&
      e.status === 'executed' &&
      e.executedMovementId != null,
  );
}

/**
 * Apaga un compromiso que nunca ha tenido un cargo cuadrado → `preparado`.
 * No lleva fecha y no se proyecta: se retiran sus previsiones. §2.3.
 */
export async function pasarAPreparado(id: number): Promise<CompromisoRecurrente> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) throw new Error(`Compromiso ${id} no existe`);

  const actualizado: CompromisoRecurrente = {
    ...existente,
    estado: 'preparado',
    // preparado no arrastra fecha de fin ni motivo de baja
    fechaFin: undefined,
    motivoBaja: undefined,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_COMPROMISOS, actualizado);
  // Preparado NO se proyecta · fuera sus previsiones
  await borrarEventosFuturosCompromiso(id);
  return actualizado;
}

/**
 * Da de baja un compromiso que sí ha tenido cargos → `baja` con la fecha del
 * último cobro. Los cargos anteriores se conservan (siguen siendo deducibles);
 * las previsiones desde esa fecha se retiran. §2.4.
 */
export async function darDeBajaCompromiso(
  id: number,
  fechaUltimoCobro: string,
  motivo: MotivoBaja,
): Promise<CompromisoRecurrente> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) throw new Error(`Compromiso ${id} no existe`);

  const actualizado: CompromisoRecurrente = {
    ...existente,
    estado: 'baja',
    fechaFin: fechaUltimoCobro, // ISO date del último cobro
    motivoBaja: motivo,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_COMPROMISOS, actualizado);
  // Las previsiones futuras (predicted) se retiran; los ejecutados se conservan
  await borrarEventosFuturosCompromiso(id);
  // Lo que pagaba con crédito aplazado no tenía previsiones propias que retirar:
  // su parte vivía dentro del recibo de la tarjeta. Hay que rehacerlo, o el
  // recibo seguiría cobrando un gasto que ya no está. Solo en ese caso: rehacer
  // el recibo barre todos los eventos de tarjeta.
  if (vaEnRecibo(existente, await tarjetaDelCompromiso(existente))) {
    await regenerarRecibosDeTarjeta();
  }
  return actualizado;
}

/** Faltantes para activar un `preparado` (§2.3): importe, primer cobro, calendario, medio de pago. */
export interface FaltantesActivacion {
  importe: boolean;
  primerCobro: boolean;
  calendario: boolean;
  medioPago: boolean;
}

/** Qué le falta a un compromiso para poder activarse. Vacío (todo false) = listo. */
export function faltantesParaActivar(c: CompromisoRecurrente): FaltantesActivacion {
  const importeVacio =
    !c.importe ||
    (c.importe.modo === 'fijo' && !(c.importe.importe > 0)) ||
    (c.importe.modo === 'variable' && !(c.importe.importeMedio > 0));
  return {
    importe: importeVacio,
    primerCobro: !c.fechaInicio,
    calendario: !c.patron,
    medioPago: !c.metodoPago,
  };
}

/**
 * Activa un `preparado`. Exige las cuatro cosas (§2.3): importe, primer cobro,
 * calendario y medio de pago. Si falta alguna, lanza y el compromiso NO cambia
 * de estado (nunca queda activo a medias). Al activarse, se regeneran sus
 * previsiones.
 */
export async function activarCompromiso(
  id: number,
  datos: Partial<Omit<CompromisoRecurrente, 'id' | 'createdAt'>> = {},
): Promise<CompromisoRecurrente> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) throw new Error(`Compromiso ${id} no existe`);

  const candidato: CompromisoRecurrente = { ...existente, ...datos, id };
  const faltan = faltantesParaActivar(candidato);
  if (faltan.importe || faltan.primerCobro || faltan.calendario || faltan.medioPago) {
    const que = [
      faltan.importe && 'importe',
      faltan.primerCobro && 'primer cobro',
      faltan.calendario && 'calendario',
      faltan.medioPago && 'medio de pago',
    ].filter(Boolean);
    throw new Error(`No se puede activar · falta: ${que.join(', ')}`);
  }

  const actualizado: CompromisoRecurrente = {
    ...candidato,
    estado: 'activo',
    fechaFin: undefined,
    motivoBaja: undefined,
    createdAt: existente.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_COMPROMISOS, actualizado);
  await regenerarEventosCompromiso(actualizado);
  return actualizado;
}

/**
 * ¿Se puede reactivar? Solo un `baja` cuyo motivo NO sea cambio de proveedor.
 * "Cambié de proveedor" bloquea la reactivación (§2.4): el viejo queda de baja
 * y hay que crear uno nuevo.
 */
export function puedeReactivar(c: CompromisoRecurrente): boolean {
  return c.estado === 'baja' && c.motivoBaja !== 'cambioProveedor';
}

/**
 * Reactiva un compromiso dado de baja porque el mismo servicio vuelve (§2.4).
 * Conserva CUPS, contrato, historial y cadena fiscal; se retoma la proyección
 * desde `fechaNuevoCobro`, dejando un hueco sin cargos entre la baja y ahora —
 * que es la verdad. Bloquea si el motivo fue cambio de proveedor.
 */
export async function reactivarCompromiso(
  id: number,
  fechaNuevoCobro: string,
): Promise<CompromisoRecurrente> {
  const db = await initDB();
  const existente = await db.get(STORE_COMPROMISOS, id);
  if (!existente) throw new Error(`Compromiso ${id} no existe`);
  if (existente.estado !== 'baja') {
    throw new Error('Solo se reactiva un compromiso dado de baja');
  }
  if (existente.motivoBaja === 'cambioProveedor') {
    throw new Error(
      'No se reactiva: la baja fue por cambio de proveedor · crea uno nuevo',
    );
  }

  const actualizado: CompromisoRecurrente = {
    ...existente,
    estado: 'activo',
    fechaFin: undefined, // se quita el tope de la baja
    motivoBaja: undefined,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE_COMPROMISOS, actualizado);

  // Retomar la proyección desde el nuevo cobro. El hueco (entre la baja y el
  // nuevo cobro) queda vacío: los ejecutados pasados se conservan y no se
  // generan previsiones retroactivas. Va por la MISMA puerta que el resto
  // (regenerarEventosCompromiso) para heredar la idempotencia · antes tenía su
  // propio bucle de `add` sin guardas, y ese era uno de los dos caminos que
  // podían emitir la misma previsión dos veces.
  const desde = new Date(fechaNuevoCobro);
  const hoy = new Date();
  await regenerarEventosCompromiso(
    actualizado,
    undefined,
    desde.getTime() > hoy.getTime() ? desde : undefined,
  );
  return actualizado;
}

// ─── Validación de creación (sección 6.5) ──────────────────────────────────

/**
 * Valida los campos mínimos del discriminador (ámbito + FK) y la
 * no-duplicación contra los gastos reales de inmuebles de inversión.
 *
 * Fase 4 vivienda habitual: las restricciones contra la ficha
 * `viviendaHabitual` se retiraron con su generador — los gastos del hogar
 * (alquiler · IBI · comunidad · seguro) viven ÚNICAMENTE como compromisos en
 * Gastos, así que no hay derivados con los que chocar. La hipoteca sigue sin
 * poder crearse como compromiso (`TipoCompromiso` no la incluye · la cuota la
 * genera Financiación).
 */
export async function puedeCrearCompromiso(
  nuevo: Partial<CompromisoRecurrente>,
): Promise<ValidationResult> {
  // 1. Validar campos mínimos del discriminador
  if (!nuevo.ambito) {
    return { ok: false, motivo: 'Falta `ambito` (personal | inmueble)' };
  }
  if (nuevo.ambito === 'inmueble' && !nuevo.inmuebleId) {
    return { ok: false, motivo: 'Falta `inmuebleId` para ambito=inmueble' };
  }
  if (nuevo.ambito === 'personal' && !nuevo.personalDataId) {
    return { ok: false, motivo: 'Falta `personalDataId` para ambito=personal' };
  }

  // 2. (Fase 4 vivienda habitual · guardia retirada) Los gastos del hogar
  // (alquiler · IBI · comunidad · seguro) viven ÚNICAMENTE en Gastos: la ficha
  // ViviendaHabitual ya no genera derivados, así que no hay choque que vigilar.
  // La hipoteca sigue sin poder crearse como compromiso (TipoCompromiso no la
  // incluye · la cuota la genera Financiación).

  // 3. Si es inmueble, validar que no choque con `gastosInmueble` reales
  //    Esta validación es laxa · los gastos reales viven en otro store y
  //    el OPEX/compromiso es la previsión. Solo bloqueamos categorías
  //    explícitamente personales.
  if (nuevo.ambito === 'inmueble') {
    const categoriasNoPermitidas: Array<typeof nuevo.categoria> = [
      'ahorro.aporteFondo',
      'ahorro.aportePension',
      'ahorro.amortizacionExtra',
      'ahorro.cuentaTarget',
      'ahorro.cajaLiquida',
      'obligaciones.irpfPagar',
      'obligaciones.irpfFraccionamiento',
      'obligaciones.m130',
      'obligaciones.reta',
    ];
    if (nuevo.categoria && categoriasNoPermitidas.includes(nuevo.categoria)) {
      return {
        ok: false,
        motivo: `Categoría ${nuevo.categoria} no aplica a ambito=inmueble`,
      };
    }
  }

  return { ok: true };
}

// ─── Cálculo canónico del importe (FUENTE ÚNICA) ───────────────────────────
//
// Toda cifra de un compromiso en una fecha/mes sale de AQUÍ · aplica
// `calcularImporte` + `aplicarVariacion`, la MISMA matemática que el
// materializador de `treasuryEvents`. Antes había un segundo motor en
// `personal/helpers` (sin variación, con otra fuente de importe para
// variablePorMes) que hacía que Tesorería y Presupuesto dieran cifras distintas
// del mismo mes. Ese motor se borró: esta es la única puerta.
//
// Regla dura: si no se puede calcular (sin importe o sin patrón · un preparado
// sin activar), devuelve `null` · NUNCA 0 ni NaN. Quien consuma pinta hueco.

/** Importe de un cargo del compromiso en una fecha concreta. `null` si no hay
 *  importe/patrón/fechaInicio con que calcular. */
export function importeCompromisoEnFecha(
  c: CompromisoRecurrente,
  fecha: Date,
): number | null {
  if (!c.importe || !c.patron || !c.fechaInicio) return null;
  const base = calcularImporte(c.importe, fecha);
  return aplicarVariacion(base, c.variacion, new Date(c.fechaInicio), fecha);
}

/** Importe total del compromiso en un mes (`month0` 0-11): suma los cargos que
 *  caen en el mes según el patrón. `null` si no se puede calcular; `0` si el
 *  patrón no cae ese mes (eso SÍ es calculable). */
export function importeCompromisoEnMes(
  c: CompromisoRecurrente,
  year: number,
  month0: number,
): number | null {
  if (!c.importe || !c.patron || !c.fechaInicio) return null;
  const mm = String(month0 + 1).padStart(2, '0');
  const finMes = new Date(year, month0 + 1, 0).getDate();
  const desde = `${year}-${mm}-01`;
  const hasta = `${year}-${mm}-${String(finMes).padStart(2, '0')}`;
  const fechas = expandirPatron(c.patron, desde, hasta);
  let total = 0;
  for (const f of fechas) {
    const v = importeCompromisoEnFecha(c, f);
    if (v != null) total += v;
  }
  return total;
}

// ─── Generación de eventos (sección 3.2) ───────────────────────────────────

/**
 * Genera los `TreasuryEvent` proyectados desde un compromiso, hasta el
 * horizonte indicado (24 meses por defecto).
 *
 * NO escribe en BD · esta función es pura · útil para tests y para
 * `regenerarEventosCompromiso`.
 */
export function generarEventosDesdeCompromiso(
  compromiso: CompromisoRecurrente,
  hasta?: Date,
  // V81 (TAREA CC · Bloque B.3): `desdeOverride` permite pedir un rango PASADO al motor
  // (reconstruir qué se preveía en un mes ya cerrado). Sin él, la capa viva sigue
  // proyectando desde HOY (comportamiento intacto). Ver `generarEventosHistoricos`.
  desdeOverride?: Date,
  /**
   * La tarjeta con la que se paga (§3.2) · quien manda sobre la cuenta.
   *
   * `compromiso.cuentaCargo` es una COPIA de su cuenta de liquidación, hecha el
   * día que se guardó el gasto, y una copia se queda vieja: re-domiciliar la
   * Carrefour de Santander a Bankinter no tocaba los gastos ya guardados, así
   * que el cargo se seguía previendo donde ya no sale.
   */
  tarjeta?: Tarjeta,
): Array<Omit<TreasuryEvent, 'id'>> {
  // §3.4 · lo que se paga con crédito aplazado NO sale el día de la compra: se
  // acumula y sale en el RECIBO de la tarjeta, que cruza varios gastos y por
  // eso se emite aparte (`regenerarRecibosDeTarjeta`). Emitir aquí además sería
  // cobrar dos veces lo mismo. El débito sí sigue siendo un cargo en su fecha.
  //
  // El criterio es el MISMO que decide qué entra en el recibo. Si aquí se
  // suprimiera con una regla y allí se recogiera con otra, el gasto que cayera
  // en medio no lo emitiría nadie: desaparecería de tesorería sin avisar.
  if (vaEnRecibo(compromiso, tarjeta)) return [];

  const fechaInicio = new Date(compromiso.fechaInicio);
  const horizonteFin =
    hasta ||
    new Date(
      new Date().getFullYear(),
      new Date().getMonth() + HORIZONTE_MESES_DEFECTO,
      28,
    );

  // Si hay fechaFin · cap horizonteFin
  let fechaTope = horizonteFin;
  if (compromiso.fechaFin) {
    const fin = new Date(compromiso.fechaFin);
    if (fin.getTime() < horizonteFin.getTime()) fechaTope = fin;
  }

  // Las fechas se proyectan desde el PRIMER DÍA DEL MES EN CURSO · no desde
  // hoy.
  //
  // Proyectar desde hoy daba por confirmado todo lo que cayera antes, apoyado
  // en que "los eventos pasados ya están en el extracto". Eso no se sostiene
  // para un gasto que acabas de dar de alta: un recibo con cargo el día 1
  // creado el día 3 no generaba NADA en el mes en curso, y su cargo real se
  // quedaba sin previsión con la que casar — el mes decía que ibas según lo
  // previsto mientras el dinero ya había salido.
  //
  // El primer día del mes es el mismo borde que usa `treasuryBootstrapService`
  // al purgar previsiones viejas, así que no se emite nada que él vaya a
  // borrar. Y lo ya confirmado no se duplica: `persistirPrevisionesCompromiso`
  // respeta el periodo de las previsiones intocables.
  //
  // Con `desdeOverride` (Bloque B.3) se permite un origen pasado explícito.
  const hoy = new Date();
  const inicioDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const desdeProyeccion =
    desdeOverride ??
    (fechaInicio.getTime() > inicioDelMes.getTime() ? fechaInicio : inicioDelMes);
  const isoDesde = toISODateLocal(desdeProyeccion);
  const isoHasta = toISODateLocal(fechaTope);

  const fechas = expandirPatron(compromiso.patron, isoDesde, isoHasta);
  const ahora = new Date().toISOString();

  return fechas.map((fecha) => {
    // FUENTE ÚNICA · el importe por fecha sale del cálculo canónico (mismo que
    // consumen Presupuesto/Panel/proyección) para que nunca diverjan.
    const importeAjustado = importeCompromisoEnFecha(compromiso, fecha) ?? 0;

    // Pago = negativo · cobro = positivo. Categorías de ingreso son raras
    // en compromisos (la mayoría son pagos).
    const esIngreso = false;
    const importeFinal = esIngreso ? importeAjustado : -importeAjustado;

    const evento: Omit<TreasuryEvent, 'id'> = {
      type: 'expense',
      amount: importeFinal,
      predictedDate: toISODateLocal(fecha),
      description: compromiso.alias,
      sourceType: 'gasto_recurrente',
      sourceId: compromiso.id,
      // §6.3 · quien cobra viaja con la previsión: es lo que se leerá en el
      // extracto y lo que permite distinguir dos recibos casi idénticos.
      proveedor: compromiso.proveedor?.nombre || undefined,
      año: fecha.getFullYear(),
      mes: fecha.getMonth() + 1,
      certeza: 'estimado',
      generadoPor: 'treasurySyncService',
      // Manda la tarjeta, no la copia · §3.2.
      accountId: tarjeta?.cuentaLiquidacionId ?? compromiso.cuentaCargo,
      paymentMethod: paymentMethodFromCompromiso(compromiso.metodoPago),
      status: 'predicted',
      // V81 (TAREA CC · Bloque B.4): la bolsa 50/30/20 viaja al evento para poder
      // agrupar el gasto real por necesidades/deseos/ahorro.
      bolsaPresupuesto: compromiso.bolsaPresupuesto,
      ambito: compromiso.ambito === 'inmueble' ? 'INMUEBLE' : 'PERSONAL',
      inmuebleId: compromiso.ambito === 'inmueble' ? compromiso.inmuebleId : undefined,
      categoryLabel: compromiso.alias,
      categoryKey: compromiso.categoria,
      subtypeKey: compromiso.subtipo,
      providerName: compromiso.proveedor.nombre,
      providerNif: compromiso.proveedor.nif,
      counterparty: compromiso.conceptoBancario,
      createdAt: ahora,
      updatedAt: ahora,
    };
    return evento;
  });
}

/**
 * V81 (TAREA CC · Bloque B.3) · Reconstruye qué se preveía en un rango YA PASADO.
 *
 * La capa viva (`generarEventosDesdeCompromiso` sin override) proyecta siempre desde
 * HOY porque los eventos pasados ya están confirmados por extracto. Para comparar
 * "previsto vs real" de un mes cerrado hace falta saber qué se preveía ENTONCES: esta
 * vía pide al motor `expandirPatron` un origen pasado explícito, sin tocar el
 * comportamiento de la capa viva. NO persiste — es pura, como su hermana.
 */
export function generarEventosHistoricos(
  compromiso: CompromisoRecurrente,
  desde: Date,
  hasta: Date,
): Array<Omit<TreasuryEvent, 'id'>> {
  return generarEventosDesdeCompromiso(compromiso, hasta, desde);
}

function paymentMethodFromCompromiso(
  m: CompromisoRecurrente['metodoPago'],
): TreasuryEvent['paymentMethod'] {
  switch (m) {
    case 'domiciliacion': return 'Domiciliado';
    case 'transferencia': return 'Transferencia';
    case 'tarjeta':       return 'TPV';
    case 'efectivo':      return 'Efectivo';
  }
}

// ─── Sincronización con `treasuryEvents` ───────────────────────────────────
//
// La idempotencia de la previsión —clave de origen, qué es intocable— vive en
// `previsionesIdempotencia.ts`, que es donde se escribe la regla una sola vez.

/**
 * Borra las previsiones VIVAS (status='predicted', sin conciliar y sin
 * descartar) del compromiso indicado. Las confirmadas/ejecutadas (realidad
 * bancaria) y las descartadas (decisión del usuario) se respetan.
 */
export async function borrarEventosFuturosCompromiso(compromisoId: number): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);
  const idx = store.index('sourceId');
  let cursor = await idx.openCursor(IDBKeyRange.only(compromisoId));
  while (cursor) {
    const ev = cursor.value as TreasuryEvent;
    if (esPrevisionDeCompromiso(ev) && !esPrevisionIntocable(ev)) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Persiste un lote de previsiones del compromiso saltándose las claves de
 * origen ya ocupadas. Se llama SIEMPRE después de
 * `borrarEventosFuturosCompromiso`: lo que ha sobrevivido al borrado es, por
 * definición, intocable, así que su periodo no se vuelve a emitir. Dedupe
 * también dentro del propio lote.
 */
async function persistirPrevisionesCompromiso(
  compromisoId: number,
  eventos: Array<Omit<TreasuryEvent, 'id'>>,
): Promise<number> {
  if (eventos.length === 0) return 0;
  const db = await initDB();
  const tx = db.transaction(STORE_TREASURY, 'readwrite');
  const store = tx.objectStore(STORE_TREASURY);

  const supervivientes = (await store.index('sourceId').getAll(compromisoId)) as TreasuryEvent[];
  const ocupadas = new Set(
    supervivientes.filter(esPrevisionDeCompromiso).map(claveOrigenPrevision),
  );

  let creados = 0;
  for (const ev of eventos) {
    const clave = claveOrigenPrevision(ev);
    if (ocupadas.has(clave)) continue;
    ocupadas.add(clave);
    await store.add(ev as TreasuryEvent);
    creados += 1;
  }
  await tx.done;
  return creados;
}

/**
 * Regenera las previsiones del compromiso. Idempotente: ejecutarlo una vez o
 * cinco deja exactamente el mismo resultado. Confirmadas, conciliadas y
 * descartadas se respetan y su periodo NO se reemite.
 *
 * `desdeOverride` permite retomar la proyección desde una fecha concreta
 * (reactivación · §2.4); sin él se proyecta desde HOY.
 */
export async function regenerarEventosCompromiso(
  compromiso: CompromisoRecurrente,
  hasta?: Date,
  desdeOverride?: Date,
): Promise<number> {
  if (!compromiso.id) {
    throw new Error('regenerarEventosCompromiso requiere compromiso.id');
  }
  await borrarEventosFuturosCompromiso(compromiso.id);
  const tarjeta = await tarjetaDelCompromiso(compromiso);
  const eventos = generarEventosDesdeCompromiso(compromiso, hasta, desdeOverride, tarjeta);
  const propios = await persistirPrevisionesCompromiso(compromiso.id, eventos);

  // Si paga con crédito aplazado no ha emitido nada suyo: su dinero sale en el
  // RECIBO de la tarjeta, que hay que rehacer entero porque cruza otros gastos.
  // Sin esta llamada el gasto desaparecería de las previsiones sin avisar.
  if (vaEnRecibo(compromiso, tarjeta)) {
    return propios + (await regenerarRecibosDeTarjeta(hasta));
  }
  return propios;
}

/**
 * Rehace los RECIBOS de tarjeta previstos · uno por (tarjeta · corte).
 *
 * Cruza todos los gastos que pagan con cada tarjeta, porque eso es un recibo:
 * el banco no carga la compra, la gasolina y la farmacia por separado, carga
 * una sola vez con la suma. Idempotente — se recalcula entero cada vez— y
 * respeta lo intocable: un recibo ya confirmado o descartado no se reescribe.
 */
export async function regenerarRecibosDeTarjeta(hasta?: Date): Promise<number> {
  const [compromisos, tarjetas] = await Promise.all([
    listarCompromisos({ soloActivos: true }),
    listarTarjetas(),
  ]);

  const { desde, hasta: tope } = ventanaDeRecibos(hasta, HORIZONTE_MESES_DEFECTO);
  const recibos = recibosPrevistos(compromisos, tarjetas, desde, tope);
  const ahora = new Date().toISOString();
  return persistirRecibos(recibos.map((r) => eventoDeRecibo(r, tarjetas, ahora)));
}



/**
 * Regenera eventos para todos los compromisos activos. Útil tras cambios de
 * configuración global (ej. ampliación del horizonte).
 */
export async function regenerarTodosLosEventos(
  hasta?: Date,
): Promise<{ compromisos: number; eventos: number }> {
  const compromisos = await listarCompromisos({ soloActivos: true });
  let total = 0;
  for (const c of compromisos) {
    total += await regenerarEventosCompromiso(c, hasta);
  }
  return { compromisos: compromisos.length, eventos: total };
}

// ─── Re-exports útiles ─────────────────────────────────────────────────────

export { expandirPatron, calcularImporte, aplicarVariacion } from './patronCalendario';
export type { PatronRecurrente, ImporteEvento };
