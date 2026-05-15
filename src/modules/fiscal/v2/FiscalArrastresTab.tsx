/**
 * FiscalArrastresTab · tab "Arrastres" del F1 dashboard.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 §4.2 / §4.3 / §4.4.
 *
 * Datos · `getArrastresVivos(añoActual)` (helper local · agrega
 * aeatCarryForwards + perdidasPatrimonialesAhorro vivos).
 *
 * Incluye nota descartable persistida en localStorage:
 *   `fiscal.note.arrastres-orden.dismissed` = 'true'
 */

import React, { useEffect, useState } from 'react';
import type { ArrastreVivoRow } from './helpers/arrastresVivosService';
import styles from './FiscalDashboardPage.module.css';

export interface FiscalArrastresTabProps {
  rows: ArrastreVivoRow[];
}

const NOTE_STORAGE_KEY = 'fiscal.note.arrastres-orden.dismissed';

function fmtMoneda(n: number): string {
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

function tipoLabel(tipo: ArrastreVivoRow['tipo']): string {
  if (tipo === 'gasto') return 'Exceso intereses + reparación';
  return 'Pérdida patrimonial ahorro';
}

const FiscalArrastresTab: React.FC<FiscalArrastresTabProps> = ({ rows }) => {
  const [noteDismissed, setNoteDismissed] = useState(false);

  useEffect(() => {
    try {
      setNoteDismissed(localStorage.getItem(NOTE_STORAGE_KEY) === 'true');
    } catch {
      // localStorage unavailable (SSR · privacy mode) · mostrar nota
    }
  }, []);

  const dismissNote = () => {
    try {
      localStorage.setItem(NOTE_STORAGE_KEY, 'true');
    } catch {
      /* ignore */
    }
    setNoteDismissed(true);
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <div>
            <div className={styles.cardTitle}>Arrastres pendientes de compensar</div>
            <div className={styles.cardSub}>
              ATLAS aplica primero los más antiguos (FIFO · regla AEAT)
            </div>
          </div>
        </div>
        <div>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>Sin arrastres pendientes</div>
              <div>No hay pérdidas patrimoniales ni excesos de gasto vivos.</div>
            </div>
          ) : (
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Origen</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Importe original</th>
                  <th style={{ textAlign: 'right' }}>Aplicado</th>
                  <th style={{ textAlign: 'right' }}>Pendiente</th>
                  <th>Caduca</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={`${styles.mono} ${styles.tStrong}`}>{row.origen}</span>
                    </td>
                    <td>{tipoLabel(row.tipo)}</td>
                    <td className={styles.tdRight}>
                      <span className={styles.mono}>{fmtMoneda(row.importeOriginal)}</span>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={styles.mono}>{fmtMoneda(row.importeAplicado)}</span>
                    </td>
                    <td className={styles.tdRight}>
                      <span className={`${styles.mono} ${styles.tStrong}`}>
                        {fmtMoneda(row.importePendiente)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.mono}>{row.caduca}</span>
                      {row.caducaEsteAño && (
                        <div className={styles.caducaWarn}>caduca este año</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!noteDismissed && (
        <div className={styles.noteBlock} role="note">
          <button
            type="button"
            className={styles.noteClose}
            onClick={dismissNote}
            aria-label="Descartar nota"
          >
            ×
          </button>
          <div className={styles.noteTitle}>
            ATLAS aplica los arrastres con el orden más beneficioso
          </div>
          <div className={styles.noteBody}>
            Cuando hagas la siguiente declaración, ATLAS aplicará primero los
            arrastres que caducan antes (FIFO). Si se aplicaran al revés,
            podrías perder importes por caducidad y pagar más impuesto del
            necesario.
          </div>
        </div>
      )}
    </>
  );
};

export default FiscalArrastresTab;
