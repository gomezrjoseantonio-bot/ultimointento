// E2.2 · el bucle del aprendizaje, cerrado · contra la base real (fake-indexeddb).
//
// Antes el motor aprendía de UN gesto (aceptar un cuadre con previsto) y lo
// aprendido no resolvía nada. Aquí se prueba lo contrario, de punta a punta:
//   · aprende de la ficha, del traspaso y del reconocimiento determinista;
//   · una regla PROPONE hasta ganarse la confianza (N aplicaciones) y entonces
//     RESUELVE sola al Guardar · nace el movimiento de verdad, con su fila fiscal;
//   · corregirla la devuelve a proponer;
//   · lo auto-resuelto se puede reclasificar, y reclasificarlo también corrige.

import { initDB, type Movement, type MovementLearningRule } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';
import { buildLearnKey, createOrUpdateRule, penalizarRegla } from '../movementLearningService';
import { gastoDesdeMovimiento } from '../altaMovimientoService';
import { convertirLineaEnTraspaso } from '../traspasoDesdeMovimiento';
import { confirmDecisions } from '../confirmarDecisiones';
import { suggestForLineas } from '../movementSuggestionService';
import { movementDesdeLinea } from '../lineaComoMovimiento';
import { APLICACIONES_PARA_RESOLVER_SOLA, puedeResolverSola, tieneConfianza } from '../reglaResuelveSola';

const CUENTA = 9;
const EFECTIVO = 7;
const LOTE = 'lote-e22';

const STORES = ['movements', 'movementLearningRules', 'lineasExtracto', 'gastosInmueble', 'compromisosRecurrentes'];

function lineaBase(over: Partial<LineaExtractoPersistida> = {}): Omit<LineaExtractoPersistida, 'id'> {
  const ahora = '2026-08-25T00:00:00.000Z';
  return {
    fechaOperacion: '2026-08-20',
    fechaValor: '2026-08-20',
    importe: -150,
    conceptoLiteral: 'ADEUDO COMUNIDAD PROPIETARIOS TENDERINA CONTRATO 123456789',
    importBatchId: LOTE,
    accountId: CUENTA,
    hashLinea: `h-${Math.random()}`,
    hashMovement: `m-${Math.random()}`,
    estado: 'pendiente',
    movementIds: [],
    createdAt: ahora,
    updatedAt: ahora,
    ...over,
  };
}

async function db() {
  return initDB();
}

async function nuevaLinea(over: Partial<LineaExtractoPersistida> = {}): Promise<number> {
  const d = await db();
  return Number(await d.add('lineasExtracto', lineaBase(over) as never));
}

async function linea(id: number): Promise<LineaExtractoPersistida> {
  return (await (await db()).get('lineasExtracto', id)) as LineaExtractoPersistida;
}

async function reglas(): Promise<MovementLearningRule[]> {
  return ((await (await db()).getAll('movementLearningRules')) ?? []) as MovementLearningRule[];
}

async function movimientos(): Promise<Movement[]> {
  return ((await (await db()).getAll('movements')) ?? []) as Movement[];
}

/** El movimiento en memoria que el matcheo ve para esta línea · para su clave. */
async function claveDe(lineaId: number): Promise<string> {
  return buildLearnKey(movementDesdeLinea(await linea(lineaId)));
}

/** Una regla con `appliedCount` dado, para la clave de esta línea. */
async function reglaPara(
  lineaId: number,
  appliedCount: number,
  over: Partial<MovementLearningRule> = {}
): Promise<MovementLearningRule> {
  const d = await db();
  const ahora = new Date().toISOString();
  const rule: MovementLearningRule = {
    learnKey: await claveDe(lineaId),
    counterpartyPattern: '',
    descriptionPattern: 'adeudo comunidad propietarios tenderina contrato',
    amountSign: 'negative',
    categoria: 'comunidad_inmueble',
    ambito: 'INMUEBLE',
    inmuebleId: '4',
    source: 'IMPLICIT',
    createdAt: ahora,
    updatedAt: ahora,
    appliedCount,
    resolucion: 'clasificar',
    ...over,
  };
  const id = Number(await d.add('movementLearningRules', rule));
  return { ...rule, id };
}

beforeEach(async () => {
  const d = await db();
  for (const s of STORES) {
    try {
      await d.clear(s as never);
    } catch {
      // un store que no exista en esta versión no bloquea el test
    }
  }
});

// ─── A · aprende de TODOS los gestos ────────────────────────────────────────

describe('E2.2 · A · aprender de todos los gestos', () => {
  it('clasificar por FICHA enseña · nace la regla con categoría, ámbito, piso e identificador', async () => {
    const lineaId = await nuevaLinea();

    const r = await gastoDesdeMovimiento({
      lineaId,
      inmuebleId: 4,
      concepto: 'Comunidad Tenderina',
      importe: -150,
      fecha: '2026-08-20',
      categoryKey: 'comunidad_inmueble',
    });
    expect(r.resultado).toBe('creada');

    const [regla] = await reglas();
    expect(regla).toMatchObject({
      categoria: 'comunidad_inmueble',
      ambito: 'INMUEBLE',
      inmuebleId: '4',
      resolucion: 'clasificar',
      appliedCount: 1,
      identificadores: ['contrato:123456789'],
    });
    // La clave se aprende del texto del BANCO, no del concepto de la ficha.
    expect(regla.learnKey).toBe(await claveDe(lineaId));
  });

  it('clasificar por ficha como PERSONAL enseña ámbito personal, sin piso', async () => {
    const lineaId = await nuevaLinea({ conceptoLiteral: 'NETFLIX.COM' });
    await gastoDesdeMovimiento({
      lineaId,
      inmuebleId: null,
      concepto: 'Netflix',
      importe: -12.99,
      fecha: '2026-08-20',
      categoryKey: 'ocio',
    });
    const [regla] = await reglas();
    expect(regla).toMatchObject({ categoria: 'ocio', ambito: 'PERSONAL' });
    expect(regla.inmuebleId).toBeUndefined();
  });

  it('marcar TRASPASO enseña · «este texto = traspaso a mi cuenta X»', async () => {
    const lineaId = await nuevaLinea({ conceptoLiteral: 'RETIRADA CAJERO SERVIRED 1234' });

    await convertirLineaEnTraspaso(lineaId, EFECTIVO);

    const [regla] = await reglas();
    expect(regla).toMatchObject({
      resolucion: 'traspaso',
      cuentaDestinoId: EFECTIVO,
      categoria: 'traspaso_salida',
      ambito: 'PERSONAL',
      appliedCount: 1,
    });
  });

  it('aceptar un reconocimiento DETERMINISTA enseña lo que el origen trae (piso y categoría)', async () => {
    const lineaId = await nuevaLinea({ conceptoLiteral: 'PRESTAMO 2103 4257 0500106068', importe: -454.66 });

    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [],
      approvedDeterministic: [
        {
          lineaId,
          fuente: 'prestamo',
          origenId: 'p1',
          piezaId: '7',
          titulo: 'Cuota 7/240 · Unicaja',
          como: 'fecha_importe',
          inmuebleId: 4,
          categoryKey: 'vivienda.hipoteca',
        },
      ],
    });

    const [regla] = await reglas();
    expect(regla).toMatchObject({ categoria: 'vivienda.hipoteca', ambito: 'INMUEBLE', inmuebleId: '4' });
    expect((await linea(lineaId)).estado).toBe('resuelta');
  });

  it('un origen determinista SIN categoría no inventa regla', async () => {
    const lineaId = await nuevaLinea({ conceptoLiteral: 'NOMINA ORANGE ESPANA SAU', importe: 3940.12 });
    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [],
      approvedDeterministic: [
        { lineaId, fuente: 'nomina', origenId: 'n1', titulo: 'Nómina · Orange', como: 'concepto_cuenta_dia' },
      ],
    });
    expect(await reglas()).toHaveLength(0);
    expect((await linea(lineaId)).estado).toBe('resuelta');
  });

  it('ignorar NO enseña · es preferencia de atención, no clasificación', async () => {
    const lineaId = await nuevaLinea();
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [lineaId] });
    expect(await reglas()).toHaveLength(0);
    expect((await linea(lineaId)).atencion).toBe('silenciada');
  });
});

// ─── B · la confianza se gana con el uso ────────────────────────────────────

describe('E2.2 · B · umbral · propone hasta N, luego resuelve sola', () => {
  it('N vive en un solo sitio y arranca prudente', () => {
    expect(APLICACIONES_PARA_RESOLVER_SOLA).toBe(3);
    expect(tieneConfianza({ appliedCount: APLICACIONES_PARA_RESOLVER_SOLA - 1 })).toBe(false);
    expect(tieneConfianza({ appliedCount: APLICACIONES_PARA_RESOLVER_SOLA })).toBe(true);
  });

  it('con menos de N aplicaciones la sugerencia PROPONE (resuelveSola=false); al llegar a N, resuelve', async () => {
    const lineaId = await nuevaLinea();
    await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA - 1);

    const antes = (await suggestForLineas([await linea(lineaId)])).get(lineaId)!;
    const viaB = antes.find((s) => s.via === 'learning_rule')!;
    expect(viaB.metadata).toMatchObject({ resuelveSola: false, appliedCount: APLICACIONES_PARA_RESOLVER_SOLA - 1 });

    // Una confirmación más · sin cambiar de opinión.
    const m = movementDesdeLinea(await linea(lineaId));
    await createOrUpdateRule({
      learnKey: buildLearnKey(m),
      categoria: 'comunidad_inmueble',
      ambito: 'INMUEBLE',
      inmuebleId: '4',
      movement: m,
    });

    const despues = (await suggestForLineas([await linea(lineaId)])).get(lineaId)!;
    expect(despues.find((s) => s.via === 'learning_rule')!.metadata).toMatchObject({
      resuelveSola: true,
      appliedCount: APLICACIONES_PARA_RESOLVER_SOLA,
    });
  });

  it('un gasto de INMUEBLE sin casilla no resuelve solo aunque tenga confianza · seguiría pidiéndola', () => {
    expect(
      puedeResolverSola({ appliedCount: 5, ambito: 'INMUEBLE', categoria: 'una_categoria_sin_casilla' })
    ).toBe(false);
    expect(puedeResolverSola({ appliedCount: 5, ambito: 'INMUEBLE', categoria: 'comunidad_inmueble' })).toBe(true);
    expect(puedeResolverSola({ appliedCount: 5, ambito: 'PERSONAL', categoria: 'ocio' })).toBe(true);
    expect(puedeResolverSola({ appliedCount: 5, ambito: 'PERSONAL', categoria: 'x', resolucion: 'traspaso' })).toBe(false);
    expect(
      puedeResolverSola({ appliedCount: 5, ambito: 'PERSONAL', categoria: 'x', resolucion: 'traspaso', cuentaDestinoId: 7 })
    ).toBe(true);
  });

  it('una regla aprendida de traspaso propone TRASPASO (acción `transfer`)', async () => {
    const lineaId = await nuevaLinea({ conceptoLiteral: 'RETIRADA CAJERO SERVIRED 1234' });
    await reglaPara(lineaId, 1, {
      resolucion: 'traspaso',
      cuentaDestinoId: EFECTIVO,
      categoria: 'traspaso_salida',
      ambito: 'PERSONAL',
      inmuebleId: undefined,
    });
    const viaB = (await suggestForLineas([await linea(lineaId)])).get(lineaId)!.find((s) => s.via === 'learning_rule')!;
    expect(viaB.action).toEqual({ kind: 'transfer', cuentaDestinoId: EFECTIVO });
  });
});

// ─── B · corregir penaliza ──────────────────────────────────────────────────

describe('E2.2 · B · corregir una regla la devuelve a proponer', () => {
  it('«No es esto» (penalizarRegla) deja appliedCount a 0 y anota la corrección', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, 5);

    const corregida = await penalizarRegla(regla.id!);

    expect(corregida).toMatchObject({ appliedCount: 0, correcciones: 1 });
    expect(corregida?.ultimaCorreccionAt).toBeDefined();
    expect(tieneConfianza(corregida!)).toBe(false);
  });

  it('cambiar de opinión (otro piso para el mismo concepto) resetea la confianza a 1 y cuenta la corrección', async () => {
    const lineaId = await nuevaLinea();
    await reglaPara(lineaId, 5);
    const m = movementDesdeLinea(await linea(lineaId));

    const r = await createOrUpdateRule({
      learnKey: buildLearnKey(m),
      categoria: 'comunidad_inmueble',
      ambito: 'INMUEBLE',
      inmuebleId: '7', // antes era el 4
      movement: m,
    });

    expect(r).toMatchObject({ inmuebleId: '7', appliedCount: 1, correcciones: 1 });
  });

  it('confirmar lo MISMO no es corrección · la confianza sigue subiendo', async () => {
    const lineaId = await nuevaLinea();
    await reglaPara(lineaId, 2);
    const m = movementDesdeLinea(await linea(lineaId));
    const r = await createOrUpdateRule({
      learnKey: buildLearnKey(m),
      categoria: 'comunidad_inmueble',
      ambito: 'INMUEBLE',
      inmuebleId: '4',
      movement: m,
    });
    expect(r.appliedCount).toBe(3);
    expect(r.correcciones ?? 0).toBe(0);
  });

  it('el canal `reglasCorregidas` de Guardar penaliza la regla', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, 4);
    await confirmDecisions(LOTE, { approvedMatches: [], ignoredLineaIds: [], reglasCorregidas: [regla.id!] });
    const [r] = await reglas();
    expect(r).toMatchObject({ appliedCount: 0, correcciones: 1 });
  });
});

// ─── B · resuelve de verdad ─────────────────────────────────────────────────

describe('E2.2 · B · la regla con confianza RESUELVE al Guardar · nace el movimiento de verdad', () => {
  it('clasificación de inmueble · nace el movimiento clasificado, la fila fiscal, y la línea queda resuelta por el motor', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA);

    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [],
      resueltasPorRegla: [{ lineaId, ruleId: regla.id! }],
    });

    const l = await linea(lineaId);
    expect(l.estado).toBe('resuelta');
    expect(l.comoSeResolvio).toBe('motor');
    expect(l.movementIds).toHaveLength(1);

    const movs = await movimientos();
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({
      accountId: CUENTA,
      amount: -150,
      categoryKey: 'comunidad_inmueble',
      inmuebleId: '4',
      ambito: 'INMUEBLE',
      statusConciliacion: 'match_automatico',
    });
    // El texto del banco se conserva en el movimiento (dedupe por él).
    expect(movs[0].description).toBe('ADEUDO COMUNIDAD PROPIETARIOS TENDERINA CONTRATO 123456789');

    // La fila fiscal existe y apunta al MOVIMIENTO (mina M6), no a la línea.
    const gastos = ((await (await db()).getAll('gastosInmueble')) ?? []) as Array<Record<string, unknown>>;
    expect(gastos).toHaveLength(1);
    expect(gastos[0]).toMatchObject({ inmuebleId: 4, casillaAEAT: '0109', movimientoId: String(movs[0].id) });

    // Resolver sola cuenta como acierto · la confianza sube.
    const [r] = await reglas();
    expect(r.appliedCount).toBe(APLICACIONES_PARA_RESOLVER_SOLA + 1);
  });

  it('es IDEMPOTENTE · guardar dos veces no duplica el movimiento ni la fila', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA);
    const payload = { approvedMatches: [], ignoredLineaIds: [], resueltasPorRegla: [{ lineaId, ruleId: regla.id! }] };

    await confirmDecisions(LOTE, payload);
    await confirmDecisions(LOTE, payload);

    expect(await movimientos()).toHaveLength(1);
    expect(((await (await db()).getAll('gastosInmueble')) ?? []) as unknown[]).toHaveLength(1);
    expect((await linea(lineaId)).movementIds).toHaveLength(1);
  });

  it('SIN confianza no resuelve · aunque la pantalla lo pidiera, la línea sigue pendiente y no nace nada', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA - 1);

    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [],
      resueltasPorRegla: [{ lineaId, ruleId: regla.id! }],
    });

    expect(await movimientos()).toHaveLength(0);
    expect((await linea(lineaId)).estado).toBe('pendiente');
  });

  it('la decisión del usuario MANDA · una línea ignorada no la resuelve la regla', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA);

    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [lineaId],
      resueltasPorRegla: [{ lineaId, ruleId: regla.id! }],
    });

    expect(await movimientos()).toHaveLength(0);
    expect((await linea(lineaId)).atencion).toBe('silenciada');
  });

  it('regla de TRASPASO con confianza · nace la pata de salida y su espejo en la cuenta destino', async () => {
    const lineaId = await nuevaLinea({ conceptoLiteral: 'RETIRADA CAJERO SERVIRED 1234', importe: -200 });
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA, {
      resolucion: 'traspaso',
      cuentaDestinoId: EFECTIVO,
      categoria: 'traspaso_salida',
      ambito: 'PERSONAL',
      inmuebleId: undefined,
    });

    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [],
      resueltasPorRegla: [{ lineaId, ruleId: regla.id! }],
    });

    const movs = await movimientos();
    expect(movs).toHaveLength(2);
    const salida = movs.find((m) => m.accountId === CUENTA)!;
    const entrada = movs.find((m) => m.accountId === EFECTIVO)!;
    expect(salida).toMatchObject({ amount: -200, type: 'Transferencia', categoryKey: 'traspaso_salida' });
    expect(entrada).toMatchObject({ amount: 200, type: 'Transferencia', categoryKey: 'traspaso_entrada' });
    // D2 · la línea solo enlaza SU pata.
    const l = await linea(lineaId);
    expect(l.movementIds).toEqual([salida.id]);
    expect(l.comoSeResolvio).toBe('motor');
  });
});

// ─── §13 · auto no encierra ─────────────────────────────────────────────────

describe('E2.2 · lo auto-resuelto es RECLASIFICABLE en la sesión · y reclasificarlo corrige la regla', () => {
  it('«No es esto» + ficha con otro piso · el movimiento nace con el piso del usuario, una sola fila fiscal, y la regla pierde la confianza', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA);

    // La pantalla la enseñaba en «resueltas» (piso 4). El usuario pulsa «No es
    // esto» y la clasifica por ficha como del piso 7 · la ficha escribe al
    // momento (`gastoDesdeMovimiento`), igual que en el drawer.
    await gastoDesdeMovimiento({
      lineaId,
      inmuebleId: 7,
      concepto: 'Comunidad Uría',
      importe: -150,
      fecha: '2026-08-20',
      categoryKey: 'comunidad_inmueble',
    });
    // Al Guardar, la línea va como `creados` (NO en `resueltasPorRegla`) y la
    // regla desmentida viaja en `reglasCorregidas`.
    await confirmDecisions(LOTE, {
      approvedMatches: [],
      ignoredLineaIds: [],
      resueltasPorRegla: [],
      reglasCorregidas: [regla.id!],
    });

    const movs = await movimientos();
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ inmuebleId: '7', categoryKey: 'comunidad_inmueble' });
    expect(((await (await db()).getAll('gastosInmueble')) ?? []) as unknown[]).toHaveLength(1);

    const [r] = await reglas();
    // La ficha ya la corrigió (cambio de opinión · piso 7) y el Guardar la penalizó.
    expect(r.inmuebleId).toBe('7');
    expect(r.appliedCount).toBe(0);
    expect(r.correcciones).toBeGreaterThanOrEqual(1);
    expect(tieneConfianza(r)).toBe(false);
  });

  it('con la confianza perdida, la siguiente línea igual vuelve a PROPONER, no resuelve', async () => {
    const lineaId = await nuevaLinea();
    const regla = await reglaPara(lineaId, APLICACIONES_PARA_RESOLVER_SOLA);
    await penalizarRegla(regla.id!);

    const otra = await nuevaLinea({ fechaOperacion: '2026-09-20', fechaValor: '2026-09-20' });
    const viaB = (await suggestForLineas([await linea(otra)])).get(otra)!.find((s) => s.via === 'learning_rule')!;
    expect(viaB.metadata).toMatchObject({ resuelveSola: false, appliedCount: 0 });
  });
});
