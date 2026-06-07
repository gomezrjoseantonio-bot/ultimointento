/**
 * Gate del índice de la app (`/`). Primer login SIN datos y SIN progreso de
 * onboarding → redirige a `/empezar` (welcome). En cualquier otro caso → Panel.
 * Reentrante: si ya hay datos o progreso, nunca interrumpe.
 */
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { initDB } from '../../../services/db';
import { getOnboardingState } from '../../../services/onboardingProgressService';
import { BLOQUES_ORDEN } from '../../../services/onboardingProgressService';

type Decision = 'pending' | 'empezar' | 'panel';

async function decide(): Promise<Exclude<Decision, 'pending'>> {
  try {
    const db = await initDB();
    const [properties, accounts, contracts] = await Promise.all([
      db.getAll('properties'),
      db.getAll('accounts'),
      db.getAll('contracts'),
    ]);
    const hasData = properties.length > 0 || accounts.length > 0 || contracts.length > 0;

    const state = await getOnboardingState();
    const hasProgress =
      state.revealVisto || BLOQUES_ORDEN.some((b) => state.bloques[b]?.estado !== 'pendiente');

    return !hasData && !hasProgress ? 'empezar' : 'panel';
  } catch {
    // Ante cualquier fallo de lectura · no bloquear · ir al Panel.
    return 'panel';
  }
}

const FirstRunRedirect: React.FC = () => {
  const [decision, setDecision] = useState<Decision>('pending');

  useEffect(() => {
    let alive = true;
    void decide().then((d) => {
      if (alive) setDecision(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (decision === 'pending') return null;
  return <Navigate to={decision === 'empezar' ? '/empezar' : '/panel'} replace />;
};

export default FirstRunRedirect;
