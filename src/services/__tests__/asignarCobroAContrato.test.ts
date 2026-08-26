// Asignar un cobro del extracto a un contrato tiene que dejarlo VINCULADO.
//
// La acción se llamaba `assign_to_contract` y no asignaba a ninguno: nadie
// rellenaba `action.contractId`, así que el evento nacía con `sourceId`
// undefined y sin `contratoId`. Consecuencias: el estado de cobro del inquilino
// no lo veía (`esRentaDeContrato` exige uno de los dos) y el dedupe de
// previsiones tampoco, de modo que el mes acababa con el cobro real MÁS la
// renta prevista — el mismo dinero contado dos veces.

import 'fake-indexeddb/auto';
import { initDB } from '../db';
import type { Contract, Movement, TreasuryEvent } from '../db';
import { suggestForUnmatched } from '../movementSuggestionService';
import { confirmDecisions } from '../bankStatementOrchestrator';
import { esRentaDeContrato } from '../../modules/inmuebles/utils/estadoCobroContratoService';
import { generateMonthlyForecasts } from '../../modules/horizon/tesoreria/services/treasurySyncService';

jest.mock('../cuentasService', () => ({
  __esModule: true,
  cuentasService: { list: () => Promise.resolve([]) },
}));

const objetivo = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
})();
const PREFIJO = `${objetivo.year}-${String(objetivo.month).padStart(2, '0')}`;

const contrato = (nombre: string, apellidos: string): Omit<Contract, 'id'> =>
  ({
    inmuebleId: 1,
    unidadTipo: 'vivienda',
    modalidad: 'larga_estancia',
    inquilino: { nombre, apellidos, dni: 'X1234567L', telefono: '', email: '' },
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

const bizum = (descripcion: string): Omit<Movement, 'id'> =>
  ({
    accountId: 1,
    date: `${PREFIJO}-01`,
    amount: 500,
    description: descripcion,
    importBatch: 'lote-test',
    unifiedStatus: 'sin_planificar',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) as Omit<Movement, 'id'>;

const limpiar = async (): Promise<void> => {
  const db = await initDB();
  for (const store of [
    'treasuryEvents',
    'contracts',
    'accounts',
    'movements',
    'movementLearningRules',
    'compromisosRecurrentes',
  ] as const) {
    await db.clear(store);
  }
  await db.add('accounts', {
    id: 1,
    name: 'Cuenta principal',
    iban: 'ES0000000000000000000001',
    balance: 0,
  } as never);
};

describe('assign_to_contract · el cobro queda vinculado a su contrato', () => {
  beforeEach(limpiar);

  it('propone el contrato cuando el nombre del banco señala a uno solo', async () => {
    const db = await initDB();
    const contratoId = (await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never)) as number;
    const movId = (await db.add('movements', bizum('BIZUM DE ADNAN PARWEZ') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];
    const asignar = sugerencias.find((s) => s.action.kind === 'assign_to_contract');

    expect(asignar).toBeDefined();
    expect(asignar!.action).toMatchObject({ kind: 'assign_to_contract', contractId: contratoId });
    expect(asignar!.description).toContain('Adnan Parwez Khan');
  });

  it('NO elige contrato si el nombre encaja con dos · decide el usuario', async () => {
    const db = await initDB();
    await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never);
    await db.add('contracts', contrato('Yusuf', 'Parwez Khan') as never);
    const movId = (await db.add('movements', bizum('BIZUM DE PARWEZ KHAN') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];
    const asignar = sugerencias.find((s) => s.action.kind === 'assign_to_contract');

    expect(asignar).toBeDefined();
    expect((asignar!.action as { contractId?: number }).contractId).toBeUndefined();
  });

  it('al confirmarla, el evento nace con sourceId y contratoId · y el contrato lo reconoce', async () => {
    const db = await initDB();
    const contratoId = (await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never)) as number;
    const movId = (await db.add('movements', bizum('BIZUM DE ADNAN PARWEZ') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];
    const indice = sugerencias.findIndex((s) => s.action.kind === 'assign_to_contract');
    expect(indice).toBeGreaterThanOrEqual(0);

    await confirmDecisions('lote-test', {
      approvedMatches: [],
      approvedSuggestions: [{ movementId: movId, suggestionIndex: indice }],
      ignoredMovementIds: [],
    });

    const eventos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
    expect(eventos).toHaveLength(1);
    expect(eventos[0].sourceType).toBe('contract');
    expect(eventos[0].sourceId).toBe(contratoId);
    expect(eventos[0].contratoId).toBe(contratoId);
    // Ya no es huérfano: el estado de cobro del inquilino lo cuenta como suyo.
    expect(esRentaDeContrato(eventos[0], contratoId)).toBe(true);
  });

  it('y ese cobro impide que se emita además la renta prevista del mes', async () => {
    const db = await initDB();
    const contratoId = (await db.add('contracts', contrato('Adnan', 'Parwez Khan') as never)) as number;
    const movId = (await db.add('movements', bizum('BIZUM DE ADNAN PARWEZ') as never)) as number;

    const sugerencias = (await suggestForUnmatched([movId])).get(movId) ?? [];
    const indice = sugerencias.findIndex((s) => s.action.kind === 'assign_to_contract');
    await confirmDecisions('lote-test', {
      approvedMatches: [],
      approvedSuggestions: [{ movementId: movId, suggestionIndex: indice }],
      ignoredMovementIds: [],
    });

    await generateMonthlyForecasts(objetivo.year, objetivo.month);

    const rentas = ((await db.getAll('treasuryEvents')) as TreasuryEvent[]).filter((e) =>
      esRentaDeContrato(e, contratoId),
    );
    expect(rentas).toHaveLength(1);
    expect(rentas[0].status).toBe('executed');
  });
});
