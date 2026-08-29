// ============================================================================
// Una cuenta no debe cargos de antes de existir
// ============================================================================
//
// El motor proyecta desde el día 1 del mes en curso —y con razón: un recibo que
// se cobra el día 1 y que das de alta el día 3 necesita su previsión para poder
// cuadrar con el cargo real—. Pero no miraba desde cuándo existe la cuenta. Con
// una cuenta abierta el 27 de agosto salían previstos del 1, del 5 y del 10:
// cargos que jamás pudieron salir de ahí, porque no había cuenta.
//
// El saldo no se enteraba (`accountBalanceService` tiene su frontera), pero la
// lista de pendientes sí los contaba: el saldo decía una cosa y el trabajo
// pendiente otra, y se te pedía confirmar un cargo imposible.

import { generarEventosDesdeCompromiso } from '../compromisosRecurrentesService';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { Account } from '../../db';

const CUENTA = 1;
const DIA_DEL_CARGO = 5;

const hoy = new Date();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esteMes = (d: number) => iso(new Date(hoy.getFullYear(), hoy.getMonth(), d));
const mesQueViene = (d: number) => iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, d));

/** Dos cargos en la ventana: el de este mes y el del siguiente. */
const CARGO_DE_ESTE_MES = esteMes(DIA_DEL_CARGO);
const CARGO_DEL_MES_QUE_VIENE = mesQueViene(DIA_DEL_CARGO);
const HASTA = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 28);

const compromiso = (over: Partial<CompromisoRecurrente> = {}): CompromisoRecurrente =>
  ({
    id: 7,
    ambito: 'personal',
    alias: 'Agua',
    proveedor: { nombre: 'Aqualia' },
    patron: { tipo: 'mensualDiaFijo', dia: DIA_DEL_CARGO },
    importe: { modo: 'fijo', importe: 10 },
    cuentaCargo: CUENTA,
    conceptoBancario: 'AQUALIA',
    metodoPago: 'domiciliacion',
    categoria: 'personal.dia_a_dia' as never,
    bolsaPresupuesto: 'necesidades',
    responsable: 'titular',
    fechaInicio: '2019-01-01',
    estado: 'activo',
    createdAt: '2019-01-01',
    updatedAt: '2019-01-01',
    ...over,
  }) as unknown as CompromisoRecurrente;

const cuenta = (openingBalanceDate?: string, id = CUENTA): Account =>
  ({ id, alias: 'Unicaja', openingBalanceDate }) as unknown as Account;

const fechas = (cuentas: Account[], c = compromiso()): string[] =>
  generarEventosDesdeCompromiso(c, HASTA, undefined, undefined, cuentas)
    .map((e) => e.predictedDate)
    .sort();

describe('no se prevé nada de antes de que la cuenta existiera', () => {
  it('con la cuenta abierta después del cargo, ese cargo no se emite', () => {
    expect(fechas([cuenta(esteMes(20))])).toEqual([CARGO_DEL_MES_QUE_VIENE]);
  });

  it('el propio día de la apertura sí cuenta · ese día ya hay cuenta', () => {
    expect(fechas([cuenta(CARGO_DE_ESTE_MES)])).toContain(CARGO_DE_ESTE_MES);
  });
});

describe('lo que NO cambia', () => {
  it('una cuenta abierta antes del mes no recorta nada', () => {
    expect(fechas([cuenta('2019-01-01')])).toEqual([CARGO_DE_ESTE_MES, CARGO_DEL_MES_QUE_VIENE]);
  });

  it('una cuenta sin fecha de apertura no recorta nada · no hay frontera', () => {
    expect(fechas([cuenta(undefined)])).toEqual([CARGO_DE_ESTE_MES, CARGO_DEL_MES_QUE_VIENE]);
  });

  // La lista de cuentas puede no llegar. Sin ella el motor se comporta como
  // siempre: nunca deja de emitir por no saber.
  it('sin la lista de cuentas tampoco recorta · en la duda se emite', () => {
    expect(fechas([])).toEqual([CARGO_DE_ESTE_MES, CARGO_DEL_MES_QUE_VIENE]);
  });

  it('la apertura de OTRA cuenta no recorta la del cargo', () => {
    expect(fechas([cuenta(esteMes(20), 99)])).toEqual([
      CARGO_DE_ESTE_MES,
      CARGO_DEL_MES_QUE_VIENE,
    ]);
  });

  // El recorte solo puede ATRASAR el arranque, nunca adelantarlo: un gasto que
  // empieza después de la apertura sigue mandando con su propia fecha.
  it('la apertura no adelanta un gasto que empieza más tarde', () => {
    const tardio = compromiso({ fechaInicio: esteMes(10) });
    expect(fechas([cuenta('2019-01-01')], tardio)).toEqual([CARGO_DEL_MES_QUE_VIENE]);
  });
});
