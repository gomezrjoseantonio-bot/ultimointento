import type { TipoGasto } from '../TipoGastoSelector/TipoGastoSelector.types';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';

export interface ListadoGastosRecurrentesProps {
  /**
   * Catálogo de presentación. OPCIONAL: si no se pasa, se construye desde el
   * catálogo UNIFICADO según `mode` (`catalogoTipoGasto`). Así todas las
   * pantallas ofrecen el mismo árbol de gastos y deja de haber uno por sitio.
   */
  catalog?: TipoGasto[];
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
  /** Conceptos sugeridos por la modalidad del contrato (§3.3) · se resaltan en el picker. */
  conceptosSugeridos?: Array<{ tipoId: string; subtipoId: string }>;
  /** Inmuebles para el reparto de un recibo entre varios (§2.7). Incluye el actual. */
  inmueblesDisponibles?: Array<{ id: number; label: string }>;
}
