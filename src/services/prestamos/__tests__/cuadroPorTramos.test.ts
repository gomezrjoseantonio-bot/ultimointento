// El cuadro cuando el tipo cambia a mitad de vida · VOCABULARIO §6 ter · ter.
//
// Lo que vigila esto es que confirmar una revisión no reescriba el pasado. Los
// intereses de las cuotas ya cobradas ocurrieron a otro tipo: recalcularlos
// cambiaría un hecho, y encima daría una cuota futura que no es la que el banco
// va a cobrar.

import { recalcularDesde } from '../cuadroPorTramos';
import { prestamosCalculationService } from '../../prestamosCalculationService';
import type { PlanPagos, PeriodoPago } from '../../../types/prestamos';

/** Un cuadro francés de verdad · el mismo que genera el servicio. */
const plan = (over: Partial<PlanPagos> = {}): PlanPagos => {
  const capital = 50000;
  const tin = 4.13;
  const meses = 24;
  const cuota = Math.round(prestamosCalculationService.calculateFrenchPayment(capital, tin, meses) * 100);
  let vivo = capital * 100;
  const periodos: PeriodoPago[] = [];

  for (let i = 1; i <= meses; i++) {
    const interes = Math.round(((vivo / 100) * (tin / 100)) / 12 * 100);
    const amort = i === meses ? vivo : cuota - interes;
    const importe = i === meses ? amort + interes : cuota;
    vivo -= amort;
    const mes = String(((i - 1) % 12) + 1).padStart(2, '0');
    const anio = 2025 + Math.floor((i - 1) / 12);
    periodos.push({
      periodo: i,
      devengoDesde: `${anio}-${mes}-01`,
      devengoHasta: `${anio}-${mes}-28`,
      fechaCargo: `${anio}-${mes}-28`,
      cuota: importe / 100,
      interes: interes / 100,
      amortizacion: amort / 100,
      principalFinal: vivo / 100,
      pagado: i <= 8,
    });
  }

  return {
    prestamoId: 'p1',
    fechaGeneracion: '2025-01-01T00:00:00.000Z',
    periodos,
    resumen: {
      totalIntereses: Math.round(periodos.reduce((s, p) => s + p.interes, 0) * 100) / 100,
      totalCuotas: meses,
      fechaFinalizacion: periodos[periodos.length - 1].fechaCargo,
    },
    ...over,
  };
};

const céntimos = (n: number) => Math.round(n * 100);

describe('lo pagado no se toca', () => {
  it('las cuotas anteriores a la revisión quedan idénticas', () => {
    const original = plan();
    const nuevo = recalcularDesde(original, { desde: '2025-09-28', tinAnual: 5.5, base: '30/360' });

    expect(nuevo.periodos.slice(0, 8)).toEqual(original.periodos.slice(0, 8));
  });

  // Es el punto entero de esto · con el cuadro regenerado al tipo nuevo, los
  // intereses ya cobrados cambiaban de importe.
  it('los intereses ya cobrados no cambian de importe', () => {
    const original = plan();
    const nuevo = recalcularDesde(original, { desde: '2025-09-28', tinAnual: 9, base: '30/360' });

    const antesOriginal = original.periodos.slice(0, 8).reduce((s, p) => s + p.interes, 0);
    const antesNuevo = nuevo.periodos.slice(0, 8).reduce((s, p) => s + p.interes, 0);
    expect(céntimos(antesNuevo)).toBe(céntimos(antesOriginal));
  });

  // La cuota del día de la revisión es la PRIMERA ya revisada · el banco cobra
  // ese día al tipo nuevo.
  it('la del mismo día de la revisión entra en el tramo nuevo', () => {
    const original = plan();
    const nuevo = recalcularDesde(original, { desde: '2025-09-28', tinAnual: 9, base: '30/360' });

    expect(nuevo.periodos[8].cuota).not.toBe(original.periodos[8].cuota);
  });
});

describe('la cuota nueva sale del capital vivo', () => {
  // La cuenta de la carta · «252,62 € calculada sobre el capital pendiente de
  // amortizar de 47.394,19 € a fecha 31/03/2026».
  it('es la francesa sobre lo que queda, al tipo nuevo, en los meses que faltan', () => {
    const original = plan();
    const nuevo = recalcularDesde(original, { desde: '2025-09-28', tinAnual: 5.5, base: '30/360' });

    const vivoAlCorte = original.periodos[7].principalFinal;
    const esperada = prestamosCalculationService.calculateFrenchPayment(vivoAlCorte, 5.5, 16);

    expect(céntimos(nuevo.periodos[8].cuota)).toBe(céntimos(esperada));
  });

  it('subir el tipo sube la cuota, y bajarlo la baja', () => {
    const original = plan();
    const cuotaVieja = original.periodos[8].cuota;

    expect(recalcularDesde(original, { desde: '2025-09-28', tinAnual: 6, base: '30/360' }).periodos[8].cuota)
      .toBeGreaterThan(cuotaVieja);
    expect(recalcularDesde(original, { desde: '2025-09-28', tinAnual: 2, base: '30/360' }).periodos[8].cuota)
      .toBeLessThan(cuotaVieja);
  });

  it('el préstamo sigue terminando en cero', () => {
    const nuevo = recalcularDesde(plan(), { desde: '2025-09-28', tinAnual: 5.5, base: '30/360' });

    expect(nuevo.periodos[nuevo.periodos.length - 1].principalFinal).toBe(0);
  });

  it('el total de intereses se recalcula, no se hereda', () => {
    const original = plan();
    const nuevo = recalcularDesde(original, { desde: '2025-09-28', tinAnual: 9, base: '30/360' });

    expect(nuevo.resumen.totalIntereses).toBeGreaterThan(original.resumen.totalIntereses);
    expect(céntimos(nuevo.resumen.totalIntereses)).toBe(
      céntimos(nuevo.periodos.reduce((s, p) => s + p.interes, 0))
    );
  });

  // Lo que se recalcula está POR VENIR · si constaba pagado, su importe ya no
  // es el que se pagó.
  it('lo rehecho deja de constar pagado', () => {
    const nuevo = recalcularDesde(plan(), { desde: '2025-05-28', tinAnual: 5.5, base: '30/360' });

    expect(nuevo.periodos.slice(4).every((p) => p.pagado === false)).toBe(true);
    expect(nuevo.periodos.slice(0, 4).every((p) => p.pagado === true)).toBe(true);
  });

  // Su importe ya no es el que se pagó, así que el movimiento con el que se
  // cuadró tampoco lo prueba · un enlace al vacío se lee como «esto ya está».
  it('lo rehecho suelta el movimiento con el que estaba cuadrado', () => {
    const original = plan();
    original.periodos[8].movimientoTesoreriaId = 'mov-42';
    original.periodos[3].movimientoTesoreriaId = 'mov-7';

    const nuevo = recalcularDesde(original, { desde: '2025-09-28', tinAnual: 5.5, base: '30/360' });

    expect(nuevo.periodos[8].movimientoTesoreriaId).toBeUndefined();
    // El de una cuota intacta se queda: esa sí se pagó por ese importe.
    expect(nuevo.periodos[3].movimientoTesoreriaId).toBe('mov-7');
  });

  // Un periodo que siguiera diciendo «prorrateado» con una cuota entera
  // afirmaría de sí mismo algo que sus propias cifras desmienten.
  it('lo rehecho suelta las marcas del arranque', () => {
    const original = plan();
    original.periodos[0].esProrrateado = true;
    original.periodos[0].diasDevengo = 18;
    original.periodos[1].esSoloIntereses = true;

    const nuevo = recalcularDesde(original, { desde: '2024-01-01', tinAnual: 5.5, base: '30/360' });

    expect(nuevo.periodos[0].esProrrateado).toBeUndefined();
    expect(nuevo.periodos[0].diasDevengo).toBeUndefined();
    expect(nuevo.periodos[1].esSoloIntereses).toBeUndefined();
  });
});

// Inventar un cuadro es peor que dejar el que había: de él sale la cuota que se
// enseña y la previsión de tesorería de todos los meses que quedan.
describe('cuando no hay nada que recalcular', () => {
  it('una revisión posterior a la última cuota deja el plan igual', () => {
    const original = plan();
    expect(recalcularDesde(original, { desde: '2030-01-01', tinAnual: 9, base: '30/360' })).toBe(original);
  });

  it('un plan vacío se devuelve tal cual', () => {
    const vacio = plan({ periodos: [] });
    expect(recalcularDesde(vacio, { desde: '2025-09-28', tinAnual: 9, base: '30/360' })).toBe(vacio);
  });

  it.each([NaN, Infinity, -1])('un tipo de %s no toca nada', (tinAnual) => {
    const original = plan();
    expect(recalcularDesde(original, { desde: '2025-09-28', tinAnual, base: '30/360' })).toBe(original);
  });

  // El corte se decide comparando CADENAS · un «2025/09/28» ordena distinto que
  // un «2025-09-28», y con diez caracteres los dos pasarían un filtro de
  // longitud. El tramo rehecho empezaría donde no toca.
  it.each(['', '2025/09/28', '28-09-2025', '2025-09-28T00:00:00Z', 'mañana'])(
    '«%s» no es una fecha de corte',
    (desde) => {
      const original = plan();
      expect(recalcularDesde(original, { desde, tinAnual: 5.5 })).toBe(original);
    }
  );

  // Una revisión anterior a la primera cuota SÍ recalcula: es un cuadro entero
  // al tipo nuevo, que es lo correcto cuando nada se ha pagado aún.
  it('una revisión anterior a todo recalcula el cuadro entero', () => {
    const original = plan();
    const nuevo = recalcularDesde(original, { desde: '2024-01-01', tinAnual: 9, base: '30/360' });

    expect(nuevo.periodos[0].cuota).not.toBe(original.periodos[0].cuota);
    expect(nuevo.periodos[nuevo.periodos.length - 1].principalFinal).toBe(0);
  });
});

// Con un tipo disparatado el interés puede comerse la cuota · no se amortiza en
// negativo, que dejaría un préstamo creciendo solo.
describe('un tipo que se come la cuota', () => {
  it('no amortiza en negativo', () => {
    const nuevo = recalcularDesde(plan(), { desde: '2025-09-28', tinAnual: 200, base: '30/360' });

    expect(nuevo.periodos.every((p) => p.amortizacion >= 0)).toBe(true);
  });
});
