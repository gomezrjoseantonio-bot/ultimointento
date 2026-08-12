// Paso 0 · elección de tipo de contrato antes de crear. Bifurca el flujo:
//   · Alquiler directo (autogestión) → wizard LAU existente.
//   · Gestión delegada por agencia    → wizard de gestión (renta garantizada).
// En modo edición (`?edit=`) se salta el paso 0 y va directo al wizard LAU.

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHead, Icons } from '../../../design-system/v5';
import NuevoContratoWizard from './NuevoContratoWizard';
import NuevoContratoGestionWizard from './NuevoContratoGestionWizard';
import styles from './NuevoContrato.module.css';

type Tipo = 'directo' | 'gestion';

const NuevoContrato: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const esEdicion = searchParams.get('edit') !== null;
  const fromEmpezar = searchParams.get('from') === 'empezar';
  // Anexar un subcontrato de inquilino a un contrato de gestión → siempre LAU.
  const esAnexar = searchParams.get('gestionPadre') !== null;

  // En edición o anexado no hay elección: se va directo al contrato LAU.
  const [tipo, setTipo] = useState<Tipo | null>(esEdicion || esAnexar ? 'directo' : null);

  if (tipo === 'directo') return <NuevoContratoWizard />;
  if (tipo === 'gestion') return <NuevoContratoGestionWizard onBack={() => setTipo(null)} />;

  return (
    <>
      <PageHead
        breadcrumb={[
          { label: 'Alquileres', onClick: () => navigate('/contratos') },
          { label: 'Nuevo' },
        ]}
        onBack={() => navigate(fromEmpezar ? '/empezar/contratos' : '/contratos')}
        title="Nuevo contrato"
        sub="elige cómo gestionas este alquiler"
      />

      <div className={styles.cards} role="group" aria-label="Tipo de contrato">
        <button type="button" className={styles.card} onClick={() => setTipo('directo')}>
          <span className={styles.cardIcon}>
            <Icons.Contratos size={22} strokeWidth={1.8} />
          </span>
          <span className={styles.cardTitle}>Alquiler directo</span>
          <span className={styles.cardDesc}>
            Tú firmas con el inquilino y cobras tú la renta.
          </span>
        </button>

        <button type="button" className={styles.card} onClick={() => setTipo('gestion')}>
          <span className={styles.cardIcon}>
            <Icons.Cartera size={22} strokeWidth={1.8} />
          </span>
          <span className={styles.cardTitle}>Gestión delegada</span>
          <span className={styles.cardDesc}>
            Una agencia gestiona el alquiler del piso por ti.
          </span>
        </button>
      </div>
    </>
  );
};

export default NuevoContrato;
