import type { TipoGasto } from '../TipoGastoSelector/TipoGastoSelector.types';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';

export interface ListadoGastosRecurrentesProps {
  catalog: TipoGasto[];
  compromisos: CompromisoRecurrente[];
  mode: 'personal' | 'inmueble';
  onEdit: (c: CompromisoRecurrente) => void;
  onDelete: (c: CompromisoRecurrente) => Promise<void>;
  onReload?: () => void;
  inmuebleId?: number;
  onNuevo?: () => void;
  onImportar?: () => void;
  onDetectar?: () => void;
}

export type SortField = 'nombre' | 'importe';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  field: SortField | null;
  dir: SortDir;
}
