// Una sola verdad · el mismo perfil dice lo mismo venga de donde venga.
//
// El objetivo de toda la tarea en un fichero: un contrato de larga estancia al
// 60 %, con el mismo rendimiento, tiene que rotularse igual y con el mismo
// importe tanto si el año está declarado (importe leído del XML) como si ATLAS
// lo calcula del año en curso. Antes daban tres números distintos —60, 26 y el
// importe— según por qué pantalla se mirara.
//
// Y la comprobación que cierra la puerta: que el «26 %» no vuelva a aparecer
// como cálculo en el código del repositorio.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  desgloseDeclarado,
  desgloseEnCurso,
  etiquetaTramo,
} from '../desgloseReduccion';

const RENDIMIENTO = 5334.69;

describe('el mismo contrato, los dos caminos', () => {
  // 60 % de 5.334,69 · el importe que aparece en la declaración.
  const IMPORTE = Math.round(RENDIMIENTO * 0.6 * 100) / 100;

  const declarado = desgloseDeclarado({
    arrendamientos: [{ tipo: 'larga_estancia', conReduccion: true }],
    reduccion: IMPORTE,
    rendimientoAntes: RENDIMIENTO,
  });
  const enCurso = desgloseEnCurso(
    [{ tipo: 'larga_estancia', pct: 60, ingresos: 19675 }],
    RENDIMIENTO,
  );

  it('el mismo importe', () => {
    expect(declarado.importe).toBe(enCurso.importe);
    expect(declarado.importe).toBe(IMPORTE);
  });

  it('el mismo lenguaje', () => {
    expect(declarado.tramos.map(etiquetaTramo)).toEqual(enCurso.tramos.map(etiquetaTramo));
    expect(enCurso.tramos.map(etiquetaTramo)).toEqual(['60% larga estancia']);
  });

  it('solo se distinguen en de dónde salen, que es lo único que cambia', () => {
    expect(declarado.origen).toBe('declarado');
    expect(enCurso.origen).toBe('atlas');
  });
});

describe('el mixto · los dos caminos coinciden en el importe y en los chips que pueden', () => {
  // Larga estancia al 60 % sobre la mitad del rendimiento, y una temporada que
  // no reduce. El importe es el mismo por los dos caminos.
  const enCurso = desgloseEnCurso(
    [
      { tipo: 'larga_estancia', pct: 60, ingresos: 10000 },
      { tipo: 'temporada', pct: 0, ingresos: 10000 },
    ],
    RENDIMIENTO,
  );
  const declarado = desgloseDeclarado({
    arrendamientos: [
      { tipo: 'larga_estancia', conReduccion: true },
      { tipo: 'otro', conReduccion: false },
    ],
    reduccion: enCurso.importe,
    rendimientoAntes: RENDIMIENTO,
  });

  it('mismo importe', () => {
    expect(declarado.importe).toBe(enCurso.importe);
  });

  it('el mismo número de tramos, y ninguno de los dos inventa un porcentaje', () => {
    // El declarado va sin cifra en el tramo reducible: el Modelo 100 no reparte
    // el 0149 por arrendamiento. Lo que NO hace es rellenar ese hueco con el
    // cociente, que es de donde salía el 26 %.
    expect(declarado.tramos).toHaveLength(enCurso.tramos.length);
    expect(declarado.tramos.map(etiquetaTramo)).toEqual([
      'larga estancia',
      '0% distinto de vivienda',
    ]);
    expect(enCurso.tramos.map(etiquetaTramo)).toEqual(['60% larga estancia', '0% temporada']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('el motor C no ha dejado rastro', () => {
  const raiz = join(__dirname, '..', '..');

  const ficheros = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const ruta = join(dir, n);
      if (statSync(ruta).isDirectory()) return n === 'node_modules' ? [] : ficheros(ruta);
      return /\.(ts|tsx)$/.test(n) ? [ruta] : [];
    });

  const codigo = ficheros(raiz).filter((f) => !/__tests__|\.test\.tsx?$/.test(f));
  const relativo = (f: string): string => f.slice(raiz.length + 1);

  it('`porcentajeReduccionHabitual` no existe en ningún fichero de producción', () => {
    const conElCampo = codigo.filter((f) =>
      readFileSync(f, 'utf8').includes('porcentajeReduccionHabitual'),
    );
    // Dos menciones toleradas, y las dos son comentarios que explican qué se
    // retiró y por qué. Si aparece en otro sitio, alguien lo ha vuelto a leer o
    // a escribir.
    expect(conElCampo.map(relativo)).toEqual([
      'services/desgloseReduccion.ts',
      'services/irpfCalculationService.ts',
    ]);
  });

  it('`detectarPorcentajeReduccion` y `reduccionLeyVivienda` han desaparecido', () => {
    const restos = codigo.filter((f) => {
      const t = readFileSync(f, 'utf8');
      return t.includes('detectarPorcentajeReduccion') || t.includes('reduccionLeyVivienda');
    });
    expect(restos.map(relativo)).toEqual([]);
  });

  it('nadie divide una reducción entre un rendimiento para pintar un porcentaje', () => {
    // El patrón que producía el 26 %. Sobreviven dos usos, los dos acotados:
    // el del mapper del formulario, donde es aritmética interna que no se
    // enseña, y el de `desgloseReduccion`, que solo acepta el resultado si cae
    // sobre un nominal de la ley y devuelve `null` en cuanto no lo hace.
    const dividen = codigo.filter((f) => {
      const t = readFileSync(f, 'utf8');
      return /reduccion\w*\s*\/\s*\w*[rR]endimiento/.test(t)
        || /importe\s*\/\s*antes/.test(t);
    });
    expect(dividen.map(relativo)).toEqual([
      'components/tax/taxHydrationMapper.ts',
      'services/desgloseReduccion.ts',
    ]);
  });
});
