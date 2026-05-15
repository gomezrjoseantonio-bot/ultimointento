/**
 * FiscalEjerciciosTab · tab "Ejercicios" del F1 dashboard.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 §4.2 / §4.4.
 * Datos · `fiscalResolverService.resolverTodosLosEjercicios()` (ya existe).
 */

import React from 'react';
import type { DatosFiscalesEjercicio } from '../../../services/fiscalResolverService';
import styles from './FiscalDashboardPage.module.css';

export interface EjercicioRowVm {
  año: number;
  estado: DatosFiscalesEjercicio['estado'];
  resultado: number | null;
  tieneParalela: boolean;
  esComplementaria: boolean;
  justificanteAnterior?: string;
  prescribe: string | null;
  esPrescrito: boolean;
}

export interface FiscalEjerciciosTabProps {
  rows: EjercicioRowVm[];
  onSelectAño: (año: number) => void;
}

function fmtEuros(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

function pillFor(row: EjercicioRowVm): { label: string; cls: string } {
  if (row.esPrescrito) return { label: 'Prescrito', cls: styles.pillPrescrito };
  if (row.estado === 'en_curso') return { label: 'En curso', cls: styles.pillCurso };
  if (row.estado === 'pendiente') return { label: 'Pendiente declarar', cls: styles.pillPendiente };
  return { label: 'Declarado', cls: styles.pillDeclarado };
}

function tituloFor(row: EjercicioRowVm): string {
  if (row.esPrescrito) return `IRPF ${row.año} · prescrito`;
  if (row.estado === 'en_curso') return `IRPF ${row.año} · proyección anual`;
  if (row.estado === 'pendiente') return `IRPF ${row.año} · borrador`;
  return `IRPF ${row.año} · declarado`;
}

function metaFor(row: EjercicioRowVm): string {
  if (row.esPrescrito) return 'consultable · intocable';
  if (row.estado === 'en_curso') return 'recalcula con cada movimiento del año';
  if (row.estado === 'pendiente') return 'ventana de presentación abierta · 2 abr – 30 jun';
  if (row.esComplementaria) {
    return row.justificanteAnterior
      ? `complementaria · justificante anterior ${row.justificanteAnterior}`
      : 'declaración complementaria';
  }
  return row.tieneParalela ? 'corregido por paralela posterior' : 'v1 sin paralelas';
}

function prescripcionMeta(row: EjercicioRowVm): string {
  // Sub-tarea 3.x ajuste 2 · texto prescripción uniforme.
  // Para en_curso / pendiente mostramos el año (año + 5) en vez de fecha
  // completa o texto técnico ("tras 4 años desde campaña"). El cálculo
  // real día-exacto solo es relevante para ejercicios declarados.
  if (row.esPrescrito) return 'cerrado';
  if (row.estado === 'en_curso' || row.estado === 'pendiente') {
    return `prescribe en ${row.año + 5}`;
  }
  if (row.prescribe) return `prescribe ${formatIsoDateAsEs(row.prescribe)}`;
  return '';
}

function formatIsoDateAsEs(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function tonoResultado(n: number | null): string {
  if (n === null) return styles.muted;
  if (n > 0) return styles.pos;
  if (n < 0) return styles.neg;
  return '';
}

const FiscalEjerciciosTab: React.FC<FiscalEjerciciosTabProps> = ({ rows, onSelectAño }) => {
  return (
    <div className={styles.card}>
      <div className={styles.cardHd}>
        <div>
          <div className={styles.cardTitle}>Tus ejercicios fiscales</div>
          <div className={styles.cardSub}>click en cualquier año para ver detalle</div>
        </div>
      </div>
      <div>
        {rows.length === 0 ? (
          <div className={styles.ejEmpty}>No hay ejercicios fiscales registrados.</div>
        ) : (
          rows.map((row) => {
            const pill = pillFor(row);
            return (
              <button
                key={row.año}
                type="button"
                className={`${styles.ejRow} ${row.esPrescrito ? styles.ejRowPrescrito : ''}`}
                onClick={() => onSelectAño(row.año)}
                aria-label={`Abrir ejercicio ${row.año}`}
              >
                <div className={styles.ejYear}>{row.año}</div>
                <div>
                  <span className={`${styles.pill} ${pill.cls}`}>{pill.label}</span>
                  {row.esComplementaria && (
                    <span
                      className={`${styles.pill} ${styles.pillParalela}`}
                      title={row.justificanteAnterior
                        ? `Complementaria · justificante anterior ${row.justificanteAnterior}`
                        : 'Complementaria'}
                    >
                      Complementaria
                    </span>
                  )}
                  {!row.esComplementaria && row.tieneParalela && (
                    <span className={`${styles.pill} ${styles.pillParalela}`}>v2</span>
                  )}
                </div>
                <div>
                  <div className={styles.ejTitle}>{tituloFor(row)}</div>
                  <div className={styles.ejMeta}>{metaFor(row)}</div>
                </div>
                <div className={`${styles.ejResult} ${tonoResultado(row.resultado)}`}>
                  {fmtEuros(row.resultado)}
                </div>
                <div className={styles.ejMeta}>{prescripcionMeta(row)}</div>
                <div className={styles.ejChevron}>›</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FiscalEjerciciosTab;
