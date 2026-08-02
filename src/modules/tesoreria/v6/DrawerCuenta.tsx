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
// Las dos pestañas se reparten el trabajo, y por eso NO hacen lo mismo:
//
//   Por confirmar → la BANDEJA. Se puntea, se edita y se descarta en la fila
//                   (rowVariant `tesoreria`), agrupado por día y sin chip de
//                   estado: allí todo es previsto y decirlo en cada fila es
//                   repetir el nombre de la pestaña.
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
import { esPendiente, importeConSigno as signo, rangoDelMes } from '../../../services/tesoreriaV6Metrics';
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
  /** Guardar desde la ficha de movimiento (§4.5). */
  onGuardarFicha?: (item: ItemPunteo | null, valores: GuardadoFicha) => void | Promise<void>;
  /** Eliminar la previsión desde la ficha. */
  onEliminar?: (item: ItemPunteo) => void | Promise<void>;
  /** Cuentas e inmuebles para los selectores de la ficha. */
  cuentas?: Account[];
  inmuebles?: Array<{ id: number; alias: string }>;
  /** Puerta del extracto con la cuenta ya fijada (§4.7). */
  onSubirExtracto?: (cuenta: Account) => void;
}

type Pestana = 'pendientes' | 'todo';

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
  onGuardarFicha,
  onEliminar,
  cuentas = [],
  inmuebles = [],
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
  const kpis = useMemo(() => {
    let entrar = 0;
    let salir = 0;
    for (const e of eventos) {
      if (!esPendiente(e)) continue;
      const f = (e.predictedDate ?? '').slice(0, 10);
      if (f < desde || f > hasta) continue;
      const imp = signo(e);
      if (imp > 0) entrar += imp;
      else salir += imp;
    }
    return { entrar, salir, final: saldoHoy + entrar + salir };
  }, [eventos, saldoHoy, desde, hasta]);

  // ── Ítems de las dos pestañas ────────────────────────────────────────────

  /**
   * Por confirmar · §3.1 · lo que YA DEBERÍA HABER PASADO y sigue sin confirmar.
   *
   * Es una bandeja que se vacía, no un inventario de todo lo que está por
   * venir. Un recibo de diciembre estando a 1 de agosto no es trabajo de hoy:
   * vive en el calendario y en el cierre del mes. Colarlo aquí hinchaba el
   * contador a cientos y conseguía lo contrario de lo que la pantalla busca —
   * abrumaba en vez de tranquilizar.
   *
   * Orden descendente: lo más reciente arriba, que es por donde se empieza.
   */
  const itemsPendientes = useMemo<ItemPunteo[]>(
    () =>
      eventos
        .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
        .filter((e) => esPendiente(e))
        // Con fecha vacía la comparación `'' <= hoy` es CIERTA, así que un
        // evento sin `predictedDate` se colaba en Pendientes — y los KPIs sí lo
        // excluyen, con lo que la bandeja y las cifras contaban cosas distintas.
        .filter((e) => {
          const f = (e.predictedDate ?? '').slice(0, 10);
          return f !== '' && f <= hoy;
        })
        .map((e) => eventoAItem(e, aliasInmueble))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [eventos, aliasInmueble, hoy]
  );

  /** Movimientos: previsión y realidad del mes, que es una vista de consulta. */
  const itemsTodo = useMemo<ItemPunteo[]>(() => {
    const enMes = (f: string) => f >= desde && f <= hasta;
    const evs = eventos
      .filter((e): e is TreasuryEvent & { id: number } => e.id != null)
      .filter((e) => !e.descartado && e.status !== 'executed')
      .filter((e) => enMes((e.predictedDate ?? '').slice(0, 10)))
      .map((e) => eventoAItem(e, aliasInmueble));
    const movs = movimientos
      .filter((m): m is Movement & { id: number } => m.id != null)
      .filter((m) => !m.isOpeningBalance)
      .filter((m) => enMes((m.date ?? '').slice(0, 10)))
      .map((m) => movimientoAItem(m, aliasInmueble));
    return [...evs, ...movs];
  }, [eventos, movimientos, desde, hasta, aliasInmueble]);

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
            {/* Sin nada pendiente no se pinta el recuento: "Por confirmar · 0"
                anuncia una cifra para decir que no hay cifra, y el panel de
                debajo ya lo dice con todas las letras. El mockup tampoco lo
                lleva. */}
            Por confirmar{itemsPendientes.length > 0 ? ` · ${itemsPendientes.length}` : ''}
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
              />
            )
          ) : (
            <PunteoList
              items={itemsTodo}
              // §6.4 · aquí conviven previsto, confirmado y conciliado, y este
              // es el ÚNICO sitio donde el chip dice algo: en "Por confirmar"
              // todo es previsto por definición, así que escribirlo en cada
              // fila es repetir el nombre de la pestaña 250 veces.
              conChipEstado
              // Se MIRA, no se toca · confirmar y editar viven en la bandeja.
              // Decidir sobre un cargo suelto en medio del mes entero es lo que
              // "Por confirmar" viene a evitar: allí llegan los que tocan,
              // ordenados y sin nada alrededor.
              soloLectura
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
        inicial={ficha?.item ? valoresDesdeItem(ficha.item, cuenta.id ?? null) : undefined}
        importePrevisto={ficha?.item?.importePrevisto ?? ficha?.item?.importe}
        // §7 · el papel que respalda el cargo · solo lo tienen los reales.
        documentIds={ficha?.item?.documentIds}
        onAbrirDocumento={onAbrirDocumento}
        cuentas={cuentas.length > 0 ? cuentas : [cuenta]}
        inmuebles={inmuebles}
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
