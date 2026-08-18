/* eslint-disable import/first -- el mock de la BD debe declararse antes de los imports (jest los eleva) */
// Puntear una pieza de tarjeta NO crea un Movement de caja · solo fija el importe
// real en el propio evento. Crear un movimiento movería un saldo que no se mueve
// y contaría la pieza dos veces (ya alimenta el recibo).

const mockDB = { get: jest.fn(), put: jest.fn() };
jest.mock('../../db', () => ({ initDB: jest.fn(() => Promise.resolve(mockDB)) }));

import { confirmarPieza, despuntearPieza, descartarPieza, NoEsPiezaError } from '../puntearPieza';
import { initDB } from '../../db';

const pieza = (over: Record<string, unknown> = {}) => ({
  id: 5,
  type: 'expense',
  amount: -100,
  predictedDate: '2026-08-10',
  sourceType: 'gasto_tarjeta',
  tarjetaId: 11,
  status: 'predicted',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (initDB as jest.Mock).mockResolvedValue(mockDB);
  mockDB.put.mockResolvedValue(undefined);
});

it('confirmar fija el importe real y NO crea movimiento', async () => {
  mockDB.get.mockResolvedValue(pieza());
  await confirmarPieza(5, 87.4);

  const guardado = mockDB.put.mock.calls[0][1];
  expect(guardado.status).toBe('confirmed');
  expect(guardado.actualAmount).toBe(87.4);
  expect(guardado.movementId).toBeUndefined();
  // No se ha tocado el store de movimientos.
  expect(mockDB.put).toHaveBeenCalledTimes(1);
  expect(mockDB.put.mock.calls[0][0]).toBe('treasuryEvents');
});

it('confirmar sin importe da por bueno el previsto (magnitud positiva)', async () => {
  mockDB.get.mockResolvedValue(pieza());
  await confirmarPieza(5);
  expect(mockDB.put.mock.calls[0][1].actualAmount).toBe(100);
});

it('despuntear vuelve a prevista y olvida el importe real', async () => {
  mockDB.get.mockResolvedValue(pieza({ status: 'confirmed', actualAmount: 87.4 }));
  await despuntearPieza(5);
  const g = mockDB.put.mock.calls[0][1];
  expect(g.status).toBe('predicted');
  expect(g.actualAmount).toBeUndefined();
  expect(g.executedAt).toBeUndefined();
});

it('descartar marca la pieza como no ocurrida', async () => {
  mockDB.get.mockResolvedValue(pieza());
  await descartarPieza(5);
  expect(mockDB.put.mock.calls[0][1].descartado).toBe(true);
});

it('un evento que no es pieza se rechaza', async () => {
  mockDB.get.mockResolvedValue(pieza({ sourceType: 'gasto_recurrente' }));
  await expect(confirmarPieza(5)).rejects.toBeInstanceOf(NoEsPiezaError);
});
