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
//   Pendientes → rowVariant `tesoreria` (editar y descartar en la fila),
//                agrupado por día, sin chips (mandan las pestañas).
//   Todo {mes} → buscador, ejes de agrupación y grupos plegables con subtotal.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import PunteoList from '../../shared/components/Punteo/PunteoList';
import type { EjeAgrupacion } from '../../shared/components/Punteo/punteoAgrupacion';
import { eventoAItem, movimientoAItem } from '../../../services/punteo/punteoAdapter';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import { presentacionDe } from '../../../services/catalogoPresentacionPersistencia';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import { esPendiente, importeConSigno as signo, rangoDelMes } from '../../../services/tesoreriaV6Metrics';
import { colorDeBanco } from './bancoColores';
import { importeConSigno, importeSaldo, nombreMes } from './formatoV6';
import FichaMovimiento, { type GuardadoFicha, type ValoresFicha } from './FichaMovimiento';
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
   * Pendientes · A1 · lo que YA DEBERÍA HABER PASADO y sigue sin confirmar.
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
        .filter((e) => (e.predictedDate ?? '').slice(0, 10) <= hoy)
        .map((e) => eventoAItem(e, aliasInmueble))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [eventos, aliasInmueble, hoy]
  );

  /** Todo {mes}: previsión y realidad del mes, que es una vista de consulta. */
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
  const mes = nombreMes(month0);

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
            <Ak lab="Pendiente entrar" val={importeConSigno(kpis.entrar)} />
            <Ak lab="Pendiente salir" val={importeConSigno(kpis.salir)} />
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
            Pendientes · {itemsPendientes.length}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'todo' ? styles.tabOn : ''}`}
            aria-pressed={pestana === 'todo'}
            onClick={() => setPestana('todo')}
          >
            Todo {mes}
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
                <div className={styles.vacioT}>Nada pendiente</div>
                <div className={styles.vacioS}>el mes está al día en esta cuenta</div>
              </div>
            ) : (
              <PunteoList
                items={itemsPendientes}
                chip="todos"
                onChipChange={() => undefined}
                mostrarChips={false}
                cuentas={[]}
                ocultarCuenta
                rowVariant="tesoreria"
                onConfirmar={onConfirmar}
                onNoPaso={onDescartar}
                onEditar={(item) => setFicha({ item })}
              />
            )
          ) : (
            <PunteoList
              items={itemsTodo}
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
              onEditar={(item) => setFicha({ item })}
            />
          )}
        </div>
      </aside>

      {/* §4.5 · ficha de movimiento · editar con el lápiz o anotar */}
      <FichaMovimiento
        abierta={ficha != null}
        inicial={ficha?.item ? valoresDesdeItem(ficha.item, cuenta.id ?? null) : undefined}
        importePrevisto={ficha?.item?.importePrevisto ?? ficha?.item?.importe}
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

/**
 * Rellena la ficha con lo que ya sabe ATLAS · el usuario solo corrige (§4.5).
 *
 * La clasificación se recupera haciendo el camino inverso de la tabla de
 * traducción: el registro guarda `categoryKey`, pero la ficha enseña familia y
 * concepto. Si la vuelta no es unívoca, `presentacionDe` devuelve `undefined` y
 * la ficha abre SIN CLASIFICAR — que es la verdad — en vez de con la primera
 * familia del catálogo, que al guardar habría reclasificado a espaldas del
 * usuario.
 */
function valoresDesdeItem(item: ItemPunteo, cuentaId: number | null): Partial<ValoresFicha> {
  const presentacion = presentacionDe(item.categoryKey, item.subtypeKey);
  return {
    tipo: item.importe >= 0 ? 'ingreso' : 'gasto',
    concepto: item.concepto,
    importe: item.importe,
    fecha: item.fecha,
    cuentaId: item.cuentaId ?? cuentaId,
    inmuebleId: typeof item.activo?.inmuebleId === 'number' ? item.activo.inmuebleId : null,
    ...(presentacion ? { familia: presentacion.tipoId, subtipo: presentacion.subtipoId } : {}),
  };
}

const Ak: React.FC<{ lab: string; val: string; gold?: boolean }> = ({ lab, val, gold }) => (
  <div className={styles.ak}>
    <div className={styles.akl}>{lab}</div>
    <div className={`${styles.akv} ${gold ? styles.akvGold : ''}`}>{val}</div>
  </div>
);

export default DrawerCuenta;
