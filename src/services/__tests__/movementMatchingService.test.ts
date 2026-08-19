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

  it('2. Un ALQUILER exacto en la misma cuenta y fecha cercana cuadra aunque el pagador venga con otro texto', async () => {
    // La renta llega por transferencia uno o dos días después y con el nombre que
    // manda el banco distinto al del contrato, pero el concepto dice "alquiler".
    // Antes se iba a "resolver"; ahora, si es ÚNICO, cuadra. Un ingreso del mismo
    // importe SIN la palabra alquiler (un Bizum de otra persona) no se cuelga.
    const alquilerStores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-04-23',
          amount: 380,
          description: 'TRANSFERENCIA CONCEPTO ALQUILER ABRIL',
        }),
      ],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'income', amount: 380, predictedDate: '2026-04-22' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(alquilerStores));

    const alquilerResult = await matchBatch([1]);
    // 20 (fecha_dia_adyacente) + 30 (importe_exacto) + 15 (cuenta_match) + 25
    // (importe_exacto_alquiler_misma_cuenta) = 90 ≥ 70 · cuadra.
    expect(alquilerResult.matches).toHaveLength(1);
    expect(alquilerResult.matches[0].treasuryEventId).toBe(100);
    expect(alquilerResult.matches[0].reasons).toEqual(
      expect.arrayContaining(['importe_exacto_alquiler_misma_cuenta']),
    );

    // Sin la palabra alquiler y sin proveedor · se va a resolver (no se adivina).
    const sinPalabraStores: FakeStores = {
      movements: [movement({ id: 1, accountId: 42, date: '2026-04-23', amount: 380, description: 'CONCEPTO GENERICO' })],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'income', amount: 380, predictedDate: '2026-04-22' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(sinPalabraStores));
    expect((await matchBatch([1])).sinMatch).toEqual([1]);

    // Con la palabra pero LEJOS de la ventana (±5 días) tampoco · un ingreso
    // suelto lejano del mismo importe no consume la renta.
    const lejosStores: FakeStores = {
      movements: [movement({ id: 1, accountId: 42, date: '2026-04-30', amount: 380, description: 'ALQUILER' })],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'income', amount: 380, predictedDate: '2026-04-22' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(lejosStores));
    expect((await matchBatch([1])).sinMatch).toEqual([1]);

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
    // Con proveedor suma además descripcion_proveedor · cuadra de sobra.
    expect(withProviderResult.matches).toHaveLength(1);
    expect(withProviderResult.matches[0].score).toBeGreaterThanOrEqual(90);
  });

  it('2b. Dos rentas del MISMO importe · una línea sola va a multiMatch, no a un cuadre a ciegas', async () => {
    // Si hay dos previstos de ingreso del mismo importe y el pagador no desempata,
    // la línea NO se asigna a ciegas: se ofrece elegir (multiMatch).
    const stores: FakeStores = {
      movements: [
        movement({ id: 1, accountId: 42, date: '2026-04-23', amount: 395, description: 'TRANSFERENCIA ALQUILER' }),
      ],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'income', amount: 395, predictedDate: '2026-04-22', providerName: 'Inquilino A' }),
        event({ id: 101, accountId: 42, type: 'income', amount: 395, predictedDate: '2026-04-24', providerName: 'Inquilino B' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);
    expect(result.matches).toEqual([]);
    expect(result.multiMatches).toHaveLength(1);
    expect(result.multiMatches[0].candidates.map(c => c.treasuryEventId).sort()).toEqual([100, 101]);
  });

  it('2d. Seis habitaciones de 395 · la que trae el nombre del inquilino cuadra SOLA (ganador claro)', async () => {
    // El caso real de Jose: 6 rentas iguales de 395. La línea trae el nombre del
    // inquilino y solo UNA previsión lo casa (+25). Ese margen la hace cuadrar
    // sola, sin pedir elegir entre seis idénticas. El empujón del alquiler sube
    // las seis por encima del umbral, pero el nombre desempata.
    const stores: FakeStores = {
      movements: [
        movement({ id: 1, accountId: 42, date: '2026-04-23', amount: 395, description: 'TRANSFERENCIA DE MIGUEL LORENZO ALQUILER' }),
      ],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'income', amount: 395, predictedDate: '2026-04-22', providerName: 'Miguel Lorenzo' }),
        event({ id: 101, accountId: 42, type: 'income', amount: 395, predictedDate: '2026-04-22', providerName: 'Otro Uno' }),
        event({ id: 102, accountId: 42, type: 'income', amount: 395, predictedDate: '2026-04-24', providerName: 'Otro Dos' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);
    expect(result.multiMatches).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].treasuryEventId).toBe(100);
  });

  it('2c. Un recibo recurrente cuadra con la mensualidad más cercana, no multiMatch', async () => {
    // El caso real del usuario: la previsión mensual del recibo cae lejos de ±5
    // días del cargo, y hay varias mensualidades. Con la ventana ancha + colapso
    // de serie, cuadra SOLO con la de su mes, no se va a "elegir".
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 42,
          date: '2026-08-02',
          amount: -48,
          description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION GAS 105',
        }),
      ],
      treasuryEvents: [
        event({ id: 100, accountId: 42, type: 'expense', amount: 48, predictedDate: '2026-08-01', providerName: 'Curenergía' }),
        event({ id: 101, accountId: 42, type: 'expense', amount: 48, predictedDate: '2026-09-01', providerName: 'Curenergía' }),
        event({ id: 102, accountId: 42, type: 'expense', amount: 48, predictedDate: '2026-10-01', providerName: 'Curenergía' }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);
    expect(result.multiMatches).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].treasuryEventId).toBe(100); // la de agosto, la más cercana
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
        // Dos SERIES distintas del mismo importe (dos inquilinos de 500) · el
        // usuario tiene que decidir cuál es. Si fueran la misma serie —mismo
        // proveedor— se colapsarían en una.
        event({
          id: 100,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Norte',
        }),
        event({
          id: 101,
          accountId: 42,
          type: 'income',
          amount: 500,
          predictedDate: '2026-04-22',
          providerName: 'Inquilino Sur',
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

  it('6. una previsión demasiado lejos en fecha queda fuera de la ventana', async () => {
    // El importe exacto ensancha la ventana a un mes (para el recibo que se carga
    // con desfase), pero no más: a casi dos meses ya no se considera.
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
          predictedDate: '2026-06-20', // ~59 días · fuera hasta de la ventana de importe exacto
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

  // Un recibo domiciliado VARIABLE (gas: previsto 30 €, real 13,38 €) cuyo día no
  // clava (cargo un día después de lo previsto) debe cuadrar con su previsión:
  // así se consume y deja de descontar el previsto del saldo. Sin el empujón de
  // recurrente quedaba en 60 (fecha_adyacente 20 + cuenta 15 + proveedor 25).
  it('12. Un recibo recurrente variable cuadra aunque el importe difiera y el día resbale', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 9,
          date: '2026-08-03', // el previsto era el 2 · resbala un día
          amount: -13.38, // real muy distinto del previsto (30)
          description: 'RECIBO NATURGY IBERIA S.A.',
        }),
      ],
      treasuryEvents: [
        event({
          id: 200,
          accountId: 9,
          type: 'expense',
          amount: -30, // previsto
          predictedDate: '2026-08-02',
          providerName: 'Naturgy',
          sourceType: 'gasto_recurrente',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.sinMatch).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].treasuryEventId).toBe(200);
    expect(result.matches[0].reasons).toEqual(
      expect.arrayContaining(['recibo_recurrente_misma_cuenta']),
    );
  });

  // El empujón de recurrente NO inventa emparejamientos: sin proveedor ni importe
  // reconocibles (solo cuenta + fecha + recurrente = 55) se queda sin match.
  it('13. El recibo recurrente no casa solo con cuenta y fecha si nada más coincide', async () => {
    const stores: FakeStores = {
      movements: [
        movement({
          id: 1,
          accountId: 9,
          date: '2026-08-02',
          amount: -13.38,
          description: 'ADEUDO SEPA 4471X', // no delata al proveedor
        }),
      ],
      treasuryEvents: [
        event({
          id: 200,
          accountId: 9,
          type: 'expense',
          amount: -30,
          predictedDate: '2026-08-02',
          providerName: 'Naturgy',
          sourceType: 'gasto_recurrente',
        }),
      ],
    };
    (initDB as jest.Mock).mockResolvedValue(buildDb(stores));

    const result = await matchBatch([1]);

    expect(result.matches).toEqual([]);
    expect(result.sinMatch).toEqual([1]);
  });
});
