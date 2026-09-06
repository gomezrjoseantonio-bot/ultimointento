import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Ambito, FamiliaId } from '../../../services/catalogo/catalogoUnico';

/**
 * Clasificación visual patrimonial de Inmuebles.
 *
 * Es SOLO de presentación para agrupar gasto operativo/patrimonial en UI.
 * No crea un catálogo nuevo ni altera la clasificación fiscal persistida: lee
 * la familia del catálogo único (E2.4.1c) y la reparte en cuatro grupos.
 */
export type GrupoVisualInmueble =
  | 'mantener'
  | 'explotar'
  | 'mejorar'
  | 'mobiliario'
  | 'sin_clasificar';

export interface ClasificacionVisualInmuebleInput {
  ambito?: Ambito;
  familia?: FamiliaId | string | null;
  subtipo?: string | null;
  esRegistroMejora?: boolean;
  esRegistroMobiliario?: boolean;
}

const FAMILIAS_MANTENER = new Set<string>([
  'impuestos_tasas',
  'comunidad',
  'seguros_alarmas',
  'reparacion_mantenimiento',
  'prestamo_hipoteca',
]);
const FAMILIAS_EXPLOTAR = new Set<string>(['suministro', 'gestion', 'limpieza', 'comisiones_bancarias']);

export function clasificarGastoVisualInmueble(
  input: ClasificacionVisualInmuebleInput,
): GrupoVisualInmueble {
  if (input.esRegistroMejora || input.familia === 'reforma_mejora') return 'mejorar';
  if (input.esRegistroMobiliario || input.familia === 'mobiliario_enseres') return 'mobiliario';
  if (input.ambito && input.ambito !== 'inmueble') return 'sin_clasificar';
  if (!input.familia) return 'sin_clasificar';
  // La alarma es un servicio de explotación, aunque viva con los seguros.
  if (input.familia === 'seguros_alarmas' && input.subtipo === 'alarma') return 'explotar';
  if (FAMILIAS_MANTENER.has(input.familia)) return 'mantener';
  if (FAMILIAS_EXPLOTAR.has(input.familia)) return 'explotar';
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
    familia: compromiso.familia,
    subtipo: compromiso.subtipo,
  });
}
