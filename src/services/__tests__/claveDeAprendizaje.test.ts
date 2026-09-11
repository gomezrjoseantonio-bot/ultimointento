// La clave de aprendizaje no puede ser un cajón común
//
// El fallo que fija (Jose, 8 sep 2026): clasificar UNA línea del extracto
// clasificaba todas las pendientes del mismo signo. La causa no estaba en el
// aprendizaje intra-lote sino en la clave que usa para saber qué líneas se
// parecen: la limpieza del concepto borraba toda palabra de ocho letras o más
// —pensada para códigos tipo «a1b2c3d4», pero `normalizeText` ya lo ha pasado
// todo a minúsculas— y con ella se iban «mercadona», «iberdrola», «comunidad»,
// «transferencia». Sin dos palabras que juntar no había n-gram, la clave se
// quedaba en «v1|signo» y ese cajón se lo llevaba casi todo.
//
// Dos candados, y hacen falta los dos: que las palabras normales sobrevivan, y
// que «no queda nada con qué agrupar» signifique NINGUNA hermana en vez de
// TODAS.

import { buildLearnKey, buildLearnKeyV1 } from '../movementLearningService';
import { claveDeLinea, hermanasDeAprendizaje, type LineaConClave } from '../clasificacion/aprendizajeEnLote';
import type { Movement } from '../db';

const mov = (description: string, amount: number, over: Partial<Movement> = {}): Movement =>
  ({ description, amount, ...over }) as Movement;

const linea = (lineaId: number, textoBanco: string, importe: number): LineaConClave =>
  ({ lineaId, textoBanco, importe });

const todasSinDecidir = () => true;

describe('las palabras normales sobreviven a la limpieza', () => {
  it('dos comercios distintos no comparten clave', () => {
    const claves = [
      buildLearnKey(mov('MERCADONA OVIEDO', -60)),
      buildLearnKey(mov('IBERDROLA COMERCIALIZACION', -48)),
      buildLearnKey(mov('RECIBO COMUNIDAD PROPIETARIOS', -95)),
      buildLearnKey(mov('LEROY MERLIN GIJON', -120)),
    ];
    expect(claves.every((c) => c !== null)).toBe(true);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('el mismo comercio en dos recibos SÍ comparte clave · para eso está', () => {
    // Lo volátil (el nº de recibo, el importe) sigue fuera de la clave.
    expect(buildLearnKey(mov('MERCADONA OVIEDO 4471', -60))).toBe(
      buildLearnKey(mov('MERCADONA OVIEDO 9928', -37.15)),
    );
  });

  it('la cola de texto libre no parte la regla · mismo Bizum, distinto concepto', () => {
    // Sin identificador la clave son los n-gram: el principio dice quién cobra
    // y la cola suele ser una nota. Es lo que E2.4.2 vino a agrupar.
    expect(buildLearnKey(mov('BIZUM A FAVOR DE VICTOR GARCIA CONCEPTO CENA', -20))).toBe(
      buildLearnKey(mov('BIZUM A FAVOR DE VICTOR GARCIA CONCEPTO REGALO', -35)),
    );
  });

  it('con identificador, el gas y la luz del mismo acreedor NO son la misma regla', () => {
    const recibo = (suministro: string) =>
      mov(`ELECTRICIDAD IBERDROLA COMERCIALIZACION ${suministro}`, -48, { reference: 'A95554630001' });
    expect(buildLearnKey(recibo('GAS'))).not.toBe(buildLearnKey(recibo('LUZ')));
  });

  it('un código de verdad sí se sigue quitando · mezcla letras y números', () => {
    // Si el código entrara en la clave, cada recibo del mismo acreedor sería
    // una regla nueva y no se aprendería nunca nada.
    expect(buildLearnKey(mov('RECIBO IBERDROLA a1b2c3d4e5', -48))).toBe(
      buildLearnKey(mov('RECIBO IBERDROLA f6g7h8i9j0', -51)),
    );
  });

  it('el signo sigue separando · un cargo y un abono no son la misma regla', () => {
    expect(buildLearnKey(mov('MERCADONA OVIEDO', -60))).not.toBe(
      buildLearnKey(mov('MERCADONA OVIEDO', 60)),
    );
  });
});

describe('sin nada que agrupar no hay clave', () => {
  it('un concepto que se queda en una sola palabra no genera clave', () => {
    expect(buildLearnKeyV1(mov('BIZUM', -30))).toBeNull();
    expect(buildLearnKey(mov('TRANSFERENCIA', -900))).toBeNull();
  });

  it('un concepto que es solo un número tampoco', () => {
    expect(buildLearnKey(mov('202600123456', -80))).toBeNull();
  });

  it('pero con un identificador sí hay con qué · el CUPS agrupa solo', () => {
    const clave = buildLearnKey(mov('IBERDROLA', -48, { reference: 'ES0031408000000000AA' }));
    expect(clave).not.toBeNull();
  });
});

describe('las hermanas del lote · lo que le pasaba a Jose', () => {
  it('sin clave, una línea no tiene hermanas · antes las tenía TODAS', () => {
    const clasificada = linea(1, 'BIZUM', -30);
    const lote = [clasificada, linea(2, 'TRANSFERENCIA', -900), linea(3, 'RECIBO', -12)];

    expect(hermanasDeAprendizaje(clasificada, lote, todasSinDecidir)).toEqual([]);
  });

  it('un concepto reconocible solo arrastra a los suyos', () => {
    const clasificada = linea(1, 'MERCADONA OVIEDO 4471', -60);
    const lote = [
      clasificada,
      linea(2, 'MERCADONA OVIEDO 9928', -37.15),
      linea(3, 'IBERDROLA COMERCIALIZACION', -48),
      linea(4, 'RECIBO COMUNIDAD PROPIETARIOS', -95),
    ];

    const hermanas = hermanasDeAprendizaje(clasificada, lote, todasSinDecidir);

    expect(hermanas.map((h) => h.lineaId)).toEqual([2]);
  });

  it('el mismo comercio con el signo cambiado no es hermana', () => {
    const clasificada = linea(1, 'MERCADONA OVIEDO', -60);
    const lote = [clasificada, linea(2, 'MERCADONA OVIEDO', 60)];

    expect(hermanasDeAprendizaje(clasificada, lote, todasSinDecidir)).toEqual([]);
  });

  it('una línea ya decidida no se toca aunque sea hermana', () => {
    const clasificada = linea(1, 'MERCADONA OVIEDO', -60);
    const lote = [clasificada, linea(2, 'MERCADONA OVIEDO', -37.15)];

    expect(hermanasDeAprendizaje(clasificada, lote, () => false)).toEqual([]);
  });

  it('claveDeLinea dice null cuando no hay con qué agrupar', () => {
    expect(claveDeLinea(linea(9, 'BIZUM', -30))).toBeNull();
    expect(claveDeLinea(linea(9, 'MERCADONA OVIEDO', -30))).not.toBeNull();
  });
});
