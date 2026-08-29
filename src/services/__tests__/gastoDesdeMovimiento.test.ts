// ============================================================================
// El fichero descubre un gasto de piso · crear su fila fiscal
// ============================================================================
//
// Al clasificar una línea del extracto que NO tenía previsión, el gasto quedaba
// bien en Tesorería y desaparecía de la declaración: `crearDesdeFicha` sólo
// escribía el `Movement` con su categoría, y nadie creaba la fila
// `gastosInmueble`. El cliente perdía un gasto deducible sin enterarse.
//
// Curiosamente una MEJORA sí se registraba (`mejoraDesdeMovimiento`). Esto es
// su hermano para el gasto corriente, con el mismo molde.

import {
  gastoDesdeMovimiento,
  origenIdRecurrenteDelGasto,
  ResultadoGastoFiscal,
} from '../altaMovimientoService';
import { initDB } from '../db';
import type { GastoInmueble, Movement } from '../db';

const INMUEBLE = 1;
const HOY = '2026-08-29';

// La base sobrevive entre casos (fake-indexeddb): sin esto, las filas de un
// test cuentan en el siguiente y "no se ha creado ninguna" nunca sería cierto.
beforeEach(async () => {
  const db = await initDB();
  await db.clear('gastosInmueble');
  await db.clear('movements');
});

const guardarMovimiento = async (over: Partial<Movement> = {}): Promise<number> => {
  const db = await initDB();
  return (await db.add('movements', {
    accountId: 1,
    date: '2026-08-05',
    valueDate: '2026-08-06',
    amount: -240.5,
    description: 'RECIBO /FONTANERIA GARCIA SL',
    unifiedStatus: 'conciliado',
    createdAt: HOY,
    updatedAt: HOY,
    ...over,
  } as never)) as number;
};

const lineas = async (): Promise<GastoInmueble[]> => {
  const db = await initDB();
  return ((await db.getAll('gastosInmueble')) ?? []) as GastoInmueble[];
};

const base = (movementId: number) => ({
  movementId,
  inmuebleId: INMUEBLE,
  concepto: 'Fontanero',
  importe: -240.5,
  fecha: '2026-08-05',
  categoryKey: 'inmueble.reparacion_conservacion',
  hoy: HOY,
});

// ============================================================================
// B19 · lo que más dinero toca · va primero
// ============================================================================
//
// Un recibo recurrente que el conciliador no supo cuadrar acaba en "a resolver"
// y el usuario lo clasifica a mano. Pero su gasto YA tiene fila del mes, creada
// por `operacionFiscalService` con `origen:'recurrente'` y sin `treasuryEventId`.
// Crear otra la contaría DOS VECES en la declaración.
describe('B19 · un recurrente sin match no duplica el gasto', () => {
  const ORIGEN_ID = 'recurrente-7-2026-8';

  const sembrarLineaRecurrente = async (over: Partial<GastoInmueble> = {}) => {
    const db = await initDB();
    return (await db.add('gastosInmueble', {
      inmuebleId: INMUEBLE,
      ejercicio: 2026,
      fecha: '2026-08-01',
      concepto: 'Agua — Agosto',
      categoria: 'suministros',
      casillaAEAT: '0115',
      importe: 50,
      origen: 'recurrente',
      origenId: ORIGEN_ID,
      estado: 'previsto',
      createdAt: HOY,
      updatedAt: HOY,
      ...over,
    } as never)) as number;
  };

  it('cierra la fila que ya existe en vez de crear otra', async () => {
    const lineaId = await sembrarLineaRecurrente();
    const movementId = await guardarMovimiento({ amount: -47.12 });

    const r = await gastoDesdeMovimiento({
      ...base(movementId),
      importe: -47.12,
      origenIdRecurrente: ORIGEN_ID,
    });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('cerrada');
    const todas = await lineas();
    expect(todas).toHaveLength(1);
    expect(todas[0].id).toBe(lineaId);
  });

  it('y la cierra con el dato REAL del banco, no con lo previsto', async () => {
    await sembrarLineaRecurrente();
    const movementId = await guardarMovimiento({ amount: -47.12, date: '2026-08-12' });

    await gastoDesdeMovimiento({
      ...base(movementId),
      importe: -47.12,
      fecha: '2026-08-12',
      origenIdRecurrente: ORIGEN_ID,
    });

    const [l] = await lineas();
    expect(l.importe).toBe(47.12);
    expect(l.fecha).toBe('2026-08-12');
    expect(l.ejercicio).toBe(2026);
    expect(l.estado).toBe('confirmado');
    expect(l.movimientoId).toBe(String(movementId));
  });

  it('sin fila recurrente previa sí crea una', async () => {
    const movementId = await guardarMovimiento();

    const r = await gastoDesdeMovimiento({ ...base(movementId), origenIdRecurrente: ORIGEN_ID });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('creada');
    expect(await lineas()).toHaveLength(1);
  });
});

// ============================================================================
// H1 · crear la fila que faltaba
// ============================================================================
describe('crea la fila fiscal del gasto descubierto', () => {
  it('con el dato del banco y enlazada al movimiento', async () => {
    const movementId = await guardarMovimiento();

    const r = await gastoDesdeMovimiento(base(movementId));

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('creada');
    const [l] = await lineas();
    expect(l.inmuebleId).toBe(INMUEBLE);
    // Magnitud · el signo vive en el movimiento.
    expect(l.importe).toBe(240.5);
    // El ejercicio sale de la fecha de CARGO, criterio de caja.
    expect(l.fecha).toBe('2026-08-05');
    expect(l.ejercicio).toBe(2026);
    expect(l.fechaValor).toBe('2026-08-06');
    expect(l.movimientoId).toBe(String(movementId));
    expect(l.origen).toBe('tesoreria');
    expect(l.estado).toBe('confirmado');
    expect(l.estadoTesoreria).toBe('confirmed');
  });

  it('un gasto de un año ya pasado se fecha en SU año', async () => {
    // Registrar un gasto de un ejercicio declarado se permite: es un hecho. La
    // declaración presentada la protege el corte del snapshot AEAT.
    const movementId = await guardarMovimiento({ date: '2024-03-11' });

    await gastoDesdeMovimiento({ ...base(movementId), fecha: '2024-03-11' });

    const [l] = await lineas();
    expect(l.ejercicio).toBe(2024);
  });

  // NO crea un segundo movimiento: el del banco ya existe. Ese era el motivo de
  // no poder reutilizar `confirmTreasuryEvent`, que sí lo crea.
  it('no duplica el movimiento del banco', async () => {
    const db = await initDB();
    const antes = ((await db.getAll('movements')) ?? []).length;
    const movementId = await guardarMovimiento();

    await gastoDesdeMovimiento(base(movementId));

    expect(((await db.getAll('movements')) ?? []).length).toBe(antes + 1);
  });

  it('deja el movimiento clasificado y atado al inmueble', async () => {
    const movementId = await guardarMovimiento();

    await gastoDesdeMovimiento(base(movementId));

    const db = await initDB();
    const m = (await db.get('movements', movementId)) as Movement;
    expect(m.inmuebleId).toBe(String(INMUEBLE));
    expect(m.ambito).toBe('INMUEBLE');
    expect(m.categoryKey).toBe('inmueble.reparacion_conservacion');
  });
});

// ============================================================================
// H3 · nada cae a una casilla por defecto en silencio
// ============================================================================
describe('sin casilla no se guarda · el flujo pide elegir', () => {
  it('una categoría que no resuelve casilla NO cae a 0106', async () => {
    const movementId = await guardarMovimiento();

    const r = await gastoDesdeMovimiento({
      ...base(movementId),
      categoryKey: 'no.existe.esta.categoria',
    });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('falta_casilla');
    expect(await lineas()).toHaveLength(0);
  });

  it('sin categoría tampoco', async () => {
    const movementId = await guardarMovimiento();

    const r = await gastoDesdeMovimiento({ ...base(movementId), categoryKey: undefined });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('falta_casilla');
    expect(await lineas()).toHaveLength(0);
  });

  it('sin inmueble no hay fila que crear', async () => {
    const movementId = await guardarMovimiento();

    const r = await gastoDesdeMovimiento({ ...base(movementId), inmuebleId: undefined });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('sin_inmueble');
    expect(await lineas()).toHaveLength(0);
  });
});

// ============================================================================
// Techo en hoy
// ============================================================================
describe('un cargo con fecha futura no entra como hecho', () => {
  it('no crea fila fiscal', async () => {
    const movementId = await guardarMovimiento({ date: '2026-09-15' });

    const r = await gastoDesdeMovimiento({ ...base(movementId), fecha: '2026-09-15' });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('fecha_futura');
    expect(await lineas()).toHaveLength(0);
  });

  // El cargo existe en el banco y el saldo lo refleja · tirarlo sería perder un
  // dato real. Lo que no se hace es declararlo antes de que ocurra.
  it('pero el movimiento se queda, y clasificado', async () => {
    const movementId = await guardarMovimiento({ date: '2026-09-15' });

    await gastoDesdeMovimiento({ ...base(movementId), fecha: '2026-09-15' });

    const db = await initDB();
    const m = (await db.get('movements', movementId)) as Movement | undefined;
    expect(m).toBeDefined();
    expect(m!.inmuebleId).toBe(String(INMUEBLE));
  });

  it('hoy mismo NO es futuro · el cargo de hoy sí cuenta', async () => {
    const movementId = await guardarMovimiento({ date: HOY });

    const r = await gastoDesdeMovimiento({ ...base(movementId), fecha: HOY });

    expect(r.resultado).toBe<ResultadoGastoFiscal['resultado']>('creada');
  });
});

// ============================================================================
// De qué compromiso es este gasto · lo que hace que la guarda de B19 dispare
// ============================================================================
//
// La ficha solo sabe inmueble y categoría: el compromiso no se elige a mano. Sin
// esta traducción, `gastoDesdeMovimiento` nunca recibiría con qué buscar y la
// protección de B19 quedaría escrita pero muerta.

describe('origenIdRecurrenteDelGasto', () => {
  const sembrarCompromiso = async (over: Record<string, unknown> = {}) => {
    const db = await initDB();
    return (await db.add('compromisosRecurrentes', {
      ambito: 'inmueble',
      inmuebleId: INMUEBLE,
      alias: 'Agua',
      proveedor: { nombre: 'Aqualia' },
      patron: { tipo: 'mensualDiaFijo', dia: 5 },
      importe: { modo: 'fijo', importe: 50 },
      cuentaCargo: 1,
      conceptoBancario: 'AQUALIA',
      metodoPago: 'domiciliacion',
      categoria: 'inmueble.suministros',
      bolsaPresupuesto: 'necesidades',
      responsable: 'titular',
      fechaInicio: '2019-01-01',
      estado: 'activo',
      createdAt: '2019-01-01',
      updatedAt: '2019-01-01',
      ...over,
    } as never)) as number;
  };

  beforeEach(async () => {
    const db = await initDB();
    await db.clear('compromisosRecurrentes');
  });

  it('da la clave del mes del cargo', async () => {
    const id = await sembrarCompromiso();
    expect(await origenIdRecurrenteDelGasto(INMUEBLE, 'inmueble.suministros', '2026-08-12'))
      .toBe(`recurrente-${id}-2026-8`);
  });

  it('sin compromiso de esa categoría no hay clave · se creará fila nueva', async () => {
    await sembrarCompromiso();
    expect(await origenIdRecurrenteDelGasto(INMUEBLE, 'inmueble.reparacion_conservacion', '2026-08-12'))
      .toBeUndefined();
  });

  it('el compromiso de OTRO inmueble no vale', async () => {
    await sembrarCompromiso();
    expect(await origenIdRecurrenteDelGasto(99, 'inmueble.suministros', '2026-08-12'))
      .toBeUndefined();
  });

  it('un compromiso de baja no manda', async () => {
    await sembrarCompromiso({ estado: 'baja' });
    expect(await origenIdRecurrenteDelGasto(INMUEBLE, 'inmueble.suministros', '2026-08-12'))
      .toBeUndefined();
  });
});
