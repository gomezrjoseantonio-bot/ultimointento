// T23.2 · Wizard "Nueva posición" · 3 caminos (§ 3.2 spec).
//
// Modal en 2 pasos:
//   - Paso 1 · 3 tarjetas seleccionables · alta manual · IndexaCapital · aportaciones
//   - Paso 2A · render `<PosicionFormDialog>` (alta manual · cierra wizard al guardar)
//   - Paso 2B/2C · navega a la ruta de importador correspondiente y cierra wizard
//
// Reusa `<PosicionFormDialog>` y las rutas `/inversiones/importar-indexa` ·
// `/inversiones/importar-aportaciones` (intactos · solo cambia el disparador).

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import type { PosicionInversion } from '../../../types/inversiones';
import PosicionFormDialog from './PosicionFormDialog';
import styles from './WizardModal.module.css';

type Camino = 'manual' | 'indexa' | 'aportaciones';

interface Props {
  /** Persistencia de la posición creada manualmente. */
  onSavePosicion: (
    data: Partial<PosicionInversion> & { importe_inicial?: number },
  ) => Promise<void> | void;
  /** Cierre · llamar también después de guardar / navegar. */
  onClose: () => void;
}

type LucideIcon = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
}>;

const OPCIONES: Array<{
  key: Camino;
  title: string;
  sub: string;
  Icon: LucideIcon;
}> = [
  {
    key: 'manual',
    title: 'Alta manual',
    sub: 'Crear posición desde cero · indica tipo · entidad · valor · aportaciones.',
    Icon: Icons.Edit,
  },
  {
    key: 'indexa',
    title: 'Desde IndexaCapital',
    sub: 'Importar tu cartera Indexa con los datos históricos del broker.',
    Icon: Icons.Download,
  },
  {
    key: 'aportaciones',
    title: 'Desde aportaciones (Excel · CSV · PDF)',
    sub: 'Importar histórico de aportaciones desde un fichero exportado del broker.',
    Icon: Icons.Upload,
  },
];

const WizardNuevaPosicion: React.FC<Props> = ({ onSavePosicion, onClose }) => {
  const navigate = useNavigate();
  const [camino, setCamino] = useState<Camino | null>(null);

  const handleSelect = (key: Camino) => {
    if (key === 'indexa') {
      onClose();
      navigate('/inversiones/importar-indexa');
      return;
    }
    if (key === 'aportaciones') {
      onClose();
      navigate('/inversiones/importar-aportaciones');
      return;
    }
    setCamino('manual');
  };

  // Paso 2A · alta manual · `PosicionFormDialog` ya es un modal independiente
  // y se ocupa de su propio chrome (no envolvemos en el overlay del wizard).
  if (camino === 'manual') {
    return (
      <PosicionFormDialog
        onSave={async (data) => {
          await onSavePosicion(data);
          onClose();
        }}
        onClose={onClose}
      />
    );
  }

  // Paso 1 · selector de camino
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="wizard-title" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h2 id="wizard-title" className={styles.modalTitle}>
              Nueva posición
            </h2>
            <div className={styles.modalSub}>
              Elige cómo quieres añadir la posición a tu cartera.
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icons.Close size={14} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.opcionesGrid}>
          {OPCIONES.map(({ key, title, sub, Icon }) => (
            <button
              key={key}
              type="button"
              className={styles.opcion}
              onClick={() => handleSelect(key)}
            >
              <div className={styles.opcionIcon}>
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div className={styles.opcionTextos}>
                <div className={styles.opcionTitle}>{title}</div>
                <div className={styles.opcionSub}>{sub}</div>
              </div>
              <span className={styles.opcionArrow} aria-hidden>
                <Icons.ChevronRight size={16} strokeWidth={2} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WizardNuevaPosicion;
