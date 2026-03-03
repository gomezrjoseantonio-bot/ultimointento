import { Movement, PresupuestoLinea } from '../../../../../services/db';

const normalize = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const isSameScope = (line: PresupuestoLinea, movement: Movement): boolean => {
  if (line.scope === 'INMUEBLES') {
    if (movement.ambito !== 'INMUEBLE') return false;
    if (line.inmuebleId && movement.inmuebleId && line.inmuebleId !== movement.inmuebleId) return false;
    return true;
  }

  return movement.ambito !== 'INMUEBLE';
};

const isSameType = (line: PresupuestoLinea, movement: Movement): boolean => {
  if (line.type === 'INGRESO') return movement.amount > 0 || movement.type === 'Ingreso';
  return movement.amount < 0 || movement.type === 'Gasto';
};

const isSameCategory = (line: PresupuestoLinea, movement: Movement): boolean => {
  const lineCat = normalize(line.category || line.categoria);
  const movCat = normalize(movement.category?.tipo || movement.categoria);
  if (!lineCat || !movCat) return true;
  return lineCat === movCat;
};

const isMatchedByReference = (line: PresupuestoLinea, movement: Movement): boolean => {
  if (!movement.plan_match_id) return false;
  return movement.plan_match_id === line.id || movement.plan_match_id === line.sourceRef;
};

const isMovementReal = (movement: Movement): boolean => {
  return movement.unifiedStatus !== 'previsto' && movement.unifiedStatus !== 'vencido';
};

export const calculateActualAmountsByLine = (
  line: PresupuestoLinea,
  year: number,
  movements: Movement[]
): number[] => {
  const amounts = new Array(12).fill(0);

  movements.forEach((movement) => {
    if (!movement.date || !isMovementReal(movement)) return;

    const date = new Date(movement.date);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;

    const matchByRef = isMatchedByReference(line, movement);
    const matchByHeuristics = isSameScope(line, movement) && isSameType(line, movement) && isSameCategory(line, movement);
    if (!matchByRef && !matchByHeuristics) return;

    const month = date.getMonth();
    amounts[month] += Math.abs(Number(movement.amount || 0));
  });

  return amounts;
};
