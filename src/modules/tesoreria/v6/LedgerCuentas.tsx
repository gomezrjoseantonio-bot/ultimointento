// ============================================================================
// Ledger de cuentas · Tesorería V6 (rediseño §4.2 · iteración 4)
// ============================================================================
//
// Con muchas cuentas corrientes hace falta el control POR CUENTA Y EL TOTAL:
// cada cuenta es una fila, todas a la vista, y el pie es la suma. TODOS los
// datos de la fila son necesarios (Jose · 18 ago 2026): saldo, lo que queda
// por entrar y salir este mes, el cierre proyectado y el estado.
//
// Lo que se trabaja es CÓMO se leen, con el patrón del ledger de Inversiones
// (`LedgerPosiciones`) y la GUIA-DISENO-V5 en la mano:
//   · cabecera silenciosa · versalita 9.5 ink-5 sobre card-alt, sin flechas
//     de orden (el orden vive en el selector de arriba);
//   · la celda de cuenta es rica: punto del banco, nombre, máscara y el
//     ESTADO debajo como segunda línea — texto gris, sin chip (§4.2), y
//     ámbar --warn con su punto solo en «se queda corta», que es el único
//     que pide actuar (§2.2 de la guía: warn = riesgo · atención);
//   · «queda entrar / salir» comparten UNA columna, apiladas con su flecha:
//     cuatro datos, tres columnas de cifra — la fila respira;
//   · jerarquía tipográfica: el saldo manda (700 ink), el cierre confirma
//     (700 ink-2), los flujos acompañan (600 ink-2) y los ceros callan
//     (ink-5), todo en mono tabular alineado a la derecha.
//
// Animaciones: solo el hover permitido por la guía (§15). El orden es del
// usuario: arrastrando (por defecto) o por campo desde el selector; la
// elección se persiste (`ordenLedger`).
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account, TreasuryEvent } from '../../../services/db';
import {
  estadoDeCuenta,
  resumenMesDeCuenta,
  type EstadoCuenta,
} from '../../../services/tesoreriaV6Metrics';
import { colorDeBanco } from './bancoColores';
import {
  leerOrdenLedger,
  guardarOrdenLedger,
  type CampoLedger,
  type OrdenLedger,
} from './ordenCuentas';
import { importeConSigno, importeSaldo, diaYMes, nombreMes, mesCorto } from './formatoV6';
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

/**
 * Cada campo ordena en SU dirección natural · el dinero de mayor a menor, el
 * estado del que pide actuar al que espera, el nombre de la A a la Z.
 */
const ORDENES: Partial<
  Record<CampoLedger, { dir: 'asc' | 'desc'; cmp: (a: Fila, b: Fila) => number }>
> = {
  saldo: { dir: 'desc', cmp: (a, b) => a.saldo - b.saldo },
  cierre: { dir: 'desc', cmp: (a, b) => a.cierre - b.cierre },
  estado: { dir: 'desc', cmp: (a, b) => pesoEstado(a.estado) - pesoEstado(b.estado) },
  nombre: { dir: 'asc', cmp: (a, b) => a.nombre.localeCompare(b.nombre, 'es') },
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

  useEffect(() => {
    let vivo = true;
    void leerOrdenLedger().then((o) => {
      if (vivo) setOrden(o);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const elegirOrden = (valor: string) => {
    const regla = ORDENES[valor as CampoLedger];
    const siguiente: OrdenLedger | null = regla
      ? { campo: valor as CampoLedger, dir: regla.dir }
      : null;
    setOrden(siguiente);
    void guardarOrdenLedger(siguiente);
  };

  const manual = orden == null || ORDENES[orden.campo] == null;

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

  // El pie suma las filas · así el ledger cuadra consigo mismo y con el hero
  // (las dos patas de un traspaso interno se anulan entre cuentas; en
  // entrar/salir pueden diferir del hero exactamente en los traspasos, que
  // para el patrimonio no son flujo pero para cada cuenta sí).
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

  const visibles = manual
    ? filas
    : [...filas].sort((a, b) => {
        const regla = ORDENES[orden!.campo]!;
        const d = regla.cmp(a, b);
        return regla.dir === 'asc' ? d : -d;
      });

  if (cuentas.length === 0) {
    return <div className={styles.vacio}>Todavía no has dado de alta ninguna cuenta.</div>;
  }

  const mes = nombreMes(month0);

  return (
    <div>
      <div className={styles.barra}>
        {manual && cuentas.length > 1 && (
          <span className={styles.pista}>arrastra las filas para ordenarlas a tu gusto</span>
        )}
        <label className={styles.ordenCtl}>
          <span className={styles.ordenLab}>Ordenar</span>
          <select
            className={styles.ordenSel}
            value={manual ? 'manual' : orden!.campo}
            onChange={(e) => elegirOrden(e.target.value)}
            aria-label="Ordenar las cuentas"
          >
            <option value="manual">a mi manera</option>
            <option value="saldo">por saldo</option>
            <option value="cierre">por cierre del mes</option>
            <option value="estado">por estado</option>
            <option value="nombre">por nombre</option>
          </select>
        </label>
      </div>

      <div className={styles.lcard}>
        {/* Cabecera silenciosa · el mismo registro que el ledger de
            Inversiones: dice qué es cada columna y se aparta. */}
        <div className={`${styles.gridCols} ${styles.head}`}>
          <span>Cuenta</span>
          <span className={styles.colNum}>Saldo</span>
          <span className={styles.colNum}>Queda en {mes}</span>
          <span className={styles.colNum}>Cierre · {mesCorto(month0)}</span>
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
              {/* La celda rica · identidad arriba, estado debajo. */}
              <span className={styles.celCuenta}>
                <span className={styles.bankDot} style={{ background: colorDeBanco(c) }} />
                <span className={styles.accId}>
                  <span className={styles.accLinea}>
                    <span className={styles.accNm}>{nombre}</span>
                    {mask && <span className={styles.accMask}>···· {mask}</span>}
                  </span>
                  <EstadoFila estado={estado} />
                </span>
              </span>

              <span className={`${styles.colNum} ${styles.saldo}`}>{importeSaldo(saldo)}</span>

              {/* Queda entrar / salir · una columna, apilados con su flecha.
                  Los ceros callan (ink-5) y si no queda NADA, un guion mudo:
                  dos «0 €» apilados en media lista es justo el ruido que esta
                  columna no puede permitirse. */}
              <span className={`${styles.colNum} ${styles.flujos}`}>
                {entra === 0 && sale === 0 ? (
                  <span className={styles.flujoNada}>—</span>
                ) : (
                  <>
                    <span className={`${styles.flujo} ${entra === 0 ? styles.flujoCero : ''}`}>
                      <Icons.ArrowUp size={11} strokeWidth={2} />
                      {importeConSigno(entra)}
                    </span>
                    <span className={`${styles.flujo} ${sale === 0 ? styles.flujoCero : ''}`}>
                      <Icons.ArrowDown size={11} strokeWidth={2} />
                      {importeConSigno(-Math.abs(sale))}
                    </span>
                  </>
                )}
              </span>

              <span className={`${styles.colNum} ${styles.cierre}`}>{importeSaldo(cierre)}</span>

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

        {/* El total · el control del conjunto, en las mismas verticales. */}
        <div className={`${styles.gridCols} ${styles.total}`}>
          <span className={styles.totalLab}>
            Total · {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}
          </span>
          <span className={`${styles.colNum} ${styles.totalNum}`}>{importeSaldo(totalSaldo)}</span>
          <span className={`${styles.colNum} ${styles.flujos}`}>
            <span className={`${styles.flujo} ${totalEntra === 0 ? styles.flujoCero : ''}`}>
              <Icons.ArrowUp size={11} strokeWidth={2} />
              {importeConSigno(totalEntra)}
            </span>
            <span className={`${styles.flujo} ${totalSale === 0 ? styles.flujoCero : ''}`}>
              <Icons.ArrowDown size={11} strokeWidth={2} />
              {importeConSigno(-Math.abs(totalSale))}
            </span>
          </span>
          <span className={`${styles.colNum} ${styles.totalNum}`}>{importeSaldo(totalCierre)}</span>
          <span />
        </div>
      </div>
    </div>
  );
};

/**
 * Un solo estado por fila, bajo el nombre · exactamente el vocabulario del
 * carrusel que este ledger sustituye (§4.2): texto gris sin chip, y ámbar
 * --warn con su punto SOLO en «se queda corta» — el único que pide actuar.
 * Es el color que la guía V5 reserva al riesgo (§2.2); el rojo --neg es
 * pérdida consumada y aquí no ha pasado nada todavía.
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
