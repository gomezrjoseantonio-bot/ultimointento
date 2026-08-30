// Candados de LAYOUT · la clase de fallo que ningún test de render ve.
//
// La pantalla se entregó con la columna izquierda en blanco: noventa y cinco
// tarjetas comprimidas a un píxel de alto, con su contenido tragado por el
// `overflow: hidden`. Los nueve tests de render estaban en verde mientras tanto,
// y no era casualidad: jsdom no calcula layout, así que `getByText` encuentra un
// texto igual de bien dentro de una caja de un píxel que dentro de una legible.
//
// Lo que se puede comprobar sin un navegador es el CSS como TEXTO: si las reglas
// que hacen falta están escritas. Eso es lo que hay aquí. No sustituye a mirar la
// pantalla —nada lo hace—, pero las dos reglas que se saltaron ya no se pueden
// volver a saltar en silencio.

import fs from 'fs';
import path from 'path';

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'conciliar', 'PanelConciliar.module.css'),
  'utf8',
);

/** El cuerpo de una regla, por selector exacto. */
function reglaDe(selector: string): string | null {
  const i = CSS.indexOf(`\n${selector} {`);
  if (i === -1) return null;
  const abre = CSS.indexOf('{', i);
  const cierra = CSS.indexOf('}', abre);
  return CSS.slice(abre + 1, cierra);
}

/** Todas las reglas del fichero, como pares selector → cuerpo. */
function todasLasReglas(): Array<{ selector: string; cuerpo: string }> {
  const out: Array<{ selector: string; cuerpo: string }> = [];
  const re = /(^|\n)([^{}@\n][^{}]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS)) !== null) {
    out.push({ selector: m[2].trim(), cuerpo: m[3] });
  }
  return out;
}

describe('las tarjetas no se pueden aplastar', () => {
  // Un hijo de un contenedor flex encoge por defecto, y el encogido ocurre ANTES
  // que el desbordamiento: en una columna de altura fija con 95 tarjetas, cada
  // una acaba en un píxel por mucho `overflow-y: auto` que tenga el padre.
  it('`.scroll` es una columna flex con scroll · el escenario del fallo', () => {
    const scroll = reglaDe('.scroll');
    expect(scroll).not.toBeNull();
    expect(scroll).toMatch(/flex-direction:\s*column/);
    expect(scroll).toMatch(/overflow-y:\s*auto/);
  });

  it('y por eso sus hijos tienen prohibido encoger', () => {
    const hijos = reglaDe('.scroll > *');
    expect(hijos).not.toBeNull();
    expect(hijos).toMatch(/flex-shrink:\s*0/);
  });
});

describe('un texto que se recorta tiene que ser un bloque', () => {
  // `text-overflow: ellipsis` no hace nada sobre un elemento inline. Las filas
  // del resumen eran `<span>` sin `display`, así que el concepto, su detalle y
  // el importe salían pisándose en una línea en vez de recortarse.
  it('toda regla con ellipsis declara un `display` que lo permite', () => {
    const culpables = todasLasReglas()
      .filter((r) => /text-overflow:\s*ellipsis/.test(r.cuerpo))
      .filter((r) => !/display:\s*(block|flex|grid|inline-block)/.test(r.cuerpo))
      .map((r) => r.selector);
    expect(culpables).toEqual([]);
  });

  it('y su contenedor deja que se encoja por debajo de su contenido', () => {
    // Sin `min-width: 0` un hijo flex no baja de su tamaño intrínseco y el
    // recorte no llega a activarse nunca.
    const filaTxt = reglaDe('.filaTxt');
    expect(filaTxt).not.toBeNull();
    expect(filaTxt).toMatch(/min-width:\s*0/);
    expect(filaTxt).toMatch(/display:\s*flex/);
  });

  it('lo mismo en la banda de propuesta de la tarjeta', () => {
    const propTxt = reglaDe('.propTxt');
    expect(propTxt).not.toBeNull();
    expect(propTxt).toMatch(/min-width:\s*0/);
    expect(propTxt).toMatch(/display:\s*flex/);
  });
});
