// Los seis candados del §4 · dinero.
//
// Todo lo que se reconoce aquí se da por bueno SIN preguntar al usuario, así que
// un falso positivo no es un detalle de pantalla: mete un gasto en su
// declaración o le cuadra una cuota que no era. Por eso cada fuente tiene su
// caso de que SÍ cuadra y su caso de que NO debe cuadrar.

import { cuotasQueCuadran } from '../cuotasDePrestamo';
import { ventasQueCuadran } from '../ventasDeInmueble';
import { rendimientosQueCuadran } from '../rendimientosDeInversion';
import { nominasQueSeReconocen } from '../nominas';
import { atribucionesDeclaradas } from '../gastoDeclaradoPorInmueble';
import type { Movement } from '../../db';
import type { Prestamo } from '../../../types/prestamos';

const mov = (over: Partial<Movement> & { id: number }): Movement =>
  ({
    accountId: 1,
    date: '2026-08-01',
    amount: -454.66,
    description: '',
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
    ...over,
  }) as Movement;

const prestamo = (over: Record<string, unknown> = {}): Prestamo =>
  ({
    id: 'p1',
    nombre: 'Unicaja Tenderina',
    inmuebleId: '4',
    planPagos: {
      prestamoId: 'p1',
      fechaGeneracion: '',
      periodos: [
        {
          periodo: 7,
          devengoDesde: '2026-07-01',
          devengoHasta: '2026-07-31',
          fechaCargo: '2026-08-01',
          cuota: 454.66,
          interes: 120.4,
          amortizacion: 334.26,
          principalFinal: 100000,
          pagado: false,
        },
      ],
      resumen: { totalIntereses: 0, totalCuotas: 0 },
    },
    ...over,
  }) as unknown as Prestamo;

describe('1 · cuota de préstamo', () => {
  it('casa por fecha + importe y trae el desglose interés/amortización', () => {
    const r = cuotasQueCuadran([mov({ id: 1 })], [prestamo()]);
    expect(r).toHaveLength(1);
    expect(r[0].fuente).toBe('prestamo');
    expect(r[0].como).toBe('fecha_importe');
    expect(r[0].titulo).toBe('Cuota 7/1 · Unicaja Tenderina');
    expect(r[0].desglose).toEqual({ tipo: 'prestamo', periodo: 7, interes: 120.4, amortizacion: 334.26 });
    expect(r[0].inmuebleId).toBe(4);
  });

  it('un céntimo de diferencia NO cuadra · esta fase no aproxima', () => {
    expect(cuotasQueCuadran([mov({ id: 1, amount: -454.67 })], [prestamo()])).toHaveLength(0);
  });

  it('el adelanto de capital no lo gira el banco · no puede casar', () => {
    const p = prestamo();
    p.planPagos!.periodos[0].esAdelantoDeCapital = true;
    expect(cuotasQueCuadran([mov({ id: 1 })], [p])).toHaveLength(0);
  });

  it('una cuota ya pagada con su movimiento no se cuenta dos veces', () => {
    const p = prestamo();
    p.planPagos!.periodos[0].pagado = true;
    p.planPagos!.periodos[0].movimientoTesoreriaId = '99';
    expect(cuotasQueCuadran([mov({ id: 1 })], [p])).toHaveLength(0);
  });

  it('dos préstamos con la misma cuota el mismo día · no se elige a ciegas', () => {
    const otro = prestamo({ id: 'p2', nombre: 'Santander' });
    expect(cuotasQueCuadran([mov({ id: 1 })], [prestamo(), otro])).toHaveLength(0);
  });

  it('un abono nunca es una cuota', () => {
    expect(cuotasQueCuadran([mov({ id: 1, amount: 454.66 })], [prestamo()])).toHaveLength(0);
  });
});

describe('2 · neto de inversión', () => {
  const posicion = (over: Record<string, unknown> = {}) =>
    ({
      id: 'i1',
      nombre: 'SmartFlip',
      tipo: 'prestamo_p2p',
      rendimiento: {
        pagos_generados: [
          {
            id: 5,
            fecha_pago: '2026-08-12',
            importe_bruto: 750,
            retencion_fiscal: 142.5,
            importe_neto: 607.5,
            estado: 'pendiente',
          },
        ],
      },
      ...over,
    }) as never;

  it('el neto casa y el bruto/retención viajan por detrás', () => {
    const r = rendimientosQueCuadran([mov({ id: 2, date: '2026-08-12', amount: 607.5 })], [posicion()]);
    expect(r).toHaveLength(1);
    expect(r[0].fuente).toBe('inversion');
    expect(r[0].desglose).toEqual({ tipo: 'rendimiento', bruto: 750, retencion: 142.5, neto: 607.5 });
  });

  it('una posición SIN pagos_generados no se fuerza · queda en «te necesitan»', () => {
    const sinPagos = posicion({ rendimiento: { tasa_interes_anual: 10 } });
    expect(rendimientosQueCuadran([mov({ id: 2, date: '2026-08-12', amount: 607.5 })], [sinPagos])).toHaveLength(0);
  });

  it('un cobro de rendimiento ENTRA en la cuenta · un cargo no lo es', () => {
    expect(rendimientosQueCuadran([mov({ id: 2, date: '2026-08-12', amount: -607.5 })], [posicion()])).toHaveLength(0);
  });
});

describe('3 · nómina', () => {
  const nomina = (over: Record<string, unknown> = {}) =>
    ({
      id: 1,
      tipo: 'nomina',
      nombre: 'Orange',
      salarioBrutoAnual: 95178,
      distribucion: { tipo: 'catorce', meses: 14 },
      cuentaCobro: { iban: 'ES6100490052632210412715', diaAbono: 25, conceptoBancario: 'NOMINA ORANGE ESPAÑA SAU' },
      ...over,
    }) as never;

  it('se reconoce por concepto · el importe lo pone el banco', () => {
    const r = nominasQueSeReconocen(
      [mov({ id: 3, date: '2026-08-25', amount: 3940.12, description: 'NOMINA ORANGE ESPANA SAU AGOSTO' })],
      [nomina()],
    );
    expect(r).toHaveLength(1);
    expect(r[0].como).toBe('concepto_cuenta_dia');
    expect(r[0].desglose).toBeUndefined();
  });

  it('sin concepto guardado no se adivina · el bruto anual no identifica nada', () => {
    const sinConcepto = nomina({ cuentaCobro: { iban: '', diaAbono: 25, conceptoBancario: '' } });
    expect(
      nominasQueSeReconocen([mov({ id: 3, date: '2026-08-25', amount: 3940.12, description: 'NOMINA ORANGE' })], [sinConcepto]),
    ).toHaveLength(0);
  });

  it('un cargo no es una nómina, aunque el texto coincida', () => {
    expect(
      nominasQueSeReconocen([mov({ id: 3, date: '2026-08-25', amount: -3940.12, description: 'NOMINA ORANGE ESPANA SAU' })], [nomina()]),
    ).toHaveLength(0);
  });
});

describe('4 · gasto declarado por inmueble · atribuye, no concilia', () => {
  // La forma REAL: `GastosInmueble` son cubos numéricos fijos, y el inmueble se
  // identifica por referencia catastral, no por `inmuebleId`.
  const ejercicio = (gastos: Record<string, number>, ref = 'RC1') =>
    ({
      año: 2025,
      aeat: { declaracionCompleta: { inmuebles: [{ refCatastral: ref, gastos }] } },
    }) as never;
  const pisos = [
    { id: 4, alias: 'Tenderina', cadastralReference: 'RC1' },
    { id: 9, alias: 'Carles Buigas', cadastralReference: 'RC2' },
  ] as never[];

  it('«IBI Ayto. Oviedo» trae el piso que lo declaró · pero no lo da por bueno', () => {
    const r = atribucionesDeclaradas(
      [mov({ id: 4, description: 'RECIBO IBI AYTO OVIEDO', amount: -291 })],
      [ejercicio({ ibiTasas: 284 })],
      pisos,
    );
    expect(r).toHaveLength(1);
    expect(r[0].inmuebleId).toBe(4);
    expect(r[0].concepto).toBe('IBI');
    expect(r[0].ejercicio).toBe(2025);
    // No es un reconocimiento · es una señal para la propuesta.
    expect((r[0] as { como?: string }).como).toBeUndefined();
  });

  it('un concepto que no declaró nadie no atribuye nada', () => {
    expect(
      atribucionesDeclaradas([mov({ id: 4, description: 'COMPRA AMAZON', amount: -30 })], [ejercicio({ ibiTasas: 284 })], pisos),
    ).toHaveLength(0);
  });

  it('si DOS pisos declararon comunidad, no se elige uno a ciegas', () => {
    const dos = {
      año: 2025,
      aeat: {
        declaracionCompleta: {
          inmuebles: [
            { refCatastral: 'RC1', gastos: { comunidad: 600 } },
            { refCatastral: 'RC2', gastos: { comunidad: 480 } },
          ],
        },
      },
    } as never;
    expect(
      atribucionesDeclaradas([mov({ id: 4, description: 'COMUNIDAD PROPIETARIOS', amount: -605 })], [dos], pisos),
    ).toHaveLength(0);
  });

  it('un piso sin referencia catastral guardada no se puede atribuir', () => {
    const sinRef = [{ id: 4, alias: 'Tenderina' }] as never[];
    expect(
      atribucionesDeclaradas([mov({ id: 4, description: 'RECIBO IBI', amount: -291 })], [ejercicio({ ibiTasas: 284 })], sinRef),
    ).toHaveLength(0);
  });
});

describe('5 · venta de inmueble', () => {
  const venta = {
    id: 9,
    propertyId: 4,
    saleDate: '2026-08-14',
    salePrice: 185000,
    netProceeds: 120000,
    loanSettlement: { payoffAmount: 60000, cancellationFee: 500, total: 60500 },
    status: 'confirmed',
  } as never;

  it('el cobro de la venta casa por fecha + importe', () => {
    const r = ventasQueCuadran([mov({ id: 5, date: '2026-08-14', amount: 120000 })], [venta]);
    expect(r).toHaveLength(1);
    expect(r[0].fuente).toBe('venta');
    expect(r[0].inmuebleId).toBe(4);
  });

  it('la cancelación de hipoteca también, y sale de la cuenta', () => {
    const r = ventasQueCuadran([mov({ id: 6, date: '2026-08-14', amount: -60500 })], [venta]);
    expect(r).toHaveLength(1);
    expect(r[0].titulo).toContain('ancelaci');
  });

  it('una venta en borrador no concilia nada', () => {
    const borrador = { ...(venta as object), status: 'draft' } as never;
    expect(ventasQueCuadran([mov({ id: 5, date: '2026-08-14', amount: 120000 })], [borrador])).toHaveLength(0);
  });
});

describe('6 · lo variable no se cuela · eso es FASE 3', () => {
  it('la luz por 108,44 contra una previsión de 45 no la reconoce ninguna fuente', () => {
    const luz = mov({ id: 7, date: '2026-08-12', amount: -108.44, description: 'IBERDROLA CLIENTES SAU' });
    expect(cuotasQueCuadran([luz], [prestamo()])).toHaveLength(0);
    expect(ventasQueCuadran([luz], [])).toHaveLength(0);
    expect(rendimientosQueCuadran([luz], [])).toHaveLength(0);
    expect(nominasQueSeReconocen([luz], [])).toHaveLength(0);
  });
});
