// src/services/__tests__/valoracionesService.v2.test.ts
// T-VALORACIONES PR2 · cobertura de las APIs nuevas (camelCase, fecha
// YYYY-MM-DD, activoId siempre string, soft delete, subtipo opcional).
// Las APIs legacy se cubren en valoracionesService.indexV69.test.ts.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('valoracionesService v2 · API nueva (top-level exports)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('create + getById · happy path', async () => {
    const m = await import('../valoracionesService');
    const id = await m.create({
      activoId: 'plan-1',
      tipoActivo: 'plan_pensiones',
      fecha: '2024-06-15',
      valor: 1000,
      origen: 'manual',
    });
    expect(id).toBeGreaterThan(0);

    const v = await m.getById(id);
    expect(v).not.toBeNull();
    expect(v!.activoId).toBe('plan-1');
    expect(v!.valor).toBe(1000);
    expect(v!.divisaOriginal).toBe('EUR');
    expect(v!.deletedAt).toBeNull();
  });

  it('validateValoracionInput · fecha sin formato YYYY-MM-DD lanza', async () => {
    const m = await import('../valoracionesService');
    await expect(
      m.create({
        activoId: 'a1',
        tipoActivo: 'inversion',
        fecha: '2024-06',
        valor: 100,
        origen: 'manual',
      }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it('validateValoracionInput · subtipoInversion solo si tipoActivo===inversion', async () => {
    const m = await import('../valoracionesService');
    await expect(
      m.create({
        activoId: 'a1',
        tipoActivo: 'plan_pensiones',
        subtipoInversion: 'fondo',
        fecha: '2024-06-15',
        valor: 100,
        origen: 'manual',
      }),
    ).rejects.toThrow(/subtipoInversion/);
  });

  it('update · activoId y tipoActivo inmutables', async () => {
    const m = await import('../valoracionesService');
    const id = await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-06-15',
      valor: 100,
      origen: 'manual',
    });
    await expect(m.update(id, { activoId: 'a2' } as any)).rejects.toThrow(/activoId/);
    await expect(m.update(id, { tipoActivo: 'inmueble' } as any)).rejects.toThrow(/tipoActivo/);
  });

  it('update · campos mutables actualizan correctamente', async () => {
    const m = await import('../valoracionesService');
    const id = await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-06-15',
      valor: 100,
      origen: 'manual',
    });
    await m.update(id, { valor: 250, notas: 'corregido' });
    const v = await m.getById(id);
    expect(v!.valor).toBe(250);
    expect(v!.notas).toBe('corregido');
  });

  it('softDelete + getById devuelve null · restore reactiva', async () => {
    const m = await import('../valoracionesService');
    const id = await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-06-15',
      valor: 100,
      origen: 'manual',
    });
    await m.softDelete(id);
    expect(await m.getById(id)).toBeNull();
    await m.restore(id);
    const v = await m.getById(id);
    expect(v).not.toBeNull();
    expect(v!.deletedAt).toBeNull();
  });

  it('getSerie · ordenada asc por fecha · excluye borradas por defecto', async () => {
    const m = await import('../valoracionesService');
    for (const f of ['2024-03-01', '2024-01-01', '2024-02-01']) {
      await m.create({
        activoId: 'a1',
        tipoActivo: 'inversion',
        fecha: f,
        valor: 100,
        origen: 'manual',
      });
    }
    const idTo = await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-04-01',
      valor: 999,
      origen: 'manual',
    });
    await m.softDelete(idTo);

    const serie = await m.getSerie('a1');
    expect(serie.map((v) => v.fecha)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
  });

  it('getSerie · filtra por desde/hasta', async () => {
    const m = await import('../valoracionesService');
    for (const f of ['2024-01-01', '2024-06-01', '2024-12-01']) {
      await m.create({
        activoId: 'a1',
        tipoActivo: 'inversion',
        fecha: f,
        valor: 100,
        origen: 'manual',
      });
    }
    const r = await m.getSerie('a1', { desde: '2024-05-01', hasta: '2024-11-01' });
    expect(r).toHaveLength(1);
    expect(r[0].fecha).toBe('2024-06-01');
  });

  it('getValorActual · con 0 valoraciones devuelve null', async () => {
    const m = await import('../valoracionesService');
    expect(await m.getValorActual('inexistente')).toBeNull();
  });

  it('getValorActual · devuelve la última', async () => {
    const m = await import('../valoracionesService');
    await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-01-01',
      valor: 100,
      origen: 'manual',
    });
    await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-06-01',
      valor: 500,
      origen: 'manual',
    });
    expect(await m.getValorActual('a1')).toBe(500);
  });

  it('getValorAFecha · devuelve valoración exacta o anterior', async () => {
    const m = await import('../valoracionesService');
    for (const [f, v] of [
      ['2024-01-01', 100],
      ['2024-06-01', 300],
      ['2024-12-01', 500],
    ] as Array<[string, number]>) {
      await m.create({
        activoId: 'a1',
        tipoActivo: 'inversion',
        fecha: f,
        valor: v,
        origen: 'manual',
      });
    }
    expect(await m.getValorAFecha('a1', '2024-06-01')).toBe(300); // exacta
    expect(await m.getValorAFecha('a1', '2024-08-15')).toBe(300); // anterior
    expect(await m.getValorAFecha('a1', '2024-01-01')).toBe(100);
    expect(await m.getValorAFecha('a1', '2023-01-01')).toBeNull(); // antes de la 1ª
  });

  it('upsertByDate · soft-deletea la anterior y crea nueva', async () => {
    const m = await import('../valoracionesService');
    const idOrig = await m.create({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-06-01',
      valor: 100,
      origen: 'manual',
    });
    const idNew = await m.upsertByDate({
      activoId: 'a1',
      tipoActivo: 'inversion',
      fecha: '2024-06-01',
      valor: 999,
      origen: 'manual',
    });
    expect(idNew).not.toBe(idOrig);
    const serie = await m.getSerie('a1');
    expect(serie).toHaveLength(1);
    expect(serie[0].valor).toBe(999);
    const serieConBorradas = await m.getSerie('a1', { incluyeBorradas: true });
    expect(serieConBorradas).toHaveLength(2);
    const old = serieConBorradas.find((v) => v.id === idOrig);
    expect(old?.deletedAt).not.toBeNull();
    expect(old?.notas).toContain('reemplazada por upsert');
  });

  it('bulkInsert · 100 entradas en una sola tx', async () => {
    const m = await import('../valoracionesService');
    const inputs = Array.from({ length: 100 }, (_, i) => ({
      activoId: 'a-bulk',
      tipoActivo: 'inversion' as const,
      fecha: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      valor: i + 1,
      origen: 'import_csv' as const,
    }));
    const ids = await m.bulkInsert(inputs);
    expect(ids).toHaveLength(100);
    const serie = await m.getSerie('a-bulk');
    expect(serie).toHaveLength(100);
  });

  it('getPatrimonioTotal · suma la última valoración no borrada de cada activo', async () => {
    const m = await import('../valoracionesService');
    await m.create({ activoId: 'a1', tipoActivo: 'inversion', fecha: '2024-01-01', valor: 100, origen: 'manual' });
    await m.create({ activoId: 'a1', tipoActivo: 'inversion', fecha: '2024-06-01', valor: 500, origen: 'manual' });
    await m.create({ activoId: 'a2', tipoActivo: 'inmueble', fecha: '2024-03-01', valor: 200000, origen: 'manual' });
    expect(await m.getPatrimonioTotal()).toBe(500 + 200000);
  });

  it('getPatrimonioTotal · a fecha pasada usa última valoración hasta esa fecha', async () => {
    const m = await import('../valoracionesService');
    await m.create({ activoId: 'a1', tipoActivo: 'inversion', fecha: '2024-01-01', valor: 100, origen: 'manual' });
    await m.create({ activoId: 'a1', tipoActivo: 'inversion', fecha: '2024-06-01', valor: 500, origen: 'manual' });
    expect(await m.getPatrimonioTotal('2024-03-15')).toBe(100);
  });

  it('getPatrimonioPorTipo · agrupa correctamente', async () => {
    const m = await import('../valoracionesService');
    await m.create({ activoId: 'p1', tipoActivo: 'inmueble', fecha: '2024-01-01', valor: 200000, origen: 'manual' });
    await m.create({ activoId: 'i1', tipoActivo: 'inversion', fecha: '2024-01-01', valor: 5000, origen: 'manual' });
    await m.create({ activoId: 'pp1', tipoActivo: 'plan_pensiones', fecha: '2024-01-01', valor: 30000, origen: 'manual' });
    const por = await m.getPatrimonioPorTipo();
    expect(por.inmueble).toBe(200000);
    expect(por.inversion).toBe(5000);
    expect(por.plan_pensiones).toBe(30000);
    expect(por.deposito).toBe(0);
    expect(por.otro).toBe(0);
  });

  it('getPatrimonioPorSubtipoInversion · agrupa por subtipo', async () => {
    const m = await import('../valoracionesService');
    await m.create({ activoId: 'i1', tipoActivo: 'inversion', subtipoInversion: 'fondo', fecha: '2024-01-01', valor: 1000, origen: 'manual' });
    await m.create({ activoId: 'i2', tipoActivo: 'inversion', subtipoInversion: 'accion', fecha: '2024-01-01', valor: 2000, origen: 'manual' });
    await m.create({ activoId: 'i3', tipoActivo: 'inversion', fecha: '2024-01-01', valor: 500, origen: 'manual' });
    await m.create({ activoId: 'p1', tipoActivo: 'inmueble', fecha: '2024-01-01', valor: 99999, origen: 'manual' });
    const por = await m.getPatrimonioPorSubtipoInversion();
    expect(por.fondo).toBe(1000);
    expect(por.accion).toBe(2000);
    expect(por.sin_subtipo).toBe(500);
    expect(por.etf).toBe(0);
    expect(por.crypto).toBe(0);
  });

  it('deleteAllByActivo · hard-delete de todas las valoraciones del activo', async () => {
    const m = await import('../valoracionesService');
    await m.create({ activoId: 'a1', tipoActivo: 'inversion', fecha: '2024-01-01', valor: 100, origen: 'manual' });
    await m.create({ activoId: 'a1', tipoActivo: 'inversion', fecha: '2024-02-01', valor: 200, origen: 'manual' });
    await m.create({ activoId: 'a2', tipoActivo: 'inversion', fecha: '2024-01-01', valor: 999, origen: 'manual' });
    const n = await m.deleteAllByActivo('a1');
    expect(n).toBe(2);
    expect(await m.getSerie('a1', { incluyeBorradas: true })).toHaveLength(0);
    expect(await m.getSerie('a2', { incluyeBorradas: true })).toHaveLength(1);
  });
});

describe('valoracionesService v2 · adapters legacy (firma intacta)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('guardarValoracionActivo · acepta legacy ValoracionInput y escribe al nuevo store', async () => {
    const { valoracionesService } = await import('../valoracionesService');
    const { initDB } = await import('../db');
    const db = await initDB();
    await valoracionesService.guardarValoracionActivo('2024-06', {
      tipo_activo: 'inversion',
      activo_id: 42,
      activo_nombre: 'Fondo Test',
      valor: 12345,
      notas: 'unit',
    });
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(1);
    expect(all[0].tipoActivo).toBe('inversion');
    expect(all[0].activoId).toBe('42');
    expect(all[0].fecha).toBe('2024-06-01');
    expect(all[0].valor).toBe(12345);
    expect(all[0].origen).toBe('manual');
    expect(all[0].activoNombre).toBe('Fondo Test');
  });

  it('guardarValoracionActivo · idempotente · sobreescribe valoración del mismo mes', async () => {
    const { valoracionesService } = await import('../valoracionesService');
    const { initDB } = await import('../db');
    const db = await initDB();
    await valoracionesService.guardarValoracionActivo('2024-06', {
      tipo_activo: 'inversion',
      activo_id: 42,
      activo_nombre: 'Fondo Test',
      valor: 100,
    });
    await valoracionesService.guardarValoracionActivo('2024-06', {
      tipo_activo: 'inversion',
      activo_id: 42,
      activo_nombre: 'Fondo Test',
      valor: 200,
    });
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(1); // misma valoración sobrescrita
    expect(all[0].valor).toBe(200);
  });

  it('getUltimaValoracion · devuelve shape legacy con fecha_valoracion YYYY-MM', async () => {
    const { valoracionesService } = await import('../valoracionesService');
    await valoracionesService.guardarValoracionActivo('2024-06', {
      tipo_activo: 'inversion',
      activo_id: 42,
      activo_nombre: 'Fondo Test',
      valor: 100,
    });
    const r = await valoracionesService.getUltimaValoracion('inversion', 42);
    expect(r).toBeDefined();
    expect(r!.fecha_valoracion).toBe('2024-06'); // YYYY-MM (legacy)
    expect(r!.tipo_activo).toBe('inversion');
    expect(String(r!.activo_id)).toBe('42');
    expect(r!.valor).toBe(100);
    expect(r!.activo_nombre).toBe('Fondo Test');
  });

  it('listarValoraciones · filtro por tipo_activo y activo_id', async () => {
    const { valoracionesService } = await import('../valoracionesService');
    await valoracionesService.guardarValoracionActivo('2024-01', {
      tipo_activo: 'inversion',
      activo_id: 1,
      activo_nombre: 'A',
      valor: 100,
    });
    await valoracionesService.guardarValoracionActivo('2024-01', {
      tipo_activo: 'inmueble',
      activo_id: 2,
      activo_nombre: 'B',
      valor: 200,
    });
    const soloInversion = await valoracionesService.listarValoraciones({ tipo_activo: 'inversion' });
    expect(soloInversion).toHaveLength(1);
    expect(soloInversion[0].tipo_activo).toBe('inversion');

    const soloId2 = await valoracionesService.listarValoraciones({ activo_id: 2 });
    expect(soloId2).toHaveLength(1);
    expect(String(soloId2[0].activo_id)).toBe('2');
  });

  it('actualizarValoracion · respeta firma legacy (updates con fecha_valoracion YYYY-MM)', async () => {
    const { valoracionesService } = await import('../valoracionesService');
    const { initDB } = await import('../db');
    const db = await initDB();
    const id = (await (db as any).add('valoracionesActivos', {
      tipoActivo: 'inversion',
      activoId: '42',
      fecha: '2024-06-01',
      valor: 100,
      origen: 'manual',
      divisaOriginal: 'EUR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })) as number;

    const updated = await valoracionesService.actualizarValoracion(id, {
      valor: 999,
      fecha_valoracion: '2024-07', // YYYY-MM legacy input
      notas: 'edit',
    });
    expect(updated.valor).toBe(999);
    expect(updated.fecha_valoracion).toBe('2024-07');
    expect(updated.notas).toBe('edit');
  });

  it('eliminarValoracion · hard-delete (legacy)', async () => {
    const { valoracionesService } = await import('../valoracionesService');
    const { initDB } = await import('../db');
    const db = await initDB();
    const id = (await (db as any).add('valoracionesActivos', {
      tipoActivo: 'inversion',
      activoId: '42',
      fecha: '2024-06-01',
      valor: 100,
      origen: 'manual',
      divisaOriginal: 'EUR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })) as number;
    await valoracionesService.eliminarValoracion(id);
    const all = (await (db as any).getAll('valoracionesActivos')) as any[];
    expect(all).toHaveLength(0);
  });
});
