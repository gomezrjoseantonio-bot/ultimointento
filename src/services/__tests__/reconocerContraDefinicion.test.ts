// E2.4 · reconocer contra la DEFINICIÓN · de punta a punta contra la base real
// (fake-indexeddb): la línea del extracto se reconoce SIN previsión y, al
// Guardar, nace el movimiento por el MISMO camino que el gesto humano.
//
// Lo que se afirma en cada fuente es lo que escribe y lo que NO escribe dos
// veces (#1834): la fila fiscal del recurrente, el cobro del contrato, la pata
// del traspaso.

import { initDB, type Movement, type MovementLearningRule, type TreasuryEvent } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';
import { confirmDecisions } from '../confirmarDecisiones';
import { reconocerDeterministasDeLineas } from '../deterministas/matcheoDeterminista';

const SANTANDER = 1;
const BANKINTER = 2;
const LOTE = 'lote-e24';

const STORES = [
  'movements',
  'movementLearningRules',
  'lineasExtracto',
  'gastosInmueble',
  'compromisosRecurrentes',
  'contracts',
  'accounts',
  'personalData',
  'treasuryEvents',
  'prestamos',
  'ingresos',
];

const AHORA = '2026-08-25T00:00:00.000Z';

function lineaBase(over: Partial<LineaExtractoPersistida> = {}): Omit<LineaExtractoPersistida, 'id'> {
  return {
    fechaOperacion: '2025-03-02',
    fechaValor: '2025-03-02',
    importe: -24.9,
    conceptoLiteral: 'Recibo Segurcaixa Adeslas Mandato 07085234611',
    importBatchId: LOTE,
    accountId: SANTANDER,
    hashLinea: `h-${Math.random()}`,
    hashMovement: `m-${Math.random()}`,
    estado: 'pendiente',
    movementIds: [],
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  };
}

async function db() {
  return initDB();
}

async function nuevaLinea(over: Partial<LineaExtractoPersistida> = {}): Promise<number> {
  return Number(await (await db()).add('lineasExtracto', lineaBase(over) as never));
}

async function linea(id: number): Promise<LineaExtractoPersistida> {
  return (await (await db()).get('lineasExtracto', id)) as LineaExtractoPersistida;
}

async function todos<T>(store: string): Promise<T[]> {
  return ((await (await db()).getAll(store as never)) ?? []) as T[];
}

async function sembrar(store: string, filas: unknown[]): Promise<void> {
  const d = await db();
  for (const f of filas) await d.put(store as never, f as never);
}

/** Reconoce el lote y guarda lo reconocido · lo que hace el drawer al pulsar Guardar. */
async function reconocerYGuardar(lineaIds: number[]): Promise<void> {
  const lineas = await Promise.all(lineaIds.map(linea));
  const r = await reconocerDeterministasDeLineas(lineas);
  await confirmDecisions(LOTE, {
    approvedMatches: [],
    ignoredLineaIds: [],
    approvedDeterministic: Array.from(r.origenes.values()),
  });
}

const CUENTAS = [
  { id: SANTANDER, iban: 'ES9121000418450200051332', alias: 'Santander', status: 'ACTIVE', activa: true, createdAt: AHORA, updatedAt: AHORA },
  { id: BANKINTER, iban: 'ES7921000813610123456789', alias: 'Bankinter', status: 'ACTIVE', activa: true, createdAt: AHORA, updatedAt: AHORA },
];

beforeEach(async () => {
  const d = await db();
  for (const s of STORES) {
    try {
      await d.clear(s as never);
    } catch {
      // un store que no exista en esta versión no bloquea el test
    }
  }
  await sembrar('accounts', CUENTAS);
  await sembrar('personalData', [{ id: 1, nombre: 'José Antonio', apellidos: 'Gómez Ramírez', dni: '', direccion: '' }]);
});

// ─── recurrente ─────────────────────────────────────────────────────────────

describe('E2.4 · recurrente · nace el movimiento clasificado y su fila fiscal · una vez', () => {
  const decesos = {
    id: 11,
    alias: 'Comunidad Tenderina',
    ambito: 'inmueble',
    inmuebleId: 4,
    tipo: 'comunidad',
    proveedor: { nombre: 'Comunidad Propietarios Tenderina' },
    numeroContrato: '07085234611',
    patron: { tipo: 'mensualDiaFijo', dia: 2 },
    importe: { modo: 'fijo', importe: 24.9 },
    cuentaCargo: SANTANDER,
    conceptoBancario: 'COMUNIDAD PROPIETARIOS TENDERINA',
    metodoPago: 'domiciliacion',
    categoria: 'comunidad_inmueble',
    estado: 'activo',
  };

  it('sin previsión: la línea de hace 17 meses se reconoce y al Guardar hay movimiento + fila fiscal + línea resuelta por el motor', async () => {
    await sembrar('compromisosRecurrentes', [decesos]);
    const id = await nuevaLinea({ conceptoLiteral: 'Recibo Comunidad Propietarios Tenderina Mandato 07085234611' });
    expect(await todos('treasuryEvents')).toEqual([]); // no hay previsión de marzo de 2025

    await reconocerYGuardar([id]);

    const movs = await todos<Movement>('movements');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({
      accountId: SANTANDER,
      amount: -24.9,
      categoryKey: 'comunidad_inmueble',
      inmuebleId: '4',
      ambito: 'INMUEBLE',
      unifiedStatus: 'conciliado',
      statusConciliacion: 'match_automatico',
      descripcionPrevision: 'Comunidad Tenderina · Comunidad Propietarios Tenderina',
      source: 'import',
    });
    // La fila fiscal es la MISMA que dejaría la ficha (`gastoDesdeMovimiento`):
    // sin fila previa del recurrente en ese mes, nace una de tesorería apuntando
    // al movimiento (mina M6 · el id del movimiento, nunca el de la línea).
    const gastos = await todos<{ inmuebleId: number; movimientoId?: string; origen?: string }>('gastosInmueble');
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ inmuebleId: 4, movimientoId: String(movs[0].id), origen: 'tesoreria' });
    expect(await linea(id)).toMatchObject({ estado: 'resuelta', comoSeResolvio: 'motor', movementIds: [movs[0].id] });
    // Y enseña · E2.2: la próxima línea igual llega con esto aprendido.
    const reglas = await todos<MovementLearningRule>('movementLearningRules');
    expect(reglas).toHaveLength(1);
    expect(reglas[0]).toMatchObject({ categoria: 'comunidad_inmueble', ambito: 'INMUEBLE', inmuebleId: '4' });
  });

  it('es IDEMPOTENTE · guardar dos veces no duplica el movimiento ni la fila fiscal', async () => {
    await sembrar('compromisosRecurrentes', [decesos]);
    const id = await nuevaLinea({ conceptoLiteral: 'Recibo Comunidad Propietarios Tenderina Mandato 07085234611' });
    await reconocerYGuardar([id]);
    await reconocerYGuardar([id]);
    expect(await todos('movements')).toHaveLength(1);
    expect(await todos('gastosInmueble')).toHaveLength(1);
  });

  it('un Guardar que falló DESPUÉS de clasificar y ANTES de la huella · el reintento completa la huella sin repetir la fila', async () => {
    await sembrar('compromisosRecurrentes', [decesos]);
    const id = await nuevaLinea({ conceptoLiteral: 'Recibo Comunidad Propietarios Tenderina Mandato 07085234611' });
    await reconocerYGuardar([id]);
    // Se simula el fallo a medias: el movimiento quedó clasificado (la fila
    // fiscal ya está) pero sin conciliar ni nombre legible.
    const d = await db();
    const [m] = await todos<Movement>('movements');
    await d.put('movements', { ...m, unifiedStatus: 'no_planificado', statusConciliacion: 'sin_match', descripcionPrevision: undefined } as never);

    await reconocerYGuardar([id]);

    const movs = await todos<Movement>('movements');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ unifiedStatus: 'conciliado', statusConciliacion: 'match_automatico', descripcionPrevision: 'Comunidad Tenderina · Comunidad Propietarios Tenderina' });
    expect(await todos('gastosInmueble')).toHaveLength(1);
  });

  it('un recurrente PERSONAL clasifica el movimiento sin fila fiscal', async () => {
    await sembrar('compromisosRecurrentes', [{ ...decesos, id: 12, ambito: 'personal', inmuebleId: undefined, alias: 'Seguro decesos', categoria: 'seguros' }]);
    const id = await nuevaLinea({ conceptoLiteral: 'Recibo Comunidad Propietarios Tenderina Mandato 07085234611' });
    await reconocerYGuardar([id]);
    const movs = await todos<Movement>('movements');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ categoryKey: 'seguros', unifiedStatus: 'conciliado' });
    expect(movs[0].inmuebleId).toBeUndefined();
    expect(await todos('gastosInmueble')).toEqual([]);
  });
});

// ─── renta ──────────────────────────────────────────────────────────────────

describe('E2.4 · renta · el cobro del contrato queda registrado, sin fabricar previsiones', () => {
  const contrato = {
    id: 21,
    inmuebleId: 4,
    unidadTipo: 'vivienda',
    inquilino: { nombre: 'Miguel', apellidos: 'Lorenzo Cabanelas', dni: '', telefono: '', email: '' },
    fechaInicio: '2024-02-01',
    fechaFin: '2029-01-31',
    rentaMensual: 650,
    diaPago: 5,
    margenGraciaDias: 5,
    cuentaCobroId: SANTANDER,
    estadoContrato: 'activo',
    historicoIndexaciones: [],
  };

  it('el PASADO · nace el movimiento como renta del piso y un cobro ya ejecutado del contrato, apuntando al movimiento', async () => {
    await sembrar('contracts', [contrato]);
    const id = await nuevaLinea({ fechaOperacion: '2025-01-05', fechaValor: '2025-01-05', importe: 650, conceptoLiteral: 'Transferencia De Miguel Lorenzo Cabanelas Concepto Alquiler Enero' });

    await reconocerYGuardar([id]);

    const movs = await todos<Movement>('movements');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ amount: 650, categoryKey: 'alquiler', ambito: 'INMUEBLE', inmuebleId: '4', unifiedStatus: 'conciliado', statusConciliacion: 'match_automatico', descripcionPrevision: 'Renta · Miguel Lorenzo Cabanelas' });
    const eventos = await todos<TreasuryEvent>('treasuryEvents');
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      type: 'income',
      sourceType: 'contrato',
      sourceId: 21,
      contratoId: 21,
      inmuebleId: 4,
      accountId: SANTANDER,
      amount: 650,
      predictedDate: '2025-01-05',
      status: 'executed',
      executedMovementId: movs[0].id,
      actualAmount: 650,
      actualDate: '2025-01-05',
    });
    expect(await linea(id)).toMatchObject({ estado: 'resuelta', comoSeResolvio: 'motor' });
  });

  it('el MES EN CURSO · si el contrato tiene previsión sin ejecutar cerca, se ejecuta ESA y no nace otra', async () => {
    await sembrar('contracts', [contrato]);
    await sembrar('treasuryEvents', [
      { id: 900, type: 'income', amount: 650, predictedDate: '2026-08-05', description: 'Renta – Miguel Lorenzo Cabanelas', sourceType: 'contrato', sourceId: 21, accountId: SANTANDER, inmuebleId: 4, status: 'predicted', createdAt: AHORA, updatedAt: AHORA },
    ]);
    const id = await nuevaLinea({ fechaOperacion: '2026-08-06', fechaValor: '2026-08-06', importe: 650, conceptoLiteral: 'Transferencia De Miguel Lorenzo Cabanelas Concepto Alquiler' });

    await reconocerYGuardar([id]);

    const eventos = await todos<TreasuryEvent>('treasuryEvents');
    expect(eventos).toHaveLength(1);
    const movs = await todos<Movement>('movements');
    expect(eventos[0]).toMatchObject({ id: 900, status: 'executed', executedMovementId: movs[0].id, actualAmount: 650 });
  });

  it('es IDEMPOTENTE · dos Guardar, un movimiento, un cobro', async () => {
    await sembrar('contracts', [contrato]);
    const id = await nuevaLinea({ fechaOperacion: '2025-01-05', importe: 650, conceptoLiteral: 'Transferencia De Miguel Lorenzo Cabanelas Alquiler' });
    await reconocerYGuardar([id]);
    await reconocerYGuardar([id]);
    expect(await todos('movements')).toHaveLength(1);
    expect(await todos('treasuryEvents')).toHaveLength(1);
  });
});

// ─── traspasos propios ──────────────────────────────────────────────────────

describe('E2.4 · traspaso propio · fuera de gasto e ingreso, con la pata que corresponda', () => {
  it('SALIDA con el IBAN de otra cuenta propia · nace la pata de entrada allí (manual) y la línea enlaza solo la suya', async () => {
    const id = await nuevaLinea({ importe: -1500, conceptoLiteral: 'Transferencia A Favor De Gomez Ramirez Jose Antonio ES79 2100 0813 6101 2345 6789' });
    await reconocerYGuardar([id]);

    const movs = (await todos<Movement>('movements')).sort((a, b) => (a.id as number) - (b.id as number));
    expect(movs).toHaveLength(2);
    const [salida, entrada] = movs;
    expect(salida).toMatchObject({ accountId: SANTANDER, amount: -1500, type: 'Transferencia', categoryKey: 'traspaso_salida', source: 'import', unifiedStatus: 'conciliado', statusConciliacion: 'match_automatico', descripcionPrevision: 'Traspaso a Bankinter' });
    expect(salida.transferMetadata).toEqual({ targetAccountId: BANKINTER, pairMovementId: entrada.id });
    expect(entrada).toMatchObject({ accountId: BANKINTER, amount: 1500, type: 'Transferencia', categoryKey: 'traspaso_entrada', source: 'manual' });
    expect(await linea(id)).toMatchObject({ estado: 'resuelta', movementIds: [salida.id] });
    // Enseña la regla de TRASPASO con su cuenta (E2.2) · y solo esa, no una de «clasificar».
    const reglas = await todos<MovementLearningRule>('movementLearningRules');
    expect(reglas).toHaveLength(1);
    expect(reglas[0]).toMatchObject({ resolucion: 'traspaso', cuentaDestinoId: BANKINTER, appliedCount: 1 });
  });

  it('ENTRADA sin saber de qué cuenta · se marca traspaso SIN par · no se inventa a dónde fue · no enseña', async () => {
    const id = await nuevaLinea({ importe: 2000, conceptoLiteral: 'Transferencia De Gomez Ramirez Jose Antonio Concepto Traspaso' });
    await reconocerYGuardar([id]);

    const movs = await todos<Movement>('movements');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ amount: 2000, type: 'Transferencia', categoryKey: 'traspaso_entrada', unifiedStatus: 'conciliado', descripcionPrevision: 'Traspaso entre tus cuentas' });
    expect(movs[0].transferMetadata).toBeUndefined();
    expect(await todos('movementLearningRules')).toEqual([]);
  });

  it('ENTRADA con IBAN de origen · nace la pata de SALIDA en la cuenta de origen', async () => {
    const id = await nuevaLinea({ importe: 700, conceptoLiteral: 'Transferencia De Gomez Ramirez Jose Antonio Desde ES79 2100 0813 6101 2345 6789' });
    await reconocerYGuardar([id]);
    const movs = (await todos<Movement>('movements')).sort((a, b) => (a.id as number) - (b.id as number));
    expect(movs).toHaveLength(2);
    expect(movs[0]).toMatchObject({ accountId: SANTANDER, amount: 700, categoryKey: 'traspaso_entrada' });
    expect(movs[0].transferMetadata).toEqual({ targetAccountId: BANKINTER, pairMovementId: movs[1].id });
    expect(movs[1]).toMatchObject({ accountId: BANKINTER, amount: -700, categoryKey: 'traspaso_salida', source: 'manual' });
  });

  it('la otra pata YA está importada en Bankinter · se emparejan y no nace nada', async () => {
    await sembrar('movements', [
      { id: 501, accountId: BANKINTER, date: '2025-03-03', valueDate: '2025-03-03', amount: 1500, description: 'Transferencia De Gomez Ramirez Jose Antonio', unifiedStatus: 'no_planificado', source: 'import', type: 'Ingreso', origin: 'CSV', movementState: 'Confirmado', state: 'pending', status: 'pendiente', category: { tipo: 'Ingresos' }, ambito: 'PERSONAL', statusConciliacion: 'sin_match', createdAt: AHORA, updatedAt: AHORA },
    ]);
    const id = await nuevaLinea({ importe: -1500, conceptoLiteral: 'Transferencia A Favor De Gomez Ramirez Jose Antonio' });
    await reconocerYGuardar([id]);

    const movs = (await todos<Movement>('movements')).sort((a, b) => (a.id as number) - (b.id as number));
    expect(movs).toHaveLength(2);
    const salida = movs.find((m) => m.accountId === SANTANDER)!;
    const entrada = movs.find((m) => m.id === 501)!;
    expect(salida).toMatchObject({ categoryKey: 'traspaso_salida', type: 'Transferencia', descripcionPrevision: 'Traspaso a Bankinter' });
    expect(salida.transferMetadata).toEqual({ targetAccountId: BANKINTER, pairMovementId: 501 });
    expect(entrada).toMatchObject({ categoryKey: 'traspaso_entrada', type: 'Transferencia', amount: 1500 });
    expect(entrada.transferMetadata).toEqual({ targetAccountId: SANTANDER, pairMovementId: salida.id });
  });

  it('es IDEMPOTENTE · dos Guardar, dos patas', async () => {
    const id = await nuevaLinea({ importe: -1500, conceptoLiteral: 'Transferencia A Favor De Gomez Ramirez Jose Antonio ES79 2100 0813 6101 2345 6789' });
    await reconocerYGuardar([id]);
    await reconocerYGuardar([id]);
    expect(await todos('movements')).toHaveLength(2);
  });

  it('una transferencia a un TERCERO no se toca · sigue en «te necesitan»', async () => {
    const id = await nuevaLinea({ importe: -650, conceptoLiteral: 'Transferencia A Favor De Gonzalo Martin Perez Concepto Alquiler' });
    await reconocerYGuardar([id]);
    expect(await todos('movements')).toEqual([]);
    expect(await linea(id)).toMatchObject({ estado: 'pendiente' });
  });
});

// ─── el camino del presente sigue igual ─────────────────────────────────────

describe('E2.4 · lo que cuadra con una previsión NO pasa por aquí', () => {
  it('un cuadre con previsto (bloque 1) manda sobre el reconocimiento (bloque 2) de la misma línea', async () => {
    await sembrar('compromisosRecurrentes', [{ id: 11, alias: 'Seguro decesos', ambito: 'personal', tipo: 'seguro', proveedor: { nombre: 'Segurcaixa' }, numeroContrato: '07085234611', patron: { tipo: 'mensualDiaFijo', dia: 2 }, importe: { modo: 'fijo', importe: 24.9 }, cuentaCargo: SANTANDER, conceptoBancario: 'SEGURCAIXA', metodoPago: 'domiciliacion', categoria: 'seguros', estado: 'activo' }]);
    await sembrar('treasuryEvents', [{ id: 800, type: 'expense', amount: 24.9, predictedDate: '2026-08-02', description: 'Seguro decesos', sourceType: 'gasto_recurrente', sourceId: 11, accountId: SANTANDER, status: 'predicted', categoryKey: 'seguros', createdAt: AHORA, updatedAt: AHORA }]);
    const id = await nuevaLinea({ fechaOperacion: '2026-08-02', conceptoLiteral: 'Recibo Segurcaixa Adeslas Mandato 07085234611' });
    const r = await reconocerDeterministasDeLineas([await linea(id)]);
    expect(r.origenes.has(id)).toBe(true);

    await confirmDecisions(LOTE, {
      approvedMatches: [{ lineaId: id, treasuryEventId: 800 }],
      ignoredLineaIds: [],
      approvedDeterministic: Array.from(r.origenes.values()),
    });

    const movs = await todos<Movement>('movements');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ statusConciliacion: 'match_manual', descripcionPrevision: 'Seguro decesos' });
    expect((await todos<TreasuryEvent>('treasuryEvents'))[0]).toMatchObject({ id: 800, status: 'executed', executedMovementId: movs[0].id });
  });
});
