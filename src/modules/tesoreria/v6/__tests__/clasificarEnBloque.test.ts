// ============================================================================
// Clasificar cinco recibos del agua de una vez
// ============================================================================
//
// Jose, tras buscar «canal» y marcar los cinco «Adeudo de canal isabel ii»:
//
//   «quiero clasificarlo como gasto personal agua y solo me deja ignorar»
//
// Y era verdad. La barra ofrecía «Ignorar las 5» y «Son traspaso a», que es
// justo lo que NO se hace con cinco recibos del agua. Clasificar —lo único que
// resuelve de verdad una línea— seguía siendo de una en una, por «Crear
// movimiento»: cinco veces la misma ficha para el mismo concepto.
//
// Lo que se comparte entre las cinco es el CONCEPTO (de quién es, qué es, y su
// casilla fiscal). Lo que no se puede compartir es el importe y la fecha: cada
// recibo trae los suyos, y copiar los de la primera línea a las otras cuatro
// inventaría dinero y falsearía la declaración. Eso es todo lo que hace este
// módulo, y por eso está aparte: es la regla, no el formulario.
// ============================================================================

import { valoresPorLinea } from '../clasificarEnBloque';
import type { LineaExtracto } from '../extractoSesion';
import type { GuardadoFicha } from '../FichaMovimiento';

const linea = (id: number, importe: number, fecha: string): LineaExtracto => ({
  movementId: id,
  hashLinea: `h${id}`,
  textoBanco: 'Adeudo de canal isabel ii',
  fecha,
  importe,
  veredicto: 'resolver',
});

// Lo que Jose rellena una vez en la ficha: agua, suyo, no de un piso.
const AGUA: GuardadoFicha = {
  tipo: 'gasto',
  concepto: 'Agua',
  importe: -31.65,
  fecha: '2026-06-25',
  cuentaId: 1,
  inmuebleId: undefined,
  categoryKey: 'suministros.agua',
  subtypeKey: null,
  esMejora: false,
} as unknown as GuardadoFicha;

const RECIBOS = [
  linea(1, -31.65, '2026-06-25'),
  linea(2, -25.06, '2026-04-27'),
  linea(3, -28.4, '2026-02-25'),
];

describe('el concepto se comparte, el dinero no', () => {
  it('sale un juego de valores por cada línea', () => {
    expect(valoresPorLinea(AGUA, RECIBOS)).toHaveLength(3);
  });

  it('cada línea conserva SU importe y SU fecha', () => {
    // Éste es el fallo que el módulo existe para impedir. Copiar los −31,65 €
    // del primer recibo a los otros dos metería 18,44 € de gasto que nunca
    // salió de la cuenta, y con fecha equivocada, y encima en la declaración.
    const [a, b, c] = valoresPorLinea(AGUA, RECIBOS);

    expect(a.importe).toBe(-31.65);
    expect(a.fecha).toBe('2026-06-25');
    expect(b.importe).toBe(-25.06);
    expect(b.fecha).toBe('2026-04-27');
    expect(c.importe).toBe(-28.4);
    expect(c.fecha).toBe('2026-02-25');
  });

  it('y todas comparten el concepto, la casilla y de quién es', () => {
    for (const v of valoresPorLinea(AGUA, RECIBOS)) {
      expect(v.concepto).toBe('Agua');
      expect(v.categoryKey).toBe('suministros.agua');
      expect(v.inmuebleId).toBeUndefined();
      expect(v.esMejora).toBe(false);
    }
  });

  it('el tipo lo manda el signo de cada línea, no el de la ficha', () => {
    // Si entre lo elegido se cuela un abono, clasificarlo como gasto sería
    // apuntar una salida de dinero que fue una entrada.
    const conAbono = [linea(1, -31.65, '2026-06-25'), linea(2, 12.5, '2026-05-02')];
    const [gasto, ingreso] = valoresPorLinea(AGUA, conAbono);

    expect(gasto.tipo).toBe('gasto');
    expect(ingreso.tipo).toBe('ingreso');
  });

  it('sin líneas no devuelve nada · y no revienta', () => {
    expect(valoresPorLinea(AGUA, [])).toEqual([]);
  });
});
