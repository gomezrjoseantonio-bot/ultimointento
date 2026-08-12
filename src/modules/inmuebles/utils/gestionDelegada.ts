// Gestión delegada por agencias · predicados de dominio (Fase 1).
//
// Distingue los tres papeles que puede tener un Contract respecto a la gestión
// delegada (ver docs/DISENO-gestion-delegada-agencias-V1.md):
//   · contrato de GESTIÓN (padre) · lleva bloque `gestion` · es el operativo del
//     piso (renta garantizada), NO-LAU.
//   · SUBCONTRATO de inquilino (hijo) · lleva `gestionPadreId` · es fiscal:
//     NO cuenta en operativo/ocupación; su renta suma a la facturación del padre.
//   · contrato normal (autogestión) · ninguno de los dos.
//
// `gestion` y `gestionPadreId` son mutuamente excluyentes por diseño.

import type { Contract } from '../../../services/db';

/** ¿Es el contrato de gestión (padre) de un piso en gestión delegada? */
export function esContratoGestion(c: Contract): boolean {
  return c.gestion != null;
}

/** ¿Es un subcontrato de inquilino anexado a un contrato de gestión (hijo)? */
export function esSubcontratoAnexado(c: Contract): boolean {
  return c.gestionPadreId != null;
}

/**
 * Agrupa los subcontratos anexados por el id de su contrato de gestión (padre).
 * Para pintarlos anidados bajo el padre en la lista de Vigentes.
 */
export function agruparSubcontratosPorPadre(
  contracts: Contract[],
): Map<number, (Contract & { id: number })[]> {
  const map = new Map<number, (Contract & { id: number })[]>();
  for (const c of contracts) {
    if (c.gestionPadreId == null || c.id == null) continue;
    const arr = map.get(c.gestionPadreId) ?? [];
    arr.push(c as Contract & { id: number });
    map.set(c.gestionPadreId, arr);
  }
  return map;
}

/**
 * ¿Debe este contrato contar en los KPIs/tabs OPERATIVOS?
 *
 * Los subcontratos anexados (hijos) son historia fiscal y quedan fuera del
 * operativo, igual que los `sin_identificar` y `sin_firmar`. El contrato de
 * gestión (padre) sí cuenta: es el operativo del piso. Los contratos normales
 * también.
 */
export function cuentaEnOperativo(c: Contract): boolean {
  return !esSubcontratoAnexado(c);
}
