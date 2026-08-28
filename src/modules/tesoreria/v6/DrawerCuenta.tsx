// ============================================================================
// Tesorería V6 · §4.4 · drawer de cuenta
// ============================================================================
//
// LA bandeja de trabajo: aquí es donde el usuario confirma, edita y descarta.
//
// Se monta sobre `PunteoList` con las cinco fricciones aprobadas en D2 bis, en
// vez de reescribir una lista nueva: el modelo `previsto/confirmado/conciliado`
// de `punteoModel` es el mismo en las cuatro vistas y no se toca.
//
// Las tres pestañas se reparten el trabajo, y por eso NO hacen lo mismo:
//
//   Por confirmar → la BANDEJA. Se puntea, se edita y se descarta en la fila
//                   (rowVariant `tesoreria`), agrupado por día y sin chip de
//                   estado: allí todo es previsto y decirlo en cada fila es
//                   repetir el nombre de la pestaña.
//   Confirmados   → lo que dijiste que pasó, y la puerta para DESPUNTEARLO.
//                   Puntear es la acción más repetida de la pantalla, así que
//                   equivocarse es cuestión de tiempo; sin esta pestaña el
//                   único arreglo era borrar el movimiento y regenerarlo.
//   Movimientos   → la CONSULTA del mes. Buscador, ejes de agrupación y grupos
//                   plegables con subtotal, y SOLO LECTURA: aquí conviven los
//                   tres estados —el chip vive solo aquí, porque solo aquí
//                   distingue algo— pero decidir sobre un cargo suelto en medio
//                   del mes entero es justo lo que la bandeja evita.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import PunteoList from '../../shared/components/Punteo/PunteoList';
import type { EjeAgrupacion } from '../../shared/components/Punteo/punteoAgrupacion';
import { eventoAItem, movimientoAItem } from '../../../services/punteo/punteoAdapter';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { cierrePorCuenta, esPendiente, rangoDelMes } from '../../../services/tesoreriaV6Metrics';
import { colorDeBanco } from './bancoColores';
import { importeConSigno, importeSaldo } from './formatoV6';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { valoresDesdeItem } from './fichaDesdeItem';
import styles from './DrawerV6.module.css';

export interface DrawerCuentaProps {
  cuenta: Account | null;
  saldoHoy: number;
  eventos: TreasuryEvent[];
  movimientos: Movement[];
  year: number;
  month0: number;
  /** ISO yyyy-mm-dd · corta la bandeja de Pendientes (A1). */
  hoy: string;
  aliasInmueble?: (id: number | string) => string | undefined;
  /** §7 · abrir en el Archivo el documento que respalda un movimiento. */
  onAbrirDocumento?: (documentId: number) => void;
  onCerrar: () => void;
  /** Puntear un previsto · materializa el movimiento y mueve el saldo (§4.6). */
  onConfirmar: (item: ItemPunteo) => void | Promise<void>;
  /** Descartar · el previsto no ocurrirá. No toca el saldo (§2 regla 5). */
  onDescartar: (item: ItemPunteo) => void | Promise<void>;
  /**
   * Despuntear · deshace el punteo y el cargo vuelve a "Por confirmar".
   *
   * Puntear es la acción más repetida de la pantalla, así que equivocarse es
   * cuestión de tiempo; sin esto, el único arreglo era borrar el movimiento y
   * volver a generarlo. Solo lo de la pestaña Confirmados: lo conciliado lo
   * afirma el banco y no se deshace desde aquí.
   */
  onDespuntear?: (item: ItemPunteo) => void | Promise<void>;
  /** Guardar desde la ficha de movimiento (§4.5). */
  onGuardarFicha?: (item: ItemPunteo | null, valores: GuardadoFicha) => void | Promise<void>;
  /** Eliminar la previsión desde la ficha. */
  onEliminar?: (item: ItemPunteo) => void | Promise<void>;
  /**
   * T3 · ir al gasto recurrente que emitió la previsión.
   *
   * Solo en la bandeja: es donde aparece el cargo que no debería estar, y es la
   * alternativa a borrarlo —que no arregla nada, porque el gasto lo reemite el
   * mes siguiente—.
   */
  onIrAlGasto?: (item: ItemPunteo) => void;
  /** Cuentas e inmuebles para los selectores de la ficha. */
  cuentas?: Account[];
  inmuebles?: Array<{ id: number; alias: string }>;
  /** Las tarjetas, para el selector de la ficha (§3.5). */
  tarjetas?: Array<{ id: number; alias: string }>;
  /** Puerta del extracto con la cuenta ya fijada (§4.7). */
  onSubirExtracto?: (cuenta: Account) => void;
}

type Pestana = 'pendientes' | 'confirmados' | 'todo';

const DrawerCuenta: React.FC<DrawerCuentaProps> = ({
  cuenta,
  saldoHoy,
  eventos,
  movimientos,
  year,
  month0,
  hoy,
  aliasInmueble,
  onAbrirDocumento,
  onCerrar,
  onConfirmar,
  onDescartar,
  onDespuntear,
  onGuardarFicha,
  onEliminar,
  onIrAlGasto,
  cuentas = [],
  inmuebles = [],
  tarjetas = [],
  onSubirExtracto,
}) => {
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  // `null` = cerrada · `{item: null}` = alta ("Anotar") · con item = edición.
  const [ficha, setFicha] = useState<{ item: ItemPunteo | null } | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [eje, setEje] = useState<EjeAgrupacion>('fecha');

  const abierto = cuenta != null;
  const { desde, hasta } = rangoDelMes(year, month0);

  // ── KPIs de la cabecera · se recalculan en vivo (§4.4) ───────────────────
  //
  // La función canónica de cierre (V9): antes esto se sumaba aquí inline SIN
  // excluir los traspasos internos, y el "final" del drawer podía discrepar
  // del cierre del hero en el mismo mes.
  const kpis = useMemo(() => {
    const c = cierrePorCuenta({ saldoHoy, eventos, year, month0 });
    return { entrar: c.entra, salir: c.sale, final: c.cierre };
  }, [eventos, saldoHoy, year, month0]);

  /** El nombre de la otra cuenta · lo pide un traspaso para decir a dónde va. */
  const aliasCuenta = useMemo(() => {
    const m = new Map(
      cuentas
        .filter((c): c is Account & { id: number } => c.id != null)
        .map((c) => [c.id, c.alias || c.banco?.name || undefined] as const)
    );
    return (id: number) => m.get(id);
  }, [cuentas]);

  // ── Ítems de las tres pestañas ───────────────────────────────────────────

  /**
   * Por confirmar · §3.1 · lo que YA DEBERÍA HABER PASADO y sigue sin confirmar.
   *
   * Es una bandeja que se vacía, no un inventario de todo lo que está por
   * venir. Un recibo de diciembre estando a 1 de agosto no es trabajo de hoy:
   * vive en el calendario y en el cierre del mes. Colarlo aquí hinchaba el
   * contador a cientos y conseguía lo contrario de lo que la pantalla busca —
   * abrumaba en vez de tranquilizar.
   *
   * Solo lo PREVISTO. `esPendiente` incluye además los eventos `confirmed` —la
   * venta de un piso, la liquidación de un préstamo: decididos y esperando al
   * banco—, y esos no se puntean: su círculo se quedaba ahí sin hacer nada, en
   * una bandeja donde todo lo demás sí responde. Su sitio es Confirmados.
   *
   * Orden descendente: lo más reciente arriba, que es por donde se empieza.
   */
  const itemsPendientes = useMemo<ItemPunteo[]>(
    () =>
      eventos
        .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
        .filter((e) => esPendiente(e) && e.status === 'predicted')
        // Con fecha vacía la comparación `'' <= hoy` es CIERTA, así que un
        // evento sin `predictedDate` se colaba en Pendientes — y los KPIs sí lo
        // excluyen, con lo que la bandeja y las cifras contaban cosas distintas.
        .filter((e) => {
          const f = (e.predictedDate ?? '').slice(0, 10);
          return f !== '' && f <= hoy;
        })
        .map((e) => eventoAItem(e, aliasInmueble, aliasCuenta))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [eventos, aliasInmueble, aliasCuenta, hoy]
  );

  /**
   * Confirmados · lo que dijiste que pasó, del mes.
   *
   * "Tu palabra", sin extracto detrás (§6.4). Lo conciliado NO entra: eso lo
   * afirma el banco y no se deshace desde aquí — vive en Movimientos con los
   * demás.
   *
   * Está para poder DESPUNTEAR. Puntear es la acción más repetida de la
   * pantalla, así que equivocarse es cuestión de tiempo, y hasta ahora el único
   * arreglo era borrar el movimiento y volver a generarlo. Del mes, como
   * Movimientos: sin acotar crecería para siempre y dejaría de ser una lista
   * que se repasa.
   */
  const itemsConfirmados = useMemo<ItemPunteo[]>(() => {
    const enMes = (f: string) => f >= desde && f <= hasta;
    const evs = eventos
      .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
      .filter((e) => !e.descartado && e.status === 'confirmed')
      .filter((e) => enMes((e.predictedDate ?? '').slice(0, 10)))
      .map((e) => eventoAItem(e, aliasInmueble, aliasCuenta));
    const movs = movimientos
      .filter((m): m is Movement & { id: number } => m.id != null)
      .filter((m) => !m.isOpeningBalance)
      // Una compra con tarjeta de CRÉDITO no es un cargo de la cuenta: sale en el
      // recibo el día de cargo (§3.5). Vive en el cajón de la tarjeta, no aquí.
      .filter((m) => !m.gastoTarjetaCredito)
      .filter((m) => enMes((m.date ?? '').slice(0, 10)))
      .map((m) => movimientoAItem(m, aliasInmueble, aliasCuenta))
      .filter((i) => i.estado === 'confirmado');
    return [...evs, ...movs].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [eventos, movimientos, desde, hasta, aliasInmueble, aliasCuenta]);

  /** Movimientos: previsión y realidad del mes, que es una vista de consulta. */
  const itemsTodo = useMemo<ItemPunteo[]>(() => {
    const enMes = (f: string) => f >= desde && f <= hasta;
    const evs = eventos
      .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
      .filter((e) => !e.descartado && e.status !== 'executed')
      .filter((e) => enMes((e.predictedDate ?? '').slice(0, 10)))
      .map((e) => eventoAItem(e, aliasInmueble, aliasCuenta));
    const movs = movimientos
      .filter((m): m is Movement & { id: number } => m.id != null)
      .filter((m) => !m.isOpeningBalance)
      // La compra de crédito vive en la tarjeta · a la cuenta llega el recibo.
      .filter((m) => !m.gastoTarjetaCredito)
      .filter((m) => enMes((m.date ?? '').slice(0, 10)))
      .map((m) => movimientoAItem(m, aliasInmueble, aliasCuenta));
    return [...evs, ...movs];
  }, [eventos, movimientos, desde, hasta, aliasInmueble, aliasCuenta]);

  if (!cuenta) return null;

  const nombre = cuenta.alias || cuenta.name || cuenta.banco?.name || 'Cuenta';
  const mask = (cuenta.ultimosCuatro || cuenta.iban?.slice(-4)) ?? '';

  return (
    <>
      <div
        className={`${styles.back} ${abierto ? styles.backOpen : ''}`}
        onClick={onCerrar}
        aria-hidden="true"
      />
      <aside
        className={`${styles.drw} ${abierto ? styles.drwOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Cuenta ${nombre}`}
      >
        <div className={styles.hd}>
          <div className={styles.hdTop}>
            <span className={styles.hdDot} style={{ background: colorDeBanco(cuenta) }} />
            <div>
              <h2 className={styles.hdTitle}>{nombre}</h2>
              {mask && <div className={styles.hdMask}>···· {mask}</div>}
            </div>
            <button type="button" className={styles.hdClose} onClick={onCerrar} aria-label="Cerrar">
              <Icons.Close size={17} strokeWidth={2} />
            </button>
          </div>

          <div className={styles.kpis}>
            <Ak lab="Saldo hoy" val={importeSaldo(saldoHoy)} />
            <Ak lab="Queda entrar" val={importeConSigno(kpis.entrar)} />
            <Ak lab="Queda salir" val={importeConSigno(kpis.salir)} />
            <Ak lab="Saldo final" val={importeSaldo(kpis.final)} gold />
          </div>
        </div>

        {/* Una sola fila: pestañas a la izquierda, acciones a la derecha (§4.4). */}
        <div className={styles.controles}>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'pendientes' ? styles.tabOn : ''}`}
            aria-pressed={pestana === 'pendientes'}
            onClick={() => setPestana('pendientes')}
          >
            {/* Sin recuento · la cifra ya está en la tarjeta de la cuenta y en
                el hero, y aquí compite con el nombre de la pestaña sin decir
                nada que no se vea contando la lista de debajo. */}
            Por confirmar
          </button>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'confirmados' ? styles.tabOn : ''}`}
            aria-pressed={pestana === 'confirmados'}
            onClick={() => setPestana('confirmados')}
          >
            Confirmados
          </button>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'todo' ? styles.tabOn : ''}`}
            aria-pressed={pestana === 'todo'}
            onClick={() => setPestana('todo')}
          >
            Movimientos
          </button>

          {pestana === 'pendientes' && (
            <>
              <span className={styles.sp} />
              <button type="button" className={styles.btnCmp} onClick={() => setFicha({ item: null })}>
                <Icons.Plus size={13} strokeWidth={2} /> Anotar
              </button>
              <button
                type="button"
                className={`${styles.btnCmp} ${styles.btnCmpGold}`}
                onClick={() => onSubirExtracto?.(cuenta)}
              >
                <Icons.Upload size={13} strokeWidth={1.8} /> Subir extracto
              </button>
            </>
          )}
        </div>

        <div className={styles.body}>
          {pestana === 'pendientes' ? (
            itemsPendientes.length === 0 ? (
              <div className={styles.vacio}>
                <Icons.Success size={34} strokeWidth={1.6} className={styles.vacioIc} />
                <div className={styles.vacioT}>Nada por confirmar</div>
                {/* El texto del mockup · la bandeja no es del mes (lista
                    vencidos de cualquier fecha), así que nombrarlo era además
                    inexacto. */}
                <div className={styles.vacioS}>esta cuenta está al día</div>
              </div>
            ) : (
              <PunteoList
                items={itemsPendientes}
                chip="todos"
                onChipChange={() => undefined}
                mostrarChips={false}
                cuentas={[]}
                ocultarCuenta
                // §6.3 · en "Por confirmar" todo viene del mismo sitio: el chip
                // de origen repetido no distingue nada y tapa lo que sí.
                sinOrigen
                rowVariant="tesoreria"
                onConfirmar={onConfirmar}
                onNoPaso={onDescartar}
                onEditar={(item) => setFicha({ item })}
                onIrAlGasto={onIrAlGasto}
              />
            )
          ) : pestana === 'confirmados' ? (
            itemsConfirmados.length === 0 ? (
              <div className={styles.vacio}>
                {/* El vacío EXPLICA para qué es la pestaña · sin nada dentro,
                    un título a secas no dice si esto está vacío porque va bien
                    o porque falta hacer algo. Y no lleva el check verde de "al
                    día": no haber confirmado nada no es una buena noticia. */}
                <Icons.Refresh size={34} strokeWidth={1.6} className={styles.vacioIc} />
                <div className={styles.vacioT}>Nada confirmado este mes</div>
                <div className={styles.vacioS}>aquí aparece lo que vayas punteando, por si hay que deshacerlo</div>
              </div>
            ) : (
              <PunteoList
                items={itemsConfirmados}
                chip="todos"
                onChipChange={() => undefined}
                mostrarChips={false}
                cuentas={[]}
                ocultarCuenta
                // Aquí todo está confirmado · el chip repetiría la pestaña, y
                // el origen ya se lee en el propio concepto de cada fila.
                sinOrigen
                // Sin esto el lápiz no sale: las acciones de fila viven detrás
                // de esta variante, y pasar `onEditar` a secas no bastaba.
                rowVariant="tesoreria"
                onConfirmar={onConfirmar}
                onNoPaso={onDescartar}
                // El círculo es el mismo interruptor que lo punteó · es donde
                // se busca deshacerlo.
                onDespuntear={onDespuntear}
                // Un gasto anotado a mano no NACIÓ de ninguna previsión, así
                // que despuntearlo no significa nada —no hay a dónde
                // devolverlo— y aquí se quedaba sin ninguna salida: ni
                // corregir el importe ni borrarlo si te equivocaste. El lápiz
                // abre la MISMA ficha que en la bandeja, y ahí dentro están las
                // dos salidas: guardar los cambios o eliminarlo.
                onEditar={(item) => setFicha({ item })}
              />
            )
          ) : (
            <PunteoList
              items={itemsTodo}
              // §6.4 · aquí conviven los tres estados, y quien los explica es
              // la LEYENDA: una vez para toda la lista. Escribir el estado en
              // cada fila era gastar cuarenta líneas en decir qué significa un
              // círculo hueco, y el color del círculo ya los distingue.
              conLeyenda
              // Se MIRA, no se toca · confirmar y editar viven en la bandeja.
              // Decidir sobre un cargo suelto en medio del mes entero es lo que
              // "Por confirmar" viene a evitar: allí llegan los que tocan,
              // ordenados y sin nada alrededor.
              soloLectura
              // El chip de ORIGEN sobra: lo dice el agrupamiento —por Tipo es
              // literalmente la cabecera del grupo— y en las demás vistas
              // repetía en cada fila una etiqueta que no distingue nada.
              sinOrigen
              chip="todos"
              onChipChange={() => undefined}
              mostrarChips={false}
              cuentas={[]}
              ocultarCuenta
              eje={eje}
              onEjeChange={setEje}
              busqueda={busqueda}
              onBusquedaChange={setBusqueda}
              gruposPlegables
              onConfirmar={onConfirmar}
              onNoPaso={onDescartar}
            />
          )}
        </div>
      </aside>

      {/* §4.5 · ficha de movimiento · editar con el lápiz o anotar */}
      <FichaMovimiento
        abierta={ficha != null}
        esEdicion={ficha?.item != null}
        inicial={
          ficha?.item
            ? valoresDesdeItem(ficha.item, cuenta.id ?? null)
            : // Anotar desde DENTRO de una cuenta ya dice en qué cuenta ocurre.
              // Sin esto la ficha abría con la primera de la lista, así que
              // entrando por Sabadell el gasto se anotaba en Santander salvo
              // que el usuario se diera cuenta y lo cambiara.
              { cuentaId: cuenta.id ?? null }
        }
        importePrevisto={ficha?.item?.importePrevisto ?? ficha?.item?.importe}
        // §7 · el papel que respalda el cargo · solo lo tienen los reales.
        documentIds={ficha?.item?.documentIds}
        onAbrirDocumento={onAbrirDocumento}
        cuentas={cuentas.length > 0 ? cuentas : [cuenta]}
        inmuebles={inmuebles}
        tarjetas={tarjetas}
        onCerrar={() => setFicha(null)}
        onGuardar={async (v) => {
          await onGuardarFicha?.(ficha?.item ?? null, v);
          setFicha(null);
        }}
        onEliminar={
          ficha?.item && onEliminar
            ? async () => {
                await onEliminar(ficha.item!);
                setFicha(null);
              }
            : undefined
        }
      />
    </>
  );
};

const Ak: React.FC<{ lab: string; val: string; gold?: boolean }> = ({ lab, val, gold }) => (
  <div className={styles.ak}>
    <div className={styles.akl}>{lab}</div>
    <div className={`${styles.akv} ${gold ? styles.akvGold : ''}`}>{val}</div>
  </div>
);

export default DrawerCuenta;
