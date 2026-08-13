// TAREA 17 sub-task 17.2 · Tests for movementMatchingService.
//
// Covers the 6 obligatory cases in spec §3.1:
//   1. Same-day, same-account, same-amount, contract event → high-score match
//   2. One-day-adjacent date difference → 65 (no provider) or 90 (with provider)
//   3. One movement vs two passing events → multiMatches[]
//   4. Two movements compete for one event → higher score wins, the loser
//      drops to sinMatch[]
//   5. Events in non-'predicted' status are ignored as candidates
//   6. fechaWindowDays boundary excludes events outside the window
import { matchBatch } from '../movementMatchingService';
import { initDB, Movement, MovementLearningRule, TreasuryEvent } from '../db';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

interface FakeStores {
  movements: Movement[];
  treasuryEvents: TreasuryEvent[];
  movementLearningRules?: MovementLearningRule[];
}

function buildDb(stores: FakeStores) {
  const lookup = (storeName: keyof FakeStores) => stores[storeName] ?? [];
  return {
    get: jest.fn(async (storeName: keyof FakeStores, key: number) => {
      return lookup(storeName).find((row: any) => row.id === key);
    }),
    getAll: jest.fn(async (storeName: keyof FakeStores) => lookup(storeName)),
    getAllFromIndex: jest.fn(
      async (storeName: keyof FakeStores, _index: string, value: number) => {
        if (storeName !== 'treasuryEvents') return [];
        return stores.treasuryEvents.filter(e => e.accountId === value);
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

const baseEvent: TreasuryEvent = {
  id: 0,
  type: 'income',
  amount: 0,
  predictedDate: '2026-04-22',
  description: '',
  sourceType: 'contract',
  status: 'predicted',
  accountId: 0,
};

const movement = (overrides: Partial<Movement>): Movement => ({
  ...baseMovement,
  ...overrides,
});

const event = (overrides: Partial<TreasuryEvent>): TreasuryEvent => ({
  ...baseEvent,
  ...overrides,
});

describe('movementMatchingService.matchBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Same date + amount + account + contract event ⇒ score ≥ 90 ⇒ matches[]', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 380,
          description: 'TRANSFERENCIA RECIBIDA INQUILINO PEREZ',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
          sourceType: 'contract',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.sinMatch).toEqual([]);
    expect(result.multiMatches).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].movementId).toBe(1);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.matches[0].score).toBeGreaterThanOrEqual(90);
    expect(result.matches[0].reasons).toEqual(
      expect.arrayContaining([
        'fecha_exacta',
        'importe_exacto',
        'cuenta_match',
        'descripcion_proveedor',
      ]),
    );
  });

  it('2. Un INGRESO sin proveedor no cuadra solo por importe · quién paga manda', async () => {
    // En ingresos, el importe a secas no basta: un cargo del mismo importe de un
    // desconocido no es la renta del inquilino. Sin proveedor/alias se va a
    // resolver; con proveedor cuadra.
    const noProviderStores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-23',
          amount: 380,
          description: 'CONCEPTO GENERICO SIN PROVEEDOR',
        }),
      ],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'income', amount: 380, predictedDate: '2026-04-22' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(noProviderStores));

    const noProviderResult = await matchBatch([1]);
    // 20 (fecha_dia_adyacente) + 30 (importe_exacto) + 15 (cuenta_match) = 65 < 70.
    // El bonus de importe-exacto-misma-cuenta NO aplica a ingresos.
    expect(noProviderResult.sinMatch).toEqual([1]);
    expect(noProviderResult.matches).toEqual([]);

    const withProviderStores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-23',
          amount: 380,
          description: 'TRANSFERENCIA INQUILINO PEREZ ABRIL',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(withProviderStores));

    const withProviderResult = await matchBatch([1]);
    // 65 (above) + 25 (descripcion_proveedor) = 90
    expect(withProviderResult.matches).toHaveLength(1);
    expect(withProviderResult.matches[0].score).toBe(90);
  });

  it('2b. Un GASTO del importe exacto cuadra aunque el día no pegue y sin proveedor', async () => {
    // El caso real del "0 de 27": un recibo domiciliado (luz/gas) llega un par
    // de días tarde, con el importe clavado, y el texto del banco no es el
    // proveedor de la previsión. Debe cuadrar solo.
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-08-03',
          amount: -48,
          description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION GAS 105',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'expense',
          amount: 48,
          predictedDate: '2026-08-01',
          providerName: 'Curenergía',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);
    // 10 (fecha_proxima ≤3) + 30 (importe_exacto) + 15 (cuenta) + 25 (bonus) = 80.
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.matches[0].reasons).toEqual(
      expect.arrayContaining(['importe_exacto', 'importe_exacto_misma_cuenta']),
    );
    expect(result.sinMatch).toEqual([]);
  });

  it('3. One movement vs two passing events ⇒ multiMatches[]', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 500,
          description: 'TRANSFERENCIA RENTA ABRIL',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
        }),
        event({
          id: 101,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([]);
    expect(result.multiMatches).toHaveLength(1);
    expect(result.multiMatches[0].movementId).toBe(1);
    expect(result.multiMatches[0].candidates).toHaveLength(2);
    const eventIds = result.multiMatches[0].candidates.map(c => c.treasuryEventId).sort();
    expect(eventIds).toEqual([100, 101]);
    for (const candidate of result.multiMatches[0].candidates) {
      // 30 (fecha_exacta) + 30 (importe_exacto) + 15 (cuenta_match) = 75
      expect(candidate.score).toBeGreaterThanOrEqual(70);
    }
  });

  it('4. Two movements compete for one event ⇒ higher score wins, loser → sinMatch[]', async () => {
    const stores: FakeStores = {
      movements: [
        // Loser: same amount and account, no provider in description.
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 500,
          description: 'TRANSFERENCIA SIN PROVEEDOR',
        }),
        // Winner: provider explicitly named in description ⇒ +25.
        movement({
          id: 2,
          accountId: 42,
          date: '2026-04-22',
          amount: 500,
          description: 'TRANSFERENCIA INQUILINO PEREZ MES ABRIL',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1, 2]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].movementId).toBe(2);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.sinMatch).toEqual([1]);
    expect(result.multiMatches).toEqual([]);
  });

  it('5. Events with status !== "predicted" are silently ignored', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 380,
          description: 'TRANSFERENCIA INQUILINO PEREZ',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
          status: 'confirmed', // already confirmed → not a candidate
        }),
        event({
          id: 101,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Perez',
          status: 'executed', // already matched to another movement → not a candidate
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.multiMatches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });

  it('6. fechaWindowDays excludes events outside the window', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-22',
          amount: 380,
          description: 'TRANSFERENCIA INQUILINO PEREZ',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 380,
          predictedDate: '2026-04-30', // 8 days away
          providerName: 'Inquilino Perez',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1], { fechaWindowDays: 5 });

    expect(result.matches).toEqual([]);
    expect(result.multiMatches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });

  // ==========================================================================
  // Bizum · el nombre del banco no es el nombre del contrato
  // ==========================================================================
  //
  // El inquilino paga la renta por Bizum unos días después de la previsión. Sin
  // leer el nombre, esa línea se queda en 55 puntos —fecha próxima 10 + importe
  // 30 + cuenta 15— y ni siquiera se PROPONE. Con el nombre, llega a 80.

  const bizumDeAdnan = (): FakeStores => ({
    movements: [
      movement({
        id: 1,
        accountId: 42,
        date: '2026-04-03',
        amount: 380,
        description: 'BIZUM DE ADNAN PARWEZ CONCEPTO: ALQUILER ABRIL',
        paymentMethod: 'Bizum',
      }),
    ],
    treasuryEvents: [
      event({
        id: 100,
        accountId: 42,
        type: 'income',
        amount: 380,
        predictedDate: '2026-04-01',
        description: 'Renta 2026-04 · Adnan Parwez Khan',
        counterparty: 'Adnan Parwez Khan',
      }),
    ],
  });

  it('7. Bizum cuyo nombre no cuadra exacto ⇒ se propone la renta del inquilino', async () => {
    (initDB as jest.Mock).mockResolvedValue(buildDb(bizumDeAdnan()));

    const result = await matchBatch([1]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.matches[0].reasons).toContain('bizum_contraparte');
    expect(result.sinMatch).toEqual([]);
  });

  it('7b. El mismo Bizum sin el nombre del inquilino se queda sin propuesta', async () => {
    const stores = bizumDeAdnan();
    stores.movements[0].description = 'BIZUM RECIBIDO 00218832';
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });

  it('8. Bizum de otra persona ⇒ no se cuelga de esa renta', async () => {
    const stores = bizumDeAdnan();
    stores.movements[0].description = 'BIZUM DE LAURA SANCHEZ';
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });

  // Sólo el nombre de pila señala a varias personas: salen las dos y decide el
  // usuario, que es exactamente lo que hace "a resolver".
  it('9. Bizum que sólo trae el nombre de pila ⇒ candidatas, no conclusión', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-02',
          amount: 380,
          description: 'BIZUM DE MARIA',
          paymentMethod: 'Bizum',
        }),
      ],
      treasuryEvents: [
        event({
          id: 100,
          accountId: 42,
          amount: 380,
          predictedDate: '2026-04-01',
          counterparty: 'Maria Lopez',
        }),
        event({
          id: 101,
          accountId: 42,
          amount: 380,
          predictedDate: '2026-04-01',
          counterparty: 'Maria Ferrer',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.multiMatches).toHaveLength(1);
    expect(result.multiMatches[0].candidates.map((c) => c.treasuryEventId).sort()).toEqual([
      100, 101,
    ]);
  });

  // ==========================================================================
  // El alias aprendido · lo que el usuario enseñó una vez
  // ==========================================================================
  //
  // "MPARWEZ" no se parece a "Adnan Parwez Khan" por ninguna heurística: no
  // comparten ni una palabra. Pero si el usuario ya confirmó una vez que eran
  // el mismo, eso es un dato y manda sobre cualquier conjetura.

  const regla = (alias: string, canonica: string): MovementLearningRule =>
    ({
      id: 1,
      learnKey: 'k1',
      counterpartyPattern: '',
      descriptionPattern: '',
      amountSign: 'positive',
      categoria: 'Alquiler',
      ambito: 'INMUEBLE',
      source: 'IMPLICIT',
      createdAt: '2026-03-03',
      updatedAt: '2026-03-03',
      appliedCount: 1,
      // Se guardan tal cual los escribió el banco y el contrato · normalizar es
      // cosa de la lectura.
      aliasContraparte: alias,
      contraparteCanonica: canonica,
    }) as MovementLearningRule;

  const bizumDeMparwez = (): FakeStores => ({
    movements: [
      movement({
        id: 1,
        accountId: 42,
        date: '2026-04-03',
        amount: 380,
        description: 'BIZUM DE MPARWEZ',
        counterparty: 'MPARWEZ',
        paymentMethod: 'Bizum',
      }),
    ],
    treasuryEvents: [
      event({
        id: 100,
        accountId: 42,
        type: 'income',
        amount: 380,
        predictedDate: '2026-04-01',
        counterparty: 'Adnan Parwez Khan',
      }),
    ],
  });

  it('10. Un nombre que no se parece a nada casa si ya se enseñó', async () => {
    const stores = bizumDeMparwez();
    stores.movementLearningRules = [regla('MPARWEZ', 'Adnan Parwez Khan')];
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].treasuryEventId).toBe(100);
    expect(result.matches[0].reasons).toContain('alias_aprendido');
  });

  it('10b. El mismo movimiento sin nada aprendido se queda sin propuesta', async () => {
    (initDB as jest.Mock).mockResolvedValue(buildDb(bizumDeMparwez()));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });

  // Lo aprendido vale para ESA persona, no para cualquiera.
  it('11. Un alias aprendido de otro no arrastra a este', async () => {
    const stores = bizumDeMparwez();
    stores.movementLearningRules = [regla('MPARWEZ', 'Laura Sanchez')];
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });
});
