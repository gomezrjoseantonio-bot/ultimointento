// El alias aprendido · lo que el usuario enseña al confirmar una línea.
//
// Confirmar "BIZUM DE MPARWEZ" contra la renta de "Adnan Parwez Khan" no dice
// sólo de qué categoría es el movimiento: dice de QUIÉN es. Eso se perdía, y
// al mes siguiente había que volver a enseñarlo.
//
// El candado vigila las dos cosas que pueden salir mal: que NO se guarde ruido
// —lo que ya se deducía solo no hay que aprenderlo— y que lo aprendido no se
// borre por una confirmación posterior que no aporte nombre.

import { createOrUpdateRule, cargarAliasContraparte } from '../movementLearningService';
import { claveDeNombre } from '../coincidenciaNombre';
import { initDB, Movement } from '../db';

const movimiento = (overrides: Partial<Movement> = {}): Movement =>
  ({
    id: 1,
    accountId: 1,
    date: '2026-04-03',
    amount: 380,
    description: 'BIZUM DE MPARWEZ',
    counterparty: 'MPARWEZ',
    category: { tipo: '' },
    source: 'import',
    unifiedStatus: 'no_planificado',
    status: 'pending',
    ...overrides,
  }) as Movement;

const aprender = (movement: Movement, contraparteConfirmada?: string, learnKey = 'k1') =>
  createOrUpdateRule({
    learnKey,
    categoria: 'Alquiler',
    ambito: 'INMUEBLE',
    movement,
    contraparteConfirmada,
  });

describe('alias de contraparte', () => {
  beforeEach(async () => {
    const db = await initDB();
    const tx = db.transaction('movementLearningRules', 'readwrite');
    await tx.objectStore('movementLearningRules').clear();
    await tx.done;
  });

  it('aprende el nombre que no se podía deducir', async () => {
    await aprender(movimiento(), 'Adnan Parwez Khan');

    const alias = await cargarAliasContraparte();
    expect(alias.get(claveDeNombre('MPARWEZ'))).toEqual(
      new Set([claveDeNombre('Adnan Parwez Khan')])
    );
  });

  // Si "ADNAN PARWEZ" ya casa con "Adnan Parwez Khan" por sí solo, guardar el
  // alias es llenar el store de filas que no enseñan nada.
  it('no guarda lo que ya se deducía solo', async () => {
    await aprender(movimiento({ counterparty: 'ADNAN PARWEZ' }), 'Adnan Parwez Khan');

    expect((await cargarAliasContraparte()).size).toBe(0);
  });

  it('sin nombre confirmado no hay nada que aprender', async () => {
    await aprender(movimiento(), undefined);

    expect((await cargarAliasContraparte()).size).toBe(0);
  });

  it('sin nombre en el banco tampoco', async () => {
    await aprender(
      movimiento({ counterparty: undefined, description: 'TRANSFERENCIA 00218832' }),
      'Adnan Parwez Khan'
    );

    expect((await cargarAliasContraparte()).size).toBe(0);
  });

  // Una confirmación posterior que no traiga nombre no puede desaprender.
  it('lo aprendido sobrevive a una confirmación muda', async () => {
    await aprender(movimiento(), 'Adnan Parwez Khan');
    await aprender(movimiento(), undefined);

    expect((await cargarAliasContraparte()).get(claveDeNombre('MPARWEZ'))).toEqual(
      new Set([claveDeNombre('Adnan Parwez Khan')])
    );
  });

  // El mismo nombre llegando por dos descripciones distintas del banco: son
  // dos reglas, y pueden apuntar a personas distintas. Salen las dos como
  // candidatas y decide el usuario.
  it('dos reglas con el mismo nombre pueden apuntar a personas distintas', async () => {
    await aprender(movimiento(), 'Adnan Parwez Khan', 'k1');
    await aprender(movimiento({ id: 2 }), 'Maria Parwez Lopez', 'k2');

    expect(await cargarAliasContraparte()).toEqual(
      new Map([
        [
          claveDeNombre('MPARWEZ'),
          new Set([claveDeNombre('Adnan Parwez Khan'), claveDeNombre('Maria Parwez Lopez')]),
        ],
      ])
    );
  });

  // Dentro de UNA regla no son dos verdades a la vez: el mismo texto del banco
  // confirmado después contra otra persona es una corrección.
  it('reconfirmar el mismo texto contra otra persona corrige, no acumula', async () => {
    await aprender(movimiento(), 'Adnan Parwez Khan', 'k1');
    await aprender(movimiento(), 'Maria Parwez Lopez', 'k1');

    expect((await cargarAliasContraparte()).get(claveDeNombre('MPARWEZ'))).toEqual(
      new Set([claveDeNombre('Maria Parwez Lopez')])
    );
  });

  // Una regla con un nombre que no deja nada que comparar no puede colarse en
  // el mapa: preguntada contra una previsión sin contraparte, casaría todo.
  it('un nombre ilegible no entra en el mapa', async () => {
    const db = await initDB();
    await db.add('movementLearningRules', {
      learnKey: 'k9',
      counterpartyPattern: '',
      descriptionPattern: '',
      amountSign: 'positive',
      categoria: 'Alquiler',
      ambito: 'INMUEBLE',
      source: 'IMPLICIT',
      createdAt: '2026-03-03',
      updatedAt: '2026-03-03',
      appliedCount: 1,
      aliasContraparte: 'MPARWEZ',
      contraparteCanonica: '4433',
    } as never);

    expect((await cargarAliasContraparte()).size).toBe(0);
  });
});
