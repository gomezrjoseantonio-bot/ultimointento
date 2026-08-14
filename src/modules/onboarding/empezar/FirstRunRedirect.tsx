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

/**
 * Decide si el usuario debe entrar al onboarding: SIN datos reales
 * (properties/accounts/contracts) y SIN progreso → `empezar`; si no → `panel`.
 * Exportada para reutilizarla como guardia desde el Panel (cubre entradas que
 * no pasan por el índice `/`, p.ej. ir directo a `/panel`).
 */
export async function decideFirstRun(): Promise<Exclude<Decision, 'pending'>> {
  try {
    // Escape para QA / previews: `?skipOnboarding=1` salta el "día 0" y entra
    // directo al Panel (el flag se guarda en la sesión para sobrevivir a los
    // redirects internos). Es OPT-IN: en producción nadie pasa ese parámetro,
    // así que el onboarding real no se toca. Útil porque cada deploy-preview es
    // un dominio nuevo con IndexedDB vacío y siempre caería en el onboarding.
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('skipOnboarding')) sessionStorage.setItem('atlas_skip_first_run', '1');
        if (sessionStorage.getItem('atlas_skip_first_run') === '1') return 'panel';
      } catch {
        /* sin window/sessionStorage · seguimos con la decisión normal */
      }
    }

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
    void decideFirstRun().then((d) => {
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
