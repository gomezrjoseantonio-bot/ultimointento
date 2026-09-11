// La pregunta del arrastre con tope (`useArrastreConTope`): clasificar UNA
// línea resolvería más hermanas de la cuenta, y eso no se hace sin avisar.
// Vive junto a los avisos del panel y no bloquea nada (D2).

import React from 'react';
import { labelClasificacion } from '../../../../services/catalogo/catalogoUnico';
import type { ArrastrePendiente } from '../aprendizajeEnSesion';
import styles from './PanelConciliar.module.css';

interface AvisoArrastreProps {
  pendiente: ArrastrePendiente | null;
  onSi: () => void;
  onNo: () => void;
}

const AvisoArrastre: React.FC<AvisoArrastreProps> = ({ pendiente, onSi, onNo }) => {
  if (!pendiente) return null;
  const { a, cuantas } = pendiente;
  const familia = a.valores.familiaPersistir;
  const como = familia ? labelClasificacion(familia, a.valores.subtipoPersistir) : a.valores.concepto;
  return (
    <div className={styles.aviso} role="status" data-testid="aviso-arrastre">
      Hay <b>{cuantas} líneas más</b> como «{a.linea.textoBanco}» pendientes. ¿Clasificarlas también
      como <b>{como}</b>?
      <span className={styles.avisoAcciones}>
        <button type="button" className={`${styles.btnBloque} ${styles.btnBloqueFuerte}`} onClick={onSi}>
          Sí, las {cuantas}
        </button>
        <button type="button" className={styles.btnBloque} onClick={onNo}>
          No, solo esta
        </button>
      </span>
    </div>
  );
};

export default AvisoArrastre;
