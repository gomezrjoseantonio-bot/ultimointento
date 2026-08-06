// Cerrar el mes · VOCABULARIO §6 quater.
//
// Lo que vigila esto es que cerrar no borre y que reabrir no resucite. Un mes
// abierto no distingue «está por llegar» de «no ha llegado»; cerrarlo convierte
// lo segundo en un hecho, y de ese hecho salen las bonificaciones.

import { initDB, type TreasuryEvent } from '../db';
import {
  cerrarMes,
  cierres,
  estaCerrado,
  loQueQuedaAbierto,
  mesesCerrables,
  mesesParaCerrar,
  reabrirMes,
} from '../cierreDeMes';

const HOY = '2026-08-05';

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    type: 'income',
    amount: 1200,
    predictedDate: '2026-07-25',
    description: 'Nómina',
    sourceType: 'nomina',
    status: 'predicted',
    ...over,
  }) as TreasuryEvent;

const sembrar = async (eventos: TreasuryEvent[]): Promise<number[]> => {
  const db = await initDB();
  const ids: number[] = [];
  for (const e of eventos) ids.push(Number(await db.add('treasuryEvents', e)));
  return ids;
};

const leer = async (id: number): Promise<TreasuryEvent> => {
  const db = await initDB();
  return (await db.get('treasuryEvents', id)) as TreasuryEvent;
};

beforeEach(async () => {
  const db = await initDB();
  await db.clear('treasuryEvents');
  await db.delete('keyval', 'cierresDeMes');
});

describe('la lista delante', () => {
  it('dice qué se va a dar por no ocurrido, y cuánto es', async () => {
    await sembrar([
      evento({ amount: 1200, type: 'income' }),
      evento({ amount: 300, type: 'expense', description: 'Luz' }),
      evento({ amount: 50, type: 'expense', status: 'executed', description: 'Ya cobrado' }),
    ]);

    const previo = await loQueQuedaAbierto('2026-07');

    expect(previo.eventos).toHaveLength(2);
    expect(previo.totalEntra).toBe(1200);
    expect(previo.totalSale).toBe(300);
  });

  it('y no toca nada · mirar no es cerrar', async () => {
    const [id] = await sembrar([evento()]);

    await loQueQuedaAbierto('2026-07');

    expect((await leer(id)).descartado).toBeUndefined();
    expect(await estaCerrado('2026-07')).toBe(false);
  });

  // Lo de otros meses no es de este cierre.
  it('solo mira el mes que se le pregunta', async () => {
    await sembrar([evento({ predictedDate: '2026-06-25' }), evento({ predictedDate: '2026-07-25' })]);

    expect((await loQueQuedaAbierto('2026-07')).eventos).toHaveLength(1);
  });
});

describe('cerrar', () => {
  it('lo que quedaba abierto pasa a no ocurrido', async () => {
    const [id] = await sembrar([evento()]);

    await cerrarMes('2026-07', HOY);

    const despues = await leer(id);
    expect(despues.descartado).toBe(true);
    expect(despues.motivoDescarte).toBe('Cierre de 2026-07');
    expect(await estaCerrado('2026-07')).toBe(true);
  });

  // Descartar no es borrar · el evento sigue ahí y se puede deshacer.
  it('no borra nada', async () => {
    const [id] = await sembrar([evento()]);

    await cerrarMes('2026-07', HOY);

    expect(await leer(id)).toBeDefined();
  });

  it('lo que ya ocurrió se queda como está', async () => {
    const [id] = await sembrar([evento({ status: 'executed' })]);

    await cerrarMes('2026-07', HOY);

    expect((await leer(id)).descartado).toBeUndefined();
  });

  // Al mes en curso le quedan días para que llegue lo que falta · darlo por no
  // ocurrido sería el número inventado que esto viene a evitar.
  it('no se cierra un mes que todavía no ha terminado', async () => {
    await expect(cerrarMes('2026-08', HOY)).rejects.toThrow('ya ha terminado');
  });

  it('ni un mes que no es un mes', async () => {
    await expect(cerrarMes('julio', HOY)).rejects.toThrow('AAAA-MM');
  });

  it('cerrar dos veces no descarta dos veces', async () => {
    await sembrar([evento()]);

    const primero = await cerrarMes('2026-07', HOY);
    const segundo = await cerrarMes('2026-07', HOY);

    expect(segundo).toEqual(primero);
    expect(await cierres()).toHaveLength(1);
  });

  // Dos cierres del mismo mes a la vez dejarían DOS registros, y reabrir cogería
  // el primero que encontrase — que puede ser el que no descartó nada.
  it('ni cerrando dos veces a la vez · un mes, un cierre', async () => {
    const [id] = await sembrar([evento()]);

    await Promise.all([cerrarMes('2026-07', HOY), cerrarMes('2026-07', HOY)]);

    expect(await cierres()).toHaveLength(1);
    await reabrirMes('2026-07');
    expect((await leer(id)).descartado).toBeUndefined();
  });
});

// La pantalla ofrece exactamente los meses que el motor acepta · si ofreciera
// uno más, el botón daría un error en vez de cerrar.
describe('qué meses se pueden cerrar', () => {
  it('el mes en curso no está', () => {
    expect(mesesParaCerrar(HOY)).not.toContain('2026-08');
  });

  it('empieza por el último terminado y va hacia atrás', () => {
    expect(mesesParaCerrar(HOY, 3)).toEqual(['2026-07', '2026-06', '2026-05']);
  });

  it('y cruza el año sin inventarse un mes trece', () => {
    expect(mesesParaCerrar('2026-01-15', 2)).toEqual(['2025-12', '2025-11']);
  });

  it('la tira dice, de cada mes, qué queda y si está cerrado', async () => {
    await sembrar([evento(), evento({ type: 'expense', amount: 300 })]);
    await cerrarMes('2026-06', HOY);

    const [julio, junio] = await mesesCerrables(HOY, 2);

    expect(julio).toEqual({ mes: '2026-07', cuantos: 2, totalEntra: 1200, totalSale: 300 });
    expect(junio.cerradoAt).toBeDefined();
  });

  it('todos los que ofrece los acepta el motor', async () => {
    for (const mes of mesesParaCerrar(HOY)) {
      await expect(cerrarMes(mes, HOY)).resolves.toBeDefined();
    }
  });
});

describe('reabrir', () => {
  it('devuelve a previsto lo que el cierre descartó', async () => {
    const [id] = await sembrar([evento()]);
    await cerrarMes('2026-07', HOY);

    await reabrirMes('2026-07');

    // La marca se QUITA, no se pone a false · un registro sin marca y otro con
    // `descartado: false` serían dos maneras de decir lo mismo.
    const despues = await leer(id);
    expect(despues.descartado).toBeUndefined();
    expect(despues.motivoDescarte).toBeUndefined();
    expect(await estaCerrado('2026-07')).toBe(false);
  });

  // Lo que el usuario descartó a mano NO lo descartó el cierre · reabrirlo no
  // es asunto suyo, y resucitarlo le devolvería una previsión que él quitó.
  it('lo que ya estaba descartado a mano sigue descartado', async () => {
    const [aMano] = await sembrar([
      evento({ descartado: true, motivoDescarte: 'No lo voy a cobrar' }),
    ]);
    await cerrarMes('2026-07', HOY);

    await reabrirMes('2026-07');

    const despues = await leer(aMano);
    expect(despues.descartado).toBe(true);
    expect(despues.motivoDescarte).toBe('No lo voy a cobrar');
  });

  // Reabrir el mes no puede desandar un hecho posterior.
  it('lo que entretanto se ejecutó de verdad se queda ejecutado', async () => {
    const [id] = await sembrar([evento()]);
    await cerrarMes('2026-07', HOY);

    const db = await initDB();
    await db.put('treasuryEvents', { ...(await leer(id)), status: 'executed' });
    await reabrirMes('2026-07');

    const despues = await leer(id);
    expect(despues.status).toBe('executed');
    expect(despues.descartado).toBe(true);
  });

  it('reabrir un mes que no estaba cerrado no hace nada', async () => {
    const [id] = await sembrar([evento()]);

    await reabrirMes('2026-07');

    expect((await leer(id)).descartado).toBeUndefined();
  });
});
