// REORG Contratos · Commit 3 · hooks de filtrado por tab y KPIs (spec § 2.1 / § 2.2).
//
// El filtrado es runtime sobre el estado efectivo: garantiza que un Rentila
// finalizado nunca aparezca en Vigentes y que un firmado sin empezar viva en
// Próximos hasta su `fechaInicio`. Sin job nocturno · auto-promoción al releer.

import { useMemo } from 'react';
import type { Contract, Property } from '../../../services/db';
import { getEstadoEfectivo, type TabKey } from '../utils/estadoEfectivoService';
import { esInquilinoIdentificado } from '../utils/inquilinoUtils';
import { calcularKpisContratos, type ContratosKPIs } from '../utils/kpisContratosService';

/**
 * Devuelve los contratos que corresponden a un tab según el estado efectivo.
 * Para tabs que no filtran por estado (`disponibilidad`, `analisis`, `conciliar`)
 * devuelve la lista completa — esos tabs aplican su propia lógica.
 */
export function useContratosByTab(tab: TabKey, contracts: Contract[]): Contract[] {
  return useMemo(() => {
    // FIX § 1.2/§ 1.4 · los tabs de inquilino real excluyen los contratos sin
    // identificar (rentas declaradas AEAT) · su sitio es Por conciliar.
    switch (tab) {
      case 'vigentes':
        return contracts.filter(
          (c) => getEstadoEfectivo(c) === 'vigente' && esInquilinoIdentificado(c),
        );
      case 'proximos':
        return contracts.filter(
          (c) => getEstadoEfectivo(c) === 'proximo' && esInquilinoIdentificado(c),
        );
      case 'historico':
        return contracts.filter(
          (c) => getEstadoEfectivo(c) === 'finalizado' && esInquilinoIdentificado(c),
        );
      case 'disponibilidad':
      case 'analisis':
      case 'conciliar':
      default:
        return contracts;
    }
  }, [tab, contracts]);
}

/** KPIs de la banda navy · memoizados sobre contratos + inmuebles. */
export function useContratosKPIs(
  contracts: Contract[],
  properties: Property[],
): ContratosKPIs {
  return useMemo(
    () => calcularKpisContratos(contracts, properties),
    [contracts, properties],
  );
}
