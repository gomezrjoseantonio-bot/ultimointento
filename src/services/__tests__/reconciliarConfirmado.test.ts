// D1 (E1.5) · el Confirmado se CONSERVA y recibe el aval del banco.
//
// Antes (hasta E1.4) esta función colapsaba la línea del import contra el
// confirmado: sobrevivía la del import, se borraba el confirmado y había que
// repuntar todo lo que le apuntaba (patas de traspaso, líneas de gasto, el
// evento). Tras el corte no nace ningún duplicado, así que se invierte: el
// confirmado sigue siendo el movimiento, sube a Conciliado y toma del banco el
// importe y las fechas. Sus patas, su evento y su línea de gasto no se tocan.
//
// El caso de §4.4: el confirmado es una PATA de traspaso ya creada. Al subir el
// extracto de su cuenta, su línea la confirma: sigue siendo traspaso, su pareja
// sigue apuntándole y no aparece ninguna entrada duplicada.

import { aplicarReconciliacionConfirmado } from '../reconciliarConfirmado';

let movimientos: Record<number, any>;
let lineas: Record<number, any>;
let eventos: Record<number, any>;

const db: any = {
  get: async (s: string, id: number) =>
    s === 'movements' ? movimientos[id] : s === 'treasuryEvents' ? eventos[id] : undefined,
  getAll: async (s: string) =>
    s === 'lineasExtracto' ? Object.values(lineas) : s === 'movements' ? Object.values(movimientos) : [],
  put: async (s: string, v: any) => {
    const store = s === 'movements' ? movimientos : s === 'lineasExtracto' ? lineas : eventos;
    store[v.id] = v;
    return v.id;
  },
  delete: async (s: string, id: number) => {
    if (s === 'movements') delete movimientos[id];
  },
};

const NOW = '2026-08-20T00:00:00.000Z';

describe('reconciliar una pata de traspaso con su extracto (§4.4 · D1)', () => {
  beforeEach(() => {
    movimientos = {
      // Pata de SALIDA · vino del extracto de la cuenta origen (source import),
      // apunta con pairMovementId a la entrada (6).
      5: {
        id: 5,
        accountId: 1,
        amount: -200,
        source: 'import',
        type: 'Transferencia',
        categoryKey: 'traspaso_salida',
        transferMetadata: { targetAccountId: 9, pairMovementId: 6 },
      },
      // Pata de ENTRADA · la creó convertirEnTraspaso, manual, aún sin extracto.
      6: {
        id: 6,
        accountId: 9,
        date: '2026-08-18',
        amount: 200,
        source: 'manual',
        type: 'Transferencia',
        categoryKey: 'traspaso_entrada',
        categoryLabel: 'Traspaso · entrada',
        category: { tipo: 'Traspaso' },
        transferMetadata: { targetAccountId: 1 },
        unifiedStatus: 'no_planificado',
      },
    };
    lineas = {};
    eventos = {};
  });

  // La línea del extracto de la cuenta destino · el +200 que confirma la entrada.
  const aval = { amount: 200, date: '2026-08-19', valueDate: '2026-08-20' };

  it('el confirmado (la entrada) sobrevive · sigue siendo traspaso y sube a conciliado con el dato del banco', async () => {
    const id = await aplicarReconciliacionConfirmado(db, aval, 6, NOW);
    expect(id).toBe(6);
    expect(movimientos[6]).toMatchObject({
      unifiedStatus: 'conciliado',
      movementState: 'Conciliado',
      statusConciliacion: 'match_automatico',
      categoryKey: 'traspaso_entrada',
      type: 'Transferencia',
      transferMetadata: { targetAccountId: 1 },
      amount: 200,
      date: '2026-08-19',
      valueDate: '2026-08-20',
      source: 'manual',
    });
  });

  it('la pata pareja (salida) no se toca · le sigue apuntando', async () => {
    await aplicarReconciliacionConfirmado(db, aval, 6, NOW);
    expect(movimientos[5].transferMetadata.pairMovementId).toBe(6);
  });

  it('no nace ningún movimiento · el dinero no se cuenta dos veces', async () => {
    await aplicarReconciliacionConfirmado(db, aval, 6, NOW);
    expect(Object.keys(movimientos).sort()).toEqual(['5', '6']);
  });

  it('un confirmado que ya no existe · no hay nada que avalar', async () => {
    expect(await aplicarReconciliacionConfirmado(db, aval, 99, NOW)).toBeNull();
    expect(Object.keys(movimientos).sort()).toEqual(['5', '6']);
  });

  it('es idempotente · repetirlo deja lo mismo', async () => {
    await aplicarReconciliacionConfirmado(db, aval, 6, NOW);
    const foto = JSON.stringify(movimientos);
    await aplicarReconciliacionConfirmado(db, aval, 6, NOW);
    expect(JSON.stringify(movimientos)).toBe(foto);
  });
});

describe('un previsto PUNTEADO · su evento sigue apuntándole y toma el dato real', () => {
  beforeEach(() => {
    movimientos = {
      9: {
        id: 9, accountId: 42, date: '2026-04-14', amount: -20, description: 'Comunidad',
        source: 'manual', unifiedStatus: 'conciliado', reference: 'treasury_event:700',
        categoryKey: 'inmueble.comunidad',
      },
    };
    eventos = {
      700: { id: 700, accountId: 42, type: 'expense', amount: 20, status: 'executed', movementId: 9, executedMovementId: 9, actualDate: '2026-04-14', actualAmount: 20 },
    };
    lineas = {};
  });

  it('el evento no se re-apunta · se queda en el confirmado con la fecha y el importe del banco', async () => {
    await aplicarReconciliacionConfirmado(db, { amount: -20, date: '2026-04-15' }, 9, NOW);
    expect(eventos[700]).toMatchObject({ movementId: 9, executedMovementId: 9, actualDate: '2026-04-15', actualAmount: 20 });
    expect(movimientos[9]).toMatchObject({ date: '2026-04-15', unifiedStatus: 'conciliado', description: 'Comunidad' });
  });
});

describe('pares ANTERIORES al corte · el duplicado del import se va', () => {
  beforeEach(() => {
    movimientos = {
      9: { id: 9, accountId: 42, date: '2026-04-14', amount: -20, description: 'Comunidad', source: 'manual', categoryKey: 'inmueble.comunidad' },
      50: { id: 50, accountId: 42, date: '2026-04-15', amount: -20, description: 'RECIBO COMUNIDAD', source: 'import', importBatch: 'lote-viejo' },
    };
    lineas = {
      // La línea de la que nació el duplicado (E1.1) · pasa a apuntar al confirmado.
      500: { id: 500, importBatchId: 'lote-viejo', movementIds: [50], estado: 'resuelta' },
    };
    eventos = {};
  });

  it('se borra el import, el confirmado se queda, y la línea repunta al confirmado', async () => {
    const id = await aplicarReconciliacionConfirmado(
      db, { amount: -20, date: '2026-04-15', importMovementId: 50 }, 9, NOW
    );
    expect(id).toBe(9);
    expect(movimientos[50]).toBeUndefined();
    expect(movimientos[9]).toMatchObject({ date: '2026-04-15', unifiedStatus: 'conciliado', categoryKey: 'inmueble.comunidad' });
    expect(lineas[500].movementIds).toEqual([9]);
  });
});
