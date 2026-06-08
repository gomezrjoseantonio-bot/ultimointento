/**
 * Bloque núcleo · persona. ES el formulario fiscal real embebido (no una
 * página-puente): reutiliza `PerfilFiscalForm` · la misma "fuente única de
 * verdad fiscal" que Ajustes → Perfil fiscal y convivencia. Al guardar, marca
 * el bloque completado y vuelve al mapa.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import OnboardingTopbar from '../OnboardingTopbar';
import { useOnboarding } from '../OnboardingContext';
import PerfilFiscalForm from '../../../ajustes/components/PerfilFiscalForm';
import styles from '../empezar.module.css';

const PersonaBloque: React.FC = () => {
  const navigate = useNavigate();
  const { setBloque } = useOnboarding();

  const handleSaved = async () => {
    await setBloque('persona', 'completado', 'Datos fiscales guardados');
    showToastV5('Tus datos quedan guardados · bloque persona completado', 'success');
    navigate('/empezar/hub');
  };

  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>Bloque núcleo · quién eres</div>
        <h1 className={styles.h1}>Tus datos</h1>
        <p className={styles.sub}>
          Tu situación personal y fiscal · comunidad autónoma · estado civil · convivencia. Con esto Atlas afina tu
          IRPF y separa lo tuyo de lo de tu pareja.
        </p>

        <PerfilFiscalForm
          submitLabel="Guardar y volver al mapa"
          secondary={
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/empezar/hub')}>
              <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Volver al mapa
            </button>
          }
          onSaved={handleSaved}
        />
      </div>
    </>
  );
};

export default PersonaBloque;
