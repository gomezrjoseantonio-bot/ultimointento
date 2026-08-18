// ============================================================================
// Ledger de cuentas · Tesorería V6 (rediseño §4.2)
// ============================================================================
//
// Sustituye al carrusel paginado. Con muchas cuentas corrientes el carrusel
// escondía la mitad detrás de un "1–5 de 10", y esta pantalla es justo donde
// hace falta el control POR CUENTA Y EL TOTAL: cada cuenta es una fila, todas
// a la vista, y la última fila es la suma.
//
// Cada fila dice lo que decide el trabajo del día: saldo hoy, lo que le queda
// al mes por entrar y por salir EN ESA CUENTA, su cierre proyectado y su
// estado (al día · N por confirmar · se queda corta). Clic en la fila abre la
// bandeja de la cuenta; el clip sube un extracto YA fijado a esa cuenta.
//
// El patrón visual es el ledger de Inversiones (`LedgerPosiciones`): cabecera
// en versalita sobre --card-alt, filas separadas por --line-2, números en mono
// tabular. Los números SIEMPRE en ink; el color solo donde hay que actuar (§5).
// ============================================================================

import React, { useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, TreasuryEvent } from '../../../services/db';
import {
  estadoDeCuenta,
  resumenMesDeCuenta,
  type EstadoCuenta,
} from '../../../services/tesoreriaV6Metrics';
import { colorDeBanco } from './bancoColores';
import { importeConSigno, importeSaldo, diaYMes, mesCorto } from './formatoV6';
import styles from './LedgerCuentas.module.css';

interface Props {
  cuentas: Account[];
  saldoPorCuenta: Map<number, number>;
  eventosPorCuenta: Map<number, TreasuryEvent[]>;
  year: number;
  month0: number;
  hoy: string;
  onAbrir: (id: number) => void;
  onEditar: (cuenta: Account) => void;
  onSubirExtracto: (cuenta: Account) => void;
  /** El orden nuevo completo, listo para persistir. */
  onReordenar: (ids: number[]) => void;
}

const LedgerCuentas: React.FC<Props> = ({
  cuentas,
  saldoPorCuenta,
  eventosPorCuenta,
  year,
  month0,
  hoy,
  onAbrir,
  onEditar,
  onSubirExtracto,
  onReordenar,
}) => {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [encima, setEncima] = useState<number | null>(null);

  const soltarSobre = (destinoId: number) => {
    if (arrastrando == null || arrastrando === destinoId) return;
    const ids = cuentas.map((c) => c.id!).filter((x) => x != null);
    const from = ids.indexOf(arrastrando);
    const to = ids.indexOf(destinoId);
    setArrastrando(null);
    setEncima(null);
    if (from < 0 || to < 0) return;
    const nuevo = [...ids];
    nuevo.splice(to, 0, ...nuevo.splice(from, 1));
    onReordenar(nuevo);
  };

  // La fila TOTAL suma las filas · así la tabla siempre cuadra consigo misma.
  // El cierre total coincide con el del hero (las dos patas de un traspaso
  // interno se anulan entre cuentas); entrar/salir pueden diferir del hero
  // exactamente en los traspasos, que para el patrimonio no son flujo pero
  // para cada cuenta sí.
  let totalSaldo = 0;
  let totalEntra = 0;
  let totalSale = 0;
  const filas = cuentas.map((c) => {
    const saldo = saldoPorCuenta.get(c.id!) ?? 0;
    const eventos = eventosPorCuenta.get(c.id!) ?? [];
    const resumen = resumenMesDeCuenta({ saldoHoy: saldo, eventos, year, month0 });
    const estado = estadoDeCuenta({ saldoHoy: saldo, eventos, year, month0, hoy });
    totalSaldo += saldo;
    totalEntra += resumen.entra;
    totalSale += resumen.sale;
    return { cuenta: c, saldo, resumen, estado };
  });
  const totalCierre = totalSaldo + totalEntra + totalSale;

  if (cuentas.length === 0) {
    return <div className={styles.vacio}>Todavía no has dado de alta ninguna cuenta.</div>;
  }

  return (
    <div className={styles.lcard}>
      <div className={`${styles.gridCols} ${styles.head}`}>
        <span>Cuenta</span>
        <span className={styles.colNum}>Saldo hoy</span>
        <span className={styles.colNum}>Queda entrar</span>
        <span className={styles.colNum}>Queda salir</span>
        <span className={styles.colNum}>Cierre {mesCorto(month0)}</span>
        <span className={styles.colEstado}>Estado</span>
        <span />
      </div>

      {filas.map(({ cuenta: c, saldo, resumen, estado }) => {
        const nombre = c.alias || c.name || c.banco?.name || 'Cuenta';
        const mask = (c.ultimosCuatro || c.iban?.slice(-4)) ?? '';
        return (
          <div
            key={c.id}
            className={`${styles.gridCols} ${styles.fila} ${
              arrastrando === c.id ? styles.filaDragging : ''
            } ${encima === c.id ? styles.filaOver : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onAbrir(c.id!)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAbrir(c.id!);
              }
            }}
            draggable
            onDragStart={() => setArrastrando(c.id!)}
            onDragEnter={() => setEncima(c.id!)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => {
              setArrastrando(null);
              setEncima(null);
            }}
            onDrop={() => soltarSobre(c.id!)}
          >
            <span className={styles.celCuenta}>
              <span className={styles.bankDot} style={{ background: colorDeBanco(c) }} />
              <span className={styles.accId}>
                <span className={styles.accNm}>{nombre}</span>
                {mask && <span className={styles.accMask}>···· {mask}</span>}
              </span>
            </span>
            <span className={`${styles.colNum} ${styles.saldo}`}>{importeSaldo(saldo)}</span>
            <span className={`${styles.colNum} ${styles.flujo}`}>
              {resumen.entra !== 0 ? importeConSigno(resumen.entra) : '—'}
            </span>
            <span className={`${styles.colNum} ${styles.flujo}`}>
              {resumen.sale !== 0 ? importeConSigno(resumen.sale) : '—'}
            </span>
            <span className={`${styles.colNum} ${styles.cierre}`}>
              {importeSaldo(resumen.cierre)}
            </span>
            <span className={styles.colEstado}>
              <EstadoFila estado={estado} />
            </span>
            <span className={styles.acciones}>
              {/* stopPropagation obligatorio: la fila entera es clicable. */}
              <button
                type="button"
                className={styles.accBtn}
                aria-label={`Subir extracto de ${nombre}`}
                title="Subir extracto de esta cuenta"
                onClick={(e) => {
                  e.stopPropagation();
                  onSubirExtracto(c);
                }}
              >
                <Icons.Upload size={14} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className={styles.accBtn}
                aria-label={`Editar ${nombre}`}
                title="Editar la cuenta"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar(c);
                }}
              >
                <Icons.Edit size={14} strokeWidth={1.8} />
              </button>
            </span>
          </div>
        );
      })}

      <div className={`${styles.gridCols} ${styles.total}`}>
        <span className={styles.totalLab}>
          Total · {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}
        </span>
        <span className={`${styles.colNum} ${styles.totalNum}`}>{importeSaldo(totalSaldo)}</span>
        <span className={`${styles.colNum} ${styles.totalFlujo}`}>
          {totalEntra !== 0 ? importeConSigno(totalEntra) : '—'}
        </span>
        <span className={`${styles.colNum} ${styles.totalFlujo}`}>
          {totalSale !== 0 ? importeConSigno(totalSale) : '—'}
        </span>
        <span className={`${styles.colNum} ${styles.totalNum}`}>{importeSaldo(totalCierre)}</span>
        <span className={styles.colEstado} />
        <span />
      </div>
    </div>
  );
};

/** Un solo estado por fila · el color solo aparece si hay que actuar (§4.2). */
const EstadoFila: React.FC<{ estado: EstadoCuenta }> = ({ estado }) => {
  if (estado.tipo === 'se-queda-corta') {
    return (
      <span className={`${styles.state} ${styles.stateAlerta}`}>
        <span className={styles.stateDot} />
        se queda en <span className={styles.stateVal}>{importeSaldo(estado.minimo)}</span> el{' '}
        {diaYMes(estado.dia)}
      </span>
    );
  }
  if (estado.tipo === 'por-confirmar') {
    // La cifra en mono y algo más de peso: es la tarea pendiente de la fila.
    return (
      <span className={styles.state}>
        <span className={styles.stateN}>{estado.n}</span> por confirmar
      </span>
    );
  }
  return <span className={`${styles.state} ${styles.stateOk}`}>al día</span>;
};

export default LedgerCuentas;
