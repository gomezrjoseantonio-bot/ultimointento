// ============================================================================
// Los dos caminos de la conciliación, de extremo a extremo
// ============================================================================
//
// `conciliacionDatosReales.test.ts` fija la pieza (`camposDeCierre` y sus dos
// aplicadores). Esto comprueba que los servicios REALES la usan y que el
// resultado en la base es el que se quiere:
//
//   · B1 · `confirmDecisions` cuadra la LÍNEA del extracto con un previsto ·
//          E1.5: el movimiento NACE aquí, desde la línea
//   · B2 · `aplicarReconciliacionConfirmado` · D1: la línea confirma un
//          Confirmado ya punteado, que SE CONSERVA y recibe el aval del banco
//
// y que los dos textos —el del banco y el del usuario— conviven sin pisarse.
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
  lineasExtracto: any[];
}

let stores: Stores;

/** El recibo del agua · previsto 82,00 € el 27-8, cargado 87,40 € el 3-9. */
function sembrar(): void {
  stores = {
    // E1.5 · importar NO crea movimientos: lo que hay es la LÍNEA del banco.
    movements: [],
    lineasExtracto: [
      {
        id: 310,
        accountId: 9,
        importe: -87.4,
        fechaOperacion: '2026-09-03',
        fechaValor: '2026-09-04',
        conceptoLiteral: 'ADEUDO RECIBO AQUALIA SA 0034ES',
        importBatchId: 'lote-1',
        hashLinea: 'v1:x',
        hashMovement: '9|2026-09-03|-8740|ADEUDO RECIBO AQUALIA SA 0034ES',
        estado: 'pendiente',
        movementIds: [],
        createdAt: '',
        updatedAt: '',
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
/** E1.5 · el movimiento que NACIÓ de la línea al guardar. */
const nacido = () => stores.movements.find((m) => m.source === 'import');
const filaLinea = () => stores.lineasExtracto[0];

beforeEach(() => {
  sembrar();
  (initDB as jest.Mock).mockResolvedValue(db);
});

// ─── B1 · cuadrar la línea del extracto con un previsto ─────────────────────

describe('B1 · confirmDecisions escribe el dato del banco en la línea de gasto', () => {
  const cuadrar = () =>
    confirmDecisions('lote-1', {
      approvedMatches: [{ lineaId: 310, treasuryEventId: 7 }],
      ignoredLineaIds: [],
    });

  it('E1.5 · el movimiento NACE al guardar, desde la línea, y la línea queda enlazada', async () => {
    expect(stores.movements).toHaveLength(0);
    await cuadrar();
    expect(stores.movements).toHaveLength(1);
    expect(nacido()).toMatchObject({
      accountId: 9, amount: -87.4, date: '2026-09-03', valueDate: '2026-09-04',
      source: 'import', importBatch: 'lote-1', unifiedStatus: 'conciliado', statusConciliacion: 'match_manual',
    });
    // Mina M1 · el id lo puso el store, no es el de la línea.
    expect(nacido().id).not.toBe(310);
    expect(filaLinea()).toMatchObject({ movementIds: [nacido().id], estado: 'resuelta', comoSeResolvio: 'confirmada' });
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
    expect(linea().movimientoId).toBe(String(nacido().id));
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
    expect(nacido().description).toBe('ADEUDO RECIBO AQUALIA SA 0034ES');
  });

  it('y el nombre de la previsión se guarda aparte', async () => {
    await cuadrar();
    expect(nacido().descripcionPrevision).toBe('Agua Tenderina');
  });

  // D3 · magnitud, como el punteo manual.
  it('actualAmount va en magnitud · no con el signo del cargo', async () => {
    await cuadrar();
    expect(stores.treasuryEvents[0].actualAmount).toBe(87.4);
    expect(stores.treasuryEvents[0].actualDate).toBe('2026-09-03');
  });
});

// ─── B2 · D1 · la línea confirma un Confirmado ya punteado ──────────────────

describe('B2 · D1 · el confirmado se conserva con el aval del banco', () => {
  /**
   * El usuario punteó a mano ANTES de subir el extracto: hay un movimiento 20
   * con los 82,00 previstos, y la línea de gasto le apunta. Al subir el
   * extracto, la misma operación llega como LÍNEA (310): el 20 se queda, toma
   * el importe y las fechas del banco, y la línea queda enlazada a él.
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
    aplicarReconciliacionConfirmado(
      db,
      { amount: -87.4, date: '2026-09-03', valueDate: '2026-09-04' },
      20,
      '2026-09-05T00:00:00.000Z',
    );

  it('el confirmado sobrevive · nada nace y nada se borra', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(movimiento(20)).toBeDefined();
    expect(stores.movements).toHaveLength(1);
    expect(linea().movimientoId).toBe('20');
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

  it('el evento sigue en el confirmado · con el dato del banco, en magnitud', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(stores.treasuryEvents[0].executedMovementId).toBe(20);
    expect(stores.treasuryEvents[0].actualAmount).toBe(87.4);
    expect(stores.treasuryEvents[0].actualDate).toBe('2026-09-03');
  });

  it('el confirmado conserva el texto del usuario y sube a conciliado con las fechas del banco', async () => {
    conPunteoPrevio();
    await colapsar();
    expect(movimiento(20)).toMatchObject({
      description: 'Agua Tenderina',
      amount: -87.4,
      date: '2026-09-03',
      valueDate: '2026-09-04',
      unifiedStatus: 'conciliado',
      statusConciliacion: 'match_automatico',
      categoryKey: 'suministro_inmueble',
    });
  });

  it('un ejercicio DECLARADO no se reescribe', async () => {
    conPunteoPrevio();
    linea().estado = 'declarado';
    await colapsar();
    expect(linea().estado).toBe('declarado');
    expect(linea().importe).toBe(82);
    expect(linea().movimientoId).toBe('20');
  });
});
