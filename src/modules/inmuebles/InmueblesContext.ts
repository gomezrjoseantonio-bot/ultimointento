import type { Property, Contract } from '../../services/db';

export interface InmueblesOutletContext {
  properties: Property[];
  contracts: Contract[];
  /** Forzar recarga · útil tras crear/editar un contrato. */
  reload: () => void;
}
