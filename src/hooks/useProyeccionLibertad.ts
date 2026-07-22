import { useEffect, useRef, useState } from 'react';
import {
  proyectarLibertadDesdeRepo,
} from '../services/libertadService';
import type {
  ResultadoLibertad,
  LibertadConfig,
} from '../types/libertad';
import type { SupuestosProyeccion } from '../types/supuestosProyeccion';

export interface UseProyeccionLibertadOptions {
  /**
   * Override parcial de supuestos (sliders del simulador). Si undefined, el
   * servicio resuelve de la fuente única (Escenario · C-PROY-5 B1).
   */
  supuestos?: Partial<SupuestosProyeccion>;
  /** Override de config · si undefined usa STANDARD o lo que tenga el escenario */
  configOverride?: LibertadConfig;
  /** Si false · no dispara el fetch · permite uso condicional · default true */
  enabled?: boolean;
}

export interface UseProyeccionLibertadResult {
  data: ResultadoLibertad | null;
  loading: boolean;
  error: Error | null;
}

export function useProyeccionLibertad(
  options: UseProyeccionLibertadOptions = {},
): UseProyeccionLibertadResult {
  const {
    supuestos,
    configOverride,
    enabled = true,
  } = options;

  // Primitivos extraídos para deps estables (sin objetos que cambien referencia cada render)
  const inflacionGastosPct = supuestos?.inflacionGastosPct;
  const subidaRentasPct = supuestos?.subidaRentasPct;
  const alcance = configOverride?.alcanceRentaPasiva;
  const reglaCruce = configOverride?.reglaCruce;
  const horizonte = configOverride?.horizonteAnios;
  const mantenimiento = configOverride?.mantenimientoMinMeses;
  const colchon = configOverride?.colchonPctSobreGastos;

  const [data, setData] = useState<ResultadoLibertad | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Refs para acceder a los valores más recientes dentro del efecto sin añadirlos a deps
  const supuestosRef = useRef(supuestos);
  supuestosRef.current = supuestos;
  const configOverrideRef = useRef(configOverride);
  configOverrideRef.current = configOverride;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    proyectarLibertadDesdeRepo(supuestosRef.current, configOverrideRef.current)
      .then((resultado) => {
        if (!cancelled) {
          setData(resultado);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const e = err instanceof Error ? err : new Error(String(err));
          console.error('[useProyeccionLibertad] error', e);
          setError(e);
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    inflacionGastosPct,
    subidaRentasPct,
    alcance,
    reglaCruce,
    horizonte,
    mantenimiento,
    colchon,
  ]);

  return { data, loading, error };
}
