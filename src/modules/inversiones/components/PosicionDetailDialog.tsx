import React, { useMemo, useState } from 'react';
import { Icons, MoneyValue, showToastV5 } from '../../../design-system/v5';
import type { PosicionInversion } from '../../../types/inversiones';
import { labelTipo, formatCurrency2 } from '../helpers';
import dialog from './Dialog.module.css';
import styles from './PosicionDetailDialog.module.css';

interface Props {
  posicion: PosicionInversion;
  onClose: () => void;
  onAddAportacion: () => void;
  onEditAportacion: (aportacionId: number) => void;
  onDeleteAportacion: (aportacionId: number) => Promise<void>;
  onActualizarValor: () => void;
  onEditarPosicion: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });

const tipoAportacionLabel: Record<string, string> = {
  aportacion: 'Aportación',
  reembolso: 'Reembolso',
  dividendo: 'Dividendo',
};

const PosicionDetailDialog: React.FC<Props> = ({
  posicion,
  onClose,
  onAddAportacion,
  onEditAportacion,
  onDeleteAportacion,
  onActualizarValor,
  onEditarPosicion,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const isPositive = posicion.rentabilidad_euros >= 0;
  const aportacionesOrdenadas = useMemo(
    () =>
      [...posicion.aportaciones].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [posicion.aportaciones],
  );

  const totalPages = Math.max(1, Math.ceil(aportacionesOrdenadas.length / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return aportacionesOrdenadas.slice(start, start + rowsPerPage);
  }, [aportacionesOrdenadas, currentPage, rowsPerPage]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return;
    try {
      await onDeleteAportacion(id);
      showToastV5('Movimiento eliminado.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[posicion-detail] delete', err);
      showToastV5('No se pudo eliminar el movimiento.');
    }
  };

  return (
    <div className={dialog.overlay} role="dialog" aria-modal="true">
      <div className={`${dialog.dialog} ${dialog.sizeLg}`}>
        <div className={dialog.header}>
          <div>
            <h2>{posicion.nombre}</h2>
            <div className={dialog.sub}>
              {labelTipo(posicion.tipo)} · {posicion.entidad}
            </div>
          </div>
          <button
            type="button"
            className={dialog.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className={dialog.body}>
          <div className={styles.summaryGrid}>
            <div className={`${styles.summaryCell} ${styles.brand}`}>
              <div className={styles.label}>Valor actual</div>
              <div className={styles.value}>{formatCurrency2(posicion.valor_actual)}</div>
              <div className={styles.meta}>{formatDate(posicion.fecha_valoracion)}</div>
            </div>
            <div className={styles.summaryCell}>
              <div className={styles.label}>Total aportado</div>
              <div className={styles.value}>{formatCurrency2(posicion.total_aportado)}</div>
            </div>
            <div className={`${styles.summaryCell} ${isPositive ? styles.pos : styles.neg}`}>
              <div className={styles.label}>Rentabilidad</div>
              <div className={styles.value}>
                {posicion.rentabilidad_porcentaje >= 0 ? '+' : ''}
                {posicion.rentabilidad_porcentaje.toFixed(1)}%
              </div>
              <div className={styles.meta}>
                {posicion.rentabilidad_euros >= 0 ? '+' : ''}
                {formatCurrency2(posicion.rentabilidad_euros)}
              </div>
            </div>
          </div>

          <div className={styles.sectionTitle}>
            <h3>Histórico de aportaciones</h3>
            <button
              type="button"
              className={dialog.btnPrimary}
              onClick={onAddAportacion}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icons.Plus size={14} strokeWidth={1.8} />
              Añadir aportación
            </button>
          </div>

          {aportacionesOrdenadas.length === 0 ? (
            <div className={styles.empty}>No hay aportaciones registradas.</div>
          ) : (
            <>
              <div className={styles.tableScroll}>
                <table className={styles.aportTable}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Importe</th>
                      <th>Notas</th>
                      <th aria-label="acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((ap) => (
                      <tr key={ap.id}>
                        <td>{formatDate(ap.fecha)}</td>
                        <td>
                          <span
                            className={`${styles.tipoPill} ${
                              ap.tipo === 'reembolso'
                                ? styles.tipoReemb
                                : ap.tipo === 'dividendo'
                                  ? styles.tipoDiv
                                  : styles.tipoAport
                            }`}
                          >
                            {tipoAportacionLabel[ap.tipo] || ap.tipo}
                          </span>
                        </td>
                        <td className={styles.mono}>
                          <MoneyValue
                            value={ap.tipo === 'reembolso' ? -ap.importe : ap.importe}
                            decimals={2}
                            showSign
                            tone={ap.tipo === 'reembolso' ? 'neg' : 'pos'}
                          />
                        </td>
                        <td style={{ color: 'var(--atlas-v5-ink-3)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span>{ap.notas || '—'}</span>
                            {ap.tipo === 'reembolso' &&
                              typeof ap.ganancia_perdida === 'number' && (
                                <>
                                  <span
                                    className={`${styles.gainPill} ${
                                      ap.ganancia_perdida >= 0 ? styles.gainPos : styles.gainNeg
                                    }`}
                                  >
                                    {ap.ganancia_perdida >= 0 ? 'Plusvalía' : 'Minusvalía'}{' '}
                                    {ap.ganancia_perdida >= 0 ? '+' : ''}
                                    {formatCurrency2(ap.ganancia_perdida)}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      color: 'var(--atlas-v5-ink-4)',
                                      fontFamily: 'var(--atlas-v5-font-mono-num)',
                                    }}
                                  >
                                    Coste FIFO · {formatCurrency2(ap.coste_adquisicion_fifo ?? 0)}
                                  </span>
                                </>
                              )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              aria-label="Editar movimiento"
                              title="Editar movimiento"
                              onClick={() => onEditAportacion(ap.id)}
                            >
                              <Icons.Edit size={13} strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              className={dialog.btnDanger}
                              aria-label="Eliminar movimiento"
                              title="Eliminar movimiento"
                              onClick={() => handleDelete(ap.id)}
                            >
                              <Icons.Delete size={13} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <div>
                  Total aportado ·{' '}
                  <span className={styles.total}>{formatCurrency2(posicion.total_aportado)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label htmlFor="rowsPerPage">
                    Filas
                    <select
                      id="rowsPerPage"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      {[6, 8, 10].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Anterior"
                  >
                    ‹
                  </button>
                  <span style={{ minWidth: 70, textAlign: 'center' }}>
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Siguiente"
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={dialog.footer}>
          <button
            type="button"
            className={dialog.btnSecondary}
            onClick={onActualizarValor}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icons.Refresh size={14} strokeWidth={1.8} />
            Actualizar valor
          </button>
          <button
            type="button"
            className={dialog.btnSecondary}
            onClick={onEditarPosicion}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icons.Edit size={14} strokeWidth={1.8} />
            Editar posición
          </button>
          <button type="button" className={dialog.btnGhost} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosicionDetailDialog;
