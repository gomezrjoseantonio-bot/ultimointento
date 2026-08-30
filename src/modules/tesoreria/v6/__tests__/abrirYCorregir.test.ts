// ============================================================================
// Los montones de la derecha se abren, y lo que hay dentro se puede corregir
// ============================================================================
//
// Jose, con 334 líneas del Santander delante: «los ok que me das personal y no
// personal no veo lo que hay dentro, además si te equivocas ni puedo
// corregirlo». Tenía las dos razones.
//
// Lo primero es un agujero de DATOS, no de pintura: `agruparResueltas` recibía
// las líneas, contaba cuántas y sumaba el importe, y tiraba las líneas. La
// columna derecha no podía enseñar lo que hay dentro de «4 · Gas» aunque
// quisiera, porque para cuando llegaba a pintarlo ya no lo tenía.
//
// Lo segundo es que no existía la vuelta atrás. Una línea cae en «resueltas»
// porque el emparejador dijo que casaba, o en «personal» porque una regla dijo
// que era suya. Si cualquiera de los dos se equivoca —y se equivocan— no había
// forma de decirlo: el bucket se recalculaba solo, ignorando al usuario.
//
// `desemparejados` es esa vuelta atrás, y va la PRIMERA de todas las ramas de
// `bucketDeLinea`. No es un detalle de orden: si fuera después, el `case
// 'cuadra'` volvería a ganar y el «No es esto» del usuario no serviría de nada
// sobre justo las líneas donde más falta hace.
// ============================================================================

import { agruparResueltas } from '../conciliar/agruparResueltas';
import { bucketDeLinea, cuadre } from '../conciliarBuckets';
import { decisionesVacias, type DecisionesSesion, type LineaExtracto } from '../extractoSesion';

const linea = (over: Partial<LineaExtracto> & { movementId: number }): LineaExtracto => ({
  hashLinea: `h${over.movementId}`,
  textoBanco: 'GAS Visalia-Domestica Energia',
  fecha: '2026-08-24',
  importe: -66.9,
  veredicto: 'resolver',
  ...over,
});

const conDecisiones = (mut: (d: DecisionesSesion) => void): DecisionesSesion => {
  const d = decisionesVacias();
  mut(d);
  return d;
};

describe('el montón se abre · las líneas llegan hasta la fila', () => {
  it('un grupo lleva dentro las líneas de las que se compone', () => {
    const lineas = [
      linea({ movementId: 1, veredicto: 'cuadra', importe: -43, previsto: { id: 9, descripcion: 'Gas', importe: -43, fecha: '2026-08-03' } }),
      linea({ movementId: 2, veredicto: 'cuadra', importe: -43, previsto: { id: 9, descripcion: 'Gas', importe: -43, fecha: '2026-09-03' } }),
    ];

    const [grupo] = agruparResueltas(lineas);

    expect(grupo.cuantas).toBe(2);
    // Sin esto la columna derecha no puede enseñar qué hay dentro de «2 · Gas».
    expect(grupo.lineas.map((l) => l.movementId)).toEqual([1, 2]);
  });

  it('las líneas de dentro conservan su texto del banco, su fecha y su importe', () => {
    const lineas = [
      linea({ movementId: 7, veredicto: 'cuadra', textoBanco: 'RECIBO GAS POWER1229 AGOSTO', importe: -165.08 }),
    ];

    const [grupo] = agruparResueltas(lineas);

    expect(grupo.lineas[0]).toMatchObject({
      movementId: 7,
      textoBanco: 'RECIBO GAS POWER1229 AGOSTO',
      importe: -165.08,
    });
  });

  it('ninguna línea se pierde al agrupar · la suma de los grupos es el total', () => {
    const lineas = [
      linea({ movementId: 1, textoBanco: 'CUOTA PRESTAMO 3/240' }),
      linea({ movementId: 2, textoBanco: 'CUOTA PRESTAMO 4/240' }),
      linea({ movementId: 3, textoBanco: 'RECIBO IBERDROLA' }),
    ];

    const grupos = agruparResueltas(lineas);

    expect(grupos.reduce((n, g) => n + g.lineas.length, 0)).toBe(3);
    expect(new Set(grupos.flatMap((g) => g.lineas.map((l) => l.movementId)))).toEqual(
      new Set([1, 2, 3]),
    );
  });
});

describe('«No es esto» · el usuario manda sobre el emparejador', () => {
  it('una línea que CUADRA vuelve a «te necesitan» cuando el usuario la desempareja', () => {
    const l = linea({
      movementId: 1,
      veredicto: 'cuadra',
      previsto: { id: 9, descripcion: 'Gas', importe: -43, fecha: '2026-08-03' },
    });

    expect(bucketDeLinea(l, decisionesVacias())).toBe('resueltas');
    expect(bucketDeLinea(l, conDecisiones((d) => d.desemparejados.add(1)))).toBe('te_necesitan');
  });

  it('una línea RECONOCIDA contra un libro también vuelve · el reconocedor no es infalible', () => {
    const l = linea({ movementId: 2 });
    const reconocidas = new Set([2]);

    expect(bucketDeLinea(l, decisionesVacias(), undefined, reconocidas)).toBe('resueltas');
    expect(
      bucketDeLinea(l, conDecisiones((d) => d.desemparejados.add(2)), undefined, reconocidas),
    ).toBe('te_necesitan');
  });

  it('una línea marcada PERSONAL vuelve · el préstamo del piso colado en personal se saca de ahí', () => {
    // El caso literal de la captura: una cuota de préstamo dentro del montón
    // «Personal», sin forma de sacarla.
    const l = linea({ movementId: 3, textoBanco: 'CUOTA PRESTAMO BBVA' });
    const personales = new Set([3]);

    expect(bucketDeLinea(l, decisionesVacias(), personales)).toBe('personal');
    expect(bucketDeLinea(l, conDecisiones((d) => d.desemparejados.add(3)), personales)).toBe(
      'te_necesitan',
    );
  });

  it('desemparejar NO designora · lo que el usuario apartó sigue apartado', () => {
    // «No es esto» corrige a ATLAS, no al usuario. Ignorar es un acto suyo y
    // esta puerta no lo pisa: para eso está «reactivar».
    const l = linea({ movementId: 4 });
    const d = conDecisiones((x) => {
      x.ignorados.add(4);
      x.desemparejados.add(4);
    });

    expect(bucketDeLinea(l, d)).toBe('ignorados');
  });

  it('desemparejar no pierde la línea · el cuadre sigue cuadrando', () => {
    const lineas = [
      linea({ movementId: 1, veredicto: 'cuadra' }),
      linea({ movementId: 2, veredicto: 'cuadra' }),
      linea({ movementId: 3 }),
    ];
    const d = conDecisiones((x) => x.desemparejados.add(1));

    const c = cuadre(lineas, d);

    expect(c.cuadra).toBe(true);
    expect(c.colocadas).toBe(3);
    expect(c.porBucket.resueltas).toBe(1);
    expect(c.porBucket.te_necesitan).toBe(2);
    expect(c.huerfanas).toEqual([]);
  });

  it('decisionesVacias trae el conjunto · nadie tiene que acordarse de crearlo', () => {
    expect(decisionesVacias().desemparejados).toEqual(new Set());
  });
});
