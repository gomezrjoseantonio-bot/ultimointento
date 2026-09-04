// ============================================================================
// Conciliar · FASE 1 · nada se pierde
// ============================================================================
//
// Los cuatro candados de §4, escritos antes que la pantalla. El fallo que matan:
// hoy `consolidarSesion` BORRA el `Movement` de toda línea sin resolver, y el
// drawer manda ahí también las que aparta como «de meses cerrados». Eso destruye
// movimientos reales del banco.
//
// El invariante de esta fase es de LÍNEAS COLOCADAS, no de saldo: 124 del banco
// = 124 en un bucket. Que una línea esté sin clasificar no la saca del recuento
// ni mueve la caja. Son dos cuadres distintos y no se mezclan.

import {
  bucketDeLinea,
  cuadre,
  type Bucket,
} from '../../modules/tesoreria/v6/conciliarBuckets';
import {
  decisionesVacias,
  lineasPendientes,
  type LineaExtracto,
} from '../../modules/tesoreria/v6/extractoSesion';
import { calculateAccountBalanceAtDate } from '../accountBalanceService';
import type { Account, Movement } from '../db';

const linea = (over: Partial<LineaExtracto> = {}): LineaExtracto =>
  ({
    // E1.2b · las decisiones van por lineaId · distinto de movementId a propósito.
    lineaId: 100 + (over.movementId ?? 1),
    movementId: 1,
    hashLinea: 'h1',
    textoBanco: 'RECIBO /AQUALIA',
    fecha: '2026-08-05',
    importe: -50,
    veredicto: 'resolver',
    ...over,
  }) as LineaExtracto;

// ── 1 · CUADRE · ninguna línea queda fuera ──────────────────────────────────
describe('§4.1 · toda línea cae en exactamente un bucket', () => {
  it('la suma de los buckets es el total de líneas', () => {
    const lineas = [
      linea({ movementId: 1, veredicto: 'cuadra' }),
      linea({ movementId: 2, veredicto: 'resolver' }),
      linea({ movementId: 3, veredicto: 'ignorada' }),
      linea({ movementId: 4, veredicto: 'mes_cerrado' }),
      linea({ movementId: 5, veredicto: 'mes_anterior' }),
    ];
    const c = cuadre(lineas, decisionesVacias());
    expect(c.delBanco).toBe(5);
    expect(c.colocadas).toBe(5);
    expect(c.cuadra).toBe(true);
  });

  // La red de seguridad: un veredicto que nadie previó no puede dejar la línea
  // en el limbo ni la pantalla muerta. Cae en «te necesitan», que es el destino
  // por defecto de lo no clasificado (§3.1).
  it('un veredicto desconocido cae en «te necesitan», no en el limbo', () => {
    const rara = linea({ veredicto: 'algo_que_no_existe' as never });
    expect(bucketDeLinea(rara, decisionesVacias())).toBe<Bucket>('te_necesitan');
    const c = cuadre([rara], decisionesVacias());
    expect(c.colocadas).toBe(1);
    expect(c.cuadra).toBe(true);
  });

  it('sin líneas, cuadra', () => {
    const c = cuadre([], decisionesVacias());
    expect(c.delBanco).toBe(0);
    expect(c.cuadra).toBe(true);
  });
});

// ── Los cuatro buckets del mockup ───────────────────────────────────────────
describe('§3.1 · los cuatro buckets', () => {
  it('lo que cuadra con un previsto se resuelve solo', () => {
    expect(bucketDeLinea(linea({ veredicto: 'cuadra' }), decisionesVacias())).toBe<Bucket>('resueltas');
  });

  it('lo que no cuadra te necesita', () => {
    expect(bucketDeLinea(linea({ veredicto: 'resolver' }), decisionesVacias())).toBe<Bucket>('te_necesitan');
  });

  it('ignorar es una acción del usuario, con su apartado', () => {
    expect(bucketDeLinea(linea({ veredicto: 'ignorada' }), decisionesVacias())).toBe<Bucket>('ignorados');
  });

  // El bucket que desaparece: «mes cerrado» y «mes anterior» dejan de ser un
  // destino. Nadie puede cerrar un mes (`cerrarMes` no tiene llamante) y esas
  // líneas se estaban borrando.
  it('«mes cerrado» ya no aparta: te necesita como cualquier otra', () => {
    expect(bucketDeLinea(linea({ veredicto: 'mes_cerrado' }), decisionesVacias())).toBe<Bucket>('te_necesitan');
  });

  it('«mes anterior» tampoco', () => {
    expect(bucketDeLinea(linea({ veredicto: 'mes_anterior' }), decisionesVacias())).toBe<Bucket>('te_necesitan');
  });

  it('una decisión del usuario manda sobre el veredicto automático', () => {
    const d = decisionesVacias();
    d.ignorados.add(107); // la línea 7 · por su lineaId
    expect(bucketDeLinea(linea({ movementId: 7, veredicto: 'cuadra' }), d)).toBe<Bucket>('ignorados');
  });
});

// ── 2 · NO-BORRADO · el candado que más dinero toca ─────────────────────────
//
// Hoy `consolidarSesion` borra el `Movement` de toda línea que llegue en
// `lineasPendientes`, y ahí llegaban las sin resolver Y las apartadas por fecha.
// Este test pasa de rojo a verde con el cambio.


describe('§4.2 · guardar no borra ninguna línea', () => {
  it('una línea sin resolver NO se manda a desmaterializar', () => {
    const sinResolver = linea({ movementId: 9, veredicto: 'resolver' });
    expect(lineasPendientes([sinResolver], decisionesVacias())).toEqual([]);
  });

  it('ni siquiera las que antes se apartaban por fecha', () => {
    const viejas = [
      linea({ movementId: 10, veredicto: 'mes_cerrado' as never }),
      linea({ movementId: 11, veredicto: 'mes_anterior' as never }),
    ];
    expect(lineasPendientes(viejas, decisionesVacias())).toEqual([]);
  });

  it('una ignorada tampoco · ignorar es apartar, no destruir', () => {
    expect(lineasPendientes([linea({ movementId: 12, veredicto: 'ignorada' })], decisionesVacias()))
      .toEqual([]);
  });
});

// ── 3 · CORTE POR SALDO · colocar no es contar ──────────────────────────────
//
// Dos cuadres distintos y no se mezclan: el de LÍNEAS —toda línea en un bucket—
// y el del SALDO, que tiene su propia frontera en `openingBalanceDate`.
//
// Una línea anterior a la apertura de la cuenta se COLOCA (nadie la borra) y
// aun así no mueve la caja: su importe ya está dentro del saldo inicial, y
// sumarlo otra vez lo contaría dos veces.


const cuenta = {
  id: 1,
  openingBalance: 1000,
  openingBalanceDate: '2026-08-27',
} as unknown as Account;

const movimiento = (over: Partial<Movement>): Movement =>
  ({ id: 1, accountId: 1, date: '2026-08-28', amount: -100, description: 'X', ...over }) as Movement;

describe('§4.3 · las líneas anteriores al corte se colocan, no descartan', () => {
  it('una línea anterior a la apertura NO altera el saldo', () => {
    const saldo = calculateAccountBalanceAtDate({
      account: cuenta,
      cutoffDate: '2026-08-31',
      treasuryEvents: [],
      movements: [movimiento({ id: 5, date: '2026-08-01', amount: -300 })],
    });
    expect(saldo).toBe(1000);
  });

  it('una posterior sí · esa es la diferencia', () => {
    const saldo = calculateAccountBalanceAtDate({
      account: cuenta,
      cutoffDate: '2026-08-31',
      treasuryEvents: [],
      movements: [movimiento({ id: 6, date: '2026-08-28', amount: -300 })],
    });
    expect(saldo).toBe(700);
  });

  // Lo que importa de esta fase: la línea vieja EXISTE y está colocada. Antes se
  // borraba, así que ni contaba ni se veía — desaparecía.
  it('y esa línea vieja sigue teniendo su sitio en un bucket', () => {
    const vieja = linea({ movementId: 5, fecha: '2026-08-01', veredicto: 'resolver' });
    expect(bucketDeLinea(vieja, decisionesVacias())).toBe<Bucket>('te_necesitan');
    expect(cuadre([vieja], decisionesVacias()).cuadra).toBe(true);
  });
});
