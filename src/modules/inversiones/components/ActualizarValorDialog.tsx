import React, { useState } from 'react';
import { Icons } from '../../../design-system/v5';
import styles from './Dialog.module.css';

interface Props {
  posicionNombre: string;
  valorActual: number;
  onSave: (nuevoValor: number, fechaValoracionISO: string) => void;
  onClose: () => void;
}

const ActualizarValorDialog: React.FC<Props> = ({ posicionNombre, valorActual, onSave, onClose }) => {
  const [nuevoValor, setNuevoValor] = useState(valorActual);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (nuevoValor <= 0) errs.nuevoValor = 'El valor debe ser mayor que 0.';
    if (!fecha) errs.fecha = 'La fecha es obligatoria.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSave(nuevoValor, new Date(fecha).toISOString());
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={`${styles.dialog} ${styles.sizeSm}`}>
        <div className={styles.header}>
          <div>
            <h2>Actualizar valor</h2>
            <div className={styles.sub}>{posicionNombre}</div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icons.Close size={16} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <div className={`${styles.field} ${errors.nuevoValor ? styles.error : ''}`}>
              <label htmlFor="nuevoValor">Nuevo valor actual · €</label>
              <input
                id="nuevoValor"
                type="number"
                step="0.01"
                value={nuevoValor}
                onChange={(e) => setNuevoValor(parseFloat(e.target.value) || 0)}
                placeholder="10000.00"
              />
              {errors.nuevoValor && <span className={styles.err}>{errors.nuevoValor}</span>}
            </div>

            <div className={`${styles.field} ${errors.fecha ? styles.error : ''}`}>
              <label htmlFor="fecha">Fecha de valoración</label>
              <input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              {errors.fecha && <span className={styles.err}>{errors.fecha}</span>}
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActualizarValorDialog;
