// src/services/fiscalDashboardMatch.ts
// T-OPEX-RECONNECT (V69) · helper puro para FiscalDashboard
//
// Calcula el flag "categoría registrada" usando 4 fuentes (Q2/Q3 Jose):
//   1. plantilla recurrente activa  (compromisosRecurrentes via OpexRule)
//   2. gasto real del ejercicio     (gastosInmueble por casilla AEAT)
//   3. préstamo activo              (solo Intereses hipoteca)
//   4. mejora con tipo='reparacion' (solo Reparaciones)

import type { OpexRule, GastoInmueble } from './db';

export interface CategoryMatchContext {
  rules: OpexRule[];
  gastos: GastoInmueble[];
  hasActiveLoan: boolean;
  hasReparacionMejora: boolean;
}

export interface ExpectedCategory {
  key: string;
  label: string;
  match: (ctx: CategoryMatchContext) => boolean;
  alwaysRegistered?: boolean;
}

export const EXPECTED_FISCAL_CATEGORIES: ExpectedCategory[] = [
  {
    key: 'comunidad',
    label: 'Comunidad',
    match: (ctx) =>
      ctx.rules.some((r) => r.activo && r.categoria === 'comunidad') ||
      ctx.gastos.some((g) => g.casillaAEAT === '0109' || g.categoria === 'comunidad'),
  },
  {
    key: 'ibi',
    label: 'IBI',
    match: (ctx) =>
      ctx.rules.some(
        (r) =>
          r.activo && r.categoria === 'impuesto' && r.concepto.toLowerCase().includes('ibi'),
      ) ||
      ctx.gastos.some((g) => g.casillaAEAT === '0115' || g.categoria === 'ibi'),
  },
  {
    key: 'seguro',
    label: 'Seguro',
    match: (ctx) =>
      ctx.rules.some((r) => r.activo && r.categoria === 'seguro') ||
      ctx.gastos.some((g) => g.casillaAEAT === '0114' || g.categoria === 'seguro'),
  },
  {
    key: 'suministros',
    label: 'Suministros',
    match: (ctx) =>
      ctx.rules.some((r) => r.activo && r.categoria === 'suministro') ||
      ctx.gastos.some((g) => g.casillaAEAT === '0113' || g.categoria === 'suministro'),
  },
  { key: 'amortizacion', label: 'Amortización', match: () => true, alwaysRegistered: true },
  {
    key: 'intereses',
    label: 'Intereses hipoteca',
    match: (ctx) =>
      ctx.rules.some(
        (r) =>
          r.activo &&
          (r.concepto.toLowerCase().includes('hipoteca') ||
            r.concepto.toLowerCase().includes('interés') ||
            r.concepto.toLowerCase().includes('interes')),
      ) ||
      ctx.gastos.some((g) => g.casillaAEAT === '0105' || g.categoria === 'intereses') ||
      ctx.hasActiveLoan,
  },
  {
    key: 'reparaciones',
    label: 'Reparaciones',
    match: (ctx) =>
      ctx.rules.some(
        (r) =>
          r.activo &&
          (r.concepto.toLowerCase().includes('reparac') ||
            r.concepto.toLowerCase().includes('conservac')),
      ) ||
      ctx.gastos.some((g) => g.casillaAEAT === '0106' || g.categoria === 'reparacion') ||
      ctx.hasReparacionMejora,
  },
];

export function isCategoryRegistered(
  cat: ExpectedCategory,
  ctx: CategoryMatchContext,
): boolean {
  return cat.alwaysRegistered === true || cat.match(ctx);
}
