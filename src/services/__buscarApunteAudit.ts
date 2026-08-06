// ============================================================================
// ¿DÓNDE VIVE ESTE APUNTE Y POR QUÉ ESTÁ DUPLICADO? · utilidad de diagnóstico
// ============================================================================
//
// Prefijo `__` indica herramienta de desarrollo · NO importar desde código de
// producción. Consumidor legítimo: la consola del navegador (se cuelga de
// `window.atlasDiagnostico`, igual que `duplicadosPrevisionService`).
//
// POR QUÉ HACE FALTA OTRA HERRAMIENTA, habiendo ya dos de duplicados
// ------------------------------------------------------------------
// `duplicadosPrevisionService` y `__previsionesDuplicadasAudit` buscan LA MISMA
// PREVISIÓN EMITIDA DOS VECES: agrupan por clave de origen
// (`sourceType` + `sourceId` + periodo + cuenta). Eso encuentra al motor que
// reemite, y sólo a él.
//
// Hay un duplicado que, POR CONSTRUCCIÓN, esas dos herramientas no pueden ver:
// el que nace de DOS ORÍGENES DISTINTOS. Si el mismo seguro está dado de alta
// dos veces (dos filas en `compromisosRecurrentes`), cada una emite UNA
// previsión por mes — impecable cada una por separado. Las claves de origen son
// distintas porque el `sourceId` es distinto, así que los dos informes dicen
// «0 duplicados» mientras el dinero se cuenta dos veces. Es exactamente el caso
// de «lo veo repetido pero no me cuadra nada».
//
// Y hay un segundo agujero: un apunte puede EXISTIR y no pintarse en ninguna
// pantalla. Tres formas, todas reales en este código:
//
//   1. Está en otro ámbito. Un seguro de vida dado de alta desde la pestaña de
//      un inmueble se guarda en PERSONAL cuando no va con la hipoteca
//      (`ListadoGastosRecurrentes` · `forzarPersonal`). Quien lo creó mirando el
//      inmueble no lo vuelve a ver ahí: `DetallePage` filtra por
//      `ambito:'inmueble'`. Sólo hubo un toast.
//   2. Está dentro del recibo de una tarjeta. Un gasto que paga con crédito
//      aplazado NO emite cargo propio: su dinero sale sumado en un evento
//      `tarjeta_recibo` que se lee «Recibo tarjeta X». El concepto del gasto no
//      aparece por ningún lado, así que buscarlo por su nombre no lo encuentra.
//   3. Es un huérfano. Sus eventos confirmados/conciliados sobreviven al borrado
//      del gasto (`borrarEventosFuturosCompromiso` sólo retira las previsiones
//      VIVAS · lo intocable se respeta a propósito). El gasto ya no está en
//      ninguna lista, pero sus eventos siguen sumando en tesorería y en cierres.
//
// Esta utilidad SÓLO LEE. No borra nada, ni propone borrar: primero hay que
// saber qué hay y por qué está. La limpieza ya tiene sus vías, y cada una de
// las tres causas de arriba se arregla en un sitio distinto.
// ============================================================================

import { initDB } from './db';
import type { GastoInmueble, Movement, TreasuryEvent } from './db';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';

// ─── Tipos del informe ─────────────────────────────────────────────────────

/** En qué store vive el apunte encontrado. */
export type StoreApunte =
  | 'compromisosRecurrentes'
  | 'treasuryEvents'
  | 'movements'
  | 'gastosInmueble';

export interface ApunteEncontrado {
  store: StoreApunte;
  id: number;
  /** Lo que se lee del registro · alias, descripción o concepto del banco. */
  texto: string;
  importe: number | null;
  fecha: string | null;
  cuentaId: number | null;
  /**
   * Dónde se ve en la aplicación · `null` cuando NO se ve en ninguna pantalla.
   * Es la respuesta a «¿por qué no lo encuentro?».
   */
  pantalla: string | null;
  /** Por qué se ve ahí, o por qué no se ve en ninguna parte. */
  porQue: string;
}

export interface GastoRepetido {
  /** Qué tienen en común · alias normalizado + importe + calendario. */
  clave: string;
  /** Las filas de `compromisosRecurrentes` que son el mismo gasto. */
  ids: number[];
  alias: string[];
  /** Ámbito de cada fila · si difieren, una de ellas está en otra pantalla. */
  ambitos: string[];
  estados: string[];
  cuentas: Array<number | null>;
  importeMensual: number | null;
  /** Cuántas previsiones vivas emite cada fila · lo que se cuenta dos veces. */
  previsionesPorId: Record<number, number>;
}

export interface CargoCruzado {
  periodo: string;
  cuentaId: number | null;
  importe: number;
  /** Los orígenes distintos que cargan lo mismo el mismo mes. */
  origenes: Array<{ id: number; sourceType: string; sourceId: string; descripcion: string }>;
}

export interface EventoHuerfano {
  id: number;
  sourceId: string;
  descripcion: string;
  importe: number;
  fecha: string;
  status: string;
  /** Por qué sobrevivió al borrado de su gasto. */
  motivo: string;
}

/** Qué le pasa a una línea fiscal materializada de más. */
export type AnomaliaFiscal =
  /** `fecha` que no existe en el calendario · 31 de febrero y compañía. */
  | 'fecha_imposible'
  /** Ejercicio muy por delante del actual · lo materializó una proyección. */
  | 'ejercicio_futuro'
  /** Otra línea con el mismo inmueble, ejercicio, concepto e importe. */
  | 'duplicado_exacto';

export interface LineaFiscalAnomala {
  id: number;
  inmuebleId: number;
  ejercicio: number;
  fecha: string;
  concepto: string;
  importe: number;
  origen: string;
  anomalias: AnomaliaFiscal[];
}

export interface ResumenFiscal {
  total: number;
  fechasImposibles: number;
  ejerciciosFuturos: number;
  duplicadosExactos: number;
  /** Ejercicio más lejano encontrado · delata el horizonte de la proyección. */
  ejercicioMaximo: number | null;
  /** Cuántas líneas hay por ejercicio · ordenado por año. */
  porEjercicio: Array<{ ejercicio: number; lineas: number }>;
  muestra: LineaFiscalAnomala[];
}

export interface InformeApunte {
  termino: string;
  encontrados: ApunteEncontrado[];
  gastosRepetidos: GastoRepetido[];
  cargosCruzados: CargoCruzado[];
  huerfanos: EventoHuerfano[];
  fiscal: ResumenFiscal;
}

// ─── Normalización ─────────────────────────────────────────────────────────

/**
 * Texto comparable: sin acentos, sin mayúsculas, sin dobles espacios.
 *
 * Se normaliza para BUSCAR y para AGRUPAR, no para mostrar: lo que se enseña es
 * siempre el texto tal cual lo escribió el usuario o el banco, que es lo que él
 * va a reconocer en la pantalla.
 */
function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Alguno de estos textos contiene el término buscado? */
function coincide(termino: string, ...textos: Array<string | undefined | null>): boolean {
  const t = normalizar(termino);
  if (!t) return false;
  return textos.some((x) => normalizar(x ?? '').includes(t));
}

function céntimos(n: number): number {
  return Math.round(Math.abs(n ?? 0) * 100);
}

// ─── Dónde se ve cada cosa ─────────────────────────────────────────────────

/**
 * En qué pantalla se pinta un gasto · `null` si en ninguna.
 *
 * Es el mapa que falta cuando alguien dice «no lo veo»: la lista de gastos de
 * un inmueble (`DetallePage`) filtra por `ambito:'inmueble'` + `inmuebleId`, y
 * la de personal por `ambito:'personal'`. Un gasto no está escondido: está en
 * la OTRA lista.
 */
function pantallaDelGasto(c: CompromisoRecurrente): { pantalla: string | null; porQue: string } {
  const grupo =
    c.estado === 'preparado'
      ? ' › grupo «Preparados · sin activar todavía»'
      : c.estado === 'baja'
        ? ' › grupo «Dados de baja»'
        : '';

  if (c.ambito === 'inmueble') {
    if (c.inmuebleId == null) {
      return {
        pantalla: null,
        porQue:
          'ambito=inmueble pero SIN inmuebleId · la lista filtra por inmueble, ' +
          'así que no cae en ninguna. Registro inconsistente.',
      };
    }
    return {
      pantalla: `Inmuebles › inmueble ${c.inmuebleId} › Gastos${grupo}`,
      porQue: 'ambito=inmueble · se lista en la ficha de ese inmueble.',
    };
  }

  return {
    pantalla: `Personal › Gastos${grupo}`,
    porQue:
      'ambito=personal · NO aparece en la ficha de ningún inmueble. Si se dio ' +
      'de alta desde la pestaña de un inmueble, el seguro de vida no vinculado ' +
      'a la hipoteca se guarda aquí a propósito (§4) y sólo lo dijo un toast.',
  };
}

/** En qué pantalla se pinta un evento de tesorería · `null` si en ninguna. */
function pantallaDelEvento(ev: TreasuryEvent): { pantalla: string | null; porQue: string } {
  if (ev.descartado === true) {
    return {
      pantalla: null,
      porQue:
        'DESCARTADO · no sale en Pendientes, no entra en KPIs y no afecta al ' +
        'cierre. Sigue en la base para poder deshacerlo, pero no se pinta.',
    };
  }

  if (ev.sourceType === 'tarjeta_recibo') {
    return {
      pantalla: 'Tesorería › como «Recibo tarjeta …» (importe agregado)',
      porQue:
        'Es el RECIBO de una tarjeta: suma varias compras en un solo cargo. El ' +
        'gasto que lo alimenta NO aparece con su nombre, así que buscarlo por ' +
        'concepto no lo encuentra aunque su dinero esté dentro.',
    };
  }

  return {
    pantalla: 'Tesorería › Previsiones/Movimientos',
    porQue: `Evento ${ev.status} de origen ${ev.sourceType ?? '(sin origen)'}.`,
  };
}

// ─── 1 · Buscar el apunte en todas partes ──────────────────────────────────

/**
 * Barre los cuatro stores donde puede vivir un apunte y devuelve cada
 * coincidencia con su ubicación real y la pantalla que la enseña.
 *
 * Se barren los cuatro y no sólo el «obvio» porque la pregunta que contesta es
 * «no sé dónde está»: limitar la búsqueda a donde uno cree que debería estar es
 * justamente lo que ya falló.
 */
export async function buscarApunte(termino: string): Promise<ApunteEncontrado[]> {
  const db = await initDB();
  const out: ApunteEncontrado[] = [];

  const compromisos = ((await db.getAll('compromisosRecurrentes')) ?? []) as CompromisoRecurrente[];
  for (const c of compromisos) {
    if (!coincide(termino, c.alias, c.proveedor?.nombre, c.conceptoBancario, c.subtipo)) continue;
    const { pantalla, porQue } = pantallaDelGasto(c);
    out.push({
      store: 'compromisosRecurrentes',
      id: c.id as number,
      texto: c.alias,
      importe: importeMensualAprox(c),
      fecha: c.fechaInicio ?? null,
      cuentaId: c.cuentaCargo ?? null,
      pantalla,
      porQue,
    });
  }

  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];
  for (const ev of eventos) {
    if (!coincide(termino, ev.description, ev.proveedor, ev.providerName, ev.counterparty, ev.categoryLabel))
      continue;
    const { pantalla, porQue } = pantallaDelEvento(ev);
    out.push({
      store: 'treasuryEvents',
      id: ev.id as number,
      texto: ev.description,
      importe: ev.amount ?? null,
      fecha: ev.predictedDate ?? null,
      cuentaId: ev.accountId ?? null,
      pantalla,
      porQue,
    });
  }

  const movimientos = ((await db.getAll('movements')) ?? []) as Movement[];
  for (const m of movimientos) {
    if (!coincide(termino, m.description, m.counterparty, m.providerName)) continue;
    out.push({
      store: 'movements',
      id: m.id as number,
      texto: m.description ?? '',
      importe: m.amount ?? null,
      fecha: m.date ?? null,
      cuentaId: m.accountId ?? null,
      pantalla: 'Tesorería › Movimientos de la cuenta',
      porQue:
        'Es un cargo REAL del banco. Si aparece dos veces aquí, el duplicado ' +
        'es de importación (dos extractos solapados), no del motor de ' +
        'previsiones.',
    });
  }

  const gastos = ((await db.getAll('gastosInmueble')) ?? []) as GastoInmueble[];
  for (const g of gastos) {
    if (!coincide(termino, g.concepto, g.proveedorNombre, g.categoryKey, g.subtypeKey)) continue;
    out.push({
      store: 'gastosInmueble',
      id: g.id as number,
      texto: g.concepto || g.proveedorNombre || '',
      importe: g.importe ?? null,
      fecha: g.fecha ?? null,
      cuentaId: null,
      pantalla: 'Inmuebles › ficha › Gastos reales / Fiscalidad',
      porQue:
        'Gasto real de un inmueble (store distinto de los compromisos). Un ' +
        'seguro de vida NO debería estar aquí si no va con la hipoteca.',
    });
  }

  return out;
}

/**
 * Importe mensual aproximado de un gasto · sólo para poder AGRUPAR y comparar.
 *
 * Deliberadamente tosco: no sustituye a `importeCompromisoEnFecha` (la fuente
 * única del cálculo). Aquí sólo hace falta un número estable con el que decidir
 * si dos filas son el mismo gasto, y para eso el modo fijo/medio basta. Cuando
 * no se puede saber devuelve `null` y la agrupación no lo usa — nunca 0, que
 * haría parecer iguales a dos gastos que no lo son.
 */
function importeMensualAprox(c: CompromisoRecurrente): number | null {
  const imp = c.importe as unknown as Record<string, unknown> | undefined;
  if (!imp) return null;
  if (imp.modo === 'fijo') return (imp.importe as number) ?? null;
  if (imp.modo === 'variable') return (imp.importeMedio as number) ?? null;
  if (imp.modo === 'porTramos') {
    const tramos = (imp.tramos as Array<{ desde: string; importe: number }>) ?? [];
    return tramos.length > 0 ? tramos[tramos.length - 1].importe : null;
  }
  return null;
}

// ─── 2 · El duplicado que los otros informes no ven ────────────────────────

/**
 * Gastos dados de alta DOS VECES · el punto ciego de las auditorías existentes.
 *
 * Dos filas distintas de `compromisosRecurrentes` son dos orígenes distintos,
 * así que sus previsiones tienen claves de origen distintas y ninguna de las
 * dos auditorías de duplicados las mira siquiera. Cada previsión es correcta;
 * lo que está duplicado es el ALTA.
 *
 * Cómo pasa esto sin que nadie lo note:
 *
 *   - `crearCompromiso` NO comprueba duplicados. `puedeCrearCompromiso` sólo
 *     valida ámbito, FK y categoría: crear dos veces el mismo seguro es
 *     perfectamente legal para el modelo.
 *   - El alta manual nace con `conceptoBancario: ''`. El detector automático
 *     (`compromisoCreationService.isDuplicateOfExisting`) deduplica comparando
 *     TOKENS del concepto bancario, y contra una cadena vacía no hay tokens que
 *     comparar: devuelve «no es duplicado». Así que al importar el extracto y
 *     detectar el recibo recurrente, se crea un SEGUNDO gasto para algo que ya
 *     estaba dado de alta a mano.
 *
 * La agrupación es por alias normalizado + importe + calendario, no por
 * `conceptoBancario`, precisamente porque el concepto vacío es la causa del
 * problema y agrupar por él volvería a no encontrar nada.
 */
export async function gastosRepetidos(): Promise<GastoRepetido[]> {
  const db = await initDB();
  const compromisos = ((await db.getAll('compromisosRecurrentes')) ?? []) as CompromisoRecurrente[];
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  // Cuántas previsiones vivas emite cada gasto · es la medida de cuánto se está
  // contando de más, y sale de los eventos, no de la teoría.
  const previsiones = new Map<number, number>();
  for (const ev of eventos) {
    if (ev.sourceType !== 'gasto_recurrente' && ev.sourceType !== 'opex_rule') continue;
    if (ev.descartado === true) continue;
    const sid = Number(ev.sourceId);
    if (!Number.isFinite(sid)) continue;
    previsiones.set(sid, (previsiones.get(sid) ?? 0) + 1);
  }

  const porClave = new Map<string, CompromisoRecurrente[]>();
  for (const c of compromisos) {
    if (c.id == null) continue;
    // Los dados de baja no se agrupan: una baja y un alta nueva del mismo
    // seguro es una SUSTITUCIÓN legítima (cambio de compañía), no un duplicado.
    if (c.estado === 'baja') continue;
    const importe = importeMensualAprox(c);
    const clave = [
      normalizar(c.alias),
      importe != null ? céntimos(importe) : 'sin-importe',
      c.patron?.tipo ?? 'sin-patron',
    ].join('|');
    const arr = porClave.get(clave);
    if (arr) arr.push(c);
    else porClave.set(clave, [c]);
  }

  const out: GastoRepetido[] = [];
  for (const [clave, filas] of Array.from(porClave.entries())) {
    if (filas.length < 2) continue;
    const previsionesPorId: Record<number, number> = {};
    for (const f of filas) previsionesPorId[f.id as number] = previsiones.get(f.id as number) ?? 0;
    out.push({
      clave,
      ids: filas.map((f) => f.id as number),
      alias: filas.map((f) => f.alias),
      ambitos: filas.map((f) => f.ambito),
      estados: filas.map((f) => f.estado),
      cuentas: filas.map((f) => f.cuentaCargo ?? null),
      importeMensual: importeMensualAprox(filas[0]),
      previsionesPorId,
    });
  }

  return out;
}

// ─── 3 · El mismo dinero cargado por dos motores distintos ─────────────────

/**
 * Cargos del mismo importe, mismo mes y misma cuenta, emitidos por ORÍGENES
 * DISTINTOS. El otro punto ciego: las auditorías agrupan POR origen, así que un
 * duplicado entre orígenes les es invisible por definición.
 *
 * El caso que este código puede producir hoy: `actualizarCompromiso` regenera
 * el recibo de la tarjeta sólo si el gasto paga con crédito aplazado DESPUÉS
 * del cambio (`regenerarEventosCompromiso` → `vaEnRecibo(actualizado)`). Al
 * mover un gasto de tarjeta de crédito a domiciliación, el recibo viejo se
 * queda como estaba —todavía con ese importe dentro— y el gasto empieza además
 * a emitir su cargo propio. El mismo dinero, dos veces, con dos orígenes
 * distintos. `eliminarCompromiso` y `darDeBajaCompromiso` sí miran el estado
 * ANTERIOR y rehacen el recibo; `actualizarCompromiso` y `pasarAPreparado` no.
 *
 * Se comparan importes al céntimo y en valor absoluto: el signo depende del
 * motor que lo emitió y aquí lo que importa es que es la misma cantidad.
 */
export async function cargosCruzados(): Promise<CargoCruzado[]> {
  const db = await initDB();
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  const porClave = new Map<string, TreasuryEvent[]>();
  for (const ev of eventos) {
    if (ev.descartado === true) continue;
    if (ev.type !== 'expense') continue;
    const periodo = (ev.predictedDate ?? '').slice(0, 7);
    if (!periodo) continue;
    const clave = `${periodo}|${ev.accountId ?? 'sin-cuenta'}|${céntimos(ev.amount)}`;
    const arr = porClave.get(clave);
    if (arr) arr.push(ev);
    else porClave.set(clave, [ev]);
  }

  const out: CargoCruzado[] = [];
  for (const [clave, grupo] of Array.from(porClave.entries())) {
    if (grupo.length < 2) continue;
    // Sólo interesa cuando los orígenes DIFIEREN. Dos eventos del mismo origen
    // ya los cuentan las otras dos auditorías, y repetirlos aquí sería ruido
    // encima del informe que tiene que señalar lo que ellas no ven.
    const origenes = new Set(grupo.map((e) => `${e.sourceType ?? ''}|${e.sourceId ?? ''}`));
    if (origenes.size < 2) continue;

    const [periodo, cuenta] = clave.split('|');
    out.push({
      periodo,
      cuentaId: cuenta === 'sin-cuenta' ? null : Number(cuenta),
      importe: Math.abs(grupo[0].amount),
      origenes: grupo.map((e) => ({
        id: e.id as number,
        sourceType: e.sourceType ?? '(sin origen)',
        sourceId: String(e.sourceId ?? ''),
        descripcion: e.description,
      })),
    });
  }

  return out.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

// ─── 4 · Eventos cuyo gasto ya no existe ───────────────────────────────────

/**
 * Previsiones de compromiso que apuntan a un gasto BORRADO.
 *
 * No es un fallo del borrado, es su regla: `borrarEventosFuturosCompromiso`
 * retira sólo las previsiones VIVAS y respeta a propósito lo confirmado, lo
 * conciliado y lo descartado, porque eso es realidad bancaria o una decisión
 * del usuario. La consecuencia es que esos eventos quedan sin ficha que los
 * explique: no salen en ninguna lista de gastos —el gasto ya no está— pero
 * siguen contando en tesorería y en los cierres.
 *
 * Es la tercera respuesta posible a «está pero no lo veo».
 */
export async function eventosHuerfanos(): Promise<EventoHuerfano[]> {
  const db = await initDB();
  const compromisos = ((await db.getAll('compromisosRecurrentes')) ?? []) as CompromisoRecurrente[];
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  const vivos = new Set(compromisos.map((c) => Number(c.id)));
  const out: EventoHuerfano[] = [];

  for (const ev of eventos) {
    if (ev.sourceType !== 'gasto_recurrente' && ev.sourceType !== 'opex_rule') continue;
    const sid = Number(ev.sourceId);
    if (!Number.isFinite(sid) || vivos.has(sid)) continue;

    out.push({
      id: ev.id as number,
      sourceId: String(ev.sourceId ?? ''),
      descripcion: ev.description,
      importe: ev.amount,
      fecha: ev.predictedDate,
      status: ev.status,
      motivo:
        ev.executedMovementId != null
          ? 'Conciliado con un movimiento real · el borrado del gasto lo respetó.'
          : ev.status !== 'predicted'
            ? 'Confirmado · el borrado del gasto sólo retira previsiones vivas.'
            : ev.descartado === true
              ? 'Descartado por el usuario · el borrado respeta esa decisión.'
              : 'Previsión viva sin gasto que la respalde · nadie la regenera ni la retira.',
    });
  }

  return out;
}

// ─── 5 · Líneas fiscales materializadas de más ─────────────────────────────

/** ¿Existe esa fecha en el calendario? `2026-02-31` no. */
function fechaImposible(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return false;
  const [, a, mes, dia] = m;
  const d = new Date(Number(a), Number(mes) - 1, Number(dia));
  // Si el día se desborda, `Date` rueda al mes siguiente y deja de coincidir.
  return d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia);
}

/**
 * Revisa `gastosInmueble` · el store de gastos REALES de un inmueble.
 *
 * Por qué merece sección propia: `computeFiscalSummary` no sólo lee, también
 * ESCRIBE — materializa una línea por mes del ejercicio que se le pregunte
 * (`generarOperacionesDesdeRecurrentes`). El propio repo lo documenta en
 * `fiscalSummaryMemo.ts`: la proyección pide ~20 años y «cada llamada
 * materializa gastos de años futuros». El memo que se añadió evita el CUELGUE,
 * pero no retira lo que ya se escribió.
 *
 * El resultado son cientos de líneas de ejercicios que aún no existen. No se
 * ven en ninguna pantalla —lo fiscal se mira un ejercicio cada vez, y nadie
 * abre 2044— y no las encuentra ninguna de las otras secciones, que miran
 * compromisos y previsiones.
 *
 * Se marcan tres cosas distintas y NO se mezclan: una fecha imposible es un
 * fallo de construcción del dato, un ejercicio futuro es basura de proyección,
 * y un duplicado exacto es contar dos veces. Sólo lo tercero infla una suma.
 */
export async function lineasFiscalesAnomalas(): Promise<ResumenFiscal> {
  const db = await initDB();
  const gastos = ((await db.getAll('gastosInmueble')) ?? []) as GastoInmueble[];

  // El corte es «el año que viene»: una previsión del ejercicio en curso o del
  // siguiente es legítima (se declara en breve). Más allá no lo pidió nadie.
  const limite = new Date().getFullYear() + 1;

  const porFirma = new Map<string, number>();
  for (const g of gastos) {
    const f = `${g.inmuebleId}|${g.ejercicio}|${normalizar(g.concepto)}|${céntimos(g.importe)}`;
    porFirma.set(f, (porFirma.get(f) ?? 0) + 1);
  }

  const porEjercicio = new Map<number, number>();
  const anomalas: LineaFiscalAnomala[] = [];
  let fechasImposibles = 0;
  let ejerciciosFuturos = 0;
  let duplicadosExactos = 0;
  let ejercicioMaximo: number | null = null;

  for (const g of gastos) {
    porEjercicio.set(g.ejercicio, (porEjercicio.get(g.ejercicio) ?? 0) + 1);
    if (ejercicioMaximo == null || g.ejercicio > ejercicioMaximo) ejercicioMaximo = g.ejercicio;

    const anomalias: AnomaliaFiscal[] = [];
    if (fechaImposible(g.fecha)) { anomalias.push('fecha_imposible'); fechasImposibles++; }
    if (g.ejercicio > limite) { anomalias.push('ejercicio_futuro'); ejerciciosFuturos++; }

    const firma = `${g.inmuebleId}|${g.ejercicio}|${normalizar(g.concepto)}|${céntimos(g.importe)}`;
    if ((porFirma.get(firma) ?? 0) > 1) { anomalias.push('duplicado_exacto'); duplicadosExactos++; }

    if (anomalias.length > 0) {
      anomalas.push({
        id: g.id as number,
        inmuebleId: g.inmuebleId,
        ejercicio: g.ejercicio,
        fecha: g.fecha,
        concepto: g.concepto,
        importe: g.importe,
        origen: g.origen,
        anomalias,
      });
    }
  }

  return {
    total: gastos.length,
    fechasImposibles,
    ejerciciosFuturos,
    duplicadosExactos,
    ejercicioMaximo,
    porEjercicio: Array.from(porEjercicio.entries())
      .map(([ejercicio, lineas]) => ({ ejercicio, lineas }))
      .sort((a, b) => a.ejercicio - b.ejercicio),
    // Una muestra basta para diagnosticar · volcar cientos de líneas iguales
    // esconde el dato que importa, que son los recuentos.
    muestra: anomalas.slice(0, 15),
  };
}

// ─── Informe completo ──────────────────────────────────────────────────────

/** Lee los cuatro stores y responde las tres preguntas. NO escribe nada. */
export async function diagnosticarApunte(termino: string): Promise<InformeApunte> {
  const [encontrados, repetidos, cruzados, huerfanos, fiscal] = await Promise.all([
    buscarApunte(termino),
    gastosRepetidos(),
    cargosCruzados(),
    eventosHuerfanos(),
    lineasFiscalesAnomalas(),
  ]);

  const t = normalizar(termino);
  // Los tres análisis globales se acotan al término buscado cuando pueden: el
  // informe tiene que contestar por ESTE apunte, no dar una auditoría entera
  // que hay que leer para encontrar la línea que importa.
  return {
    termino,
    encontrados,
    gastosRepetidos: repetidos.filter((g) => g.alias.some((a) => normalizar(a).includes(t))),
    cargosCruzados: cruzados.filter((c) =>
      c.origenes.some((o) => normalizar(o.descripcion).includes(t)),
    ),
    huerfanos: huerfanos.filter((h) => normalizar(h.descripcion).includes(t)),
    // El resumen fiscal NO se filtra por término: es una foto del store entero.
    // Lo que delata a la proyección es el VOLUMEN y hasta qué año llega, y eso
    // se pierde en cuanto se recorta a un concepto.
    fiscal,
  };
}

/** Resumen en texto plano · para pegar en un mensaje sin capturas. */
export function formatearInformeApunte(inf: InformeApunte): string {
  const eur = (n: number | null) =>
    n == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  const l: string[] = [];

  l.push(`Buscando «${inf.termino}»`);
  l.push('');

  l.push(`1 · DÓNDE ESTÁ · ${inf.encontrados.length} registro(s)`);
  if (inf.encontrados.length === 0) {
    l.push('  Nada con ese texto. Prueba con menos letras («vida», «ing»).');
  }
  for (const e of inf.encontrados) {
    l.push(`  [${e.store} #${e.id}] ${e.texto} · ${eur(e.importe)} · ${e.fecha ?? '—'}`);
    l.push(`      se ve en: ${e.pantalla ?? 'NINGUNA PANTALLA'}`);
    l.push(`      ${e.porQue}`);
  }

  l.push('');
  l.push(`2 · DADO DE ALTA DOS VECES · ${inf.gastosRepetidos.length} caso(s)`);
  if (inf.gastosRepetidos.length === 0) {
    l.push('  No hay dos gastos que sean el mismo.');
  }
  for (const g of inf.gastosRepetidos) {
    l.push(`  ${g.alias.join('  ·  ')} · ${eur(g.importeMensual)}/mes`);
    l.push(`      ids ${g.ids.join(', ')} · ámbitos ${g.ambitos.join(', ')} · estados ${g.estados.join(', ')}`);
    l.push(
      `      previsiones vivas por id: ${Object.entries(g.previsionesPorId)
        .map(([id, n]) => `#${id}→${n}`)
        .join('  ')}`,
    );
  }

  l.push('');
  l.push(`3 · MISMO CARGO POR DOS MOTORES · ${inf.cargosCruzados.length} caso(s)`);
  if (inf.cargosCruzados.length === 0) {
    l.push('  Ningún importe repetido con orígenes distintos.');
  }
  for (const c of inf.cargosCruzados) {
    l.push(`  ${c.periodo} · cuenta ${c.cuentaId ?? '—'} · ${eur(c.importe)}`);
    for (const o of c.origenes) {
      l.push(`      #${o.id} ${o.sourceType}:${o.sourceId} · ${o.descripcion}`);
    }
  }

  l.push('');
  l.push(`4 · EVENTOS SIN GASTO QUE LOS EXPLIQUE · ${inf.huerfanos.length}`);
  if (inf.huerfanos.length === 0) {
    l.push('  Ninguno.');
  }
  for (const h of inf.huerfanos) {
    l.push(`  #${h.id} ${h.fecha} · ${eur(h.importe)} · ${h.status} · ${h.descripcion}`);
    l.push(`      ${h.motivo}`);
  }

  const f = inf.fiscal;
  l.push('');
  l.push(`5 · LÍNEAS FISCALES · ${f.total} en total · hasta el ejercicio ${f.ejercicioMaximo ?? '—'}`);
  l.push(`  fechas imposibles: ${f.fechasImposibles}`);
  l.push(`  ejercicios futuros (materializados por la proyección): ${f.ejerciciosFuturos}`);
  l.push(`  duplicados exactos: ${f.duplicadosExactos}`);
  if (f.porEjercicio.length > 0) {
    l.push(`  por ejercicio: ${f.porEjercicio.map((e) => `${e.ejercicio}:${e.lineas}`).join('  ')}`);
  }
  for (const m of f.muestra) {
    l.push(`  #${m.id} ${m.fecha} · ${eur(m.importe)} · inmueble ${m.inmuebleId} · ${m.concepto} · [${m.anomalias.join(', ')}]`);
  }

  return l.join('\n');
}

/**
 * Cuelga la búsqueda de la consola del navegador.
 *
 *     await atlasDiagnostico.buscar('seguro')   → informe legible · SOLO LEE
 *     await atlasDiagnostico.buscarRaw('vida')  → el objeto · SOLO LEE
 *
 * Se FUSIONA con lo que ya haya en `atlasDiagnostico` (los duplicados de
 * previsión viven ahí): sobrescribir el objeto se llevaría por delante la otra
 * herramienta.
 */
export function registrarBusquedaEnConsola(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const previo = (w.atlasDiagnostico as Record<string, unknown>) ?? {};
  w.atlasDiagnostico = {
    ...previo,
    buscar: async (termino = 'seguro') => {
      const inf = await diagnosticarApunte(termino);
      // eslint-disable-next-line no-console
      console.log(formatearInformeApunte(inf));
      return inf;
    },
    buscarRaw: diagnosticarApunte,
  };
}
