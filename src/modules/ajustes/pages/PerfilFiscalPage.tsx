import React from 'react';
import { Icons, showToastV5 } from '../../../design-system/v5';
import PerfilFiscalForm from '../components/PerfilFiscalForm';
import containerStyles from '../AjustesPage.module.css';
import styles from './PerfilFiscalPage.module.css';

/**
 * Ajustes → Perfil fiscal y convivencia. Una de las DOS puertas al mismo dato:
 * delega TODO en `PerfilFiscalForm` (store real `personalData`). La otra puerta
 * es el bloque persona del onboarding (`/empezar/persona`).
 */
const PerfilFiscalPage: React.FC = () => (
  <>
    <div className={containerStyles.contentHead}>
      <div>
        <h1 className={containerStyles.contentTitle}>Perfil fiscal y convivencia</h1>
        <div className={containerStyles.contentSub}>
          datos del contribuyente · pareja co-titular · personas a cargo · alimentan los cálculos
          IRPF y la lógica del hogar en Personal
        </div>
      </div>
    </div>

    <div className={styles.banner}>
      <Icons.Info size={16} strokeWidth={2} />
      <div>
        Estos datos son la <strong>fuente única de verdad fiscal del hogar</strong>. Alimentan los
        cálculos de Fiscal · la separación titular vs pareja en Personal · y el ámbito de los
        gastos compartidos. Si no rellenas correctamente · ATLAS asume contribuyente individual sin
        cargas.
      </div>
    </div>

    <PerfilFiscalForm
      submitLabel="Guardar cambios"
      onSaved={() => showToastV5('Datos guardados · recalculando IRPF previsto', 'success')}
    />
  </>
);

export default PerfilFiscalPage;
