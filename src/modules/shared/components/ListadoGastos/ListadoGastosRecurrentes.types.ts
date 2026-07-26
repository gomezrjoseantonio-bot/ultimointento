import type { TipoGasto } from '../TipoGastoSelector/TipoGastoSelector.types';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';

export interface ListadoGastosRecurrentesProps {
  catalog: TipoGasto[];
  compromisos: CompromisoRecurrente[];
  mode: 'personal' | 'inmueble';
  onDelete: (c: CompromisoRecurrente) => Promise<void>;
  onReload?: () => void;
  inmuebleId?: number;
  onImportar?: () => void;
  onDetectar?: () => void;
  /** Subtítulo bajo el H1 (§3.1). Por defecto se deriva del modo. */
  subtitulo?: string;
  /** Nombre del inmueble para la miga de pan (modo inmueble). */
  contextoNombre?: string;
}
