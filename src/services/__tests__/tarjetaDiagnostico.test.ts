/* eslint-disable import/first -- el mock de la BD debe declararse antes de los imports (jest los eleva) */
// El diagnóstico de tarjetas reproduce, con los datos reales, POR QUÉ una compra
// con tarjeta de crédito no engorda su periodo. Aquí se fija que cada una de las
// puertas por las que la compra se cae quede señalada con su motivo.

const mockDB = { getAll: jest.fn() };

jest.mock('../db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

import { diagnosticarTarjetas } from '../__tarjetaDiagnostico';
import { initDB } from '../db';
import type { Tarjeta } from '../../types/tarjetas';

const HOY = '2026-08-15';
const store: Record<string, unknown[]> = { tarjetas: [], movements: [], treasuryEvents: [] };

const credito = (over: Partial<Tarjeta> = {}): Tarjeta =>
  ({
    id: 12,
    alias: 'Carrefour',
    origen: 'externa',
    modalidad: 'credito',
    cuentaLiquidacionId: 9,
    ciclo: { periodicidad: 'mensual', corte: 20, diaCargo: 31, periodosHastaElCargo: 0 },
    activa: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Tarjeta;

const compra = (over: Record<string, unknown> = {}) => ({
  id: 1,
  accountId: 9,
  date: '2026-08-10',
  amount: -50,
  description: 'Toallas',
  tarjetaId: 12,
  gastoTarjetaCredito: true,
  ...over,
});

beforeEach(() => {
  store.tarjetas = [];
  store.movements = [];
  store.treasuryEvents = [];
  (initDB as jest.Mock).mockResolvedValue(mockDB);
  mockDB.getAll.mockImplementation((tabla: string) => Promise.resolve(store[tabla] ?? []));
});

it('una compra normal del periodo abierto CUENTA', async () => {
  store.tarjetas = [credito()];
  store.movements = [compra()];

  const [d] = await diagnosticarTarjetas(HOY);
  expect(d.compras[0].cuenta).toBe(true);
  expect(d.llevasEstePeriodo).toBe(50);
});

it('sin ciclo · avisa y la compra no puede calcular', async () => {
  store.tarjetas = [credito({ ciclo: undefined })];
  store.movements = [compra()];

  const [d] = await diagnosticarTarjetas(HOY);
  expect(d.avisos.join(' ')).toMatch(/SIN CICLO/);
  expect(d.compras[0].cuenta).toBe(false);
});

it('sin la marca de crédito · se señala como cargo normal', async () => {
  store.tarjetas = [credito()];
  store.movements = [compra({ gastoTarjetaCredito: undefined })];

  const [d] = await diagnosticarTarjetas(HOY);
  expect(d.compras[0].tieneMarca).toBe(false);
  expect(d.compras[0].cuenta).toBe(false);
  expect(d.compras[0].motivo).toMatch(/marca/);
});

it('el cargo del periodo ya salió · no cuenta (viene por el recibo)', async () => {
  store.tarjetas = [credito()];
  // Compra de junio · su cargo (30-jun) ya salió antes de hoy (15-ago).
  store.movements = [compra({ date: '2026-06-05' })];

  const [d] = await diagnosticarTarjetas(HOY);
  expect(d.compras[0].cuenta).toBe(false);
  expect(d.compras[0].motivo).toMatch(/ya salió/);
});

it('el corte de la compra no coincide con el del previsto · cuenta pero el tile no la muestra', async () => {
  store.tarjetas = [credito()];
  store.movements = [compra({ date: '2026-08-25' })]; // pasa el corte 20 → corte 09-20
  // Un recibo PREVISTO abierto para el corte de agosto (20).
  store.treasuryEvents = [
    {
      id: 900,
      type: 'expense',
      amount: -30,
      predictedDate: '2026-08-31',
      description: 'Recibo tarjeta Carrefour',
      sourceType: 'tarjeta_recibo',
      sourceId: 'tarjeta-12-2026-08-20',
      status: 'predicted',
      accountId: 9,
    },
  ];

  const [d] = await diagnosticarTarjetas(HOY);
  const c = d.compras[0];
  expect(c.cuenta).toBe(true); // sí cuenta como periodo abierto
  expect(c.fechaCorte).not.toBe(d.corteVigente); // pero en otro corte que el previsto
  expect(c.motivo).toMatch(/NO se ve en «Llevas X»/);
});
