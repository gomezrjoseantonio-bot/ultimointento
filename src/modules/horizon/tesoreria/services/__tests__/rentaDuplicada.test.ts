// La renta de un mes no se puede contar dos veces.
//
// El generador vivo emite la renta con `sourceType:'contrato'` y su dedupe
// (`isDuplicate`) filtraba por `sourceType` EXACTO. Pero un cobro de alquiler
// también puede llegar por el extracto: al asignar una línea del banco a un
// contrato, `bankStatementOrchestrator` guarda el evento con
// `sourceType:'contract'` (singular). Ese evento era invisible para el dedupe,
// así que la siguiente regeneración volvía a emitir la renta del mes y el
// mismo dinero aparecía dos veces: una ya cobrada contra un movimiento real y
// otra como previsión pendiente.
//
// `RENT_SOURCE_TYPES` ya agrupaba los dos nombres para el estado de cobro
// (`estadoCobroContratoService`), pero el generador no lo usaba.

import 'fake-indexeddb/auto';
import { initDB } from '../../../../../services/db';
import type { Contract, TreasuryEvent } from '../../../../../services/db';
import { generateMonthlyForecasts } from '../treasurySyncService';

jest.mock('../../../../../services/cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

/** Mes objetivo · dos meses por delante, para caer siempre en el futuro. */
const objetivo = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
})();
const PREFIJO = `${objetivo.year}-${String(objetivo.month).padStart(2, '0')}`;

const contrato = (): Omit<Contract, 'id'> =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: {
      nombre: 'Adnan',
      apellidos: 'Parwez Khan',
      dni: 'X1234567L',
      telefono: '600000000',
      email: 'adnan@example.com',
    },
    fechaInicio: '2020-01-01',
    fechaFin: '2099-12-31',
    rentaMensual: 500,
    diaPago: 1,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 500,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Contract, 'id'>;

/**
 * El cobro que ya entró por el extracto: conciliado contra un movimiento real
 * y guardado con el `sourceType` que escribe `assign_to_contract`.
 */
const cobroDesdeExtracto = (contratoId: number): Omit<TreasuryEvent, 'id'> =>
  ({
    type: 'income',
    amount: 500,
    predictedDate: `${PREFIJO}-01`,
    description: 'BIZUM DE ADNAN PARWEZ',
    sourceType: 'contract',
    sourceId: contratoId,
    accountId: 1,
    ambito: 'INMUEBLE',
    status: 'executed',
    executedMovementId: 999,
    actualDate: `${PREFIJO}-01`,
    actualAmount: 500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<TreasuryEvent, 'id'>;

/** Rentas vivas de ese contrato en el mes objetivo, venga el evento de donde venga. */
const rentasDelMes = async (contratoId: number): Promise<TreasuryEvent[]> => {
  const db = await initDB();
  const todos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  return todos.filter(
    (e) =>
      e.type === 'income' &&
      (e.sourceType === 'contrato' || e.sourceType === 'contract') &&
      e.sourceId === contratoId &&
      typeof e.predictedDate === 'string' &&
      e.predictedDate.startsWith(PREFIJO),
  );
};

describe('la renta del mes no se cuenta dos veces', () => {
  let contratoId: number;

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
    contratoId = (await db.add('contracts', contrato() as never)) as number;
  });

  it('sin cobro previo, emite la renta del mes una sola vez', async () => {
    await generateMonthlyForecasts(objetivo.year, objetivo.month);
    expect(await rentasDelMes(contratoId)).toHaveLength(1);
  });

  it('si el cobro ya entró por el extracto (sourceType "contract"), NO emite otra previsión', async () => {
    const db = await initDB();
    await db.add('treasuryEvents', cobroDesdeExtracto(contratoId) as never);

    await generateMonthlyForecasts(objetivo.year, objetivo.month);

    const rentas = await rentasDelMes(contratoId);
    expect(rentas).toHaveLength(1);
    // La que queda es la real, la que ya se cobró · no una previsión nueva.
    expect(rentas[0].sourceType).toBe('contract');
    expect(rentas[0].status).toBe('executed');
  });

  it('regenerar dos veces con el cobro presente sigue dejando una sola renta', async () => {
    const db = await initDB();
    await db.add('treasuryEvents', cobroDesdeExtracto(contratoId) as never);

    await generateMonthlyForecasts(objetivo.year, objetivo.month);
    await generateMonthlyForecasts(objetivo.year, objetivo.month);

    expect(await rentasDelMes(contratoId)).toHaveLength(1);
  });
});
