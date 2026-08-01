// Candado del flujo de líneas ignoradas (V6 · D1 · adenda 03).
//
// Lo que protege: que una línea ignorada NO reaparezca al reimportar el mismo
// extracto, que recuperar la devuelva, y que un cambio futuro del normalizador
// se note en vez de esconder líneas equivocadas.

import {
  getIgnoredLineHashes,
  getStaleIgnoredLineHashes,
  ignoreLine,
  recoverLine,
  splitIgnoradas,
  generateLineHash,
} from '../statementIgnoredLinesService';
import { initDB, ImportBatch } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));

interface FakeStores {
  importBatches: ImportBatch[];
}

const batch = (id: string, accountId: number): ImportBatch => ({
  id,
  filename: `${id}.csv`,
  accountId,
  totalRows: 0,
  importedRows: 0,
  skippedRows: 0,
  duplicatedRows: 0,
  errorRows: 0,
  origenBanco: 'sabadell',
  formatoDetectado: 'CSV',
  rangoFechas: { min: '2026-03-01', max: '2026-03-31' },
  timestampImport: '2026-03-31T09:00:00.000Z',
  hashLote: `hash-${id}`,
  createdAt: '2026-03-31T09:00:00.000Z',
});

let stores: FakeStores;

beforeEach(() => {
  stores = {
    importBatches: [batch('batch-1', 42), batch('batch-2', 42), batch('batch-otra', 99)],
  };
  (initDB as jest.Mock).mockResolvedValue(fakeDb({ conIndice: true }));
});

/**
 * `conIndice: false` reproduce un handle sin `getAllFromIndex` (mocks
 * parciales, backups), para cubrir también la rama de respaldo.
 */
function fakeDb({ conIndice }: { conIndice: boolean }) {
  const base = {
    getAll: async (name: keyof FakeStores) => stores[name],
    get: async (name: keyof FakeStores, id: string) => stores[name].find((b) => b.id === id),
    put: async (name: keyof FakeStores, value: { id: string }) => {
      const i = stores[name].findIndex((b) => b.id === value.id);
      if (i >= 0) stores[name][i] = value as never;
      else stores[name].push(value as never);
      return value.id;
    },
  };
  if (!conIndice) return base;
  return {
    ...base,
    getAllFromIndex: async (name: keyof FakeStores, index: string, key: number) => {
      if (index !== 'accountId') throw new Error(`índice no soportado: ${index}`);
      return stores[name].filter((b) => b.accountId === key);
    },
  };
}

const LUZ = { date: '2026-03-05', amount: -74.09, description: 'Recibo LUZ 03/2026 - Iberdrola' };
const AGUA = { date: '2026-03-07', amount: -21.4, description: 'AGUA · Aqualia' };

describe('identidad de línea', () => {
  it('es estable frente a acentos, mayúsculas, puntuación y espacios dobles', () => {
    // El motivo de usar el normalizador de duplicateDetection y no el
    // `toLowerCase()` del emparejamiento: el banco cambia estas cosas entre
    // exportaciones y la línea debe seguir siendo la misma.
    const a = generateLineHash({ date: '2026-03-05', amount: -74.09, description: 'Recibo LÚZ  03/2026 - Iberdrola' });
    const b = generateLineHash({ date: '2026-03-05', amount: -74.09, description: 'recibo luz 03/2026   iberdrola' });
    expect(a).toBe(b);
  });

  it('distingue importe, fecha y concepto', () => {
    const base = generateLineHash(LUZ);
    expect(generateLineHash({ ...LUZ, amount: -74.1 })).not.toBe(base);
    expect(generateLineHash({ ...LUZ, date: '2026-03-06' })).not.toBe(base);
    expect(generateLineHash({ ...LUZ, description: 'otra cosa' })).not.toBe(base);
  });

  it('no arrastra error de coma flotante en el importe', () => {
    expect(generateLineHash({ date: '2026-01-01', amount: 0.1 + 0.2 })).toBe(
      generateLineHash({ date: '2026-01-01', amount: 0.3 })
    );
  });

  it('va versionado, para que un cambio de algoritmo sea detectable', () => {
    expect(generateLineHash(LUZ).startsWith('v1:')).toBe(true);
  });

  it('acepta Date además de ISO, sin corrimiento de zona', () => {
    expect(generateLineHash({ date: '2026-03-05', amount: -1 })).toBe(
      generateLineHash({ date: new Date('2026-03-05T00:00:00Z'), amount: -1 })
    );
  });
});

describe('ignorar y recuperar', () => {
  it('una línea ignorada no vuelve a aparecer como "a resolver" al reimportar', async () => {
    await ignoreLine('batch-1', LUZ);

    const ignorados = await getIgnoredLineHashes(42);
    const { aResolver, ignoradas } = splitIgnoradas([LUZ, AGUA], ignorados);

    expect(aResolver).toEqual([AGUA]);
    expect(ignoradas).toHaveLength(1);
    expect(ignoradas[0].line).toBe(LUZ);
  });

  it('recuperar la devuelve a "a resolver", aunque se ignorara en otro batch', async () => {
    await ignoreLine('batch-1', LUZ);
    const hash = generateLineHash(LUZ);

    // La sesión en curso es otro batch · recoverLine busca en toda la cuenta.
    expect(await recoverLine(42, hash)).toBe(1);

    const { aResolver, ignoradas } = splitIgnoradas([LUZ, AGUA], await getIgnoredLineHashes(42));
    expect(aResolver).toEqual([LUZ, AGUA]);
    expect(ignoradas).toHaveLength(0);
  });

  it('ignorar dos veces no duplica la entrada ni reescribe la marca de tiempo', async () => {
    await ignoreLine('batch-1', LUZ, '2026-03-05T10:00:00.000Z');
    await ignoreLine('batch-1', LUZ, '2026-03-09T18:00:00.000Z');

    const batch = stores.importBatches.find((b) => b.id === 'batch-1')!;
    expect(batch.lineasIgnoradas).toHaveLength(1);
    expect(batch.lineasIgnoradas![0].ignoradaAt).toBe('2026-03-05T10:00:00.000Z');
  });

  it('recuperar algo que no estaba ignorado no rompe ni miente', async () => {
    expect(await recoverLine(42, generateLineHash(AGUA))).toBe(0);
  });

  it('no mezcla cuentas: lo ignorado en una no afecta a la otra', async () => {
    await ignoreLine('batch-1', LUZ); // batch-1 es de la cuenta 42

    expect(await getIgnoredLineHashes(42)).toContain(generateLineHash(LUZ));
    expect(await getIgnoredLineHashes(99)).not.toContain(generateLineHash(LUZ));
  });

  it('falla claro si el batch no existe, en vez de perder el ignorado en silencio', async () => {
    await expect(ignoreLine('no-existe', LUZ)).rejects.toThrow(/no encontrado/i);
  });
});

describe('acceso a los batches de la cuenta', () => {
  it('usa el índice accountId cuando está disponible', async () => {
    const db = fakeDb({ conIndice: true });
    const spy = jest.spyOn(db as never, 'getAllFromIndex');
    (initDB as jest.Mock).mockResolvedValue(db);

    await getIgnoredLineHashes(42);
    expect(spy).toHaveBeenCalledWith('importBatches', 'accountId', 42);
  });

  it('cae a getAll + filtro si el handle no expone getAllFromIndex', async () => {
    (initDB as jest.Mock).mockResolvedValue(fakeDb({ conIndice: false }));

    await ignoreLine('batch-1', LUZ);
    // Mismo resultado por la rama de respaldo, y sigue sin mezclar cuentas.
    expect(await getIgnoredLineHashes(42)).toContain(generateLineHash(LUZ));
    expect((await getIgnoredLineHashes(99)).size).toBe(0);
  });
});

describe('versión del hash', () => {
  it('ignora hashes de una versión antigua en vez de esconder líneas que no son', async () => {
    stores.importBatches[0].lineasIgnoradas = [
      { hashLinea: 'v0:2026-03-05|-7409|recibo luz', ignoradaAt: '2026-03-05T10:00:00.000Z' },
    ];

    // Reaparecer es el fallo seguro; esconder de más, no.
    expect((await getIgnoredLineHashes(42)).size).toBe(0);
    expect(await getStaleIgnoredLineHashes(42)).toHaveLength(1);
  });
});
