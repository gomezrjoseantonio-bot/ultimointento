/**
 * Contexto del onboarding · estado + progreso compartidos entre topbar, hub
 * y bloques. Fuente de verdad: `onboardingProgressService` (keyval). Cada
 * pantalla puede pedir `refresh()` tras crear entidades para reflejar avance.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getOnboardingState,
  computeProgress,
  defaultOnboardingState,
  setBloqueEstado as persistBloqueEstado,
  type OnboardingState,
  type OnboardingProgress,
  type BloqueId,
  type BloqueEstado,
} from '../../../services/onboardingProgressService';
import { syncNucleoFromData } from '../../../services/onboardingSyncService';

interface OnboardingContextValue {
  state: OnboardingState;
  progress: OnboardingProgress;
  loading: boolean;
  refresh: () => Promise<void>;
  setBloque: (bloque: BloqueId, estado: BloqueEstado, detalle?: string) => Promise<void>;
}

const Ctx = createContext<OnboardingContextValue | null>(null);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>(() => defaultOnboardingState());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Reentrante · primero refleja la realidad de los stores en los bloques
    // de núcleo · luego lee el estado consolidado.
    await syncNucleoFromData().catch(() => undefined);
    const fresh = await getOnboardingState();
    setState(fresh);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setBloque = useCallback(
    async (bloque: BloqueId, estado: BloqueEstado, detalle?: string) => {
      const next = await persistBloqueEstado(bloque, estado, detalle);
      setState(next);
    },
    [],
  );

  const progress = useMemo(() => computeProgress(state), [state]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ state, progress, loading, refresh, setBloque }),
    [state, progress, loading, refresh, setBloque],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding debe usarse dentro de <OnboardingProvider>');
  return ctx;
}
