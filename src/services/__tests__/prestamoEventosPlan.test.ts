// Préstamos · qué se toca al guardar.
//
// El caso que da sentido al fichero: cambiar el NOMBRE de un préstamo firmado
// hace 57 meses metía sus 57 cuotas ya pagadas en "por confirmar", y de paso
// borraba las que el usuario había confirmado a mano.

import {
  planificarEventos,
  cambiaElCuadro,
  cuotasVencidasSinConfirmar,
} from '../prestamoEventosPlan';
import type { TreasuryEventDescriptor } from '../prestamoCalculatorService';
import type { TreasuryEvent } from '../db';

const HOY = '2026-08-02';

const desc = (n: number, fecha: string): TreasuryEventDescriptor => ({
  fecha,
  tipo: 'gasto',
  importe: -300,
  cuentaId: 1,
  concepto: `Cuota ${n}`,
  prestamoId: 'p1',
  numeroCuota: n,
});

const evento = (over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    prestamoId: 'p1',
    type: 'financing',
    amount: -300,
    predictedDate: '2026-09-01',
    description: 'Cuota',
    sourceType: 'prestamo',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('cuándo se rehace el cuadro', () => {
  const base = { principalInicial: 100000, plazoMesesTotal: 240, diaCargoMes: 1, nombre: 'Hipoteca' };

  it('cambiar el NOMBRE no lo mueve · era lo que resucitaba 57 cuotas', () => {
    expect(cambiaElCuadro(base, { ...base, nombre: 'Hipoteca Santander' })).toBe(false);
  });

  it('cambiar el capital sí', () => {
    expect(cambiaElCuadro(base, { ...base, principalInicial: 120000 })).toBe(true);
  });

  it('cambiar el plazo o el día de cargo también', () => {
    expect(cambiaElCuadro(base, { ...base, plazoMesesTotal: 300 })).toBe(true);
    expect(cambiaElCuadro(base, { ...base, diaCargoMes: 15 })).toBe(true);
  });

  it('sin préstamo previo se rehace · es un alta', () => {
    expect(cambiaElCuadro(null, base)).toBe(true);
  });
});

describe('qué se borra y qué se emite', () => {
  it('una cuota YA VENCIDA nace confirmada · el banco ya la cobró', () => {
    const plan = planificarEventos({
      descriptores: [desc(1, '2022-01-01'), desc(2, '2026-12-01')],
      existentes: [],
      hoy: HOY,
    });

    expect(plan.emitir).toHaveLength(2);
    expect(plan.emitir[0].status).toBe('confirmed');
    expect(plan.emitir[1].status).toBe('predicted');
  });

  it('lo CONFIRMADO a mano no se borra ni se reemite', () => {
    // Antes solo se respetaba `executed`: una cuota confirmada se borraba y
    // volvía como prevista, así que había que puntearla otra vez.
    const plan = planificarEventos({
      descriptores: [desc(1, '2026-09-01')],
      existentes: [evento({ id: 7, numeroCuota: 1, status: 'confirmed' })],
      hoy: HOY,
    });

    expect(plan.borrar).toEqual([]);
    expect(plan.emitir).toHaveLength(0);
  });

  it('lo CONCILIADO tampoco', () => {
    const plan = planificarEventos({
      descriptores: [desc(1, '2026-09-01')],
      existentes: [evento({ id: 7, numeroCuota: 1, status: 'executed' })],
      hoy: HOY,
    });
    expect(plan.borrar).toEqual([]);
    expect(plan.emitir).toHaveLength(0);
  });

  it('lo previsto sí se reemplaza · es lo único que el cuadro puede mover', () => {
    const plan = planificarEventos({
      descriptores: [desc(1, '2026-09-01')],
      existentes: [evento({ id: 7, numeroCuota: 1, status: 'predicted' })],
      hoy: HOY,
    });
    expect(plan.borrar).toEqual([7]);
    expect(plan.emitir).toHaveLength(1);
  });

  it('la disposición se identifica por fecha · no tiene número de cuota', () => {
    const disposicion: TreasuryEventDescriptor = {
      fecha: '2021-11-15',
      tipo: 'ingreso',
      importe: 100000,
      cuentaId: 1,
      concepto: 'Disposición',
      prestamoId: 'p1',
    };
    const plan = planificarEventos({
      descriptores: [disposicion],
      existentes: [
        evento({ id: 3, numeroCuota: undefined, predictedDate: '2021-11-15', status: 'confirmed' }),
      ],
      hoy: HOY,
    });

    expect(plan.borrar).toEqual([]);
    expect(plan.emitir).toHaveLength(0);
  });

  it('el caso de Jose · 57 cuotas pasadas no van a "por confirmar"', () => {
    const cuotas = Array.from({ length: 57 }, (_, i) => {
      const mes = String((i % 12) + 1).padStart(2, '0');
      const anio = 2021 + Math.floor(i / 12);
      return desc(i + 1, `${anio}-${mes}-01`);
    });

    const plan = planificarEventos({ descriptores: cuotas, existentes: [], hoy: HOY });
    const previstas = plan.emitir.filter((e) => e.status === 'predicted');

    expect(plan.emitir).toHaveLength(57);
    expect(previstas).toHaveLength(0);
  });
});


// Reparar lo que ya se emitió mal.
describe('cuotas vencidas que quedaron por confirmar', () => {
  const HOY2 = '2026-08-02';

  it('coge las de préstamo, vencidas y sin confirmar', () => {
    const ids = cuotasVencidasSinConfirmar(
      [
        { id: 1, prestamoId: 'p1', predictedDate: '2022-03-01', status: 'predicted' },
        { id: 2, prestamoId: 'p1', predictedDate: '2024-05-01', status: 'predicted' },
      ],
      HOY2
    );
    expect(ids).toEqual([1, 2]);
  });

  it('NO toca lo futuro · esas sí están por confirmar de verdad', () => {
    expect(
      cuotasVencidasSinConfirmar(
        [{ id: 1, prestamoId: 'p1', predictedDate: '2026-12-01', status: 'predicted' }],
        HOY2
      )
    ).toEqual([]);
  });

  it('NO toca lo que no es de un préstamo · un recibo vencido sí es trabajo', () => {
    expect(
      cuotasVencidasSinConfirmar(
        [{ id: 1, predictedDate: '2022-03-01', status: 'predicted' }],
        HOY2
      )
    ).toEqual([]);
  });

  it('NO toca lo ya confirmado ni lo descartado', () => {
    expect(
      cuotasVencidasSinConfirmar(
        [
          { id: 1, prestamoId: 'p1', predictedDate: '2022-03-01', status: 'confirmed' },
          { id: 2, prestamoId: 'p1', predictedDate: '2022-04-01', status: 'predicted', descartado: true },
        ],
        HOY2
      )
    ).toEqual([]);
  });
});
