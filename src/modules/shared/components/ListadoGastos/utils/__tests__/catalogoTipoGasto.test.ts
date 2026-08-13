// El árbol de gastos que ven TODAS las pantallas sale del catálogo unificado,
// filtrado por ámbito. Este test fija que no hay un catálogo distinto por sitio.

import { catalogoTipoGasto } from '../catalogoTipoGasto';
import {
  familiasDeAmbito,
  conceptosDe,
  proyectar,
} from '../../../../../../services/conceptos/catalogoConceptos';

describe('catalogoTipoGasto · un solo catálogo, por ámbito', () => {
  it('personal ofrece las familias que el catálogo viejo no tenía', () => {
    const familias = catalogoTipoGasto('personal').map((t) => t.id);
    // Las cuatro que faltaban cuando personal usaba su catálogo propio.
    expect(familias).toEqual(expect.arrayContaining(['alquiler', 'cuotas', 'suscripciones', 'dia_a_dia']));
  });

  it('cada familia y concepto sale 1:1 del catálogo unificado del ámbito', () => {
    for (const ambito of ['personal', 'inmueble'] as const) {
      const arbol = catalogoTipoGasto(ambito);
      expect(arbol.map((t) => t.id)).toEqual(familiasDeAmbito(ambito).map((f) => f.id));
      for (const tipo of arbol) {
        const esperados = conceptosDe(tipo.id as never, ambito).map((c) => c.id);
        expect(tipo.subtipos.map((s) => s.id)).toEqual(esperados);
      }
    }
  });

  it('cada concepto arrastra su categoría de la proyección (para el picker y el import)', () => {
    const arbol = catalogoTipoGasto('inmueble');
    const luz = arbol.flatMap((t) => t.subtipos).find((s) => s.id === 'luz');
    expect((luz as { categoria?: string }).categoria).toBe(proyectar('luz', 'inmueble')?.categoria);
  });
});
