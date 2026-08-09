// ============================================================================
// ¿Existe cada clase que un TSX pide en el CSS module del que la pide?
// ============================================================================
//
// Un CSS module devuelve `undefined` para una clase que no tiene. No es un
// error: el `className` sale vacío, el elemento pierde su estilo y todo lo
// demás sigue funcionando. No lo ve `tsc`, ni ESLint, ni el build, ni la suite
// — solo se ve mirando la pantalla.
//
// Es el modo de fallo de partir un CSS module en dos, y costó un push: al
// separar la tarjeta de bonificaciones de la ficha, tres chips y dos flechas
// se quedaron apuntando al fichero equivocado. La comprobación que escribí
// entonces tenía la clave y el valor cambiados, así que no comprobaba nada y
// pasaba siempre. Esta versión está probada contra ese commit roto: lo caza.
//
// LÍNEA BASE · como el trinquete de `health`. Las que ya estaban rotas antes
// de existir esta comprobación se listan una a una para que no bloqueen, pero
// una NUEVA sí falla. Arreglar una de la lista y quitarla de aquí es la forma
// de que el número baje.
// ============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';

/** Rotas conocidas · pantallas ajenas, arreglarlas pide saber qué se quería. */
const YA_ROTAS = new Set([
  'src/modules/ajustes/pages/ConceptosPage.tsx · containerStyles.btnPrimary',
  'src/modules/inmuebles/components/contratos/EmptyStateSinResultados.tsx · styles.emptyResults',
  'src/modules/inmuebles/components/contratos/EmptyStateSinResultados.tsx · styles.emptyResultsBtn',
  'src/modules/inmuebles/components/contratos/historico/DrawerExContrato.tsx · styles.heroStat',
]);

/** Las clases que un CSS define · en cualquier posición del selector. */
function clasesDe(fichero) {
  let txt = readFileSync(fichero, 'utf8');
  txt = txt.replace(/\/\*[\s\S]*?\*\//g, ' '); // fuera comentarios
  txt = txt.replace(/\{[^{}]*\}/g, ' '); // fuera declaraciones · queda el selector
  // Toda clase cuenta, también en `.a.b` y en `.a .b` · si solo se miraran las
  // de principio de línea, media hoja de estilos parecería no existir.
  return new Set([...txt.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
}

function tsxDe(dir, salida = []) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) tsxDe(ruta, salida);
    else if (nombre.endsWith('.tsx')) salida.push(ruta);
  }
  return salida;
}

let comprobadas = 0;
const nuevas = [];
const vistas = new Set();

for (const tsx of tsxDe('src')) {
  const src = readFileSync(tsx, 'utf8');
  // alias → fichero, EN ESTE ORDEN. Al revés se busca cada clase usando el
  // nombre del fichero como alias, no se encuentra ninguna y el script pasa
  // siempre — que es exactamente cómo se coló el refactor roto.
  for (const [, alias, ruta] of src.matchAll(/import\s+(\w+)\s+from\s+'([^']*\.module\.css)'/g)) {
    const fichero = resolve(dirname(tsx), ruta);
    if (!existsSync(fichero)) continue;
    const disponibles = clasesDe(fichero);
    const usadas = new Set([...src.matchAll(new RegExp(`${alias}\\.([A-Za-z]\\w*)\\b`, 'g'))].map((m) => m[1]));
    for (const cls of [...usadas].sort()) {
      comprobadas++;
      if (disponibles.has(cls)) continue;
      const clave = `${tsx} · ${alias}.${cls}`;
      vistas.add(clave);
      if (!YA_ROTAS.has(clave)) nuevas.push(`${clave}  →  ${basename(fichero)}`);
    }
  }
}

console.log(`CSS modules · ${comprobadas} referencias comprobadas`);

// Una de la línea base que ya no aparece se quita de la lista · si no, la lista
// se queda perdonando roturas que ya no existen.
const arregladas = [...YA_ROTAS].filter((k) => !vistas.has(k));
if (arregladas.length) {
  console.log(`\n${arregladas.length} de la línea base ya no están rotas · quítalas de YA_ROTAS:`);
  for (const k of arregladas) console.log(`  ${k}`);
}

if (nuevas.length) {
  console.error(`\n✗ ${nuevas.length} referencia(s) a una clase que no existe:`);
  for (const n of nuevas) console.error(`  ${n}`);
  console.error('\nEl className sale `undefined` y el elemento pierde su estilo, sin avisar.');
  process.exit(1);
}

console.log(`✓ Ninguna rotura nueva · ${YA_ROTAS.size} conocidas en la línea base.`);
