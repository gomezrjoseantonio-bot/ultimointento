/**
 * Onboarding día 0 · C4 · plantilla de inmuebles (parser + creación).
 *
 * Cubre (§5 · C4):
 *   · el parser lee la plantilla generada (header + ejemplo) → fila válida
 *   · revisión · fila con financiado sin préstamo → aviso (pendiente semáforo)
 *   · creación · fila válida crea Property con estructura de compra
 *   · idempotencia por alias (no duplica)
 */
import * as fs from 'fs';
import * as path from 'path';

const mockProperties: Array<Record<string, unknown>> = [];
let mockNextId = 1;

jest.mock('../db', () => ({
  __esModule: true,
  initDB: async () => ({
    getAll: async (store: string) => (store === 'properties' ? mockProperties : []),
    add: async (store: string, value: Record<string, unknown>) => {
      if (store !== 'properties') return undefined;
      const id = mockNextId++;
      mockProperties.push({ ...value, id });
      return id;
    },
  }),
}));

import { parseInmueblesTemplateXlsx } from '../inmueblesTemplateParserService';
import {
  revisarRow,
  crearInmueblesDesdeRows,
} from '../inmueblesImportCreationService';

function loadTemplateAsFile(): File {
  const p = path.join(process.cwd(), 'public', 'templates', 'plantilla-inmuebles-atlas.xlsx');
  const buf = fs.readFileSync(p);
  // XLSX.read(..., {type:'array'}) espera bytes (Uint8Array), no un ArrayBuffer crudo.
  return { arrayBuffer: async () => new Uint8Array(buf) } as unknown as File;
}

beforeEach(() => {
  mockProperties.length = 0;
  mockNextId = 1;
});

describe('parser de la plantilla de inmuebles', () => {
  it('lee la plantilla generada · fila ejemplo con estructura de compra', async () => {
    const rows = await parseInmueblesTemplateXlsx(loadTemplateAsFile());
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.alias).toBe('Piso Centro');
    expect(r.modoExplotacion).toBe('piso_completo');
    expect(r.precioCompra).toBe(100000);
    expect(r.gastosCompra).toBe(12000);
    expect(r.aportacionPropia).toBe(32000);
    expect(r.importeFinanciado).toBe(80000);
    expect(r.valorCatastral).toBe(60000);
    expect(r.valorCatastralConstruccion).toBe(42000);
  });
});

describe('revisión de filas', () => {
  const base = {
    filaOriginal: 2,
    alias: 'Piso',
    direccion: null,
    refCatastral: null,
    modoExplotacion: 'piso_completo' as const,
    numeroHabitaciones: null,
    fechaCompra: '2021-01-01',
    precioCompra: 100000,
    gastosCompra: 10000,
    aportacionPropia: 0,
    importeFinanciado: 0,
    valorCatastral: 0,
    valorCatastralConstruccion: 0,
  };

  it('fila con financiado sin préstamo → aviso para el semáforo', () => {
    const rev = revisarRow({ ...base, importeFinanciado: 80000 });
    expect(rev.valido).toBe(true);
    expect(rev.avisos.join(' ')).toMatch(/vincular el préstamo/i);
  });

  it('fila sin alias → inválida', () => {
    const rev = revisarRow({ ...base, alias: '' });
    expect(rev.valido).toBe(false);
  });
});

describe('creación de inmuebles', () => {
  it('fila válida crea Property con estructuraCompra (aportación + financiado)', async () => {
    const rows = await parseInmueblesTemplateXlsx(loadTemplateAsFile());
    const res = await crearInmueblesDesdeRows(rows);
    expect(res.creados).toBe(1);
    expect(res.avisos.some((a) => /vincular el préstamo/i.test(a.aviso))).toBe(true);

    const creada = mockProperties[0] as {
      estructuraCompra: Record<string, number>;
      acquisitionCosts: { price: number };
      modoExplotacion: string;
    };
    expect(creada.acquisitionCosts.price).toBe(100000);
    expect(creada.estructuraCompra).toEqual({
      aportacionPropia: 32000,
      importeFinanciado: 80000,
    });
    expect(creada.modoExplotacion).toBe('piso_completo');
  });

  it('idempotente por alias · no duplica en una segunda pasada', async () => {
    const rows = await parseInmueblesTemplateXlsx(loadTemplateAsFile());
    await crearInmueblesDesdeRows(rows);
    const res2 = await crearInmueblesDesdeRows(rows);
    expect(res2.creados).toBe(0);
    expect(res2.saltados).toBe(1);
    expect(mockProperties).toHaveLength(1);
  });
});
