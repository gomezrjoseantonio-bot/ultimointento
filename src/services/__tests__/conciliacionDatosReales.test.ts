// ============================================================================
// Conciliar escribe el dato del BANCO, no la estimación
// ============================================================================
//
// La jerarquía es conciliado > confirmado > previsto. Hasta ahora la línea que
// DECLARA el gasto solo se cerraba (pasaba a deducible) pero conservaba el
// importe y la fecha previstos: si el banco cargaba 87,40 € el 3-9 y la
// previsión decía 82,00 € el 27-8, se deducían 82,00 €. Es dinero.
//
// Dos caminos llegan a lo mismo y los dos tenían el fallo:
//   · B1 · cuadrar la línea del extracto contra un previsto (`approvedMatches`)
//   · B2 · colapsar la línea del extracto contra un Confirmado ya punteado
//          (`reconciliarConfirmado`), que además borraba el movimiento al que
//          la línea apuntaba y la dejaba huérfana.
// ============================================================================

import {
  camposDeCierre,
  cerrarLineaDeGastoDelEvento,
  repuntarLineasAlMovimiento,
  type MovimientoReal,
} from '../cierreLineaInmueble';
import type { GastoInmueble, TreasuryEvent } from '../db';

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 7,
    sourceType: 'gasto_recurrente',
    sourceId: 42,
    año: 2026,
    mes: 3,
    ambito: 'INMUEBLE',
    inmuebleId: 1,
    description: 'Agua Tenderina',
    status: 'executed',
    ...over,
  }) as TreasuryEvent;

/** Lo previsto · 82,00 € el 27 de agosto. */
const linea = (over: Partial<GastoInmueble> = {}): GastoInmueble =>
  ({
    id: 5,
    inmuebleId: 1,
    ejercicio: 2026,
    fecha: '2026-08-27',
    concepto: 'Agua Tenderina',
    categoria: 'suministro',
    casillaAEAT: '0113',
    importe: 82,
    origen: 'recurrente',
    origenId: 'recurrente-42-2026-3',
    estado: 'previsto',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as GastoInmueble;

/** Lo que dijo el banco · 87,40 € el 3 de septiembre, valor el 4. */
const delBanco = (over: Partial<MovimientoReal> = {}): MovimientoReal => ({
  id: 31,
  amount: -87.4,
  date: '2026-09-03',
  valueDate: '2026-09-04',
  accountId: 9,
  ...over,
});

const conLineas = (lineas: GastoInmueble[]) => {
  const filas = lineas.map((l) => ({ ...l }));
  const db = {
    getAllFromIndex: async (_store: string, index: string, clave: unknown) => {
      if (index === 'treasuryEventId') return filas.filter((l) => l.treasuryEventId === clave);
      if (index === 'origen-origenId') {
        const [origen, origenId] = clave as [string, string];
        return filas.filter((l) => l.origen === origen && l.origenId === origenId);
      }
      return [];
    },
    getAll: async () => filas,
    put: async (_store: string, v: GastoInmueble) => {
      const i = filas.findIndex((l) => l.id === v.id);
      if (i >= 0) filas[i] = { ...v };
      return v.id;
    },
  };
  return { db, filas };
};

// ─── B1 · cuadrar contra un previsto ────────────────────────────────────────

describe('B1 · conciliar por extracto escribe el importe y la fecha REALES', () => {
  it('el importe del banco sustituye al previsto · 87,40 y no 82,00', async () => {
    const { db, filas } = conLineas([linea()]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco())).toBe(true);
    expect(filas[0].importe).toBe(87.4);
  });

  it('la fecha del cargo sustituye a la prevista · y arrastra el ejercicio', async () => {
    const { db, filas } = conLineas([linea()]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco());
    expect(filas[0].fecha).toBe('2026-09-03');
    expect(filas[0].ejercicio).toBe(2026);
  });

  it('la fecha VALOR se guarda aparte · no se pierde y no fija el ejercicio', async () => {
    const { db, filas } = conLineas([linea()]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco());
    expect(filas[0].fechaValor).toBe('2026-09-04');
  });

  it('la cuenta real del cargo queda en la línea', async () => {
    const { db, filas } = conLineas([linea()]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco());
    expect(filas[0].cuentaBancaria).toBe('9');
  });

  it('sigue cerrando · los tres campos que mira la declaración', async () => {
    const { db, filas } = conLineas([linea()]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco());
    expect(filas[0].estado).toBe('confirmado');
    expect(filas[0].estadoTesoreria).toBe('confirmed');
    expect(filas[0].movimientoId).toBe('31');
    expect(filas[0].treasuryEventId).toBe(7);
  });

  it('la clasificación NO se toca · el banco dice cuánto y cuándo, no qué es', async () => {
    const { db, filas } = conLineas([linea()]);
    await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco());
    expect(filas[0].concepto).toBe('Agua Tenderina');
    expect(filas[0].casillaAEAT).toBe('0113');
    expect(filas[0].categoria).toBe('suministro');
  });
});

// ─── D4 · la fecha real manda aunque cruce ejercicio ────────────────────────

describe('D4 · criterio caja · el gasto va al año del cargo real', () => {
  it('previsto el 28-12 y cargado el 3-1 · la línea se va al ejercicio siguiente', async () => {
    const { db, filas } = conLineas([linea({ fecha: '2026-12-28', ejercicio: 2026 })]);
    await cerrarLineaDeGastoDelEvento(
      db as never,
      evento(),
      delBanco({ date: '2027-01-03', valueDate: '2027-01-04' }),
    );
    expect(filas[0].fecha).toBe('2027-01-03');
    expect(filas[0].ejercicio).toBe(2027);
  });

  it('un ejercicio DECLARADO no se toca · ni el estado ni el importe', async () => {
    const { db, filas } = conLineas([linea({ estado: 'declarado' })]);
    expect(await cerrarLineaDeGastoDelEvento(db as never, evento(), delBanco())).toBe(false);
    expect(filas[0].estado).toBe('declarado');
    expect(filas[0].importe).toBe(82);
    expect(filas[0].movimientoId).toBeUndefined();
  });
});

// ─── B2 · colapsar contra un Confirmado ya punteado ─────────────────────────

describe('B2 · el colapso no deja la línea huérfana', () => {
  // El punteo a mano creó el movimiento 20 y la línea le apunta. Llega el
  // extracto con la misma operación (movimiento 31): el 20 se borra, así que
  // la línea tiene que pasar a apuntar al 31 · si no, señala a un id muerto.
  const punteadaAMano = () =>
    linea({ movimientoId: '20', estado: 'confirmado', estadoTesoreria: 'confirmed', treasuryEventId: 7 });

  it('la línea pasa a apuntar al movimiento del extracto', async () => {
    const { db, filas } = conLineas([punteadaAMano()]);
    expect(await repuntarLineasAlMovimiento(db as never, 20, delBanco())).toBe(1);
    expect(filas[0].movimientoId).toBe('31');
  });

  it('y se queda con el importe y la fecha del banco · conciliado > confirmado', async () => {
    const { db, filas } = conLineas([punteadaAMano()]);
    await repuntarLineasAlMovimiento(db as never, 20, delBanco());
    expect(filas[0].importe).toBe(87.4);
    expect(filas[0].fecha).toBe('2026-09-03');
    expect(filas[0].fechaValor).toBe('2026-09-04');
  });

  it('conserva el vínculo con la previsión', async () => {
    const { db, filas } = conLineas([punteadaAMano()]);
    await repuntarLineasAlMovimiento(db as never, 20, delBanco());
    expect(filas[0].treasuryEventId).toBe(7);
    expect(filas[0].estado).toBe('confirmado');
  });

  it('una línea de OTRO movimiento no se toca', async () => {
    const { db, filas } = conLineas([punteadaAMano(), linea({ id: 6, movimientoId: '99' })]);
    expect(await repuntarLineasAlMovimiento(db as never, 20, delBanco())).toBe(1);
    expect(filas[1].movimientoId).toBe('99');
    expect(filas[1].importe).toBe(82);
  });

  it('un ejercicio declarado tampoco se repunta', async () => {
    const { db, filas } = conLineas([punteadaAMano(), { ...punteadaAMano(), id: 6, estado: 'declarado' }]);
    expect(await repuntarLineasAlMovimiento(db as never, 20, delBanco())).toBe(1);
    expect(filas[1].movimientoId).toBe('20');
  });

  it('sin líneas que repuntar no rompe nada', async () => {
    const { db } = conLineas([]);
    expect(await repuntarLineasAlMovimiento(db as never, 20, delBanco())).toBe(0);
  });
});

// ─── camposDeCierre · la pieza pura compartida ──────────────────────────────

describe('camposDeCierre · lo mismo escriben los tres caminos', () => {
  it('el importe es MAGNITUD · el signo lo lleva el movimiento, no la línea', () => {
    expect(camposDeCierre(delBanco(), 7).importe).toBe(87.4);
    expect(camposDeCierre(delBanco({ amount: 87.4 }), 7).importe).toBe(87.4);
  });

  it('el ejercicio sale de la fecha de cargo · nunca de la fecha valor', () => {
    const c = camposDeCierre(delBanco({ date: '2026-12-31', valueDate: '2027-01-02' }), 7);
    expect(c.ejercicio).toBe(2026);
    expect(c.fechaValor).toBe('2027-01-02');
  });

  it('sin fecha valor no se inventa ninguna', () => {
    expect(camposDeCierre(delBanco({ valueDate: undefined }), 7).fechaValor).toBeUndefined();
  });

  it('sin cuenta no se escribe cuenta', () => {
    expect(camposDeCierre(delBanco({ accountId: undefined }), 7).cuentaBancaria).toBeUndefined();
  });
});
