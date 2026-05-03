// ============================================================================
// ATLAS · T31 · treasuryBootstrapService tests
// ============================================================================
//
// Tests del orquestador. Las dependencias pesadas (db, generateMonthlyForecasts,
// regeneradores de vivienda y compromisos) se mockean para aislar la lógica
// de · idempotencia · rango · forward-only · gap · resiliencia.
// ============================================================================

import type { TreasuryEvent } from './db';

// ─── Mocks ──────────────────────────────────────────────────────────────────

type StoredEvent = TreasuryEvent & { id: number };

// Renombrado a `mockStore` · jest.mock permite referenciar variables que
// empiecen por `mock` desde el factory.
const mockStore: { events: StoredEvent[]; viviendas: any[] } = {
  events: [],
  viviendas: [],
};
const inMemoryStore = mockStore; // alias para no tocar el resto del fichero

let nextEventId = 1;
let generateMonthlyForecastsMock: jest.Mock;
let regenerarEventosViviendaMock: jest.Mock;
let regenerarEventosCompromisoMock: jest.Mock;
let listarCompromisosMock: jest.Mock;

// Stub IDBKeyRange en jsdom · refleja el shape mínimo que necesita el helper.
(globalThis as any).IDBKeyRange = {
  bound: (lower: string, upper: string, lowerOpen = false, upperOpen = false) => ({
    lower, upper, lowerOpen, upperOpen,
  }),
  lowerBound: (lower: string, lowerOpen = false) => ({
    lower, lowerOpen, upperOpen: false,
  }),
  upperBound: (upper: string, upperOpen = false) => ({
    upper, lowerOpen: false, upperOpen,
  }),
};

jest.mock('./db', () => {
  // Helper inline · jest.mock factory no puede referenciar variables externas
  // salvo las que empiezan por `mock`. Dejamos `inRange` como const local.
  const inRange = (value: string, range: any): boolean => {
    if (!range) return true;
    if (range.lower != null) {
      if (range.lowerOpen ? value <= range.lower : value < range.lower) return false;
    }
    if (range.upper != null) {
      if (range.upperOpen ? value >= range.upper : value > range.upper) return false;
    }
    return true;
  };
  return {
    initDB: jest.fn(async () => {
      const buildCursor = (range: any) => {
        const arr = mockStore.events.filter((e: any) =>
          inRange(e.predictedDate ?? '', range ?? null),
        );
        let i = 0;
        const makeCursor = (): any => {
          if (i >= arr.length) return null;
          const value = arr[i];
          return {
            value,
            delete: async () => {
              mockStore.events = mockStore.events.filter((e: any) => e.id !== value.id);
            },
            continue: async () => {
              i += 1;
              return makeCursor();
            },
          };
        };
        return makeCursor();
      };
      const indexStore = { openCursor: async (range?: any) => buildCursor(range) };
      const txStore = {
        openCursor: async () => buildCursor(undefined),
        index: (_name: string) => indexStore,
      };
      return {
        getAll: async (storeName: string) => {
          if (storeName === 'treasuryEvents') return mockStore.events.slice();
          if (storeName === 'viviendaHabitual') return mockStore.viviendas.slice();
          return [];
        },
        transaction: (_storeName: string, _mode: string) => ({
          objectStore: () => txStore,
          done: Promise.resolve(),
        }),
      };
    }),
  };
});

jest.mock('../modules/horizon/tesoreria/services/treasurySyncService', () => ({
  generateMonthlyForecasts: jest.fn(),
}));

jest.mock('./personal/viviendaHabitualService', () => ({
  regenerarEventosVivienda: jest.fn(),
}));

jest.mock('./personal/compromisosRecurrentesService', () => ({
  listarCompromisos: jest.fn(),
  regenerarEventosCompromiso: jest.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function seedEvent(partial: Partial<TreasuryEvent>): StoredEvent {
  const ev = {
    id: nextEventId++,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-05-15',
    description: 'seed',
    sourceType: 'manual',
    status: 'predicted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  } as StoredEvent;
  inMemoryStore.events.push(ev);
  return ev;
}

function resetStore(): void {
  inMemoryStore.events = [];
  inMemoryStore.viviendas = [];
  nextEventId = 1;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  jest.resetModules();

  const sync = jest.requireMock('../modules/horizon/tesoreria/services/treasurySyncService');
  const vivienda = jest.requireMock('./personal/viviendaHabitualService');
  const compromisos = jest.requireMock('./personal/compromisosRecurrentesService');

  generateMonthlyForecastsMock = sync.generateMonthlyForecasts as jest.Mock;
  regenerarEventosViviendaMock = vivienda.regenerarEventosVivienda as jest.Mock;
  regenerarEventosCompromisoMock = compromisos.regenerarEventosCompromiso as jest.Mock;
  listarCompromisosMock = compromisos.listarCompromisos as jest.Mock;

  generateMonthlyForecastsMock.mockReset();
  regenerarEventosViviendaMock.mockReset();
  regenerarEventosCompromisoMock.mockReset();
  listarCompromisosMock.mockReset();

  generateMonthlyForecastsMock.mockResolvedValue({ created: 0, skipped: 0, updated: 0 });
  regenerarEventosViviendaMock.mockResolvedValue(0);
  regenerarEventosCompromisoMock.mockResolvedValue(0);
  listarCompromisosMock.mockResolvedValue([]);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('treasuryBootstrapService · regenerateForecastsForward', () => {
  it('procesa exactamente 24 meses por defecto desde primer día del mes en curso', async () => {
    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    generateMonthlyForecastsMock.mockResolvedValue({ created: 1, skipped: 0, updated: 0 });

    const result = await regenerateForecastsForward();

    expect(result.mesesProcesados).toBe(24);
    expect(generateMonthlyForecastsMock).toHaveBeenCalledTimes(24);

    const today = new Date();
    const firstYear = today.getUTCFullYear();
    const firstMonth = today.getUTCMonth() + 1;
    const firstCall = generateMonthlyForecastsMock.mock.calls[0];
    expect(firstCall[0]).toBe(firstYear);
    expect(firstCall[1]).toBe(firstMonth);

    // desde es el primer día del mes en curso (UTC)
    expect(result.desde).toBe(
      `${firstYear}-${String(firstMonth).padStart(2, '0')}-01`,
    );
    // hasta es el primer día del mes (en curso + 24)
    const hastaDate = new Date(Date.UTC(firstYear, today.getUTCMonth() + 24, 1));
    expect(result.hasta).toBe(hastaDate.toISOString().substring(0, 10));
  });

  it('respeta el horizonteMeses personalizado', async () => {
    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    const result = await regenerateForecastsForward({ horizonteMeses: 6 });
    expect(result.mesesProcesados).toBe(6);
    expect(generateMonthlyForecastsMock).toHaveBeenCalledTimes(6);
  });

  it('es idempotente · una segunda invocación no añade eventos cuando los generadores devuelven 0', async () => {
    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    generateMonthlyForecastsMock.mockResolvedValue({ created: 0, skipped: 5, updated: 0 });

    const r1 = await regenerateForecastsForward({ horizonteMeses: 3 });
    const r2 = await regenerateForecastsForward({ horizonteMeses: 3 });

    expect(r1.eventosCreados).toBe(0);
    expect(r2.eventosCreados).toBe(0);
    // ambos resultados deben tener los mismos contadores
    expect(r2.eventosOmitidos).toBe(r1.eventosOmitidos);
  });

  it('purga predicted retroactivos y wipea predicted forward REGENERABLES · solo confirmed/executed/manual sobreviven', async () => {
    const today = new Date();
    const inicioMes = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const inicioIso = inicioMes.toISOString().substring(0, 10);

    // Predicted antiguo regenerable · purgado por defensa final (sourceType
    // no importa para la purga retroactiva · es estricta).
    seedEvent({ predictedDate: '2024-01-15', status: 'predicted', sourceType: 'nomina' });
    // Confirmed antiguo · NO debe borrarse
    seedEvent({ predictedDate: '2024-02-15', status: 'confirmed', sourceType: 'nomina' });
    // Executed antiguo · NO debe borrarse
    seedEvent({ predictedDate: '2024-03-15', status: 'executed' as any, sourceType: 'nomina' });
    // Predicted huérfano regenerable dentro del horizonte · debe borrarlo el
    // wipe inicial (mocks no recrean nada).
    seedEvent({ predictedDate: inicioIso, status: 'predicted', sourceType: 'prestamo' });

    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    await regenerateForecastsForward({ horizonteMeses: 1 });

    const restantes = inMemoryStore.events.map((e) => ({
      date: e.predictedDate,
      status: e.status,
      src: e.sourceType,
    }));
    // Solo sobreviven el confirmed y el executed antiguos
    expect(restantes).toEqual(
      expect.arrayContaining([
        { date: '2024-02-15', status: 'confirmed', src: 'nomina' },
        { date: '2024-03-15', status: 'executed', src: 'nomina' },
      ]),
    );
    // Predicted retroactivo · purgado
    expect(restantes.find((e) => e.date === '2024-01-15')).toBeUndefined();
    // Predicted huérfano regenerable del horizonte · wipeado
    expect(
      restantes.find(
        (e) => e.date === inicioIso && e.status === 'predicted' && e.src === 'prestamo',
      ),
    ).toBeUndefined();
  });

  it('wipe inicial NO toca confirmed/executed dentro del horizonte', async () => {
    const today = new Date();
    const inicioMes = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const inicioIso = inicioMes.toISOString().substring(0, 10);

    // Confirmed dentro del horizonte · debe sobrevivir
    seedEvent({ predictedDate: inicioIso, status: 'confirmed', sourceType: 'nomina' });
    // Executed dentro del horizonte · debe sobrevivir
    seedEvent({ predictedDate: inicioIso, status: 'executed' as any, sourceType: 'nomina' });
    // Predicted regenerable dentro del horizonte · debe ser wipeado
    seedEvent({ predictedDate: inicioIso, status: 'predicted', sourceType: 'nomina' });

    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    await regenerateForecastsForward({ horizonteMeses: 1 });

    const statuses = inMemoryStore.events.map((e) => e.status);
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('executed');
    expect(statuses).not.toContain('predicted');
  });

  it('wipe inicial NO toca predicted MANUAL del usuario (sourceType: manual)', async () => {
    const today = new Date();
    const inicioMes = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const inicioIso = inicioMes.toISOString().substring(0, 10);

    // Movimiento previsto manual del usuario (TesoreriaV4 / drawer "Añadir
    // movimiento") · NUNCA debe borrarse · no es regenerable.
    seedEvent({
      predictedDate: inicioIso,
      status: 'predicted',
      sourceType: 'manual',
      description: 'Transferencia prevista a Bizum',
    });
    // Predicted regenerable · sí debe wipearse
    seedEvent({
      predictedDate: inicioIso,
      status: 'predicted',
      sourceType: 'gasto_recurrente',
    });

    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    await regenerateForecastsForward({ horizonteMeses: 1 });

    const restantes = inMemoryStore.events.map((e) => e.sourceType);
    expect(restantes).toContain('manual'); // sobrevive
    expect(restantes).not.toContain('gasto_recurrente'); // wipeado
  });

  it('wipe inicial NO toca predicted más allá del horizonte (>= hasta)', async () => {
    const today = new Date();
    const inicioMes = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    // 25 meses adelante = más allá del horizonte de 24
    const masAllaDate = new Date(Date.UTC(inicioMes.getUTCFullYear(), inicioMes.getUTCMonth() + 25, 15));
    const masAllaIso = masAllaDate.toISOString().substring(0, 10);

    // Predicted regenerable PERO más allá del horizonte · NO debe borrarse
    seedEvent({
      predictedDate: masAllaIso,
      status: 'predicted',
      sourceType: 'nomina',
    });

    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    await regenerateForecastsForward({ horizonteMeses: 24 });

    const restantes = inMemoryStore.events.map((e) => e.predictedDate);
    expect(restantes).toContain(masAllaIso);
  });

  it('un fallo en una fuente NO aborta el bucle · acumula error y sigue', async () => {
    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    generateMonthlyForecastsMock
      .mockResolvedValueOnce({ created: 1, skipped: 0, updated: 0 })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ created: 1, skipped: 0, updated: 0 });

    const result = await regenerateForecastsForward({ horizonteMeses: 3 });

    expect(generateMonthlyForecastsMock).toHaveBeenCalledTimes(3);
    expect(result.errores.length).toBeGreaterThan(0);
    expect(result.errores[0].mensaje).toContain('boom');
    // Los meses 1 y 3 deben haberse contabilizado
    expect(result.mesesProcesados).toBe(2);
    expect(result.eventosCreados).toBe(2);
  });

  it('procesa viviendas activas y compromisos activos', async () => {
    inMemoryStore.viviendas.push({ id: 1, activa: true });
    inMemoryStore.viviendas.push({ id: 2, activa: false }); // ignorada
    listarCompromisosMock.mockResolvedValue([
      { id: 10, estado: 'activo' },
      { id: 11, estado: 'activo' },
    ]);
    regenerarEventosViviendaMock.mockResolvedValue(3);
    regenerarEventosCompromisoMock.mockResolvedValue(2);

    const { regenerateForecastsForward } = await import('./treasuryBootstrapService');
    const result = await regenerateForecastsForward({ horizonteMeses: 1 });

    expect(regenerarEventosViviendaMock).toHaveBeenCalledTimes(1);
    expect(regenerarEventosCompromisoMock).toHaveBeenCalledTimes(2);
    // 3 (vivienda) + 2*2 (compromisos)
    expect(result.eventosCreados).toBe(3 + 4);
  });
});

describe('treasuryBootstrapService · necesitaRegenerar', () => {
  it('devuelve true cuando no hay ningún evento predicted', async () => {
    const { necesitaRegenerar } = await import('./treasuryBootstrapService');
    const necesita = await necesitaRegenerar(24);
    expect(necesita).toBe(true);
  });

  it('devuelve false cuando hay predicted que cubren el horizonte', async () => {
    const today = new Date();
    const horizonte = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 24, 1),
    );
    const horizonteIso = horizonte.toISOString().substring(0, 10);
    seedEvent({ predictedDate: horizonteIso, status: 'predicted' });

    const { necesitaRegenerar } = await import('./treasuryBootstrapService');
    const necesita = await necesitaRegenerar(24);
    expect(necesita).toBe(false);
  });

  it('devuelve true cuando el predicted más lejano queda muy por debajo del horizonte', async () => {
    seedEvent({ predictedDate: '2026-05-01', status: 'predicted' });
    const { necesitaRegenerar } = await import('./treasuryBootstrapService');
    const necesita = await necesitaRegenerar(24);
    expect(necesita).toBe(true);
  });
});
