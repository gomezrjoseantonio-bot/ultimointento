// Preguntarle al cuadro · una respuesta por pregunta.
//
// Lo que vigila esto es que la cuota, el capital vivo, el tipo y el vencimiento
// salgan del MISMO sitio se pregunten desde donde se pregunten. Antes el
// asistente miraba el cuadro y las listas se lo aproximaban por su cuenta, así
// que el mismo préstamo tenía dos cuotas según la pantalla.
//
// El préstamo de las pruebas es la mixta de Unicaja de Jose, que es donde se
// nota: 36 meses al 2,600 % y después Euríbor + 1,750 menos un punto.

import {
  cuadroDe,
  getCapitalVivo,
  getCuota,
  getCuotasDelAnio,
  getCuotasRestantes,
  getDesgloseCuota,
  getFechaVencimiento,
  getInteresesDelAnio,
  getTinVigente,
  periodoVigente,
} from '../consulta';
import { generarCuadro } from '../cuadro';
import type { Prestamo } from '../../../types/prestamos';

const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'unicaja',
    principalInicial: 85000,
    principalVivo: 85000,
    cuotasPagadas: 0,
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
    ...over,
  }) as unknown as Prestamo;

describe('la cuota es la del cuadro, no una aproximación', () => {
  // El defecto D1 · el asistente enseñaba una cifra y el listado otra.
  it('la del arranque es la misma que enseña el asistente', () => {
    expect(getCuota(unicaja(), '2023-09-01')).toBe(
      generarCuadro(unicaja()).resumen.cuotaMensual
    );
  });

  // El defecto D2 · un mixto se proyectaba entero al tipo de hoy, así que la
  // Unicaja seguiría anunciando 454,66 € en 2043.
  it('y en el tramo variable ya NO es la del tramo fijo', () => {
    const enElFijo = getCuota(unicaja(), '2024-03-01');
    const enElVariable = getCuota(unicaja(), '2030-03-01');

    expect(enElFijo).toBe(454.66);
    expect(enElVariable).toBeGreaterThan(enElFijo);
  });

  it('el desglose suma la cuota', () => {
    const d = getDesgloseCuota(unicaja(), '2024-03-01')!;

    expect(d.capital + d.interes).toBeCloseTo(d.cuota, 2);
  });

  it('fuera del calendario no hay recibo que valga', () => {
    expect(periodoVigente(unicaja(), '2020-01-01')).toBeNull();
    expect(periodoVigente(unicaja(), '2099-01-01')).toBeNull();
    expect(periodoVigente(unicaja(), 'ayer')).toBeNull();
  });
});

describe('el tipo que se paga cambia con el tramo', () => {
  it('2,600 % en el fijo · euríbor + diferencial en el variable', () => {
    expect(getTinVigente(unicaja(), '2024-03-01')).toBeCloseTo(2.6, 3);
    expect(getTinVigente(unicaja(), '2030-03-01')).toBeCloseTo(5.899, 3);
  });

  // El defecto D3 · «el variable ignora las bonificaciones». Ya no: la rebaja
  // la aplica `tinDelTramo`, y la escritura de Unicaja las aplica SOLO al tramo
  // variable, que es lo que dice `bonificacionesDesde`.
  const conBonificacion = () =>
    unicaja({
      bonificacionesDesde: 'TRAMO_VARIABLE',
      topeBonificacionesTotal: 1.0,
      bonificaciones: [
        {
          id: 'b1',
          tipo: 'NOMINA',
          nombre: 'Bloque haberes',
          reduccionPuntosPorcentuales: 1.0,
          impacto: { puntos: 1.0 },
          lookbackMeses: 6,
          regla: { tipo: 'NOMINA', minimoMensual: 2500 },
          estado: 'ACTIVO_POR_CUMPLIMIENTO',
        },
      ],
    } as Partial<Prestamo>);

  it('el tramo variable SÍ se bonifica · 5,899 − 1,00 = 4,899', () => {
    expect(getTinVigente(conBonificacion(), '2030-03-01')).toBeCloseTo(4.899, 3);
  });

  it('y el fijo no, porque esta escritura dice que desde el variable', () => {
    expect(getTinVigente(conBonificacion(), '2024-03-01')).toBeCloseTo(2.6, 3);
  });

  // Un punto entero de rebaja son 40,65 € al mes menos de cuota · eso es lo que
  // vale cumplir las condiciones del banco, y es lo que ATLAS tiene que poder
  // decir.
  it('la rebaja llega hasta la cuota, no se queda en el tipo', () => {
    const bonificada = getCuota(conBonificacion(), '2030-03-01');
    const teorica = getCuota(unicaja(), '2030-03-01');

    expect(teorica - bonificada).toBeCloseTo(40.65, 2);
  });
});

describe('lo que se debe baja con cada recibo', () => {
  it('antes del primer cargo se debe todo lo que se pidió', () => {
    expect(getCapitalVivo(unicaja(), '2023-09-01')).toBe(85000);
  });

  it('y después de un año se debe menos', () => {
    expect(getCapitalVivo(unicaja(), '2024-09-01')).toBeLessThan(85000);
  });

  // 36 cuotas al 2,600 % · el capital que la escritura deja al entrar en la
  // parte variable.
  it('al acabar el tramo fijo quedan unos 74.890 €', () => {
    expect(getCapitalVivo(unicaja(), '2026-08-25')).toBeCloseTo(74890, -2);
  });
});

describe('cuándo se acaba', () => {
  // Era «firma + plazo en meses», que no sabe de carencias ni de días sueltos.
  it('sale del cuadro · la fecha de la última cuota', () => {
    expect(getFechaVencimiento(unicaja())).toBe('2043-08-25');
  });

  // Una carencia no mueve la última fecha —240 recibos siguen siendo 240— pero
  // sí cambia lo que se paga en cada uno. El cálculo viejo no distinguía ni una
  // cosa ni la otra: la fecha la sacaba de «firma + plazo» y la cuota de una
  // anualidad sobre el plazo entero.
  it('con carencia se paga menos durante ella, y se acaba el mismo día', () => {
    const conCarencia = unicaja({ carencia: 'CAPITAL', carenciaMeses: 12 } as Partial<Prestamo>);

    expect(getFechaVencimiento(conCarencia)).toBe('2043-08-25');
    expect(getCuota(conCarencia, '2024-03-01')).toBeLessThan(getCuota(unicaja(), '2024-03-01'));
  });

  it('las cuotas que quedan se cuentan del calendario', () => {
    expect(getCuotasRestantes(unicaja(), '2023-09-25')).toBe(239);
    expect(getCuotasRestantes(unicaja(), '2043-08-25')).toBe(0);
  });
});

describe('los intereses de un año se suman del cuadro', () => {
  // Se estimaban como `capitalVivo × TIN`: el interés de un año ENTERO, al tipo
  // de hoy, aunque el préstamo naciera en agosto.
  it('el año de la firma solo tiene los meses que existieron', () => {
    const de2023 = getCuotasDelAnio(unicaja(), 2023);

    // Septiembre a diciembre · cuatro recibos, no doce.
    expect(de2023).toHaveLength(4);
    expect(getInteresesDelAnio(unicaja(), 2023)).toBeLessThan(
      getInteresesDelAnio(unicaja(), 2024)
    );
  });

  it('un año entero del tramo fijo son doce recibos', () => {
    expect(getCuotasDelAnio(unicaja(), 2024)).toHaveLength(12);
  });

  it('y un año fuera del préstamo no tiene ninguno', () => {
    expect(getCuotasDelAnio(unicaja(), 2050)).toHaveLength(0);
    expect(getInteresesDelAnio(unicaja(), 2050)).toBe(0);
  });
});

describe('la caché no puede devolver el cuadro de otro préstamo', () => {
  // La huella es el préstamo entero · una lista de campos se queda corta el día
  // que alguien añada uno al cálculo y no se acuerde de actualizarla.
  it('cambiar un dato del cálculo da un cuadro distinto', () => {
    const antes = cuadroDe(unicaja()).resumen.cuotaMensual;
    const despues = cuadroDe(unicaja({ principalInicial: 90000 })).resumen.cuotaMensual;

    expect(despues).toBeGreaterThan(antes);
  });

  it('y preguntar dos veces por el mismo da lo mismo', () => {
    expect(cuadroDe(unicaja()).resumen).toEqual(cuadroDe(unicaja()).resumen);
  });
});
