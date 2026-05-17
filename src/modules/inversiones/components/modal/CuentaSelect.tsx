// CuentaSelect · selector compartido de cuentas bancarias para los modales
// de alta de inversiones · PR 3 review-fix (Copilot #1).
//
// Carga las cuentas con `cuentasService.list()` una vez al montar. Renderiza
// un <select> con alias o IBAN enmascarado como label. Devuelve number | ''
// para que el modal pueda diferenciar "sin selección" vs id válido.

import React, { useEffect, useId, useState } from 'react';
import { cuentasService } from '../../../../services/cuentasService';
import type { Account } from '../../../../services/db';
import styles from '../../styles/atlas-inversiones.module.css';

export interface CuentaSelectProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  /** Texto del label · obligatorio para a11y. */
  label: string;
  /** Marca el campo como required visualmente. */
  required?: boolean;
  /** Mensaje del primer item (placeholder). Default "Selecciona cuenta…". */
  placeholder?: string;
}

const formatLabel = (c: Account): string => {
  if (c.alias?.trim()) return c.alias;
  if (c.ibanMasked) return c.ibanMasked;
  if (c.iban) return c.iban;
  return `Cuenta #${c.id ?? '?'}`;
};

const CuentaSelect: React.FC<CuentaSelectProps> = ({
  id,
  value,
  onChange,
  label,
  required = false,
  placeholder = 'Selecciona cuenta…',
}) => {
  const autoId = useId();
  const selectId = id ?? `cuenta-select-${autoId}`;
  const [cuentas, setCuentas] = useState<Account[]>([]);

  useEffect(() => {
    let cancelled = false;
    cuentasService
      .list()
      .then((list) => {
        if (!cancelled) {
          setCuentas(list.filter((c) => c.id != null && c.tipo !== 'TARJETA_CREDITO'));
        }
      })
      .catch(() => {
        /* lista vacía · usuario puede crear la posición sin cuenta */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
        {required ? <span className={styles.req}>*</span> : <span className={styles.opt}>opcional</span>}
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">{placeholder}</option>
        {cuentas.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {formatLabel(c)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CuentaSelect;
