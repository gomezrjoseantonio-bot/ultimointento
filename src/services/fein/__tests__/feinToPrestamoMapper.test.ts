// De la FEIN al formulario · lo que el banco te da es lo que ATLAS debe tener.
//
// **La FEIN está normalizada en CONTENIDO, no en forma** *(Jose · 6 ago 2026:
// «hay mil FEIN, mil documentos distintos»)*. La Ley 5/2019 fija qué hay que
// informar; cada banco lo maqueta como quiere. La de Unicaja tiene 9 páginas y
// numera «3. CARACTERÍSTICAS PRINCIPALES / 4. TIPO DE INTERÉS»; la del
// Santander tiene 16 y ese mismo contenido es su «3.- TIPO DE INTERÉS», porque
// no lleva apartado de intermediario. Y hasta el PDF sale distinto: el del
// Santander se extrae letra a letra.
//
// De ahí la regla de esta capa: **el OCR no puede ser el camino principal**.
// Llena lo que reconoce y dice lo que no; el resto lo escribe una persona por
// el mismo sitio y en las mismas casillas.
//
// El caso de abajo es la FEIN real de la hipoteca de Unicaja de Jose
// (11/08/2023), con sus cifras tal como están impresas.

import { FeinToPrestamoMapper } from '../feinToPrestamoMapper';
import type { FeinLoanDraft } from '../../../types/fein';

const feinDeUnicaja = (over: Partial<FeinLoanDraft['prestamo']> = {}): FeinLoanDraft => ({
  metadata: {
    sourceFileName: 'FEIN_2.pdf',
    pagesTotal: 9,
    pagesProcessed: 9,
    ocrProvider: 'docai',
    processedAt: '2026-08-06T00:00:00.000Z',
  },
  prestamo: {
    tipo: 'MIXTO',
    capitalInicial: 85000,
    plazoMeses: 240,
    periodicidadCuota: 'MENSUAL',
    revisionMeses: 12,
    indiceReferencia: 'EURIBOR',
    diferencial: 1.75,
    tinFijo: 2.6,
    banco: 'Unicaja',
    fechaFirmaPrevista: '2023-08-25',
    ...over,
  },
  // Los tres primeros bloques de su FEIN, con sus puntos tal cual.
  bonificaciones: [
    { id: 'nomina', etiqueta: 'Bloque Haberes', descuentoPuntos: 0.5, criterio: 'Nómina ≥ 2.500 € netos' },
    { id: 'vida', etiqueta: 'Bloque Seguro Vida Riesgo', descuentoPuntos: 0.4 },
    { id: 'hogar', etiqueta: 'Bloque Seguro Hogar', descuentoPuntos: 0.2 },
  ],
});

describe('los puntos de la bonificación son PUNTOS', () => {
  // Se dividían entre 100, así que el bloque de haberes de la FEIN de Unicaja
  // —0,500000 p.p.— aterrizaba como 0,005 p.p. Cien veces menos, o sea nada:
  // la bonificación se leía del papel y luego no bajaba la cuota.
  it('0,5 en la FEIN es 0,5 en ATLAS, no 0,005', () => {
    const { bonificaciones } = FeinToPrestamoMapper.mapToPrestamoFinanciacion(feinDeUnicaja());

    expect(bonificaciones![0].descuentoTIN).toBe(0.5);
    expect(bonificaciones![0].impacto.puntos).toBe(0.5);
  });

  it('y las tres suman 1,1 puntos, que es lo que dice su FEIN', () => {
    const { bonificaciones } = FeinToPrestamoMapper.mapToPrestamoFinanciacion(feinDeUnicaja());
    const total = bonificaciones!.reduce((s, b) => s + b.impacto.puntos, 0);

    expect(total).toBeCloseTo(1.1, 10);
  });
});

describe('lo que la FEIN dice, llega', () => {
  it('el capital, el plazo, el tipo, el índice y el diferencial', () => {
    const m = FeinToPrestamoMapper.mapToPrestamoFinanciacion(feinDeUnicaja());

    expect(m.capitalInicial).toBe(85000);
    expect(m.plazoTotal).toBe(240);
    expect(m.tipo).toBe('MIXTO');
    expect(m.indice).toBe('EURIBOR');
    expect(m.diferencial).toBe(1.75);
    expect(m.revision).toBe(12);
  });

  it('la comisión de mantenimiento · se leía y se tiraba', () => {
    const m = FeinToPrestamoMapper.mapToPrestamoFinanciacion(
      feinDeUnicaja({ comisionMantenimientoMes: 3 })
    );

    expect(m.comisionMantenimiento).toBe(3);
  });
});

// Cero no es neutral · un cero en una FEIN es una afirmación, no un hueco.
// La del Santander dice «Comisión de apertura: 0,00 euros» y la de Unicaja
// «exenta de comisión de apertura»: las dos afirman que no la hay. Con `||`
// eso se perdía por ser falsy y el campo quedaba a merced de lo que hubiera.
describe('un cero leído es un dato', () => {
  it.each([
    ['comisionAperturaPct', 'comisionApertura'],
    ['comisionMantenimientoMes', 'comisionMantenimiento'],
    ['amortizacionAnticipadaPct', 'comisionAmortizacionAnticipada'],
    ['diferencial', 'diferencial'],
  ])('%s a 0 llega como 0, no como ausente', (enLaFein, enElPrestamo) => {
    const m = FeinToPrestamoMapper.mapToPrestamoFinanciacion(feinDeUnicaja({ [enLaFein]: 0 }));

    expect(m[enElPrestamo as keyof typeof m]).toBe(0);
  });
});

// Un dato inventado con aspecto de leído es peor que un hueco: el hueco se ve.
describe('lo que la FEIN NO dice, no se escribe', () => {
  it('la fecha de primer cargo y el día de cobro se quedan vacíos', () => {
    const m = FeinToPrestamoMapper.mapToPrestamoFinanciacion(feinDeUnicaja());

    // Se ponían a la fecha de firma y al día 1 · de esos dos sale la primera
    // cuota, así que eran dos mentiras con consecuencias.
    expect(m.fechaPrimerCargo).toBeUndefined();
    expect(m.diaCobroMes).toBeUndefined();
  });

  it('y sin fecha de firma en la FEIN, tampoco se pone la de hoy', () => {
    const m = FeinToPrestamoMapper.mapToPrestamoFinanciacion(
      feinDeUnicaja({ fechaFirmaPrevista: null })
    );

    expect(m.fechaFirma).toBeUndefined();
  });
});
