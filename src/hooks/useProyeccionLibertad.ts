import { useCallback, useEffect, useState } from 'react';
import {
  proyectarLibertadDesdeRepo,
} from '../services/libertadService';
import type {
  ResultadoLibertad,
  SupuestosLibertad,
  LibertadConfig,
} from '../types/libertad';
import { SUPUESTOS_NEUTROS_LIBERTAD } from '../types/libertad';

export interface UseProyeccionLibertadOptions {
  /** Override de supuestos · default neutros · usado por T27.4.3 simulador con sliders */
  supuestos?: SupuestosLibertad;
  /** Override de config · si undefined usa STANDARD o lo que tenga el escenario */
  configOverride?: LibertadConfig;
  /** Si false · no dispara el fetch · permite uso condicional · default true */
  enabled?: boolean;
}

export interface UseProyeccionLibertadResult {
  data: ResultadoLibertad | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProyeccionLibertad(
  options: UseProyeccionLibertadOptions = {},
): UseProyeccionLibertadResult {
  const {
    supuestos = SUPUESTOS_NEUTROS_LIBERTAD,
    configOverride,
    enabled = true,
  } = options;

  const [data, setData] = useState<ResultadoLibertad | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  const cargar = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const resultado = await proyectarLibertadDesdeRepo(supuestos, configOverride);
      setData(resultado);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error('[useProyeccionLibertad] error', e);
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    supuestos.inflacionAnualPct,
    supuestos.subidaAnualRentasPct,
    supuestos.subidaAnualGastosVidaPct,
    configOverride?.alcanceRentaPasiva,
    configOverride?.reglaCruce,
    configOverride?.horizonteAnios,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { data, loading, error, refetch: cargar };
}
