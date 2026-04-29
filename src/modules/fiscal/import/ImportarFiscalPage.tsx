// Importador de declaración AEAT · ruta `/fiscal/importar/:anio`.
//
// Wrapper v5 que monta el `ImportarDeclaracionWizard` legacy de
// `horizon/fiscalidad/historico/`. Ese wizard usa el parser real
// (`parseIrpfXml`) + `distribuirDeclaracion` que pobla los stores
// con todos los datos · NO sólo casillas. Es la implementación que
// estaba probada y funcionando en producción.
//
// El wrapper proporciona la navegación v5 (volver al detalle del
// ejercicio · breadcrumb implícito) · todo lo demás se delega al
// wizard legacy hasta que se migre profundamente.

import React from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../design-system/v5';
import ImportarDeclaracionWizard from '../../horizon/fiscalidad/historico/ImportarDeclaracionWizard';
import type { FiscalOutletContext } from '../FiscalContext';
import styles from './ImportarFiscalPage.module.css';

const ImportarFiscalPage: React.FC = () => {
  const navigate = useNavigate();
  const { anio } = useParams<{ anio: string }>();
  const { reload } = useOutletContext<FiscalOutletContext>();

  const handleClose = () => {
    if (anio) navigate(`/fiscal/ejercicio/${anio}`);
    else navigate('/fiscal/ejercicios');
  };

  const handleImported = async () => {
    showToastV5('Declaración importada · datos distribuidos en los módulos.');
    await reload();
    if (anio) navigate(`/fiscal/ejercicio/${anio}`);
    else navigate('/fiscal/ejercicios');
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={handleClose}
        >
          <Icons.ArrowLeft size={12} strokeWidth={2} />
          Volver
        </button>
        <button type="button" className={styles.crumbBtn} onClick={() => navigate('/fiscal')}>
          Fiscal
        </button>
        <Icons.ChevronRight size={10} strokeWidth={2} />
        {anio && (
          <>
            <button
              type="button"
              className={styles.crumbBtn}
              onClick={() => navigate(`/fiscal/ejercicio/${anio}`)}
            >
              Ejercicio {anio}
            </button>
            <Icons.ChevronRight size={10} strokeWidth={2} />
          </>
        )}
        <span className={styles.current} aria-current="page">
          Importar declaración
        </span>
      </div>

      <ImportarDeclaracionWizard
        onClose={handleClose}
        onImported={handleImported}
        defaultMethod="xml"
        embedded
      />
    </div>
  );
};

export default ImportarFiscalPage;
