// ============================================================================
// Tesorería V6 · §3.5 · el cajón de una TARJETA
// ============================================================================
//
// Una tarjeta no es una cuenta —no tiene saldo— pero sí una superficie de
// PUNTEO propia, espejo del cajón de banco. Sus gastos (las PIEZAS de los
// compromisos que pagan con ella + las compras sueltas anotadas a mano) se
// puntean uno a uno: previsto → confirmado. Su suma forma el RECIBO, que se paga
// en la cuenta de liquidación el día de cargo —no en la tarjeta, porque es una
// tarjeta de crédito EXTERNA—. El recibo es un DATO aquí, no un saldo.
//
// Foco en el MES EN CURSO: se enseña el periodo abierto, no el histórico.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import PunteoList from '../../shared/components/Punteo/PunteoList';
import { eventoAItem, movimientoAItem } from '../../../services/punteo/punteoAdapter';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import { etiquetaDeBaja } from '../../../services/punteo/accionesDePrevision';
import type { Account, Movement, TreasuryEvent } from '../../../services/db';
import type { Tarjeta } from '../../../types/tarjetas';
import { recibosDeTarjeta } from '../../../services/reciboDeTarjeta';
import { importeSaldo, fechaLarga } from './formatoV6';
import { describirTarjeta } from './textoTarjeta';
import FichaMovimiento, { type GuardadoFicha } from './FichaMovimiento';
import { valoresDesdeItem } from './fichaDesdeItem';
import styles from './DrawerV6.module.css';

export interface DrawerTarjetaProps {
  tarjeta: Tarjeta | null;
  /** La cuenta donde se liquida el recibo · para decir «se cobra en …». */
  banco?: Account;
  cuentas: Account[];
  /** TODOS los eventos · dentro se filtran las PIEZAS de esta tarjeta. */
  eventos: TreasuryEvent[];
  /** TODOS los movimientos · dentro se filtran las compras de esta tarjeta. */
  movimientos: Movement[];
  /** Lo que se pagará este periodo (recibo) · lo calcula la página. */
  totalPeriodo: number;
  /** ISO yyyy-mm-dd. */
  hoy: string;
  inmuebles?: Array<{ id: number; alias: string }>;
  tarjetas?: Array<{ id: number; alias: string; modalidad?: Tarjeta['modalidad'] }>;
  onCerrar: () => void;
  /** El lápiz de la cabecera · abre el asistente de configuración. */
  onEditarTarjeta: (tarjeta: Tarjeta) => void;
  /** Guardar una compra MANUAL (alta o edición) desde la ficha. */
  onGuardarFicha: (item: ItemPunteo | null, valores: GuardadoFicha) => void | Promise<void>;
  /** Borrar una compra anotada a mano. */
  onEliminar?: (item: ItemPunteo) => void | Promise<void>;
  /** Puntear una PIEZA · confirmar con su previsto. */
  onConfirmarPieza: (item: ItemPunteo) => void | Promise<void>;
  /** Confirmar una PIEZA con su importe REAL (desde la ficha). */
  onConfirmarPiezaImporte: (item: ItemPunteo, importe: number) => void | Promise<void>;
  /** Despuntear una PIEZA · vuelve a prevista. */
  onDespuntearPieza: (item: ItemPunteo) => void | Promise<void>;
  /** T4 · deshacer el descarte de una pieza · vuelve a la lista del recibo. */
  onRecuperar?: (item: ItemPunteo) => void | Promise<void>;
  /** Descartar una PIEZA · ese gasto no ocurre este periodo. */
  onDescartarPieza: (item: ItemPunteo) => void | Promise<void>;
}

type Pestana = 'porConfirmar' | 'confirmados' | 'movimientos';

const DrawerTarjeta: React.FC<DrawerTarjetaProps> = ({
  tarjeta,
  banco,
  cuentas,
  eventos,
  movimientos,
  totalPeriodo,
  hoy,
  inmuebles = [],
  tarjetas = [],
  onCerrar,
  onEditarTarjeta,
  onGuardarFicha,
  onEliminar,
  onConfirmarPieza,
  onConfirmarPiezaImporte,
  onDespuntearPieza,
  onRecuperar,
  onDescartarPieza,
}) => {
  const [pestana, setPestana] = useState<Pestana>('porConfirmar');
  // `null` = ficha cerrada · con `esPieza` sabemos si guardar confirma una pieza
  // (con su importe real) o da de alta/edita una compra manual.
  const [ficha, setFicha] = useState<{ item: ItemPunteo | null; esPieza: boolean } | null>(null);

  const abierto = tarjeta != null;

  // El periodo VIGENTE · el corte/cargo en el que caería una compra hecha hoy.
  const periodoActual = useMemo(() => {
    if (tarjeta?.id == null || tarjeta.modalidad !== 'credito' || !tarjeta.ciclo) return undefined;
    return recibosDeTarjeta(tarjeta as Tarjeta & { id: number }, [{ fecha: hoy, importe: 0.01 }])[0];
  }, [tarjeta, hoy]);

  const corteDe = (fecha: string, importe: number): string | undefined => {
    if (tarjeta?.id == null || !tarjeta.ciclo) return undefined;
    return recibosDeTarjeta(tarjeta as Tarjeta & { id: number }, [{ fecha, importe }])[0]?.fechaCorte;
  };

  // Las PIEZAS de esta tarjeta que caen en el periodo vigente.
  const piezasDelPeriodo = useMemo<TreasuryEvent[]>(() => {
    if (tarjeta?.id == null || !periodoActual) return [];
    const id = tarjeta.id;
    return eventos.filter(
      (e) =>
        e.id != null &&
        e.sourceType === 'gasto_tarjeta' &&
        e.tarjetaId === id &&
        // T4 · la descartada NO se esconde aquí. En una tarjeta son pocas, así
        // que se queda tachada en su sitio con «Recuperar» al lado: plegarla
        // abajo —como en la cuenta o en el día, que van llenos— sería esconder
        // una fila para que luego haya que ir a buscarla. Mismo modelo,
        // distinta densidad.
        corteDe((e.actualDate ?? e.predictedDate ?? '').slice(0, 10), Math.abs(e.actualAmount ?? e.amount)) ===
          periodoActual.fechaCorte
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos, tarjeta, periodoActual]);

  // Las compras MANUALES de crédito de esta tarjeta en el periodo vigente.
  const comprasDelPeriodo = useMemo<Movement[]>(() => {
    if (tarjeta?.id == null || !periodoActual) return [];
    const id = tarjeta.id;
    return movimientos.filter(
      (m) =>
        m.id != null &&
        m.tarjetaId === id &&
        m.gastoTarjetaCredito === true &&
        m.amount < 0 &&
        corteDe((m.date ?? '').slice(0, 10), Math.abs(m.amount)) === periodoActual.fechaCorte
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos, tarjeta, periodoActual]);

  const desc = (a: ItemPunteo, b: ItemPunteo) => b.fecha.localeCompare(a.fecha);
  // Una pieza avalada por el extracto de la tarjeta sube a CONCILIADO.
  const piezaItem = (e: TreasuryEvent): ItemPunteo => {
    const it = eventoAItem(e as TreasuryEvent & { id: number });
    return e.conciliadoExtracto ? { ...it, estado: 'conciliado' } : it;
  };
  const compraItem = (m: Movement) => movimientoAItem(m as Movement & { id: number });

  // Por confirmar: piezas previstas que ya deberían haber ocurrido (fecha ≤ hoy).
  const itemsPorConfirmar = useMemo<ItemPunteo[]>(
    () =>
      piezasDelPeriodo
        .filter((e) => e.status === 'predicted' && (e.predictedDate ?? '').slice(0, 10) <= hoy)
        .map(piezaItem)
        .sort(desc),
    [piezasDelPeriodo, hoy]
  );

  // Confirmados: piezas confirmadas + las compras manuales (tu palabra).
  const itemsConfirmados = useMemo<ItemPunteo[]>(
    () =>
      [
        ...piezasDelPeriodo.filter((e) => e.status !== 'predicted').map(piezaItem),
        ...comprasDelPeriodo.map(compraItem),
      ].sort(desc),
    [piezasDelPeriodo, comprasDelPeriodo]
  );

  // Movimientos: todo lo del periodo, como consulta.
  const itemsMovimientos = useMemo<ItemPunteo[]>(
    () => [...piezasDelPeriodo.map(piezaItem), ...comprasDelPeriodo.map(compraItem)].sort(desc),
    [piezasDelPeriodo, comprasDelPeriodo]
  );

  if (!tarjeta) return null;

  const bancoNombre = banco?.alias || banco?.name || banco?.banco?.name || 'su cuenta';
  const esPieza = (item: ItemPunteo) => item.kind === 'evento';

  const items =
    pestana === 'porConfirmar' ? itemsPorConfirmar : pestana === 'confirmados' ? itemsConfirmados : itemsMovimientos;

  return (
    <>
      <div className={`${styles.back} ${abierto ? styles.backOpen : ''}`} onClick={onCerrar} aria-hidden="true" />
      <aside
        className={`${styles.drw} ${abierto ? styles.drwOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Tarjeta ${tarjeta.alias}`}
      >
        <div className={styles.hd}>
          <div className={styles.hdTop}>
            <div>
              <h2 className={styles.hdTitle}>{tarjeta.alias}</h2>
              <div className={styles.hdMask}>{describirTarjeta(tarjeta, cuentas)}</div>
            </div>
            <button
              type="button"
              className={styles.hdClose}
              onClick={() => onEditarTarjeta(tarjeta)}
              aria-label="Editar tarjeta"
              title="Editar tarjeta"
            >
              <Icons.Edit size={16} strokeWidth={2} />
            </button>
            <button type="button" className={styles.hdClose} onClick={onCerrar} aria-label="Cerrar">
              <Icons.Close size={17} strokeWidth={2} />
            </button>
          </div>

          {/* El recibo es un DATO · no es saldo. Se paga en el banco de
              liquidación el día de cargo, porque la tarjeta es externa. */}
          <div className={styles.kpis}>
            <Ak lab="Recibo de este periodo" val={importeSaldo(totalPeriodo)} gold />
            {periodoActual && <Ak lab="Se cobra el" val={fechaLarga(periodoActual.fechaCargo)} />}
            <Ak lab="En" val={bancoNombre} />
          </div>
        </div>

        <div className={styles.controles}>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'porConfirmar' ? styles.tabOn : ''}`}
            onClick={() => setPestana('porConfirmar')}
          >
            Por confirmar
          </button>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'confirmados' ? styles.tabOn : ''}`}
            onClick={() => setPestana('confirmados')}
          >
            Confirmados
          </button>
          <button
            type="button"
            className={`${styles.tab} ${pestana === 'movimientos' ? styles.tabOn : ''}`}
            onClick={() => setPestana('movimientos')}
          >
            Movimientos
          </button>
          <span className={styles.sp} />
          <button type="button" className={styles.btnCmp} onClick={() => setFicha({ item: null, esPieza: false })}>
            <Icons.Plus size={13} strokeWidth={2} /> Anotar compra
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.vacio}>
              <Icons.Tesoreria size={34} strokeWidth={1.6} className={styles.vacioIc} />
              <div className={styles.vacioT}>
                {pestana === 'porConfirmar' ? 'Nada por confirmar este periodo' : 'Sin movimientos este periodo'}
              </div>
              <div className={styles.vacioS}>
                {pestana === 'porConfirmar'
                  ? 'los gastos que pagas con esta tarjeta aparecen aquí para confirmarlos'
                  : 'lo que gastes con esta tarjeta forma el recibo a pagar'}
              </div>
            </div>
          ) : (
            <PunteoList
              items={items}
              chip="todos"
              onChipChange={() => undefined}
              mostrarChips={false}
              cuentas={[]}
              ocultarCuenta
              sinOrigen
              rowVariant="tesoreria"
              soloLectura={pestana === 'movimientos'}
              // Confirmar/despuntear/descartar solo aplica a las PIEZAS; una compra
              // manual ya es real y se edita/borra desde el lápiz.
              onConfirmar={(item) => (esPieza(item) ? onConfirmarPieza(item) : undefined)}
              onNoPaso={(item) => (esPieza(item) ? onDescartarPieza(item) : undefined)}
              onDespuntear={pestana === 'confirmados' ? (item) => (esPieza(item) ? onDespuntearPieza(item) : undefined) : undefined}
              // T4 · «Recuperar», en la propia fila tachada.
              onRecuperar={onRecuperar && ((item) => (esPieza(item) ? onRecuperar(item) : undefined))}
              onEditar={(item) => setFicha({ item, esPieza: esPieza(item) })}
            />
          )}
        </div>
      </aside>

      {/* La ficha · anotar/editar una compra manual, o confirmar una pieza con su
          importe real (el usuario ajusta lo previsto a lo que de verdad gastó). */}
      <FichaMovimiento
        abierta={ficha != null}
        esEdicion={ficha?.item != null}
        inicial={
          ficha?.item
            ? valoresDesdeItem(ficha.item, banco?.id ?? null)
            : { tipo: 'gasto', cuentaId: banco?.id ?? null, tarjetaId: tarjeta.id ?? null }
        }
        cuentas={cuentas}
        inmuebles={inmuebles}
        tarjetas={tarjetas}
        onCerrar={() => setFicha(null)}
        onGuardar={async (v) => {
          if (ficha?.esPieza && ficha.item) await onConfirmarPiezaImporte(ficha.item, v.importe);
          else await onGuardarFicha(ficha?.item ?? null, v);
          setFicha(null);
        }}
        etiquetaEliminar={ficha?.item ? etiquetaDeBaja(ficha.item) : undefined}
        onEliminar={
          ficha?.item && !ficha.esPieza && onEliminar
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

export default DrawerTarjeta;
