import type { TipoGasto } from '../TipoGastoSelector/TipoGastoSelector.types';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';

export interface ListadoGastosRecurrentesProps {
  catalog: TipoGasto[];
  compromisos: CompromisoRecurrente[];
  mode: 'personal' | 'inmueble';
  onDelete: (c: CompromisoRecurrente) => Promise<void>;
  onReload?: () => void;
  inmuebleId?: number;
  onNuevo?: () => void;
  onImportar?: () => void;
  onDetectar?: () => void;
  /**
   * Optional override for the edit action. By default the listing opens an
   * internal `<EditDrawer />`. Pass this to navigate to a full-page editor
   * instead (legacy callers may still rely on it).
   */
  onEdit?: (c: CompromisoRecurrente) => void;
}

export type SortField = 'nombre' | 'importe';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  field: SortField | null;
  dir: SortDir;
}
