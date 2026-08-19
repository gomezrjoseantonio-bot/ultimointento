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
  StatementAlreadyImportedError,
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

jest.mock('../bankProfilesService', () => ({
  // Plain functions (not jest.fn) — these are pure helpers; we don't need to
  // assert on call history in any test, and keeping them as plain functions
  // sidesteps any chance of an aggressive Jest reset API (resetAllMocks /
  // restoreAllMocks) interacting with the factory implementation. Note that
  // `jest.clearAllMocks()` (used in beforeEach below) only clears call state
  // on jest.fn — it does NOT reset implementations.
  bankProfilesService: {
    loadProfiles: async () => undefined,
    getProfiles: () => [],
    getBankInfoFromIBAN: (iban: string) => {
      if (!iban) return null;
      const upper = iban.toUpperCase();
      if (!upper.startsWith('ES')) return { bankCode: upper.slice(0, 2) };
      const code = upper.substring(4, 8);
      const map: Record<string, string> = {
        '0081': 'Sabadell',
        '2103': 'Unicaja',
        '2080': 'ABANCA',
      };
      return { bankCode: code, bankKey: map[code] };
    },
  },
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

// jsdom no implementa `File.text()` ni `crypto.subtle`, así que sin esto
// `generateBatchHash` degrada a "sin hash" (''), que es el comportamiento
// seguro en producción pero deja sin cubrir la idempotencia por fichero de
// V6 · D1 bis.
//
// El polyfill lee los BYTES REALES vía FileReader (que jsdom sí implementa),
// no el nombre: así el hash que se ejercita es el de verdad y dos ficheros
// distintos con el mismo nombre siguen dando hashes distintos, como en
// producción.
beforeAll(() => {
  if (typeof File.prototype.text !== 'function') {
    // eslint-disable-next-line no-extend-native
    (File.prototype as unknown as { text: () => Promise<string> }).text = function (this: File) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
});

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

  // V6 · D1 bis · el mismo fichero ya no se reprocesa en silencio: `hashLote`
  // lo corta ANTES de parsear. La dedup por línea sigue existiendo y es la
  // segunda red, para cuando el usuario fuerza la reimportación.
  it('2. processFile con el mismo fichero · se planta antes de insertar nada', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');

    const first = await processFile(file, { accountId: 42 });
    expect(first.movementsInserted).toBe(14);
    expect(first.duplicatesSkipped).toBe(0);
    expect(stores.importBatches).toHaveLength(1);
    expect(stores.importBatches[0].hashLote).not.toBe('');

    await expect(processFile(file, { accountId: 42 })).rejects.toBeInstanceOf(
      StatementAlreadyImportedError
    );

    // No ha tocado nada: ni movimientos nuevos ni una fila de batch huérfana.
    expect(stores.movements).toHaveLength(14);
    expect(stores.importBatches).toHaveLength(1);
  });

  it('2 bis. processFile con allowReimport · 0 insertados · 14 duplicados por hash de línea', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');

    await processFile(file, { accountId: 42 });

    // Reset matching/suggestion mocks so the second pass returns the new ID range
    // (none, since dedup will skip everything).
    (matchBatch as jest.Mock).mockResolvedValueOnce({ matches: [], multiMatches: [], sinMatch: [] });
    (suggestForUnmatched as jest.Mock).mockResolvedValueOnce(new Map());

    const second = await processFile(file, { accountId: 42, allowReimport: true });
    expect(second.movementsInserted).toBe(0);
    expect(second.duplicatesSkipped).toBe(14);
    expect(stores.movements).toHaveLength(14); // no growth
    expect(second.warnings.join(' ')).toMatch(/reimportado/i);
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

    // La línea del banco HEREDA la clasificación de la previsión con la que
    // cuadra (categoría + ámbito), no se queda solo con el texto del banco.
    expect(stores.movements.find(m => m.id === 1)?.categoryKey).toBe('inmueble.alquiler');
    expect(stores.movements.find(m => m.id === 1)?.ambito).toBe('INMUEBLE');
    // La descripción del banco se conserva para cotejar y cruzar con la factura.
    expect(stores.movements.find(m => m.id === 1)?.description).toBe('RENTA 1');

    // Learning rule fed at least once for each conciliated movement (matches +
    // suggestion). Excludes movement 4 (ignored) and rejects the contract
    // suggestion path (which deriveCategoryFromAction returns null for).
    expect((createOrUpdateRule as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('3 bis. confirmDecisions · reconcilia contra un Confirmado que ya tenías · sin duplicar', async () => {
    // "Las dos cosas": el usuario anotó a mano una disposición de cajero
    // (Confirmado, con su clasificación) y AHORA sube el extracto, que trae la
    // misma línea (id 50, source import). Al reconciliar: la del import sube a
    // Conciliado heredando la clasificación, y el confirmado (id 9) se borra.
    stores.movements.push(
      {
        id: 9,
        accountId: 42,
        date: '2026-04-14',
        amount: -20,
        description: 'Sacar del cajero',
        source: 'manual',
        unifiedStatus: 'no_planificado',
        movementState: 'Confirmado',
        statusConciliacion: 'sin_match',
        ambito: 'PERSONAL',
        categoryKey: 'personal.efectivo',
        updatedAt: '',
        createdAt: '',
      } as any,
      {
        id: 50,
        accountId: 42,
        date: '2026-04-15',
        amount: -20,
        description: 'DISPOSICION CAJERO 4521',
        source: 'import',
        unifiedStatus: 'no_planificado',
        statusConciliacion: 'sin_match',
        importBatch: 'batch-A',
        updatedAt: '',
        createdAt: '',
      } as any,
    );

    await confirmDecisions('batch-A', {
      approvedMatches: [],
      approvedSuggestions: [],
      ignoredMovementIds: [],
      reconciliacionesConfirmado: [{ importMovementId: 50, confirmadoMovementId: 9 }],
    });

    // El confirmado se borró · no se cuenta dos veces.
    expect(stores.movements.find(m => m.id === 9)).toBeUndefined();
    // La línea del import sobrevive, ahora Conciliada y con la clasificación heredada.
    const conciliado = stores.movements.find(m => m.id === 50)!;
    expect(conciliado.unifiedStatus).toBe('conciliado');
    expect(conciliado.movementState).toBe('Conciliado');
    expect(conciliado.statusConciliacion).toBe('match_automatico');
    expect(conciliado.categoryKey).toBe('personal.efectivo');
    // Conserva el texto y la fecha del banco (para reconocerse en un reimport).
    expect(conciliado.description).toBe('DISPOSICION CAJERO 4521');
    expect(conciliado.source).toBe('import');
  });

  it('3 ter. reconciliar un previsto PUNTEADO · re-apunta su evento a la línea del import', () => {
    // Regresión del bug de duplicados en cuenta: un previsto punteado deja un
    // evento `executed` apuntando por `movementId` al confirmado (id 9) que
    // `confirmTreasuryEvent` creó con `reference: treasury_event:<id>`. Al subir
    // el extracto se reconcilia contra ese confirmado y se borra; el evento debe
    // RE-APUNTAR a la línea del import (id 50), o el saldo contaría el evento y la
    // línea por separado (fechas distintas) y duplicaría el importe.
    stores.treasuryEvents.push({
      id: 700,
      accountId: 42,
      type: 'expense',
      amount: -20,
      predictedDate: '2026-04-14',
      status: 'executed',
      movementId: 9,
      executedMovementId: 9,
      actualDate: '2026-04-14',
      actualAmount: 20,
    } as any);
    stores.movements.push(
      {
        id: 9,
        accountId: 42,
        date: '2026-04-14',
        amount: -20,
        description: 'Comunidad',
        source: 'manual',
        unifiedStatus: 'conciliado',
        movementState: 'Conciliado',
        reference: 'treasury_event:700',
        categoryKey: 'inmueble.comunidad',
        updatedAt: '',
        createdAt: '',
      } as any,
      {
        id: 50,
        accountId: 42,
        date: '2026-04-15',
        amount: -20,
        description: 'RECIBO FUERTES ACEVEDO 32',
        source: 'import',
        unifiedStatus: 'no_planificado',
        importBatch: 'batch-A',
        updatedAt: '',
        createdAt: '',
      } as any,
    );

    return confirmDecisions('batch-A', {
      approvedMatches: [],
      approvedSuggestions: [],
      ignoredMovementIds: [],
      reconciliacionesConfirmado: [{ importMovementId: 50, confirmadoMovementId: 9 }],
    }).then(() => {
      // El confirmado se borró.
      expect(stores.movements.find(m => m.id === 9)).toBeUndefined();
      // El evento ahora apunta a la línea del import (id 50), con su fecha/importe.
      const ev = stores.treasuryEvents.find(e => e.id === 700)!;
      expect(ev.movementId).toBe(50);
      expect(ev.executedMovementId).toBe(50);
      expect(ev.actualDate).toBe('2026-04-15');
      expect(ev.actualAmount).toBe(20);
    });
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

  it('5. processFile · bypasses BankProfileNotDetectedError when destination account has a known IBAN', async () => {
    // User reported real bug 2026-04-27: Sabadell/Unicaja/ABANCA exports failed
    // file detection. Fix: when the user has chosen an account whose IBAN
    // resolves to a known bank profile, that signal trumps file detection.
    stores.accounts.push({
      id: 42,
      iban: 'ES47 0081 2706 1500 0323 9635', // 0081 → Sabadell
      banco: { name: 'Banco de Sabadell', code: '0081' },
    });
    (bankProfileMatcher.match as jest.Mock).mockResolvedValueOnce({
      profile: null,
      confidence: 0,
      signals: { headerScore: 0, filenameScore: 0, contentScore: 0, ibanScore: 0 },
    });

    const file = new File(['mock'], '27042026_2706_0003239635.xls');
    const result = await processFile(file, { accountId: 42 });

    expect(result.bankProfileUsed).toBe('Sabadell');
    expect(result.movementsInserted).toBeGreaterThan(0);
  });

  it('6. processFile · falls back to banco.name when IBAN is foreign / unknown (Revolut path)', async () => {
    // Revolut accounts use foreign IBANs (LT/IE), which getBankInfoFromIBAN
    // cannot map to a Spanish profile. The deriveBankHintFromAccount second
    // fallback (banco.name → profile key by case-insensitive substring)
    // should catch this. Temporarily override the mocked getProfiles to
    // include a Revolut entry so the matching can succeed.
    const mockService = jest.requireMock('../bankProfilesService').bankProfilesService;
    const originalGetProfiles = mockService.getProfiles;
    mockService.getProfiles = () => [{ bankKey: 'Revolut' }, { bankKey: 'Sabadell' }];

    try {
      stores.accounts.push({
        id: 99,
        iban: 'LT12 3456 7890 1234 5678', // Lithuania — getBankInfoFromIBAN returns soft hint, no bankKey
        banco: { name: 'Revolut', code: undefined },
      });
      (bankProfileMatcher.match as jest.Mock).mockResolvedValueOnce({
        profile: null,
        confidence: 0,
        signals: { headerScore: 0, filenameScore: 0, contentScore: 0, ibanScore: 0 },
      });

      const file = new File(['mock'], 'revolut-export.csv');
      const result = await processFile(file, { accountId: 99 });

      expect(result.bankProfileUsed).toBe('Revolut');
      expect(result.movementsInserted).toBeGreaterThan(0);
    } finally {
      mockService.getProfiles = originalGetProfiles;
    }
  });
});
