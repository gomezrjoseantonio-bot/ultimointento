// El primer cobro que fija el arrendador manda sobre el prorrateo aritmético.
//
// Los contratos reales no cobran el primer mes por la regla de tres: se pacta.
// «17 días de agosto más septiembre entero, 565 €» es un número acordado, no
// calculado —el aritmético de ese caso da 565,16—, y ATLAS tiene que emitir lo
// que se firmó, no lo que le sale a él.
//
// El caso que puede costar dinero es el tercero, el de mes adelantado: si el
// inquilino paga por adelantado el mes siguiente en el primer cobro, ESE MES YA
// ESTÁ PAGADO y no puede volver a pedirse. Emitir su renta sería contar el mismo
// dinero dos veces — el mismo fallo que cerraron #1797 y #1800, por una puerta
// nueva.
//
// Tests de COMPORTAMIENTO: se ejecuta la generación de verdad, mes a mes, y se
// mira qué evento sale y por cuánto.

import 'fake-indexeddb/auto';
import { initDB } from '../../../../../services/db';
import type { Contract, TreasuryEvent } from '../../../../../services/db';
import { generateMonthlyForecasts } from '../treasurySyncService';

jest.mock('../../../../../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

// Junio de dentro de dos años: siempre futuro y siempre de 30 días, así que los
// importes esperados son literales y no una copia de la fórmula bajo prueba.
const YEAR = new Date().getFullYear() + 2;
const RENTA = 900;

type PrimerCobro = NonNullable<Contract['primerCobro']>;

const contrato = (
  fechaInicio: string,
  primerCobro?: PrimerCobro,
): Omit<Contract, 'id'> =>
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
    fechaFin: `${YEAR + 5}-12-31`,
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
    primerCobro,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Contract, 'id'>;

/** La renta emitida para ese contrato en ese mes · `undefined` si no se emitió. */
const rentaDe = async (
  contratoId: number,
  year: number,
  month: number,
): Promise<TreasuryEvent | undefined> => {
  const db = await initDB();
  const prefijo = `${year}-${String(month).padStart(2, '0')}`;
  const todos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  return todos.find(
    (e) =>
      e.type === 'income' &&
      e.sourceType === 'contrato' &&
      e.sourceId === contratoId &&
      typeof e.predictedDate === 'string' &&
      e.predictedDate.startsWith(prefijo),
  );
};

const sembrar = async (
  fechaInicio: string,
  primerCobro?: PrimerCobro,
): Promise<number> => {
  const db = await initDB();
  return (await db.add('contracts', contrato(fechaInicio, primerCobro) as never)) as number;
};

describe('el primer cobro pactado manda sobre el prorrateo', () => {
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

  it('sin primer cobro pactado sigue mandando el prorrateo', async () => {
    const id = await sembrar(`${YEAR}-06-16`);

    await generateMonthlyForecasts(YEAR, 6);

    expect((await rentaDe(id, YEAR, 6))!.amount).toBe(450); // 15/30 de 900
  });

  it('modo manual · se emite el importe pactado, no el aritmético', async () => {
    const id = await sembrar(`${YEAR}-06-16`, { modo: 'manual', importe: 500 });

    await generateMonthlyForecasts(YEAR, 6);

    expect((await rentaDe(id, YEAR, 6))!.amount).toBe(500);
  });

  it('modo mes entero · el mes de entrada se cobra completo aunque entre el 16', async () => {
    const id = await sembrar(`${YEAR}-06-16`, { modo: 'mes_entero', importe: RENTA });

    await generateMonthlyForecasts(YEAR, 6);

    expect((await rentaDe(id, YEAR, 6))!.amount).toBe(RENTA);
  });

  it('modo prorrateo con importe ajustado a mano · manda el ajustado', async () => {
    const id = await sembrar(`${YEAR}-06-16`, { modo: 'prorrateo', importe: 455 });

    await generateMonthlyForecasts(YEAR, 6);

    expect((await rentaDe(id, YEAR, 6))!.amount).toBe(455);
  });

  // ── EL CASO QUE CUESTA DINERO ────────────────────────────────────────────
  describe('modo días + mes adelantado · el mes prepagado NO se vuelve a cobrar', () => {
    // Entra el 16 de junio: 15 días (450) + julio entero (900) = 1350.
    const PRIMER_COBRO: PrimerCobro = { modo: 'dias_mas_adelanto', importe: 1350 };

    it('el mes de entrada cobra los días más la mensualidad adelantada', async () => {
      const id = await sembrar(`${YEAR}-06-16`, PRIMER_COBRO);

      await generateMonthlyForecasts(YEAR, 6);

      expect((await rentaDe(id, YEAR, 6))!.amount).toBe(1350);
    });

    it('el mes siguiente NO emite renta: ya está pagado', async () => {
      const id = await sembrar(`${YEAR}-06-16`, PRIMER_COBRO);

      await generateMonthlyForecasts(YEAR, 6);
      await generateMonthlyForecasts(YEAR, 7);

      // Ni una previsión de 900 € (el doble cobro), ni una de 0 € que ensucie
      // la lista de pendientes: julio sencillamente no tiene renta que pedir.
      expect(await rentaDe(id, YEAR, 7)).toBeUndefined();
    });

    it('la renta se reanuda entera el mes posterior', async () => {
      const id = await sembrar(`${YEAR}-06-16`, PRIMER_COBRO);

      await generateMonthlyForecasts(YEAR, 8);

      expect((await rentaDe(id, YEAR, 8))!.amount).toBe(RENTA);
    });

    it('regenerar el mes prepagado tantas veces como haga falta no lo resucita', async () => {
      const id = await sembrar(`${YEAR}-06-16`, PRIMER_COBRO);

      await generateMonthlyForecasts(YEAR, 7);
      await generateMonthlyForecasts(YEAR, 7);
      await generateMonthlyForecasts(YEAR, 7);

      expect(await rentaDe(id, YEAR, 7)).toBeUndefined();
    });

    it('el caso real · 17 días de agosto + septiembre, y septiembre no se cobra', async () => {
      // Contrato de Jose: entra el 15 de agosto con renta de 365 €. El aritmético
      // de agosto son 200,16 € (17/31), así que 565 € es un número PACTADO, no
      // calculado — justo por eso el importe es ajustable.
      const db = await initDB();
      const id = (await db.add('contracts', {
        ...contrato(`${YEAR}-08-15`, { modo: 'dias_mas_adelanto', importe: 565 }),
        rentaMensual: 365,
      } as never)) as number;

      await generateMonthlyForecasts(YEAR, 8);
      await generateMonthlyForecasts(YEAR, 9);
      await generateMonthlyForecasts(YEAR, 10);

      expect((await rentaDe(id, YEAR, 8))!.amount).toBe(565);
      expect(await rentaDe(id, YEAR, 9)).toBeUndefined();
      expect((await rentaDe(id, YEAR, 10))!.amount).toBe(365);
    });
  });
});
