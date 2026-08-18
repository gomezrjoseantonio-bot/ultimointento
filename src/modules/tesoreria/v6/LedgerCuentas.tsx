// ============================================================================
// Ledger de cuentas · Tesorería V6 (rediseño §4.2 · iteración 5)
// ============================================================================
//
// El control por cuenta y el total, cerrado con Jose (18 ago 2026):
//   · columnas desdobladas · Saldo · Queda entrar · Queda salir · Cierre ·
//     Estado — todos los datos, cada uno en su columna;
//   · la ORDENACIÓN se hace DESDE LAS COLUMNAS · clic en la cabecera:
//     ascendente → descendente → de vuelta a tu orden manual (el de
//     arrastrar, que sigue siendo el punto de partida y se persiste);
//   · SIN colores de banco · la identidad de la fila es el nombre, con los
//     dígitos de la cuenta debajo;
//   · PAGINADO, como el ledger de Inversiones: pie con «1–6 de N» y flechas.
//
// Estados del set canónico (§4.2): texto gris sin chip, ámbar --warn con su
// punto solo en «se queda corta» (riesgo · §2.2 de la guía V5). Clic en la
// fila abre la bandeja de punteo de la cuenta; el clip sube un extracto ya
// fijado a ella.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, TreasuryEvent } from '../../../services/db';
import {
  estadoDeCuenta,
  resumenMesDeCuenta,
  type EstadoCuenta,
} from '../../../services/tesoreriaV6Metrics';
import {
  leerOrdenLedger,
  guardarOrdenLedger,
  type CampoLedger,
  type OrdenLedger,
} from './ordenCuentas';
import { importeConSigno, importeSaldo, diaYMes, mesCorto } from './formatoV6';
import styles from './LedgerCuentas.module.css';

/** Filas por página · el mismo aire que el ledger de Inversiones. */
const POR_PAGINA = 6;

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
  /** El orden manual nuevo completo, listo para persistir. */
  onReordenar: (ids: number[]) => void;
}

interface Fila {
  cuenta: Account;
  nombre: string;
  saldo: number;
  entra: number;
  sale: number;
  cierre: number;
  estado: EstadoCuenta;
}

/** El estado como magnitud · lo que más pide actuar pesa más. */
const pesoEstado = (e: EstadoCuenta): number =>
  e.tipo === 'se-queda-corta' ? 2 : e.tipo === 'por-confirmar' ? 1 : 0;

const comparadores: Record<CampoLedger, (a: Fila, b: Fila) => number> = {
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
  saldo: (a, b) => a.saldo - b.saldo,
  entra: (a, b) => a.entra - b.entra,
  sale: (a, b) => a.sale - b.sale,
  cierre: (a, b) => a.cierre - b.cierre,
  estado: (a, b) => pesoEstado(a.estado) - pesoEstado(b.estado),
};

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
  /** `null` = orden manual (el de arrastrar), que es el punto de partida. */
  const [orden, setOrden] = useState<OrdenLedger | null>(null);
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    let vivo = true;
    void leerOrdenLedger().then((o) => {
      if (vivo) setOrden(o);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Clic en cabecera · asc → desc → de vuelta al orden manual. */
  const ordenarPor = (campo: CampoLedger) => {
    const siguiente: OrdenLedger | null =
      orden?.campo !== campo
        ? { campo, dir: 'asc' }
        : orden.dir === 'asc'
          ? { campo, dir: 'desc' }
          : null;
    setOrden(siguiente);
    void guardarOrdenLedger(siguiente);
  };

  const manual = orden == null;

  const soltarSobre = (destinoId: number) => {
    if (!manual) return;
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

  // El TOTAL suma todas las cuentas, no la página · es el control del
  // conjunto y cuadra con el hero (las patas de un traspaso interno se anulan
  // entre cuentas; entrar/salir pueden diferir del hero exactamente en los
  // traspasos, que para el patrimonio no son flujo pero para cada cuenta sí).
  let totalSaldo = 0;
  let totalEntra = 0;
  let totalSale = 0;
  const filas: Fila[] = cuentas.map((c) => {
    const saldo = saldoPorCuenta.get(c.id!) ?? 0;
    const eventos = eventosPorCuenta.get(c.id!) ?? [];
    const resumen = resumenMesDeCuenta({ saldoHoy: saldo, eventos, year, month0 });
    const estado = estadoDeCuenta({ saldoHoy: saldo, eventos, year, month0, hoy });
    totalSaldo += saldo;
    totalEntra += resumen.entra;
    totalSale += resumen.sale;
    return {
      cuenta: c,
      nombre: c.alias || c.name || c.banco?.name || 'Cuenta',
      saldo,
      entra: resumen.entra,
      sale: resumen.sale,
      cierre: resumen.cierre,
      estado,
    };
  });
  const totalCierre = totalSaldo + totalEntra + totalSale;

  const ordenadas = manual
    ? filas
    : [...filas].sort((a, b) => {
        const d = comparadores[orden.campo](a, b);
        return orden.dir === 'asc' ? d : -d;
      });

  // Paginación · si al borrar cuentas la página queda fuera de rango, se
  // corrige el ESTADO y no solo el render.
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const pageSafe = Math.min(pagina, totalPaginas - 1);
  useEffect(() => {
    setPagina((p) => (p > totalPaginas - 1 ? Math.max(0, totalPaginas - 1) : p));
  }, [totalPaginas]);
  const visibles = ordenadas.slice(pageSafe * POR_PAGINA, (pageSafe + 1) * POR_PAGINA);

  if (cuentas.length === 0) {
    return <div className={styles.vacio}>Todavía no has dado de alta ninguna cuenta.</div>;
  }

  return (
    <div className={styles.lcard}>
      <div className={`${styles.gridCols} ${styles.head}`}>
        <Cab campo="nombre" orden={orden} onOrdenar={ordenarPor}>
          Cuenta
        </Cab>
        <Cab campo="saldo" num orden={orden} onOrdenar={ordenarPor}>
          Saldo
        </Cab>
        <Cab campo="entra" num orden={orden} onOrdenar={ordenarPor}>
          Queda entrar
        </Cab>
        <Cab campo="sale" num orden={orden} onOrdenar={ordenarPor}>
          Queda salir
        </Cab>
        <Cab campo="cierre" num orden={orden} onOrdenar={ordenarPor}>
          Cierre · {mesCorto(month0)}
        </Cab>
        <Cab campo="estado" orden={orden} onOrdenar={ordenarPor}>
          Estado
        </Cab>
        <span />
      </div>

      {visibles.map(({ cuenta: c, nombre, saldo, entra, sale, cierre, estado }) => {
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
            draggable={manual}
            onDragStart={() => manual && setArrastrando(c.id!)}
            onDragEnter={() => manual && setEncima(c.id!)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => {
              setArrastrando(null);
              setEncima(null);
            }}
            onDrop={() => soltarSobre(c.id!)}
          >
            {/* Identidad SIN color de banco · el nombre manda y los dígitos
                de la cuenta van debajo. */}
            <span className={styles.accId}>
              <span className={styles.accNm}>{nombre}</span>
              {mask && <span className={styles.accMask}>···· {mask}</span>}
            </span>
            <span className={`${styles.colNum} ${styles.saldo}`}>{importeSaldo(saldo)}</span>
            <span className={`${styles.colNum} ${styles.flujo} ${entra === 0 ? styles.flujoCero : ''}`}>
              {entra !== 0 ? importeConSigno(entra) : '—'}
            </span>
            <span className={`${styles.colNum} ${styles.flujo} ${sale === 0 ? styles.flujoCero : ''}`}>
              {sale !== 0 ? importeConSigno(-Math.abs(sale)) : '—'}
            </span>
            <span className={`${styles.colNum} ${styles.cierre}`}>{importeSaldo(cierre)}</span>
            <span className={styles.colEstado}>
              <EstadoFila estado={estado} />
            </span>
            <span className={styles.acciones}>
              {/* stopPropagation obligatorio: la fila entera es clicable y
                  abre la bandeja de punteo de la cuenta (§4.4). */}
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

      {/* El total · TODAS las cuentas, no la página · el control del conjunto. */}
      <div className={`${styles.gridCols} ${styles.total}`}>
        <span className={styles.totalLab}>
          Total · {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}
        </span>
        <span className={`${styles.colNum} ${styles.totalNum}`}>{importeSaldo(totalSaldo)}</span>
        <span className={`${styles.colNum} ${styles.totalFlujo}`}>
          {totalEntra !== 0 ? importeConSigno(totalEntra) : '—'}
        </span>
        <span className={`${styles.colNum} ${styles.totalFlujo}`}>
          {totalSale !== 0 ? importeConSigno(-Math.abs(totalSale)) : '—'}
        </span>
        <span className={`${styles.colNum} ${styles.totalNum}`}>{importeSaldo(totalCierre)}</span>
        <span className={styles.colEstado} />
        <span />
      </div>

      {/* El pie · recuento y paginación, como el ledger de Inversiones. */}
      {ordenadas.length > POR_PAGINA && (
        <div className={styles.foot}>
          <span className={styles.footInfo}>
            {pageSafe * POR_PAGINA + 1}–{Math.min((pageSafe + 1) * POR_PAGINA, ordenadas.length)} de{' '}
            {ordenadas.length}
          </span>
          <span className={styles.pager}>
            <button
              type="button"
              className={styles.pagerBtn}
              aria-label="Cuentas anteriores"
              disabled={pageSafe === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
            >
              <Icons.ChevronLeft size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={styles.pagerBtn}
              aria-label="Cuentas siguientes"
              disabled={pageSafe >= totalPaginas - 1}
              onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            >
              <Icons.ChevronRight size={14} strokeWidth={2} />
            </button>
          </span>
        </div>
      )}
    </div>
  );
};

/** Cabecera de columna · clic para ordenar · asc → desc → tu orden manual. */
const Cab: React.FC<{
  campo: CampoLedger;
  num?: boolean;
  orden: OrdenLedger | null;
  onOrdenar: (campo: CampoLedger) => void;
  children: React.ReactNode;
}> = ({ campo, num, orden, onOrdenar, children }) => {
  const activo = orden?.campo === campo;
  return (
    <button
      type="button"
      className={`${styles.cab} ${num ? styles.cabNum : ''} ${
        activo ? (orden!.dir === 'asc' ? styles.cabAsc : styles.cabDesc) : ''
      }`}
      onClick={() => onOrdenar(campo)}
      title={
        activo
          ? orden!.dir === 'asc'
            ? 'Otro clic · de mayor a menor'
            : 'Otro clic · volver a tu orden'
          : 'Ordenar por esta columna'
      }
    >
      {children}
    </button>
  );
};

/**
 * Un solo estado por fila · el set canónico de §4.2: texto gris sin chip, y
 * ámbar --warn con su punto SOLO en «se queda corta» — riesgo que pide
 * actuar (§2.2 de la guía V5).
 */
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
    return (
      <span className={styles.state}>
        <span className={styles.stateN}>{estado.n}</span> por confirmar
      </span>
    );
  }
  return <span className={styles.state}>al día</span>;
};

export default LedgerCuentas;
