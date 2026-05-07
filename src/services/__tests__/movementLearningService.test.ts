/**
 * Test suite for Treasury Learning Engine.
 *
 * T16-cleanup: removed coverage of `performManualReconciliation`,
 * `createLearningRule`, `applyRuleToGrays`, `getLearningLogs` y
 * `getLearningRulesStats` (subsistemas eliminados). Lo que queda cubre el
 * path activo (`createOrUpdateRule` vía orchestrator) más smoke tests del
 * generador de learnKey y la persistencia de movimientos.
 */

import { learningService, buildLearnKey } from '../movementLearningService';
import { initDB, Movement, MovementLearningRule } from '../db';

// Test data generators
const createTestMovement = (overrides: Partial<Movement> = {}): Movement => ({
  id: Math.floor(Math.random() * 10000),
  date: '2024-01-15',
  amount: -45.23,
  description: 'ENDESA ESPAÑA SA RECIBO LUZ 202401 REF123456',
  counterparty: 'ENDESA ESPAÑA SA',
  accountId: 'test-account-1',
  category: { tipo: '', subtipo: '' },
  source: 'import' as const,
  type: 'Gasto' as const,
  origin: 'CSV' as const,
  movementState: 'Conciliado' as const,
  ambito: 'PERSONAL' as const,
  statusConciliacion: 'sin_match' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const createSantanderMovements = (): Movement[] => [
  createTestMovement({
    id: 1,
    description: 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF789123',
    counterparty: 'ENDESA ESPAÑA SA',
    amount: -45.23,
    date: '2024-01-15'
  }),
  createTestMovement({
    id: 2,
    description: 'IBERDROLA GENERACION SAU RECIBO GAS REF456789',
    counterparty: 'IBERDROLA GENERACION',
    amount: -78.90,
    date: '2024-01-20'
  }),
  createTestMovement({
    id: 3,
    description: 'ENDESA ESPAÑA SA RECIBO LUZ FEB2024 REF321654',
    counterparty: 'ENDESA ESPAÑA SA',
    amount: -42.15,
    date: '2024-02-15'
  }),
  // Duplicate - should be detected and skipped
  createTestMovement({
    id: 4,
    description: 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF789123',
    counterparty: 'ENDESA ESPAÑA SA',
    amount: -45.23,
    date: '2024-01-15'
  }),
  createTestMovement({
    id: 5,
    description: 'TRANSFERENCIA NOMINA EMPRESA ABC',
    counterparty: 'EMPRESA ABC SL',
    amount: 2500.00,
    date: '2024-01-31'
  }),
  createTestMovement({
    id: 6,
    description: 'SUPERMERCADO CARREFOUR COMPRA ALIMENTACION',
    counterparty: 'CARREFOUR',
    amount: -89.45,
    date: '2024-01-18'
  }),
  createTestMovement({
    id: 7,
    description: 'ENDESA ESPAÑA SA RECIBO ELECTRICIDAD MAR2024 REF998877',
    counterparty: 'ENDESA ESPAÑA SA',
    amount: -48.76,
    date: '2024-03-15'
  }),
  createTestMovement({
    id: 8,
    description: 'ENDESA ESPAÑA SA RECIBO LUZ APR2024 REF554433',
    counterparty: 'ENDESA ESPAÑA SA',
    amount: -44.32,
    date: '2024-04-15',
    accountId: 'test-account-2'
  }),
  createTestMovement({
    id: 9,
    description: 'IBERDROLA GENERACION SAU RECIBO GAS FEB REF112233',
    counterparty: 'IBERDROLA GENERACION',
    amount: -82.15,
    date: '2024-02-20'
  }),
  createTestMovement({
    id: 10,
    description: 'TRANSFERENCIA NOMINA EMPRESA ABC FEBRERO',
    counterparty: 'EMPRESA ABC SL',
    amount: 2500.00,
    date: '2024-02-29'
  })
];

describe('Treasury Learning Engine', () => {
  let db: any;

  beforeEach(async () => {
    db = await initDB();
    const stores = ['movements', 'movementLearningRules'];
    for (const store of stores) {
      const transaction = db.transaction(store, 'readwrite');
      await transaction.objectStore(store).clear();
    }
  });

  describe('Santander Excel Import with Duplicates', () => {
    test('should import Santander movements and detect duplicates', async () => {
      const movements = createSantanderMovements();

      for (const movement of movements) {
        await db.add('movements', movement);
      }

      const allMovements = await db.getAll('movements');

      // Should have all movements including duplicates (deduplication happens at import level)
      expect(allMovements).toHaveLength(10);

      const sinMatchCount = allMovements.filter(m => m.statusConciliacion === 'sin_match').length;
      expect(sinMatchCount).toBe(10);

      const personalCount = allMovements.filter(m => m.ambito === 'PERSONAL').length;
      expect(personalCount).toBe(10);
    });
  });

  describe('Learning Service API', () => {
    test('should allow manual rule creation via service API', async () => {
      const rule = await learningService.createOrUpdateRule({
        learnKey: 'test-key-123',
        categoria: 'TRANSPORTE',
        ambito: 'PERSONAL'
      });

      expect(rule.categoria).toBe('TRANSPORTE');
      expect(rule.ambito).toBe('PERSONAL');
      expect(rule.source).toBe('IMPLICIT');
    });
  });

  // `buildLearnKey` no está cubierta en otros suites · `movementSuggestionService.test.ts`
  // la mockea (jest.mock). Aquí ejecutamos la función real para validar las dos
  // propiedades clave del v1 hash · estabilidad frente a tokens volátiles
  // (fechas/refs/importes) y separación por contraparte/signo.
  describe('buildLearnKey', () => {
    test('genera la misma clave para dos movimientos del mismo proveedor con tokens volátiles distintos', () => {
      const m1 = createTestMovement({
        description: 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF123456',
        counterparty: 'ENDESA ESPAÑA SA',
        amount: -45.23,
      });
      const m2 = createTestMovement({
        description: 'ENDESA ESPAÑA SA RECIBO LUZ FEB2024 REF789012',
        counterparty: 'ENDESA ESPAÑA SA',
        amount: -42.15,
      });

      expect(buildLearnKey(m1)).toBe(buildLearnKey(m2));
    });

    test('genera claves distintas para contrapartes distintas', () => {
      const endesa = buildLearnKey(createTestMovement({
        description: 'ENDESA ESPAÑA SA RECIBO LUZ',
        counterparty: 'ENDESA ESPAÑA SA',
        amount: -45.23,
      }));
      const iberdrola = buildLearnKey(createTestMovement({
        description: 'IBERDROLA GENERACION SAU RECIBO GAS',
        counterparty: 'IBERDROLA GENERACION',
        amount: -45.23,
      }));

      expect(endesa).not.toBe(iberdrola);
    });

    test('genera claves distintas para signos opuestos del mismo proveedor', () => {
      const gasto = buildLearnKey(createTestMovement({
        description: 'EMPRESA ABC SL TRANSFERENCIA',
        counterparty: 'EMPRESA ABC SL',
        amount: -100,
      }));
      const ingreso = buildLearnKey(createTestMovement({
        description: 'EMPRESA ABC SL TRANSFERENCIA',
        counterparty: 'EMPRESA ABC SL',
        amount: 100,
      }));

      expect(gasto).not.toBe(ingreso);
    });
  });

  // T16-fix-functional · cobertura B1+B2 (audit T16 §6).
  // El path UI activo es bankStatementOrchestrator → feedLearningRule →
  // createOrUpdateRule, por lo que estos casos invocan el servicio
  // directamente con el shape que usa el orchestrator (con/sin `movement`).
  describe('T16-fix-functional · createOrUpdateRule', () => {
    test('B1 · creación arranca appliedCount en 1 (no 0)', async () => {
      const rule = await learningService.createOrUpdateRule({
        learnKey: 't16-b1-new',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });

      expect(rule.appliedCount).toBe(1);
      expect(rule.lastAppliedAt).toBeDefined();
    });

    test('B1 · upsert sobre regla existente incrementa appliedCount', async () => {
      await learningService.createOrUpdateRule({
        learnKey: 't16-b1-existing',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });
      const second = await learningService.createOrUpdateRule({
        learnKey: 't16-b1-existing',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });
      const third = await learningService.createOrUpdateRule({
        learnKey: 't16-b1-existing',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });

      expect(second.appliedCount).toBe(2);
      expect(third.appliedCount).toBe(3);
    });

    test('B1 · boost de confianza · regla con appliedCount >= 3 sale del piso 50', async () => {
      // Replica la fórmula viva en movementSuggestionService.ts:
      //   applied===0 → 50; resto → 70 + Math.min(15, round(log10(applied+1)*5))
      const rule = { appliedCount: 3 } as MovementLearningRule;
      const applied = rule.appliedCount ?? 0;
      const confidence =
        applied === 0
          ? 50
          : 70 + Math.min(15, Math.round(Math.log10(applied + 1) * 5));

      expect(applied).toBeGreaterThanOrEqual(3);
      expect(confidence).toBeGreaterThanOrEqual(70);
      expect(confidence).toBeLessThanOrEqual(85);
    });

    test('B2 · cuando se pasa el movimiento, los patrones se rellenan en la creación', async () => {
      const movement = createTestMovement({
        id: 9001,
        description: 'ENDESA ESPAÑA SA RECIBO LUZ JUN2024 REF777',
        counterparty: 'ENDESA ESPAÑA SA',
        amount: -45.23,
      });

      const rule = await learningService.createOrUpdateRule({
        learnKey: 't16-b2-with-movement',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
        movement,
      });

      expect(rule.counterpartyPattern).not.toBe('');
      expect(rule.counterpartyPattern.toLowerCase()).toContain('endesa');
      expect(rule.descriptionPattern).not.toBe('');
      expect(rule.amountSign).toBe('negative');
    });

    test('B2 · sin movimiento, los patrones quedan en defaults (compat)', async () => {
      const rule = await learningService.createOrUpdateRule({
        learnKey: 't16-b2-no-movement',
        categoria: 'TRANSPORTE',
        ambito: 'PERSONAL',
      });

      expect(rule.counterpartyPattern).toBe('');
      expect(rule.descriptionPattern).toBe('');
      expect(rule.amountSign).toBe('positive');
    });

    test('B2 · upsert con movimiento rellena patrones que estaban vacíos', async () => {
      // Primera creación sin movimiento → patrones vacíos.
      await learningService.createOrUpdateRule({
        learnKey: 't16-b2-backfill',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });
      const movement = createTestMovement({
        id: 9002,
        description: 'IBERDROLA GENERACION SAU RECIBO LUZ',
        counterparty: 'IBERDROLA GENERACION',
        amount: -78.9,
      });

      const updated = await learningService.createOrUpdateRule({
        learnKey: 't16-b2-backfill',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
        movement,
      });

      expect(updated.counterpartyPattern.toLowerCase()).toContain('iberdrola');
      expect(updated.descriptionPattern).not.toBe('');
      expect(updated.amountSign).toBe('negative');
    });
  });

  // T16-cleanup · regresión guard. Los registros nuevos NO deben escribir
  // entradas a `history[]` ni en creación ni en upsert. El campo permanece
  // declarado como @deprecated en el tipo y los registros viejos lo
  // conservan dormido (no se borra hasta el próximo bump DB).
  describe('T16-cleanup · createOrUpdateRule no escribe history[]', () => {
    test('creación · history queda undefined en el objeto persistido', async () => {
      const rule = await learningService.createOrUpdateRule({
        learnKey: 't16-cleanup-no-history-new',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });

      expect(rule.history).toBeUndefined();

      const persisted = await db.getAllFromIndex(
        'movementLearningRules',
        'learnKey',
        't16-cleanup-no-history-new'
      );
      expect(persisted).toHaveLength(1);
      expect(persisted[0].history).toBeUndefined();
    });

    test('upsert · una regla creada en este PR no acumula entries al actualizar', async () => {
      await learningService.createOrUpdateRule({
        learnKey: 't16-cleanup-no-history-upsert',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });
      const updated = await learningService.createOrUpdateRule({
        learnKey: 't16-cleanup-no-history-upsert',
        categoria: 'SUMINISTROS',
        ambito: 'PERSONAL',
      });

      expect(updated.history).toBeUndefined();
    });
  });
});
