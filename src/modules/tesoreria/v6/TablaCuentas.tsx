// ============================================================================
// Tesorería V9 · tabla de cuentas (sustituye al carrusel de §4.2)
// ============================================================================
//
// Mockup: `docs/mockups/atlas-bancos-grafico-v5.html`. Decisión 4 del spec:
// tabla LOCAL al módulo, ordenable por cabecera y paginable en cliente — el
// design system v5 no tiene componente de tabla todavía y no se crea aquí.
//
// Es el CUERPO de la vista "Cuentas": la card, el título y los botones viven
// en `MisBancos`, que la alterna con la lista de tarjetas. Aquí solo queda la
// tabla, para que las dos mitades compartan un único marco.
//
// Los números salen de la capa canónica: `cierrePorCuenta` (columna Cierre) y
// `estadoDeCuenta` (columna Estado). La fila Total NO suma por su cuenta: pinta
// los números del hero (`KpisHero`), que por construcción son la misma cifra —
// y así se ve en pantalla que la tabla y el héroe cuentan lo mismo.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../../../design-system/v5';
import type { Account } from '../../../services/db';
import type { EstadoCuenta, KpisHero } from '../../../services/tesoreriaV6Metrics';
import { diaYMes, importeConSigno, importeSaldo } from './formatoV6';
import styles from './TablaCuentas.module.css';

export interface FilaCuenta {
  cuenta: Account;
  nombre: string;
  /** Últimos 4 del IBAN · '' si no hay. */
  mask: string;
  saldo: number;
  entra: number;
  /** Negativo. */
  sale: number;
  cierre: number;
  estado: EstadoCuenta;
}

type Columna = 'nombre' | 'saldo' | 'entra' | 'sale' | 'cierre' | 'estado';

const POR_PAGINA = 5;

/** Orden del chip de estado: lo que pide actuar, primero. */
const rangoEstado = (e: EstadoCuenta): number =>
  e.tipo === 'se-queda-corta' ? 0 : e.tipo === 'por-confirmar' ? 1 : 2;

interface Props {
  filas: FilaCuenta[];
  kpis: KpisHero;
  mesActual: string;
  onAbrir: (cuenta: Account) => void;
  onEditar: (cuenta: Account) => void;
  onEliminar: (cuenta: Account) => void;
}

const TablaCuentas: React.FC<Props> = ({
  filas,
  kpis,
  mesActual,
  onAbrir,
  onEditar,
  onEliminar,
}) => {
  const [orden, setOrden] = useState<{ col: Columna; dir: 1 | -1 } | null>(null);
  const [pagina, setPagina] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);

  // Cerrar el menú "⋯" al pinchar fuera o con Escape.
  useEffect(() => {
    if (menuAbierto == null) return;
    const cerrar = () => setMenuAbierto(null);
    const porTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('click', cerrar);
    document.addEventListener('keydown', porTecla);
    return () => {
      document.removeEventListener('click', cerrar);
      document.removeEventListener('keydown', porTecla);
    };
  }, [menuAbierto]);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const { col, dir } = orden;
    return filas
      .slice()
      .sort((a, b) =>
        col === 'nombre'
          ? dir * a.nombre.localeCompare(b.nombre, 'es')
          : col === 'estado'
            ? dir * (rangoEstado(a.estado) - rangoEstado(b.estado))
            : dir * (a[col] - b[col])
      );
  }, [filas, orden]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const pageSafe = Math.min(pagina, totalPaginas - 1);
  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas - 1));
  }, [totalPaginas]);
  const visibles = ordenadas.slice(pageSafe * POR_PAGINA, (pageSafe + 1) * POR_PAGINA);

  const ordenarPor = (col: Columna) => {
    setMenuAbierto(null);
    setOrden((o) =>
      o?.col === col
        ? { col, dir: o.dir === 1 ? -1 : 1 }
        : // Los importes empiezan de mayor a menor · el nombre, A→Z.
          { col, dir: col === 'nombre' ? 1 : -1 }
    );
  };

  // Función de render y NO un componente anidado: un componente definido
  // dentro del render cambia de identidad en cada pasada y React lo REMONTA,
  // perdiendo foco y nodos entre clics.
  const th = (col: Columna, rotulo: React.ReactNode, num?: boolean) => (
    <th
      className={`${styles.th} ${num ? styles.der : ''} ${orden?.col === col ? styles.thActiva : ''}`}
      aria-sort={orden?.col === col ? (orden.dir === 1 ? 'ascending' : 'descending') : undefined}
    >
      <button type="button" className={styles.thBtn} onClick={() => ordenarPor(col)}>
        {rotulo}
        <span className={styles.thInd} aria-hidden="true">
          {orden?.col === col ? (orden.dir === 1 ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );

  return (
    <>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {th('nombre', 'Cuenta')}
            {th('saldo', 'Saldo hoy', true)}
            {th('entra', 'Queda entrar', true)}
            {th('sale', 'Queda salir', true)}
            {th('cierre', `Cierre ${mesActual}`, true)}
            {th('estado', 'Estado', true)}
            <th className={styles.th} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {visibles.map((f) => (
            <tr
              key={f.cuenta.id}
              className={`${styles.fila} ${f.estado.tipo === 'se-queda-corta' ? styles.filaRiesgo : ''}`}
              tabIndex={0}
              onClick={() => onAbrir(f.cuenta)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAbrir(f.cuenta);
                }
              }}
            >
              <td className={styles.td}>
                {/* Sin punto ni logo de banco · el color no distinguía nada
                    que el nombre no diga ya, y ensuciaba una fila que es toda
                    cifras (decisión de Jose · F1). */}
                <div className={styles.id}>
                  <div className={styles.idTx}>
                    <div className={styles.nombre}>{f.nombre}</div>
                    {f.mask && <div className={styles.mask}>···· {f.mask}</div>}
                  </div>
                </div>
              </td>
              <td className={`${styles.td} ${styles.der}`}>
                <span className={styles.fuerte}>{importeSaldo(f.saldo)}</span>
              </td>
              <td className={`${styles.td} ${styles.der}`}>
                {f.entra === 0 ? <span className={styles.mudo}>—</span> : importeConSigno(f.entra)}
              </td>
              <td className={`${styles.td} ${styles.der}`}>
                {f.sale === 0 ? <span className={styles.mudo}>—</span> : importeConSigno(f.sale)}
              </td>
              <td className={`${styles.td} ${styles.der}`}>
                <span className={styles.fuerte}>{importeSaldo(f.cierre)}</span>
              </td>
              <td className={`${styles.td} ${styles.der}`}>
                {/* "al día" no pinta nada (decisión del spec · celda en blanco). */}
                {f.estado.tipo === 'por-confirmar' && (
                  <span className={styles.estadoConf}>
                    <span className={styles.puntoEstado} aria-hidden="true" />
                    {f.estado.n} por confirmar
                  </span>
                )}
                {f.estado.tipo === 'se-queda-corta' && (
                  <span className={styles.estadoDesc}>
                    <span className={styles.puntoEstadoBlanco} aria-hidden="true" />
                    descubierto · {diaYMes(f.estado.dia)}
                  </span>
                )}
              </td>
              <td className={`${styles.td} ${styles.tdKebab}`}>
                <button
                  type="button"
                  className={`${styles.kebab} ${menuAbierto === f.cuenta.id ? styles.kebabFijo : ''}`}
                  aria-label={`Acciones de ${f.nombre}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAbierto((m) => (m === f.cuenta.id ? null : f.cuenta.id!));
                  }}
                >
                  <Icons.More size={15} strokeWidth={2} />
                </button>
                {menuAbierto === f.cuenta.id && (
                  <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => { setMenuAbierto(null); onAbrir(f.cuenta); }}>
                      <Icons.Check size={14} strokeWidth={1.9} /> Confirmar movimientos
                    </button>
                    <button type="button" onClick={() => { setMenuAbierto(null); onEditar(f.cuenta); }}>
                      <Icons.Edit size={14} strokeWidth={1.9} /> Editar cuenta
                    </button>
                    <div className={styles.menuSep} />
                    <button
                      type="button"
                      className={styles.menuBaja}
                      onClick={() => { setMenuAbierto(null); onEliminar(f.cuenta); }}
                    >
                      <Icons.Delete size={14} strokeWidth={1.9} /> Eliminar cuenta
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={styles.pie}>
            <td className={styles.td}>
              Total · {kpis.numCuentas} {kpis.numCuentas === 1 ? 'cuenta' : 'cuentas'}
            </td>
            <td className={`${styles.td} ${styles.der}`}>{importeSaldo(kpis.saldo)}</td>
            <td className={`${styles.td} ${styles.der}`}>
              {kpis.pendienteEntrar === 0 ? <span className={styles.mudo}>—</span> : importeConSigno(kpis.pendienteEntrar)}
            </td>
            <td className={`${styles.td} ${styles.der}`}>
              {kpis.pendienteSalir === 0 ? <span className={styles.mudo}>—</span> : importeConSigno(kpis.pendienteSalir)}
            </td>
            <td className={`${styles.td} ${styles.der}`}>
              {/* El MISMO número que el hero · en oro, la cifra-veredicto. */}
              <span className={styles.oro}>{importeSaldo(kpis.cierre)}</span>
            </td>
            <td className={styles.td} />
            <td className={styles.td} />
          </tr>
        </tfoot>
      </table>

      {ordenadas.length > POR_PAGINA && (
        <div className={styles.foot}>
          <span className={styles.rango}>
            {Math.min((pageSafe + 1) * POR_PAGINA, ordenadas.length)} de {ordenadas.length}
          </span>
          <button
            type="button"
            className={styles.flecha}
            aria-label="Cuentas anteriores"
            disabled={pageSafe === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            <Icons.ChevronLeft size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={styles.flecha}
            aria-label="Cuentas siguientes"
            disabled={pageSafe >= totalPaginas - 1}
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
          >
            <Icons.ChevronRight size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </>
  );
};

export default TablaCuentas;
