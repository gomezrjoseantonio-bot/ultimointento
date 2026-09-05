// E2.2 · lo que una regla con confianza resuelve sola, visto desde la sesión.
//
// La pantalla no sabe de umbrales: lee `metadata.resuelveSola` de la sugerencia.
// Aquí se prueba que con eso coloca la línea en «resueltas», que el usuario
// manda por encima (sus gestos y su «No es esto»), que el reconocedor pesa más
// que la regla, y que lo que viaja al Guardar es exactamente lo que se pinta.

import type { SugerenciaPorLinea } from '../../../../services/lineaComoMovimiento';
import { bucketDeLinea, cuadre } from '../conciliarBuckets';
import { decisionesVacias, type DecisionesSesion, type LineaExtracto } from '../extractoSesion';
import { autoPorReglaDe, lineasResueltasPorRegla, reglasCorregidas } from '../resueltasPorRegla';

const linea = (lineaId: number, over: Partial<LineaExtracto> = {}): LineaExtracto => ({
  lineaId,
  hashLinea: `h${lineaId}`,
  textoBanco: 'ADEUDO COMUNIDAD PROPIETARIOS TENDERINA',
  fecha: '2026-08-20',
  importe: -150,
  veredicto: 'resolver',
  ...over,
});

const viaB = (lineaId: number, ruleId: number, resuelveSola: boolean): SugerenciaPorLinea => ({
  lineaId,
  via: 'learning_rule',
  confidence: 80,
  description: 'Regla aprendida',
  action: { kind: 'create_treasury_event', type: 'expense', ambito: 'INMUEBLE', sourceType: 'gasto' },
  metadata: { learnKey: 'k', ruleId, appliedCount: 3, resuelveSola },
});

const con = (mut: (d: DecisionesSesion) => void): DecisionesSesion => {
  const d = decisionesVacias();
  mut(d);
  return d;
};

describe('autoPorReglaDe · qué líneas resuelve una regla con confianza', () => {
  it('solo las de vía B con resuelveSola · una heurística o una regla sin confianza no cuentan', () => {
    const sugs = new Map<number, SugerenciaPorLinea[]>([
      [1, [viaB(1, 11, true)]],
      [2, [viaB(2, 12, false)]],
      [3, [{ ...viaB(3, 13, true), via: 'heuristica' }]],
      [4, [{ ...viaB(4, 14, true), via: 'compromiso_recurrente' }]],
    ]);
    expect([...autoPorReglaDe(sugs)]).toEqual([[1, 11]]);
    expect(autoPorReglaDe(undefined).size).toBe(0);
  });
});

describe('bucketDeLinea · la línea resuelta por regla va a «resueltas»', () => {
  const auto = new Set([1]);

  it('sin gesto del usuario · resueltas', () => {
    expect(bucketDeLinea(linea(1), decisionesVacias(), undefined, undefined, auto)).toBe('resueltas');
  });

  it('«No es esto» manda · vuelve a te_necesitan', () => {
    const d = con((x) => x.desemparejados.add(1));
    expect(bucketDeLinea(linea(1), d, undefined, undefined, auto)).toBe('te_necesitan');
  });

  it('ignorar manda · ignorados', () => {
    const d = con((x) => x.ignorados.add(1));
    expect(bucketDeLinea(linea(1), d, undefined, undefined, auto)).toBe('ignorados');
  });

  it('la regla pesa más que «personal» · resolver antes que saber de quién es', () => {
    expect(bucketDeLinea(linea(1), decisionesVacias(), new Set([1]), undefined, auto)).toBe('resueltas');
  });

  it('el cuadre sigue siendo total · ninguna línea se pierde', () => {
    const lineas = [linea(1), linea(2), linea(3, { veredicto: 'cuadra', previsto: { id: 9, descripcion: 'x', importe: -150, fecha: '2026-08-20' } })];
    const c = cuadre(lineas, con((x) => x.desemparejados.add(2)), undefined, undefined, new Set([1, 2]));
    expect(c.cuadra).toBe(true);
    expect(c.porBucket).toEqual({ resueltas: 2, te_necesitan: 1, personal: 0, ignorados: 0 });
  });
});

describe('lineasResueltasPorRegla · lo que viaja al Guardar', () => {
  const autoPorRegla = new Map<number, number>([
    [1, 11],
    [2, 12],
    [3, 13],
    [4, 14],
    [5, 15],
  ]);
  const lineas = [linea(1), linea(2), linea(3), linea(4), linea(5), linea(6)];

  it('viaja lo que la regla resuelve y el usuario no ha tocado · lo demás no', () => {
    const d = con((x) => {
      x.desemparejados.add(2); // «No es esto»
      x.creados.add(3); // la clasificó él por ficha
      x.aTraspaso.set(4, 7); // la marcó traspaso
    });
    const reconocidas = new Set([5]); // el reconocedor ya la cerró · va por approvedDeterministic

    expect(lineasResueltasPorRegla(lineas, d, autoPorRegla, reconocidas)).toEqual([{ lineaId: 1, ruleId: 11 }]);
  });

  it('coincide con lo que la pantalla pinta en «resueltas» sin previsto ni libro', () => {
    const d = decisionesVacias();
    const auto = new Set(autoPorRegla.keys());
    const pintadas = lineas
      .filter((l) => bucketDeLinea(l, d, undefined, undefined, auto) === 'resueltas')
      .map((l) => l.lineaId);
    expect(lineasResueltasPorRegla(lineas, d, autoPorRegla).map((r) => r.lineaId)).toEqual(pintadas);
  });
});

describe('reglasCorregidas · las reglas que el usuario desmintió', () => {
  it('«No es esto» sobre una línea auto-resuelta apunta a su regla · sin repetir', () => {
    const autoPorRegla = new Map<number, number>([
      [1, 11],
      [2, 11],
      [3, 13],
    ]);
    const d = con((x) => {
      x.desemparejados.add(1);
      x.desemparejados.add(2);
      x.desemparejados.add(9); // una línea sin regla · no hay nada que penalizar
    });
    expect(reglasCorregidas([linea(1), linea(2), linea(3), linea(9)], d, autoPorRegla)).toEqual([11]);
  });
});
