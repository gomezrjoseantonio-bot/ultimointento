// ============================================================================
// Ledger de cuentas · Tesorería V6 (rediseño §4.2 · iteración 3)
// ============================================================================
//
// Con muchas cuentas corrientes hace falta el control POR CUENTA Y EL TOTAL:
// cada cuenta es una fila, todas a la vista, y el pie es la suma.
//
// Pero un banco privado no enseña una hoja de cálculo (feedback Jose · 18 ago
// 2026: «demasiado número · tabla de excel»). Cada fila lleva DOS cifras y
// nada más: el saldo, grande, y su cierre del mes, pequeño debajo. Lo demás
// se dice sin números:
//   · la BARRA DE PESO, en el color del banco, dice cuánto de mi dinero vive
//     en esa cuenta — el mismo lenguaje que el «peso en cartera» de
//     Inversiones, y el mismo punto de color en todo el módulo;
//   · el ESTADO es un chip solo cuando pide actuar: navy para la tarea («3
//     por confirmar»), rojo para el problema («se queda en −X el día D» ·
//     quedarse en negativo es un problema, no una advertencia dorada);
//   · «al día» es texto mudo · lo que está bien no grita.
//
// Lo que le quede al mes por entrar y salir NO va aquí: eso ya lo dicen el
// hero (total) y la previsión (mes a mes) — repetirlo por fila era el
// «demasiado número».
//
// El ORDEN es del usuario: a mano arrastrando (el de siempre) o por un campo
// desde el selector de arriba. Sin cabeceras clicables: la cabecera de
// columnas era la mitad del aspecto de hoja de cálculo. La elección se
// persiste (`ordenLedger`).
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
import { importeSaldo, diaYMes, mesCorto } from './formatoV6';
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
  cierre: number;
  estado: EstadoCuenta;
}

/** El estado como magnitud · lo que más pide actuar pesa más. */
const pesoEstado = (e: EstadoCuenta): number =>
  e.tipo === 'se-queda-corta' ? 2 : e.tipo === 'por-confirmar' ? 1 : 0;

/**
 * Cada campo ordena en SU dirección natural · el dinero de mayor a menor, el
 * estado del que arde al que espera, el nombre de la A a la Z. Elegir campo y
 * dirección por separado es vocabulario de hoja de cálculo.
 */
const ORDENES: Partial<Record<CampoLedger, { dir: 'asc' | 'desc'; cmp: (a: Fila, b: Fila) => number }>> = {
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

  // El pie suma las filas · así la lista siempre cuadra consigo misma y con
  // el hero (las dos patas de un traspaso interno se anulan entre cuentas).
  let totalSaldo = 0;
  let totalCierre = 0;
  const filas: Fila[] = cuentas.map((c) => {
    const saldo = saldoPorCuenta.get(c.id!) ?? 0;
    const eventos = eventosPorCuenta.get(c.id!) ?? [];
    const resumen = resumenMesDeCuenta({ saldoHoy: saldo, eventos, year, month0 });
    const estado = estadoDeCuenta({ saldoHoy: saldo, eventos, year, month0, hoy });
    totalSaldo += saldo;
    totalCierre += resumen.cierre;
    return {
      cuenta: c,
      nombre: c.alias || c.name || c.banco?.name || 'Cuenta',
      saldo,
      cierre: resumen.cierre,
      estado,
    };
  });

  // La barra de peso · qué parte de mi dinero vive en cada cuenta. Sobre el
  // total POSITIVO: una cuenta en negativo no «pesa», avisa (y para eso está
  // su chip).
  const totalPositivo = filas.reduce((s, f) => s + Math.max(0, f.saldo), 0);

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
        {visibles.map(({ cuenta: c, nombre, saldo, cierre, estado }, i) => {
          const mask = (c.ultimosCuatro || c.iban?.slice(-4)) ?? '';
          const color = colorDeBanco(c);
          const peso = totalPositivo > 0 ? Math.max(0, saldo) / totalPositivo : 0;
          return (
            <div
              key={c.id}
              className={`${styles.fila} ${arrastrando === c.id ? styles.filaDragging : ''} ${
                encima === c.id ? styles.filaOver : ''
              }`}
              style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
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
              <span className={styles.celCuenta}>
                <span className={styles.bankDot} style={{ background: color }} />
                <span className={styles.accId}>
                  <span className={styles.accNm}>{nombre}</span>
                  {mask && <span className={styles.accMask}>···· {mask}</span>}
                </span>
              </span>

              {/* Cuánto de mi dinero vive aquí · sin cifra: la proporción SE VE.
                  El detalle exacto ya lo da el saldo de al lado. */}
              <span
                className={styles.peso}
                title={`${Math.round(peso * 100)} % del saldo total`}
                aria-hidden="true"
              >
                <span
                  className={styles.pesoFill}
                  style={{ width: `${Math.max(peso > 0 ? 2.5 : 0, peso * 100)}%`, background: color }}
                />
              </span>

              <span className={styles.colEstado}>
                <EstadoFila estado={estado} />
              </span>

              <span className={styles.dinero}>
                <span className={styles.saldo}>{importeSaldo(saldo)}</span>
                {/* El cierre, SOLO cuando difiere del saldo: si al mes no le
                    queda nada en esta cuenta, repetir la cifra es ruido. */}
                {cierre !== saldo && (
                  <span className={styles.cierreSub}>
                    cierre {mesCorto(month0)} · {importeSaldo(cierre)}
                  </span>
                )}
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

        {/* El cuadre, en una línea muda · el protagonismo es de las filas. */}
        <div className={styles.foot}>
          <span className={styles.footLab}>
            Total · {cuentas.length} {cuentas.length === 1 ? 'cuenta' : 'cuentas'}
          </span>
          <span className={styles.footNum}>
            {importeSaldo(totalSaldo)}
            <span className={styles.footSub}>
              cierre {mesCorto(month0)} · {importeSaldo(totalCierre)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Un solo estado por fila · y el color con SEMÁNTICA (feedback 18 ago 2026):
 * navy-wash para la tarea, rojo para el problema. Nada de ámbar-oro en una
 * alerta: el oro de este módulo es del veredicto, no del peligro.
 */
const EstadoFila: React.FC<{ estado: EstadoCuenta }> = ({ estado }) => {
  if (estado.tipo === 'se-queda-corta') {
    return (
      <span className={`${styles.chip} ${styles.chipAlerta}`}>
        se queda en <span className={styles.chipVal}>{importeSaldo(estado.minimo)}</span> el{' '}
        {diaYMes(estado.dia)}
      </span>
    );
  }
  if (estado.tipo === 'por-confirmar') {
    return (
      <span className={`${styles.chip} ${styles.chipTarea}`}>
        <span className={styles.chipVal}>{estado.n}</span> por confirmar
      </span>
    );
  }
  return <span className={styles.alDia}>al día</span>;
};

export default LedgerCuentas;
