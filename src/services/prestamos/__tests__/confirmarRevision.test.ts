// Confirmar o rectificar una revisión · VOCABULARIO §6 ter · ter.
//
// Lo que vigila esto es que confirmar haga las tres cosas y ninguna más: dejar
// los estados que dijo el banco, recalcular el cuadro DESDE la revisión —no
// desde el origen— y dar por atendida esa revisión.

import { confirmarRevision } from '../confirmarRevision';
import { prestamosService } from '../../prestamosService';
import type { Prestamo, PlanPagos } from '../../../types/prestamos';

jest.mock('../../prestamosService', () => ({
  prestamosService: {
    getPrestamoById: jest.fn(),
    getPaymentPlan: jest.fn(),
    updatePrestamo: jest.fn(),
    savePaymentPlan: jest.fn(),
  },
}));

const servicio = prestamosService as jest.Mocked<typeof prestamosService>;

const bonif = (id: string, puntos: number, estado: Prestamo['bonificaciones'] extends (infer B)[] ? B extends { estado: infer E } ? E : never : never) => ({
  id,
  tipo: 'NOMINA' as const,
  nombre: id,
  reduccionPuntosPorcentuales: puntos,
  impacto: { puntos: -puntos },
  lookbackMeses: 6,
  regla: { tipo: 'NOMINA' as const, minimoMensual: 1200 },
  estado,
});

const prestamo = (): Prestamo =>
  ({
    id: 'p1',
    tipo: 'FIJO',
    tipoNominalAnualFijo: 4.13,
    fechaFirma: '2021-06-15',
    principalInicial: 50000,
    plazoMesesTotal: 24,
    bonificaciones: [
      bonif('nomina', 0.5, 'ACTIVO_POR_CUMPLIMIENTO'),
      bonif('tarjeta', 0.05, 'ACTIVO_POR_CUMPLIMIENTO'),
    ],
  }) as unknown as Prestamo;

const plan = (): PlanPagos => ({
  prestamoId: 'p1',
  fechaGeneracion: '2025-01-01T00:00:00.000Z',
  periodos: [
    { periodo: 1, devengoDesde: '2026-01-01', devengoHasta: '2026-01-31', fechaCargo: '2026-01-31', cuota: 300, interes: 100, amortizacion: 200, principalFinal: 40000, pagado: true },
    { periodo: 2, devengoDesde: '2026-02-01', devengoHasta: '2026-02-28', fechaCargo: '2026-02-28', cuota: 300, interes: 99, amortizacion: 201, principalFinal: 39799, pagado: true },
    { periodo: 3, devengoDesde: '2026-03-01', devengoHasta: '2026-03-31', fechaCargo: '2026-03-31', cuota: 300, interes: 98, amortizacion: 202, principalFinal: 39597, pagado: false },
    { periodo: 4, devengoDesde: '2026-04-01', devengoHasta: '2026-04-30', fechaCargo: '2026-04-30', cuota: 300, interes: 97, amortizacion: 39597, principalFinal: 0, pagado: false },
  ],
  resumen: { totalIntereses: 394, totalCuotas: 4, fechaFinalizacion: '2026-04-30' },
});

beforeEach(() => {
  jest.clearAllMocks();
  servicio.getPrestamoById.mockResolvedValue(prestamo());
  servicio.getPaymentPlan.mockResolvedValue(plan());
  servicio.updatePrestamo.mockResolvedValue(prestamo());
  servicio.savePaymentPlan.mockResolvedValue(undefined);
});

const revision = { fecha: '2026-03', aplicaDesde: '2026-03-01' };

describe('lo que el banco decidió pasa a ser el estado', () => {
  it('una perdida se marca perdida', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.bonificaciones?.find((b) => b.id === 'nomina')?.estado).toBe('PERDIDA');
  });

  // No decir nada de una bonificación no es decir que se perdió.
  it('las que no se mencionan se quedan como estaban', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.bonificaciones?.find((b) => b.id === 'tarjeta')?.estado)
      .toBe('ACTIVO_POR_CUMPLIMIENTO');
  });

  // §6 ter · va en los dos sentidos. Empezar a cumplir una que no tenías baja
  // la cuota, y eso se confirma igual que perderla.
  it('también se puede ganar una', async () => {
    servicio.getPrestamoById.mockResolvedValue({
      ...prestamo(),
      bonificaciones: [bonif('nomina', 0.5, 'PERDIDA')],
    } as Prestamo);

    const r = await confirmarRevision('p1', { ...revision, decision: { nomina: 'CUMPLIDA' } });

    expect(r!.tinDespues).toBeLessThan(r!.tinAntes);
  });

  it('la revisión queda dada por vista', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.ultimaRevisionBonificacionesConfirmada).toBe('2026-03');
  });
});

describe('el cuadro se rehace desde la revisión', () => {
  it('las cuotas anteriores no se tocan', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const [, guardado] = servicio.savePaymentPlan.mock.calls[0];
    expect(guardado.periodos.slice(0, 2)).toEqual(plan().periodos.slice(0, 2));
  });

  it('las de después sí', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const [, guardado] = servicio.savePaymentPlan.mock.calls[0];
    expect(guardado.periodos[2].cuota).not.toBe(plan().periodos[2].cuota);
  });

  // El plan se lee ANTES de guardar el préstamo · `updatePrestamo` regenera uno
  // desde el origen, y ese es justo el que no vale.
  it('se parte del cuadro de antes, no del que regenera el guardado', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const ordenLectura = servicio.getPaymentPlan.mock.invocationCallOrder[0];
    const ordenGuardado = servicio.updatePrestamo.mock.invocationCallOrder[0];
    expect(ordenLectura).toBeLessThan(ordenGuardado);
  });

  // Y el guardado NO regenera · dejarle hacerlo y pisarlo después dejaba el
  // cuadro incorrecto guardado entre las dos escrituras, para siempre si la app
  // se cerraba en medio.
  it('el guardado no llega a escribir un cuadro desde el origen', async () => {
    await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    const [, , opciones] = servicio.updatePrestamo.mock.calls[0];
    expect(opciones).toEqual({ conservarPlan: true });
  });

  // Cuando no hay nada que rehacer, el guardado se comporta como siempre.
  it('sin cambio de tipo, el guardado conserva su comportamiento', async () => {
    await confirmarRevision('p1', { ...revision, decision: {} });

    const [, , opciones] = servicio.updatePrestamo.mock.calls[0];
    expect(opciones).toEqual({ conservarPlan: false });
  });

  // Perder una bonificación con el tope ya alcanzado por otras no cambia lo que
  // pagas · rehacer el cuadro sería tocar un cuadro que no ha cambiado.
  it('si el tipo no se mueve, no se rehace nada', async () => {
    const r = await confirmarRevision('p1', { ...revision, decision: {} });

    expect(r!.tinAntes).toBe(r!.tinDespues);
    expect(r!.cuadroRehecho).toBe(false);
    expect(servicio.savePaymentPlan).not.toHaveBeenCalled();
  });
});

describe('lo que no se puede confirmar', () => {
  it('un préstamo que no existe no revienta ni guarda nada', async () => {
    servicio.getPrestamoById.mockResolvedValue(null);

    expect(await confirmarRevision('nope', { ...revision, decision: {} })).toBeNull();
    expect(servicio.updatePrestamo).not.toHaveBeenCalled();
  });

  // Sin cuadro guardado se aplican los estados igual · el cuadro lo generará
  // quien lo pida, ya con el tipo nuevo.
  it('sin cuadro, los estados se aplican de todas formas', async () => {
    servicio.getPaymentPlan.mockResolvedValue(null);

    const r = await confirmarRevision('p1', { ...revision, decision: { nomina: 'PERDIDA' } });

    expect(servicio.updatePrestamo).toHaveBeenCalled();
    expect(r!.cuadroRehecho).toBe(false);
  });
});

// La primera revisión de un mixto que solo bonifica en su tramo variable trae
// DOS cosas a la vez: el índice y las bonificaciones. Preguntando el antes y el
// después al mismo tramo —el del arranque—, esa revisión no movía nada.
describe('la revisión que estrena el tramo variable', () => {
  const unicaja = (): Prestamo =>
    ({
      ...prestamo(),
      tipo: 'MIXTO',
      tipoNominalAnualFijo: undefined,
      tipoNominalAnualMixtoFijo: 2.6,
      tramoFijoMeses: 36,
      plazoMesesTotal: 240,
      valorIndiceActual: 2.1,
      diferencial: 1.75,
      bonificacionesDesde: 'TRAMO_VARIABLE',
      fechaFirma: '2023-08-25',
    }) as unknown as Prestamo;

  const alCambiarDeTramo = { fecha: '2026-08', aplicaDesde: '2026-08-25' };

  it('el antes es el tipo fijo entero y el después ya viene bonificado', async () => {
    servicio.getPrestamoById.mockResolvedValue(unicaja());

    const r = await confirmarRevision('p1', { ...alCambiarDeTramo, decision: {} });

    // 2,600 % sin rebajar · durante el tramo fijo no bonifica nada.
    expect(r!.tinAntes).toBe(2.6);
    // Euríbor 2,10 + 1,75 diferencial − 0,55 de bonificaciones.
    expect(r!.tinDespues).toBe(3.3);
    expect(r!.cuadroRehecho).toBe(true);
  });

  // Y la carta de esa revisión trae el Euríbor que aplicó · las dos cosas
  // entran por la misma puerta, que es como llegan.
  it('el índice de la carta manda sobre la estimación', async () => {
    servicio.getPrestamoById.mockResolvedValue(unicaja());

    const r = await confirmarRevision('p1', {
      ...alCambiarDeTramo,
      decision: {},
      valorIndice: 2.45,
    });

    // 2,45 de la carta + 1,750 de diferencial − 0,55 de bonificaciones.
    expect(r!.tinDespues).toBe(3.65);
  });
});

// La carta trae DOS cosas · qué pasó con las bonificaciones y a cuánto salió el
// índice. Antes solo entraba lo primero, y el Euríbor de esa misma carta había
// que apuntarlo aparte en el asistente: mientras no se hiciera, el cuadro
// seguía proyectando con `valorIndiceActual`, que es el índice de HOY.
describe('el índice que traía la carta', () => {
  const variable = (over: Partial<Prestamo> = {}): Prestamo =>
    ({
      ...prestamo(),
      tipo: 'VARIABLE',
      tipoNominalAnualFijo: undefined,
      valorIndiceActual: 2.1,
      diferencial: 1,
      bonificaciones: [],
      ...over,
    }) as unknown as Prestamo;

  it('queda apuntado como hecho y decide el tipo nuevo', async () => {
    servicio.getPrestamoById.mockResolvedValue(variable());

    const r = await confirmarRevision('p1', { ...revision, decision: {}, valorIndice: 3.4 });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.revisionesDeTipo).toEqual([{ desde: '2026-03-01', valorIndice: 3.4 }]);
    // 3,40 de índice + 1,00 de diferencial · no el 2,10 de hoy.
    expect(r!.tinDespues).toBe(4.4);
    expect(r!.tinAntes).toBe(3.1);
  });

  // Dos revisiones el mismo día son la misma revisión rectificada · dejar las
  // dos haría que el cuadro dependiera del orden en que se guardaron.
  it('rectificar una ya apuntada la sustituye, no la duplica', async () => {
    servicio.getPrestamoById.mockResolvedValue(
      variable({ revisionesDeTipo: [{ desde: '2026-03-01', valorIndice: 9 }] })
    );

    await confirmarRevision('p1', { ...revision, decision: {}, valorIndice: 3.4 });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.revisionesDeTipo).toEqual([{ desde: '2026-03-01', valorIndice: 3.4 }]);
  });

  it('las de otros días se conservan y quedan ordenadas', async () => {
    servicio.getPrestamoById.mockResolvedValue(
      variable({ revisionesDeTipo: [{ desde: '2025-03-01', valorIndice: 2.5 }] })
    );

    await confirmarRevision('p1', { ...revision, decision: {}, valorIndice: 3.4 });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.revisionesDeTipo).toEqual([
      { desde: '2025-03-01', valorIndice: 2.5 },
      { desde: '2026-03-01', valorIndice: 3.4 },
    ]);
  });

  // Lo ya guardado se sanea al pasar · una entrada rota reventaría el orden al
  // confirmar, y `tramosDeTipo` la descarta igualmente al leer.
  it('las entradas rotas que hubiera guardadas no revientan ni se propagan', async () => {
    servicio.getPrestamoById.mockResolvedValue(
      variable({
        revisionesDeTipo: [
          { desde: undefined, valorIndice: 2 },
          { desde: '2025-03-01', valorIndice: NaN },
          { desde: '2025-06-01T00:00:00.000Z', valorIndice: 2.5 },
        ] as never,
      })
    );

    await confirmarRevision('p1', { ...revision, decision: {}, valorIndice: 3.4 });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.revisionesDeTipo).toEqual([
      { desde: '2025-06-01', valorIndice: 2.5 },
      { desde: '2026-03-01', valorIndice: 3.4 },
    ]);
  });

  // Una carta que no lo dice es una respuesta legítima · se sigue proyectando
  // con el último tipo conocido, marcado como estimación.
  it('sin índice no se apunta nada', async () => {
    servicio.getPrestamoById.mockResolvedValue(variable());

    await confirmarRevision('p1', { ...revision, decision: {} });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.revisionesDeTipo).toBeUndefined();
  });

  // En un préstamo a tipo fijo el índice no pinta nada · guardarlo sería dejar
  // un dato que no lee nadie.
  it('en un tramo que no lo lleva no se apunta', async () => {
    const r = await confirmarRevision('p1', { ...revision, decision: {}, valorIndice: 3.4 });

    const [, updates] = servicio.updatePrestamo.mock.calls[0];
    expect(updates.revisionesDeTipo).toBeUndefined();
    expect(r!.tinDespues).toBe(r!.tinAntes);
  });

  // `updatePrestamo` regenera el cuadro cuando cambian las revisiones, y lo hace
  // DESDE EL ORIGEN. Sin `conservarPlan` reescribiría intereses ya cobrados.
  it('apuntarlo obliga a conservar el plan aunque el tipo salga igual', async () => {
    servicio.getPrestamoById.mockResolvedValue(variable());

    // 2,10 apuntado = el mismo que se estimaba · el tipo no se mueve.
    const r = await confirmarRevision('p1', { ...revision, decision: {}, valorIndice: 2.1 });

    expect(r!.tinDespues).toBe(r!.tinAntes);
    const [, , opciones] = servicio.updatePrestamo.mock.calls[0];
    expect(opciones).toEqual({ conservarPlan: true });
  });
});
