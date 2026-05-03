import type { Nomina, Autonomo, OtrosIngresos } from '../../types/personal';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';

export interface PersonalOutletContext {
  nominas: Nomina[];
  autonomos: Autonomo[];
  otrosIngresos: OtrosIngresos[];
  compromisos: CompromisoRecurrente[];
  reload: () => void;
}
