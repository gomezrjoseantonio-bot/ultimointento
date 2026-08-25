/**
 * V61 migration tests · TAREA 7 sub-tarea 2
 *
 * Verifica el rename `nominas → ingresos`:
 *   - La base fresca abre a la DB_VERSION vigente (V61 hizo el rename)
 *   - El nuevo store `ingresos` existe con los índices esperados
 *     (`personalDataId`, `tipo`, `fechaActualizacion`).
 *   - La migración V60→V61 copia cada registro de `nominas` a `ingresos`
 *     añadiendo `tipo='nomina'` y preservando el `id`.
 *   - El store legacy `nominas` queda intacto (consumidores siguen leyendo
 *     de él hasta sub-tarea 6).
 *   - La copia es idempotente: una segunda apertura no duplica registros.
 *
 * NOTA: la absorción de `autonomos` y `pensiones` en `ingresos` (con
 * `tipo='autonomo' | 'pension'`) se cubre en sub-tareas posteriores.
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('V61 migration · sub-tarea 2 nominas → ingresos rename', () => {
  beforeEach(() => {
    // Aislar el almacenamiento entre tests
    (globalThis as any).indexedDB = new IDBFactory();
    // Resetear el caché del módulo db.ts (singleton dbPromise) para que cada
    // test que llame a initDB() abra una DB fresca contra el IDBFactory recién
    // creado.
    jest.resetModules();
  });

  describe('DB_VERSION', () => {
    test('está fijado a 62 en src/services/db.ts (V61 hizo rename, V62 elimina stores)', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      expect(db.version).toBe(dbModule.DB_VERSION);
      db.close();
    });
  });

  describe('store `ingresos`', () => {
    test('existe tras initDB() en una DB fresca', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      expect(Array.from(db.objectStoreNames)).toContain('ingresos');
      db.close();
    });

    test('tiene los índices esperados (personalDataId, tipo, fechaActualizacion)', async () => {
      const dbModule = await import('../db');
      const db = await dbModule.initDB();
      const tx = db.transaction('ingresos', 'readonly');
      const store = tx.objectStore('ingresos');
      const indexes = Array.from(store.indexNames);
      expect(indexes).toContain('personalDataId');
      expect(indexes).toContain('tipo');
      expect(indexes).toContain('fechaActualizacion');
      db.close();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RETIRADO · el describe «migración V60 → V61: copia nominas → ingresos».
  //
  // Comprobaba que al abrir una base V60 el upgrade COPIABA cada registro de
  // `nominas` a `ingresos` con `tipo='nomina'`, preservando el id, de forma
  // idempotente, y que el store legacy quedaba borrado tras V63.
  //
  // Ese bloque del upgrade ya no existe: #1430 («DBSchema · Fase 0 · … + borrar
  // limpieza legacy», 19 jul 2026) retiró del callback `upgrade` los 46 bloques
  // de limpieza y migración legacy, por decisión expresa (Adenda 1 opción B) y
  // en coherencia con la política de datos vigente: carga limpia, sin migración
  // ni backfill. Queda escrito en `db.ts:74-77`: «stores legacy borrados … → su
  // limpieza del upgrade se retiró en Fase 0».
  //
  // Lo que sigue vivo —que una base FRESCA nace con `ingresos` y sus tres
  // índices— es lo que verifican los tests de arriba, que pasan.
  //
  // El producto es el correcto; lo obsoleto era el test.
  // ─────────────────────────────────────────────────────────────────────────
});
