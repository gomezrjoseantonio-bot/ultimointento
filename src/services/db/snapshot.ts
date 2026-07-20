// Frente C · troceo de db.ts (mover-no-reescribir).
// Snapshot / export / import / reset extraídos literalmente de db.ts (H1).
// Import diferido de db.ts (initDB/DB_VERSION se usan dentro de funciones async y
// en el side-effect exposeAtlasDBHandle) → sin ciclo en runtime. `db.ts` re-exporta
// estas funciones para no tocar a los consumidores; al re-exportar carga este
// módulo y ejecuta `exposeAtlasDBHandle()` (mismo comportamiento que antes).

import type { StoreNames } from 'idb';
import { initDB, DB_VERSION, DB_NAME } from '../db';
import type { AtlasHorizonDB } from '../db';
import { downloadBlob } from './documents';

export const exportSnapshot = async (): Promise<void> => {
  try {
    const db = await initDB();

    // Get all store names dynamically
    const storeNames = Array.from(db.objectStoreNames);

    // Dynamic import of JSZip to reduce main bundle size
    const JSZip = (await import('jszip')).default;

    // Create a new ZIP file
    const zip = new JSZip();

    // Serialize all stores, stripping Blobs (they go to the documents/ folder)
    const storesData: Record<string, unknown[]> = {};
    const documentsFolder = zip.folder('documents');

    for (const storeName of storeNames) {
      try {
        const records = await db.getAll(storeName as any);
        if (storeName === 'documents') {
          // Strip blob content; store files separately
          const meta: unknown[] = [];
          for (const doc of records as any[]) {
            if (doc.content instanceof Blob) {
              const extension = (doc.filename ?? '').split('.').pop() || 'bin';
              const safeFilename = `${doc.id}.${extension}`;
              if (documentsFolder) {
                documentsFolder.file(safeFilename, doc.content);
                documentsFolder.file(`${doc.id}.meta.json`, JSON.stringify({
                  originalFilename: doc.filename,
                  type: doc.type,
                  uploadDate: doc.uploadDate,
                  metadata: doc.metadata,
                }, null, 2));
              }
              meta.push({ ...doc, content: null });
            } else {
              meta.push(doc);
            }
          }
          storesData[storeName] = meta;
        } else {
          storesData[storeName] = records;
        }
      } catch (err) {
        console.warn(`[exportSnapshot] Error reading store "${storeName}":`, err);
        storesData[storeName] = [];
      }
    }

    // Main data JSON — V2 format (full-stores snapshot)
    const dataObj = {
      metadata: {
        dbVersion: DB_VERSION,
        exportDate: new Date().toISOString(),
        version: '2.0',
        app: 'ATLAS-Horizon-Pulse',
        stores: storeNames,
      },
      stores: storesData,
      // V1 compat fields (kept for backward compatibility with older importSnapshot)
      properties: storesData['properties'] ?? [],
      contracts: storesData['contracts'] ?? [],
      documents: storesData['documents'] ?? [],
    };

    // Add the main data file
    zip.file('atlas-data.json', JSON.stringify(dataObj, null, 2));

    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create filename with current date and time
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T');
    const dateStr = timestamp[0].replace(/-/g, '');
    const timeStr = timestamp[1].split('-')[0].replace(/-/g, '');
    const filename = `ATLAS-snapshot-${dateStr}-${timeStr}.zip`;

    // Download the ZIP file
    downloadBlob(zipBlob, filename);

  } catch (error) {
    console.error('Error exporting snapshot:', error);
    throw new Error('No se pudo exportar el snapshot');
  }
};

export const importSnapshot = async (file: File, mode: 'replace' | 'merge' = 'replace'): Promise<void> => {
  try {
    const db = await initDB();

    // Dynamic import of JSZip to reduce main bundle size
    const JSZip = (await import('jszip')).default;

    // Read the ZIP file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // Get the main data file
    const dataFile = zipContent.file('atlas-data.json');
    if (!dataFile) {
      throw new Error('Archivo de snapshot inválido: no se encontró atlas-data.json');
    }

    const dataJson = await dataFile.async('text');
    const data = JSON.parse(dataJson);

    // Detect format: V2 (stores map) or V1 (legacy)
    const isV2 = data.stores && typeof data.stores === 'object';
    const availableStoreNames = Array.from(db.objectStoreNames) as string[];

    if (isV2) {
      // ── V2: full-stores snapshot ─────────────────────────────────────────
      const storesToRestore = Object.keys(data.stores).filter(
        (s) => availableStoreNames.includes(s)
      );

      // Process stores in batches of 6 to avoid overwhelming IndexedDB
      // (IndexedDB transactions are limited in concurrent object stores per browser;
      // 6 is a safe value tested with Chrome/Firefox/Safari without hitting limits)
      const BATCH_SIZE = 6;
      for (let i = 0; i < storesToRestore.length; i += BATCH_SIZE) {
        const batch = storesToRestore.slice(i, i + BATCH_SIZE);
        const tx = db.transaction(batch as any[], 'readwrite');

        if (mode === 'replace') {
          await Promise.all(batch.map((s) => tx.objectStore(s as any).clear()));
        }

        for (const storeName of batch) {
          const records = (data.stores[storeName] as any[]) ?? [];

          if (storeName === 'documents') {
            // Restore document blobs from ZIP
            const documentsFolder = zipContent.folder('documents');
            for (const document of records) {
              let documentBlob: Blob | null = null;
              if (documentsFolder && document.id) {
                const extension = (document.filename as string || '').split('.').pop() || 'bin';
                const documentFile = documentsFolder.file(`${document.id}.${extension}`);
                if (documentFile) {
                  const fileData = await documentFile.async('blob');
                  documentBlob = new Blob([fileData], { type: document.type });
                }
              }
              const docToImport = {
                ...document,
                content: documentBlob || document.content || new Blob([''], { type: 'text/plain' }),
              };
              if (mode === 'merge' && document.id) {
                await tx.objectStore(storeName as any).put(docToImport);
              } else {
                const { id: _id, ...docWithoutId } = docToImport;
                try { await tx.objectStore(storeName as any).add(docWithoutId); } catch { /* dup, skip */ }
              }
            }
          } else {
            for (const record of records) {
              if (mode === 'merge' && record.id != null) {
                try { await tx.objectStore(storeName as any).put(record); } catch { /* dup, skip */ }
              } else {
                const { id: _id, ...recordWithoutId } = record;
                try { await tx.objectStore(storeName as any).add(recordWithoutId); } catch { /* dup, skip */ }
              }
            }
          }
        }
        await tx.done;
      }
    } else {
      // ── V1 legacy: only properties, documents, contracts ────────────────
      if (!data.properties || !data.documents || !data.contracts) {
        throw new Error('Archivo de snapshot inválido: estructura de datos incorrecta');
      }

      const tx = db.transaction(['properties', 'documents', 'contracts'], 'readwrite');

      if (mode === 'replace') {
        await Promise.all([
          tx.objectStore('properties').clear(),
          tx.objectStore('documents').clear(),
          tx.objectStore('contracts').clear(),
        ]);
      }

      for (const property of data.properties) {
        if (mode === 'merge' && property.id) {
          await tx.objectStore('properties').put(property);
        } else {
          const { id, ...propertyWithoutId } = property;
          await tx.objectStore('properties').add(propertyWithoutId);
        }
      }

      for (const contract of data.contracts) {
        if (mode === 'merge' && contract.id) {
          await tx.objectStore('contracts').put(contract);
        } else {
          const { id, ...contractWithoutId } = contract;
          await tx.objectStore('contracts').add(contractWithoutId);
        }
      }

      const documentsFolder = zipContent.folder('documents');
      for (const document of data.documents) {
        let documentBlob: Blob | null = null;

        if (documentsFolder && document.id) {
          const extension = document.filename.split('.').pop() || 'bin';
          const documentFile = documentsFolder.file(`${document.id}.${extension}`);

          if (documentFile) {
            const fileData = await documentFile.async('blob');
            documentBlob = new Blob([fileData], { type: document.type });
          }
        }

        const docToImport = {
          ...document,
          content: documentBlob || new Blob([''], { type: 'text/plain' }),
        };

        if (mode === 'merge' && document.id) {
          await tx.objectStore('documents').put(docToImport);
        } else {
          const { id, ...docWithoutId } = docToImport;
          await tx.objectStore('documents').add(docWithoutId);
        }
      }

      await tx.done;
    }

  } catch (error) {
    console.error('Error importing snapshot:', error);
    throw new Error('No se pudo importar el snapshot: ' + (error instanceof Error ? error.message : 'Error desconocido'));
  }
};

// Enhanced performance-optimized database cleanup
export const resetAllData = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Get all existing object stores from the database
    const storeNames = Array.from(db.objectStoreNames);
    console.log(`[RESET] Clearing ${storeNames.length} object stores:`, storeNames);
    
    // Performance optimization: Process stores in batches to avoid overwhelming the browser
    const BATCH_SIZE = 8; // Process 8 stores at a time
    const batches = [];
    for (let i = 0; i < storeNames.length; i += BATCH_SIZE) {
      batches.push(storeNames.slice(i, i + BATCH_SIZE));
    }
    
    // Clear stores in batches for better performance
    for (const batch of batches) {
      const tx = db.transaction(batch, 'readwrite');
      const clearPromises = batch.map(storeName => {
        console.log(`[RESET] Clearing store: ${storeName}`);
        return tx.objectStore(storeName).clear();
      });
      
      await Promise.all(clearPromises);
      await tx.done;
      
      // Small delay between batches to prevent blocking the UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Clear localStorage more efficiently
    const localStorageKeys = [
      'atlas-inbox-documents',
      'atlas-horizon-settings',
      'atlas-user-preferences',
      'classificationRules',
      'bankProfiles',
      'demo-mode',
      'atlas-kpi-configurations',
      'treasury-cache',
      'fiscal-cache'
    ];
    
    // Clear known keys first
    localStorageKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`[RESET] Cleared localStorage: ${key}`);
      }
    });
    
    // Performance optimization: Use a more efficient scan for remaining Atlas-related keys
    const allKeys = Object.keys(localStorage);
    const atlasKeys = allKeys.filter(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey.includes('atlas') || 
             lowerKey.includes('horizon') || 
             lowerKey.includes('treasury') ||
             lowerKey.includes('demo');
    });
    
    atlasKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[RESET] Cleared additional localStorage: ${key}`);
    });
    
    // Clear IndexedDB caches and force garbage collection hint
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const atlasCaches = cacheNames.filter(name => 
          name.toLowerCase().includes('atlas') ||
          name.toLowerCase().includes('horizon')
        );
        await Promise.all(atlasCaches.map(name => caches.delete(name)));
        console.log(`[RESET] Cleared ${atlasCaches.length} cache entries`);
      } catch (error) {
        console.warn('[RESET] Could not clear caches:', error);
      }
    }
    
    console.log('[RESET] Enhanced database and localStorage cleanup completed successfully');
    
  } catch (error) {
    console.error('Error resetting data:', error);
    throw new Error('No se pudo restablecer los datos completamente');
  }
};

/**
 * Versión JSON ligera del snapshot — útil para inspección manual y para el
 * helper expuesto en `window.atlasDB`. Itera dinámicamente sobre TODOS los
 * stores reales presentes en la DB (no hardcodeada). Los blobs de `documents`
 * NO se serializan: se omiten poniendo `content: null` y marcando
 * `_blobStripped: true` (esta vista JSON es solo para inspección de metadatos).
 *
 * Para backups completos con ficheros adjuntos, seguir usando exportSnapshot
 * (formato ZIP).
 */
export const exportSnapshotJSON = async (): Promise<{
  metadata: {
    dbName: string;
    dbVersion: number;
    exportedAt: string;
    storeCount: number;
    stores: string[];
  };
  stores: Record<string, unknown[]>;
}> => {
  const db = await initDB();
  const storeNames = Array.from(db.objectStoreNames) as string[];
  const stores: Record<string, unknown[]> = {};

  for (const storeName of storeNames) {
    try {
      const records = await db.getAll(storeName as any);
      // Strip Blob content (incompatible con JSON puro)
      stores[storeName] = (records as any[]).map((r) => {
        if (r && r.content instanceof Blob) {
          return { ...r, content: null, _blobStripped: true };
        }
        return r;
      });
    } catch (err) {
      console.warn(`[exportSnapshotJSON] Error reading store "${storeName}":`, err);
      stores[storeName] = [];
    }
  }

  return {
    metadata: {
      dbName: DB_NAME,
      dbVersion: db.version,
      exportedAt: new Date().toISOString(),
      storeCount: storeNames.length,
      stores: storeNames,
    },
    stores,
  };
};

/**
 * Helper de consola: expone `window.atlasDB` con las funciones de snapshot
 * para que Jose pueda ejecutar `await window.atlasDB.exportSnapshot()` y
 * `await window.atlasDB.exportSnapshotJSON()` desde DevTools.
 *
 * Idempotente y sin coste runtime: simplemente asigna referencias.
 */
const exposeAtlasDBHandle = (): void => {
  if (typeof window === 'undefined') return;
  try {
    (window as any).atlasDB = {
      exportSnapshot,
      exportSnapshotJSON,
      importSnapshot,
      resetAllData: () => resetAllData(),
      getDBVersion: async () => {
        const db = await initDB();
        return db.version;
      },
      listStores: async () => {
        const db = await initDB();
        return Array.from(db.objectStoreNames);
      },
    };
  } catch (err) {
    console.warn('[atlasDB] No se pudo exponer window.atlasDB:', err);
  }
};

// Auto-exposure: el handle queda disponible apenas se importa este módulo.
exposeAtlasDBHandle();

// Performance-optimized bulk data operations
export const bulkClearStores = async (storeNames: StoreNames<AtlasHorizonDB>[]): Promise<void> => {
  const db = await initDB();
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < storeNames.length; i += BATCH_SIZE) {
    const batch = storeNames.slice(i, i + BATCH_SIZE);
    const tx = db.transaction(batch, 'readwrite');
    
    await Promise.all(batch.map(storeName => 
      tx.objectStore(storeName).clear()
    ));
    
    await tx.done;
    // Micro-delay to prevent UI blocking
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};
