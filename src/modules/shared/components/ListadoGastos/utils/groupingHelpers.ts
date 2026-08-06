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

  // Los que no caen en NINGUNA familia del catálogo van a un grupo de recogida.
  //
  // Sin esto desaparecían de la pantalla, y un gasto que no se ve pero sigue
  // emitiendo previsiones es lo peor de los dos mundos: cobra en Tesorería y no
  // hay fila donde editarlo ni borrarlo.
  //
  // Pasa de verdad, y no hace falta ningún dato corrupto: las familias de los
  // dos catálogos NO son las mismas (inmueble tiene `seguros`, personal tiene
  // `seguros_cuotas`). Un seguro de vida dado de alta desde la pestaña de un
  // inmueble se guarda con `tipoFamilia:'seguros'` y, si el usuario dice que no
  // va con la hipoteca, se manda a PERSONAL (§4 · `forzarPersonal`). Ahí su
  // familia no existe, así que no encajaba en ningún grupo y se perdía.
  //
  // `groupByBlocksInmueble` ya tenía esta red —su `blockForInmueble` acaba en un
  // `otros` que lo recoge todo—; esta rama no la tenía. Se le pone nombre propio
  // en vez de mezclarlo con «Otros» del catálogo: caer aquí significa que la
  // familia del gasto no es de este catálogo, y eso hay que poder verlo.
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

// «Propias de la modalidad» se define por CONCEPTO (subtipos turísticos de §3.3),
// no por familia de catálogo.
const SUBTIPOS_MODALIDAD = new Set([
  'limpieza_por_estancia',
  // V6 · D3 · `ropa_cama_lavanderia` se desdobló en el servicio recurrente
  // (`lavanderia`) y el bien duradero (`ropa_enseres`). Los dos nuevos entran
  // aquí, y el antiguo se CONSERVA porque el subtipo sí se persiste y los
  // compromisos ya guardados seguirían usándolo.
  'ropa_cama_lavanderia',
  'lavanderia',
  'ropa_enseres',
  'comision_plataformas',
  'consumibles_bienvenida',
  'licencia_turistica',
]);

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
  if (c.subtipo && SUBTIPOS_MODALIDAD.has(c.subtipo)) {
    return { id: 'modalidad', label: 'Propias de la modalidad' };
  }
  const fam = inferFamilia(c, 'inmueble');
  if (fam === 'comunidad' || fam === 'tributos') return { id: 'comunidad_tributos', label: 'Comunidad y tributos' };
  if (fam === 'suministros') return { id: 'suministros', label: 'Suministros' };
  if (fam === 'seguros') return { id: 'seguros', label: 'Seguros' };
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
