// Corregir y borrar lo anotado a mano.
//
// El lápiz en "Confirmados" caía en el alta y CREABA un segundo apunte: en vez
// de arreglar el gasto lo duplicaba. Y el botón de eliminar no hacía nada,
// porque el borrado solo sabía descartar previsiones.
//
// Lo otro que vigila este candado es dónde NO se puede tocar. Un movimiento
// importado del banco es realidad: corregirlo descuadra el saldo contra el que
// se concilia, y al reimportar el extracto vuelve a aparecer. Uno nacido de
// confirmar una previsión se deshace despunteando, que además devuelve la
// previsión a pendiente. Y una transferencia interna son dos apuntes espejo:
// tocar uno solo deja el otro colgado.

import {
  editarMovimiento,
  eliminarMovimiento,
  esMovimientoEditable,
  MovimientoNoEditableError,
} from '../altaMovimientoService';
import { initDB, Movement } from '../db';

const anotado = (over: Partial<Movement> = {}): Movement =>
  ({
    accountId: 1,
    date: '2026-08-03',
    amount: -48,
    description: 'Gas',
    source: 'manual',
    type: 'Gasto',
    origin: 'Manual',
    movementState: 'Confirmado',
    unifiedStatus: 'no_planificado',
    status: 'pendiente',
    category: { tipo: 'Gastos' },
    ambito: 'INMUEBLE',
    statusConciliacion: 'sin_match',
    categoryKey: 'suministro_inmueble',
    subtypeKey: 'gas',
    inmuebleId: '4',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Movement;

const guardar = async (m: Movement): Promise<number> => {
  const db = await initDB();
  return (await db.add('movements', m)) as number;
};

const leer = async (id: number): Promise<Movement | undefined> => {
  const db = await initDB();
  return (await db.get('movements', id)) as Movement | undefined;
};

const correccion = {
  tipo: 'gasto' as const,
  concepto: 'Gas agosto',
  importe: -52,
  fecha: '2026-08-04',
  cuentaId: 1,
  inmuebleId: 7,
  categoryKey: 'suministro_inmueble',
  subtypeKey: 'luz',
};

describe('qué se puede tocar', () => {
  it.each([
    ['importado del banco', anotado({ source: 'import' })],
    ['nacido de confirmar una previsión', anotado({ reference: 'treasury_event:9' })],
    ['una pata de traspaso', anotado({ transferMetadata: { targetAccountId: 2 } })],
  ])('%s, no', (_caso, m) => {
    expect(esMovimientoEditable(m)).toBe(false);
  });

  it('lo anotado a mano, sí', () => {
    expect(esMovimientoEditable(anotado())).toBe(true);
  });
});

describe('corregir lo anotado', () => {
  it('cambia el apunte en el sitio · no crea otro', async () => {
    const db = await initDB();
    const antes = ((await db.getAll('movements')) as Movement[]).length;
    const id = await guardar(anotado());

    await editarMovimiento(id, correccion);

    const despues = ((await db.getAll('movements')) as Movement[]).length;
    expect(despues).toBe(antes + 1); // el que dimos de alta, y ninguno más
    const m = await leer(id);
    expect(m?.description).toBe('Gas agosto');
    expect(m?.amount).toBe(-52);
    expect(m?.date).toBe('2026-08-04');
    expect(m?.inmuebleId).toBe('7');
    expect(m?.subtypeKey).toBe('luz');
  });

  // Reclasificar a algo sin variante tiene que BORRAR la anterior, no dejarla
  // pegada: si no, la fila seguiría diciendo "Gas" para siempre.
  it('reclasificar a algo sin variante limpia la anterior', async () => {
    const id = await guardar(anotado());

    await editarMovimiento(id, { ...correccion, subtypeKey: null, inmuebleId: null });

    const m = await leer(id);
    expect(m?.subtypeKey).toBeUndefined();
    expect(m?.inmuebleId).toBeUndefined();
    expect(m?.ambito).toBe('PERSONAL');
  });

  it('un ingreso deja de ser un gasto entero', async () => {
    const id = await guardar(anotado());

    await editarMovimiento(id, { ...correccion, tipo: 'ingreso', importe: 300 });

    const m = await leer(id);
    expect(m?.amount).toBe(300);
    expect(m?.type).toBe('Ingreso');
    expect(m?.category).toEqual({ tipo: 'Ingresos' });
  });

  // Una transferencia externa sale en negativo como cualquier cargo, así que
  // derivar el tipo del signo la convertía en gasto — y sin vuelta atrás.
  it('una transferencia externa sigue siendo transferencia', async () => {
    const id = await guardar(anotado({ type: 'Transferencia', description: 'A mi hermano' }));

    await editarMovimiento(id, { ...correccion, tipo: 'transferencia', importe: -200 });

    expect((await leer(id))?.type).toBe('Transferencia');
  });

  // La interna son dos apuntes espejo · crear la otra pata al editar dejaría un
  // traspaso a medias, con el dinero saliendo de una cuenta y entrando en
  // ninguna.
  it('no se puede convertir en un traspaso interno', async () => {
    const id = await guardar(anotado());

    await expect(
      editarMovimiento(id, { ...correccion, tipo: 'transferencia', cuentaDestinoId: 2 })
    ).rejects.toThrow(MovimientoNoEditableError);
    expect((await leer(id))?.type).toBe('Gasto');
  });

  it('lo que no es suyo no se toca', async () => {
    const id = await guardar(anotado({ source: 'import' }));

    await expect(editarMovimiento(id, correccion)).rejects.toThrow(MovimientoNoEditableError);
    expect((await leer(id))?.description).toBe('Gas');
  });
});

describe('borrar lo anotado', () => {
  it('desaparece', async () => {
    const id = await guardar(anotado());

    await eliminarMovimiento(id);

    expect(await leer(id)).toBeUndefined();
  });

  it('lo importado del banco sigue ahí', async () => {
    const id = await guardar(anotado({ source: 'import' }));

    await expect(eliminarMovimiento(id)).rejects.toThrow(MovimientoNoEditableError);
    expect(await leer(id)).toBeDefined();
  });
});
