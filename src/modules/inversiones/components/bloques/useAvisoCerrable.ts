// useAvisoCerrable · hook · gestiona el ciclo "leer flag · ocultar al cerrar"
// para los banners cerrables (§9.2).
// T-INVERSIONES-DETALLE-PP-v1 · PR 4.

import { useCallback, useEffect, useState } from 'react';
import { cerrarAviso, estaAvisoActivo } from '../../../../services/avisosUsuarioService';

interface UseAvisoCerrableOptions {
  ubicacionContexto?: string;
  etiqueta?: string;
  onClose?: () => void;
}

/**
 * Devuelve `{ visible, cerrar }`. Mientras consulta el flag inicialmente
 * `visible === false` para evitar flashes · una vez resuelto, refleja el
 * estado real del store.
 */
export function useAvisoCerrable(
  avisoId: string,
  opts: UseAvisoCerrableOptions = {},
): { visible: boolean; cerrar: () => Promise<void> } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const activo = await estaAvisoActivo(avisoId);
        if (!cancelado) setVisible(activo);
      } catch {
        // En error · mostrar (degradación segura · el usuario puede cerrar de nuevo).
        if (!cancelado) setVisible(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [avisoId]);

  const cerrar = useCallback(async () => {
    // UX optimista · ocultar inmediato; si la persistencia falla, queda
    // oculto en esta sesión y se reabrirá tras reload (el flag no se puso).
    setVisible(false);
    try {
      await cerrarAviso(avisoId, {
        ubicacionContexto: opts.ubicacionContexto,
        etiqueta: opts.etiqueta,
      });
      opts.onClose?.();
    } catch {
      // Silencioso · el banner queda oculto en esta sesión.
    }
  }, [avisoId, opts]);

  return { visible, cerrar };
}
