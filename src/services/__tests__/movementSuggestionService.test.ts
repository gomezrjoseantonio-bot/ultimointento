// TAREA 17 sub-task 17.3 · Tests for movementSuggestionService.
//
// Covers the 5 obligatory cases in spec §3.2:
//   1. compromisosRecurrentes empty ⇒ vía A returns nothing, falls through to B
//   2. learning rule with appliedCount=5 ⇒ vía B confidence ≥ 70, short-circuits
//   3. "RECIBO IBERDROLA CLIENTES SAU" without learning rule ⇒ vía C suministro 60
//   4. "BIZUM A FUENTES" without contracts ⇒ vía C assign_to_contract 50
//   5. learning rule with appliedCount=0 ⇒ vía B at 50 + vía C heurística both included
import { suggestForUnmatched } from '../movementSuggestionService';
import { initDB, Movement, MovementLearningRule } from '../db';
import { buildLearnKey } from '../movementLearningService';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../movementLearningService', () => ({
  buildLearnKey: jest.fn(),
}));

interface FakeStores {
  movements?: Movement[];
  movementLearningRules?: MovementLearningRule[];
  compromisosRecurrentes?: any[];
}

function buildDb(stores: FakeStores) {
  return {
    get: jest.fn(async (storeName: keyof FakeStores, key: number) => {
      return (stores[storeName] as any[] | undefined)?.find(row => row.id === key);
    }),
    getAll: jest.fn(async (storeName: keyof FakeStores) => stores[storeName] ?? []),
    getAllFromIndex: jest.fn(
      async (storeName: keyof FakeStores, _indexName: string, value: any) => {
        const list = (stores[storeName] as any[] | undefined) ?? [];
        if (storeName === 'movementLearningRules') {
          return list.filter((r: any) => r.learnKey === value);
        }
        return list;
      },
    ),
  };
}

const baseMovement: Movement = {
  id: 0,
  accountId: 0,
  date: '2026-04-22',
  amount: 0,
  description: '',
  status: 'pending' as any,
  unifiedStatus: 'no_planificado',
  source: 'import',
  category: { tipo: '' },
};

const movement = (overrides: Partial<Movement>): Movement => ({
  ...baseMovement,
  ...overrides,
});

describe('movementSuggestionService.suggestForUnmatched', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. compromisosRecurrentes vacío ⇒ vía A devuelve [] ⇒ sigue a B (que también vacía aquí ⇒ sólo vía C)', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          amount: -45.23,
          description: 'GASTO GENERICO SIN PATRON',
        }),
      ],
      movementLearningRules: [],
      compromisosRecurrentes: [], // empty as in current production state pre-T9
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));
    (buildLearnKey as jest.Mock).mockReturnValue('hash:no-rule');

    const result = await suggestForUnmatched([1]);

    const suggestions = result.get(1)!;
    expect(suggestions).toBeDefined();
    // No vía A (empty store) and no vía B (no rule) ⇒ only vía C fallback present.
    expect(suggestions.every(s => s.via !== 'compromiso_recurrente')).toBe(true);
    expect(suggestions.every(s => s.via !== 'learning_rule')).toBe(true);
    expect(suggestions.some(s => s.via === 'heuristica')).toBe(true);
  });

  it('2. learning rule con appliedCount=5 ⇒ vía B confidence ≥ 70 ⇒ cortocircuita (sin vía C)', async () => {
    (buildLearnKey as jest.Mock).mockReturnValue('hash:bizum-fuentes');
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          amount: 380,
          description: 'BIZUM A FUENTES MES ABRIL',
        }),
      ],
      movementLearningRules: [
        {
          id: 99,
          learnKey: 'hash:bizum-fuentes',
          counterpartyPattern: 'fuentes',
          descriptionPattern: 'bizum a fuentes',
          amountSign: 'positive',
          categoria: 'contrato.alquiler',
          ambito: 'INMUEBLE',
          inmuebleId: '7',
          source: 'IMPLICIT',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
          appliedCount: 5,
        } as MovementLearningRule,
      ],
      compromisosRecurrentes: [],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await suggestForUnmatched([1]);
    const suggestions = result.get(1)!;

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].via).toBe('learning_rule');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(70);
    // sourceType must align with event type (positive amountSign ⇒ income ⇒ 'ingreso').
    expect(suggestions[0].action.kind).toBe('create_treasury_event');
    if (suggestions[0].action.kind === 'create_treasury_event') {
      expect(suggestions[0].action.type).toBe('income');
      expect(suggestions[0].action.sourceType).toBe('ingreso');
    }
    // BIZUM heuristic would have fired had vía B not short-circuited; assert it
    // is NOT in the array.
    expect(suggestions.find(s => s.via === 'heuristica')).toBeUndefined();
  });

  it('3. "RECIBO IBERDROLA CLIENTES SAU" sin learning rule ⇒ vía C suministro confidence 60', async () => {
    (buildLearnKey as jest.Mock).mockReturnValue('hash:no-rule');
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          amount: -89.4,
          description: 'RECIBO IBERDROLA CLIENTES SAU',
        }),
      ],
      movementLearningRules: [],
      compromisosRecurrentes: [],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await suggestForUnmatched([1]);
    const suggestions = result.get(1)!;

    expect(suggestions.find(s => s.via === 'learning_rule')).toBeUndefined();
    const heuristic = suggestions.find(s => s.via === 'heuristica');
    expect(heuristic).toBeDefined();
    expect(heuristic!.confidence).toBe(60);
    expect(heuristic!.action.kind).toBe('create_treasury_event');
    if (heuristic!.action.kind === 'create_treasury_event') {
      expect(heuristic!.action.ambito).toBe('INMUEBLE');
      expect(heuristic!.action.categoryKey).toBe('inmueble.suministros');
    }
  });

  it('4. "BIZUM A FUENTES" sin contratos ⇒ vía C assign_to_contract confidence 50', async () => {
    (buildLearnKey as jest.Mock).mockReturnValue('hash:no-rule');
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          amount: 380,
          description: 'BIZUM A FUENTES',
        }),
      ],
      movementLearningRules: [],
      compromisosRecurrentes: [],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await suggestForUnmatched([1]);
    const suggestions = result.get(1)!;

    const heuristic = suggestions.find(s => s.via === 'heuristica');
    expect(heuristic).toBeDefined();
    expect(heuristic!.confidence).toBe(50);
    expect(heuristic!.action.kind).toBe('assign_to_contract');
  });

  it('Regression (Copilot review #1158): vía A skips positive movements — compromisos modelan gasto, no ingreso', async () => {
    (buildLearnKey as jest.Mock).mockReturnValue('hash:no-rule');
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          amount: 89.4, // positive: would magnitude-match a 89.40€ compromiso, but compromisos are gasto-only
          description: 'INGRESO INESPERADO',
        }),
      ],
      movementLearningRules: [],
      compromisosRecurrentes: [
        {
          id: 1,
          ambito: 'inmueble',
          inmuebleId: 7,
          alias: 'Suministro luz inmueble Calle Mayor',
          tipo: 'suministro',
          subtipo: 'luz',
          proveedor: { nombre: 'Iberdrola' },
          patron: { tipo: 'mensualDiaFijo', dia: 22 },
          importe: { modo: 'fijo', importe: 89.4 },
          cuentaCargo: 42,
          conceptoBancario: 'IBERDROLA CLIENTES SA',
          metodoPago: 'domiciliacion',
          categoria: 'inmueble.suministros',
          bolsaPresupuesto: 'inmueble',
          responsable: 'titular',
          fechaInicio: '2025-01-01',
          estado: 'activo',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await suggestForUnmatched([1]);
    const suggestions = result.get(1)!;

    // Vía A must NOT emit a suggestion for a positive movement, even when
    // a same-account same-magnitude compromiso exists.
    expect(suggestions.find(s => s.via === 'compromiso_recurrente')).toBeUndefined();
  });

  it('5. learning rule con appliedCount=0 ⇒ vía B 50 (sin cortocircuito) + vía C heurística ⇒ ambas en el array', async () => {
    (buildLearnKey as jest.Mock).mockReturnValue('hash:iberdrola');
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          amount: -89.4,
          description: 'RECIBO IBERDROLA CLIENTES SAU',
        }),
      ],
      movementLearningRules: [
        {
          id: 200,
          learnKey: 'hash:iberdrola',
          counterpartyPattern: 'iberdrola',
          descriptionPattern: 'recibo iberdrola',
          amountSign: 'negative',
          categoria: 'inmueble.suministros',
          ambito: 'INMUEBLE',
          source: 'IMPLICIT',
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
          appliedCount: 0, // never applied → confidence 50, no short-circuit
        } as MovementLearningRule,
      ],
      compromisosRecurrentes: [],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await suggestForUnmatched([1]);
    const suggestions = result.get(1)!;

    const learningSuggestion = suggestions.find(s => s.via === 'learning_rule');
    expect(learningSuggestion).toBeDefined();
    expect(learningSuggestion!.confidence).toBe(50);

    const heuristicSuggestion = suggestions.find(s => s.via === 'heuristica');
    expect(heuristicSuggestion).toBeDefined();
    expect(heuristicSuggestion!.confidence).toBe(60); // suministro pattern
  });
});
