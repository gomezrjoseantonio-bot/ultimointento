// ============================================================================
// Tesorería V6 · §3.5 · el cajón de una TARJETA
// ============================================================================
//
// Una tarjeta no es una cuenta —no tiene saldo— pero hasta ahora tampoco tenía
// dónde MIRARSE: al pulsarla se abría el asistente de configuración y sus
// compras no se veían por ningún lado. Este cajón es su espejo del cajón de
// banco: enseña el MES EN CURSO (las compras del periodo abierto) y, como dato,
// el recibo que se pagará el día de cargo —que no sale de la tarjeta, sale de la
// cuenta de liquidación: por eso es una tarjeta de crédito EXTERNA—.
//
// Lo que NO hace: tratar la tarjeta como cuenta con saldo. El dinero vive en el
// banco; aquí solo se ve lo que se va a pagar y con qué compras se forma.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import PunteoList from '../../shared/components/Punteo/PunteoList';
import { movimientoAItem } from '../../../services/punteo/punteoAdapter';
import type { ItemPunteo } from '../../../services/punteo/punteoModel';
import type { Account, Movement } from '../../../services/db';
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
  /** TODOS los movimientos · dentro se filtran los de esta tarjeta. */
  movimientos: Movement[];
  /** Lo que se pagará este periodo (previsto + compras) · lo calcula la página. */
  totalPeriodo: number;
  /** ISO yyyy-mm-dd. */
  hoy: string;
  inmuebles?: Array<{ id: number; alias: string }>;
  tarjetas?: Array<{ id: number; alias: string; modalidad?: Tarjeta['modalidad'] }>;
  onCerrar: () => void;
  /** El lápiz de la cabecera · abre el asistente de configuración. */
  onEditarTarjeta: (tarjeta: Tarjeta) => void;
  /** Guardar una compra (alta o edición) desde la ficha. */
  onGuardarFicha: (item: ItemPunteo | null, valores: GuardadoFicha) => void | Promise<void>;
  /** Borrar una compra anotada a mano. */
  onEliminar?: (item: ItemPunteo) => void | Promise<void>;
}

const DrawerTarjeta: React.FC<DrawerTarjetaProps> = ({
  tarjeta,
  banco,
  cuentas,
  movimientos,
  totalPeriodo,
  hoy,
  inmuebles = [],
  tarjetas = [],
  onCerrar,
  onEditarTarjeta,
  onGuardarFicha,
  onEliminar,
}) => {
  // `null` = ficha cerrada · `{item: null}` = anotar compra · con item = editar.
  const [ficha, setFicha] = useState<{ item: ItemPunteo | null } | null>(null);

  const abierto = tarjeta != null;

  // El periodo VIGENTE · el corte/cargo en el que caería una compra hecha hoy.
  const periodoActual = useMemo(() => {
    if (tarjeta?.id == null || tarjeta.modalidad !== 'credito' || !tarjeta.ciclo) return undefined;
    return recibosDeTarjeta(tarjeta as Tarjeta & { id: number }, [{ fecha: hoy, importe: 0.01 }])[0];
  }, [tarjeta, hoy]);

  // Las compras de crédito de ESTA tarjeta que caen en el periodo vigente · son
  // las que aún no se han cargado y forman el recibo que viene.
  const comprasVigentes = useMemo<ItemPunteo[]>(() => {
    if (tarjeta?.id == null || !periodoActual) return [];
    const id = tarjeta.id;
    return movimientos
      .filter((m): m is Movement & { id: number } => m.id != null)
      .filter((m) => m.tarjetaId === id && m.gastoTarjetaCredito === true && m.amount < 0)
      .filter((m) => {
        const [r] = recibosDeTarjeta(tarjeta as Tarjeta & { id: number }, [
          { fecha: (m.date ?? '').slice(0, 10), importe: Math.abs(m.amount) },
        ]);
        return r?.fechaCorte === periodoActual.fechaCorte;
      })
      .map((m) => movimientoAItem(m))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [movimientos, tarjeta, periodoActual]);

  if (!tarjeta) return null;

  const bancoNombre = banco?.alias || banco?.name || banco?.banco?.name || 'su cuenta';

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
            {periodoActual && (
              <Ak lab="Se cobra el" val={fechaLarga(periodoActual.fechaCargo)} />
            )}
            <Ak lab="En" val={bancoNombre} />
          </div>
        </div>

        <div className={styles.controles}>
          <span className={styles.tab + ' ' + styles.tabOn} aria-hidden="true">
            Compras de este periodo
          </span>
          <span className={styles.sp} />
          <button
            type="button"
            className={styles.btnCmp}
            onClick={() => setFicha({ item: null })}
          >
            <Icons.Plus size={13} strokeWidth={2} /> Anotar compra
          </button>
        </div>

        <div className={styles.body}>
          {comprasVigentes.length === 0 ? (
            <div className={styles.vacio}>
              <Icons.Tesoreria size={34} strokeWidth={1.6} className={styles.vacioIc} />
              <div className={styles.vacioT}>Sin compras este periodo</div>
              <div className={styles.vacioS}>
                lo que gastes con esta tarjeta aparece aquí y engorda el recibo a pagar
              </div>
            </div>
          ) : (
            <PunteoList
              items={comprasVigentes}
              chip="todos"
              onChipChange={() => undefined}
              mostrarChips={false}
              cuentas={[]}
              ocultarCuenta
              sinOrigen
              rowVariant="tesoreria"
              // Una compra ya es real (confirmada): no hay que puntearla ni
              // descartarla. Solo se edita o se borra desde el lápiz.
              onConfirmar={() => undefined}
              onNoPaso={() => undefined}
              onEditar={(item) => setFicha({ item })}
            />
          )}
        </div>
      </aside>

      {/* Anotar o editar una compra · la ficha abre con la tarjeta ya puesta. */}
      <FichaMovimiento
        abierta={ficha != null}
        esEdicion={ficha?.item != null}
        inicial={
          ficha?.item
            ? valoresDesdeItem(ficha.item, banco?.id ?? null)
            : {
                tipo: 'gasto',
                cuentaId: banco?.id ?? null,
                tarjetaId: tarjeta.id ?? null,
              }
        }
        cuentas={cuentas}
        inmuebles={inmuebles}
        tarjetas={tarjetas}
        onCerrar={() => setFicha(null)}
        onGuardar={async (v) => {
          await onGuardarFicha(ficha?.item ?? null, v);
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

export default DrawerTarjeta;
