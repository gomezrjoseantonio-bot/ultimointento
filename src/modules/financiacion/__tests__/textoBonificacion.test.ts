// Cómo se lee una bonificación verificada · VOCABULARIO §6 ter.
//
// Lo que vigila esto es que las tres respuestas se lean distintas. «No se puede
// comprobar» y «te faltan 1.000 €» piden cosas distintas de quien lo lee, y
// confundirlas manda a gastar para arreglar lo que no se arregla gastando.

import { textoDeCumplimiento, textoDeLoQueEstaEnJuego } from '../textoBonificacion';
import type { Cumplimiento } from '../../../services/bonificaciones/cumplimiento';

const c = (over: Partial<Cumplimiento> = {}): Cumplimiento => ({
  bonificacionId: 'b1',
  nombre: 'Uso tarjeta',
  veredicto: 'cumple',
  ventana: { desde: '2026-02-04', hasta: '2026-08-03' },
  medido: 3200,
  exigido: 3000,
  sinCobrar: 0,
  ...over,
});

describe('lo que dicen los movimientos', () => {
  it('cumplida enseña lo medido contra lo exigido', () => {
    expect(textoDeCumplimiento(c())).toBe('Cumplida · 3.200 € de 3.000 € desde el 4 feb');
  });

  // Lo primero que se quiere saber al no llegar es cuánto falta.
  it('sin llegar dice cuánto falta, no solo que falta', () => {
    expect(textoDeCumplimiento(c({ veredicto: 'no_cumple', medido: 2000 }))).toBe(
      'Te faltan 1.000 € · llevas 2.000 € de 3.000 € desde el 4 feb'
    );
  });

  // §3.5 · lo que el banco no ha cobrado no demuestra nada, pero el gasto ya
  // está hecho. Sumarlo mentiría; callarlo haría creer que falta por gastar lo
  // que ya se gastó.
  it('lo que aún no se ha cobrado va aparte y con esas palabras', () => {
    const t = textoDeCumplimiento(c({ veredicto: 'no_cumple', medido: 2000, sinCobrar: 800 }));

    expect(t).toContain('Te faltan 1.000 €');
    expect(t).toContain('800 € más gastados que el banco todavía no ha cobrado');
  });

  // Pasar la fecha por `Date` y volver a formatearla corre el día hacia atrás
  // en España, y CI corre en UTC, así que el fallo solo se vería en producción.
  it('el día no se corre al anterior', () => {
    expect(textoDeCumplimiento(c({ ventana: { desde: '2026-01-01', hasta: '2026-08-03' } })))
      .toContain('desde el 1 ene');
  });
});

describe('lo que no se ha podido mirar', () => {
  it('se dice que no se puede comprobar, y por qué', () => {
    expect(
      textoDeCumplimiento(
        c({ veredicto: 'no_verificable', motivo: 'no dice con qué tarjeta se cumple', medido: undefined })
      )
    ).toBe('No se puede comprobar · no dice con qué tarjeta se cumple');
  });

  // §3.6 · una tarjeta de fuera nunca bonifica. Es un "no" firme, no una duda,
  // y no lleva cifras porque no hay ninguna que perseguir.
  it('un no que no se arregla gastando no enseña cifras', () => {
    expect(
      textoDeCumplimiento(
        c({
          veredicto: 'no_cumple',
          motivo: '«Carrefour» es de fuera, y las de fuera nunca bonifican',
          medido: undefined,
          exigido: undefined,
        })
      )
    ).toBe('No cuenta · «Carrefour» es de fuera, y las de fuera nunca bonifican');
  });
});

// §6 ter · aquí el veredicto deja de ser informativo y dice a qué cuota vas.
describe('lo que está en juego', () => {
  it('con todo cumplido dice a qué tipo pagas', () => {
    expect(
      textoDeLoQueEstaEnJuego({ tinHoy: 2.4, tinSiRevisaran: 2.4, sobrecosteMensual: 0 })
    ).toBe('Pagas al 2,40 % · con tus bonificaciones aplicadas');
  });

  // La condición va DELANTE: lo que gastes este mes no cambia el recibo de este
  // mes, cambia lo que decida la próxima revisión. Enseñarlo como la cuota
  // actual sería enseñar una cuota que nadie te cobra.
  it('el riesgo se dice condicionado, no como cuota actual', () => {
    expect(
      textoDeLoQueEstaEnJuego({ tinHoy: 2.4, tinSiRevisaran: 2.7, sobrecosteMensual: 31.2 })
    ).toBe('Pagas al 2,40 %. Si la revisión fuera hoy pasarías al 2,70 % · 31,20 € más al mes');
  });

  it('el tipo lleva coma decimal, no punto', () => {
    expect(
      textoDeLoQueEstaEnJuego({ tinHoy: 3, tinSiRevisaran: 3, sobrecosteMensual: 0 })
    ).toContain('3,00 %');
  });

  // Sin fecha es una hipótesis que nadie puede agendar · con ella, una cita.
  it('con fecha de revisión se dice cuándo, no «si fuera hoy»', () => {
    const t = textoDeLoQueEstaEnJuego({
      tinHoy: 2.4,
      tinSiRevisaran: 2.7,
      sobrecosteMensual: 31.2,
      fechaRevision: '2026-03-10',
    });

    expect(t).toContain('En la revisión del 10 mar');
    expect(t).not.toContain('Si la revisión fuera hoy');
  });

  // Se puede ir a mejor · empezar a cumplir una que no tenías baja la cuota, y
  // eso es tan accionable como perderla. Con «más al mes» se leería al revés.
  it('lo que mejora se dice como menos, no como más', () => {
    const t = textoDeLoQueEstaEnJuego({
      tinHoy: 2.7,
      tinSiRevisaran: 2.4,
      sobrecosteMensual: -31.2,
      fechaRevision: '2026-03-10',
    });

    expect(t).toContain('pasarías al 2,40 %');
    expect(t).toContain('31,20 € menos al mes');
  });

  // El banco da mes y año —«Próxima revisión 08/2027»—, no un día. Ponerle uno
  // sería prometer una precisión que nadie ha dado.
  it('con solo mes y año se dice el mes, no un día inventado', () => {
    const t = textoDeLoQueEstaEnJuego({
      tinHoy: 2.4,
      tinSiRevisaran: 2.7,
      sobrecosteMensual: 31.2,
      fechaRevision: '2027-08',
    });

    expect(t).toContain('En la revisión de agosto de 2027');
  });

  // Durante el periodo inicial la cuota rebajada NO demuestra que cumplas.
  // Callarlo deja creer que ya está ganada.
  it('el periodo inicial se dice aunque todo esté en orden', () => {
    const t = textoDeLoQueEstaEnJuego({
      tinHoy: 2.4,
      tinSiRevisaran: 2.4,
      sobrecosteMensual: 0,
      fechaRevision: '2026-09-10',
      enGracia: true,
    });

    expect(t).toContain('aplicadas por el periodo inicial');
  });

  it('sin periodo inicial no se menciona', () => {
    expect(
      textoDeLoQueEstaEnJuego({ tinHoy: 2.4, tinSiRevisaran: 2.4, sobrecosteMensual: 0 })
    ).not.toContain('periodo inicial');
  });
});

// La nómina se mide MES A MES · «1.200 € al mes» no lo cumple un semestre con
// 7.200 € si un mes vino vacío y otro doble.
describe('lo que se mide mes a mes', () => {
  const nomina = (over: Partial<Cumplimiento> = {}): Cumplimiento =>
    c({ exigido: 1200, medido: 1300, mensual: { conMovimiento: 6, queLlegan: 6 }, ...over });

  it('cumplida dice de cuántos meses sale', () => {
    expect(textoDeCumplimiento(nomina())).toBe(
      'Cumplida · 6 de 6 meses con 1.200 € o más desde el 4 feb'
    );
  });

  // Lo que decide es el mes más flojo, no el total · por eso es lo que se
  // enseña. «Te faltan X» sería mentira: no se arregla sumando al total.
  it('sin cumplir enseña el mes más flojo', () => {
    expect(
      textoDeCumplimiento(nomina({ veredicto: 'no_cumple', medido: 900, mensual: { conMovimiento: 6, queLlegan: 5 } }))
    ).toBe('5 de 6 meses · el más flojo se quedó en 900 € de 1.200 €');
  });

  it('un solo mes se dice en singular', () => {
    expect(textoDeCumplimiento(nomina({ mensual: { conMovimiento: 1, queLlegan: 1 } })))
      .toContain('1 de 1 mes con');
  });
});

// Los recibos se CUENTAN, no se suman en euros · «3 €» donde el banco pide
// tres recibos no es un detalle de formato, es otra cosa.
describe('lo que se cuenta en recibos', () => {
  const recibos = (over: Partial<Cumplimiento> = {}): Cumplimiento =>
    c({
      unidad: 'recibos',
      exigido: 3,
      medido: 4,
      mensual: { conMovimiento: 6, queLlegan: 6 },
      ...over,
    });

  it('cumplida habla de recibos, no de euros', () => {
    expect(textoDeCumplimiento(recibos())).toBe(
      'Cumplida · 6 de 6 meses con 3 recibos o más desde el 4 feb'
    );
  });

  it('sin cumplir enseña el mes con menos', () => {
    expect(
      textoDeCumplimiento(recibos({ veredicto: 'no_cumple', medido: 2, mensual: { conMovimiento: 6, queLlegan: 5 } }))
    ).toBe('5 de 6 meses · el más flojo se quedó en 2 recibos de 3 recibos');
  });

  it('uno solo se dice en singular', () => {
    expect(textoDeCumplimiento(recibos({ exigido: 1 }))).toContain('1 recibo o más');
  });
});

// Un mes que todavía no cuenta no es un incumplimiento, pero callarlo deja un
// «4 de 4» donde faltaban dos por mirar · una tranquilidad prestada.
//
// Y se dice así, no «sin conciliar»: puede que el cargo esté por cuadrar o que
// sencillamente aún no haya pasado, y desde aquí no se distingue.
describe('los meses que todavía no cuentan', () => {
  const conPendientes = (over: Partial<Cumplimiento> = {}): Cumplimiento =>
    c({
      exigido: 1200,
      medido: 1300,
      mensual: { conMovimiento: 4, queLlegan: 4, sinCerrar: 2 },
      ...over,
    });

  it('se dicen aparte, sin contarlos como fallo', () => {
    expect(textoDeCumplimiento(conPendientes())).toBe(
      'Cumplida · 4 de 4 meses con 1.200 € o más desde el 4 feb · 2 meses más todavía no cuentan'
    );
  });

  it('uno solo se dice en singular', () => {
    expect(
      textoDeCumplimiento(conPendientes({ mensual: { conMovimiento: 4, queLlegan: 4, sinCerrar: 1 } }))
    ).toContain('1 mes más todavía no cuenta');
  });

  it('sin pendientes no se dice nada', () => {
    expect(
      textoDeCumplimiento(conPendientes({ mensual: { conMovimiento: 4, queLlegan: 4, sinCerrar: 0 } }))
    ).not.toContain('todavía no cuenta');
  });
});
