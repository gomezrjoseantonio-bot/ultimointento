import type { Nomina, Autonomo } from '../../types/personal';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

export interface PersonalOutletContext {
  nominas: Nomina[];
  autonomos: Autonomo[];
  otrosIngresos: unknown[];
  compromisos: CompromisoRecurrente[];
  reload: () => void;
}
