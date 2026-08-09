import type { CompromisoRecurrente, FamiliaFiscal } from '../../../types/compromisosRecurrentes';
import {
  conceptoPorId,
  type Ambito,
  type FamiliaId,
  type ProyeccionInmueble,
} from '../../../services/conceptos/catalogoConceptos';
import {
  resolverConcepto,
  resolverConceptoPorSubtipoUnico,
} from '../../../services/conceptos/mapaLegacy';

/**
 * Clasificación visual patrimonial de Inmuebles.
 *
 * Es SOLO de presentación para agrupar gasto operativo/patrimonial en UI.
 * No crea un catálogo nuevo ni altera la clasificación fiscal persistida.
 */
export type GrupoVisualInmueble =
  | 'mantener'
  | 'explotar'
  | 'mejorar'
  | 'mobiliario'
  | 'sin_clasificar';

export interface ClasificacionVisualInmuebleInput {
  ambito?: Ambito;
  concepto?: string | null;
  categoryKey?: string | null;
  categoria?: string | null;
  tipoFamilia?: string | null;
  subtipo?: string | null;
  familiaFiscalManual?: FamiliaFiscal;
  esRegistroMejora?: boolean;
  esRegistroMobiliario?: boolean;
}

const FAMILIAS_MANTENER = new Set<FamiliaId>(['tributos', 'comunidad', 'seguros', 'reparacion']);
const FAMILIAS_EXPLOTAR = new Set<FamiliaId>(['suministros', 'gestion', 'servicios']);

const CATEGORY_KEYS_MANTENER = new Set([
  'ibi_inmueble',
  'basuras_inmueble',
  'tributo_inmueble',
  'comunidad_inmueble',
  'seguro_inmueble',
  'reparacion_inmueble',
]);

const CATEGORY_KEYS_EXPLOTAR = new Set(['suministro_inmueble', 'servicio_inmueble']);

function resolverConceptoInmuebleSeguro(
  input: Pick<ClasificacionVisualInmuebleInput, 'concepto' | 'tipoFamilia' | 'subtipo'>,
): string | undefined {
  if (input.concepto && conceptoPorId(input.concepto)) return input.concepto;

  if (input.tipoFamilia && input.subtipo) {
    const legacy = resolverConcepto(input.tipoFamilia, input.subtipo);
    if (legacy) return legacy;
  }

  if (!input.tipoFamilia && input.subtipo) {
    const legacyUnico = resolverConceptoPorSubtipoUnico(input.subtipo, 'inmueble');
    if (legacyUnico) return legacyUnico;
  }

  return undefined;
}

function clasificarFamiliaLegacy(tipoFamilia: string | null | undefined): GrupoVisualInmueble {
  switch (tipoFamilia) {
    case 'tributos':
    case 'comunidad':
    case 'seguros':
    case 'reparacion':
      return 'mantener';
    case 'suministros':
    case 'gestion':
    case 'servicios':
      return 'explotar';
    case 'mobiliario':
      return 'mobiliario';
    default:
      return 'sin_clasificar';
  }
}

function clasificarFamiliaFiscalManual(familiaFiscalManual: FamiliaFiscal | undefined): GrupoVisualInmueble {
  if (familiaFiscalManual === 'mejora') return 'mejorar';
  if (familiaFiscalManual === 'amortizacion_muebles') return 'mobiliario';
  return 'sin_clasificar';
}

export function clasificarGastoVisualInmueble(
  input: ClasificacionVisualInmuebleInput,
): GrupoVisualInmueble {
  if (input.esRegistroMejora || input.categoryKey === 'mejora_inmueble') return 'mejorar';
  if (input.esRegistroMobiliario || input.categoryKey === 'mobiliario_inmueble') return 'mobiliario';

  const porFamiliaFiscal = clasificarFamiliaFiscalManual(input.familiaFiscalManual);
  if (porFamiliaFiscal !== 'sin_clasificar') return porFamiliaFiscal;

  if (input.ambito && input.ambito !== 'inmueble') return 'sin_clasificar';

  const conceptoId = resolverConceptoInmuebleSeguro(input);
  const concepto = conceptoId ? conceptoPorId(conceptoId) : undefined;
  const proyeccionInmueble: ProyeccionInmueble | undefined = concepto?.inmueble;

  if (concepto?.familia === 'mobiliario') return 'mobiliario';

  if (concepto && FAMILIAS_MANTENER.has(concepto.familia)) return 'mantener';
  if (concepto && FAMILIAS_EXPLOTAR.has(concepto.familia)) return 'explotar';

  if (input.categoryKey && CATEGORY_KEYS_MANTENER.has(input.categoryKey)) return 'mantener';
  if (input.categoryKey && CATEGORY_KEYS_EXPLOTAR.has(input.categoryKey)) return 'explotar';

  if (proyeccionInmueble?.categoryKey && CATEGORY_KEYS_MANTENER.has(proyeccionInmueble.categoryKey)) {
    return 'mantener';
  }
  if (proyeccionInmueble?.categoryKey && CATEGORY_KEYS_EXPLOTAR.has(proyeccionInmueble.categoryKey)) {
    return 'explotar';
  }

  const legacy = clasificarFamiliaLegacy(input.tipoFamilia);
  if (legacy !== 'sin_clasificar') return legacy;

  return 'sin_clasificar';
}

export function esCompromisoRecurrenteDeInmueble(
  compromiso: CompromisoRecurrente,
  inmuebleId?: number,
): compromiso is CompromisoRecurrente & { ambito: 'inmueble'; inmuebleId: number } {
  if (compromiso.ambito !== 'inmueble') return false;
  if (typeof compromiso.inmuebleId !== 'number') return false;
  if (typeof inmuebleId === 'number' && compromiso.inmuebleId !== inmuebleId) return false;
  return true;
}

export function clasificarCompromisoRecurrenteInmueble(
  compromiso: CompromisoRecurrente,
): GrupoVisualInmueble {
  if (!esCompromisoRecurrenteDeInmueble(compromiso)) return 'sin_clasificar';

  return clasificarGastoVisualInmueble({
    ambito: 'inmueble',
    concepto: compromiso.concepto,
    categoryKey: undefined,
    categoria: compromiso.categoria,
    tipoFamilia: compromiso.tipoFamilia,
    subtipo: compromiso.subtipo,
    familiaFiscalManual: compromiso.familiaFiscalManual,
  });
}
