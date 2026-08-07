// La capa de presentación de Financiación · lo que enseñan las listas.
//
// Aquí vivía una SEGUNDA implementación del motor: reescribía la anualidad
// francesa, aproximaba el vencimiento como «firma + plazo» y, cuando no había
// plan guardado, se inventaba doce meses de cuota plana. Todo eso pintado
// igual que un dato de verdad.
//
// Lo que vigila esto es que las respuestas salgan del cuadro y de ningún otro
// sitio.

import {
  buildEscalones,
  cuotaMensualAprox,
  cuotaMensualConTin,
  cuotasDelAnio,
  effectiveTIN,
  fechaVencimiento,
  interesDeducibleDelAnio,
  loanRowFromPrestamo,
} from '../helpers';
import { generarCuadro } from '../../../services/prestamos/cuadro';
import type { Prestamo } from '../../../types/prestamos';

const sabadell = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 's1',
    nombre: 'Coche',
    banco: 'Banco Sabadell',
    principalInicial: 24500,
    principalVivo: 24500,
    cuotasPagadas: 0,
    plazoMesesTotal: 96,
    fechaFirma: '2024-01-15',
    fechaPrimerCargo: '2024-02-15',
    diaCargoMes: 15,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 4.49,
    baseCalculoIntereses: '30/360',
    esquemaPrimerRecibo: 'NORMAL',
    ambito: 'PERSONAL',
    ...over,
  }) as unknown as Prestamo;

describe('el banco sale del campo banco · defecto D6', () => {
  // El panel decía «9 entidades» de 9 préstamos repartidos en 5 bancos, porque
  // el banco se sacaba de la primera palabra del nombre libre: dos hipotecas
  // del mismo banco llamadas distinto contaban como dos entidades.
  it('dos préstamos del mismo banco son UNA entidad', () => {
    const filas = [
      loanRowFromPrestamo(sabadell({ id: 'a', nombre: 'Coche' })),
      loanRowFromPrestamo(sabadell({ id: 'b', nombre: 'Reforma del piso' })),
    ];

    expect(new Set(filas.map((f) => f.banco)).size).toBe(1);
    expect(filas[0].banco).toBe('Banco Sabadell');
  });

  // Los préstamos viejos pueden no tenerlo puesto · ahí se sigue mirando el
  // nombre, pero como último recurso.
  it('sin campo banco se cae al nombre', () => {
    const sinBanco = loanRowFromPrestamo(
      sabadell({ banco: undefined, nombre: 'Unicaja · hipoteca' } as Partial<Prestamo>)
    );

    expect(sinBanco.banco).toBe('Unicaja');
  });
});

describe('la cuota y el vencimiento son los del cuadro · defecto D1', () => {
  it('la cuota que enseña la lista es la que enseña el asistente', () => {
    expect(cuotaMensualAprox(sabadell())).toBe(
      generarCuadro(sabadell()).resumen.cuotaMensual
    );
  });

  it('el vencimiento es la fecha de la última cuota, no firma + plazo', () => {
    expect(fechaVencimiento(sabadell())).toBe('2032-01-15');
  });

  // Sin fechas no hay calendario, y entonces no hay vencimiento que dar. Con
  // solo la del primer cargo sí lo hay — el cálculo viejo exigía la de firma
  // para todo y ahí devolvía null aunque el cuadro fuese perfectamente
  // calculable.
  it('sin ninguna fecha no se inventa un vencimiento', () => {
    expect(
      fechaVencimiento(
        sabadell({ fechaFirma: '', fechaPrimerCargo: '' } as Partial<Prestamo>)
      )
    ).toBeNull();
  });
});

describe('el «¿y si pierdo la bonificación?» también pasa por el motor', () => {
  it('a más tipo, más cuota', () => {
    const p = sabadell();

    expect(cuotaMensualConTin(p, 5.49)).toBeGreaterThan(cuotaMensualConTin(p, 4.49));
  });

  // El tipo que se pasa YA es el efectivo · si las bonificaciones siguieran
  // puestas lo rebajarían una segunda vez.
  it('al tipo que se paga hoy da la cuota de hoy', () => {
    const p = sabadell();

    expect(cuotaMensualConTin(p, effectiveTIN(p))).toBe(cuotaMensualAprox(p));
  });
});

describe('el calendario ya no se inventa doce meses', () => {
  // Sin plan guardado se devolvían doce filas de cuota plana, existiera o no el
  // préstamo ese mes, con el interés congelado al de hoy.
  it('el año de la firma tiene los meses que existieron, no doce', () => {
    expect(cuotasDelAnio(sabadell(), null, 2024)).toHaveLength(11);
  });

  it('un año anterior al préstamo no tiene ninguno', () => {
    expect(cuotasDelAnio(sabadell(), null, 2020)).toHaveLength(0);
  });

  it('y cada mes tiene SU interés · no el mismo doce veces', () => {
    const meses = cuotasDelAnio(sabadell(), null, 2025);

    expect(new Set(meses.map((m) => m.interes)).size).toBeGreaterThan(1);
  });
});

describe('el escalón de vencimiento libera la cuota de ese día', () => {
  // Un mixto acaba pagando su cuota variable, no la del tramo fijo. Con la de
  // hoy, el escalón se quedaba corto justo en el préstamo más largo.
  const mixto = (): Prestamo =>
    ({
      id: 'm1',
      nombre: 'Hipoteca',
      banco: 'Unicaja',
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
      ambito: 'INMUEBLE',
    }) as unknown as Prestamo;

  it('la cuota liberada es la del final, no la de hoy', () => {
    const [escalon] = buildEscalones([loanRowFromPrestamo(mixto())]);

    expect(escalon.year).toBe(2043);
    expect(escalon.cuotaLiberada).toBeGreaterThan(500);
    expect(escalon.cuotaLiberada).not.toBe(454.66);
  });
});

describe('el interés deducible sale del cuadro · defecto D5', () => {
  // Se estimaba como `capitalVivo × TIN`: un año entero, al tipo de hoy, sobre
  // el capital de hoy.
  it('un préstamo personal no deduce nada', () => {
    expect(interesDeducibleDelAnio(sabadell(), 2025)).toBe(0);
  });

  const conDestino = () =>
    sabadell({
      ambito: 'INMUEBLE',
      finalidad: 'ADQUISICION',
      destinos: [
        { tipo: 'ADQUISICION', inmuebleId: 'i1', importe: 24500, porcentaje: 100 },
      ],
    } as Partial<Prestamo>);

  // La estimación vieja era `capitalVivo × TIN` = 24.500 × 4,49 % = 1.100,05 €,
  // la misma cifra todos los años del préstamo. El cuadro dice 964,13 € el
  // primer año —y sólo tiene once recibos— porque la cuota amortiza desde el
  // primer mes: al llegar a diciembre ya no se debe el capital de enero.
  it('el del año de la firma son los once recibos que hubo, no un año al tipo de hoy', () => {
    expect(interesDeducibleDelAnio(conDestino(), 2024)).toBeCloseTo(964.13, 2);
  });

  // Y baja cada año, que es lo que la estimación plana no podía enseñar nunca.
  it('y va bajando año a año según se amortiza', () => {
    const porAnio = [2025, 2026, 2027].map((a) => interesDeducibleDelAnio(conDestino(), a));

    expect(porAnio[0]).toBeGreaterThan(porAnio[1]);
    expect(porAnio[1]).toBeGreaterThan(porAnio[2]);
  });

  it('un año fuera del préstamo no deduce nada', () => {
    expect(interesDeducibleDelAnio(conDestino(), 2020)).toBe(0);
  });
});
