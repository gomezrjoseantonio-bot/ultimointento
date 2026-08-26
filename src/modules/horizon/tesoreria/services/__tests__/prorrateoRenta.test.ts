// El primer mes y el último se cobran por días, no enteros.
//
// Un contrato que empieza el 16 no genera la renta de un mes entero: genera la
// parte que va del 16 al final. Lo mismo por el otro lado, cuando termina el
// día 10. El generador vivo (`generateMonthlyForecasts`) emitía el importe
// completo en los dos extremos, así que la previsión pedía más dinero del que
// el inquilino debe y el mes de entrada salía inflado.
//
// El prorrateo ya estaba escrito en el repo —`calculateRentPeriodsNew`, que
// consumía el generador MUERTO de `treasuryForecastService`—, así que la
// aritmética correcta existía pero no la ejecutaba nadie.
//
// Tests de COMPORTAMIENTO: se ejecuta la generación de verdad y se mira el
// importe del evento emitido. Nada de leer el fichero fuente.

import 'fake-indexeddb/auto';
import { initDB } from '../../../../../services/db';
import type { Contract, TreasuryEvent } from '../../../../../services/db';
import { generateMonthlyForecasts } from '../treasurySyncService';

jest.mock('../../../../../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

// Junio de dentro de dos años: siempre futuro y siempre de 30 días, así que
// los importes esperados son números literales y no una copia de la fórmula
// que se está probando.
const YEAR = new Date().getFullYear() + 2;
const MONTH = 6;
const DIAS_DEL_MES = 30;
const PREFIJO = `${YEAR}-06`;

/** Renta redonda para que los prorrateos den cifras exactas sobre 30 días. */
const RENTA = 900;

const contrato = (fechaInicio: string, fechaFin: string): Omit<Contract, 'id'> =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'larga_estancia',
    inquilino: {
      nombre: 'Adnan',
      apellidos: 'Parwez Khan',
      dni: 'X1234567L',
      telefono: '600000000',
      email: 'adnan@example.com',
    },
    fechaInicio,
    fechaFin,
    rentaMensual: RENTA,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: RENTA,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Contract, 'id'>;

/** La renta emitida para ese contrato en el mes objetivo. */
const rentaDelMes = async (contratoId: number): Promise<TreasuryEvent | undefined> => {
  const db = await initDB();
  const todos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  return todos.find(
    (e) =>
      e.type === 'income' &&
      e.sourceType === 'contrato' &&
      e.sourceId === contratoId &&
      typeof e.predictedDate === 'string' &&
      e.predictedDate.startsWith(PREFIJO),
  );
};

const sembrar = async (fechaInicio: string, fechaFin: string): Promise<number> => {
  const db = await initDB();
  return (await db.add('contracts', contrato(fechaInicio, fechaFin) as never)) as number;
};

describe('la renta del primer y del último mes se prorratea por días', () => {
  beforeEach(async () => {
    const db = await initDB();
    for (const store of ['treasuryEvents', 'contracts', 'accounts', 'movements'] as const) {
      await db.clear(store);
    }
    await db.add('accounts', {
      id: 1,
      name: 'Cuenta principal',
      iban: 'ES0000000000000000000001',
      balance: 0,
    } as never);
  });

  it('un contrato que empieza el 16 cobra 15 de 30 días, no el mes entero', async () => {
    const id = await sembrar(`${PREFIJO}-16`, `${YEAR + 5}-12-31`);

    await generateMonthlyForecasts(YEAR, MONTH);

    const renta = await rentaDelMes(id);
    expect(renta).toBeDefined();
    // 16 → 30 son 15 días de los 30 de junio.
    expect(renta!.amount).toBe((RENTA * 15) / DIAS_DEL_MES); // 450
  });

  it('un contrato que termina el día 10 cobra 10 de 30 días en su último mes', async () => {
    const id = await sembrar(`${YEAR - 3}-01-01`, `${PREFIJO}-10`);

    await generateMonthlyForecasts(YEAR, MONTH);

    const renta = await rentaDelMes(id);
    expect(renta).toBeDefined();
    expect(renta!.amount).toBe((RENTA * 10) / DIAS_DEL_MES); // 300
  });

  it('un contrato que empieza y termina dentro del mismo mes cobra solo esos días', async () => {
    // El caso que el prorrateo viejo hacía mal: aplicaba el primer mes y luego
    // lo PISABA con el cálculo del último, cobrando del día 1 al 20 un contrato
    // que empezó el 10.
    const id = await sembrar(`${PREFIJO}-10`, `${PREFIJO}-20`);

    await generateMonthlyForecasts(YEAR, MONTH);

    const renta = await rentaDelMes(id);
    expect(renta).toBeDefined();
    // Del 10 al 20 inclusive son 11 días.
    expect(renta!.amount).toBe((RENTA * 11) / DIAS_DEL_MES); // 330
  });

  it('un mes intermedio se cobra entero', async () => {
    const id = await sembrar(`${YEAR - 3}-01-01`, `${YEAR + 5}-12-31`);

    await generateMonthlyForecasts(YEAR, MONTH);

    const renta = await rentaDelMes(id);
    expect(renta).toBeDefined();
    expect(renta!.amount).toBe(RENTA);
  });

  it('un contrato que empieza el día 1 cobra el mes entero, sin prorrateo', async () => {
    const id = await sembrar(`${PREFIJO}-01`, `${YEAR + 5}-12-31`);

    await generateMonthlyForecasts(YEAR, MONTH);

    const renta = await rentaDelMes(id);
    expect(renta).toBeDefined();
    expect(renta!.amount).toBe(RENTA);
  });

  it('un contrato que termina el último día del mes cobra el mes entero', async () => {
    const id = await sembrar(`${YEAR - 3}-01-01`, `${PREFIJO}-30`);

    await generateMonthlyForecasts(YEAR, MONTH);

    const renta = await rentaDelMes(id);
    expect(renta).toBeDefined();
    expect(renta!.amount).toBe(RENTA);
  });
});
