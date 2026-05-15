/**
 * ModoDeclaracionCard · explicación del modo I/II/III/IV/V detectado.
 *
 * Sin acrónimos técnicos (R10 · N4 · etc) · texto humano · tag con nombre
 * descriptivo · cuerpo explicativo de la regla aplicada.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.5.
 */

import React from 'react';
import { getModoLabel } from './helpers/inmuebleCasillasService';
import type { FiscalSummaryExtended } from '../../../services/fiscalSummaryService';
import styles from './FiscalInmueblePage.module.css';

export interface ModoDeclaracionCardProps {
  modo: FiscalSummaryExtended['modoDeclaracion'];
  porcentajeReduccion: number;
  metodoProrrateo?: FiscalSummaryExtended['metodoProrrateo'];
  habitaciones?: number;
}

const METODO_LABEL: Record<NonNullable<FiscalSummaryExtended['metodoProrrateo']>, string> = {
  dias_habitacion: 'prorrateo por días-habitación',
  superficie: 'prorrateo por superficie',
  ingresos: 'prorrateo por ingresos',
};

const ModoDeclaracionCard: React.FC<ModoDeclaracionCardProps> = ({
  modo,
  porcentajeReduccion,
  metodoProrrateo,
  habitaciones,
}) => {
  const m = getModoLabel(modo, porcentajeReduccion);

  // En modo III enriquecemos con el método real de prorrateo aplicado ·
  // sin afirmaciones de "más beneficioso de los 4 métodos" (el motor
  // sólo aplica el método configurado · no compara alternativas).
  let body = m.body;
  if (modo === 'III' && metodoProrrateo && habitaciones) {
    const metodoTxt = METODO_LABEL[metodoProrrateo];
    body = `${habitaciones} habitaciones · ATLAS aplicó ${metodoTxt} sobre los gastos compartidos.`;
  }

  return (
    <div className={styles.modoCard}>
      <div className={styles.modoCardHd}>
        <span className={styles.modoCardTag}>{m.tag}</span>
        <span className={styles.modoCardTitle}>{m.title}</span>
      </div>
      <div className={styles.modoCardBody}>{body}</div>
    </div>
  );
};

export default ModoDeclaracionCard;
