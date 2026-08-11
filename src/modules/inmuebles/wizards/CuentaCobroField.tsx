// Selector (presentacional) de cuenta bancaria de cobro para el wizard de
// contratos. La carga vive en `useCuentasCobro` (cuentaCobro.ts) a nivel del
// wizard; aquí solo se pinta el desplegable.

import React from 'react';
import type { Account } from '../../../services/db';
import { cuentaLabel } from './cuentaCobro';
import styles from './CuentaCobroField.module.css';

export interface CuentaCobroFieldProps {
  cuentas: Account[];
  value: string;
  onChange: (id: string) => void;
}

export const CuentaCobroField: React.FC<CuentaCobroFieldProps> = ({
  cuentas,
  value,
  onChange,
}) => (
  <div className={styles.field}>
    <label className={styles.label}>Cuenta de cobro</label>
    {cuentas.length > 0 ? (
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecciona una cuenta…</option>
        {cuentas.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {cuentaLabel(c)}
          </option>
        ))}
      </select>
    ) : (
      <>
        <select className={styles.select} value="" disabled>
          <option value="">Sin cuentas configuradas</option>
        </select>
        <span className={styles.help}>
          Añade una cuenta bancaria en Tesorería para poder cobrar la renta.
        </span>
      </>
    )}
  </div>
);

export default CuentaCobroField;
