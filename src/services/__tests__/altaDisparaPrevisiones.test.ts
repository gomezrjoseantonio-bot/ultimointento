// Guardar un contrato tiene que verse en tesorería en el acto.
//
// Hasta ahora el alta escribía el contrato y ahí se quedaba: las previsiones no
// aparecían hasta el siguiente bootstrap, así que el usuario daba de alta un
// inquilino y la tesorería seguía sin saber nada de esa renta.
//
// Lo que se vigila aquí es el ciclo COMPLETO de regeneración, que no es un
// simple «genera»: `regenerateForecastsForward` primero BORRA los predicted
// hacia delante y luego los vuelve a crear. Ese borrado es justo donde un mes
// suprimido a propósito —el que ya se cobró por adelantado (#1801)— podría
// resucitar, abriendo una cuarta puerta al doble cobro.

import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { Contract, TreasuryEvent } from '../db';
import { regenerateForecastsForward } from '../treasuryBootstrapService';

jest.mock('../cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

/** Horizonte corto: al test le bastan unos meses y los 24 por defecto tardan. */
const HORIZONTE = 5;

/** Mes de hoy + n, en base 1, que es como los cuenta el generador. */
const mesRelativo = (n: number): { year: number; month: number; prefijo: string } => {
  const hoy = new Date();
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + n, 1));
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return { year, month, prefijo: `${year}-${String(month).padStart(2, '0')}` };
};

const contrato = (extra: Partial<Contract>): Omit<Contract, 'id'> =>
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
    fechaFin: `${new Date().getFullYear() + 5}-12-31`,
    rentaMensual: 900,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 900,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  }) as Omit<Contract, 'id'>;

const rentasDe = async (contratoId: number, prefijo: string): Promise<TreasuryEvent[]> => {
  const db = await initDB();
  const todos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  return todos.filter(
    (e) =>
      e.type === 'income' &&
      (e.sourceType === 'contrato' || e.sourceType === 'contract') &&
      e.sourceId === contratoId &&
      typeof e.predictedDate === 'string' &&
      e.predictedDate.startsWith(prefijo),
  );
};

describe('regenerar hacia delante tras guardar un contrato', () => {
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

  it('un contrato recién guardado ya tiene sus previsiones, sin bootstrap manual', async () => {
    const db = await initDB();
    const mes1 = mesRelativo(1);
    const id = (await db.add(
      'contracts',
      contrato({ fechaInicio: `${mes1.prefijo}-01` }) as never,
    )) as number;

    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });

    expect(await rentasDe(id, mes1.prefijo)).toHaveLength(1);
    expect((await rentasDe(id, mesRelativo(2).prefijo))[0].amount).toBe(900);
  });

  it('regenerar otra vez tras editar la renta actualiza el importe sin duplicar', async () => {
    const db = await initDB();
    const mes1 = mesRelativo(1);
    const id = (await db.add(
      'contracts',
      contrato({ fechaInicio: `${mes1.prefijo}-01` }) as never,
    )) as number;

    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });

    // El usuario corrige la renta en el wizard y vuelve a guardar.
    const guardado = (await db.get('contracts', id)) as Contract;
    await db.put('contracts', { ...guardado, rentaMensual: 1000 });
    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });

    const rentas = await rentasDe(id, mes1.prefijo);
    expect(rentas).toHaveLength(1);
    expect(rentas[0].amount).toBe(1000);
  });

  it('regenerar tres veces seguidas deja una sola renta por mes', async () => {
    const db = await initDB();
    const mes1 = mesRelativo(1);
    const id = (await db.add(
      'contracts',
      contrato({ fechaInicio: `${mes1.prefijo}-01` }) as never,
    )) as number;

    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });
    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });
    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });

    expect(await rentasDe(id, mes1.prefijo)).toHaveLength(1);
    expect(await rentasDe(id, mesRelativo(2).prefijo)).toHaveLength(1);
  });

  // ── LA CUARTA PUERTA AL DOBLE COBRO ──────────────────────────────────────
  it('el mes cobrado por adelantado sigue sin previsión después de regenerar', async () => {
    const db = await initDB();
    const mes1 = mesRelativo(1);
    const id = (await db.add(
      'contracts',
      contrato({
        fechaInicio: `${mes1.prefijo}-16`,
        // Entra a mitad de mes y paga por adelantado la mensualidad siguiente.
        primerCobro: { modo: 'dias_mas_adelanto', importe: 1350 },
      }) as never,
    )) as number;

    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });

    expect((await rentasDe(id, mes1.prefijo))[0].amount).toBe(1350);
    // El mes siguiente ya está pagado: ni una renta de 900 €, ni una de 0 €.
    expect(await rentasDe(id, mesRelativo(2).prefijo)).toHaveLength(0);
    // Y la recurrente se reanuda al siguiente.
    expect((await rentasDe(id, mesRelativo(3).prefijo))[0].amount).toBe(900);
  });

  it('ni tras regenerar varias veces · el borrado previo no lo resucita', async () => {
    const db = await initDB();
    const mes1 = mesRelativo(1);
    const id = (await db.add(
      'contracts',
      contrato({
        fechaInicio: `${mes1.prefijo}-16`,
        primerCobro: { modo: 'dias_mas_adelanto', importe: 1350 },
      }) as never,
    )) as number;

    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });
    await regenerateForecastsForward({ horizonteMeses: HORIZONTE });

    expect(await rentasDe(id, mesRelativo(2).prefijo)).toHaveLength(0);
  });
});
