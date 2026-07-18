// Verificación bloque 3 · commit final B (objetivos_financieros).
// Tras retirar el stash pre-upgrade + la migración V5.5/V5.9 de
// `objetivos_financieros` (código que corría en cada initDB), este test comprueba
// que initDB abre LIMPIO en los dos escenarios que exige Jose:
//   1. sobre una base NUEVA desde cero
//   2. sobre una base EXISTENTE ya en v79 (idempotente, sin re-migración)
// Un fallo aquí impide arrancar la app y ningún indicador lo detecta.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('initDB · bloque 3 commit B · sin stash/migración de objetivos_financieros', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('1 · abre limpio sobre una base NUEVA desde cero (v79 + escenarios con default)', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.version).toBe(79);
    // El store `escenarios` (que antes creaba la rama de migración) se sigue
    // creando con su singleton por defecto para bases nuevas.
    expect(db.objectStoreNames.contains('escenarios')).toBe(true);
    const esc = (await db.get('escenarios', 1)) as any;
    expect(esc).toBeDefined();
    expect(esc.id).toBe(1);
    // Un store vivo cualquiera responde (la base abrió de verdad).
    expect(db.objectStoreNames.contains('properties')).toBe(true);
    db.close();
  });

  it('2 · abre limpio sobre una base EXISTENTE ya en v79 (idempotente, sin re-migración)', async () => {
    // 1ª apertura: crea la base a v79.
    const m1 = await import('../db');
    const db1 = await m1.initDB();
    expect(db1.version).toBe(79);
    // Marca propia en el singleton para comprobar que la 2ª apertura NO lo pisa.
    await db1.put('escenarios', {
      id: 1,
      marcaTest: 'no-tocar',
      modoVivienda: 'compra',
    } as any);
    db1.close();

    // 2ª apertura sobre la MISMA base v79 (misma IDBFactory · resetModules solo
    // reinicia el singleton dbPromise del módulo).
    jest.resetModules();
    const m2 = await import('../db');
    const db2 = await m2.initDB();

    expect(db2.version).toBe(79);
    const esc = (await db2.get('escenarios', 1)) as any;
    expect(esc.marcaTest).toBe('no-tocar'); // nada re-migró ni sobrescribió el singleton
    db2.close();
  });
});
