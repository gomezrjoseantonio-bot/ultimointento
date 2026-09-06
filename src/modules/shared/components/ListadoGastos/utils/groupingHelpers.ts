import type { CompromisoRecurrente } from '../../../../../types/compromisosRecurrentes';
import type { TipoGasto } from '../../TipoGastoSelector/TipoGastoSelector.types';

export interface GastoGroup {
  familiaId: string;
  familiaLabel: string;
  compromisos: (CompromisoRecurrente & { id: number })[];
}

/** La familia con la que se agrupa · la del catálogo único, o «sin clasificar». */
function familiaDe(c: CompromisoRecurrente): string {
  return c.familia ?? '__sin_familia__';
}

export function groupByCatalog(
  compromisos: CompromisoRecurrente[],
  catalog: TipoGasto[],
  _mode: 'personal' | 'inmueble',
): GastoGroup[] {
  const withIds = compromisos.filter((c): c is CompromisoRecurrente & { id: number } => c.id != null);
  const groups: GastoGroup[] = catalog.map((tipo) => ({
    familiaId: tipo.id,
    familiaLabel: tipo.label,
    compromisos: withIds.filter((c) => familiaDe(c) === tipo.id),
  }));

  // Los que no caen en NINGUNA familia del catálogo van a un grupo de recogida.
  //
  // Sin esto desaparecían de la pantalla, y un gasto que no se ve pero sigue
  // emitiendo previsiones es lo peor de los dos mundos: cobra en Tesorería y no
  // hay fila donde editarlo ni borrarlo. Caen aquí los gastos sin familia (los
  // anteriores al catálogo único · Regla A · se reclasifican a mano) y los
  // clasificados con una familia que este ámbito no sugiere.
  const clasificados = new Set(groups.flatMap((g) => g.compromisos.map((c) => c.id)));
  const sinFamilia = withIds.filter((c) => !clasificados.has(c.id));
  if (sinFamilia.length > 0) {
    groups.push({
      familiaId: '__sin_familia__',
      familiaLabel: 'Sin clasificar',
      compromisos: sinFamilia,
    });
  }

  return groups.filter((g) => g.compromisos.length > 0);
}

// ── Agrupación por BLOQUES del mockup §3.1 (solo inmueble) ────────────────────
// Bloques: comunidad y tributos · suministros · seguros · administración ·
// propias de la modalidad · otros. Los grupos de estado (preparados · dados de
// baja) los añade la fase de estados (4c), no esto.

// «Propias de la modalidad» se define por familia + subtipo (los turísticos de
// §3.3), no por familia de catálogo a secas.
const MODALIDAD = new Set(['limpieza:por_estancia', 'limpieza:lavanderia', 'gestion:comision_plataformas', 'impuestos_tasas:licencia_turistica']);

const BLOQUES_INMUEBLE_ORDEN: Array<{ id: string; label: string }> = [
  { id: 'comunidad_tributos', label: 'Comunidad y tributos' },
  { id: 'suministros', label: 'Suministros' },
  { id: 'seguros', label: 'Seguros' },
  { id: 'administracion', label: 'Administración' },
  { id: 'modalidad', label: 'Propias de la modalidad' },
  // Reparación/mantenimiento y "otros": §2.10 deja su ubicación SIN decidir (a la
  // lista) · aquí caen en un bloque neutro para no perderlos ni inventar sitio.
  { id: 'otros', label: 'Otros' },
];

export function blockForInmueble(c: CompromisoRecurrente): { id: string; label: string } {
  if (c.familia && MODALIDAD.has(`${c.familia}:${c.subtipo ?? ''}`)) {
    return { id: 'modalidad', label: 'Propias de la modalidad' };
  }
  const fam = c.familia;
  if (fam === 'comunidad' || fam === 'impuestos_tasas') return { id: 'comunidad_tributos', label: 'Comunidad y tributos' };
  if (fam === 'suministro') return { id: 'suministros', label: 'Suministros' };
  if (fam === 'seguros_alarmas' && c.subtipo !== 'alarma') return { id: 'seguros', label: 'Seguros' };
  if (fam === 'gestion') return { id: 'administracion', label: 'Administración' };
  return { id: 'otros', label: 'Otros' };
}

export function groupByBlocksInmueble(compromisos: CompromisoRecurrente[]): GastoGroup[] {
  const withIds = compromisos.filter((c): c is CompromisoRecurrente & { id: number } => c.id != null);
  return BLOQUES_INMUEBLE_ORDEN.map((b) => ({
    familiaId: b.id,
    familiaLabel: b.label,
    compromisos: withIds.filter((c) => blockForInmueble(c).id === b.id),
  })).filter((g) => g.compromisos.length > 0);
}
