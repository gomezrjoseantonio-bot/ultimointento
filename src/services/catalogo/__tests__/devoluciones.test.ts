// E2.4.2-fix · una devolución RESTA del gasto de su familia
//
// El hecho que fija esto: Curenergía cobra una cuota fija todos los meses y
// cada seis regulariza, devolviendo lo que sobró. Antes ese abono acababa en
// «otros ingresos» y pasaban dos cosas malas a la vez — la luz del piso seguía
// costando los 48 € enteros, y los ingresos subían 31,20 € que nadie había
// ganado. El neto del piso descuadraba por los dos lados.
//
// Aquí se comprueba el camino del dinero de punta a punta: qué ES una
// devolución, qué hace en los KPI del mes, qué escribe en la ficha del piso y
// qué acaba deduciendo en el IRPF.

import type { Movement } from '../../db';
import type { GastoInmueble } from '../../db/types-inmuebles';
import { esDevolucion } from '../catalogoUnico';
import { calcularRealidad } from '../../tesoreriaV6Metrics';
import { camposDeCierre } from '../../cierreLineaInmueble';
import { sumaDeducidaPorCasilla } from '../../gastoDeducible';

const AHORA = '2026-08-01T00:00:00.000Z';

const mov = (over: Partial<Movement>): Movement =>
  ({
    id: 1,
    accountId: 1,
    date: '2026-08-10',
    amount: -100,
    description: 'x',
    status: 'conciliado',
    unifiedStatus: 'conciliado',
    source: 'import',
    naturaleza: 'gasto',
    origin: 'CSV',
    movementState: 'Conciliado',
    ambito: 'personal',
    statusConciliacion: 'sin_match',
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  }) as Movement;

const linea = (over: Partial<GastoInmueble>): GastoInmueble =>
  ({
    inmuebleId: 3,
    concepto: 'Luz',
    familia: 'suministro',
    subtipo: 'luz',
    casillaAEAT: '0113',
    ejercicio: 2026,
    fecha: '2026-08-10',
    importe: 48,
    estado: 'confirmado',
    estadoTesoreria: 'confirmed',
    origen: 'tesoreria',
    createdAt: AHORA,
    updatedAt: AHORA,
    ...over,
  }) as GastoInmueble;

describe('qué es una devolución', () => {
  it('un gasto en positivo · y nada más', () => {
    expect(esDevolucion({ naturaleza: 'gasto', amount: 31.2 })).toBe(true);
    // El recibo normal no lo es.
    expect(esDevolucion({ naturaleza: 'gasto', amount: -48 })).toBe(false);
    // Un ingreso de verdad tampoco · la renta entra por su propia puerta.
    expect(esDevolucion({ naturaleza: 'ingreso', amount: 650 })).toBe(false);
    // Ni las dos patas de un traspaso, que no son gasto ni ingreso.
    expect(esDevolucion({ naturaleza: 'movimiento_interno', amount: 2000 })).toBe(false);
  });

  it('sin naturaleza o sin importe no se adivina', () => {
    expect(esDevolucion({})).toBe(false);
    expect(esDevolucion({ naturaleza: 'gasto' })).toBe(false);
    expect(esDevolucion({ naturaleza: 'gasto', amount: 0 })).toBe(false);
  });
});

describe('en los KPI del mes la devolución resta del gasto', () => {
  it('dos cuotas de luz y una regularización · el gasto es el neto', () => {
    const r = calcularRealidad({
      movimientos: [
        mov({ id: 1, amount: -48, familia: 'suministro', subtipo: 'luz' }),
        mov({ id: 2, amount: -48, date: '2026-08-20', familia: 'suministro', subtipo: 'luz' }),
        mov({ id: 3, amount: 31.2, date: '2026-08-25', naturaleza: 'gasto', familia: 'suministro', subtipo: 'luz' }),
      ],
      eventos: [],
      year: 2026,
      month0: 7,
    });

    const gastos = r.lineas.find((l) => l.clave === 'Gastos');
    const ingresos = r.lineas.find((l) => l.clave === 'Ingresos');
    // 48 + 48 − 31,20
    expect(gastos?.real).toBe(64.8);
    // Y lo devuelto NO aparece como dinero ganado.
    expect(ingresos?.real).toBe(0);
  });

  it('la renta sigue contando como ingreso · no se le resta a ningún gasto', () => {
    const r = calcularRealidad({
      movimientos: [
        mov({ id: 1, amount: -48, familia: 'suministro' }),
        mov({ id: 2, amount: 650, naturaleza: 'ingreso', familia: 'alquiler' }),
      ],
      eventos: [],
      year: 2026,
      month0: 7,
    });

    expect(r.lineas.find((l) => l.clave === 'Ingresos')?.real).toBe(650);
    expect(r.lineas.find((l) => l.clave === 'Gastos')?.real).toBe(48);
  });

  it('devuelven más de lo pagado · el gasto queda en negativo y se dice', () => {
    // No se tapa con un cero: significa que ese mes te devolvieron más de lo
    // que pagaste, y esconderlo sería perder dinero de vista.
    const r = calcularRealidad({
      movimientos: [mov({ id: 1, amount: 31.2, naturaleza: 'gasto', familia: 'suministro' })],
      eventos: [],
      year: 2026,
      month0: 7,
    });

    expect(r.lineas.find((l) => l.clave === 'Gastos')?.real).toBe(-31.2);
  });
});

describe('la ficha del piso guarda la devolución en negativo', () => {
  it('un cargo se guarda en positivo · una devolución en negativo', () => {
    // El tercer argumento es quien dice «mi importe trae signo». Lo pasan los
    // caminos que vienen del banco; el que confirma contra una previsión no,
    // porque el importe del evento es una magnitud.
    expect(camposDeCierre({ id: 7, amount: -48, date: '2026-08-10' }, undefined, true).importe).toBe(48);
    expect(camposDeCierre({ id: 8, amount: 31.2, date: '2026-08-25' }, undefined, true).importe).toBe(-31.2);
  });

  it('sin decir que trae signo se guarda la magnitud · como siempre', () => {
    expect(camposDeCierre({ id: 8, amount: 31.2, date: '2026-08-25' }).importe).toBe(31.2);
  });
});

describe('en el IRPF se deduce el neto, no la cuota entera', () => {
  const anio = 365;

  it('la luz de un piso arrendado todo el año deduce cuotas menos devolución', () => {
    const suma = sumaDeducidaPorCasilla(
      [
        linea({ id: 1, importe: 48 }),
        linea({ id: 2, importe: 48, fecha: '2026-09-10' }),
        linea({ id: 3, importe: -31.2, fecha: '2026-09-25', concepto: 'Devolución Curenergía' }),
      ],
      anio,
      anio,
    );

    expect(suma['0113']).toBe(64.8);
  });

  it('con el piso medio año alquilado, el neto se prorratea como el resto', () => {
    const suma = sumaDeducidaPorCasilla(
      [linea({ id: 1, importe: 48 }), linea({ id: 2, importe: -31.2 })],
      100,
      anio,
    );

    // (48 − 31,20) × 100/365
    expect(suma['0113']).toBe(4.6);
  });
});
