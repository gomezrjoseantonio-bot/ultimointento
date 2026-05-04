import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';
import type { SortState } from '../ListadoGastosRecurrentes.types';
import { computeMonthly } from '../../utils/compromisoUtils';

export function sortCompromisos(
  list: (CompromisoRecurrente & { id: number })[],
  sort: SortState,
): (CompromisoRecurrente & { id: number })[] {
  if (!sort.field) return list;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (sort.field === 'nombre') {
      cmp = a.alias.localeCompare(b.alias, 'es');
    } else if (sort.field === 'importe') {
      cmp = computeMonthly(a) - computeMonthly(b);
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}
