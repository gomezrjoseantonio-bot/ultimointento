// TAREA CC · COPIA-Y-RESTAURACIÓN · prueba dura + garantías del formato.
//
// La PRUEBA DURA del criterio §6.2: sembrar la base, exportar, vaciarla entera,
// importar la copia y comprobar que los totales por store coinciden UNO A UNO.
// Además cubre: binarios (Blob→base64→Blob), claves fuera de línea de `keyval`,
// rechazo de versión más nueva y de fichero no-ATLAS, y el todo-o-nada.
//
// Patrón fake-indexeddb + jest.resetModules idéntico a db.structure.v79.test.ts:
// una IDBFactory nueva por test y un import dinámico del grafo db+backup fresco.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// setupTests.ts instala un structuredClone basado en JSON que DESTRUYE los Blob
// (un Blob → {}). Eso impide probar el viaje de binarios a través de
// fake-indexeddb. Lo sustituimos por un clon profundo que preserva los binarios
// por referencia (lo que un navegador real hace de forma nativa). Más fiel, y no
// afecta a los datos planos del resto de tests.
function deepCloneKeepBinary(value: any, seen = new WeakMap()): any {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return value; // binario · se conserva la instancia
  }
  if (value instanceof Date) return new Date(value.getTime());
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const arr: any[] = [];
    seen.set(value, arr);
    for (const item of value) arr.push(deepCloneKeepBinary(item, seen));
    return arr;
  }
  const out: Record<string, any> = {};
  seen.set(value, out);
  for (const [k, v] of Object.entries(value)) out[k] = deepCloneKeepBinary(v, seen);
  return out;
}
(global as any).structuredClone = (v: any) => deepCloneKeepBinary(v);

type DbModule = typeof import('../../db');
type BackupModule = typeof import('../backup');

async function loadFresh(): Promise<{ db: DbModule; backup: BackupModule }> {
  jest.resetModules();
  (globalThis as any).indexedDB = new IDBFactory();
  const db = (await import('../../db')) as DbModule;
  const backup = (await import('../backup')) as BackupModule;
  return { db, backup };
}

/** Cuenta registros de TODOS los stores del esquema (sin lista blanca). */
async function totalesPorStore(dbInstance: any): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const name of Array.from(dbInstance.objectStoreNames) as string[]) {
    out[name] = await dbInstance.count(name);
  }
  return out;
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* noop */
  }
});

describe('copia-y-restauración · backup.ts', () => {
  it('PRUEBA DURA · exportar → vaciar → importar deja los totales por store idénticos', async () => {
    const { db, backup } = await loadFresh();
    const dbi = await db.initDB();

    // ── Sembrar datos representativos ──────────────────────────────────────
    // autoincrement (id embebido)
    await dbi.add('properties', { alias: 'Piso A', address: 'Calle 1', modoExplotacion: 'piso_completo' } as any);
    await dbi.add('properties', { alias: 'Piso B', address: 'Calle 2', modoExplotacion: 'piso_completo' } as any);
    for (let i = 0; i < 5; i++) {
      await dbi.add('movements', { accountId: 1, date: `2026-01-0${i + 1}`, amount: i, description: `m${i}` } as any);
    }
    await dbi.add('treasuryEvents', { type: 'ingreso', predictedDate: '2026-02-01', status: 'previsto' } as any);
    // keyPath no autoincrement
    await dbi.put('proveedores', { nif: 'B111', nombre: 'Prov 1' } as any);
    await dbi.put('proveedores', { nif: 'B222', nombre: 'Prov 2' } as any);
    await dbi.put('ejerciciosFiscalesCoord', { año: 2025, estado: 'abierto' } as any);
    // índice único (retos.mes)
    await dbi.put('retos', { id: 'r1', mes: '2026-01', estado: 'activo', tipo: 'ahorro' } as any);
    await dbi.put('retos', { id: 'r2', mes: '2026-02', estado: 'activo', tipo: 'ahorro' } as any);
    // keyval · store FUERA DE LÍNEA (clave separada del valor)
    await dbi.put('keyval', 'completed', 'migration_v78_alquileres');
    await dbi.put('keyval', { theme: 'dark' }, 'dashboardConfiguration');
    await dbi.put('keyval', 42, 'algun_contador');
    // documento con BINARIO (Blob)
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], { type: 'application/pdf' });
    await dbi.add('documents', {
      filename: 'factura.pdf',
      type: 'application/pdf',
      size: blob.size,
      lastModified: 0,
      content: blob,
      metadata: {},
    } as any);

    const antes = await totalesPorStore(dbi);

    // ── Exportar (a objeto · el fichero es JSON.stringify de esto) ──────────
    const copia = JSON.parse(JSON.stringify(await backup.buildBackup())) as import('../backup').AtlasBackupFile;

    // El resumen debe declarar TODOS los stores (incluidos los vacíos, como 0).
    expect(Object.keys(copia.datos).sort()).toEqual((Array.from(dbi.objectStoreNames) as string[]).sort());
    expect(copia.atlas.totalRegistros).toBe(Object.values(antes).reduce((a, b) => a + b, 0));

    // ── Vaciar la base ENTERA ──────────────────────────────────────────────
    const allStores = Array.from(dbi.objectStoreNames) as string[];
    const txClear = dbi.transaction(allStores as any, 'readwrite');
    for (const s of allStores) await txClear.objectStore(s as any).clear();
    await txClear.done;
    const vaciados = await totalesPorStore(dbi);
    expect(Object.values(vaciados).reduce((a, b) => a + b, 0)).toBe(0);

    // ── Importar la copia ──────────────────────────────────────────────────
    await backup.importBackup(copia);

    // ── Comprobación uno a uno ─────────────────────────────────────────────
    const despues = await totalesPorStore(dbi);
    expect(despues).toEqual(antes);

    dbi.close();
  });

  it('binarios · el Blob de documents viaja en base64 y vuelve idéntico', async () => {
    const { db, backup } = await loadFresh();
    const dbi = await db.initDB();

    const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    const blob = new Blob([bytes], { type: 'image/png' });
    await dbi.add('documents', {
      filename: 'foto.png',
      type: 'image/png',
      size: blob.size,
      lastModified: 0,
      content: blob,
      metadata: {},
    } as any);

    const copia = JSON.parse(JSON.stringify(await backup.buildBackup())) as import('../backup').AtlasBackupFile;

    // En el JSON el contenido es una marca base64, no un Blob perdido.
    const docSerializado = (copia.datos.documents as any[])[0];
    expect(docSerializado.content.__atlasBlob).toBe(true);
    expect(typeof docSerializado.content.base64).toBe('string');
    expect(docSerializado.content.base64.length).toBeGreaterThan(0);

    // Vaciar y restaurar.
    await dbi.clear('documents');
    await backup.importBackup(copia);

    const restaurado = (await dbi.getAll('documents'))[0] as any;
    expect(restaurado.content).toBeInstanceOf(Blob);
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(restaurado.content as Blob);
    });
    expect(Array.from(new Uint8Array(buf))).toEqual(Array.from(bytes));
    expect((restaurado.content as Blob).type).toBe('image/png');

    dbi.close();
  });

  it('keyval · las claves fuera de línea se preservan con sus valores', async () => {
    const { db, backup } = await loadFresh();
    const dbi = await db.initDB();

    await dbi.put('keyval', 'completed', 'flag_a');
    await dbi.put('keyval', { n: 7 }, 'config_b');
    // initDB puebla `keyval` con banderas de migración · el total no es sólo 2.
    const countAntes = await dbi.count('keyval');

    const copia = JSON.parse(JSON.stringify(await backup.buildBackup())) as import('../backup').AtlasBackupFile;
    await dbi.clear('keyval');
    await backup.importBackup(copia);

    expect(await dbi.get('keyval', 'flag_a')).toBe('completed');
    expect(await dbi.get('keyval', 'config_b')).toEqual({ n: 7 });
    // Todas las entradas (mis 2 + las banderas) sobreviven al viaje, con sus claves.
    expect(await dbi.count('keyval')).toBe(countAntes);

    dbi.close();
  });

  it('rechaza una copia de versión MÁS NUEVA con mensaje claro', async () => {
    const { db, backup } = await loadFresh();
    await db.initDB();

    const fichero = {
      atlas: {
        formato: backup.ATLAS_BACKUP_FORMATO,
        dbVersion: db.DB_VERSION + 5,
        exportadoEl: '2030-01-01T00:00:00.000Z',
        origen: 'test',
        resumen: {},
        totalRegistros: 0,
      },
      datos: {},
    };
    const file = new File([JSON.stringify(fichero)], 'atlas-copia.json', { type: 'application/json' });

    await expect(backup.readBackupFile(file)).rejects.toThrow(backup.BackupError);
  });

  it('rechaza un fichero que NO es una copia de ATLAS', async () => {
    const { db, backup } = await loadFresh();
    await db.initDB();

    const file = new File([JSON.stringify({ cualquier: 'cosa' })], 'otro.json', { type: 'application/json' });
    await expect(backup.readBackupFile(file)).rejects.toThrow(backup.BackupError);

    const noJson = new File(['esto no es json {'], 'roto.json', { type: 'application/json' });
    await expect(backup.readBackupFile(noJson)).rejects.toThrow(backup.BackupError);
  });

  it('acepta una copia de la MISMA versión y la marca como compatible', async () => {
    const { db, backup } = await loadFresh();
    const dbi = await db.initDB();
    await dbi.add('properties', { alias: 'X', address: 'Y', modoExplotacion: 'piso_completo' } as any);

    const copia = await backup.buildBackup();
    const file = new File([JSON.stringify(copia)], 'atlas-copia.json', { type: 'application/json' });
    const preview = await backup.readBackupFile(file);

    expect(preview.compatibilidad).toBe('igual');
    expect(preview.dbVersionCopia).toBe(db.DB_VERSION);
    expect(preview.totalRegistros).toBeGreaterThan(0);
    dbi.close();
  });

  it('todo-o-nada · si la importación falla a mitad, la base queda como estaba', async () => {
    const { db, backup } = await loadFresh();
    const dbi = await db.initDB();

    // Base con datos previos que NO deben perderse si la restauración falla.
    await dbi.add('properties', { alias: 'Original', address: 'Z', modoExplotacion: 'piso_completo' } as any);
    await dbi.put('retos', { id: 'orig', mes: '2025-12', estado: 'activo', tipo: 'ahorro' } as any);
    const antes = await totalesPorStore(dbi);

    // Copia CORRUPTA: dos retos con el mismo `mes` (índice único) → el segundo
    // put revienta la transacción → abort → clear revertido → base intacta.
    const copiaMala: import('../backup').AtlasBackupFile = {
      atlas: {
        formato: backup.ATLAS_BACKUP_FORMATO,
        dbVersion: db.DB_VERSION,
        exportadoEl: new Date().toISOString(),
        origen: 'test',
        resumen: {},
        totalRegistros: 0,
      },
      datos: {
        retos: [
          { id: 'a', mes: '2026-05', estado: 'activo', tipo: 'ahorro' },
          { id: 'b', mes: '2026-05', estado: 'activo', tipo: 'ahorro' },
        ],
      },
    };

    await expect(backup.importBackup(copiaMala)).rejects.toThrow(backup.BackupError);

    const despues = await totalesPorStore(dbi);
    expect(despues).toEqual(antes);
    // El dato original sigue ahí, sin tocar.
    const retosVivos = await dbi.getAll('retos');
    expect(retosVivos.map((r: any) => r.id)).toEqual(['orig']);

    dbi.close();
  });

  it('metadatos · guarda y detecta la última copia (aviso §4)', async () => {
    const { backup } = await loadFresh();

    expect(backup.getUltimaCopia()).toBeNull();
    expect(backup.copiaEsAntigua(null)).toBe(true);

    backup.setUltimaCopia({ exportadoEl: new Date().toISOString(), totalRegistros: 10 });
    const info = backup.getUltimaCopia();
    expect(info?.totalRegistros).toBe(10);
    expect(backup.copiaEsAntigua(info)).toBe(false);

    // Una copia de hace 40 días ya es antigua.
    const vieja = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    expect(backup.copiaEsAntigua({ exportadoEl: vieja, totalRegistros: 1 })).toBe(true);
  });
});
