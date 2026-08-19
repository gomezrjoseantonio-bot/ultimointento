// Colapsar un Confirmado contra la línea del extracto que lo confirma.
//
// El caso nuevo (§4.4): el confirmado es una PATA de traspaso ya creada. Al subir
// el extracto de su cuenta, su línea la confirma. No basta con heredar la
// categoría: hay que conservar que es un traspaso (`transferMetadata`, type) y
// repuntar su pata pareja, o el par salida↔entrada se rompería.

import { aplicarReconciliacionConfirmado } from '../reconciliarConfirmado';
import type { Movement } from '../db';

let movimientos: Record<number, any>;

const db: any = {
  get: async (_s: string, id: number) => movimientos[id],
  getAll: async () => Object.values(movimientos),
  put: async (_s: string, v: any) => {
    movimientos[v.id] = v;
    return v.id;
  },
  delete: async (_s: string, id: number) => {
    delete movimientos[id];
  },
};

const NOW = '2026-08-20T00:00:00.000Z';

describe('reconciliar una pata de traspaso con su extracto (§4.4)', () => {
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
        amount: 200,
        source: 'manual',
        type: 'Transferencia',
        categoryKey: 'traspaso_entrada',
        categoryLabel: 'Traspaso · entrada',
        category: { tipo: 'Traspaso' },
        transferMetadata: { targetAccountId: 1 },
        unifiedStatus: 'no_planificado',
      },
      // La línea del extracto de la cuenta destino · el +200 que confirma la
      // entrada. Entró como un ingreso normal al importar.
      100: {
        id: 100,
        accountId: 9,
        amount: 200,
        source: 'import',
        type: 'Ingreso',
        description: 'TRANSFERENCIA RECIBIDA',
      },
    };
  });

  it('la línea del import sobrevive como la entrada · conserva que es traspaso', async () => {
    await aplicarReconciliacionConfirmado(db, movimientos[100] as Movement, 6, NOW);

    expect(movimientos[100].unifiedStatus).toBe('conciliado');
    expect(movimientos[100].categoryKey).toBe('traspaso_entrada');
    expect(movimientos[100].type).toBe('Transferencia');
    expect(movimientos[100].transferMetadata).toEqual({ targetAccountId: 1 });
  });

  it('la pata pareja (salida) se repunta a la línea del import', async () => {
    await aplicarReconciliacionConfirmado(db, movimientos[100] as Movement, 6, NOW);

    expect(movimientos[5].transferMetadata.pairMovementId).toBe(100);
  });

  it('el confirmado (la entrada vieja) se borra · el dinero no se cuenta dos veces', async () => {
    await aplicarReconciliacionConfirmado(db, movimientos[100] as Movement, 6, NOW);

    expect(movimientos[6]).toBeUndefined();
    // Quedan dos patas · salida (5) y la línea del import que hace de entrada (100).
    expect(Object.keys(movimientos).sort()).toEqual(['100', '5']);
  });
});
