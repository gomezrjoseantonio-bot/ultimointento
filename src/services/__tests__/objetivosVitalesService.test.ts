// Tests · objetivosVitalesService (PR 3).
// Cobertura · validación · CRUD · semántica de patch · filtro por fecha/planId.

const mockDB: any = {
  get: jest.fn(),
  put: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../db', () => ({
  initDB: jest.fn(() => Promise.resolve(mockDB)),
}));

import {
  createObjetivoVital,
  deleteObjetivoVital,
  getHitosVitalesParaPosicion,
  getObjetivoVital,
  listObjetivosVitales,
  updateObjetivoVital,
} from '../objetivosVitalesService';
import { initDB } from '../db';
import type { ObjetivoVital } from '../../types/objetivosVitales';

const mockHito = (patch: Partial<ObjetivoVital> = {}): ObjetivoVital => ({
  id: 'h-1',
  nombre: 'Jubilación',
  fechaEstimada: '2049-12-31',
  descripcion: 'salida del mercado laboral',
  planFinancieroAsociado: null,
  tipo: 'jubilacion',
  fechaCreacion: '2026-05-17T00:00:00.000Z',
  fechaModificacion: '2026-05-17T00:00:00.000Z',
  ...patch,
});

beforeEach(() => {
  jest.clearAllMocks();
  (initDB as jest.Mock).mockResolvedValue(mockDB);
  mockDB.get.mockResolvedValue(undefined);
  mockDB.put.mockResolvedValue(undefined);
  mockDB.getAll.mockResolvedValue([]);
  mockDB.delete.mockResolvedValue(undefined);
});

describe('objetivosVitalesService · createObjetivoVital', () => {
  test('crea con metadata mínima · planFinancieroAsociado por defecto null', async () => {
    const h = await createObjetivoVital({
      nombre: '  Jubilación  ',
      fechaEstimada: '2049-12-31',
      tipo: 'jubilacion',
    });
    expect(h.nombre).toBe('Jubilación');
    expect(h.planFinancieroAsociado).toBeNull();
    expect(h.fechaEstimada).toBe('2049-12-31');
    expect(h.id).toBeTruthy();
    expect(mockDB.put).toHaveBeenCalledWith('objetivosVitales', expect.objectContaining({
      nombre: 'Jubilación',
      tipo: 'jubilacion',
    }));
  });

  test('rechaza nombre vacío', async () => {
    await expect(
      createObjetivoVital({ nombre: '', fechaEstimada: '2030-01-01', tipo: 'otro' }),
    ).rejects.toThrow(/nombre/);
  });

  test('rechaza fecha con formato inválido', async () => {
    await expect(
      createObjetivoVital({ nombre: 'x', fechaEstimada: '31/12/2030', tipo: 'otro' }),
    ).rejects.toThrow(/fechaEstimada/);
  });

  test('descripcion vacía · queda undefined (no string vacío)', async () => {
    const h = await createObjetivoVital({
      nombre: 'x',
      fechaEstimada: '2030-01-01',
      tipo: 'otro',
      descripcion: '   ',
    });
    expect(h.descripcion).toBeUndefined();
  });
});

describe('objetivosVitalesService · updateObjetivoVital · semántica de patch', () => {
  test('actualiza nombre · resto intacto', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ nombre: 'Antiguo' }));
    const r = await updateObjetivoVital('h-1', { nombre: 'Nuevo' });
    expect(r.nombre).toBe('Nuevo');
    expect(r.tipo).toBe('jubilacion');
  });

  test('patch sin descripcion · NO toca descripcion actual', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ descripcion: 'original' }));
    const r = await updateObjetivoVital('h-1', { nombre: 'X' });
    expect(r.descripcion).toBe('original');
  });

  test('descripcion="" · LIMPIA el campo (→ undefined)', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ descripcion: 'algo' }));
    const r = await updateObjetivoVital('h-1', { descripcion: '' });
    expect(r.descripcion).toBeUndefined();
  });

  test('descripcion=undefined explícito · NO toca (mismo trato que ausente)', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ descripcion: 'estable' }));
    const r = await updateObjetivoVital('h-1', {
      nombre: 'X',
      descripcion: undefined,
    });
    expect(r.descripcion).toBe('estable');
  });

  test('planFinancieroAsociado=null · desasocia', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ planFinancieroAsociado: 'plan-orange' }));
    const r = await updateObjetivoVital('h-1', { planFinancieroAsociado: null });
    expect(r.planFinancieroAsociado).toBeNull();
  });

  test('planFinancieroAsociado=string · asocia', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ planFinancieroAsociado: null }));
    const r = await updateObjetivoVital('h-1', { planFinancieroAsociado: 'plan-xyz' });
    expect(r.planFinancieroAsociado).toBe('plan-xyz');
  });

  test('planFinancieroAsociado=undefined explícito · NO toca', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ planFinancieroAsociado: 'plan-orange' }));
    const r = await updateObjetivoVital('h-1', { planFinancieroAsociado: undefined });
    expect(r.planFinancieroAsociado).toBe('plan-orange');
  });

  test('fechaEstimada formato inválido · rechaza', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito());
    await expect(
      updateObjetivoVital('h-1', { fechaEstimada: '2030/01/01' }),
    ).rejects.toThrow(/fechaEstimada/);
  });

  test('inexistente · error', async () => {
    mockDB.get.mockResolvedValueOnce(undefined);
    await expect(updateObjetivoVital('no-existe', { nombre: 'X' })).rejects.toThrow(/no encontrado/);
  });
});

describe('objetivosVitalesService · lectura + filtros', () => {
  test('listObjetivosVitales · ordena por fechaEstimada ascendente', async () => {
    mockDB.getAll.mockResolvedValueOnce([
      mockHito({ id: 'a', fechaEstimada: '2049-12-31' }),
      mockHito({ id: 'b', fechaEstimada: '2027-06-15' }),
      mockHito({ id: 'c', fechaEstimada: '2035-01-01' }),
    ]);
    const lista = await listObjetivosVitales();
    expect(lista.map((h) => h.id)).toEqual(['b', 'c', 'a']);
  });

  test('getObjetivoVital · delega a db.get', async () => {
    mockDB.get.mockResolvedValueOnce(mockHito({ id: 'h-9' }));
    const h = await getObjetivoVital('h-9');
    expect(h?.id).toBe('h-9');
    expect(mockDB.get).toHaveBeenCalledWith('objetivosVitales', 'h-9');
  });

  test('getHitosVitalesParaPosicion · filtra futuros + globales|asociados', async () => {
    const hoy = new Date('2026-05-17');
    mockDB.getAll.mockResolvedValueOnce([
      mockHito({ id: 'pasado', fechaEstimada: '2020-01-01', planFinancieroAsociado: null }),
      mockHito({ id: 'global', fechaEstimada: '2030-01-01', planFinancieroAsociado: null }),
      mockHito({ id: 'asociado-otro', fechaEstimada: '2030-06-01', planFinancieroAsociado: 'plan-otro' }),
      mockHito({ id: 'asociado-mio', fechaEstimada: '2031-01-01', planFinancieroAsociado: 'plan-orange' }),
      mockHito({ id: 'futuro-otro', fechaEstimada: '2032-01-01', planFinancieroAsociado: 'plan-zzz' }),
    ]);
    const filtrados = await getHitosVitalesParaPosicion('plan-orange', hoy);
    expect(filtrados.map((h) => h.id).sort()).toEqual(['asociado-mio', 'global']);
  });

  test('getHitosVitalesParaPosicion · sin hitos · devuelve array vacío', async () => {
    mockDB.getAll.mockResolvedValueOnce([]);
    const filtrados = await getHitosVitalesParaPosicion('plan-orange');
    expect(filtrados).toEqual([]);
  });
});

describe('objetivosVitalesService · deleteObjetivoVital', () => {
  test('delega a db.delete', async () => {
    await deleteObjetivoVital('h-7');
    expect(mockDB.delete).toHaveBeenCalledWith('objetivosVitales', 'h-7');
  });
});
