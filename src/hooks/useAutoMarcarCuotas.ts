import { useState, useEffect, useMemo } from 'react';
import { prestamosService } from '../services/prestamosService';

export function useAutoMarcarCuotas(prestamoIds: string[]) {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  // Join to a stable string for primitive comparison - avoids re-runs on array identity changes.
  const stableKey = useMemo(() => prestamoIds.join(','), [prestamoIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stableKey === '') return;

    setStatus('syncing');
    const ids = stableKey.split(',').filter(Boolean);
    Promise.all(ids.map(id => prestamosService.autoMarcarCuotasPagadas(id)))
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
  }, [stableKey]);

  return { status };
}
