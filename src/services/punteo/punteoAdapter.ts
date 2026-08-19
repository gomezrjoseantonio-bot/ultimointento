// ============================================================================
// Punteo unificado · adaptador de datos (Bloque 3 · P1)
// ============================================================================
//
// Convierte los registros existentes (TreasuryEvent · Movement) en ItemPunteo
// para PunteoList. Derivación pura · sin tocar los stores.
// ============================================================================

import type { TreasuryEvent, Movement } from '../db';
import {
  getCategoryByKey,
  getSubtypeByKey,
  isTransferKey,
  TRANSFER_KEYS,
} from '../categoryCatalog';
import { esMovimientoEditable } from '../altaMovimientoService';
import { conceptoPorId } from '../conceptos/catalogoConceptos';
import {
  estadoDeEvento,
  estadoDeMovimiento,
  type ItemPunteo,
} from './punteoModel';

// ─── Etiqueta de origen (qué es la cosa) ────────────────────────────────────

export function origenDeEvento(e: Pick<TreasuryEvent, 'sourceType' | 'type' | 'categoryKey'>): string {
  switch (e.sourceType) {
    case 'prestamo':
    case 'hipoteca':
      return 'Financiación';
    case 'nomina':
    case 'otros_ingresos':
      return 'Ingreso';
    case 'contrato':
    case 'contract':
      // "Alquiler" y no "Contrato": el contrato es el papel, el alquiler es lo
      // que entra en la cuenta. Y es la palabra que ya usa la propia fila
      // ("Alquiler · el piso"), así que la cabecera del grupo no estrena
      // vocabulario para decir lo mismo.
      return 'Alquiler';
    case 'comision_gestion':
      // Gestión delegada · flujo B · lo que le pagas a la agencia por gestionar.
      return 'Comisión';
    case 'gasto_recurrente':
    case 'personal_expense':
    case 'opex_rule':
      // "Recibo" y no "Recurrente": lo que llega al banco es un recibo
      // domiciliado. "Recurrente" describe cómo lo genera ATLAS por dentro, y
      // eso no es asunto de quien lee la lista.
      return e.categoryKey?.startsWith('suministros') || e.categoryKey === 'vivienda.suministros'
        ? 'Suministro'
        : 'Recibo';
    case 'autonomo':
    case 'autonomo_ingreso':
    case 'autonomo_gasto':
    case 'autonomo_cuota':
      return 'Autónomo';
    case 'inversion_compra':
    case 'inversion_aportacion':
    case 'inversion_rendimiento':
    case 'inversion_dividendo':
    case 'inversion_liquidacion':
      return 'Inversión';
    default:
      return e.type === 'income' ? 'Ingreso' : 'Gasto';
  }
}

/**
 * Qué es un MOVIMIENTO · lo que el usuario eligió, no la dirección del dinero.
 *
 * Un gasto anotado a mano con familia "Suministro" caía en el grupo "Gasto"
 * junto a todo lo demás, mientras su propia previsión estaba en "Suministro":
 * la clasificación se guardaba en `categoryKey` y esta función nunca la
 * miraba. Dos filas de la misma cosa en dos cajones distintos.
 *
 * Se usa el mismo vocabulario que `origenDeEvento` —el `label` del catálogo es
 * literalmente "Suministro", "Comunidad", "Seguro"— para que la previsión y el
 * movimiento que la cumple caigan en el mismo sitio.
 */
export function origenDeMovimiento(
  m: Pick<Movement, 'categoryKey' | 'type'>
): string {
  if (m.type === 'Transferencia') return 'Transferencia';
  const categoria = getCategoryByKey(m.categoryKey);
  if (categoria && !isTransferKey(m.categoryKey)) {
    return DICE_OTRA_COSA_EL_EVENTO[categoria.key] ?? categoria.label;
  }
  return m.type === 'Ingreso' ? 'Ingreso' : 'Gasto';
}

/**
 * Donde los dos vocabularios no coinciden, manda el del EVENTO.
 *
 * El catálogo llama "Otros ingresos" a lo que `origenDeEvento` llama
 * "Ingreso", y con cada uno por su lado la previsión y el movimiento que la
 * cumple acababan en dos grupos distintos — que es exactamente el fallo que
 * este adaptador viene a arreglar, reapareciendo por el otro lado.
 *
 * Gana la palabra del evento porque es la que ya está en pantalla: la previsión
 * se ve antes que el movimiento que la cumple.
 */
const DICE_OTRA_COSA_EL_EVENTO: Record<string, string> = {
  otros_ingresos: 'Ingreso',
};

/**
 * Cómo se llama lo que el usuario clasificó · "Gas", "Suministro".
 *
 * El subtipo manda sobre la familia porque es lo concreto: entre "Suministro"
 * y "Gas", lo que distingue esa fila de las otras tres del mismo piso es el
 * gas. `undefined` si no eligió nada.
 */
function etiquetaDeClasificacion(
  m: Pick<Movement, 'categoryKey' | 'subtypeKey' | 'conceptoId'>
): string | undefined {
  // El concepto FINO manda: "Limpieza" y "Gestoría" colapsan las dos en la
  // categoría `servicio_inmueble`, así que sin él la fila solo diría "Servicios"
  // (F2). Detrás, el subtipo (suministros) y por último la categoría gorda.
  return (
    conceptoPorId(m.conceptoId)?.label ??
    getSubtypeByKey(m.subtypeKey)?.label ??
    getCategoryByKey(m.categoryKey)?.label ??
    undefined
  );
}

// ─── Quién cobra, cuando no viene en su campo ───────────────────────────────

/**
 * Los orígenes cuya descripción se genera como `<qué es> – <quién>`.
 *
 * Un recibo trae `proveedor` y la fila sale sola: arriba quien cobra, abajo lo
 * que es. Un préstamo o una nómina no lo traen —nadie se lo pone—, así que su
 * fila se quedaba con las dos mitades pegadas en el título y el subtítulo
 * vacío: "Cuota Hipoteca – Hipoteca Unicaja T64 4D+4I" de un tirón, mientras el
 * recibo de al lado decía "Canal Isabel ii" con "Agua" debajo. La misma
 * información, dos estructuras distintas.
 *
 * La contraparte ya está en la descripción, en la segunda mitad
 * (`treasurySyncService`): se sube al título y la primera baja al subtítulo.
 *
 * La lista es por `sourceType` y no un `split` a todo: los gastos recurrentes
 * también se generan con ese guion, pero ahí la segunda mitad es el INMUEBLE
 * —que tiene su propia marca en la fila— y subirlo al título lo diría dos
 * veces. Los contratos tampoco están aquí, pero por lo contrario: tienen su
 * propia rama unas líneas más abajo, porque además del inquilino les toca la
 * habitación.
 */
const CONTRAPARTE_TRAS_EL_GUION = new Set([
  'prestamo',
  'hipoteca',
  'nomina',
  'otros_ingresos',
  'autonomo',
  'autonomo_ingreso',
  'autonomo_gasto',
  // Los legacy se generan igual que los nuevos y hay datos vivos con este
  // tipo: dejarlos fuera partía la lista de autónomo en dos formatos.
  'autonomo_gasto_legacy',
  'autonomo_cuota',
  'inversion_compra',
  'inversion_aportacion',
  'inversion_rendimiento',
  'inversion_dividendo',
  'inversion_liquidacion',
]);

const SEPARADOR = ' – ';

/** Partículas que van en minúscula dentro de un nombre (menos si abren). */
const PARTICULAS_MINUSCULA = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'en']);

/**
 * El nombre de QUIÉN cobra o paga, en formato normal (§ modelo del apunte).
 *
 * El contrato y el banco lo traen en MAYÚSCULAS ("ALISSER REAL ESTATE") y a
 * veces con sufijo societario ("…, S.L."). Aquí se pasa a Título y se limpia el
 * sufijo, para que el mismo nombre se lea igual en Tesorería y en el Panel.
 *
 * Dos cautelas para no estropear lo que ya está bien:
 *   · si el texto YA trae minúsculas, es un nombre bien escrito y solo se le
 *     quita el sufijo;
 *   · una SIGLA corta de una sola palabra (IBI, ING, BBVA) se deja como está —
 *     no es un nombre que pase a Título.
 */
export function normalizarNombre(raw: string | undefined): string {
  const base = (raw ?? '').trim();
  if (!base) return base;
  // Sufijo societario al final: "…, S.L." · "… S.A.U." · "… S.L.U."
  const sinSufijo =
    base
      .replace(/[,\s]+S\.?\s*[LA]\.?\s*(U\.?)?\s*$/i, '')
      .replace(/[,;\s]+$/, '')
      .trim() || base;
  // Ya bien escrito · no se retoca (solo el sufijo).
  if (/[a-záéíóúñ]/.test(sinSufijo)) return sinSufijo;
  // Sigla corta de una palabra → se respeta.
  if (!sinSufijo.includes(' ') && sinSufijo.length < 5) return sinSufijo;
  return sinSufijo
    .toLowerCase()
    .split(/\s+/)
    .map((palabra, i) =>
      i > 0 && PARTICULAS_MINUSCULA.has(palabra)
        ? palabra
        : palabra.charAt(0).toUpperCase() + palabra.slice(1),
    )
    .join(' ');
}

/**
 * "Hab 2" a partir de lo que traiga el contrato.
 *
 * El `habitacionId` real es `"hab-2"`, así que anteponerle "Hab " daba
 * "Hab hab-2". Si dentro hay un número, ese es el nombre de la habitación; si
 * no lo hay, se respeta el texto tal cual, que algo dirá.
 */
export function etiquetaHabitacion(unidad?: string): string | undefined {
  if (!unidad) return undefined;
  const numero = unidad.match(/(\d+)/);
  return numero ? `Hab ${numero[1]}` : unidad;
}


/** Resuelve el nombre de una cuenta · para decir a dónde va un traspaso. */
export type AliasCuenta = (id: number) => string | undefined;

/**
 * Una TRANSFERENCIA dice si es interna o externa · no son lo mismo.
 *
 * Externa, el dinero se va a un tercero y es un gasto como cualquier otro.
 * Interna, el dinero NO se va: cambia de cuenta, y por eso se escribe en dos
 * patas espejo y no cuenta ni como ingreso ni como gasto. Sin decirlo en la
 * fila, las dos se leen igual —"Traspaso a ahorro, −2.000 €"— y la interna
 * parece dinero perdido.
 *
 * La dirección la dice su `categoryKey` (`traspaso_salida`/`traspaso_entrada`)
 * y la otra cuenta viaja en `transferMetadata.targetAccountId`, que en la pata
 * de entrada guarda la de ORIGEN: en las dos es "la otra".
 */
function piezasDeTransferencia(
  r: {
    categoryKey?: string;
    description?: string;
    transferMetadata?: { targetAccountId: number };
  },
  aliasCuenta?: AliasCuenta
): { concepto: string; detalle: string } | undefined {
  if (!isTransferKey(r.categoryKey)) return undefined;
  const sale = r.categoryKey === TRANSFER_KEYS.SALIDA;
  const otra = r.transferMetadata?.targetAccountId;
  const nombre = otra != null ? aliasCuenta?.(otra) : undefined;
  // El "· salida"/"· entrada" que `createTransfer` pega a la descripción sobra
  // en el título: la dirección la dice el subtítulo, y con nombre de cuenta.
  const concepto = (r.description ?? '').replace(/ · (salida|entrada)$/, '');
  const direccion = nombre ? (sale ? `a ${nombre}` : `desde ${nombre}`) : sale ? 'salida' : 'entrada';
  return { concepto: concepto || 'Transferencia interna', detalle: `Transferencia interna · ${direccion}` };
}

export function piezasDeFila(
  e: Pick<TreasuryEvent, 'proveedor' | 'description' | 'sourceType' | 'unidadInmueble'>,
  alias?: string
): {
  concepto: string;
  detalle?: string;
  bajoMadre?: { concepto: string; detalle?: string };
} {
  /**
   * Un ARRENDAMIENTO · SIEMPRE se dice que es un alquiler y de qué piso.
   *
   * Da igual que sea piso completo o habitación: arriba "Alquiler · el piso" y
   * debajo quién paga. Con el nombre del inquilino de titular la fila no decía
   * ni que aquello fuera un alquiler, y sin el piso no se sabe de cuál de ellos
   * entra el dinero — que es justo lo que se mira. La habitación acompaña al
   * inquilino en el subtítulo: es lo que distingue esa renta de las otras del
   * mismo piso.
   *
   * `bajoMadre` es esta MISMA fila cuando cuelga de su piso. Ahí lo encabeza la
   * madre, y repetir el piso en cada habitación es escribirlo cuatro veces, así
   * que la hija se queda con lo suyo. Cuál de las dos formas se pinta no se
   * puede saber aquí —depende de cuántas rentas del piso caigan en la lista—,
   * así que viajan las dos.
   */
  if (e.sourceType === 'contrato' || e.sourceType === 'contract') {
    const desc = e.description ?? '';
    const corte = desc.lastIndexOf(SEPARADOR);
    const inquilino =
      normalizarNombre((corte > 0 ? desc.slice(corte + SEPARADOR.length).trim() : desc) || desc);
    const habitacion = etiquetaHabitacion(e.unidadInmueble);
    const titulo = alias ? `Alquiler \u00b7 ${alias}` : 'Alquiler';
    if (habitacion) {
      return {
        concepto: titulo,
        detalle: `${inquilino} \u00b7 ${habitacion}`,
        bajoMadre: { concepto: inquilino, detalle: habitacion },
      };
    }
    return { concepto: titulo, detalle: inquilino };
  }

  // §6.3 · manda QUIEN COBRA, que es lo que aparecerá en el extracto y con lo
  // que el lector compara teniendo el móvil del banco delante. La categoría de
  // ATLAS ("Seguro hogar") baja al subtítulo: es la traducción, no el hecho.
  if (e.proveedor) {
    return {
      concepto: normalizarNombre(e.proveedor),
      detalle: e.description !== e.proveedor ? e.description : undefined,
    };
  }

  const desc = e.description ?? '';
  if (e.sourceType && CONTRAPARTE_TRAS_EL_GUION.has(e.sourceType)) {
    // El ÚLTIMO guion, no el primero: un nombre de préstamo puede llevar uno
    // dentro y partir por el primero dejaría la mitad del nombre en el
    // subtítulo.
    const corte = desc.lastIndexOf(SEPARADOR);
    if (corte > 0) {
      const quien = desc.slice(corte + SEPARADOR.length).trim();
      const queEs = desc.slice(0, corte).trim();
      if (quien && queEs) return { concepto: normalizarNombre(quien), detalle: queEs };
    }
  }

  return { concepto: desc };
}

// ─── Eventos (previsiones) ──────────────────────────────────────────────────

export function eventoAItem(
  e: TreasuryEvent & { id: number },
  aliasInmueble?: (id: number | string) => string | undefined,
  aliasCuenta?: AliasCuenta,
): ItemPunteo {
  const mag = Math.abs(e.actualAmount ?? e.amount);
  const importe = e.type === 'income' ? mag : -mag;
  // §2.2 · ningún identificador interno visible. Aquí se caía en
  // `Inmueble ${id}` cuando el alias no se resolvía, y eso pintaba "Inmueble 2"
  // en la fila: un número de fila de base de datos que al lector no le dice
  // NADA —y menos aún cuál de sus dos seguros es—. Si el nombre real no está,
  // se deja sin alias y la fila no pinta subtítulo: mejor nada que ruido.
  const aliasReal = e.inmuebleAlias ?? aliasInmueble?.(e.inmuebleId ?? -1);
  const activo =
    e.inmuebleId != null ? { inmuebleId: e.inmuebleId, alias: aliasReal } : null;
  // Un traspaso se lee por su dirección, no por su descripción: va antes que
  // el resto de reglas porque su texto ("Traspaso a ahorro · salida") no dice
  // lo que hace falta saber.
  const traspaso = piezasDeTransferencia(e, aliasCuenta);
  const { concepto, detalle, bajoMadre } = traspaso
    ? { ...traspaso, bajoMadre: undefined }
    : piezasDeFila(e, aliasReal);
  return {
    key: `evt-${e.id}`,
    kind: 'evento',
    // Una previsión siempre se corrige: aún no ha pasado nada.
    editable: true,
    traspaso: traspasoDeLaFila(e, e.id),
    refId: e.id,
    estado: estadoDeEvento(e),
    fecha: (e.predictedDate ?? '').slice(0, 10),
    // Arriba quien cobra · abajo lo que es (`piezasDeFila`).
    concepto,
    detalle,
    bajoMadre,
    activo,
    origen: origenDeEvento(e),
    cuentaId: e.accountId ?? null,
    importe,
    // §6.3 · las habitaciones cuelgan de SU PISO.
    //
    // Agrupaba por contrato, y en alquiler por habitaciones cada habitación
    // tiene el suyo: cada grupo se quedaba con una sola fila, `agruparHijas`
    // exige más de una para formar madre, y las rentas salían planas, una
    // detrás de otra, sin que se viera de qué piso era cada una.
    //
    // El piso es lo que las junta. Y no hace falta preguntar si el inmueble se
    // alquila por habitaciones: si solo hay una renta —piso completo— el grupo
    // se queda con una hija y `agruparHijas` lo descarta solo.
    grupoId:
      e.sourceType === 'contrato' || e.sourceType === 'contract'
        ? e.inmuebleId != null
          ? `inmueble-${e.inmuebleId}`
          : e.contratoId != null
            ? `contrato-${e.contratoId}`
            : undefined
        : undefined,
    categoryKey: e.categoryKey,
    subtypeKey: e.subtypeKey,
  };
}

// ─── Movimientos (realidad) ─────────────────────────────────────────────────

/**
 * De qué previsión nació este movimiento · `undefined` si no nació de ninguna.
 *
 * `confirmTreasuryEvent` deja la huella en `reference` (`treasury_event:{id}`) y
 * es la MISMA por la que `revertTreasuryConfirmation` encuentra el evento al
 * deshacer. Sin ella, deshacer no devuelve nada a "Por confirmar": borra el
 * movimiento y ya está. Por eso la huella se lee aquí y viaja hasta la fila —
 * es lo que decide si el círculo se pinta como interruptor o como marca.
 */
/**
 * El traspaso ENTERO al que pertenece esta pata · `undefined` si no lo es.
 *
 * `targetAccountId` guarda "la otra cuenta", que es el DESTINO en la salida y
 * el ORIGEN en la entrada. Resolverlo aquí evita que cada pantalla vuelva a
 * hacer el mismo razonamiento —y lo haga al revés desde la pata de entrada.
 */
function traspasoDeLaFila(
  r: { categoryKey?: string; accountId?: number; transferMetadata?: { targetAccountId: number } },
  eventId?: number
): { eventId: number; origenId: number; destinoId: number } | undefined {
  if (eventId == null || !isTransferKey(r.categoryKey)) return undefined;
  const propia = r.accountId;
  const otra = r.transferMetadata?.targetAccountId;
  if (propia == null || otra == null) return undefined;
  const sale = r.categoryKey === TRANSFER_KEYS.SALIDA;
  return {
    eventId,
    origenId: sale ? propia : otra,
    destinoId: sale ? otra : propia,
  };
}

export function previsionDeMovimiento(m: Pick<Movement, 'reference'>): number | undefined {
  const ref = String(m.reference ?? '').match(/^treasury_event:(\d+)$/);
  return ref ? Number(ref[1]) : undefined;
}

/**
 * ¿Este movimiento es una renta?
 *
 * Al confirmar, el movimiento se queda con la descripción del evento pero NO
 * con su `sourceType`, así que hay que reconocerlo por lo que sí conserva. Los
 * dos generadores de rentas dejan huella distinta —uno pone `categoryKey`
 * 'alquiler', el otro solo la descripción "Renta – inquilino"—, y se miran las
 * tres para no depender de cuál lo creó.
 */
function pareceRenta(m: Pick<Movement, 'categoryKey' | 'category' | 'description'>): boolean {
  if (m.categoryKey === 'alquiler') return true;
  if (m.category?.tipo === 'Alquiler') return true;
  return /^renta\b/i.test((m.description ?? '').trim());
}

/**
 * Las piezas de la fila de un MOVIMIENTO · las mismas reglas que las de una
 * previsión, porque es el mismo cargo un día después.
 *
 * Sin esto, un alquiler punteado volvía a salir como "Renta – ALISSER REAL
 * ESTATE" de un tirón mientras el previsto de al lado decía "Alquiler · el
 * piso" con el inquilino debajo: el mismo dato con dos formas según si ya
 * había pasado o no.
 *
 * La descripción generada por ATLAS es `<qué es> – <quién>` para todo lo que no
 * trae proveedor, así que se reutiliza `piezasDeFila` prestándole el
 * `sourceType` que corresponde: el de contrato para las rentas y uno cualquiera
 * de los que parten por el guion para el resto.
 */
function piezasDeMovimiento(
  m: Pick<
    Movement,
    | 'categoryKey'
    | 'subtypeKey'
    | 'conceptoId'
    | 'category'
    | 'description'
    | 'providerName'
    | 'type'
    | 'transferMetadata'
    | 'paymentMethod'
    | 'counterparty'
  >,
  alias?: string,
  aliasCuenta?: AliasCuenta
): { concepto: string; detalle?: string } {
  const traspaso = piezasDeTransferencia(m, aliasCuenta);
  if (traspaso) return traspaso;

  // §9 · la clasificación del usuario se enseña SIEMPRE que exista, en el
  // subtítulo · también en Bizums, transferencias externas y líneas con nombre
  // de pagador. Antes se descartaba en esos casos (Bizum/externa salían antes; y
  // con proveedor se ponía a `undefined`) y por eso "definías y no lo veías"
  // (P6). El título sigue siendo el texto del banco; el subtítulo, tu familia.
  const clasificacion = etiquetaDeClasificacion(m);

  // §Bizum · arriba QUIÉN, abajo qué es · la misma regla que un recibo.
  //
  // El texto del banco es "BIZUM DE ADNAN PARWEZ" de un tirón: con él de título
  // la fila grita la forma de pago y esconde a la persona, que es lo único que
  // permite reconocer el cobro. Sin nombre leído se deja el texto tal cual, que
  // algo dice. El subtítulo enseña tu clasificación si la hay; si no, "Bizum".
  if (m.paymentMethod === 'Bizum') {
    const quien = m.counterparty ? normalizarNombre(m.counterparty) : (m.description ?? 'Bizum');
    return { concepto: quien, detalle: clasificacion ?? 'Bizum' };
  }
  // Externa · el dinero SÍ se va, y decirlo evita que se confunda con la
  // interna, que se lee igual de lejos y no significa lo mismo. Tu clasificación
  // manda en el subtítulo cuando existe.
  if (m.type === 'Transferencia') {
    return { concepto: m.description ?? '', detalle: clasificacion ?? 'Transferencia externa' };
  }
  // §6.3 · sin nombre de pagador, la clasificación es lo único que hay: titula;
  // y si además hay concepto escrito, baja al subtítulo (el sitio de la
  // traducción de ATLAS).
  if (clasificacion && !m.providerName) {
    // Escribir "Gas" de concepto y elegir la familia Gas es lo normal, y
    // entonces la fila decía "Gas · Gas". Repetir la misma palabra no añade
    // nada: se deja una sola vez.
    const repetido = m.description?.trim().toLowerCase() === clasificacion.toLowerCase();
    return m.description
      ? { concepto: m.description, detalle: repetido ? undefined : clasificacion }
      : { concepto: clasificacion, detalle: undefined };
  }

  const { concepto, detalle } = piezasDeFila(
    {
      sourceType: pareceRenta(m) ? 'contrato' : 'prestamo',
      description: m.description,
      proveedor: m.providerName,
    },
    alias
  );
  // Con nombre de pagador el título sale del recibo (proveedor); tu
  // clasificación, si la hay, baja al subtítulo en vez de perderse (P6).
  return { concepto, detalle: clasificacion ?? detalle };
}

export function movimientoAItem(
  m: Movement & { id: number },
  aliasInmueble?: (id: number | string) => string | undefined,
  aliasCuenta?: AliasCuenta,
): ItemPunteo {
  const alias = m.inmuebleId != null && m.inmuebleId !== '' ? aliasInmueble?.(m.inmuebleId) : undefined;
  const activo =
    m.inmuebleId != null && m.inmuebleId !== '' ? { inmuebleId: m.inmuebleId, alias } : null;
  const { concepto, detalle } = piezasDeMovimiento(m, alias, aliasCuenta);
  const traspasoMov = traspasoDeLaFila(m, previsionDeMovimiento(m));
  return {
    key: `mov-${m.id}`,
    kind: 'movimiento',
    refId: m.id,
    estado: estadoDeMovimiento(m),
    fecha: (m.date ?? '').slice(0, 10),
    concepto,
    detalle,
    activo,
    origen: origenDeMovimiento(m),
    editable: esMovimientoEditable(m) || traspasoMov != null,
    traspaso: traspasoMov,
    cuentaId: m.accountId ?? null,
    // §7 · el papel que respalda el cargo · solo lo real lo tiene.
    documentIds: m.documentIds?.length ? m.documentIds : undefined,
    tarjetaId: m.tarjetaId,
    previsionId: previsionDeMovimiento(m),
    importe: m.amount,
    categoryKey: m.categoryKey,
    subtypeKey: m.subtypeKey,
    conceptoId: m.conceptoId,
  };
}
