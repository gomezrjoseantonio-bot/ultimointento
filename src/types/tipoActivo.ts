/**
 * T29 · Tipología del activo inmobiliario.
 *
 * Afecta a · UI (rooms solo si piso) · selectores fiscales (reducción IRPF · IVA) · documentos esperables.
 *
 * - 'piso' · vivienda residencial · soporta habitaciones · reducción IRPF 50-90% según contrato
 * - 'parking' · plaza de garaje · sin habitaciones · NO reducción IRPF · IVA 21% típico en alquiler
 * - 'trastero' · sin habitaciones · NO reducción IRPF · típicamente exento IVA
 * - 'local' · comercial · sin habitaciones · NO reducción IRPF · IVA 21% habitual
 * - 'otro' · fallback edge cases · sin asunciones fiscales
 */
export type TipoActivo = 'piso' | 'parking' | 'trastero' | 'local' | 'otro';

export const TIPO_ACTIVO_VALUES: readonly TipoActivo[] = [
  'piso',
  'parking',
  'trastero',
  'local',
  'otro',
] as const;

export const TIPO_ACTIVO_LABELS: Record<TipoActivo, string> = {
  piso: 'Piso',
  parking: 'Parking',
  trastero: 'Trastero',
  local: 'Local',
  otro: 'Otro',
};

export const TIPO_ACTIVO_DESCRIPCIONES: Record<TipoActivo, string> = {
  piso: 'Vivienda residencial · soporta alquiler por habitaciones',
  parking: 'Plaza de garaje',
  trastero: 'Espacio de almacenamiento',
  local: 'Local comercial',
  otro: 'Otra tipología',
};

/**
 * Devuelve la tipología efectiva · 'piso' por defecto si el campo no está poblado
 * (caso de registros creados antes de T29).
 */
export function getTipoActivoEffective(input: { tipoActivo?: TipoActivo }): TipoActivo {
  return input.tipoActivo ?? 'piso';
}
