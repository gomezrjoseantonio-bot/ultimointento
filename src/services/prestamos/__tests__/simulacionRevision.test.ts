// Qué traería la próxima revisión con el índice de hoy.
//
// El reparto de papeles que vigilan estos casos, que es la pregunta de fondo
// *(Jose · 8 ago 2026)*:
//
//   · una revisión CONFIRMADA fija el índice y corre hasta la siguiente, y el
//     euríbor de «Actualizar valores» no la mueve ni un céntimo;
//   · ese euríbor sirve para lo otro — ver por dónde va lo que viene—, y eso
//     vive FUERA del cuadro.
//
// El préstamo es la mixta de Unicaja: 36 meses al 2,600 % y después euríbor +
// 1,750, revisando cada doce meses.

import { simulacionRevision } from '../simulacionRevision';
import { cuadroDe, getCuota } from '../lecturas';
import type { Prestamo } from '../../../types/prestamos';

const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'unicaja',
    nombre: 'Hipoteca Unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 4.149,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    periodoRevisionBonificacionMeses: 12,
    ...over,
  }) as unknown as Prestamo;

/** Ya en el tramo variable, con la revisión de 2026 confirmada al 2,000 %. */
const yaRevisada = (over: Partial<Prestamo> = {}): Prestamo =>
  unicaja({
    revisionesDeTipo: [{ desde: '2026-08-25', valorIndice: 2.0 }],
    ...over,
  } as Partial<Prestamo>);

describe('lo confirmado manda · valoraciones no lo toca', () => {
  const hoy = '2027-01-15';

  // El candado de fondo: la cuota que se paga sale de la revisión confirmada,
  // no del euríbor de hoy. Se comprueba contra el préstamo que SÍ tendría ese
  // índice — si fuesen iguales, este fichero entero no probaría nada.
  it('la cuota de hoy es la de la revisión confirmada, no la del índice de hoy', () => {
    const conLoConfirmado = getCuota(cuadroDe(yaRevisada()), hoy);
    // El mismo préstamo si el 5 % de «hoy» se hubiera aplicado en esa revisión.
    const siValoracionesMandara = getCuota(
      cuadroDe(yaRevisada({ revisionesDeTipo: [{ desde: '2026-08-25', valorIndice: 5 }] } as Partial<Prestamo>)),
      hoy
    );

    expect(conLoConfirmado).toBeGreaterThan(0);
    expect(conLoConfirmado).toBeLessThan(siValoracionesMandara);
  });

  it('y simular no cambia el cuadro de verdad', () => {
    const antes = getCuota(cuadroDe(yaRevisada()), hoy);
    simulacionRevision(yaRevisada(), hoy, 5);

    expect(getCuota(cuadroDe(yaRevisada()), hoy)).toBe(antes);
  });
});

describe('el índice de hoy dice por dónde irá la próxima', () => {
  const hoy = '2027-01-15';

  it('con el euríbor más alto, la cuota que viene sube', () => {
    const s = simulacionRevision(yaRevisada(), hoy, 5)!;

    expect(s.indice).toBe(5);
    expect(s.cuotaDespues).toBeGreaterThan(s.cuotaHoy);
    // 5,000 + 1,750 = 6,750 %.
    expect(s.tinDespues).toBeCloseTo(6.75, 3);
  });

  it('y con el euríbor más bajo, baja', () => {
    const s = simulacionRevision(yaRevisada(), hoy, 0.5)!;

    expect(s.cuotaDespues).toBeLessThan(s.cuotaHoy);
  });

  it('la cuota de hoy que enseña es la de verdad', () => {
    const s = simulacionRevision(yaRevisada(), hoy, 5)!;

    expect(s.cuotaHoy).toBe(getCuota(cuadroDe(yaRevisada()), hoy));
  });
});

describe('cuándo NO hay nada que decir', () => {
  const hoy = '2027-01-15';

  it('un préstamo a tipo fijo no revisa', () => {
    const fijo = unicaja({ tipo: 'FIJO', tipoNominalAnualFijo: 3 } as Partial<Prestamo>);

    expect(simulacionRevision(fijo, hoy, 5)).toBeNull();
  });

  // Sin índice apuntado en «Actualizar valores» no hay con qué simular · y un
  // índice inventado se lee igual que uno real.
  it('sin índice en valoraciones, no se simula', () => {
    expect(simulacionRevision(yaRevisada(), hoy, null)).toBeNull();
    expect(simulacionRevision(yaRevisada(), hoy, undefined)).toBeNull();
  });

  // Sin saber cada cuánto mira el banco no hay fecha que poner, y una inventada
  // mandaría a alguien a mirar un día que nadie le ha dicho.
  it('sin saber cada cuánto revisa el banco, tampoco', () => {
    const sinCalendario = yaRevisada({
      periodoRevisionBonificacionMeses: undefined,
    } as Partial<Prestamo>);

    expect(simulacionRevision(sinCalendario, hoy, 5)).toBeNull();
  });

  // Un mixto en su tramo fijo no revisa el índice todavía · lo que le viene es
  // el fin del tramo, y eso ya lo anuncia el cuadro con su propia cifra.
  it('un mixto todavía en su tramo fijo no simula el índice', () => {
    expect(simulacionRevision(unicaja(), '2024-06-01', 5)).toBeNull();
  });

  // Un aviso que dice «tu cuota pasará de 518 a 518» es ruido, y el ruido hace
  // que se dejen de leer los que sí importan.
  it('y si no mueve la cuota, no se avisa', () => {
    // El mismo índice que ya está confirmado · no cambia nada.
    expect(simulacionRevision(yaRevisada(), hoy, 2.0)).toBeNull();
  });
});

// ── La regla, dicha entera ──────────────────────────────────────────────────
//
// «La actualización del valor del euríbor durante ese tiempo sirve de guía
// prevista de la cuota pero **no debe cambiar ningún cuadro**, porque no va a
// cambiar nada realmente hasta la siguiente revisión» *(Jose · 8 ago 2026)*.
//
// Vale también SIN ninguna revisión apuntada: el cuadro se calculó con el
// índice del alta y se queda ahí hasta que una revisión lo convierta en hecho.
// Hubo un momento en que la ficha regeneraba el cuadro con el euríbor de
// «Actualizar valores», y entonces la guía no tenía nada que decir —comparaba
// ese índice consigo mismo— mientras el cuadro se movía solo.
describe('el euríbor de hoy habla en la guía y no toca el cuadro', () => {
  const hoy = '2027-01-15';
  // La mixta ya en su tramo variable, sin ninguna revisión confirmada · el
  // cuadro corre con el 4,149 del alta.
  const sinRevisiones = () => unicaja();

  it('el cuadro sigue en el índice del alta', () => {
    const antes = getCuota(cuadroDe(sinRevisiones()), hoy);

    simulacionRevision(sinRevisiones(), hoy, 1);
    simulacionRevision(sinRevisiones(), hoy, 6);

    expect(getCuota(cuadroDe(sinRevisiones()), hoy)).toBe(antes);
  });

  it('y la guía sí dice adónde iría con el de hoy', () => {
    const s = simulacionRevision(sinRevisiones(), hoy, 1)!;

    expect(s.indice).toBe(1);
    // 4,149 del alta → 1,000 de hoy · la cuota que viene baja.
    expect(s.cuotaDespues).toBeLessThan(s.cuotaHoy);
    expect(s.cuotaHoy).toBe(getCuota(cuadroDe(sinRevisiones()), hoy));
  });
});
