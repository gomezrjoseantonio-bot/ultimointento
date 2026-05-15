/**
 * ModoDeclaracionCard · explicación del modo I/II/III/IV/V detectado.
 *
 * Sin acrónimos técnicos (R10 · N4 · etc) · texto humano · tag con nombre
 * descriptivo · cuerpo explicativo de la regla aplicada.
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 §6.5.
 */

import React from 'react';
import { MODO_LABEL } from './helpers/inmuebleCasillasService';
import type { FiscalSummaryExtended } from '../../../services/fiscalSummaryService';
import styles from './FiscalInmueblePage.module.css';

export interface ModoDeclaracionCardProps {
  modo: FiscalSummaryExtended['modoDeclaracion'];
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
  metodoProrrateo,
  habitaciones,
}) => {
  const m = MODO_LABEL[modo];

  // Sustituimos el body por uno enriquecido cuando hay método de prorrateo
  // específico · sin alterar la lógica del helper (mantenido genérico).
  let body = m.body;
  if (modo === 'III' && metodoProrrateo && habitaciones) {
    const metodoTxt = METODO_LABEL[metodoProrrateo];
    body = `${habitaciones} habitaciones · ATLAS aplicó ${metodoTxt} · método más beneficioso de los 4 legalmente posibles.`;
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
