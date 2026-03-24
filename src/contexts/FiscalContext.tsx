import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DeclaracionIRPF } from '../services/irpfCalculationService';
import { FuenteDeclaracion, obtenerDeclaracionParaEjercicio } from '../services/declaracionResolverService';
import {
  calcularEstimacionEnCurso,
  EstimacionEjercicioEnCurso,
} from '../services/estimacionFiscalEnCursoService';
import { invalidateFiscalCache } from '../services/fiscalCacheService';

export interface FiscalData {
  ejercicio: number;
  setEjercicio: (ej: number) => void;
  declaracion: DeclaracionIRPF | null;
  fuente: FuenteDeclaracion;
  estimacion: EstimacionEjercicioEnCurso | null;
  loading: boolean;
  /** Force a full recalculation (invalidates cache) */
  reload: () => void;
}

const FiscalContext = createContext<FiscalData>({
  ejercicio: new Date().getFullYear(),
  setEjercicio: () => {},
  declaracion: null,
  fuente: 'vivo',
  estimacion: null,
  loading: true,
  reload: () => {},
});

export const useFiscalData = () => useContext(FiscalContext);

export const FiscalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ejercicio, setEjercicio] = useState<number>(new Date().getFullYear());
  const [declaracion, setDeclaracion] = useState<DeclaracionIRPF | null>(null);
  const [fuente, setFuente] = useState<FuenteDeclaracion>('vivo');
  const [estimacion, setEstimacion] = useState<EstimacionEjercicioEnCurso | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [declResult, estimacionResult] = await Promise.all([
        obtenerDeclaracionParaEjercicio(ejercicio),
        calcularEstimacionEnCurso(ejercicio),
      ]);
      setDeclaracion(declResult.declaracion);
      setFuente(declResult.fuente);
      setEstimacion(estimacionResult);
    } catch (e) {
      console.error('[FiscalContext] Error loading fiscal data:', e);
    } finally {
      setLoading(false);
    }
  }, [ejercicio, reloadCounter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const reload = useCallback(() => {
    invalidateFiscalCache(ejercicio);
    setReloadCounter((c) => c + 1);
  }, [ejercicio]);

  const value = useMemo<FiscalData>(
    () => ({ ejercicio, setEjercicio, declaracion, fuente, estimacion, loading, reload }),
    [ejercicio, declaracion, fuente, estimacion, loading, reload],
  );

  return <FiscalContext.Provider value={value}>{children}</FiscalContext.Provider>;
};
