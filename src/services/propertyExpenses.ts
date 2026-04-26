import { initDB } from './db';
import type { Expense, Gasto } from './db';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import type {
  PropertyExpense,
  PropertyExpenseDiagnostics,
} from '../types/propertyExpenses';

const getLast12MonthsThreshold = (): number => {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  return date.getTime();
};

export const normalizeExpenseToAnnual = (expense: PropertyExpense): number => {
  if (!expense.isActive) return 0;

  switch (expense.frequency) {
    case 'semanal':
      return expense.amount * 52;
    case 'mensual':
      return expense.amount * 12;
    case 'bimestral':
      return expense.amount * 6;
    case 'trimestral':
      return expense.amount * 4;
    case 'semestral':
      return expense.amount * 2;
    case 'anual':
    case 'unico':
      return expense.amount;
    case 'meses_especificos':
      return expense.amount;
    default:
      return 0;
  }
};

const getCompromisoImporteEstimado = (c: CompromisoRecurrente): number => {
  if (c.importe.modo === 'fijo') return c.importe.importe;
  if (c.importe.modo === 'variable') return c.importe.importeMedio;
  if (c.importe.modo === 'diferenciadoPorMes') {
    const vals = c.importe.importesPorMes;
    return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  }
  if (c.importe.modo === 'porPago') {
    const vals = Object.values(c.importe.importesPorPago);
    return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  }
  return 0;
};

const getCompromisoFrequency = (c: CompromisoRecurrente): PropertyExpense['frequency'] => {
  const p = c.patron;
  if (p.tipo === 'mensualDiaFijo' || p.tipo === 'mensualDiaRelativo') return 'mensual';
  if (p.tipo === 'cadaNMeses') {
    if (p.cadaNMeses === 2) return 'bimestral';
    if (p.cadaNMeses === 3) return 'trimestral';
    if (p.cadaNMeses === 6) return 'semestral';
  }
  if (p.tipo === 'anualMesesConcretos') {
    return p.mesesPago.length === 1 ? 'anual' : 'meses_especificos';
  }
  if (p.tipo === 'trimestralFiscal') return 'trimestral';
  if (p.tipo === 'variablePorMes') return 'meses_especificos';
  if (p.tipo === 'puntual') return 'unico';
  return 'mensual';
};

const getCompromisoMesesCobro = (c: CompromisoRecurrente): number[] | undefined => {
  const p = c.patron;
  if (p.tipo === 'anualMesesConcretos' && p.mesesPago.length > 1) return p.mesesPago;
  if (p.tipo === 'variablePorMes') return p.mesesPago;
  return undefined;
};

const getCompromisoAsymmetricPayments = (c: CompromisoRecurrente): { mes: number; importe: number }[] | undefined => {
  if (c.importe.modo === 'porPago') {
    return Object.entries(c.importe.importesPorPago).map(
      ([mes, importe]) => ({ mes: Number(mes), importe })
    );
  }
  return undefined;
};

const isWithinLastYear = (isoDate?: string): boolean => {
  if (!isoDate) return false;
  const ts = new Date(isoDate).getTime();
  return Number.isFinite(ts) && ts >= getLast12MonthsThreshold();
};

/**
 * Recover original categoria + casillaAEAT from notas (stored by opexService V5.4+).
 */
const getCompromisoCategoryExtras = (c: CompromisoRecurrente): { categoria: string; casillaAEAT?: string } => {
  try {
    if (c.notas) {
      const extras = JSON.parse(c.notas) as { _opexCategoria?: string; _opexCasillaAEAT?: string };
      return {
        categoria: extras._opexCategoria ?? c.categoria,
        casillaAEAT: extras._opexCasillaAEAT,
      };
    }
  } catch { /* ignore */ }
  return { categoria: c.categoria };
};

const mapCompromiso = (c: CompromisoRecurrente): PropertyExpense => {
  const freq = getCompromisoFrequency(c);
  const meses = getCompromisoMesesCobro(c);
  const asymmetric = getCompromisoAsymmetricPayments(c);

  const rawAmount = getCompromisoImporteEstimado(c);
  const amount = (freq === 'meses_especificos' && asymmetric?.length)
    ? asymmetric.reduce((s, p) => s + p.importe, 0)
    : (freq === 'meses_especificos' && meses?.length)
      ? (meses.length * rawAmount)
      : rawAmount;

  const { categoria, casillaAEAT } = getCompromisoCategoryExtras(c);

  // Derive a start date from first payment month if available
  const p = c.patron;
  let startDate: string | undefined;
  if (p.tipo === 'anualMesesConcretos' && p.mesesPago.length > 0) {
    startDate = `${new Date().getFullYear()}-${String(p.mesesPago[0]).padStart(2, '0')}-01`;
  }

  return {
    id: `opex_rule:${c.id}`,
    propertyId: c.inmuebleId!,
    category: categoria,
    concept: c.alias,
    amount,
    frequency: freq,
    accountId: c.cuentaCargo || undefined,
    casillaAEAT: casillaAEAT as any,
    startDate,
    source: 'opex_rule',
    expenseClass: 'opex',
    isLegacy: false,
    isActive: c.estado === 'activo',
  };
};


const mapGasto = (gasto: Gasto): PropertyExpense | null => {
  if (gasto.destino !== 'inmueble_id' || !gasto.destino_id) return null;

  return {
    id: `gasto:${gasto.id}`,
    propertyId: gasto.destino_id,
    category: gasto.categoria_AEAT,
    concept: gasto.contraparte_nombre,
    amount: gasto.total,
    frequency: 'unico',
    startDate: gasto.fecha_emision,
    source: 'gasto',
    expenseClass: 'opex',
    isLegacy: true,
    isActive: true,
  };
};

const mapLegacyExpense = (expense: Expense): PropertyExpense => ({
  id: `legacy_expense:${expense.id}`,
  propertyId: expense.propertyId,
  category: expense.category,
  concept: expense.description,
  amount: expense.amount,
  frequency: 'unico',
  startDate: expense.date,
  source: 'legacy_expense',
  expenseClass: (expense.isMejora || (expense as any).isCapex) ? 'mejora' : 'opex',
  isLegacy: true,
  isActive: true,
});

const getPropertyExpensesSnapshot = async (propertyId: number): Promise<PropertyExpense[]> => {
  const db = await initDB();
  const gastosInmuebleService = (await import('./gastosInmuebleService')).gastosInmuebleService;
  // V5.4+: read from compromisosRecurrentes (ambito='inmueble') instead of opexRules (DEPRECATED)
  const [compromisos, gastosInm, expenses] = await Promise.all([
    db.getAllFromIndex('compromisosRecurrentes', 'inmuebleId', propertyId)
      .then((all) => all.filter((c) => c.ambito === 'inmueble')),
    gastosInmuebleService.getByInmueble(propertyId),
    db.getAllFromIndex('expenses', 'propertyId', propertyId).catch(() => []),
  ]);

  // Map gastosInmueble to Gasto-like shape for mapGasto compatibility
  const gastosMapped = gastosInm.map((g: any) => ({
    id: g.id, contraparte_nombre: g.proveedorNombre || '', total: g.importe,
    fecha_emision: g.fecha, fecha_pago_prevista: g.fecha,
    categoria_AEAT: g.casillaAEAT,
    destino: 'inmueble_id' as const, destino_id: g.inmuebleId,
    estado: (g.estado === 'confirmado' ? 'pagado' : 'pendiente') as any,
    createdAt: g.createdAt, updatedAt: g.updatedAt,
  } as Gasto));
  const mappedGastos = gastosMapped.map(mapGasto).filter(Boolean) as PropertyExpense[];

  return [
    ...compromisos.map(mapCompromiso),
    ...mappedGastos,
    ...expenses.map(mapLegacyExpense),
  ];
};

export const getAllExpensesForProperty = async (propertyId: number): Promise<PropertyExpense[]> => {
  return getPropertyExpensesSnapshot(propertyId);
};

export const getAnnualOpexForProperty = async (propertyId: number): Promise<number> => {
  const all = await getPropertyExpensesSnapshot(propertyId);
  const rules = all.filter((expense) => expense.source === 'opex_rule' && expense.expenseClass === 'opex' && expense.isActive);

  if (rules.length > 0) {
    return rules.reduce((sum, expense) => sum + normalizeExpenseToAnnual(expense), 0);
  }

  return all
    .filter((expense) => expense.expenseClass === 'opex' && expense.isLegacy && isWithinLastYear(expense.startDate))
    .reduce((sum, expense) => sum + expense.amount, 0);
};

export const getExpenseDiagnosticsForProperty = async (propertyId: number): Promise<PropertyExpenseDiagnostics> => {
  const all = await getPropertyExpensesSnapshot(propertyId);
  const activeRules = all.filter((expense) => expense.source === 'opex_rule' && expense.isActive);
  const legacyOpex = all.filter((expense) => expense.expenseClass === 'opex' && expense.isLegacy);

  if (activeRules.length === 0 && legacyOpex.length === 0) {
    return {
      hasConfiguredExpenses: false,
      usingLegacyFallback: false,
      warning: 'No hay gastos OPEX configurados para este inmueble.',
    };
  }

  if (activeRules.length === 0 && legacyOpex.length > 0) {
    return {
      hasConfiguredExpenses: true,
      usingLegacyFallback: true,
      warning: 'Se están usando gastos legacy para el cálculo OPEX. Completa la migración a reglas OPEX.',
    };
  }

  return {
    hasConfiguredExpenses: true,
    usingLegacyFallback: false,
  };
};
