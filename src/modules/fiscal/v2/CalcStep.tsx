/**
 * CalcStep · componente genérico de "calc step" del F4 venta.
 *
 * Header con título + casillaRef · body con líneas (operador · texto ·
 * importe). Soporta indent1/2 · subtotal · final (fila navy destacada).
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 §7.2.
 */

import React from 'react';
import type { VentaCalcLine, VentaCalcStep } from './helpers/ventaCalculoService';
import styles from './FiscalVentaPage.module.css';

export interface CalcStepProps {
  step: VentaCalcStep;
}

function fmtEuros(n: number): string {
  if (n === 0) return '0,00 €';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

function fmtLineAmount(line: VentaCalcLine): string {
  if (line.amount === 'pendiente') return 'pendiente';
  if (line.amount === null) return '—';
  if (line.amount === 0) return '0,00 €';
  if (line.negativeAmount && line.amount > 0) {
    return `−${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(line.amount)} €`;
  }
  return fmtEuros(line.amount);
}

const CalcStep: React.FC<CalcStepProps> = ({ step }) => {
  return (
    <section className={styles.calcStep} aria-labelledby={`step-${step.num}-title`}>
      <header className={styles.calcStepHd}>
        <span id={`step-${step.num}-title`}>{step.num} · {step.title}</span>
        <span className={styles.casillaRef}>{step.casillaRef}</span>
      </header>
      <div>
        {step.lines.map((line, idx) => {
          const cls = [
            styles.calcLine,
            line.indent === 1 ? styles.indent1 : '',
            line.indent === 2 ? styles.indent2 : '',
            line.subtotal ? styles.subtotal : '',
            line.final ? styles.final : '',
          ].filter(Boolean).join(' ');

          const amountCls = [
            styles.calcAmt,
            line.negativeAmount && typeof line.amount === 'number' && line.amount > 0 ? styles.negOp : '',
            line.amount === 'pendiente' ? styles.pend : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={`${step.num}-${idx}`} className={cls}>
              <span className={styles.calcOp}>{line.op}</span>
              <span className={styles.calcText}>{line.text}</span>
              <span className={amountCls}>{fmtLineAmount(line)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CalcStep;
