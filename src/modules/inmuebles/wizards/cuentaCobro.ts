// Carga y etiqueta de cuentas de cobro para el wizard de contratos. En `.ts`
// (sin JSX) para no engordar el componente ni el indicador de líneas del wizard.

import { useEffect, useState } from 'react';
import type { Account } from '../../../services/db';
import { treasuryAPI } from '../../../services/treasuryApiService';

/** Etiqueta legible de una cuenta para el selector de cobro. */
export const cuentaLabel = (a: Account): string =>
  a.alias || a.banco?.name || a.ibanMasked || a.iban || `Cuenta #${a.id ?? ''}`;

/**
 * Carga (una vez, al montar) las cuentas de Tesorería con id numérico. Se llama
 * a nivel del wizard para que el selector esté listo al llegar al paso Económico.
 */
export function useCuentasCobro(): Account[] {
  const [cuentas, setCuentas] = useState<Account[]>([]);
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const list = await treasuryAPI.accounts.getAccounts();
        const validas = Array.isArray(list)
          ? list.filter((a): a is Account => typeof a?.id === 'number')
          : [];
        if (!cancelado) setCuentas(validas);
      } catch {
        if (!cancelado) setCuentas([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);
  return cuentas;
}
