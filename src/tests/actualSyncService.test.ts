import { calculateActualAmountsByLine } from '../modules/horizon/proyeccion/presupuesto/services/actualSyncService';
import { Movement, PresupuestoLinea } from '../services/db';

const baseLine: PresupuestoLinea = {
  id: 'line-1',
  presupuestoId: 'p-1',
  scope: 'INMUEBLES',
  type: 'COSTE',
  inmuebleId: 'inm-1',
  category: 'Suministros',
  label: 'Luz piso A',
  amountByMonth: new Array(12).fill(0)
};

const movement = (overrides: Partial<Movement>): Movement => ({
  accountId: 1,
  date: '2026-02-10',
  amount: -100,
  description: 'Factura luz',
  status: 'conciliado',
  unifiedStatus: 'conciliado',
  source: 'import',
  category: { tipo: 'Suministros', subtipo: 'Luz' },
  type: 'Gasto',
  origin: 'CSV',
  movementState: 'Conciliado',
  ambito: 'INMUEBLE',
  statusConciliacion: 'match_automatico',
  createdAt: '2026-02-10T00:00:00.000Z',
  updatedAt: '2026-02-10T00:00:00.000Z',
  ...overrides
});

describe('actualSyncService', () => {
  it('aggregates actual by month for matching scope/type/category', () => {
    const amounts = calculateActualAmountsByLine(baseLine, 2026, [movement({ amount: -120 })]);
    expect(amounts[1]).toBe(120);
  });

  it('prioritizes reference matching via plan_match_id', () => {
    const amounts = calculateActualAmountsByLine(baseLine, 2026, [
      movement({ plan_match_id: 'line-1', amount: -80, ambito: 'PERSONAL', category: { tipo: 'Otros' } })
    ]);
    expect(amounts[1]).toBe(80);
  });

  it('ignores forecast-only movements', () => {
    const amounts = calculateActualAmountsByLine(baseLine, 2026, [
      movement({ unifiedStatus: 'previsto', amount: -200 })
    ]);
    expect(amounts[1]).toBe(0);
  });
});
