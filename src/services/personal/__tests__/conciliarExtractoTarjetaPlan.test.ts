/* eslint-disable import/first -- el mock de la BD debe ir antes de los imports (jest los eleva) */
// Planificar (leer + emparejar, sin escribir) y aplicar (escribir) la
// conciliación del extracto de tarjeta · el usuario coteja antes de confirmar.

const mockDB = {
  getAllFromIndex: jest.fn(),
  getAll: jest.fn(),
  put: jest.fn(),
  add: jest.fn(),
};
jest.mock('../../db', () => ({ initDB: jest.fn(() => Promise.resolve(mockDB)) }));

import {
  planificarExtractoTarjeta,
  aplicarPlanTarjeta,
} from '../conciliarExtractoTarjeta';
import { initDB } from '../../db';
import type { LineaExtractoTarjeta } from '../extractoTarjeta';

const TARJETA = 11;
const pieza = {
  id: 1,
  sourceType: 'gasto_tarjeta',
  tarjetaId: TARJETA,
  predictedDate: '2026-07-05',
  amount: -53.5,
  status: 'predicted',
  description: 'Tabaco previsto',
};

const linea = (fecha: string, importe: number, concepto = 'X'): LineaExtractoTarjeta => ({ fecha, importe, concepto });

beforeEach(() => {
  jest.clearAllMocks();
  (initDB as jest.Mock).mockResolvedValue(mockDB);
  mockDB.getAllFromIndex.mockResolvedValue([pieza]);
  mockDB.getAll.mockResolvedValue([]);
  mockDB.put.mockResolvedValue(undefined);
  mockDB.add.mockResolvedValue(undefined);
});

describe('planificar · no escribe, solo empareja', () => {
  it('una línea que casa con la pieza sale como «casa» y trae su nombre', async () => {
    const plan = await planificarExtractoTarjeta(TARJETA, [linea('2026-07-04', 53.5, 'EXPENDEDURIA')]);
    expect(plan.conciliadas).toBe(1);
    expect(plan.nuevas).toBe(0);
    expect(plan.lineas[0].estado).toBe('casa');
    expect(plan.lineas[0].objetivo?.descripcion).toBe('Tabaco previsto');
    // Planificar no toca la base de datos.
    expect(mockDB.put).not.toHaveBeenCalled();
    expect(mockDB.add).not.toHaveBeenCalled();
  });

  it('una línea que no casa sale como «nueva»', async () => {
    const plan = await planificarExtractoTarjeta(TARJETA, [linea('2026-07-04', 99.99, 'MERCADONA')]);
    expect(plan.conciliadas).toBe(0);
    expect(plan.nuevas).toBe(1);
    expect(plan.lineas[0].estado).toBe('nueva');
  });

  it('una devolución sin par no cuenta como nueva', async () => {
    const plan = await planificarExtractoTarjeta(TARJETA, [linea('2026-07-04', -12.5, 'DEVOLUCION')]);
    expect(plan.nuevas).toBe(0);
  });
});

describe('aplicar · escribe lo cotejado', () => {
  it('la pieza que casa sube a conciliado con su importe real', async () => {
    const plan = await planificarExtractoTarjeta(TARJETA, [linea('2026-07-04', 53.5)]);
    const r = await aplicarPlanTarjeta(TARJETA, plan);
    expect(r.conciliadas).toBe(1);
    const guardado = mockDB.put.mock.calls[0][1];
    expect(mockDB.put.mock.calls[0][0]).toBe('treasuryEvents');
    expect(guardado.status).toBe('confirmed');
    expect(guardado.conciliadoExtracto).toBe(true);
    expect(guardado.actualAmount).toBe(53.5);
  });

  it('una línea nueva se crea como gasto ya conciliado', async () => {
    const plan = await planificarExtractoTarjeta(TARJETA, [linea('2026-07-04', 99.99, 'MERCADONA')]);
    const r = await aplicarPlanTarjeta(TARJETA, plan);
    expect(r.nuevas).toBe(1);
    const creado = mockDB.add.mock.calls[0][1];
    expect(mockDB.add.mock.calls[0][0]).toBe('treasuryEvents');
    expect(creado.sourceType).toBe('gasto_tarjeta');
    expect(creado.conciliadoExtracto).toBe(true);
    expect(creado.amount).toBe(-99.99);
    expect(creado.description).toBe('MERCADONA');
  });
});
