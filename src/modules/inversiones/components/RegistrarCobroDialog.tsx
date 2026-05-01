// T23.3 · Dialog para registrar un cobro/dividendo (`tipo: 'dividendo'`).
//
// Mini-form dedicado · sin tocar `AportacionFormDialog` (que sólo soporta
// `aportacion`/`reembolso`). Permite que los botones "Registrar cobro" /
// "Registrar dividendo" de las fichas detalle de rendimiento periódico y
// dividendos pueblen `posicion.aportaciones[].tipo === 'dividendo'`, que
// es la fuente que consume la matriz de cobros · KPIs · tabla.

import React, { useState } from 'react';
import { Icons } from '../../../design-system/v5';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import type { Aportacion } from '../../../types/inversiones';
import styles from './Dialog.module.css';

type Variante = 'cobro' | 'dividendo';

interface Props {
  posicionNombre: string;
  variante: Variante;
  onSave: (aportacion: Omit<Aportacion, 'id'>) => void | Promise<void>;
  onClose: () => void;
}

const RegistrarCobroDialog: React.FC<Props> = ({
  posicionNombre,
  variante,
  onSave,
  onClose,
}) => {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [importe, setImporte] = useState<number>(0);
  const [notas, setNotas] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const focusTrapRef = useFocusTrap(true);
  React.useEffect(() => {
    const node = focusTrapRef.current;
    if (!node) return;
    const handler = () => onClose();
    node.addEventListener('modal-escape', handler);
    return () => node.removeEventListener('modal-escape', handler);
  }, [focusTrapRef, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fecha) errs.fecha = 'La fecha es obligatoria.';
    if (!Number.isFinite(importe) || importe <= 0) {
      errs.importe = 'El importe debe ser mayor que 0.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSave({
      fecha: new Date(fecha).toISOString(),
      importe,
      tipo: 'dividendo',
      notas: notas.trim() || undefined,
      fuente: 'manual',
    });
  };

  const titulo = variante === 'dividendo' ? 'Registrar dividendo' : 'Registrar cobro';

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="registrar-cobro-title">
      <div ref={focusTrapRef} className={`${styles.dialog} ${styles.sizeSm}`}>
        <div className={styles.header}>
          <div>
            <h2 id="registrar-cobro-title">{titulo}</h2>
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
            <div className={`${styles.field} ${errors.fecha ? styles.error : ''}`}>
              <label htmlFor="rc-fecha">Fecha</label>
              <input
                id="rc-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              {errors.fecha && <span className={styles.err}>{errors.fecha}</span>}
            </div>

            <div className={`${styles.field} ${errors.importe ? styles.error : ''}`}>
              <label htmlFor="rc-importe">Importe · €</label>
              <input
                id="rc-importe"
                type="number"
                step="0.01"
                min="0"
                value={importe}
                onChange={(e) => setImporte(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              {errors.importe && <span className={styles.err}>{errors.importe}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="rc-notas">Notas (opcional)</label>
              <input
                id="rc-notas"
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder=""
              />
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

export default RegistrarCobroDialog;
