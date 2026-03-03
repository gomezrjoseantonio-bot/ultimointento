import { EstadoCertidumbre, PresupuestoLinea } from '../../../../../services/db';

const MONTHS_IN_YEAR = 12;

const normalizeMonthArray = (values?: number[]): number[] => {
  const base = new Array(MONTHS_IN_YEAR).fill(0);
  if (!values) return base;

  for (let i = 0; i < Math.min(values.length, MONTHS_IN_YEAR); i += 1) {
    base[i] = Number(values[i] || 0);
  }

  return base;
};

export const buildLayeredAmounts = (line: Pick<PresupuestoLinea, 'amountByMonth' | 'planAmountByMonth' | 'forecastAmountByMonth' | 'actualAmountByMonth' | 'statusCertidumbreByMonth'>) => {
  const legacy = normalizeMonthArray(line.amountByMonth);
  const plan = normalizeMonthArray(line.planAmountByMonth || legacy);
  const forecast = normalizeMonthArray(line.forecastAmountByMonth || legacy);
  const actual = normalizeMonthArray(line.actualAmountByMonth);

  const certidumbre = new Array<EstadoCertidumbre>(MONTHS_IN_YEAR).fill('estimado');

  for (let i = 0; i < MONTHS_IN_YEAR; i += 1) {
    const customStatus = line.statusCertidumbreByMonth?.[i];
    if (customStatus) {
      certidumbre[i] = customStatus;
      continue;
    }

    if (actual[i] !== 0) {
      certidumbre[i] = 'conciliado';
    } else if (forecast[i] !== 0 && plan[i] !== 0) {
      certidumbre[i] = 'previsto';
    } else if (forecast[i] !== 0) {
      certidumbre[i] = 'estimado';
    }
  }

  return {
    planAmountByMonth: plan,
    forecastAmountByMonth: forecast,
    actualAmountByMonth: actual,
    statusCertidumbreByMonth: certidumbre,
    amountByMonth: forecast
  };
};

export const ensureLayeredBudgetLine = <T extends PresupuestoLinea | Omit<PresupuestoLinea, 'id'>>(line: T): T => {
  const layered = buildLayeredAmounts(line as PresupuestoLinea);
  return {
    ...line,
    ...layered,
    planningLayer: line.planningLayer || 'BUDGET'
  };
};
