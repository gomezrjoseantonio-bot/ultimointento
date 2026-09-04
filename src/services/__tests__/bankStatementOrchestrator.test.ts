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
  hashMovement,
  cancelImportBatch,
} from '../bankStatementOrchestrator';
import { reabrirLote } from '../reabrirLote';
import {
  decisionDeLinea,
  decisionesDesdeFilas,
  guardarDecisionDeLinea,
  lotesAMedias,
} from '../../modules/tesoreria/v6/decisionesPersistidas';
import {
  construirLineas,
  decisionesVacias,
  payloadDeConfirmacion,
  seOfrecePara,
} from '../../modules/tesoreria/v6/extractoSesion';
import { initDB, Movement, TreasuryEvent } from '../db';
import { bankProfileMatcher } from '../../features/inbox/importers/bankProfileMatcher';
import { BankParserService } from '../../features/inbox/importers/bankParser';
import { matchBatch } from '../movementMatchingService';
import { suggestForUnmatched, MovementSuggestion } from '../movementSuggestionService';
import { createOrUpdateRule } from '../movementLearningService';
import { gastoDesdeMovimiento, mejoraDesdeMovimiento } from '../altaMovimientoService';

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
  // E1.1 · la línea del banco persistida · nadie la lee aún.
  lineasExtracto: any[];
  // E1.5-previo · las fichas que la sesión crea desde la ficha del movimiento.
  gastosInmueble: any[];
  mejorasInmueble: any[];
}

function buildStores(initial: Partial<FakeStores> = {}): FakeStores {
  return {
    movements: initial.movements ?? [],
    treasuryEvents: initial.treasuryEvents ?? [],
    importBatches: initial.importBatches ?? [],
    accounts: initial.accounts ?? [],
    lineasExtracto: initial.lineasExtracto ?? [],
    gastosInmueble: initial.gastosInmueble ?? [],
    mejorasInmueble: initial.mejorasInmueble ?? [],
  };
}

let nextMovementId = 1;
let nextLineaId = 1;
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
      if (storeName === 'lineasExtracto') {
        const id = nextLineaId++;
        s.lineasExtracto.push({ ...row, id });
        return id;
      }
      if (storeName === 'gastosInmueble' || storeName === 'mejorasInmueble') {
        const list = s[storeName];
        const id = (list.length + 1) * 10;
        list.push({ ...row, id });
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
  nextLineaId = 1;
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

  it('1b. Dos cargos IDÉNTICOS en el mismo extracto entran los DOS (comunidad de dos pisos)', async () => {
    // Caso real de Jose: el banco lista dos "CDAD PROP … -38,00" del mismo día
    // (Nº mov 839 y 840). Son dos movimientos reales; la dedup por línea NO debe
    // colapsarlos. Solo se deduplica contra lo que YA existía de otros lotes.
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({
        success: true,
        movements: [
          { date: new Date('2026-08-05T00:00:00Z'), amount: -38, description: 'CDAD PROP 01B046 000278300002' },
          { date: new Date('2026-08-05T00:00:00Z'), amount: -38, description: 'CDAD PROP 01B046 000278300002' },
        ],
        metadata: {},
      })),
    }));
    (matchBatch as jest.Mock).mockResolvedValueOnce({ matches: [], multiMatches: [], sinMatch: [] });
    (suggestForUnmatched as jest.Mock).mockResolvedValueOnce(new Map());

    const file = new File(['mock'], 'unicaja.xls');
    const result = await processFile(file, { accountId: 42 });

    expect(result.movementsInserted).toBe(2);
    expect(result.duplicatesSkipped).toBe(0);
    expect(stores.movements.filter(m => m.amount === -38)).toHaveLength(2);
  });

  // V6 · D1 bis · el mismo fichero ya no se reprocesa en silencio: `hashLote`
  // lo corta ANTES de parsear. La dedup por línea (contra otros lotes) sigue
  // siendo la segunda red, para cuando el usuario fuerza la reimportación.
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

  // La sugerencia YA NO se aplica sola: ese canal se retiró en la 2.0.2 porque
  // nunca se ejecutaba (`payloadDeConfirmacion` lo devolvía vacío) y lo que
  // había al otro lado no creaba la fila fiscal del gasto. Lo que este test
  // protege sigue siendo lo de siempre —matches e ignorados—, más el candado de
  // que una sugerencia NO se materializa a espaldas del usuario.
  it('3. confirmDecisions · matches + ignored ⇒ DB state coherente · y la sugerencia no se cuela', async () => {
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
      ignoredMovementIds: [4],
    });

    // 2 events flipped to executed with executedMovementId set
    const event1000 = stores.treasuryEvents.find(e => e.id === 1000)!;
    const event1001 = stores.treasuryEvents.find(e => e.id === 1001)!;
    expect(event1000.status).toBe('executed');
    expect(event1000.executedMovementId).toBe(1);
    expect(event1001.status).toBe('executed');
    expect(event1001.executedMovementId).toBe(2);

    // NINGÚN evento nuevo: la sugerencia para el movimiento 3 existe, pero
    // nadie la aplica. Antes se creaba aquí un `gasto` a espaldas del usuario y
    // sin fila fiscal.
    expect(stores.treasuryEvents.filter(e => e.id! >= 3000)).toHaveLength(0);

    // Movements 1, 2 → conciliado · 3 sigue esperando decisión · 4 ignorado.
    expect(stores.movements.find(m => m.id === 1)?.unifiedStatus).toBe('conciliado');
    expect(stores.movements.find(m => m.id === 2)?.unifiedStatus).toBe('conciliado');
    expect(stores.movements.find(m => m.id === 3)?.unifiedStatus).toBe('no_planificado');
    expect(stores.movements.find(m => m.id === 4)?.unifiedStatus).toBe('no_planificado');

    // La línea del banco HEREDA la clasificación de la previsión con la que
    // cuadra (categoría + ámbito), no se queda solo con el texto del banco.
    expect(stores.movements.find(m => m.id === 1)?.categoryKey).toBe('inmueble.alquiler');
    expect(stores.movements.find(m => m.id === 1)?.ambito).toBe('INMUEBLE');
    // La descripción del banco se conserva para cotejar y cruzar con la factura.
    expect(stores.movements.find(m => m.id === 1)?.description).toBe('RENTA 1');

    // Se aprende de lo que SÍ se concilió · los dos matches.
    expect((createOrUpdateRule as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
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

// ─── E1.1 · `lineasExtracto` · la línea del banco se persiste ADEMÁS del movimiento ───
//
// Aditivo: nadie lee el store todavía. Lo que se protege aquí es que (a) por
// cada movimiento creado hay UNA línea, (b) su `conceptoLiteral` es el texto del
// parser CARÁCTER A CARÁCTER (se guarda sin trim ni normalizar; las huellas
// —`hashMovement` con `.trim()`, `hashLinea` normalizada— se derivan de él),
// (c) `movementIds` enlaza bien, y (d) lo que hoy NO genera movimiento deja
// rastro con `descarte` en vez de perderse.
describe('E1.1 · lineasExtracto', () => {
  it('7. una línea por movimiento creado · conceptoLiteral EXACTO · movementIds enlaza', async () => {
    const parsed = makeParsed(14);
    // Espacios dobles, espacios en los extremos, acentos y ñ: todo lo que un
    // `trim` o un normalizador se comería. Tiene que llegar tal cual.
    parsed[3].description = '  RECIBO  IBERDROLA   ÁÉ ñ · ¿? ';
    parsed[5].valueDate = new Date('2026-04-22T00:00:00Z');
    parsed[5].counterparty = 'IBERDROLA CLIENTES';
    parsed[5].reference = 'REF-000123';
    parsed[5].balance = 1234.56;
    parsed[5].currency = 'EUR';
    parsed[5].originalRow = 9;
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({ success: true, movements: parsed, metadata: {} })),
    }));

    const result = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });

    // Lo de siempre no cambia.
    expect(result.movementsInserted).toBe(14);
    expect(result.duplicatesSkipped).toBe(0);
    expect(stores.movements).toHaveLength(14);

    // Y ADEMÁS hay una línea por movimiento.
    expect(stores.lineasExtracto).toHaveLength(14);
    for (let i = 0; i < parsed.length; i++) {
      const linea = stores.lineasExtracto[i];
      const mov = stores.movements[i];
      expect(linea.conceptoLiteral).toBe(parsed[i].description);
      expect(linea.conceptoLiteral.length).toBe(parsed[i].description.length);
      expect(linea.movementIds).toEqual([mov.id]);
      expect(linea.importe).toBe(mov.amount);
      expect(linea.fechaOperacion).toBe(mov.date);
      expect(linea.fechaValor).toBe(mov.valueDate);
      expect(linea.accountId).toBe(42);
      expect(linea.importBatchId).toBe(result.importBatchId);
      expect(linea.estado).toBe('resuelta');
      expect(linea.descarte).toBeUndefined();
      // La huella es LA MISMA con la que el orquestador deduplica el movimiento.
      expect(linea.hashMovement).toBe(hashMovement(mov));
      expect(linea.hashLinea).toMatch(/^v1:/);
    }
    // Lo demás que trajo el banco viaja entero.
    const l5 = stores.lineasExtracto[5];
    expect(l5.fechaValor).toBe('2026-04-22');
    expect(l5.contraparte).toBe('IBERDROLA CLIENTES');
    expect(l5.referencia).toBe('REF-000123');
    expect(l5.saldo).toBe(1234.56);
    expect(l5.divisa).toBe('EUR');
    expect(l5.filaOriginal).toBe(9);
  });

  it('7b. reimportar con allowReimport · las duplicadas dejan rastro con descarte y SIN movimiento', async () => {
    const file = new File(['mock'], 'sabadell-extracto.xlsx');
    const primero = await processFile(file, { accountId: 42 });
    (matchBatch as jest.Mock).mockResolvedValueOnce({ matches: [], multiMatches: [], sinMatch: [] });
    (suggestForUnmatched as jest.Mock).mockResolvedValueOnce(new Map());
    const segundo = await processFile(file, { accountId: 42, allowReimport: true });

    expect(segundo.movementsInserted).toBe(0);
    expect(segundo.duplicatesSkipped).toBe(14);
    expect(stores.movements).toHaveLength(14); // igual que antes de E1.1

    expect(stores.lineasExtracto).toHaveLength(28);
    const delSegundo = stores.lineasExtracto.filter((l) => l.importBatchId === segundo.importBatchId);
    expect(delSegundo).toHaveLength(14);
    for (const l of delSegundo) {
      expect(l.descarte).toBe('duplicada');
      expect(l.estado).toBe('sin_procesar');
      expect(l.movementIds).toEqual([]);
    }
    // La misma línea, en los dos lotes, tiene la MISMA identidad.
    const delPrimero = stores.lineasExtracto.filter((l) => l.importBatchId === primero.importBatchId);
    expect(delSegundo.map((l) => l.hashLinea)).toEqual(delPrimero.map((l) => l.hashLinea));
    expect(delSegundo.map((l) => l.hashMovement)).toEqual(delPrimero.map((l) => l.hashMovement));
  });

  it('7c. sin fecha y sin importe · dejan rastro en vez de perderse en silencio', async () => {
    (BankParserService as unknown as jest.Mock).mockImplementationOnce(() => ({
      parseFile: jest.fn(async () => ({
        success: true,
        movements: [
          { date: new Date('2026-05-03T00:00:00Z'), amount: -12.5, description: 'CARGO NORMAL' },
          { date: new Date('no es una fecha'), amount: -99, description: 'SIN FECHA' },
          { date: new Date('2026-05-04T00:00:00Z'), amount: 'abc', description: 'SIN IMPORTE' },
        ],
        metadata: {},
      })),
    }));
    (matchBatch as jest.Mock).mockResolvedValueOnce({ matches: [], multiMatches: [], sinMatch: [] });
    (suggestForUnmatched as jest.Mock).mockResolvedValueOnce(new Map());

    const result = await processFile(new File(['mock'], 'raro.xlsx'), { accountId: 42 });

    // Lo de siempre: solo entra la buena.
    expect(result.movementsParsed).toBe(3);
    expect(result.movementsInserted).toBe(1);
    expect(stores.movements).toHaveLength(1);

    expect(stores.lineasExtracto).toHaveLength(3);
    const [ok, sinFecha, sinImporte] = stores.lineasExtracto;
    expect(ok.estado).toBe('resuelta');
    expect(ok.movementIds).toEqual([stores.movements[0].id]);

    expect(sinFecha.descarte).toBe('sin_fecha');
    expect(sinFecha.fechaOperacion).toBe('');
    expect(sinFecha.importe).toBe(-99);
    expect(sinFecha.conceptoLiteral).toBe('SIN FECHA');
    expect(sinFecha.movementIds).toEqual([]);

    expect(sinImporte.descarte).toBe('sin_importe');
    expect(sinImporte.fechaOperacion).toBe('2026-05-04');
    expect(sinImporte.conceptoLiteral).toBe('SIN IMPORTE');
    expect(sinImporte.movementIds).toEqual([]);
  });
});

// ─── E1.3 · retomar un lote a medias ───────────────────────────────────────
//
// Lo que se prueba, de punta a punta con el mismo fake de base:
//   procesar → decidir (persistiendo) → «cerrar» (tirar la memoria) → reabrir
//   → la sesión se reconstruye idéntica y el payload a `confirmDecisions` es
//   el mismo que habría salido sin cerrar. Y descartar el lote borra también
//   sus líneas, para que no vuelva a salir como «a medias».
describe('E1.3 · retomar un lote a medias', () => {
  const sesionDe = async (importBatchId: string) => {
    const delLote = stores.movements.filter((m) => m.importBatch === importBatchId);
    const filas = stores.lineasExtracto.filter((l) => l.importBatchId === importBatchId);
    const abiertos = stores.treasuryEvents.filter((e) => seOfrecePara(e, 42));
    return { delLote, filas, abiertos };
  };

  it('8. reabrirLote devuelve lo mismo que processFile, sin leer fichero ni insertar', async () => {
    const primero = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const movimientosAntes = stores.movements.length;
    const lineasAntes = stores.lineasExtracto.length;

    const reabierto = await reabrirLote(primero.importBatchId);

    expect(reabierto.importBatchId).toBe(primero.importBatchId);
    expect(reabierto.matchResult.matches.map((m) => m.movementId)).toEqual(
      primero.matchResult.matches.map((m) => m.movementId)
    );
    expect(reabierto.matchResult.sinMatch).toEqual(primero.matchResult.sinMatch);
    expect(reabierto.suggestions.size).toBe(primero.suggestions.size);
    expect(reabierto.movementsInserted).toBe(14);
    expect(reabierto.warnings.join(' ')).toMatch(/retomada/i);
    // Nada nuevo en la base.
    expect(stores.movements).toHaveLength(movimientosAntes);
    expect(stores.lineasExtracto).toHaveLength(lineasAntes);
    expect(stores.importBatches).toHaveLength(1);
  });

  it('8b. un lote guardado no se reabre · y uno inexistente tampoco', async () => {
    const r = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    stores.importBatches[0].consolidadoAt = '2026-09-04T10:00:00.000Z';
    await expect(reabrirLote(r.importBatchId)).rejects.toThrow(/ya se guardó/);
    await expect(reabrirLote('import_no_existe')).rejects.toThrow(/ya no existe/);
  });

  it('8c. procesar → decidir → cerrar → reabrir · la sesión vuelve idéntica y el payload es el mismo', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const { delLote, filas, abiertos } = await sesionDe(res.importBatchId);
    const lineas = construirLineas(delLote, res.matchResult, abiertos, new Set(), new Map(), filas);
    expect(lineas).toHaveLength(14);

    // El usuario decide: asigna una a mano, ignora dos, marca un traspaso y
    // una retirada de efectivo, y desempareja una que ATLAS había casado.
    const d = decisionesVacias();
    d.asignados.set(lineas[11].lineaId, 1000); // una sin match, asignada a mano
    d.ignorados.add(lineas[12].lineaId);
    d.ignorados.add(lineas[13].lineaId);
    d.aTraspaso.set(lineas[1].lineaId, 7);
    d.aEfectivo.add(lineas[3].lineaId);
    d.desemparejados.add(lineas[0].lineaId);
    // Persistir como lo hace el drawer tras cada gesto.
    for (const l of lineas) {
      await guardarDecisionDeLinea(l.lineaId, decisionDeLinea(d, l.lineaId, '2026-09-04T10:00:00.000Z'));
    }
    const payloadAntesDeCerrar = payloadDeConfirmacion(lineas, d);
    const movimientosAntes = stores.movements.map((m) => ({ ...m }));

    // «Cerrar»: la memoria de React se tira. Solo queda la base.
    // Sale como a medias, con sus decisiones contadas.
    const lotes = await lotesAMedias();
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({ importBatchId: res.importBatchId, lineas: 14, decididas: 6 });

    // Reabrir.
    const reabierto = await reabrirLote(res.importBatchId);
    const otraVez = await sesionDe(res.importBatchId);
    const lineas2 = construirLineas(otraVez.delLote, reabierto.matchResult, otraVez.abiertos, new Set(), new Map(), otraVez.filas);
    const d2 = decisionesDesdeFilas(otraVez.filas);

    expect(d2).toEqual(d);
    expect(lineas2.map((l) => [l.lineaId, l.movementId, l.veredicto])).toEqual(
      lineas.map((l) => [l.lineaId, l.movementId, l.veredicto])
    );
    expect(payloadDeConfirmacion(lineas2, d2)).toEqual(payloadAntesDeCerrar);

    // §29 · persistir decisiones (incluido ignorar) no ha tocado ningún movimiento.
    expect(stores.movements).toEqual(movimientosAntes);
    // Y las filas ignoradas dicen «silenciada», no otra cosa.
    const ignoradas = stores.lineasExtracto.filter((l) => d.ignorados.has(l.id));
    expect(ignoradas.map((l) => l.atencion)).toEqual(['silenciada', 'silenciada']);
    expect(ignoradas.map((l) => l.estado)).toEqual(['resuelta', 'resuelta']);
  });

  it('8d. descartar el lote borra sus movimientos Y sus líneas · deja de estar a medias', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    expect(stores.lineasExtracto).toHaveLength(14);
    expect(await lotesAMedias()).toHaveLength(1);

    const { removed } = await cancelImportBatch(res.importBatchId);

    expect(removed).toBe(14);
    expect(stores.movements).toHaveLength(0);
    expect(stores.lineasExtracto).toHaveLength(0);
    expect(stores.importBatches).toHaveLength(0);
    expect(await lotesAMedias()).toHaveLength(0);
  });

  it('8e. E1.5-previo · descartar el lote limpia las fichas de gasto/mejora creadas desde la sesión', async () => {
    const res = await processFile(new File(['mock'], 'sabadell.xlsx'), { accountId: 42 });
    const [gastoMov, mejoraMov, recurrenteMov] = stores.movements.filter((m) => m.amount < 0);

    // Lo que hace la ficha a mitad de sesión · con los servicios REALES.
    const gasto = await gastoDesdeMovimiento({
      movementId: gastoMov.id as number,
      inmuebleId: 4,
      concepto: 'Luz Tenderina',
      importe: gastoMov.amount,
      fecha: gastoMov.date,
      categoryKey: 'inmueble.suministros',
      hoy: '2026-09-04',
    });
    expect(gasto.resultado).toBe('creada');
    await mejoraDesdeMovimiento({
      movementId: mejoraMov.id as number,
      inmuebleId: 4,
      concepto: 'Derrama fachada',
      importe: mejoraMov.amount,
      fecha: mejoraMov.date,
    });
    // Una fila de gasto que YA existía (la del recurrente) y la sesión solo cerró.
    stores.gastosInmueble.push({
      id: 900, inmuebleId: 4, ejercicio: 2026, fecha: recurrenteMov.date, concepto: 'Comunidad', categoria: 'comunidad',
      casillaAEAT: '0109', importe: 45.23, origen: 'recurrente', origenId: 'recurrente-7-2026-4',
      estado: 'confirmado', estadoTesoreria: 'confirmed', movimientoId: String(recurrenteMov.id), fechaValor: recurrenteMov.date,
      cuentaBancaria: '42', createdAt: '', updatedAt: '',
    });
    // Y una ficha de OTRO movimiento, ajena al lote · no se toca.
    stores.movements.push({ id: 5000, accountId: 42, date: '2026-03-01', amount: -80, description: 'otro', source: 'manual' } as any);
    stores.gastosInmueble.push({ id: 901, inmuebleId: 4, ejercicio: 2026, fecha: '2026-03-01', concepto: 'Ajeno', categoria: 'suministro', casillaAEAT: '0113', importe: 80, origen: 'tesoreria', estado: 'confirmado', movimientoId: '5000', createdAt: '', updatedAt: '' });
    stores.mejorasInmueble.push({ id: 902, inmuebleId: 4, ejercicio: 2026, descripcion: 'Ajena', tipo: 'mejora', importe: 80, fecha: '2026-03-01', movimientoId: 5000, createdAt: '', updatedAt: '' });
    expect(stores.gastosInmueble).toHaveLength(3);
    expect(stores.mejorasInmueble).toHaveLength(2);

    const { removed, fichas } = await cancelImportBatch(res.importBatchId);

    expect(removed).toBe(14);
    expect(fichas).toEqual({ gastosBorrados: 1, gastosDesenlazados: 1, mejorasBorradas: 1 });
    // Nada apunta a un movimiento que ya no existe.
    const vivos = new Set(stores.movements.map((m) => m.id));
    const huerfanas = (filas: any[]) =>
      filas.filter((f) => f.movimientoId != null && !vivos.has(Number(f.movimientoId))).map((f) => f.id);
    expect(huerfanas(stores.gastosInmueble)).toEqual([]);
    expect(huerfanas(stores.mejorasInmueble)).toEqual([]);
    // La del recurrente sobrevive, desenlazada y otra vez prevista.
    const recurrente = stores.gastosInmueble.find((g) => g.id === 900);
    expect(recurrente).toMatchObject({ origen: 'recurrente', estado: 'previsto', estadoTesoreria: 'predicted', importe: 45.23 });
    expect(recurrente.movimientoId).toBeUndefined();
    expect(recurrente.cuentaBancaria).toBeUndefined();
    // Las ajenas al lote, intactas.
    expect(stores.gastosInmueble.map((g) => g.id).sort()).toEqual([900, 901]);
    expect(stores.mejorasInmueble.map((m) => m.id)).toEqual([902]);
  });
});
