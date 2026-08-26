// Un solo vocabulario para el tipo de alquiler.
//
// Había cuatro listas paralelas diciendo lo mismo con palabras distintas:
// `Contract.modalidad` (`habitual | temporada | vacacional`), `Property.usoTipo`
// (`larga_estancia | temporada | turistico | …`), `RegimenAlquiler` y
// `documentoContrato.plantilla`. El mismo alquiler se llamaba `vacacional` en un
// sitio y `turistico` en otro, así que cruzar los dos lados exigía traducir — y
// donde no se traducía, fallaba en silencio.
//
// Lo que se vigila aquí: que el vocabulario sea uno, que el nombre viejo no
// vuelva, y —lo más importante— que renombrar no haya movido ni un euro.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  SUBTIPOS_ALQUILER,
  esCortaEstancia,
  normalizarSubtipo,
  reduceElSubtipo,
  subtipoDeclarado,
  type SubtipoAlquiler,
} from '../db/types-alquiler';
import { proponerReduccion } from '../reduccionAlquiler';

// ───────────────────────────────────────────────────────────────────────────
describe('el vocabulario es uno y está cerrado', () => {
  it('tres subtipos, ni uno más', () => {
    expect(SUBTIPOS_ALQUILER).toEqual(['larga_estancia', 'media_estancia', 'corta_estancia']);
  });

  it('solo la larga estancia reduce · temporada y turístico son «otros arrendamientos»', () => {
    expect(reduceElSubtipo('larga_estancia')).toBe(true);
    expect(reduceElSubtipo('media_estancia')).toBe(false);
    expect(reduceElSubtipo('corta_estancia')).toBe(false);
  });

  it('temporada y turístico van juntos en lo fiscal, y se pregunta por el concepto', () => {
    // Enumerar los dos literales a mano es donde se olvidaba uno.
    expect(esCortaEstancia('media_estancia')).toBe(true);
    expect(esCortaEstancia('corta_estancia')).toBe(true);
    expect(esCortaEstancia('larga_estancia')).toBe(false);
  });

  it('los dos enums beben de la misma fuente · no repiten los literales', () => {
    // `Contract.modalidad` y `Property.usoTipo` declaraban su propia lista, y
    // así es como una acabó diciendo `vacacional` donde la otra decía
    // `turistico`. Ahora las dos importan el tipo, y esto lo comprueba leyendo
    // el fichero: un tipo no deja rastro en tiempo de ejecución.
    const tipos = (n: string): string =>
      readFileSync(join(__dirname, '..', 'db', n), 'utf8');

    expect(tipos('types-contratos.ts')).toContain("from './types-alquiler'");
    expect(tipos('types-contratos.ts')).toContain('modalidad: SubtipoAlquiler');
    expect(tipos('types-inmuebles.ts')).toContain("from './types-alquiler'");
    expect(tipos('types-inmuebles.ts')).toContain('usoTipo?: SubtipoAlquiler');
  });

  it('`larga_estancia` no es `vivienda_habitual` · son opuestos', () => {
    // `vivienda_habitual` es el `usoTipo` del inmueble donde vive el titular:
    // ese no se alquila y está exento. El subtipo que reduce es el otro.
    expect(SUBTIPOS_ALQUILER).not.toContain('vivienda_habitual' as SubtipoAlquiler);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('los nombres viejos se leen, pero no se escriben', () => {
  it('un dato con el nombre viejo no cambia de fiscalidad al leerlo', () => {
    // Sin migración: un contrato guardado antes del renombrado trae los nombres
    // de entonces. Leerlos como «no reconocido» le quitaría la reducción a la
    // larga estancia y dejaría a los otros dos sin régimen.
    expect(normalizarSubtipo('habitual')).toBe('larga_estancia');
    expect(normalizarSubtipo('temporada')).toBe('media_estancia');
    expect(normalizarSubtipo('turistico')).toBe('corta_estancia');
    expect(normalizarSubtipo('vacacional')).toBe('corta_estancia');
  });

  it('y los nuevos se leen tal cual', () => {
    for (const s of SUBTIPOS_ALQUILER) expect(normalizarSubtipo(s)).toBe(s);
  });

  it('lo que no es ninguno de los tres no se inventa', () => {
    expect(normalizarSubtipo('lo_que_sea')).toBeUndefined();
    expect(normalizarSubtipo(undefined)).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('el TAR del Modelo 100 da UN subtipo, el mismo por las dos rutas', () => {
  it('vivienda → larga estancia', () => {
    expect(subtipoDeclarado('vivienda')).toBe('larga_estancia');
    // Sin dato se presume vivienda, que es lo que declara la mayoría.
    expect(subtipoDeclarado(undefined)).toBe('larga_estancia');
  });

  it('no vivienda → temporada · y no una cosa por cada ruta de importación', () => {
    // Una ruta escribía `temporada` y la otra el turístico para el mismo campo
    // del mismo XML. Ahora las dos preguntan aquí.
    expect(subtipoDeclarado('no_vivienda')).toBe('media_estancia');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('renombrar no ha movido un euro', () => {
  it.each([
    ['larga_estancia', '2022-01-01', 60],
    ['larga_estancia', '2026-01-01', 50],
    ['media_estancia', '2026-01-01', 0],
    ['corta_estancia', '2026-01-01', 0],
  ] as Array<[SubtipoAlquiler, string, number]>)(
    '%s firmado el %s → %i %%',
    (regimen, fechaFirma, esperado) => {
      expect(proponerReduccion({ regimen, fechaFirma }).porcentaje).toBe(esperado);
    },
  );

  it('temporada y turístico siguen dando el mismo 0 % por el mismo motivo', () => {
    const t = proponerReduccion({ regimen: 'media_estancia' });
    const v = proponerReduccion({ regimen: 'corta_estancia' });
    expect(t.porcentaje).toBe(v.porcentaje);
    expect(t.motivo).toBe(v.motivo);
    // Pero cada uno se explica a su manera: son dos subtipos, no uno.
    expect(t.explicacion).not.toBe(v.explicacion);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('`vacacional` no vuelve', () => {
  const raiz = join(__dirname, '..', '..');

  const ficheros = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const ruta = join(dir, n);
      if (statSync(ruta).isDirectory()) return n === 'node_modules' ? [] : ficheros(ruta);
      return /\.(ts|tsx)$/.test(n) ? [ruta] : [];
    });

  const relativo = (f: string): string => f.slice(raiz.length + 1);
  const conLaPalabra = ficheros(raiz)
    .filter((f) => readFileSync(f, 'utf8').includes('vacacional'))
    .map(relativo)
    .sort();

  it('en producción solo queda donde se LEE dato de fuera, nunca donde se escribe', () => {
    // Las dos excepciones lo reconocen, no lo emiten: `normalizarSubtipo` para
    // un contrato guardado antes del renombrado —sin migración, leerlo mal le
    // cambiaría la fiscalidad— y `contractDraftService` para las plantillas y
    // ficheros que el usuario sube, que lo siguen trayendo escrito.
    const produccion = conLaPalabra.filter((f) => !/__tests__|\.test\.tsx?$/.test(f));
    expect(produccion).toEqual([
      'services/contractDraftService.ts',
      'services/db/types-alquiler.ts',
    ]);
  });

  it('y en los tests, solo en los que comprueban justo esa lectura', () => {
    const enTests = conLaPalabra.filter((f) => /__tests__|\.test\.tsx?$/.test(f));
    expect(enTests).toEqual([
      'services/__tests__/desgloseReduccion.test.ts',
      'services/__tests__/reduccionUnaSolaVerdad.test.ts',
      'services/__tests__/vocabularioDeAlquiler.test.ts',
    ]);
  });

  it('ninguno de los tres nombres viejos sigue siendo un subtipo', () => {
    // Se busca el literal exacto como valor de `modalidad` o `usoTipo`, que es
    // donde estaban. `turistico` y `temporada` siguen existiendo en el repo,
    // pero en OTROS ejes —`ModoExplotacionAlquiler` y `CatalogoKind`—, y esos
    // no se tocan: por eso la búsqueda va anclada al campo, no al literal
    // suelto.
    const viejos = /(modalidad|usoTipo)(\??:|\s*===)\s*'(habitual|temporada|turistico|vacacional)'/;
    const restos = ficheros(raiz)
      .filter((f) => viejos.test(readFileSync(f, 'utf8')))
      .map(relativo);
    // El único que queda comprueba justo eso: que un contrato guardado con el
    // nombre viejo se sigue leyendo y no pierde su fiscalidad.
    expect(restos).toEqual(['services/__tests__/reduccionUnaSolaVerdad.test.ts']);
  });

  it('el motor del art. 23.2 tampoco los reconoce como régimen', () => {
    const viejos = /regimen(\??:|\s*===)\s*'(habitual|temporada|turistico|vacacional)'/;
    const restos = ficheros(raiz)
      .filter((f) => viejos.test(readFileSync(f, 'utf8')))
      .map(relativo);
    expect(restos).toEqual([]);
  });
});
