import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Índice real del IPV de segunda mano, recortado.
const ipv = {
  esquema: 1 as const,
  id: 'ipv-segunda-mano' as const,
  nombre: 'IPV · índice de vivienda de segunda mano (nacional)',
  unidad: 'indice' as const,
  cadenciaMeses: 3,
  fuente: { nombre: 'INE · API Tempus3', url: 'https://x.test', serieOrigen: 'IPV1618' },
  actualizadoEn: '2026-08-22T05:00:00.000Z',
  valores: { '2015-06': 57.361, '2025-12': 104.001, '2026-03': 107.666 },
};

describe('revalorizarCompra', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ipv,
    });
  });

  it('lleva el precio de compra a hoy con el índice', async () => {
    const { revalorizarCompra } = require('../revalorizacionService');

    const r = await revalorizarCompra(180000, '2015-06-15', '2026-08-22');
    expect(r.factor).toBeCloseTo(107.666 / 57.361, 6);
    expect(r.valor).toBe(Math.round(180000 * (107.666 / 57.361)));
    expect(r.periodoCompra).toBe('2015-06');
    expect(r.periodoActual).toBe('2026-03');
  });

  // El mes de la compra casi nunca coincide con un trimestre publicado.
  it('usa el trimestre cerrado antes de la compra', async () => {
    const { revalorizarCompra } = require('../revalorizacionService');

    const enAgosto = await revalorizarCompra(180000, '2015-08-01', '2026-08-22');
    expect(enAgosto.factor).toBeCloseTo(107.666 / 57.361, 6);
  });

  it('sin precio o sin fecha no calcula nada', async () => {
    const { revalorizarCompra } = require('../revalorizacionService');

    expect(await revalorizarCompra(0, '2015-06-15')).toBeNull();
    expect(await revalorizarCompra(180000, '')).toBeNull();
  });

  // Una compra anterior al arranque de la serie no tiene con qué compararse.
  it('sin trimestre cerca de la compra devuelve null', async () => {
    const { revalorizarCompra } = require('../revalorizacionService');

    expect(await revalorizarCompra(180000, '2001-05-01', '2026-08-22')).toBeNull();
  });

  it('sin serie disponible no se inventa una revalorización', async () => {
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('sin red'));
    const { revalorizarCompra } = require('../revalorizacionService');

    expect(await revalorizarCompra(180000, '2015-06-15')).toBeNull();
  });
});
