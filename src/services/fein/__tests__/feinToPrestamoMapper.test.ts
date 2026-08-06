// De la FEIN al formulario · lo que el banco te da es lo que ATLAS debe tener.
//
// La FEIN es un documento NORMALIZADO por la Ley 5/2019: los mismos apartados
// en todos los bancos. Así que no hay que adivinar nada — hay que no perderlo.
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
