// ============================================================================
// Tesorería · lista de tarjetas · cuerpo de la vista "Tarjetas" de Mis Bancos
// ============================================================================
//
// Mockup: `docs/mockups/atlas-bancos-grafico-v5.html`. Una fila por tarjeta con
// su consumo a la derecha: crédito = lo que llevas del ciclo abierto
// (`gastoAbiertoPorTarjeta`); débito = lo gastado en el mes natural
// (`gastadoEnElMes` · fase 1 — antes el débito enseñaba 0 estructural).
//
// Era una card suelta debajo de la tabla de cuentas (`TarjetasCard`) y ahora es
// la otra mitad de "Mis Bancos": misma card, mismo sitio, se alternan con el
// switch. Por eso pierde su marco, su título y su botón de añadir —los pone el
// contenedor— y conserva lo suyo: orden, paginación y el menú "⋯".
//
// Solo tarjetas con `activa` (spec · las de baja no se pintan). Las fechas de
// corte/cargo y la cuenta de liquidación viven en el detalle (DrawerTarjeta),
// no en la fila.
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Icons, Pill } from '../../../design-system/v5';
import type { Tarjeta } from '../../../types/tarjetas';
import { importeSaldo } from './formatoV6';
import styles from './ListaTarjetas.module.css';

export interface FilaTarjeta {
  tarjeta: Tarjeta;
  /** Segunda línea · emisora, o la cuenta donde liquida. */
  sub: string;
  /** Color del punto/chip · el del banco de su cuenta de liquidación. */
  color: string;
  consumo: number;
  /** "consumido · ciclo" (crédito) · "gastado · {mes}" (débito). */
  etiqueta: string;
}

const POR_PAGINA = 2;

type ColumnaTj = 'nombre' | 'consumo';

interface Props {
  filas: FilaTarjeta[];
  onDetalle: (t: Tarjeta) => void;
  onEditar: (t: Tarjeta) => void;
  onEliminar: (t: Tarjeta) => void;
}

const ListaTarjetas: React.FC<Props> = ({ filas, onDetalle, onEditar, onEliminar }) => {
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
          : dir * (a.consumo - b.consumo)
      );
  }, [filas, orden]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const pageSafe = Math.min(pagina, totalPaginas - 1);
  useEffect(() => {
    setPagina((p) => Math.min(p, totalPaginas - 1));
  }, [totalPaginas]);
  const visibles = ordenadas.slice(pageSafe * POR_PAGINA, (pageSafe + 1) * POR_PAGINA);

  const ordenarPor = (col: ColumnaTj) => {
    setMenuAbierto(null);
    setPagina(0);
    setOrden((o) =>
      o?.col === col ? { col, dir: o.dir === 1 ? -1 : 1 } : { col, dir: col === 'nombre' ? 1 : -1 }
    );
  };

  const indicador = (col: ColumnaTj): string =>
    orden?.col === col ? (orden.dir === 1 ? ' ▲' : ' ▼') : '';

  return (
    <>
      {filas.length === 0 ? (
        <div className={styles.vacio}>Todavía no has dado de alta ninguna tarjeta.</div>
      ) : (
        <>
          <div className={styles.cabecera}>
            <button
              type="button"
              className={`${styles.cabBtn} ${orden?.col === 'nombre' ? styles.cabActiva : ''}`}
              onClick={() => ordenarPor('nombre')}
            >
              Tarjeta{indicador('nombre')}
            </button>
            <button
              type="button"
              className={`${styles.cabBtn} ${orden?.col === 'consumo' ? styles.cabActiva : ''}`}
              onClick={() => ordenarPor('consumo')}
            >
              Consumo{indicador('consumo')}
            </button>
          </div>

          <div className={styles.lista}>
            {visibles.map((f) => (
              <div
                key={f.tarjeta.id}
                className={styles.fila}
                role="button"
                tabIndex={0}
                onClick={() => onDetalle(f.tarjeta)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDetalle(f.tarjeta);
                  }
                }}
              >
                <span className={styles.ico} style={{ background: f.color }} aria-hidden="true">
                  <Icons.CreditCard size={14} strokeWidth={1.8} />
                </span>
                <div className={styles.main}>
                  <div className={styles.nombre}>
                    {f.tarjeta.alias}
                    <Pill
                      asTag
                      variant={f.tarjeta.modalidad === 'credito' ? 'gold' : 'brand'}
                      className={styles.tipo}
                    >
                      {f.tarjeta.modalidad === 'credito' ? 'Crédito' : 'Débito'}
                    </Pill>
                  </div>
                  {f.sub && <div className={styles.sub}>{f.sub}</div>}
                </div>
                <div className={styles.consumo}>
                  <div className={styles.importe}>{importeSaldo(f.consumo)}</div>
                  <div className={styles.etiqueta}>{f.etiqueta}</div>
                </div>
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
                    <button type="button" onClick={() => { setMenuAbierto(null); onDetalle(f.tarjeta); }}>
                      <Icons.Eye size={14} strokeWidth={1.9} /> Ver detalle
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
              </div>
            ))}
          </div>

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
      )}
    </>
  );
};

export default ListaTarjetas;
