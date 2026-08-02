// ============================================================================
// Punteo unificado · adaptador de datos (Bloque 3 · P1)
// ============================================================================
//
// Convierte los registros existentes (TreasuryEvent · Movement) en ItemPunteo
// para PunteoList. Derivación pura · sin tocar los stores.
// ============================================================================

import type { TreasuryEvent, Movement } from '../db';
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
      return 'Contrato';
    case 'gasto_recurrente':
    case 'personal_expense':
    case 'opex_rule':
      return e.categoryKey?.startsWith('suministros') || e.categoryKey === 'vivienda.suministros'
        ? 'Suministro'
        : 'Recurrente';
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
    const inquilino = (corte > 0 ? desc.slice(corte + SEPARADOR.length).trim() : desc) || desc;
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
      concepto: e.proveedor,
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
      if (quien && queEs) return { concepto: quien, detalle: queEs };
    }
  }

  return { concepto: desc };
}

// ─── Eventos (previsiones) ──────────────────────────────────────────────────

export function eventoAItem(
  e: TreasuryEvent & { id: number },
  aliasInmueble?: (id: number | string) => string | undefined,
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
  const { concepto, detalle, bajoMadre } = piezasDeFila(e, aliasReal);
  return {
    key: `evt-${e.id}`,
    kind: 'evento',
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
export function previsionDeMovimiento(m: Pick<Movement, 'reference'>): number | undefined {
  const ref = String(m.reference ?? '').match(/^treasury_event:(\d+)$/);
  return ref ? Number(ref[1]) : undefined;
}

export function movimientoAItem(
  m: Movement & { id: number },
  aliasInmueble?: (id: number | string) => string | undefined,
): ItemPunteo {
  const activo =
    m.inmuebleId != null && m.inmuebleId !== ''
      ? {
          inmuebleId: m.inmuebleId,
          alias: aliasInmueble?.(m.inmuebleId),
        }
      : null;
  return {
    key: `mov-${m.id}`,
    kind: 'movimiento',
    refId: m.id,
    estado: estadoDeMovimiento(m),
    fecha: (m.date ?? '').slice(0, 10),
    concepto: m.description,
    activo,
    origen: m.type === 'Ingreso' ? 'Ingreso' : m.type === 'Transferencia' ? 'Transferencia' : 'Gasto',
    cuentaId: m.accountId ?? null,
    // §7 · el papel que respalda el cargo · solo lo real lo tiene.
    documentIds: m.documentIds?.length ? m.documentIds : undefined,
    previsionId: previsionDeMovimiento(m),
    importe: m.amount,
    categoryKey: m.categoryKey,
    subtypeKey: m.subtypeKey,
  };
}
