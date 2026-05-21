// EditorTerModal · edición manual del TER (Total Expense Ratio) de un
// plan de pensiones · T-FICHA-PP-PULIDO v1 · Bug #1.
//
// Tres opciones para el usuario:
//   1. Introducir un TER manual (0-5 %) · se guarda como `terOverride`.
//   2. "Volver al catálogo" · limpia `terOverride` · el plan vuelve a
//      resolver TER por catálogo (o queda sin dato si no hay match).
//   3. Cancelar · no toca nada.

import React, { useState } from 'react';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import ModalAtlas from './ModalAtlas';
import ModalAtlasHeader from './ModalAtlasHeader';
import ModalAtlasFooter, {
  ModalAtlasButtonGhost,
  ModalAtlasButtonGold,
} from './ModalAtlasFooter';
import styles from '../../styles/atlas-inversiones.module.css';

export interface EditorTerModalProps {
  planNombre: string;
  /** TER actual en formato porcentual · 1.5 = 1,50 %. null · sin dato. */
  terActual: number | null;
  fuenteActual: 'manual' | 'catalogo' | 'desconocido';
  /** `null` · limpiar override y volver a catálogo. `number` · nuevo TER. */
  onSave: (nuevoTer: number | null) => Promise<void> | void;
  onClose: () => void;
}

const EditorTerModal: React.FC<EditorTerModalProps> = ({
  planNombre,
  terActual,
  fuenteActual,
  onSave,
  onClose,
}) => {
  const [ter, setTer] = useState(terActual != null ? String(terActual) : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(ter.replace(',', '.'));
    if (!Number.isFinite(num) || num < 0 || num > 5) {
      showToastV5('El TER debe estar entre 0 y 5 %');
      return;
    }
    setLoading(true);
    try {
      await onSave(num);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleResetCatalogo = async () => {
    setLoading(true);
    try {
      await onSave(null);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalAtlas onClose={onClose} size="narrow" ariaLabel="Editar TER del plan">
      <ModalAtlasHeader
        icon={<Icons.Edit size={18} strokeWidth={1.7} />}
        title="Editar TER manualmente"
        subtitle={planNombre}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <div className={styles.form}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Nuevo TER</div>
            <div className={`${styles.row} ${styles.cols1}`}>
              <div className={styles.field}>
                <label className={styles.label}>
                  TER anual<span className={styles.req}>%</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  inputMode="decimal"
                  className={`${styles.input} ${styles.mono}`}
                  value={ter}
                  onChange={(e) => setTer(e.target.value)}
                  aria-label="TER manual del plan en porcentaje anual"
                  placeholder="ej. 1.50"
                  required
                />
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--atlas-v5-ink-4)',
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Consulta el cuadro de comisiones que te envía tu gestora.
              Introduce el TER (gestión + depositario + auditoría) como
              porcentaje anual. El override prevalece sobre el catálogo de
              ATLAS hasta que pulses "Volver al catálogo".
            </div>
          </div>
        </div>
        <ModalAtlasFooter
          info={
            fuenteActual === 'manual' ? (
              <>
                <Icons.Info size={13} strokeWidth={2} />
                Override manual activo · {terActual?.toFixed(2)} %
              </>
            ) : fuenteActual === 'catalogo' ? (
              <>
                <Icons.Info size={13} strokeWidth={2} />
                Catálogo ATLAS · {terActual?.toFixed(2)} %
              </>
            ) : (
              <>
                <Icons.Info size={13} strokeWidth={2} />
                Sin dato actual · introduce el TER de tu cuadro de comisiones.
              </>
            )
          }
          actions={
            <>
              {fuenteActual === 'manual' && (
                <ModalAtlasButtonGhost
                  onClick={handleResetCatalogo}
                  disabled={loading}
                >
                  Volver al catálogo
                </ModalAtlasButtonGhost>
              )}
              <ModalAtlasButtonGhost onClick={onClose} disabled={loading}>
                Cancelar
              </ModalAtlasButtonGhost>
              <ModalAtlasButtonGold type="submit" disabled={loading}>
                {loading ? 'Guardando…' : 'Guardar TER'}
              </ModalAtlasButtonGold>
            </>
          }
        />
      </form>
    </ModalAtlas>
  );
};

export default EditorTerModal;
