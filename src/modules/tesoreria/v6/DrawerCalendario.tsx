// ============================================================================
// Tesorería V6 · §4.9 · drawer · calendario diario
// ============================================================================
//
// Navegación ‹ › entre meses SIN CERRAR: la pregunta que responde esta pantalla
// es "¿qué días de este mes se me tuercen?", y contestarla obliga a saltar de
// mes sin perder el sitio.
//
// El punto ámbar marca los días que dejan una cuenta corta. No sale del neto
// del día: un día con neto positivo puede dejar una cuenta en rojo si el
// ingreso entra en una cuenta y el cargo sale de otra. Se calcula por cuenta,
// arrastrando saldo (`calendarioDias`).
//
// **En el día NO se concilia** (§4.9). Conciliar es por cuenta y por fichero,
// en §4.7. Aquí solo se confirma, se edita y se descarta — el mismo vocabulario
// de punteo que en §4.4, y por eso la lista del día es `PunteoList` y no una
// lista propia: el modelo `previsto/confirmado/conciliado` es el mismo en las
// cuatro vistas y no se duplica.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import PunteoList from '../../shared/components/Punteo/PunteoList';
import { eventoAItem, movimientoAItem } from '../../../services/punteo/punteoAdapter';
import { compararEnDia, type ItemPunteo } from '../../../services/punteo/punteoModel';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { esPendiente } from '../../../services/tesoreriaV6Metrics';
import { construirDias, resumirMes, huecosIniciales, saldoAlEmpezarElDia } from './calendarioDias';
import { colorDeBanco } from './bancoColores';
import { mesMinimo, puedeRetroceder } from './limiteMeses';
import { importeConSigno, importeSaldo, nombreMes, diaSemanaYNumero } from './formatoV6';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { valoresDesdeItem } from './fichaDesdeItem';
import chasis from './DrawerV6.module.css';
import styles from './DrawerCalendario.module.css';

// §8 · las cabeceras van en formato largo. "L M X J V S D" obliga a
// descifrarlas —la X de miércoles no es evidente— y no ahorra nada: el ancho
// de la columna lo fija la celda, no el rótulo.
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export interface DrawerCalendarioProps {
  abierto: boolean;
  year: number;
  month0: number;
  /** Cambia el mes sin cerrar el drawer (§4.9). */
  onMes: (year: number, month0: number) => void;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  cuentas: Account[];
  saldoPorCuenta: Map<number, number>;
  saldoTotalHoy: number;
  hoy: string;
  aliasInmueble?: (id: number | string) => string | undefined;
  onCerrar: () => void;
  onConfirmar: (item: ItemPunteo) => void | Promise<void>;
  onDescartar: (item: ItemPunteo) => void | Promise<void>;
  /**
   * §4.5 · guardar desde la ficha que abre el lápiz.
   *
   * El lápiz existía en la fila desde el principio —`rowVariant: 'tesoreria'`
   * lo pinta— pero el drawer declaraba `onEditar` y NADIE se lo pasaba, así que
   * no había botón: el mismo hueco que tenía `aliasInmueble`. Ahora la ficha
   * vive aquí, igual que en §4.4, y el guardado sube a la pantalla.
   */
  onGuardarFicha?: (item: ItemPunteo | null, valores: GuardadoFicha) => void | Promise<void>;
  /** Eliminar la previsión desde la ficha. */
  onEliminar?: (item: ItemPunteo) => void | Promise<void>;
  /** Inmuebles para el selector de la ficha. */
  inmuebles?: Array<{ id: number; alias: string }>;
  /** Confirmar de golpe todo lo que queda pendiente ese día (§4.9). */
  onConfirmarDia: (items: ItemPunteo[]) => void | Promise<void>;
  /**
   * §9 · anotar un movimiento EN ESE DÍA.
   *
   * Faltaba, y es la mitad que da sentido al panel: mirando el día se ve tanto
   * lo que estaba previsto como lo que pasó y nadie había apuntado. Sin esto
   * había que cerrar, abrir la cuenta y poner la fecha a mano — con el día
   * delante, eso es pedirle al usuario un dato que ya está en pantalla.
   */
  onAnotar?: (fecha: string) => void | Promise<void>;
}

const DrawerCalendario: React.FC<DrawerCalendarioProps> = ({
  abierto,
  year,
  month0,
  onMes,
  eventos,
  movimientos,
  cuentas,
  saldoPorCuenta,
  saldoTotalHoy,
  hoy,
  aliasInmueble,
  onCerrar,
  onConfirmar,
  onDescartar,
  onGuardarFicha,
  onEliminar,
  inmuebles = [],
  onConfirmarDia,
  onAnotar,
}) => {
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  /** `null` = cerrada · con item = edición desde el lápiz de la fila. */
  const [ficha, setFicha] = useState<{ item: ItemPunteo } | null>(null);

  const dias = useMemo(
    () =>
      construirDias({ year, month0, eventos, movimientos, cuentas, saldoPorCuenta, hoy }),
    [year, month0, eventos, movimientos, cuentas, saldoPorCuenta, hoy]
  );

  const resumen = useMemo(
    () => resumirMes({ year, month0, eventos, saldoTotalHoy }),
    [year, month0, eventos, saldoTotalHoy]
  );

  const huecos = useMemo(() => huecosIniciales(year, month0), [year, month0]);

  /**
   * Los apuntes del día elegido · lo que TODAVÍA NO ha movido dinero.
   *
   * El calendario mira hacia delante: contesta "¿qué me queda por pasar y
   * cuándo?". Lo ya ocurrido vive en la cuenta (§4.4), que es donde se mira el
   * histórico. Enseñándolo también aquí, cada día arrastraba para siempre todo
   * lo que ya estaba hecho y no se vaciaba nunca al terminarlo: confirmabas los
   * tres pendientes y el día seguía igual de lleno, sin señal de haber
   * avanzado.
   *
   * El criterio es el del SALDO, el mismo que usa la rejilla: entra lo que el
   * saldo de hoy no incorpora todavía. Eso incluye los movimientos con fecha
   * POSTERIOR a hoy —un recibo ya cargado por el banco con fecha adelantada—,
   * que no piden confirmar nada pero sí mueven dinero ese día: si son ellos los
   * que dejan la cuenta corta, tiene que haber una fila que lo explique debajo
   * del punto ámbar.
   */
  const itemsDelDia = useMemo<ItemPunteo[]>(() => {
    if (!diaElegido) return [];
    const evs = eventos
      .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
      .filter((e) => esPendiente(e))
      .filter((e) => (e.predictedDate ?? '').slice(0, 10) === diaElegido)
      .map((e) => eventoAItem(e, aliasInmueble));
    const movs =
      diaElegido > hoy
        ? movimientos
            .filter((m): m is Movement & { id: number } => m.id != null)
            .filter((m) => !m.isOpeningBalance)
            .filter((m) => (m.date ?? '').slice(0, 10) === diaElegido)
            .map((m) => movimientoAItem(m, aliasInmueble))
        : [];

    const todos = [...evs, ...movs];

    // §9 · marcar QUÉ cargo deja la cuenta corta.
    //
    // El saldo de partida NO es el de hoy: es el que tiene la cuenta al empezar
    // ESTE día. Usar el de hoy daba una cifra falsa en cuanto el día no era hoy
    // —en el futuro le faltaba todo lo que pasa por medio— y un aviso que
    // miente es peor que ninguno. Para días ya pasados no se marca nada: ese
    // saldo no se puede reconstruir hacia atrás sin deshacer movimientos.
    const saldos = saldoAlEmpezarElDia({
      fecha: diaElegido,
      eventos,
      movimientos,
      saldoPorCuenta,
      hoy,
    });
    if (!saldos) return todos;

    // Se recorre en el MISMO orden en que se van a pintar (`compararEnDia`), o
    // el aviso acabaría en una fila distinta de la que lo provoca.
    for (const it of [...todos].sort(compararEnDia)) {
      if (it.cuentaId == null) continue;
      const antes = saldos.get(it.cuentaId) ?? 0;
      const despues = antes + it.importe;
      saldos.set(it.cuentaId, despues);
      if (antes >= 0 && despues < 0) {
        it.avisoSaldo = `deja el saldo en ${importeSaldo(despues)}`;
      }
    }
    return todos;
  }, [diaElegido, eventos, movimientos, aliasInmueble, saldoPorCuenta, hoy]);

  /**
   * Los que confirma el botón "Confirmar el día".
   *
   * Solo los `previsto`, y por partida doble.
   *
   * No todo lo que se pinta en el día pide una acción: un evento `confirmed`
   * —una venta, la liquidación de un préstamo— ya está decidido y solo espera
   * al banco, y un movimiento con fecha adelantada ya ha ocurrido. Confirmar
   * "el día" no puede significar tocarlos.
   *
   * Filtra además por `kind` porque el botón dispara una acción irreversible
   * sobre cuanto le pasen, y apoyarse en que quien construye la lista de arriba
   * no cambie es el mismo descuido que resucitó 57 cuotas al renombrar un
   * préstamo.
   */
  const pendientesDelDia = useMemo(
    () => itemsDelDia.filter((i) => i.kind === 'evento' && i.estado === 'previsto'),
    [itemsDelDia]
  );

  /**
   * §2.3 · desde cuándo hay saldo del que partir.
   *
   * No es un campo de la cuenta: el saldo inicial es un movimiento marcado, así
   * que la fecha sale del más antiguo de ellos. Por debajo de ahí un cierre
   * pintado sería inventado, y el mes ni se muestra ni se navega.
   */
  const saldoInicialDesde = useMemo(() => {
    let min: string | undefined;
    for (const m of movimientos) {
      if (!m.isOpeningBalance) continue;
      const f = (m.date ?? '').slice(0, 10);
      if (f && (!min || f < min)) min = f;
    }
    return min;
  }, [movimientos]);

  // §2.3 · hasta dónde se puede retroceder · el tope es el trabajo que queda
  // atrás, no una fecha arbitraria.
  const hayAtras = useMemo(
    () =>
      puedeRetroceder(
        { year, month0 },
        mesMinimo({ eventos, hoy, saldoDesde: saldoInicialDesde })
      ),
    [year, month0, eventos, hoy, saldoInicialDesde]
  );

  const irAMes = (delta: number) => {
    const d = new Date(year, month0 + delta, 1);
    setDiaElegido(null);
    onMes(d.getFullYear(), d.getMonth());
  };

  if (!abierto) return null;

  const cuentasParaLista = cuentas
    .filter((c): c is Account & { id: number } => c.id != null)
    .map((c) => ({
      id: c.id,
      label: c.alias || c.banco?.name || `Cuenta ${c.id}`,
      // §9 · el punto del banco en la fila: en un día conviven cargos de varias
      // cuentas y hay que ver de cuál sale cada uno sin leer el nombre.
      color: colorDeBanco(c),
    }));

  return (
    <>
      <div className={`${chasis.back} ${chasis.backOpen}`} onClick={onCerrar} aria-hidden="true" />
      <aside
        className={`${chasis.drw} ${chasis.drwOpen}`}
        role="dialog"
        aria-modal="true"
        aria-label="Calendario"
      >
        <div className={chasis.hd}>
          <div className={chasis.hdTop}>
            <div className={styles.nav}>
              {/* §2.3 · al llegar al tope la flecha se DESACTIVA, no lleva a
                  meses vacíos. Tesorería mira hacia delante: atrás solo se va
                  si queda trabajo, y por debajo del saldo inicial ni eso. */}
              <button
                type="button"
                className={`${styles.navBtn} ${!hayAtras ? styles.navBtnOff : ''}`}
                onClick={() => hayAtras && irAMes(-1)}
                disabled={!hayAtras}
                aria-label="Mes anterior"
              >
                <Icons.ChevronLeft size={16} strokeWidth={2} />
              </button>
              <h2 className={chasis.hdTitle}>
                {nombreMes(month0)} {year}
              </h2>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => irAMes(1)}
                aria-label="Mes siguiente"
              >
                <Icons.ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
            <button
              type="button"
              className={chasis.hdClose}
              onClick={onCerrar}
              aria-label="Cerrar"
            >
              <Icons.Close size={17} strokeWidth={2} />
            </button>
          </div>

          <div className={chasis.kpis}>
            <div className={chasis.ak}>
              <div className={chasis.akl}>
                {/* §8 · la flecha dice la dirección antes de leer la cifra. */}
                <Icons.ArrowUp size={11} strokeWidth={2} /> Queda entrar
              </div>
              <div className={chasis.akv}>{importeConSigno(resumen.quedaEntrar)}</div>
            </div>
            <div className={chasis.ak}>
              <div className={chasis.akl}>
                <Icons.ArrowDown size={11} strokeWidth={2} /> Queda salir
              </div>
              <div className={chasis.akv}>{importeConSigno(resumen.quedaSalir)}</div>
            </div>
            <div className={chasis.ak}>
              <div className={chasis.akl}>Cierre</div>
              <div className={`${chasis.akv} ${chasis.akvGold}`}>{importeSaldo(resumen.cierre)}</div>
            </div>
          </div>
        </div>

        <div className={chasis.body}>
          {/* ── Rejilla de días · lunes primero (§4.9) ──────────────────── */}
          <div className={styles.rejilla} role="grid" aria-label={`Días de ${nombreMes(month0)}`}>
            {DIAS_SEMANA.map((d) => (
              <div key={d} className={styles.cabDia} role="columnheader">
                {d}
              </div>
            ))}
            {Array.from({ length: huecos }, (_, i) => (
              <div key={`hueco-${i}`} className={styles.hueco} aria-hidden="true" />
            ))}
            {dias.map((d) => {
              const esHoy = d.fecha === hoy;
              const elegido = d.fecha === diaElegido;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  role="gridcell"
                  className={[
                    styles.dia,
                    esHoy ? styles.diaHoy : '',
                    elegido ? styles.diaOn : '',
                    d.apuntes === 0 ? styles.diaVacio : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setDiaElegido(elegido ? null : d.fecha)}
                  aria-selected={elegido}
                  aria-label={
                    `${d.numero} de ${nombreMes(month0)}` +
                    (d.apuntes === 0
                      ? ' · nada pendiente'
                      : ` · ${d.apuntes} pendiente${d.apuntes === 1 ? '' : 's'}` +
                        ` · neto ${importeConSigno(d.neto)}`) +
                    (d.dejaCuentaCorta ? ' · deja una cuenta en negativo' : '')
                  }
                >
                  <span className={styles.diaNum}>{d.numero}</span>
                  {d.apuntes > 0 && (
                    <span className={styles.diaNeto}>{importeConSigno(d.neto, false)}</span>
                  )}
                  {/* Ámbar · única nota de color de la rejilla (§5). */}
                  {d.dejaCuentaCorta && <span className={styles.avisoDot} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {/* ── El día elegido ──────────────────────────────────────────── */}
          {diaElegido && (
            <div className={styles.detalle}>
              {/* §9 · "Jueves 30 · 2 movimientos".
                  El mes y el año ya están en la cabecera del drawer y en la
                  rejilla que hay justo encima: repetir "31 ago 2026" aquí es
                  decir por tercera vez dónde estamos. Lo que no se sabía es
                  cuántos apuntes tiene el día. */}
              <div className={styles.detalleHd}>
                <div className={styles.detalleT}>{diaSemanaYNumero(diaElegido)}</div>
                {/* "Pendiente" y no "por confirmar": no todo lo que hay aquí
                    pide una acción —un `confirmed` ya está decidido y espera al
                    banco—, y prometer una tarea que el botón luego no hace es
                    peor que no decir nada. Cuál pide qué lo dice el chip de
                    estado de su fila. */}
                <span className={styles.detalleN}>
                  {itemsDelDia.length} {itemsDelDia.length === 1 ? 'pendiente' : 'pendientes'}
                </span>
              </div>

              {itemsDelDia.length === 0 ? (
                <div className={styles.vacio}>Nada pendiente este día</div>
              ) : (
                <PunteoList
                  items={itemsDelDia}
                  chip="todos"
                  onChipChange={() => {}}
                  mostrarChips={false}
                  cuentas={cuentasParaLista}
                  variant="drawer"
                  // §4.9 · agrupado POR CUENTA, como al entrar por la cuenta:
                  // bajo el nombre de cada una, lo suyo. En un día con seis
                  // cargos de cuatro cuentas, la lista plana obligaba a leer de
                  // cuál salía cada uno para hacerse la pregunta que importa,
                  // que es qué le pasa a esta cuenta hoy.
                  eje="cuenta"
                  // El chip, SOLO cuando no es previsto. El calendario enseña
                  // lo que está por pasar: escribir "previsto" en cada fila es
                  // repetir lo que ya dice la pantalla entera. Lo que sí hay
                  // que distinguir es el confirmado que solo espera al banco y
                  // el movimiento adelantado que ya ocurrió, y esos siguen
                  // llevando su chip.
                  conChipEstado="solo-si-difiere"
                  rowVariant="tesoreria"
                  onEditar={(item) => setFicha({ item })}
                  onConfirmar={onConfirmar}
                  onNoPaso={onDescartar}
                />
              )}

              {/* §9 · las acciones van DEBAJO de la lista, no encima.
                  Se decide qué hacer después de mirar lo que hay: puestas
                  arriba piden confirmar el día antes de haberlo leído. */}
              <div className={styles.detalleAcciones}>
                {pendientesDelDia.length > 0 && (
                  <button
                    type="button"
                    className={styles.btnDia}
                    onClick={() => void onConfirmarDia(pendientesDelDia)}
                  >
                    <Icons.Check size={13} strokeWidth={2} /> Confirmar el día
                  </button>
                )}
                {onAnotar && (
                  <button
                    type="button"
                    className={styles.btnDiaSec}
                    onClick={() => onAnotar(diaElegido)}
                  >
                    <Icons.Plus size={13} strokeWidth={2} /> Anotar movimiento
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* §4.5 · ficha de movimiento · la abre el lápiz de la fila */}
      <FichaMovimiento
        abierta={ficha != null}
        inicial={ficha ? valoresDesdeItem(ficha.item, ficha.item.cuentaId ?? null) : undefined}
        importePrevisto={ficha?.item.importePrevisto ?? ficha?.item.importe}
        documentIds={ficha?.item.documentIds}
        cuentas={cuentas}
        inmuebles={inmuebles}
        onCerrar={() => setFicha(null)}
        onGuardar={async (v) => {
          await onGuardarFicha?.(ficha?.item ?? null, v);
          setFicha(null);
        }}
        onEliminar={
          ficha && onEliminar
            ? async () => {
                await onEliminar(ficha.item);
                setFicha(null);
              }
            : undefined
        }
      />
    </>
  );
};

export default DrawerCalendario;
