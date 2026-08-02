// FASE 0 · diagnóstico de previsiones duplicadas.
//
// No borra: cuenta y explica cuánto distorsionan el cierre. El plan pide
// reportar antes de tocar nada, y para eso hace falta que las cifras sean
// exactas — un informe que exagera lleva a borrar de más.

import {
  analizarDuplicados,
  claveDuplicado,
  resumirInforme,
  limpiarDuplicados,
} from '../duplicadosPrevisionService';
import type { TreasuryEvent } from '../db';

// La base la sirve un doble en memoria · `mockStore` se rellena en cada test.
const mockStore = new Map<number, TreasuryEvent>();
const mockBorrados: number[] = [];

jest.mock('../db', () => ({
  initDB: async () => ({
    getAll: async () => [...mockStore.values()],
    transaction: () => ({
      store: {
        delete: async (id: number) => {
          mockBorrados.push(id);
          mockStore.delete(id);
        },
      },
      done: Promise.resolve(),
    }),
  }),
}));

const ev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    accountId: 1,
    type: 'expense',
    amount: 100,
    predictedDate: '2026-08-10',
    description: 'Recibo luz',
    sourceType: 'gasto_recurrente',
    sourceId: 55,
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('qué cuenta como duplicado', () => {
  it('mismo origen, mes, cuenta e importe · es la misma previsión repetida', () => {
    const inf = analizarDuplicados([ev({ id: 1 }), ev({ id: 2 })]);

    expect(inf.grupos).toHaveLength(1);
    expect(inf.grupos[0].copias).toBe(2);
    expect(inf.copiasSobrantes).toBe(1);
  });

  it('distinto IMPORTE no es duplicado · puede ser una cuota partida o un ajuste', () => {
    // Meterlos en el mismo saco daría falsos positivos justo en el informe que
    // decide qué se borra.
    const inf = analizarDuplicados([ev({ id: 1, amount: 100 }), ev({ id: 2, amount: 120 })]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('distinto mes no es duplicado · un recurrente se repite todos los meses', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, predictedDate: '2026-08-10' }),
      ev({ id: 2, predictedDate: '2026-09-10' }),
    ]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('distinta cuenta no es duplicado', () => {
    const inf = analizarDuplicados([ev({ id: 1, accountId: 1 }), ev({ id: 2, accountId: 2 })]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('sin origen NO se cuenta · un alta a mano repetida es decisión del usuario', () => {
    const manual = ev({ sourceType: 'manual', sourceId: undefined });
    expect(claveDuplicado(manual)).toBeNull();

    const inf = analizarDuplicados([{ ...manual, id: 1 }, { ...manual, id: 2 }]);
    expect(inf.grupos).toHaveLength(0);
  });
});

// Los préstamos NO llevan `sourceId`: se identifican por `prestamoId` y
// `numeroCuota`. Sin respaldo, el informe se los saltaba enteros — y son uno de
// los orígenes que el motor regenera, así que el conteo salía corto justo donde
// más importa.
describe('las previsiones de préstamo también se cuentan', () => {
  const cuota = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
    ({
      ...ev({ sourceType: undefined, sourceId: undefined, ...over }),
      prestamoId: 3,
      numeroCuota: 14,
      type: 'financing',
    }) as TreasuryEvent;

  it('dos cuotas idénticas del mismo préstamo son un duplicado', () => {
    const inf = analizarDuplicados([cuota({ id: 1 }), cuota({ id: 2 })]);

    expect(inf.grupos).toHaveLength(1);
    expect(inf.grupos[0].sourceType).toBe('prestamo');
    expect(inf.grupos[0].sourceId).toBe('prestamo-3');
  });

  it('cuotas DISTINTAS del mismo préstamo no lo son', () => {
    const inf = analizarDuplicados([
      cuota({ id: 1 }),
      { ...cuota({ id: 2 }), numeroCuota: 15 } as TreasuryEvent,
    ]);
    expect(inf.grupos).toHaveLength(0);
  });

  it('salen en el informe por origen · es lo que apunta al generador', () => {
    const texto = resumirInforme(analizarDuplicados([cuota({ id: 1 }), cuota({ id: 2 })]));
    expect(texto).toContain('prestamo: 1');
  });
});

describe('cuánto distorsionan', () => {
  it('tres copias de un gasto de 100 sobran 200, en negativo', () => {
    const inf = analizarDuplicados([ev({ id: 1 }), ev({ id: 2 }), ev({ id: 3 })]);

    expect(inf.grupos[0].copias).toBe(3);
    expect(inf.grupos[0].distorsion).toBe(-200);
    expect(inf.distorsionTotal).toBe(-200);
  });

  it('un ingreso duplicado distorsiona en positivo', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, type: 'income', amount: 475 }),
      ev({ id: 2, type: 'income', amount: 475 }),
    ]);
    expect(inf.grupos[0].distorsion).toBe(475);
  });

  it('ordena por lo que más daño hace, no por número de copias', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, sourceId: 1, amount: 10 }),
      ev({ id: 2, sourceId: 1, amount: 10 }),
      ev({ id: 3, sourceId: 1, amount: 10 }),
      ev({ id: 4, sourceId: 2, amount: 900 }),
      ev({ id: 5, sourceId: 2, amount: 900 }),
    ]);

    // 3 copias de 10 sobran 20; 2 copias de 900 sobran 900. Manda el importe.
    expect(inf.grupos[0].sourceId).toBe('2');
  });
});

describe('qué se puede limpiar y qué no', () => {
  it('solo sobran predicted · se limpian todas menos una', () => {
    const inf = analizarDuplicados([ev({ id: 1 }), ev({ id: 2 }), ev({ id: 3 })]);
    expect(inf.limpiablesPredicted).toBe(2);
    expect(inf.paraRevisionManual).toHaveLength(0);
  });

  it('si una copia está confirmada, esa se queda y las predicted se van', () => {
    const inf = analizarDuplicados([
      ev({ id: 1, status: 'executed' }),
      ev({ id: 2 }),
      ev({ id: 3 }),
    ]);
    // Las dos predicted son limpiables; la ejecutada no se toca.
    expect(inf.limpiablesPredicted).toBe(2);
  });

  it('DOS copias ya confirmadas van a revisión manual · pueden ser cargos reales', () => {
    // El banco puede haber cobrado dos veces de verdad. Borrarlo sería inventar
    // que no pasó.
    const inf = analizarDuplicados([
      ev({ id: 1, status: 'executed' }),
      ev({ id: 2, status: 'executed' }),
    ]);

    expect(inf.paraRevisionManual).toHaveLength(1);
    expect(inf.limpiablesPredicted).toBe(0);
  });

  it('una descartada no cuenta como limpiable ni bloquea', () => {
    const inf = analizarDuplicados([ev({ id: 1, descartado: true }), ev({ id: 2 })]);
    expect(inf.grupos[0].estados).toContain('descartado');
  });
});

describe('el informe que se copia y se pega', () => {
  it('dice el total, lo que sobra y cuánto distorsiona', () => {
    const texto = resumirInforme(analizarDuplicados([ev({ id: 1 }), ev({ id: 2 })]));

    expect(texto).toContain('Previsiones en total: 2');
    expect(texto).toContain('Copias de más: 1');
    expect(texto).toContain('-100.00 €');
  });

  it('señala qué ORIGEN duplica más · es lo que apunta al generador culpable', () => {
    const texto = resumirInforme(
      analizarDuplicados([
        ev({ id: 1, sourceType: 'contrato', sourceId: 7 }),
        ev({ id: 2, sourceType: 'contrato', sourceId: 7 }),
        ev({ id: 3, sourceType: 'contrato', sourceId: 8, amount: 50 }),
        ev({ id: 4, sourceType: 'contrato', sourceId: 8, amount: 50 }),
        ev({ id: 5, sourceType: 'prestamo', sourceId: 9, amount: 70 }),
        ev({ id: 6, sourceType: 'prestamo', sourceId: 9, amount: 70 }),
      ])
    );

    expect(texto).toContain('Copias de más por origen');
    expect(texto).toContain('contrato: 2');
    expect(texto).toContain('prestamo: 1');
  });

  it('sin duplicados lo dice sin alarmar', () => {
    const texto = resumirInforme(analizarDuplicados([ev({ id: 1 })]));
    expect(texto).toContain('Grupos duplicados: 0');
    expect(texto).toContain('Copias de más: 0');
  });
});


// FASE 1 · el borrado. Lo que se prueba aquí es que NO se pase de listo.
describe('limpiar duplicados', () => {
  beforeEach(() => {
    mockStore.clear();
    mockBorrados.length = 0;
  });

  const conBase = (evs: TreasuryEvent[]) =>
    evs.forEach((e) => mockStore.set(e.id as number, e));

  it('deja UNA copia y borra el resto', async () => {
    conBase([ev({ id: 1 }), ev({ id: 2 }), ev({ id: 3 })]);
    const r = await limpiarDuplicados();

    expect(r.borradas).toBe(2);
    expect(mockBorrados.sort()).toEqual([2, 3]);
    expect(mockStore.has(1)).toBe(true);
  });

  it('NUNCA borra una confirmada · puede ser un cargo real repetido', async () => {
    conBase([ev({ id: 1, status: 'executed' }), ev({ id: 2, status: 'executed' })]);
    const r = await limpiarDuplicados();

    expect(r.borradas).toBe(0);
    expect(mockStore.size).toBe(2);
  });

  it('si una está confirmada, esa se queda y se van todas las previstas', async () => {
    conBase([ev({ id: 1, status: 'executed' }), ev({ id: 2 }), ev({ id: 3 })]);
    const r = await limpiarDuplicados();

    expect(r.borradas).toBe(2);
    expect(mockStore.has(1)).toBe(true);
  });

  it('no toca lo que no está duplicado', async () => {
    conBase([ev({ id: 1 }), ev({ id: 2, predictedDate: '2026-09-10' })]);
    expect((await limpiarDuplicados()).borradas).toBe(0);
  });

  it('es idempotente · pasarlo dos veces no borra de más', async () => {
    conBase([ev({ id: 1 }), ev({ id: 2 })]);
    await limpiarDuplicados();
    expect((await limpiarDuplicados()).borradas).toBe(0);
  });

  it('devuelve cuánto se corrige el cierre · un gasto de más lo subía', async () => {
    conBase([ev({ id: 1, amount: 100 }), ev({ id: 2, amount: 100 })]);
    // Sobraba un gasto de 100 (−100 al cierre); quitarlo lo corrige en +100.
    expect((await limpiarDuplicados()).correccionCierre).toBe(100);
  });
});
