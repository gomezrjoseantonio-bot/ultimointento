import type { Movement } from '../../../../services/db';

const resolveMovementPropertyAlias = (
  movement: Movement,
  propertyAliasById: Map<string, string>,
): string | null => {
  const candidates = [
    movement.inmuebleId,
    movement.property_id,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const alias = propertyAliasById.get(candidate);
    if (alias) return alias;
  }

  return null;
};

export const formatMovementDescriptionForReport = (
  movement: Movement,
  propertyAliasById: Map<string, string>,
): string => {
  const description = String(movement.description ?? '—').trim() || '—';
  const propertyAlias = resolveMovementPropertyAlias(movement, propertyAliasById);

  if (!propertyAlias) {
    return description;
  }

  return description.replace(/inmueble\s*#\s*\d+/gi, propertyAlias);
};
