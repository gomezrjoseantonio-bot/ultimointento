/**
 * TAREA 14 sub-tarea 14.5 · tests para cleanupConfigFiscalKeyval.
 *
 * Cubre los 3 casos del spec §5.3:
 *   1. keyval con `configFiscal` poblada · run · borrada · flag escrito · deleted=true
 *   2. keyval sin `configFiscal` · run · deleted=false · flag escrito · idempotente
 *   3. 2ª ejecución · skip silencioso · skipped=true · deleted=false
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  T14_CLEANUP_FLAG_KEY,
} from '../cleanupConfigFiscalKeyval';

describe('cleanupConfigFiscalKeyval', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('1 · keyval con configFiscal poblada · borra · flag escrito · deleted=true', async () => {
    const { initDB } = await import('../../db');
    const { cleanupConfigFiscalKeyval } = await import('../cleanupConfigFiscalKeyval');

    const db = await initDB();
    await db.put('keyval', { mes_declaracion: 6, dia_declaracion: 25 } as any, 'configFiscal');

    const report = await cleanupConfigFiscalKeyval();

    expect(report.skipped).toBe(false);
    expect(report.deleted).toBe(true);
    expect(report.errors).toEqual([]);

    // configFiscal ya no existe
    const after = await db.get('keyval', 'configFiscal');
    expect(after).toBeUndefined();

    // flag escrito
    const flag = await db.get('keyval', T14_CLEANUP_FLAG_KEY);
    expect(flag).toBe('completed');
  });

  it('2 · keyval sin configFiscal · deleted=false · flag escrito · idempotente', async () => {
    const { initDB } = await import('../../db');
    const { cleanupConfigFiscalKeyval } = await import('../cleanupConfigFiscalKeyval');

    const db = await initDB();
    // No escribimos configFiscal · keyval queda sin la clave
    await db.put('keyval', 'algo-no-relacionado', 'otraClave');

    const report = await cleanupConfigFiscalKeyval();

    expect(report.skipped).toBe(false);
    expect(report.deleted).toBe(false);
    expect(report.errors).toEqual([]);

    // flag escrito aunque no había nada que borrar
    const flag = await db.get('keyval', T14_CLEANUP_FLAG_KEY);
    expect(flag).toBe('completed');

    // la otra clave intacta
    const otra = await db.get('keyval', 'otraClave');
    expect(otra).toBe('algo-no-relacionado');
  });

  it('3 · 2ª ejecución · skip silencioso · skipped=true · deleted=false', async () => {
    const { initDB } = await import('../../db');
    const { cleanupConfigFiscalKeyval } = await import('../cleanupConfigFiscalKeyval');

    const db = await initDB();
    await db.put('keyval', { foo: 'bar' } as any, 'configFiscal');

    // 1ª corrida · borra y escribe flag
    const first = await cleanupConfigFiscalKeyval();
    expect(first.skipped).toBe(false);
    expect(first.deleted).toBe(true);

    // 2ª corrida · skip silencioso · NO toca nada
    const second = await cleanupConfigFiscalKeyval();
    expect(second.skipped).toBe(true);
    expect(second.deleted).toBe(false);
    expect(second.errors).toEqual([]);

    // Re-introducir configFiscal manualmente · 3ª corrida sigue haciendo
    // skip porque el flag ya está · garantía de idempotencia estricta.
    await db.put('keyval', { foo: 'bar2' } as any, 'configFiscal');
    const third = await cleanupConfigFiscalKeyval();
    expect(third.skipped).toBe(true);
    expect(third.deleted).toBe(false);
    // configFiscal manual sigue ahí (NO se borra en skip)
    const stillThere = await db.get('keyval', 'configFiscal');
    expect(stillThere).toEqual({ foo: 'bar2' });
  });
});
