// ActualizarValoracionModal · valoración mensual manual · PR 4 T-INVERSIONES-V5
// Sustituye ActualizarValorPlanDialog y ActualizarValorDialog.
// Variante `narrow` (560px) · sin preview · datos mínimos.

import React, { useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import type { CartaItem } from '../../types/cartaItem';
import ModalAtlas from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from './ModalAtlasFooter';
import styles from '../../styles/atlas-inversiones.module.css';

export interface ActualizarValoracionModalProps {
  posicion: CartaItem;
  onSave: (valor: number, fecha: string) => Promise<void> | void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const ActualizarValoracionModal: React.FC<ActualizarValoracionModalProps> = ({
  posicion,
  onSave,
  onClose,
}) => {
  const [valor, setValor] = useState(String(posicion.valor_actual ?? 0));
  const [fecha, setFecha] = useState(today());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      showToastV5('El valor debe ser un número positivo');
      return;
    }
    if (!fecha) {
      showToastV5('La fecha es obligatoria');
      return;
    }
    setLoading(true);
    try {
      await onSave(valorNum, fecha);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} size="narrow" ariaLabel="Actualizar valoración">
      <ModalAtlasHeader
        icon={<Icons.ArrowUpRight size={18} strokeWidth={1.7} />}
        title="Actualizar valoración"
        subtitle={`${posicion.nombre} · ${posicion.entidad}`}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <div className={styles.form}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Nueva valoración</div>
            <div className={`${styles.row} ${styles.cols1}`}>
              <div className={styles.field}>
                <label className={styles.label}>
                  Valor actual<span className={styles.req}>€</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`${styles.input} ${styles.mono}`}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  aria-label="Nuevo valor"
                  required
                />
              </div>
            </div>
            <div className={`${styles.row} ${styles.cols1}`}>
              <div className={styles.field}>
                <label className={styles.label}>
                  Fecha de valoración<span className={styles.req}>*</span>
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </div>
        <ModalAtlasFooter
          info={
            <>
              <Icons.Info size={13} strokeWidth={2} />
              Se registra en el histórico mensual de valoración.
            </>
          }
          actions={
            <>
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Guardar valoración'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default ActualizarValoracionModal;
