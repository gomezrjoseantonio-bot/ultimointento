// Modelo de la sesión de extracto (§4.7).
//
// Lo que fija:
//   · el vocabulario de D4 — cuadran/a resolver/ignoradas son estados de la
//     LÍNEA durante la sesión, no del movimiento;
//   · que lo no resuelto NO viaje al guardar · no se materializa;
//   · que una línea ignorada en una importación anterior no vuelva a pedir
//     atención, y que recuperarla la devuelva a "a resolver" y no a "cuadra";
//   · que asignar a mano gane al emparejamiento automático.

import {
  construirLineas,
  veredictoEfectivo,
  resumir,
  payloadDeConfirmacion,
  lineasAIgnorar,
  lineasPendientes,
  hashesARecuperar,
  movimientosAEfectivo,
  movimientosATraspaso,
  contarIgualesSinResolver,
  idsIgualesAResolver,
  claveDeLineaIgual,
  decisionesVacias,
  type LineaExtracto,
  seOfrecePara,
} from '../extractoSesion';
import type { MatchResult } from '../../../../services/movementMatchingService';
import type { Movement, TreasuryEvent } from '../../../../services/db';

const mov = (id: number, description: string, amount: number, date = '2026-03-10') =>
  ({ id, description, amount, date, accountId: 1 }) as Movement;

const evt = (id: number, description: string, amount: number, date = '2026-03-10') =>
  ({
    id,
    description,
    amount: Math.abs(amount),
    type: amount >= 0 ? 'income' : 'expense',
    predictedDate: date,
    status: 'predicted',
  }) as TreasuryEvent;

const sinMatches: MatchResult = { matches: [], multiMatches: [], sinMatch: [] };

describe('construir las líneas de la sesión', () => {
  it('una línea que casa con un previsto cuadra, y trae el previsto para pintarlo', () => {
    const lineas = construirLineas(
      [mov(10, 'RECIBO IBERDROLA S.A.U.', -74.09)],
      { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 92, reasons: [] }] },
      [evt(5, 'Luz · Tenderina 64', -74)],
      new Set()
    );

    expect(lineas[0].veredicto).toBe('cuadra');
    expect(lineas[0].previsto).toMatchObject({ id: 5, descripcion: 'Luz · Tenderina 64' });
  });

  it('enseña el texto LITERAL del banco · sin limpiar ni embellecer', () => {
    const bruto = 'PAGO TARJ. *4521 COMER  MADRID   REF.998877';
    const lineas = construirLineas([mov(10, bruto, -22.5)], sinMatches, [], new Set());
    expect(lineas[0].textoBanco).toBe(bruto);
  });

  it('sin previsto queda a resolver', () => {
    const lineas = construirLineas([mov(10, 'X', -20)], sinMatches, [], new Set());
    expect(lineas[0].veredicto).toBe('resolver');
  });

  it('varios candidatos NO se eligen solos · a resolver, con la lista para asignar', () => {
    const lineas = construirLineas(
      [mov(10, 'TRANSFERENCIA', -500)],
      {
        matches: [],
        multiMatches: [
          {
            movementId: 10,
            candidates: [
              { movementId: 10, treasuryEventId: 5, score: 80, reasons: [] },
              { movementId: 10, treasuryEventId: 6, score: 79, reasons: [] },
            ],
          },
        ],
        sinMatch: [10],
      },
      [evt(5, 'Alquiler A', -500), evt(6, 'Alquiler B', -500)],
      new Set()
    );

    expect(lineas[0].veredicto).toBe('resolver');
    expect(lineas[0].candidatos).toHaveLength(2);
  });
});

describe('cuadra con lo que ya tenías anotado (Confirmado · "las dos cosas")', () => {
  const conf = (id: number, descripcion: string, importe: number, fecha = '2026-03-10') => ({
    id,
    descripcion,
    importe,
    fecha,
  });

  it('sin previsto pero con un confirmado que ya tenías · cuadra', () => {
    const lineas = construirLineas(
      [mov(10, 'DISPOSICION CAJERO 4521', -20)],
      sinMatches,
      [],
      new Set(),
      new Map([[10, conf(7, 'Sacar del cajero', -20)]])
    );
    expect(lineas[0].veredicto).toBe('cuadra');
    expect(lineas[0].confirmado).toMatchObject({ id: 7 });
  });

  it('al guardar sube el confirmado a Conciliado · no lo empareja con ningún previsto', () => {
    const lineas = construirLineas(
      [mov(10, 'DISPOSICION CAJERO 4521', -20)],
      sinMatches,
      [],
      new Set(),
      new Map([[10, conf(7, 'Sacar del cajero', -20)]])
    );
    const payload = payloadDeConfirmacion(lineas, decisionesVacias());
    expect(payload.reconciliacionesConfirmado).toEqual([
      { importMovementId: 10, confirmadoMovementId: 7 },
    ]);
    expect(payload.approvedMatches).toEqual([]);
  });

  it('el previsto MANDA · si la línea casa con un previsto no se usa el confirmado', () => {
    const lineas = construirLineas(
      [mov(10, 'RECIBO', -20)],
      { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 92, reasons: [] }] },
      [evt(5, 'Un previsto', -20)],
      new Set(),
      new Map([[10, conf(7, 'Confirmado suelto', -20)]])
    );
    expect(lineas[0].confirmado).toBeUndefined();
    const payload = payloadDeConfirmacion(lineas, decisionesVacias());
    expect(payload.approvedMatches).toEqual([{ movementId: 10, treasuryEventId: 5 }]);
    expect(payload.reconciliacionesConfirmado).toEqual([]);
  });

  it('un cuadre con confirmado NO es pendiente · su línea del import sobrevive', () => {
    const lineas = construirLineas(
      [mov(10, 'CAJERO', -20)],
      sinMatches,
      [],
      new Set(),
      new Map([[10, conf(7, 'Cajero', -20)]])
    );
    expect(lineasPendientes(lineas, decisionesVacias())).toEqual([]);
  });

  it('ignorar una línea que cuadraba con un confirmado gana · no la reconcilia', () => {
    const lineas = construirLineas(
      [mov(10, 'CAJERO', -20)],
      sinMatches,
      [],
      new Set(),
      new Map([[10, conf(7, 'Cajero', -20)]])
    );
    const d = decisionesVacias();
    d.ignorados.add(10);
    const payload = payloadDeConfirmacion(lineas, d);
    expect(payload.reconciliacionesConfirmado).toEqual([]);
    expect(payload.ignoredMovementIds).toEqual([10]);
  });
});

describe('líneas ignoradas de importaciones anteriores (D1)', () => {
  const conIgnorada = () => {
    const lineas = construirLineas([mov(10, 'COMISION', -3)], sinMatches, [], new Set());
    return construirLineas([mov(10, 'COMISION', -3)], sinMatches, [], new Set([lineas[0].hashLinea]));
  };

  it('no vuelven a pedir atención al reimportar el mismo extracto', () => {
    expect(conIgnorada()[0].veredicto).toBe('ignorada');
  });

  it('siguen ignoradas aunque ahora cuadren · el usuario ya dijo que no la quiere', () => {
    const base = construirLineas([mov(10, 'COMISION', -3)], sinMatches, [], new Set());
    const lineas = construirLineas(
      [mov(10, 'COMISION', -3)],
      { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 95, reasons: [] }] },
      [evt(5, 'Comisión banco', -3)],
      new Set([base[0].hashLinea])
    );
    expect(lineas[0].veredicto).toBe('ignorada');
  });

  it('recuperarla la devuelve a A RESOLVER, no la da por buena', () => {
    const linea = conIgnorada()[0];
    const d = decisionesVacias();
    d.recuperados.add(10);
    expect(veredictoEfectivo(linea, d)).toBe('resolver');
  });

  it('si además cuadraba sola, recuperarla sí la deja cuadrando', () => {
    const base = construirLineas([mov(10, 'COMISION', -3)], sinMatches, [], new Set());
    const linea = construirLineas(
      [mov(10, 'COMISION', -3)],
      { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 95, reasons: [] }] },
      [evt(5, 'Comisión banco', -3)],
      new Set([base[0].hashLinea])
    )[0];

    const d = decisionesVacias();
    d.recuperados.add(10);
    expect(veredictoEfectivo(linea, d)).toBe('cuadra');
  });

  it('recuperar manda a borrar el hash · si no, se volvería a esconder', () => {
    const linea = conIgnorada()[0];
    const d = decisionesVacias();
    d.recuperados.add(10);
    expect(hashesARecuperar([linea], d)).toEqual([linea.hashLinea]);
  });

  it('recuperar y volver a ignorar en la misma sesión no borra el hash', () => {
    const linea = conIgnorada()[0];
    const d = decisionesVacias();
    d.recuperados.add(10);
    d.ignorados.add(10);
    expect(hashesARecuperar([linea], d)).toEqual([]);
    expect(veredictoEfectivo(linea, d)).toBe('ignorada');
  });
});

describe('las decisiones del usuario', () => {
  const lineas = (): LineaExtracto[] =>
    construirLineas(
      [mov(10, 'A', -10), mov(11, 'B', -20), mov(12, 'C', -30)],
      { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 90, reasons: [] }] },
      [evt(5, 'Previsto A', -10), evt(6, 'Previsto B', -20)],
      new Set()
    );

  it('asignar a mano deja la línea cuadrando', () => {
    const d = decisionesVacias();
    d.asignados.set(11, 6);
    expect(veredictoEfectivo(lineas()[1], d)).toBe('cuadra');
  });

  it('asignar a mano GANA al emparejamiento automático', () => {
    const d = decisionesVacias();
    d.asignados.set(10, 6); // el automático decía 5
    const payload = payloadDeConfirmacion(lineas(), d);
    expect(payload.approvedMatches).toContainEqual({ movementId: 10, treasuryEventId: 6 });
    expect(payload.approvedMatches).not.toContainEqual({ movementId: 10, treasuryEventId: 5 });
  });

  it('ignorar gana a todo · es la última palabra sobre esa línea', () => {
    const d = decisionesVacias();
    d.asignados.set(10, 6);
    d.ignorados.add(10);
    expect(veredictoEfectivo(lineas()[0], d)).toBe('ignorada');
  });

  it('el resumen cuenta las categorías', () => {
    const d = decisionesVacias();
    d.ignorados.add(12);
    expect(resumir(lineas(), d)).toEqual({
      lineas: 3,
      cuadran: 1,
      resolver: 1,
      ignoradas: 1,
    });
  });
});

describe('lo que viaja al pulsar Guardar', () => {
  const tres = () =>
    construirLineas(
      [mov(10, 'A', -10), mov(11, 'B', -20), mov(12, 'C', -30)],
      { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 90, reasons: [] }] },
      [evt(5, 'Previsto A', -10)],
      new Set()
    );

  it('lo que queda A RESOLVER no viaja · por D4 no se materializa', () => {
    const payload = payloadDeConfirmacion(tres(), decisionesVacias());
    const tocados = [
      ...payload.approvedMatches.map((m) => m.movementId),
      ...payload.ignoredMovementIds,
    ];
    expect(tocados).not.toContain(11);
    expect(tocados).not.toContain(12);
  });

  it('lo que cuadra se empareja y lo ignorado se marca', () => {
    const d = decisionesVacias();
    d.ignorados.add(12);
    const payload = payloadDeConfirmacion(tres(), d);

    expect(payload.approvedMatches).toEqual([{ movementId: 10, treasuryEventId: 5 }]);
    expect(payload.ignoredMovementIds).toEqual([12]);
  });

  // Antes este test exigía lo contrario: que las sin resolver salieran listadas
  // para BORRAR su `Movement` (D4). Se invierte a propósito · una línea del
  // banco es dinero que se movió, y perderla es peor que no entenderla.
  it('NINGUNA línea sale listada para borrar · ni las que quedan a resolver', () => {
    expect(lineasPendientes(tres(), decisionesVacias())).toEqual([]);
  });

  it('lo ignorado y lo que cuadra NO son pendientes', () => {
    const d = decisionesVacias();
    d.ignorados.add(12);
    d.asignados.set(11, 5);
    expect(lineasPendientes(tres(), d)).toEqual([]);
  });

  it('no manda sugerencias · §4.7 no ofrece aceptarlas', () => {
    // El canal se retiró en la 2.0.2: no es que viaje vacío, es que ya no
    // existe. Lo que había al otro lado nunca se ejecutaba y además no creaba
    // la fila fiscal del gasto.
    expect(payloadDeConfirmacion(tres(), decisionesVacias())).not.toHaveProperty('approvedSuggestions');
  });

  it('manda a persistir solo lo ignorado en ESTA sesión', () => {
    const d = decisionesVacias();
    d.ignorados.add(12);
    const ls = tres();
    // Devuelve LÍNEAS y no hashes: `ignoreLine` recibe la identidad y calcula
    // el hash por dentro, para que solo exista una implementación del hash.
    expect(lineasAIgnorar(ls, d).map((l) => l.movementId)).toEqual([12]);
  });
});


// Sacar del cajero llega en el extracto como un cargo más. Apuntarlo como gasto
// hunde el patrimonio el día que el dinero solo ha cambiado de sitio, así que
// §4.7 lo PROPONE y, si el usuario acepta, esa línea se convierte en traspaso.
describe('la retirada de efectivo', () => {
  const lineas = (): LineaExtracto[] =>
    construirLineas(
      [mov(10, 'REINTEGRO CAJERO', -200), mov(11, 'RECIBO LUZ', -74)],
      sinMatches,
      [],
      new Set()
    );

  // Queda RESUELTA · y ninguna línea se desmaterializa ya, tampoco la que sigue
  // sin resolver: guardar dejó de borrar movimientos del banco.
  it('queda resuelta · y nada se borra al guardar', () => {
    const d = decisionesVacias();
    d.aEfectivo.add(10);

    expect(veredictoEfectivo(lineas()[0], d)).toBe('cuadra');
    expect(lineasPendientes(lineas(), d)).toEqual([]);
    expect(movimientosAEfectivo(lineas(), d)).toEqual([10]);
  });

  // Confirmarle además un previsto daría por pagado con el mismo dinero dos
  // cosas distintas.
  it('marcada como efectivo NO se empareja con ningún previsto', () => {
    const conMatch = () =>
      construirLineas(
        [mov(10, 'REINTEGRO CAJERO', -200)],
        { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 90, reasons: [] }] },
        [evt(5, 'Un previsto de 200', -200)],
        new Set()
      );
    const d = decisionesVacias();
    d.aEfectivo.add(10);

    expect(payloadDeConfirmacion(conMatch(), d).approvedMatches).toEqual([]);
  });

  it('ignorar sigue ganando · es la última palabra del usuario', () => {
    const d = decisionesVacias();
    d.aEfectivo.add(10);
    d.ignorados.add(10);

    expect(veredictoEfectivo(lineas()[0], d)).toBe('ignorada');
    expect(movimientosAEfectivo(lineas(), d)).toEqual([]);
  });
});

// Un traspaso a otra cuenta propia entra en el extracto como un cargo más
// (P1). Si se apunta como gasto, hunde el saldo y lo cuela en el gráfico. §4.7
// deja marcarlo como "traspaso a [cuenta]" y al guardar se convierte.
describe('el traspaso a otra cuenta al importar (P1)', () => {
  const lineas = (): LineaExtracto[] =>
    construirLineas(
      [mov(10, 'TRANSFERENCIA A NOMINA', -1500), mov(11, 'RECIBO LUZ', -74)],
      sinMatches,
      [],
      new Set()
    );

  // Como efectivo: queda RESUELTA (su movimiento sobrevive) y viaja con su
  // cuenta destino para convertirse al guardar.
  it('queda resuelta y lleva su cuenta destino', () => {
    const d = decisionesVacias();
    d.aTraspaso.set(10, 7); // traspaso a la cuenta 7

    expect(veredictoEfectivo(lineas()[0], d)).toBe('cuadra');
    expect(lineasPendientes(lineas(), d)).toEqual([]);
    expect(movimientosATraspaso(lineas(), d)).toEqual([{ movementId: 10, cuentaDestinoId: 7 }]);
  });

  // Confirmarle además un previsto lo daría por pagado dos veces.
  it('marcada como traspaso NO se empareja con ningún previsto', () => {
    const conMatch = () =>
      construirLineas(
        [mov(10, 'TRANSFERENCIA A NOMINA', -1500)],
        { ...sinMatches, matches: [{ movementId: 10, treasuryEventId: 5, score: 90, reasons: [] }] },
        [evt(5, 'Un previsto de 1500', -1500)],
        new Set()
      );
    const d = decisionesVacias();
    d.aTraspaso.set(10, 7);

    expect(payloadDeConfirmacion(conMatch(), d).approvedMatches).toEqual([]);
  });

  // Ignorar es la última palabra: no se convierte en traspaso.
  it('ignorar gana · no se convierte', () => {
    const d = decisionesVacias();
    d.aTraspaso.set(10, 7);
    d.ignorados.add(10);

    expect(veredictoEfectivo(lineas()[0], d)).toBe('ignorada');
    expect(movimientosATraspaso(lineas(), d)).toEqual([]);
  });
});

// El extracto trae varios meses · los que ya están cerrados no se cargan.
// Aquí vivían dos bloques: «meses cerrados · el extracto no reabre lo cerrado»
// y «meses anteriores · se apartan por defecto». Los dos exigían que esas
// líneas se apartaran Y que su `Movement` se borrara al guardar.
//
// Se retiran junto con los destinos que probaban. El «mes cerrado» además se
// apoyaba en algo que no puede ocurrir: `cerrarMes` no tiene un solo llamante
// en la app, así que ningún mes está cerrado y ninguna línea podía serlo de
// verdad. Lo que queda es el candado inverso.
describe('ninguna línea se aparta por su fecha', () => {
  const viejas = () =>
    construirLineas(
      [mov(10, 'CARGO DE ENERO', -40), mov(11, 'CARGO DE HOY', -25)],
      sinMatches,
      [],
      new Set()
    );

  it('un cargo antiguo queda a resolver, como cualquier otro', () => {
    const l = viejas();
    expect(l[0].veredicto).toBe('resolver');
    expect(l[1].veredicto).toBe('resolver');
  });

  it('y ninguno se manda a borrar al guardar', () => {
    expect(lineasPendientes(viejas(), decisionesVacias())).toEqual([]);
  });

  it('el resumen no tiene dónde esconderlos · todos cuentan como a resolver', () => {
    expect(resumir(viejas(), decisionesVacias()).resolver).toBe(2);
  });
});

// A2 · marcar traspasos IGUALES en lote (los 28 "Pago en Revolut −30").
describe('lote de traspasos iguales (A2)', () => {
  const ls = (): LineaExtracto[] =>
    construirLineas(
      [
        mov(1, 'PAGO EN REVOLUT', -30, '2026-08-02'),
        mov(2, 'PAGO EN REVOLUT', -30, '2026-08-03'),
        mov(3, 'PAGO EN REVOLUT', -30, '2026-08-04'),
        mov(4, 'RECIBO LUZ', -74, '2026-08-05'),
        mov(5, 'PAGO EN REVOLUT', 30, '2026-08-06'), // signo distinto: NO igual
      ],
      sinMatches,
      [],
      new Set()
    );

  it('cuenta los cargos iguales sin resolver, por clave', () => {
    const m = contarIgualesSinResolver(ls(), decisionesVacias());
    expect(m.get(claveDeLineaIgual({ textoBanco: 'PAGO EN REVOLUT', importe: -30 }))).toBe(3);
    // El ingreso de +30 no cuenta con los cargos.
    expect(m.get(claveDeLineaIgual({ textoBanco: 'RECIBO LUZ', importe: -74 }))).toBe(1);
  });

  it('las iguales a resolver excluyen la propia, el otro concepto y el otro signo', () => {
    const lineas = ls();
    const ids = idsIgualesAResolver(lineas, decisionesVacias(), lineas[0]);
    expect(ids.sort()).toEqual([2, 3]);
  });

  it('una igual ya cuadrada NO entra en el lote', () => {
    const lineas = ls();
    const d = decisionesVacias();
    d.asignados.set(2, 99); // la 2 ya la resolvió el usuario
    const ids = idsIgualesAResolver(lineas, d, lineas[0]);
    expect(ids).toEqual([3]);
  });
});

// ─── qué previsiones se ofrecen al extracto ─────────────────────────────────

describe('seOfrecePara · a qué previsión se le puede asignar una línea', () => {
  const prev = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
    ({
      id: 1, type: 'expense', amount: 60, predictedDate: '2026-08-15',
      description: 'Comunidad', accountId: 7, status: 'predicted',
      sourceType: 'gasto_recurrente', createdAt: '', updatedAt: '', ...over,
    }) as TreasuryEvent;

  it('una prevista de esa cuenta, sí', () => {
    expect(seOfrecePara(prev(), 7)).toBe(true);
  });

  it('la de otra cuenta, no', () => {
    expect(seOfrecePara(prev(), 8)).toBe(false);
  });

  it('una ya ejecutada tampoco · su cargo ya está', () => {
    expect(seOfrecePara(prev({ status: 'executed' as never }), 7)).toBe(false);
  });

  // El fallo que este PR cierra: casarla la dejaba `executed` CON la marca,
  // invisible en pantalla mientras su movimiento movía el saldo.
  it('una DESCARTADA no se ofrece · dijiste que no iba a ocurrir', () => {
    expect(seOfrecePara(prev({ descartado: true }), 7)).toBe(false);
  });

  // La red para las cuotas que el regenerado dejó sin cuenta: sin esto, la
  // hipoteca salía «sin rastro» y no había forma de conciliarla a mano.
  it('una cuota de préstamo huérfana de cuenta sí, para poder cuadrarla', () => {
    expect(seOfrecePara(prev({ type: 'financing' as never, accountId: undefined }), 7)).toBe(true);
  });

  it('pero una descartada huérfana, no', () => {
    expect(
      seOfrecePara(prev({ type: 'financing' as never, accountId: undefined, descartado: true }), 7)
    ).toBe(false);
  });

  it('sin cuenta destino no se ofrece nada que no sea la cuota huérfana', () => {
    expect(seOfrecePara(prev({ accountId: undefined }), undefined)).toBe(false);
  });
});
