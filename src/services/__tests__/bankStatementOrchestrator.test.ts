// TAREA 17 sub-task 17.5 · Tests for bankStatementOrchestrator.
//
// Covers the 4 obligatory integration cases in spec §3.3:
//   1. processFile happy path · 14 movs · 11 match · 3 sin-match
//   2. processFile twice with the same file · 0 inserted · 14 duplicates
//   3. confirmDecisions · 11 matches + 2 suggestions + 1 ignored ⇒ correct DB state
//   4. processFile with bankProfile not detectable and no hint ⇒ throw specific error
//
// The parser, profile matcher, suggestion engine and matching service are
// mocked at the module boundary so we can exercise the orchestrator's wiring
// without spinning up a real CSV file or a real IndexedDB.
import {
  processFile,
  confirmDecisions,
  BankProfileNotDetectedError,
} from '../bankStatementOrchestrator';
import { initDB, Movement, TreasuryEvent } from '../db';
import { bankProfileMatcher } from '../../features/inbox/importers/bankProfileMatcher';
import { BankParserService } from '../../features/inbox/importers/bankParser';
import { matchBatch } from '../movementMatchingService';
import { suggestForUnmatched, MovementSuggestion } from '../movementSuggestionService';
import { createOrUpdateRule } from '../movementLearningService';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../../features/inbox/importers/bankProfileMatcher', () => ({
  bankProfileMatcher: { match: jest.fn() },
}));
jest.mock('../../features/inbox/importers/bankParser', () => ({
  BankParserService: jest.fn(),
}));
jest.mock('../movementMatchingService', () => ({ matchBatch: jest.fn() }));
jest.mock('../movementSuggestionService', () => ({ suggestForUnmatched: jest.fn() }));
jest.mock('../movementLearningService', () => ({
  buildLearnKey: jest.fn(() => 'hash:any'),
  createOrUpdateRule: jest.fn(async () => ({})),
}));

interface FakeStores {
  movements: Movement[];
  treasuryEvents: TreasuryEvent[];
  importBatches: any[];
  accounts: any[];
}

function buildStores(initial: Partial<FakeStores> = {}): FakeStores {
  return {
    movements: initial.movements ?? [],
    treasuryEvents: initial.treasuryEvents ?? [],
    importBatches: initial.importBatches ?? [],
    accounts: initial.accounts ?? [],
  };
}

let nextMovementId = 1;
let stores: FakeStores;

function buildDb(s: FakeStores) {
  return {
    add: jest.fn(async (storeName: keyof FakeStores, row: any) => {
      if (storeName === 'movements') {
        const id = nextMovementId++;
        s.movements.push({ ...row, id });
        return id;
      }
      if (storeName === 'treasuryEvents') {
        const id = (s.treasuryEvents.length + 1) * 1000;
        s.treasuryEvents.push({ ...row, id });
        return id;
      }
      throw new Error(`unsupported store add: ${String(storeName)}`);
    }),
    put: jest.fn(async (storeName: keyof FakeStores, row: any) => {
      const list = s[storeName] as any[];
      const idx = list.findIndex(r => r.id === row.id);
      if (idx >= 0) list[idx] = row;
      else list.push(row);
      return row.id;
    }),
    get: jest.fn(async (storeName: keyof FakeStores, key: number | string) => {
      const list = s[storeName] as any[];
      return list.find(r => r.id === key);
    }),
    getAll: jest.fn(async (storeName: keyof FakeStores) => s[storeName] ?? []),
    delete: jest.fn(async (storeName: keyof FakeStores, key: number | string) => {
      const list = s[storeName] as any[];
      const idx = list.findIndex(r => r.id === key);
      if (idx >= 0) list.splice(idx, 1);
    }),
  };
}

function makeParsed(count: number) {
  // 14 dated movements: rentas alternating two inquilinos plus a couple of expenses.
  const parsed: any[] = [];
  for (let i = 0; i < count; i++) {
    parsed.push({
      date: new Date(`2026-04-${String(15 + (i % 8)).padStart(2, '0')}T00:00:00Z`),
      amount: i % 2 === 0 ? 380 : -45.23,
      description: i % 2 === 0 ? `RENTA INQUILINO ${i}` : `RECIBO IBERDROLA ${i}`,
    });
  }
  return parsed;
}

beforeEach(() => {
  nextMovementId = 1;
  stores = buildStores();
  (initDB as jest.Mock).mockResolvedValue(buildDb(stores));
  (bankProfileMatcher.match as jest.Mock).mockResolvedValue({
    profile: 'Sabadell',
    confidence: 88,
    signals: { headerScore: 50, filenameScore: 25, contentScore: 13 },
  });
  (BankParserService as unknown as jest.Mock).mockImplementation(() => ({
    parseFile: jest.fn(async () => ({
      success: true,
      movements: makeParsed(14),
      metadata: {},
    })),
  }));
  (matchBatch as jest.Mock).mockImplementation(async (movementIds: number[]) => ({
    matches: movementIds.slice(0, 11).map((id, idx) => ({
      movementId: id,
      treasuryEventId: 1000 + idx,
      score: 95,
      reasons: ['fecha_exacta', 'importe_exacto', 'cuenta_match'],
    })),
    multiMatches: [],
    sinMatch: movementIds.slice(11, 14),
  }));
  (suggestForUnmatched as jest.Mock).mockImplementation(async (sinMatchIds: number[]) => {
    const map = new Map<number, MovementSuggestion[]>();
    for (const id of sinMatchIds) {
      map.set(id, [
        {
          movementId: id,
          via: 'heuristica',
          confidence: 60,
          description: 'Posible suministro · proponer crear evento de tesorería',
          action: {
            kind: 'create_treasury_event',
            type: 'expense',
            ambito: 'INMUEBLE',
            categoryKey: 'inmueble.suministros',
            sourceType: 'gasto',
          },
        },
      ]);
    }
    return map;
  });
  jest.clearAllMocks();
});

describe('bankStatementOrchestrator', () => {
  it('1. processFile · 14 parsed · 11 matched · 3 sin-match · result correcto', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const result = await processFile(file, { accountId: 42 });

    expect(result.movementsParsed).toBe(14);
    expect(result.movementsInserted).toBe(14);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.matchResult.matches).toHaveLength(11);
    expect(result.matchResult.sinMatch).toHaveLength(3);
    expect(result.suggestions.size).toBe(3);
    expect(result.bankProfileUsed).toBe('Sabadell');
    expect(result.warnings).toEqual([]); // confidence 88 ≥ 80 → no low-confidence warning
    expect(stores.movements).toHaveLength(14);
    expect(stores.importBatches).toHaveLength(1);
  });

  it('2. processFile twice · 14 inserted then 0 inserted · 14 duplicates omitted', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');

    const first = await processFile(file, { accountId: 42 });
    expect(first.movementsInserted).toBe(14);
    expect(first.duplicatesSkipped).toBe(0);

    // Reset matching/suggestion mocks so the second pass returns the new ID range
    // (none, since dedup will skip everything).
    (matchBatch as jest.Mock).mockResolvedValueOnce({ matches: [], multiMatches: [], sinMatch: [] });
    (suggestForUnmatched as jest.Mock).mockResolvedValueOnce(new Map());

    const second = await processFile(file, { accountId: 42 });
    expect(second.movementsInserted).toBe(0);
    expect(second.duplicatesSkipped).toBe(14);
    expect(stores.movements).toHaveLength(14); // no growth
  });

  it('3. confirmDecisions · matches + suggestions + ignored ⇒ DB state coherente', async () => {
    // Seed 3 movements and 2 predicted events that we will pair up.
    stores.movements.push(
      { id: 1, accountId: 42, date: '2026-04-22', amount: 380, description: 'RENTA 1', unifiedStatus: 'no_planificado', source: 'import', status: 'pendiente' as any, category: { tipo: 'Ingresos' }, importBatch: 'batch-A', updatedAt: '', createdAt: '' } as any,
      { id: 2, accountId: 42, date: '2026-04-22', amount: 380, description: 'RENTA 2', unifiedStatus: 'no_planificado', source: 'import', status: 'pendiente' as any, category: { tipo: 'Ingresos' }, importBatch: 'batch-A', updatedAt: '', createdAt: '' } as any,
      { id: 3, accountId: 42, date: '2026-04-15', amount: -45.23, description: 'IBERDROLA', unifiedStatus: 'no_planificado', source: 'import', status: 'pendiente' as any, category: { tipo: 'Gastos' }, importBatch: 'batch-A', updatedAt: '', createdAt: '' } as any,
      { id: 4, accountId: 42, date: '2026-04-18', amount: -32.99, description: 'AMAZON', unifiedStatus: 'no_planificado', source: 'import', status: 'pendiente' as any, category: { tipo: 'Gastos' }, importBatch: 'batch-A', updatedAt: '', createdAt: '' } as any,
    );
    stores.treasuryEvents.push(
      { id: 1000, type: 'income', amount: 380, predictedDate: '2026-04-22', description: 'Renta 1', sourceType: 'contract', status: 'predicted', accountId: 42, ambito: 'INMUEBLE', categoryKey: 'inmueble.alquiler', createdAt: '', updatedAt: '' },
      { id: 1001, type: 'income', amount: 380, predictedDate: '2026-04-22', description: 'Renta 2', sourceType: 'contract', status: 'predicted', accountId: 42, ambito: 'INMUEBLE', categoryKey: 'inmueble.alquiler', createdAt: '', updatedAt: '' },
    );

    // The suggestion engine returns a "create personal expense" recommendation
    // for movement 3.
    (suggestForUnmatched as jest.Mock).mockResolvedValue(new Map([
      [3, [
        {
          movementId: 3,
          via: 'heuristica',
          confidence: 60,
          description: 'Suministro IBERDROLA',
          action: {
            kind: 'create_treasury_event',
            type: 'expense',
            ambito: 'INMUEBLE',
            categoryKey: 'inmueble.suministros',
            sourceType: 'gasto',
          },
        },
      ]],
    ]));

    await confirmDecisions('batch-A', {
      approvedMatches: [
        { movementId: 1, treasuryEventId: 1000 },
        { movementId: 2, treasuryEventId: 1001 },
      ],
      approvedSuggestions: [{ movementId: 3, suggestionIndex: 0 }],
      ignoredMovementIds: [4],
    });

    // 2 events flipped to executed with executedMovementId set
    const event1000 = stores.treasuryEvents.find(e => e.id === 1000)!;
    const event1001 = stores.treasuryEvents.find(e => e.id === 1001)!;
    expect(event1000.status).toBe('executed');
    expect(event1000.executedMovementId).toBe(1);
    expect(event1001.status).toBe('executed');
    expect(event1001.executedMovementId).toBe(2);

    // 1 new event created from the suggestion (id 1000 + 1001 are the seeded
    // events — anything newer is ours; numeric id auto-assigned by the fake db
    // generator: 3 events × 1000 = 3000 for the inserted one).
    const newEvents = stores.treasuryEvents.filter(e => e.id! >= 3000);
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0].sourceType).toBe('gasto');
    expect(newEvents[0].executedMovementId).toBe(3);

    // Movements 1, 2, 3 → conciliado · movement 4 → no_planificado (ignored)
    expect(stores.movements.find(m => m.id === 1)?.unifiedStatus).toBe('conciliado');
    expect(stores.movements.find(m => m.id === 2)?.unifiedStatus).toBe('conciliado');
    expect(stores.movements.find(m => m.id === 3)?.unifiedStatus).toBe('conciliado');
    expect(stores.movements.find(m => m.id === 4)?.unifiedStatus).toBe('no_planificado');

    // Learning rule fed at least once for each conciliated movement (matches +
    // suggestion). Excludes movement 4 (ignored) and rejects the contract
    // suggestion path (which deriveCategoryFromAction returns null for).
    expect((createOrUpdateRule as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('4. processFile · bankProfileMatcher devuelve confidence baja sin hint ⇒ BankProfileNotDetectedError', async () => {
    (bankProfileMatcher.match as jest.Mock).mockResolvedValueOnce({
      profile: 'Generic',
      confidence: 35,
      signals: { headerScore: 20, filenameScore: 0, contentScore: 15 },
    });
    const file = new File(['mock'], 'banco-desconocido.csv');
    await expect(processFile(file, { accountId: 42 })).rejects.toBeInstanceOf(BankProfileNotDetectedError);
  });
});
