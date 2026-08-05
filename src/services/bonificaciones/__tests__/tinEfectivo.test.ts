// Cuánto rebajan las bonificaciones · VOCABULARIO §6 ter.
//
// Esto decide la cuota que se enseña de una hipoteca, así que lo que vigilan
// estos tests son las dos formas de equivocarse que ya estaban en el código:
// leer los puntos en otra unidad, y contar como aplicada una que el banco ya
// retiró (o no contar una que sí está aplicada).

import {
  estaAplicada,
  reduccionPorBonificaciones,
  tinConBonificaciones,
  tinSiRevisaranHoy,
} from '../tinEfectivo';
import type { Cumplimiento } from '../cumplimiento';
import type { Bonificacion } from '../../../types/prestamos';

const bonif = (over: Partial<Bonificacion> = {}): Bonificacion => ({
  id: 'b1',
  tipo: 'NOMINA',
  nombre: 'Nómina',
  reduccionPuntosPorcentuales: 0.3,
  impacto: { puntos: -0.3 },
  lookbackMeses: 6,
  regla: { tipo: 'NOMINA', minimoMensual: 1200 },
  estado: 'SELECCIONADO',
  ...over,
});

describe('cuánto rebajan', () => {
  // El asistente escribe 0.30 para «−0,30 p.p.». La pantalla lo multiplicaba
  // por cien: esa bonificación se habría comido TREINTA puntos de TIN.
  it('los puntos se leen en puntos, no en fracción', () => {
    expect(reduccionPorBonificaciones([bonif()])).toBe(0.3);
  });

  it('se suman todas las aplicadas', () => {
    const suma = reduccionPorBonificaciones([
      bonif(),
      bonif({ id: 'b2', reduccionPuntosPorcentuales: 0.2 }),
      bonif({ id: 'b3', reduccionPuntosPorcentuales: 0.1 }),
    ]);

    expect(suma).toBe(0.6);
  });

  it('sin bonificaciones no rebajan nada', () => {
    expect(reduccionPorBonificaciones(undefined)).toBe(0);
    expect(reduccionPorBonificaciones([])).toBe(0);
  });

  // `impacto.puntos` va firmado en negativo · restar un negativo SUBIRÍA el TIN.
  it('un impacto negativo rebaja, no encarece', () => {
    const sinCampo = bonif({
      reduccionPuntosPorcentuales: 0 as unknown as number,
      impacto: { puntos: -0.25 },
    });

    expect(reduccionPorBonificaciones([sinCampo])).toBe(0.25);
  });
});

describe('cuáles están aplicadas', () => {
  // La pregunta es «¿te la aplica el banco?», no «¿la estás cumpliendo?».
  // Una contratada se aplica desde la firma; lo que cumplas ahora decide la
  // revisión que viene, no el recibo de este mes.
  it('lo contratado en el alta cuenta · antes no contaba ninguna', () => {
    expect(estaAplicada({ estado: 'SELECCIONADO' })).toBe(true);
    expect(reduccionPorBonificaciones([bonif({ estado: 'SELECCIONADO' })])).toBe(0.3);
  });

  it('la gracia, el cumplimiento y la espera también', () => {
    for (const estado of ['ACTIVO_POR_GRACIA', 'ACTIVO_POR_CUMPLIMIENTO', 'CUMPLIDA', 'PENDIENTE'] as const) {
      expect(estaAplicada({ estado })).toBe(true);
    }
  });

  // Todavía no la has perdido · el recibo de este mes sigue llevándola.
  it('en riesgo se sigue pagando con ella', () => {
    expect(estaAplicada({ estado: 'EN_RIESGO' })).toBe(true);
  });

  it('lo que nunca se contrató y lo que el banco ya quitó, no', () => {
    expect(estaAplicada({ estado: 'INACTIVO' })).toBe(false);
    expect(estaAplicada({ estado: 'PERDIDA' })).toBe(false);
    expect(reduccionPorBonificaciones([bonif({ estado: 'PERDIDA' })])).toBe(0);
  });
});

describe('el tope del préstamo', () => {
  const tres = [bonif(), bonif({ id: 'b2' }), bonif({ id: 'b3' })]; // 0,90 p.p.

  // Documentado en el tipo como fracción · `0.006` son 0,60 puntos.
  it('el máximo en fracción acota a sus puntos', () => {
    expect(reduccionPorBonificaciones(tres, { maximoBonificacionPorcentaje: 0.006 })).toBe(0.6);
  });

  // Documentado ya en puntos · «-1,00 p.p.». Tratarlo como el otro lo habría
  // dividido por cien y dejado el tope en un punto de nada.
  it('el tope en puntos se lee en puntos, y su signo da igual', () => {
    expect(reduccionPorBonificaciones(tres, { topeBonificacionesTotal: -0.5 })).toBe(0.5);
    expect(reduccionPorBonificaciones(tres, { topeBonificacionesTotal: 0.5 })).toBe(0.5);
  });

  it('un tope por encima de lo que rebajan no recorta nada', () => {
    expect(reduccionPorBonificaciones(tres, { topeBonificacionesTotal: -2 })).toBe(0.9);
  });

  it('sin tope dicho no se inventa uno', () => {
    expect(reduccionPorBonificaciones(tres)).toBe(0.9);
  });
});

describe('el TIN que se paga', () => {
  it('es el base menos lo que rebajan', () => {
    expect(tinConBonificaciones(3, [bonif()])).toBe(2.7);
  });

  // Sumar decimales deja 0.6000000000000001, y ese TIN acaba en una cuota.
  it('los decimales no se van en coma flotante', () => {
    expect(tinConBonificaciones(3, [bonif(), bonif({ id: 'b2', reduccionPuntosPorcentuales: 0.2 })]))
      .toBe(2.5);
  });

  // Un banco no te paga a ti por deberle dinero.
  it('nunca baja de cero', () => {
    expect(tinConBonificaciones(0.2, [bonif()])).toBe(0);
  });

  it('sin bonificaciones el TIN es el base', () => {
    expect(tinConBonificaciones(3.25, [])).toBe(3.25);
  });
});

// Aquí el veredicto de §6 ter deja de ser informativo: dice a qué cuota vas.
describe('el TIN si revisaran hoy', () => {
  const veredicto = (id: string, v: Cumplimiento['veredicto']): Cumplimiento => ({
    bonificacionId: id,
    nombre: id,
    veredicto: v,
  });

  it('sube por lo que no cumples y hoy te aplican', () => {
    const bs = [bonif(), bonif({ id: 'b2', reduccionPuntosPorcentuales: 0.2 })];
    // Hoy: 3 − 0,50 = 2,50. Perdiendo b1: 3 − 0,20 = 2,80.
    expect(tinSiRevisaranHoy(3, bs, [veredicto('b1', 'no_cumple'), veredicto('b2', 'cumple')]))
      .toBe(2.8);
  });

  // Recalcular entero, no sumar los puntos perdidos al TIN de hoy: con tope, el
  // de hoy ya viene acotado y las que quedan pueden seguir llegando al tope.
  // Sumando se habría enseñado una subida que no va a ocurrir.
  it('con tope, perder una puede no subir el tipo nada', () => {
    const tres = [bonif(), bonif({ id: 'b2' }), bonif({ id: 'b3' })]; // 0,90 p.p.
    const topes = { topeBonificacionesTotal: -0.6 };

    // Hoy paga 3 − 0,60 (capado). Perdiendo una quedan 0,60, que sigue capado.
    expect(tinConBonificaciones(3, tres, topes)).toBe(2.4);
    expect(tinSiRevisaranHoy(3, tres, [veredicto('b1', 'no_cumple')], topes)).toBe(2.4);
  });

  // La misma tercera respuesta de §6 ter · dar por perdido lo que nadie puede
  // comprobar pondría en pantalla un sobrecoste que quizá no existe.
  it('lo que no se puede comprobar NO se da por perdido', () => {
    expect(tinSiRevisaranHoy(3, [bonif()], [veredicto('b1', 'no_verificable')])).toBe(2.7);
  });

  // Ya la perdiste · ese golpe está en la cuota de hoy, no por venir.
  it('lo que el banco ya quitó no se cuenta dos veces', () => {
    const perdida = bonif({ estado: 'PERDIDA' });

    expect(tinSiRevisaranHoy(3, [perdida], [veredicto('b1', 'no_cumple')])).toBe(3);
  });

  it('cumpliéndolo todo se sigue pagando lo mismo', () => {
    expect(tinSiRevisaranHoy(3, [bonif()], [veredicto('b1', 'cumple')])).toBe(2.7);
    expect(tinSiRevisaranHoy(3, [bonif()], [])).toBe(2.7);
  });
});

describe('un estado que no está en la tabla', () => {
  // Las dos direcciones se equivocan, pero no cuestan lo mismo: darla por
  // aplicada enseña una cuota MÁS BAJA de la que se paga, y sobre esa cifra se
  // hacen cuentas.
  it('se lee como no aplicada · el error barato', () => {
    const raro = bonif({ estado: 'LO_QUE_SEA' as unknown as Bonificacion['estado'] });

    expect(estaAplicada(raro)).toBe(false);
    expect(tinConBonificaciones(3, [raro])).toBe(3);
  });
});
