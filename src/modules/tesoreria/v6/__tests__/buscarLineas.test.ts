// ============================================================================
// Buscar en el extracto, y actuar sobre lo que sale
// ============================================================================
//
// Jose: «no hay opción de buscar... por ejemplo buscar todo lo que sean bizums
// y marcarlos e ignorarlos o clasificarlos todos a la vez».
//
// Con 95 líneas en «te necesitan» contestarlas de una en una no es un trabajo
// razonable, y la pantalla no ofrecía otra cosa. Esto es la mitad de dato del
// arreglo: filtrar, y ofrecer atajos.
//
// Los atajos se SACAN DEL FICHERO, no de una lista escrita a mano. Una lista
// fija («Bizum», «Préstamos», «Tarjeta») se queda muerta el día que el usuario
// sube un extracto sin bizums —enseña un botón que no filtra nada— y se queda
// corta el día que sube uno lleno de recibos de una comercializadora que a
// nadie se le ocurrió poner en la lista. Contando palabras sobre las líneas que
// hay delante, el atajo siempre corresponde a algo que está ahí.
// ============================================================================

import { atajosDeBusqueda, filtrarPorTexto } from '../conciliar/buscarLineas';
import type { LineaExtracto } from '../extractoSesion';

const linea = (movementId: number, textoBanco: string, importe = -10): LineaExtracto => ({
  lineaId: 100 + movementId,
  movementId,
  hashLinea: `h${movementId}`,
  textoBanco,
  fecha: '2026-08-24',
  importe,
  veredicto: 'resolver',
});

// Las líneas de verdad de sus dos extractos, tal cual las escribe el banco.
const EXTRACTO = [
  linea(1, 'Compra Bizum Iryo', -70.48),
  linea(2, 'Bizum A Favor De Luis Eduardo Montes', -15),
  linea(3, 'Bizum A Favor De Aroa Gómez', -80),
  linea(4, 'GAS Visalia-Domestica Energia', -66.9),
  linea(5, 'GAS Domestica Gas y Electricidad S.L.U.', -37.67),
  linea(6, 'RECIBO GAS COMERCIALIZADORA REGULADA', -165.08),
  linea(7, 'INTERESES Y/O COMISIONES CUENTA', -231.2),
  linea(8, 'REMUN. MES CTA ONLINE SABADELL', 1.03),
];

describe('filtrar · lo que el usuario escribe encuentra lo que ve', () => {
  it('encuentra por trozo del texto del banco, sin importar mayúsculas', () => {
    expect(filtrarPorTexto(EXTRACTO, 'bizum').map((l) => l.movementId)).toEqual([1, 2, 3]);
    expect(filtrarPorTexto(EXTRACTO, 'BIZUM').map((l) => l.movementId)).toEqual([1, 2, 3]);
  });

  it('encuentra sin acentos · «gomez» encuentra «Gómez»', () => {
    // Nadie escribe los acentos en un buscador, y el banco los escribe a veces
    // sí y a veces no en la misma cuenta.
    expect(filtrarPorTexto(EXTRACTO, 'gomez').map((l) => l.movementId)).toEqual([3]);
    expect(filtrarPorTexto(EXTRACTO, 'gómez').map((l) => l.movementId)).toEqual([3]);
  });

  it('busca también por importe · «231» encuentra los −231,20 €', () => {
    expect(filtrarPorTexto(EXTRACTO, '231').map((l) => l.movementId)).toEqual([7]);
    // Con coma, que es como lo lee en pantalla.
    expect(filtrarPorTexto(EXTRACTO, '70,48').map((l) => l.movementId)).toEqual([1]);
  });

  it('varias palabras piden TODAS · «bizum aroa» deja una sola', () => {
    expect(filtrarPorTexto(EXTRACTO, 'bizum aroa').map((l) => l.movementId)).toEqual([3]);
  });

  it('sin consulta devuelve todo · el buscador vacío no esconde nada', () => {
    expect(filtrarPorTexto(EXTRACTO, '')).toHaveLength(EXTRACTO.length);
    expect(filtrarPorTexto(EXTRACTO, '   ')).toHaveLength(EXTRACTO.length);
  });

  it('lo que no está no aparece · y no revienta', () => {
    expect(filtrarPorTexto(EXTRACTO, 'hipoteca')).toEqual([]);
    expect(filtrarPorTexto([], 'bizum')).toEqual([]);
  });
});

describe('atajos · salen del fichero que hay delante', () => {
  it('propone lo que de verdad se repite en este extracto', () => {
    const atajos = atajosDeBusqueda(EXTRACTO);
    const etiquetas = atajos.map((a) => a.etiqueta.toLowerCase());

    expect(etiquetas).toContain('bizum');
    expect(etiquetas).toContain('gas');
  });

  it('cada atajo dice a cuántas líneas alcanza, y es verdad', () => {
    const atajos = atajosDeBusqueda(EXTRACTO);

    for (const a of atajos) {
      expect(a.cuantas).toBe(filtrarPorTexto(EXTRACTO, a.consulta).length);
      expect(a.cuantas).toBeGreaterThan(1);
    }
  });

  it('no propone un atajo que sólo alcanza a una línea · eso no es un atajo', () => {
    const atajos = atajosDeBusqueda([linea(1, 'INTERESES Y/O COMISIONES CUENTA')]);
    expect(atajos).toEqual([]);
  });

  it('no propone palabras de relleno ni números de recibo', () => {
    const atajos = atajosDeBusqueda([
      linea(1, 'RECIBO DE LA COMPRA 2026 000123456'),
      linea(2, 'RECIBO DE LA COMPRA 2026 000987654'),
    ]);
    const consultas = atajos.map((a) => a.consulta);

    expect(consultas).not.toContain('de');
    expect(consultas).not.toContain('la');
    expect(consultas).not.toContain('2026');
    expect(consultas).not.toContain('000123456');
  });

  it('con el extracto vacío no propone nada · y no revienta', () => {
    expect(atajosDeBusqueda([])).toEqual([]);
  });

  it('ordena por alcance · el atajo que más quita, primero', () => {
    const atajos = atajosDeBusqueda(EXTRACTO);
    const cuantas = atajos.map((a) => a.cuantas);
    expect(cuantas).toEqual([...cuantas].sort((a, b) => b - a));
  });
});
