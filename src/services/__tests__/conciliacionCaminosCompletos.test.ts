// ============================================================================
// Los dos caminos de la conciliación, de extremo a extremo
// ============================================================================
//
// `conciliacionDatosReales.test.ts` fija la pieza (`camposDeCierre` y sus dos
// aplicadores). Esto comprueba que los servicios REALES la usan y que el
// resultado en la base es el que se quiere:
//
//   · B1 · `confirmDecisions` cuadra la línea del extracto con un previsto
//   · B2 · `aplicarReconciliacionConfirmado` colapsa la línea del extracto
//          contra un Confirmado ya punteado
//
// y que los dos textos —el del banco y el del usuario— conviven en el
// movimiento sin pisarse.
// ============================================================================

import { confirmDecisions } from '../bankStatementOrchestrator';
import { aplicarReconciliacionConfirmado } from '../reconciliarConfirmado';
import { initDB } from '../db';

jest.mock('../db', () => ({ initDB: jest.fn() }));
jest.mock('../movementSuggestionService', () => ({ suggestForUnmatched: jest.fn(async () => new Map()) }));
jest.mock('../movementLearningService', () => ({
  buildLearnKey: jest.fn(() => 'hash:any'),
  createOrUpdateRule: jest.fn(async () => ({})),
}));

interface Stores {
  movements: any[];
  treasuryEvents: any[];
  gastosInmueble: any[];
  importBatches: any[];
  accounts: any[];
}

let stores: Stores;

/** El recibo del agua · previsto 82,00 € el 27-8, cargado 87,40 € el 3-9. */
function sembrar(): void {
  stores = {
    // La línea que llegó en el extracto · el texto crudo del banco.
    movements: [
      {
        id: 31,
        accountId: 9,
        amount: -87.4,
        date: '2026-09-03',
        valueDate: '2026-09-04',
        description: 'ADEUDO RECIBO AQUALIA SA 0034ES',
        source: 'import',
        unifiedStatus: 'no_planificado',
        statusConciliacion: 'sin_match',
      },
    ],
    treasuryEvents: [
      {
        id: 7,
        status: 'predicted',
        type: 'expense',
        amount: 82,
        predictedDate: '2026-08-27',
        description: 'Agua Tenderina',
        sourceType: 'gasto_recurrente',
        sourceId: 42,
        año: 2026,
        mes: 8,
        ambito: 'INMUEBLE',
        inmuebleId: 1,
        categoryKey: 'suministro_inmueble',
        accountId: 9,
      },
    ],
    // La línea que DECLARA el gasto · la creó el generador de recurrentes.
    gastosInmueble: [
      {
        id: 5,
        inmuebleId: 1,
        ejercicio: 2026,
        fecha: '2026-08-27',
        concepto: 'Agua Tenderina',
        categoria: 'suministro',
        casillaAEAT: '0113',
        importe: 82,
        origen: 'recurrente',
        origenId: 'recurrente-42-2026-8',
        estado: 'previsto',
        createdAt: '',
        updatedAt: '',
      },
    ],
    importBatches: [],
    accounts: [],
  };
}

const db: any = {
  add: async (s: keyof Stores, row: any) => {
    const id = (stores[s].length + 1) * 100;
    stores[s].push({ ...row, id });
    return id;
  },
  put: async (s: keyof Stores, row: any) => {
    const list = stores[s];
    const i = list.findIndex((r: any) => r.id === row.id);
    if (i >= 0) list[i] = row;
    else list.push(row);
    return row.id;
  },
  get: async (s: keyof Stores, key: number | string) =>
    stores[s].find((r: any) => r.id === key),
  getAll: async (s: keyof Stores) => stores[s] ?? [],
  getAllFromIndex: async (s: keyof Stores, index: string, clave: unknown) => {
    if (s !== 'gastosInmueble') return [];
    if (index === 'treasuryEventId') {
      return stores.gastosInmueble.filter((l) => l.treasuryEventId === clave);
    }
    if (index === 'origen-origenId') {
      const [origen, origenId] = clave as [string, string];
      return stores.gastosInmueble.filter((l) => l.origen === origen && l.origenId === origenId);
    }
    return [];
  },
  delete: async (s: keyof Stores, key: number | string) => {
    const list = stores[s];
    const i = list.findIndex((r: any) => r.id === key);
    if (i >= 0) list.splice(i, 1);
  },
};

const linea = () => stores.gastosInmueble[0];
const movimiento = (id: number) => stores.movements.find((m) => m.id === id);

beforeEach(() => {
  sembrar();
  (initDB as jest.Mock).mockResolvedValue(db);
});

// ─── B1 · cuadrar la línea del extracto con un previsto ─────────────────────

describe('B1 · confirmDecisions escribe el dato del banco en la línea de gasto', () => {
  const cuadrar = () =>
    confirmDecisions('lote-1', {
      approvedMatches: [{ movementId: 31, treasuryEventId: 7 }],
      approvedSuggestions: [],
      ignoredMovementIds: [],
    });

  it('la línea se deduce por 87,40 · no por los 82,00 previstos', async () => {
    await cuadrar();
    expect(linea().importe).toBe(87.4);
  });

  it('y con la fecha del cargo real', async () => {
    await cuadrar();
    expect(linea().fecha).toBe('2026-09-03');
    expect(linea().fechaValor).toBe('2026-09-04');
    expect(linea().ejercicio).toBe(2026);
  });

  it('la línea queda cerrada y atada al movimiento del banco', async () => {
    await cuadrar();
    expect(linea().estado).toBe('confirmado');
    expect(linea().estadoTesoreria).toBe('confirmed');
    expect(linea().movimientoId).toBe('31');
    expect(linea().treasuryEventId).toBe(7);
  });

  it('la clasificación que puso el usuario sobrevive', async () => {
    await cuadrar();
    expect(linea().concepto).toBe('Agua Tenderina');
    expect(linea().casillaAEAT).toBe('0113');
  });

  // D1 · los dos textos conviven.
  it('el texto del banco NO se toca · el hash del dedupe depende de él', async () => {
    await cuadrar();
    expect(movimiento(31).description).toBe('ADEUDO RECIBO AQUALIA SA 0034ES');
  });

  it('y el nombre de la previsión se guarda aparte', async () => {
    await cuadrar();
    expect(movimiento(31).descripcionPrevision).toBe('Agua Tenderina');
  });

  // D3 · magnitud, como el punteo manual.
  it('actualAmount va en magnitud · no con el signo del cargo', async () => {
    await cuadrar();
    expect(stores.treasuryEvents[0].actualAmount).toBe(87.4);
    expect(stores.treasuryEvents[0].actualDate).toBe('2026-09-03');
  });
});

// ─── B2 · colapsar contra un Confirmado ya punteado ─────────────────────────

describe('B2 · el colapso no deja la línea de gasto huérfana', () => {
  /**
   * El usuario punteó a mano ANTES de subir el extracto: hay un movimiento 20
   * con los 82,00 previstos, y la línea le apunta. Al subir el extracto, la
   * misma operación llega como movimiento 31 y el 20 se borra.
   */
  function conPunteoPrevio(): void {
    stores.movements.push({
      id: 20,
      accountId: 9,
      amount: -82,
      date: '2026-08-27',
      description: 'Agua Tenderina',
      source: 'manual',
      reference: 'treasury_event:7',
      categoryKey: 'suministro_inmueble',
      ambito: 'INMUEBLE',
      inmuebleId: '1',
    });
    Object.assign(stores.treasuryEvents[0], {
      status: 'executed',
      movementId: 20,
      executedMovementId: 20,
      actualAmount: 82,
      actualDate: '2026-08-27',
    });
    Object.assign(linea(), {
      estado: 'confirmado',
      estadoTesoreria: 'confirmed',
      movimientoId: '20',
      treasuryEventId: 7,
    });
  }

  const colapsar = () =>
    aplicarReconciliacionConfirmado(db, movimiento(31), 20, '2026-09-05T00:00:00.000Z');

  it('la línea deja de apuntar al movimiento borrado', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(movimiento(20)).toBeUndefined();
    expect(linea().movimientoId).toBe('31');
  });

  it('y se queda con el importe del banco · conciliado manda sobre confirmado', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(linea().importe).toBe(87.4);
    expect(linea().fecha).toBe('2026-09-03');
    expect(linea().fechaValor).toBe('2026-09-04');
  });

  it('sigue cerrada y atada a su previsión', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(linea().estado).toBe('confirmado');
    expect(linea().treasuryEventId).toBe(7);
  });

  it('el evento se repunta al movimiento del extracto, en magnitud', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(stores.treasuryEvents[0].executedMovementId).toBe(31);
    expect(stores.treasuryEvents[0].actualAmount).toBe(87.4);
  });

  it('el texto del banco sobrevive y el del usuario se guarda aparte', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(movimiento(31).description).toBe('ADEUDO RECIBO AQUALIA SA 0034ES');
    expect(movimiento(31).descripcionPrevision).toBe('Agua Tenderina');
  });

  it('un ejercicio DECLARADO no se repunta ni se reescribe', async () => {
    conPunteoPrevio();
    linea().estado = 'declarado';
    await colapsar();
    expect(linea().estado).toBe('declarado');
    expect(linea().importe).toBe(82);
    expect(linea().movimientoId).toBe('20');
  });
});
