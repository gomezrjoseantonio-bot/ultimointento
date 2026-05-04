import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { TipoGasto } from '../../TipoGastoSelector/TipoGastoSelector.types';

export interface GastoGroup {
  familiaId: string;
  familiaLabel: string;
  compromisos: (CompromisoRecurrente & { id: number })[];
}

function inferFamilia(c: CompromisoRecurrente, mode: 'personal' | 'inmueble'): string {
  if (c.tipoFamilia) return c.tipoFamilia;
  if (mode === 'personal') {
    if (c.tipo === 'suministro') return 'suministros';
    if (c.tipo === 'suscripcion') return 'suscripciones';
    if (c.tipo === 'seguro' || c.tipo === 'cuota') return 'seguros_cuotas';
    if (c.tipo === 'impuesto') return 'otros';
  } else {
    if (c.tipo === 'impuesto') return 'tributos';
    if (c.tipo === 'suministro') return 'suministros';
    if (c.tipo === 'seguro') return 'seguros';
    if (c.tipo === 'comunidad') return 'comunidad';
  }
  return 'otros';
}

export function groupByCatalog(
  compromisos: CompromisoRecurrente[],
  catalog: TipoGasto[],
  mode: 'personal' | 'inmueble',
): GastoGroup[] {
  const withIds = compromisos.filter((c): c is CompromisoRecurrente & { id: number } => c.id != null);
  const groups: GastoGroup[] = catalog.map((tipo) => ({
    familiaId: tipo.id,
    familiaLabel: tipo.label,
    compromisos: withIds.filter((c) => inferFamilia(c, mode) === tipo.id),
  }));
  return groups.filter((g) => g.compromisos.length > 0);
}
