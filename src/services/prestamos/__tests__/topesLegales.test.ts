// Lo máximo que la ley deja cobrar · VOCABULARIO §6 bis · quater.
//
// Esto NO calcula lo que pagas: propone una cifra al dar de alta, porque dejar
// el campo en cero tampoco es neutral —cero afirma «no hay comisión»—.
//
// Y lo que más vigila este test es lo que NO propone. El tope depende de qué
// préstamo sea, y donde no se puede saber hay que callarse: una cifra propuesta
// mal se lee igual que una bien.

import { topesDeReembolso } from '../topesLegales';

describe('hipoteca de la Ley 5/2019 · desde el 16 de junio de 2019', () => {
  // La ley dice que se pacta UNA de las dos · cuál, no se puede deducir, así
  // que se ofrecen ambas y elige quien tiene la escritura delante.
  it('un variable ofrece las DOS opciones', () => {
    const opciones = topesDeReembolso({
      tipoPrestamo: 'hipotecario',
      tipoInteres: 'variable',
      fechaFirma: '2021-06-15',
    });

    expect(opciones).toHaveLength(2);
    expect(opciones[0].tramos).toEqual([{ hastaMes: 36, porcentaje: 0.25 }, { porcentaje: 0 }]);
    expect(opciones[1].tramos).toEqual([{ hastaMes: 60, porcentaje: 0.15 }, { porcentaje: 0 }]);
  });

  // 2 % los diez primeros años y 1,50 % después · dos tramos, no un número.
  it('un fijo son dos tramos', () => {
    const [opcion] = topesDeReembolso({
      tipoPrestamo: 'hipotecario',
      tipoInteres: 'fijo',
      fechaFirma: '2021-06-15',
    });

    expect(opcion.tramos).toEqual([{ hastaMes: 120, porcentaje: 2 }, { porcentaje: 1.5 }]);
  });

  it('el primer día que aplica ya es de esta ley', () => {
    const opciones = topesDeReembolso({
      tipoPrestamo: 'hipotecario',
      tipoInteres: 'fijo',
      fechaFirma: '2019-06-16',
    });

    expect(opciones[0].tramos[0].porcentaje).toBe(2);
  });
});

describe('hipoteca anterior · Ley 41/2007', () => {
  it('la compensación por desistimiento son 0,50 % y 0,25 %', () => {
    const [opcion] = topesDeReembolso({
      tipoPrestamo: 'hipotecario',
      tipoInteres: 'variable',
      fechaFirma: '2015-03-01',
    });

    expect(opcion.tramos).toEqual([{ hastaMes: 60, porcentaje: 0.5 }, { porcentaje: 0.25 }]);
  });

  it('el día anterior a la Ley 5/2019 todavía es la vieja', () => {
    const [opcion] = topesDeReembolso({
      tipoPrestamo: 'hipotecario',
      tipoInteres: 'fijo',
      fechaFirma: '2019-06-15',
    });

    expect(opcion.tramos[0].porcentaje).toBe(0.5);
  });
});

// Lo importante · donde no se puede saber, no se propone. Una lista vacía no es
// un fallo: es que ATLAS no lo sabe.
describe('lo que NO se propone', () => {
  it('una mixta · el tope depende del tipo vigente el día que amortices', () => {
    expect(
      topesDeReembolso({
        tipoPrestamo: 'hipotecario',
        tipoInteres: 'mixto',
        fechaFirma: '2021-06-15',
      })
    ).toEqual([]);
  });

  // Su tope depende del plazo QUE QUEDA, no del tiempo desde la firma, así que
  // no cabe en un calendario de meses desde la firma.
  it.each(['personal', 'linea_credito', 'otro'])('un préstamo %s', (tipoPrestamo) => {
    expect(
      topesDeReembolso({ tipoPrestamo, tipoInteres: 'fijo', fechaFirma: '2021-06-15' })
    ).toEqual([]);
  });

  it('una hipoteca anterior a la Ley 41/2007 · el régimen era contractual', () => {
    expect(
      topesDeReembolso({
        tipoPrestamo: 'hipotecario',
        tipoInteres: 'variable',
        fechaFirma: '2005-01-01',
      })
    ).toEqual([]);
  });

  it.each([undefined, '', '15/06/2021'])('sin una fecha de firma de verdad · «%s»', (fechaFirma) => {
    expect(
      topesDeReembolso({ tipoPrestamo: 'hipotecario', tipoInteres: 'fijo', fechaFirma })
    ).toEqual([]);
  });

  it('sin saber el tipo de interés tampoco', () => {
    expect(
      topesDeReembolso({ tipoPrestamo: 'hipotecario', fechaFirma: '2021-06-15' })
    ).toEqual([]);
  });
});

// Cada propuesta dice de dónde sale · si ATLAS va a poner una cifra, que se
// pueda contrastar con el papel.
describe('cada opción se puede citar', () => {
  it('lleva su fundamento', () => {
    const opciones = topesDeReembolso({
      tipoPrestamo: 'hipotecario',
      tipoInteres: 'variable',
      fechaFirma: '2021-06-15',
    });

    expect(opciones.every((o) => o.fundamento.length > 0)).toBe(true);
    expect(opciones[0].fundamento).toContain('5/2019');
  });
});
