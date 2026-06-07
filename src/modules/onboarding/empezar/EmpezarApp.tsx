/**
 * Onboarding día 0 · `/empezar` · app a pantalla completa (sin layout app).
 * Reentrante · el progreso vive en keyval y sobrevive a salir/volver y a
 * recargar. Router interno: welcome → hub → bloques → reveal.
 */
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastHost } from '../../../design-system/v5';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import WelcomeScreen from './WelcomeScreen';
import HubScreen from './HubScreen';
import RevealScreen from './RevealScreen';
import BloqueScreen from './bloques/BloqueScreen';
import { BLOQUES_ORDEN } from '../../../services/onboardingProgressService';
import styles from './empezar.module.css';

/**
 * Entrada de `/empezar`. Si la foto está intacta (ningún bloque tocado y sin
 * reveal visto) muestra el welcome; en cualquier otro caso (reentrada con
 * progreso) salta directo al hub.
 */
const EmpezarEntry: React.FC = () => {
  const { state, loading } = useOnboarding();
  if (loading) return <div className={styles.loading}>Cargando tu foto actual…</div>;

  const pristine = !state.revealVisto && BLOQUES_ORDEN.every((b) => state.bloques[b]?.estado === 'pendiente');
  return pristine ? <WelcomeScreen /> : <Navigate to="/empezar/hub" replace />;
};

const EmpezarApp: React.FC = () => {
  return (
    <OnboardingProvider>
      <div className={styles.root}>
        <Routes>
          <Route index element={<EmpezarEntry />} />
          <Route path="hub" element={<HubScreen />} />
          <Route path="reveal" element={<RevealScreen />} />
          <Route path=":bloqueId" element={<BloqueScreen />} />
          <Route path="*" element={<Navigate to="/empezar" replace />} />
        </Routes>
      </div>
      <ToastHost />
    </OnboardingProvider>
  );
};

export default EmpezarApp;
