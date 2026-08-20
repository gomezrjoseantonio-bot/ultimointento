// ============================================================================
// Tesorería · tabla de tarjetas · cuerpo de la vista "Tarjetas" de Mis Bancos
// ============================================================================
//
// Mockup: `docs/mockups/atlas-bancos-grafico-v5.html`.
//
// Una tarjeta se lee EN LA MISMA TABLA que una cuenta, con el mismo chasis
// (`TablaBanco.module.css`): mismas cabeceras ordenables, mismas filas, mismo
// menú "⋯" y mismo pie con el total. Era una lista con otra forma —icono de
// color, filas altas, otras acciones— y cambiar de pestaña parecía cambiar de
// pantalla, cuando lo que hay debajo es lo mismo: dinero en un banco.
//
// Lo que NO es igual es la pregunta que contesta cada una. Una cuenta tiene
// saldo; una tarjeta tiene un ciclo, y su cifra es lo consumido: crédito = lo
// que llevas del ciclo abierto (`gastoAbiertoPorTarjeta`), débito = lo gastado
// en el mes natural (`gastadoEnElMes`). Por eso las columnas cambian aunque la
// tabla sea la misma.
//
// Solo tarjetas con `activa` (spec · las de baja no se pintan). Las fechas de
// corte/cargo y la cuenta de liquidación viven en el detalle (DrawerTarjeta).
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Icons, Pill } from '../../../design-system/v5';
import type { Tarjeta } from '../../../types/tarjetas';
import { importeSaldo } from './formatoV6';
import styles from './TablaBanco.module.css';

export interface FilaTarjeta {
  tarjeta: Tarjeta;
  /** Segunda línea · emisora, o la cuenta donde liquida. */
  sub: string;
  /** Lo que YA se punteó del periodo · el gasto REAL. */
  gastado: number;
  /** Lo anotado que falta por confirmar. */
  pendiente: number;
  /** `gastado + pendiente` · todo lo que la tarjeta lleva del periodo. */
  total: number;
  /** Cuántas compras quedan por puntear · columna Estado. */
  porConfirmar: number;
}

const POR_PAGINA = 5;

type ColumnaTj = 'nombre' | 'tipo' | 'gastado' | 'pendiente' | 'total';

interface Props {
  filas: FilaTarjeta[];
  /** Qué periodo se está mirando · rotula la columna del recibo. */
  periodo: string;
  /** La tarjeta abierta · la que enseña su día a día. */
  seleccionada: number | null;
  onSeleccionar: (tarjetaId: number | null) => void;
  /** El gráfico de la seleccionada · lo arma la página. */
  grafico?: React.ReactNode;
  /** Las MISMAS acciones que una cuenta · el cajón de la tarjeta es su punteo. */
  onAbrir: (t: Tarjeta) => void;
  onEditar: (t: Tarjeta) => void;
  onEliminar: (t: Tarjeta) => void;
}

const ListaTarjetas: React.FC<Props> = ({
  filas,
  periodo,
  seleccionada,
  onSeleccionar,
  grafico,
  onAbrir,
  onEditar,
  onEliminar,
}) => {
  const [orden, setOrden] = useState<{ col: ColumnaTj; dir: 1 | -1 } | null>(null);
  const [pagina, setPagina] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);

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
          ? dir * a.tarjeta.alias.localeCompare(b.tarjeta.alias, 'es')
          : col === 'tipo'
            ? dir * (a.tarjeta.modalidad ?? '').localeCompare(b.tarjeta.modalidad ?? '', 'es')
            : dir * (a[col] - b[col])
      );
  }, [filas, orden]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const pageSafe = Math.min(pagina, totalPaginas - 1);
  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas - 1));
  }, [totalPaginas]);
  const visibles = ordenadas.slice(pageSafe * POR_PAGINA, (pageSafe + 1) * POR_PAGINA);

  const totales = useMemo(
    () => ({
      gastado: Math.round(filas.reduce((s, f) => s + f.gastado, 0) * 100) / 100,
      pendiente: Math.round(filas.reduce((s, f) => s + f.pendiente, 0) * 100) / 100,
      total: Math.round(filas.reduce((s, f) => s + f.total, 0) * 100) / 100,
    }),
    [filas]
  );

  const ordenarPor = (col: ColumnaTj) => {
    setMenuAbierto(null);
    setPagina(0);
    setOrden((o) =>
      o?.col === col
        ? { col, dir: o.dir === 1 ? -1 : 1 }
        : { col, dir: col === 'nombre' || col === 'tipo' ? 1 : -1 }
    );
  };

  // Función de render y NO un componente anidado · mismo motivo que en la tabla
  // de cuentas: un componente definido dentro del render se REMONTA en cada
  // pasada y pierde el foco entre clics.
  const th = (col: ColumnaTj, rotulo: React.ReactNode, num?: boolean) => (
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

  if (filas.length === 0) {
    return <div className={styles.vacio}>Todavía no has dado de alta ninguna tarjeta.</div>;
  }

  return (
    <>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {th('nombre', 'Tarjeta')}
            {th('tipo', 'Tipo')}
            {th('gastado', 'Gastado', true)}
            {th('pendiente', 'Por confirmar', true)}
            {th('total', `Gasto ${periodo}`, true)}
            <th className={styles.th} aria-label="Estado" />
            <th className={styles.th} aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {visibles.map((f) => {
            const abierta = seleccionada === f.tarjeta.id;
            const alternar = () => onSeleccionar(abierta ? null : f.tarjeta.id ?? null);
            return (
            <React.Fragment key={f.tarjeta.id}>
            <tr
              className={`${styles.fila} ${abierta ? styles.filaSel : styles.filaFina}`}
              tabIndex={0}
              aria-expanded={abierta}
              onClick={alternar}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  alternar();
                }
              }}
            >
              <td className={styles.td}>
                {/* Sin cuadro de color · igual que las cuentas (F1): el alias
                    ya dice cuál es y el color solo ensuciaba una fila de
                    cifras. */}
                <div className={styles.id}>
                  <span className={styles.caret} aria-hidden="true">
                    <Icons.ChevronRight size={14} strokeWidth={2.2} />
                  </span>
                  <div className={styles.idTx}>
                    <div className={styles.nombre}>{f.tarjeta.alias}</div>
                    {f.sub && <div className={styles.mask}>{f.sub}</div>}
                  </div>
                </div>
              </td>
              <td className={styles.td}>
                <Pill asTag variant={f.tarjeta.modalidad === 'credito' ? 'gold' : 'brand'}>
                  {f.tarjeta.modalidad === 'credito' ? 'Crédito' : 'Débito'}
                </Pill>
              </td>
              {/* Lo que YA se confirmó · esto sí es "gastado". */}
              <td className={`${styles.td} ${styles.der}`}>
                {f.gastado === 0 ? (
                  <span className={styles.mudo}>—</span>
                ) : (
                  <span className={styles.fuerte}>{importeSaldo(f.gastado)}</span>
                )}
              </td>
              {/* Lo anotado sin puntear · no es consumo todavía. */}
              <td className={`${styles.td} ${styles.der}`}>
                {f.pendiente === 0 ? (
                  <span className={styles.mudo}>—</span>
                ) : (
                  importeSaldo(f.pendiente)
                )}
              </td>
              {/* La cifra-veredicto de la tarjeta, como el cierre en una
                  cuenta: todo lo que lleva el periodo. Y es la SUMA de las dos
                  de al lado, no un dato suelto que haya que creerse. */}
              <td className={`${styles.td} ${styles.der}`}>
                <span className={styles.oro}>{importeSaldo(f.total)}</span>
              </td>
              <td className={`${styles.td} ${styles.der}`}>
                {f.porConfirmar > 0 && (
                  <span className={styles.estadoConf}>
                    <span className={styles.puntoEstado} aria-hidden="true" />
                    {f.porConfirmar} por confirmar
                  </span>
                )}
              </td>
              <td className={`${styles.td} ${styles.tdKebab}`}>
                <button
                  type="button"
                  className={`${styles.kebab} ${menuAbierto === f.tarjeta.id ? styles.kebabFijo : ''}`}
                  aria-label={`Acciones de ${f.tarjeta.alias}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAbierto((m) => (m === f.tarjeta.id ? null : f.tarjeta.id!));
                  }}
                >
                  <Icons.More size={15} strokeWidth={2} />
                </button>
                {menuAbierto === f.tarjeta.id && (
                  <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                    {/* Las mismas tres acciones que una cuenta · en la tarjeta
                        el punteo son sus compras del periodo (DrawerTarjeta). */}
                    <button type="button" onClick={() => { setMenuAbierto(null); onAbrir(f.tarjeta); }}>
                      <Icons.Check size={14} strokeWidth={1.9} /> Confirmar movimientos
                    </button>
                    <button type="button" onClick={() => { setMenuAbierto(null); onEditar(f.tarjeta); }}>
                      <Icons.Edit size={14} strokeWidth={1.9} /> Editar tarjeta
                    </button>
                    <div className={styles.menuSep} />
                    <button
                      type="button"
                      className={styles.menuBaja}
                      onClick={() => { setMenuAbierto(null); onEliminar(f.tarjeta); }}
                    >
                      <Icons.Delete size={14} strokeWidth={1.9} /> Eliminar tarjeta
                    </button>
                  </div>
                )}
              </td>
            </tr>
            {abierta && grafico && (
              <tr className={styles.filaGrafico}>
                <td className={styles.tdGrafico} colSpan={7}>
                  {grafico}
                </td>
              </tr>
            )}
            </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className={styles.pie}>
            <td className={styles.td}>
              Total · {filas.length} {filas.length === 1 ? 'tarjeta' : 'tarjetas'}
            </td>
            <td className={styles.td} />
            <td className={`${styles.td} ${styles.der}`}>
              {totales.gastado === 0 ? (
                <span className={styles.mudo}>—</span>
              ) : (
                importeSaldo(totales.gastado)
              )}
            </td>
            <td className={`${styles.td} ${styles.der}`}>
              {totales.pendiente === 0 ? (
                <span className={styles.mudo}>—</span>
              ) : (
                importeSaldo(totales.pendiente)
              )}
            </td>
            <td className={`${styles.td} ${styles.der}`}>
              <span className={styles.oro}>{importeSaldo(totales.total)}</span>
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
            aria-label="Tarjetas anteriores"
            disabled={pageSafe === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            <Icons.ChevronLeft size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className={styles.flecha}
            aria-label="Tarjetas siguientes"
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

export default ListaTarjetas;
