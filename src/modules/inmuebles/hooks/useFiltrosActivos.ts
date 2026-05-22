import { useEffect, useState } from 'react';
import {
  FILTROS_INICIALES,
  type FiltrosActivos,
} from '../utils/filtrosActivos';

const STORAGE_KEY = 'atlas-contratos-filtros-activos';

function leerStorage(): FiltrosActivos {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return FILTROS_INICIALES;
    const parsed = JSON.parse(raw) as Partial<FiltrosActivos>;
    if (typeof parsed?.busqueda !== 'string') return FILTROS_INICIALES;
    if (typeof parsed?.tipo !== 'string') return FILTROS_INICIALES;
    if (typeof parsed?.estado !== 'string') return FILTROS_INICIALES;
    return {
      busqueda: parsed.busqueda,
      tipo: (parsed.tipo as FiltrosActivos['tipo']) ?? 'todos',
      estado: (parsed.estado as FiltrosActivos['estado']) ?? 'todos',
    };
  } catch {
    return FILTROS_INICIALES;
  }
}

export function useFiltrosActivos(): [
  FiltrosActivos,
  (next: FiltrosActivos) => void,
] {
  const [filtros, setFiltros] = useState<FiltrosActivos>(() => leerStorage());

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtros));
    } catch {
      // sessionStorage no disponible · ignorar silenciosamente
    }
  }, [filtros]);

  return [filtros, setFiltros];
}

export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
