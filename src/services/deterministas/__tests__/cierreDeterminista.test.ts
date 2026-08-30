// Lo que ESCRIBE el camino determinista · aquí es donde se toca el dinero.
//
// Un reconocimiento cierra el movimiento sin preguntar, así que lo que se
// protege es que cierre lo justo: que no reescriba el texto del banco (del que
// depende el dedupe), que deje la huella en el origen para que un reimport no
// cuente la cuota dos veces, y que un fallo al anotar no deje la línea sin
// conciliar después de que el usuario haya pulsado Guardar.

import { aplicarReconocimiento, movimientoCerrado, type BaseParaCierre } from '../cierreDeterminista';
import type { OrigenDeterminista } from '../tipos';
import type { Movement } from '../../db';

const AHORA = '2026-08-30T10:00:00.000Z';

const movimiento = (): Movement =>
  ({
    id: 1,
    accountId: 1,
    date: '2026-08-01',
    amount: -454.66,
    description: 'ADEUDO RECIBO PRESTAMO 0049 12345',
    status: 'pendiente',
    unifiedStatus: 'no_planificado',
    source: 'import',
    category: { tipo: 'Gastos' },
    type: 'Gasto',
    origin: 'CSV',
    movementState: 'Confirmado',
    ambito: 'PERSONAL',
    statusConciliacion: 'sin_match',
    createdAt: '',
    updatedAt: '',
  }) as Movement;

const origenPrestamo = (): OrigenDeterminista => ({
  movementId: 1,
  fuente: 'prestamo',
  origenId: 'p1',
  piezaId: '7',
  titulo: 'Cuota 7/240 · Unicaja Tenderina',
  como: 'fecha_importe',
  desglose: { tipo: 'prestamo', periodo: 7, interes: 120.4, amortizacion: 334.26 },
  inmuebleId: 4,
});

/** Base de mentira · guarda en memoria lo que se le pone. */
function baseFalsa(inicial: Record<string, Record<string, unknown>>) {
  const datos: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(inicial));
  const base: BaseParaCierre = {
    async get(store, key) {
      return datos[store]?.[String(key)];
    },
    async put(store, valor) {
      const v = valor as { id?: unknown };
      datos[store] = datos[store] ?? {};
      datos[store][String(v.id)] = v;
      return v;
    },
  };
  return { base, datos };
}

describe('el movimiento cerrado', () => {
  it('NO reescribe el texto del banco · el dedupe depende de él', () => {
    const m = movimiento();
    const cerrado = movimientoCerrado(m, origenPrestamo(), AHORA);
    expect(cerrado.description).toBe('ADEUDO RECIBO PRESTAMO 0049 12345');
    // El nombre legible convive aparte.
    expect(cerrado.descripcionPrevision).toBe('Cuota 7/240 · Unicaja Tenderina');
  });

  it('queda conciliado y con el piso de su origen', () => {
    const cerrado = movimientoCerrado(movimiento(), origenPrestamo(), AHORA);
    expect(cerrado.unifiedStatus).toBe('conciliado');
    expect(cerrado.inmuebleId).toBe('4');
    expect(cerrado.ambito).toBe('INMUEBLE');
  });

  it('se distingue de lo que cerró el usuario a mano', () => {
    // Lo cerró ATLAS por una igualdad exacta, no una persona. Quien audite
    // después tiene que poder separarlos.
    expect(movimientoCerrado(movimiento(), origenPrestamo(), AHORA).statusConciliacion).toBe('match_automatico');
  });

  it('sin inmueble en el origen no se inventa uno', () => {
    const sinPiso = { ...origenPrestamo(), inmuebleId: undefined };
    const cerrado = movimientoCerrado(movimiento(), sinPiso, AHORA);
    expect(cerrado.inmuebleId).toBeUndefined();
    expect(cerrado.ambito).toBe('PERSONAL');
  });
});

describe('la huella en el origen · para que un reimport no cuente dos veces', () => {
  const conPrestamo = () => ({
    movements: { '1': movimiento() as unknown as Record<string, unknown> },
    prestamos: {
      p1: {
        id: 'p1',
        planPagos: {
          periodos: [{ periodo: 7, fechaCargo: '2026-08-01', cuota: 454.66, interes: 120.4, amortizacion: 334.26, pagado: false }],
        },
      },
    },
  });

  it('marca la cuota como pagada por ESTE movimiento', async () => {
    const { base, datos } = baseFalsa(conPrestamo());
    await expect(aplicarReconocimiento(base, origenPrestamo(), AHORA)).resolves.toBe(true);
    const periodo = (datos.prestamos.p1 as { planPagos: { periodos: Array<Record<string, unknown>> } }).planPagos.periodos[0];
    expect(periodo.pagado).toBe(true);
    expect(periodo.movimientoTesoreriaId).toBe('1');
    expect(periodo.fechaPagoReal).toBe('2026-08-01');
  });

  it('el desglose del cuadro NO se recalcula · ya estaba bien', async () => {
    const { base, datos } = baseFalsa(conPrestamo());
    await aplicarReconocimiento(base, origenPrestamo(), AHORA);
    const periodo = (datos.prestamos.p1 as { planPagos: { periodos: Array<Record<string, unknown>> } }).planPagos.periodos[0];
    expect(periodo.interes).toBe(120.4);
    expect(periodo.amortizacion).toBe(334.26);
  });

  it('marca el pago de la inversión como cobrado', async () => {
    const { base, datos } = baseFalsa({
      movements: { '1': { ...movimiento(), amount: 607.5 } as unknown as Record<string, unknown> },
      inversiones: {
        '3': { id: 3, rendimiento: { pagos_generados: [{ id: 5, importe_neto: 607.5, estado: 'pendiente' }] } },
      },
    });
    const origen: OrigenDeterminista = {
      movementId: 1,
      fuente: 'inversion',
      origenId: '3',
      piezaId: '5',
      titulo: 'Rendimiento · SmartFlip',
      como: 'fecha_importe',
      desglose: { tipo: 'rendimiento', bruto: 750, retencion: 142.5, neto: 607.5 },
    };
    await aplicarReconocimiento(base, origen, AHORA);
    const pago = (datos.inversiones['3'] as { rendimiento: { pagos_generados: Array<Record<string, unknown>> } })
      .rendimiento.pagos_generados[0];
    expect(pago.estado).toBe('pagado');
    expect(pago.movimiento_id).toBe(1);
  });
});

describe('cuando algo falla', () => {
  it('si no se puede anotar en el origen, el movimiento se concilia igual', async () => {
    // Perder la huella fiscal es molesto. Dejarle al usuario la línea sin
    // conciliar después de pulsar Guardar es peor, y rompe el cuadre de FASE 1.
    const { base, datos } = baseFalsa({ movements: { '1': movimiento() as unknown as Record<string, unknown> } });
    await expect(aplicarReconocimiento(base, origenPrestamo(), AHORA)).resolves.toBe(true);
    expect((datos.movements['1'] as Movement).unifiedStatus).toBe('conciliado');
  });

  it('un movimiento que ya no existe no cierra nada, y no revienta', async () => {
    const { base } = baseFalsa({ movements: {} });
    await expect(aplicarReconocimiento(base, origenPrestamo(), AHORA)).resolves.toBe(false);
  });
});
