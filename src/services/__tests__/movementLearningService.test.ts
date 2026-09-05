/**
 * Test suite for Treasury Learning Engine.
 *
 * T16-cleanup: removed coverage of `performManualReconciliation`,
 * `createLearningRule`, `applyRuleToGrays`, `getLearningLogs` y
 * `getLearningRulesStats` (subsistemas eliminados). Lo que queda cubre el
 * path activo (`createOrUpdateRule` vía orchestrator) más smoke tests del
 * generador de learnKey y la persistencia de movimientos.
 */

import { learningService, buildLearnKey, buildLearnKeyV1 } from '../movementLearningService';
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
    // E2.1 · este test sigue siendo verdad y sigue verde: «ENE2024» y «REF123456»
    // son ruido VOLÁTIL (una fecha y un nº de referencia que cambian cada mes) y
    // deben seguir dando la misma clave. Lo que E2.1 cambia es lo de abajo: un
    // IDENTIFICADOR ESTABLE (nº de contrato, CUPS, NIF) ya no se borra, y con él
    // dos recibos del mismo proveedor de dos pisos son dos reglas.
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

    // ── E2.1 · el identificador entra en la clave ──────────────────────────
    test('E2.1 · mismo texto, distinto nº de contrato ⇒ claves DISTINTAS', () => {
      const pisoA = buildLearnKey(createTestMovement({
        description: 'RECIBO IBERDROLA CLIENTES SAU CONTRATO 123456789 08/2026',
        counterparty: 'IBERDROLA CLIENTES SAU',
        amount: -108.44,
      }));
      const pisoB = buildLearnKey(createTestMovement({
        description: 'RECIBO IBERDROLA CLIENTES SAU CONTRATO 987654321 08/2026',
        counterparty: 'IBERDROLA CLIENTES SAU',
        amount: -63.1,
      }));

      expect(pisoA).not.toBe(pisoB);
    });

    test('E2.1 · el mismo contrato en dos meses ⇒ la MISMA clave (la fecha sigue siendo volátil)', () => {
      const julio = buildLearnKey(createTestMovement({
        description: 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/07/25',
        counterparty: '',
        amount: -674.02,
      }));
      const agosto = buildLearnKey(createTestMovement({
        description: 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/08/25',
        counterparty: '',
        amount: -674.02,
      }));

      expect(julio).toBe(agosto);
    });

    test('E2.1 · el identificador que viaja en `reference` (BBVA) también entra en la clave', () => {
      const base = { description: 'Cargo por amortizacion de prestamo/credito', counterparty: '', amount: -285.4 };
      const prestamo1 = buildLearnKey(createTestMovement({ ...base, reference: '0182-5322-27-0830842450' }));
      const prestamo2 = buildLearnKey(createTestMovement({ ...base, reference: '0182-5322-27-0830842451' }));

      expect(prestamo1).not.toBe(prestamo2);
    });

    test('E2.1 · sin identificador la clave v2 ES la v1 · las reglas de antes siguen encontrándose', () => {
      const m = createTestMovement({
        description: 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF123456',
        counterparty: 'ENDESA ESPAÑA SA',
      });
      expect(buildLearnKey(m)).toBe(buildLearnKeyV1(m));
    });

    test('E2.1 · con identificador la v2 y la v1 difieren · la v1 queda como respaldo de lectura', () => {
      const m = createTestMovement({
        description: 'RECIBO IBERDROLA CLIENTES SAU CONTRATO 123456789',
        counterparty: 'IBERDROLA CLIENTES SAU',
      });
      expect(buildLearnKey(m)).not.toBe(buildLearnKeyV1(m));
    });

    // ── E2.3 · el nº de factura de Sabadell y la clave ─────────────────────
    //
    // HALLAZGO (preexistente · v1 · NO se toca en E2.3): `removeVolatileTokens`
    // quita toda palabra de 8+ caracteres (`\b[a-z0-9]{8,}\b`), LETRAS incluidas.
    // «ELECTRICIDAD», «IBERDROLA» y «COMERCIALIZACION» desaparecen del patrón y
    // la clave de Sabadell se queda con «gas 105»: cambia cada mes. Y en
    // general, la clave v1 se construye SIN los nombres largos de proveedor
    // (COMUNIDAD, PROPIETARIOS, TRANSFERENCIA…), que es justo lo que identifica.
    // Arreglarlo cambia la v1 de todas las reglas · otra tarea.
    test('HALLAZGO · sin identificador, el nº de factura SÍ cambia la clave (la v1 tira las palabras largas)', () => {
      const sinRef = (factura: string) =>
        createTestMovement({ description: `ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS ${factura}`, counterparty: '', amount: -38.2 });
      expect(buildLearnKeyV1(sinRef('104'))).not.toBe(buildLearnKeyV1(sinRef('105')));
    });

    test('E2.3 · CON identificador (el NIF de Referencia 1) el nº de factura ya NO cambia la clave · Sabadell resuelto', () => {
      const recibo = (factura: string) =>
        createTestMovement({ description: `ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS ${factura}`, counterparty: '', reference: 'A95554630001', amount: -38.2 });
      expect(buildLearnKey(recibo('104'))).toBe(buildLearnKey(recibo('105')));
      // Y sigue distinguiendo gas de luz del mismo acreedor.
      const luz = createTestMovement({ description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA LUZ 88', counterparty: '', reference: 'A95554630001', amount: -80 });
      expect(buildLearnKey(luz)).not.toBe(buildLearnKey(recibo('104')));
    });

    test('E2.3 · CON identificador, un nº de factura al PRINCIPIO del texto tampoco cambia la clave', () => {
      const recibo = (factura: string) =>
        createTestMovement({ description: `IBERDROLA GAS ${factura} ELECTRICIDAD COMERCIALIZACION`, counterparty: '', reference: 'A95554630001', amount: -38.2 });
      expect(buildLearnKey(recibo('104'))).toBe(buildLearnKey(recibo('105')));
    });

    test('E2.3 · SIN identificador los números de tres cifras del principio siguen distinguiendo · dos portales son dos comunidades', () => {
      const p105 = buildLearnKey(createTestMovement({ description: 'PORTAL 105 CDAD PROP CALLE URIA', counterparty: '', amount: -72.5 }));
      const p107 = buildLearnKey(createTestMovement({ description: 'PORTAL 107 CDAD PROP CALLE URIA', counterparty: '', amount: -72.5 }));
      expect(p105).not.toBe(p107);
    });

    // HALLAZGO (preexistente · v1 · NO se toca en E2.3): `extractNGrams` descarta
    // las palabras de 1-2 caracteres, así que «CALLE URIA 5» y «CALLE URIA 7»
    // YA daban la misma clave antes de E2.1. Queda consagrado aquí para que se
    // vea; arreglarlo cambia la v1 de todas las reglas y es otra tarea.
    test('HALLAZGO · sin identificador, un número de UNA cifra no distingue (v1 · preexistente)', () => {
      const uria5 = buildLearnKey(createTestMovement({ description: 'RECIBO CDAD PROP CALLE URIA 5', counterparty: '', amount: -72.5 }));
      const uria7 = buildLearnKey(createTestMovement({ description: 'RECIBO CDAD PROP CALLE URIA 7', counterparty: '', amount: -72.5 }));
      expect(uria5).toBe(uria7);
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
  // ── E2.1 · el bug arreglado, de punta a punta ─────────────────────────────
  describe('E2.1 · dos recibos del mismo proveedor de dos pisos', () => {
    test('mismo texto, distinto nº de contrato ⇒ DOS reglas, cada una con su piso · la segunda NO pisa a la primera', async () => {
      const recibo = (contrato: string, importe: number) =>
        createTestMovement({
          description: `RECIBO IBERDROLA CLIENTES SAU CONTRATO ${contrato} 08/2026`,
          counterparty: 'IBERDROLA CLIENTES SAU',
          amount: importe,
        });
      const pisoA = recibo('123456789', -108.44);
      const pisoB = recibo('987654321', -63.1);

      const reglaA = await learningService.createOrUpdateRule({
        learnKey: buildLearnKey(pisoA),
        categoria: 'inmueble.suministros',
        ambito: 'INMUEBLE',
        inmuebleId: '4',
        movement: pisoA,
      });
      const reglaB = await learningService.createOrUpdateRule({
        learnKey: buildLearnKey(pisoB),
        categoria: 'inmueble.suministros',
        ambito: 'INMUEBLE',
        inmuebleId: '7',
        movement: pisoB,
      });

      expect(reglaA.id).not.toBe(reglaB.id);
      expect(reglaA.learnKey).not.toBe(reglaB.learnKey);
      expect(reglaA.identificadores).toEqual(['contrato:123456789']);
      expect(reglaB.identificadores).toEqual(['contrato:987654321']);

      // Releídas de la base · la primera conserva su piso.
      const guardadas = (await db.getAll('movementLearningRules')) as MovementLearningRule[];
      const porId = new Map(guardadas.map((r) => [r.id, r]));
      expect(porId.get(reglaA.id!)?.inmuebleId).toBe('4');
      expect(porId.get(reglaB.id!)?.inmuebleId).toBe('7');
      expect(guardadas).toHaveLength(2);
    });

    test('el mismo contrato confirmado dos veces ⇒ UNA regla, appliedCount 2', async () => {
      const julio = createTestMovement({
        description: 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/07/25',
        counterparty: '',
        amount: -674.02,
      });
      const agosto = createTestMovement({
        description: 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/08/25',
        counterparty: '',
        amount: -674.02,
      });

      const primera = await learningService.createOrUpdateRule({
        learnKey: buildLearnKey(julio), categoria: 'vivienda.hipoteca', ambito: 'INMUEBLE', inmuebleId: '2', movement: julio,
      });
      const segunda = await learningService.createOrUpdateRule({
        learnKey: buildLearnKey(agosto), categoria: 'vivienda.hipoteca', ambito: 'INMUEBLE', inmuebleId: '2', movement: agosto,
      });

      expect(segunda.id).toBe(primera.id);
      expect(segunda.appliedCount).toBe(2);
      expect(segunda.identificadores).toEqual(['contrato:8078716546']);
    });

    test('sin identificador la regla no lleva `identificadores`', async () => {
      const m = createTestMovement({ description: 'NETFLIX.COM', counterparty: 'NETFLIX' });
      const regla = await learningService.createOrUpdateRule({
        learnKey: buildLearnKey(m), categoria: 'ocio', ambito: 'PERSONAL', movement: m,
      });
      expect(regla.identificadores).toBeUndefined();
    });
  });

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
