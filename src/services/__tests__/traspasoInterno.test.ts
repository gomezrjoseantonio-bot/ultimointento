// El traspaso interno es UNA cosa escrita dos veces.
//
// Mover dinero entre cuentas propias se guarda en dos apuntes espejo. Corregir
// uno solo hace aparecer o desaparecer dinero de la nada; borrar uno deja el
// otro colgado, con un ingreso que no viene de ningún sitio. Hasta ahora la
// única defensa era no ofrecer el lápiz, y un traspaso mal anotado se quedaba
// mal para siempre.
//
// Lo que vigila este candado es que las dos patas se muevan JUNTAS, y que
// media pareja se niegue a editarse en vez de escribir a ciegas sobre un dato
// roto.

import {
  editarTraspasoInterno,
  eliminarTraspasoInterno,
  esPataDeTraspaso,
  parDeTraspaso,
  TraspasoALaMismaCuentaError,
  TraspasoIncompletoError,
} from '../traspasoInterno';
import { TRANSFER_KEYS } from '../categoryCatalog';
import { initDB, TreasuryEvent } from '../db';

const pata = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    type: 'expense',
    amount: 2000,
    predictedDate: '2026-08-03',
    description: 'Traspaso · salida',
    sourceType: 'manual',
    accountId: 1,
    status: 'predicted',
    ambito: 'PERSONAL',
    categoryKey: TRANSFER_KEYS.SALIDA,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

/** Un traspaso completo de la cuenta 1 a la 2 · devuelve los dos ids. */
async function traspasoDe1a2(): Promise<{ salidaId: number; entradaId: number }> {
  const db = await initDB();
  const salidaId = Number(await db.add('treasuryEvents', pata({}) as never));
  const entradaId = Number(
    await db.add(
      'treasuryEvents',
      pata({
        type: 'income',
        accountId: 2,
        description: 'Traspaso · entrada',
        categoryKey: TRANSFER_KEYS.ENTRADA,
        transferMetadata: { targetAccountId: 1, pairEventId: salidaId },
      }) as never
    )
  );
  const salida = (await db.get('treasuryEvents', salidaId)) as TreasuryEvent;
  await db.put('treasuryEvents', {
    ...salida,
    transferMetadata: { targetAccountId: 2, pairEventId: entradaId },
  });
  return { salidaId, entradaId };
}

const leerEvento = async (id: number): Promise<TreasuryEvent | undefined> => {
  const db = await initDB();
  return (await db.get('treasuryEvents', id)) as TreasuryEvent | undefined;
};

describe('reconocer una pata', () => {
  it('lo es si es traspaso y tiene pareja', () => {
    expect(
      esPataDeTraspaso({
        categoryKey: TRANSFER_KEYS.SALIDA,
        transferMetadata: { targetAccountId: 2, pairEventId: 9 },
      })
    ).toBe(true);
  });

  it('un traspaso sin pareja no lo es · no hay nada que arrastrar', () => {
    expect(
      esPataDeTraspaso({ categoryKey: TRANSFER_KEYS.SALIDA, transferMetadata: { targetAccountId: 2 } })
    ).toBe(false);
  });

  it('un gasto normal tampoco', () => {
    expect(esPataDeTraspaso({ categoryKey: 'suministro_inmueble' })).toBe(false);
  });
});

describe('las dos patas, se entre por donde se entre', () => {
  it('desde la salida y desde la entrada sale el mismo par', async () => {
    const { salidaId, entradaId } = await traspasoDe1a2();

    const desdeSalida = await parDeTraspaso(salidaId);
    const desdeEntrada = await parDeTraspaso(entradaId);

    expect(desdeSalida.salida.id).toBe(salidaId);
    expect(desdeSalida.entrada.id).toBe(entradaId);
    expect(desdeEntrada.salida.id).toBe(salidaId);
    expect(desdeEntrada.entrada.id).toBe(entradaId);
  });

  // Media pareja no se puede editar de forma consistente · antes negarse que
  // escribir sobre un dato roto.
  it('si falta la otra mitad, se niega', async () => {
    const { salidaId, entradaId } = await traspasoDe1a2();
    const db = await initDB();
    await db.delete('treasuryEvents', entradaId);

    await expect(parDeTraspaso(salidaId)).rejects.toThrow(TraspasoIncompletoError);
  });
});

describe('corregir el traspaso entero', () => {
  it('las dos patas cambian a la vez', async () => {
    const { salidaId, entradaId } = await traspasoDe1a2();

    await editarTraspasoInterno(salidaId, {
      fecha: '2026-08-10',
      importe: 1500,
      concepto: 'Al ahorro',
      cuentaOrigenId: 1,
      cuentaDestinoId: 2,
    });

    const salida = await leerEvento(salidaId);
    const entrada = await leerEvento(entradaId);
    expect(salida?.amount).toBe(1500);
    expect(entrada?.amount).toBe(1500);
    expect(salida?.predictedDate).toBe('2026-08-10');
    expect(entrada?.predictedDate).toBe('2026-08-10');
    expect(salida?.description).toBe('Al ahorro · salida');
    expect(entrada?.description).toBe('Al ahorro · entrada');
  });

  // Cada pata conserva su papel: la salida sale del origen y la entrada entra
  // en el destino. Si se cruzan, el dinero va al revés.
  it('cambiar las cuentas no le da la vuelta al traspaso', async () => {
    const { salidaId, entradaId } = await traspasoDe1a2();

    await editarTraspasoInterno(entradaId, {
      fecha: '2026-08-03',
      importe: 2000,
      concepto: 'Traspaso',
      cuentaOrigenId: 3,
      cuentaDestinoId: 4,
    });

    const salida = await leerEvento(salidaId);
    const entrada = await leerEvento(entradaId);
    expect(salida?.accountId).toBe(3);
    expect(salida?.type).toBe('expense');
    expect(entrada?.accountId).toBe(4);
    expect(entrada?.type).toBe('income');
    // `targetAccountId` es siempre "la otra".
    expect(salida?.transferMetadata?.targetAccountId).toBe(4);
    expect(entrada?.transferMetadata?.targetAccountId).toBe(3);
  });

  it('a la misma cuenta no es un traspaso', async () => {
    const { salidaId } = await traspasoDe1a2();

    await expect(
      editarTraspasoInterno(salidaId, {
        fecha: '2026-08-03',
        importe: 2000,
        concepto: 'Traspaso',
        cuentaOrigenId: 1,
        cuentaDestinoId: 1,
      })
    ).rejects.toThrow(TraspasoALaMismaCuentaError);
  });
});

describe('borrar el traspaso entero', () => {
  it('no queda ninguna pata suelta', async () => {
    const { salidaId, entradaId } = await traspasoDe1a2();

    await eliminarTraspasoInterno(salidaId);

    expect(await leerEvento(salidaId)).toBeUndefined();
    expect(await leerEvento(entradaId)).toBeUndefined();
  });

  it('desde la entrada se lleva las dos igual', async () => {
    const { salidaId, entradaId } = await traspasoDe1a2();

    await eliminarTraspasoInterno(entradaId);

    expect(await leerEvento(salidaId)).toBeUndefined();
    expect(await leerEvento(entradaId)).toBeUndefined();
  });
});
