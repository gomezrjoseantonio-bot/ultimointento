// La quinta forma de comprobar · §6 ter.
//
// «Hay una aportación a un producto · planes, fondos, unit-linked» era la única
// de las cinco que nunca se montó: `SIN_FUENTE` decía «la aportación al plan
// todavía no se sigue en tesorería» y toda condición de plan salía sin
// comprobar. Y era verdad a medias — no se sigue en tesorería porque no es un
// movimiento, se sigue en el store de aportaciones.
//
// Lo que estos casos vigilan sobre todo es la GESTORA: el anexo no pide un plan
// cualquiera, pide uno suyo.

import { aportacionesPorPlan, deLaEntidad, totalAportado } from '../aportacionesAPlanes';
import { verificarBonificaciones } from '../verificarBonificaciones';
import type { PlanPensiones, AportacionPlan } from '../../../types/planesPensiones';
import type { Bonificacion, ReglaBonificacion } from '../../../types/prestamos';

const plan = (over: Partial<PlanPensiones> = {}): PlanPensiones =>
  ({
    id: 'p1',
    nombre: 'Plan Unicaja Renta Fija',
    titular: 'yo',
    personalDataId: 1,
    gestoraActual: 'Unicaja Banco',
    fechaContratacion: '2020-01-01',
    ...over,
  }) as unknown as PlanPensiones;

const aportacion = (over: Partial<AportacionPlan> = {}): AportacionPlan =>
  ({
    id: 'a1',
    planId: 'p1',
    fecha: '2026-03-15',
    ejercicioFiscal: 2026,
    importeTitular: 1200,
    importeEmpresa: 0,
    ...over,
  }) as unknown as AportacionPlan;

const bonif = (regla: ReglaBonificacion): Bonificacion =>
  ({
    id: 'b1',
    tipo: 'PENSIONES',
    nombre: 'Bloque Plan de Pensiones',
    reduccionPuntosPorcentuales: 0.25,
    impacto: { puntos: 0.25 },
    estado: 'SELECCIONADO',
    lookbackMeses: 12,
    regla,
  }) as unknown as Bonificacion;

const pruebas = (
  planes: PlanPensiones[],
  aportaciones: AportacionPlan[],
  entidad?: string
) => ({
  tarjetas: [],
  periodosDeTarjeta: [],
  cobrosDeNomina: [],
  recibosDomiciliados: [],
  aportacionesAPlanes: aportacionesPorPlan(planes, aportaciones, 2026),
  entidad,
});

describe('lo aportado en el ejercicio', () => {
  it('suma titular, empresa y cónyuge', () => {
    const [a] = aportacionesPorPlan(
      [plan()],
      [aportacion({ importeTitular: 1000, importeEmpresa: 200, importeConyuge: 300 })],
      2026
    );

    expect(a.importe).toBe(1500);
  });

  it('y solo las de ESE ejercicio', () => {
    const [a] = aportacionesPorPlan(
      [plan()],
      [aportacion(), aportacion({ id: 'a2', ejercicioFiscal: 2025, importeTitular: 5000 })],
      2026
    );

    expect(a.importe).toBe(1200);
  });

  // Tenerlo contratado y no haber aportado son dos cosas distintas, y hay
  // anexos que bonifican por lo primero.
  it('un plan sin aportaciones sale igual, con cero', () => {
    const [a] = aportacionesPorPlan([plan()], [], 2026);

    expect(a.planId).toBe('p1');
    expect(a.importe).toBe(0);
  });

  it('las de varios planes se suman', () => {
    const dos = aportacionesPorPlan(
      [plan(), plan({ id: 'p2', nombre: 'Otro' })],
      [aportacion(), aportacion({ id: 'a2', planId: 'p2', importeTitular: 800 })],
      2026
    );

    expect(totalAportado(dos)).toBe(2000);
  });
});

describe('el plan tiene que ser de ESE banco', () => {
  // El préstamo trae «Unicaja» de su FEIN y el plan lo escribió el usuario como
  // «Unicaja Banco, S.A.». Compararlos tal cual diría que no son la misma
  // entidad, y se perdería una bonificación que sí se cumple.
  it('reconoce la misma entidad escrita de tres maneras', () => {
    const lista = aportacionesPorPlan(
      [
        plan({ id: 'p1', gestoraActual: 'Unicaja Banco, S.A.' }),
        plan({ id: 'p2', gestoraActual: 'UNICAJA' }),
        plan({ id: 'p3', gestoraActual: 'unicaja banco' }),
      ],
      [],
      2026
    );

    expect(deLaEntidad(lista, 'Unicaja')).toHaveLength(3);
  });

  it('y no confunde un banco con otro', () => {
    const lista = aportacionesPorPlan([plan({ gestoraActual: 'Santander' })], [], 2026);

    expect(deLaEntidad(lista, 'Unicaja')).toHaveLength(0);
  });

  it('un plan sin gestora apuntada no cuenta para nadie', () => {
    const lista = aportacionesPorPlan([plan({ gestoraActual: '' })], [], 2026);

    expect(deLaEntidad(lista, 'Unicaja')).toHaveLength(0);
  });
});

describe('la condición de plan, contra la verificación', () => {
  const hoy = '2026-06-30';

  it('cumple quien aportó lo que pide el anexo, en un plan suyo', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'PLAN_PENSIONES', activo: true, aportacionAnual: 1000 })],
      pruebas([plan()], [aportacion()], 'Unicaja'),
      hoy
    );

    expect(c.veredicto).toBe('cumple');
    expect(c.medido).toBe(1200);
  });

  it('y no cumple quien se queda corto', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'PLAN_PENSIONES', activo: true, aportacionAnual: 3000 })],
      pruebas([plan()], [aportacion()], 'Unicaja'),
      hoy
    );

    expect(c.veredicto).toBe('no_cumple');
  });

  // Esto SÍ se sabe, y la respuesta es que no: aportar más a un plan de otro
  // banco no arregla nada, y decir «no se puede comprobar» mandaría a hacerlo.
  it('un plan en otro banco NO cumple · no es que no se sepa', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'PLAN_PENSIONES', activo: true, aportacionAnual: 1000 })],
      pruebas([plan({ gestoraActual: 'Santander' })], [aportacion()], 'Unicaja'),
      hoy
    );

    expect(c.veredicto).toBe('no_cumple');
    expect(c.motivo).toContain('Unicaja');
  });

  // Sin cifra pedida la condición es tenerlo contratado, y lo tiene.
  it('sin cifra, basta con tener un plan suyo', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'PLAN_PENSIONES', activo: true })],
      pruebas([plan()], [], 'Unicaja'),
      hoy
    );

    expect(c.veredicto).toBe('cumple');
  });

  // La tercera respuesta · sin saber de quién es el préstamo no se puede
  // responder, y eso no es un no.
  it('sin saber de qué banco es el préstamo, no se responde', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'PLAN_PENSIONES', activo: true, aportacionAnual: 1000 })],
      pruebas([plan()], [aportacion()]),
      hoy
    );

    expect(c.veredicto).toBe('no_verificable');
    expect(c.motivo).toContain('banco');
  });

  it('y sin planes dados de alta, tampoco', () => {
    const [c] = verificarBonificaciones(
      [bonif({ tipo: 'PLAN_PENSIONES', activo: true, aportacionAnual: 1000 })],
      {
        tarjetas: [],
        periodosDeTarjeta: [],
        cobrosDeNomina: [],
        recibosDomiciliados: [],
        entidad: 'Unicaja',
      },
      hoy
    );

    expect(c.veredicto).toBe('no_verificable');
  });
});
