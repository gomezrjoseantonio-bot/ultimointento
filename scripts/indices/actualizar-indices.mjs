#!/usr/bin/env node
// Actualiza las series oficiales · Euríbor, IPC e IRAV.
//
//   node scripts/indices/actualizar-indices.mjs              descarga y escribe
//   node scripts/indices/actualizar-indices.mjs --dry-run    enseña, no escribe
//   node scripts/indices/actualizar-indices.mjs --solo=ipc   una sola serie
//   node .../actualizar-indices.mjs --buscar=IPC:general variacion anual
//                                                   busca el código de una serie
//
// Lo corre una tarea programada de GitHub Actions y el resultado se commitea:
// los ficheros de `public/data/indices/` son datos estáticos que Netlify sirve
// con el resto de la app. Eso da historial auditable —en el diff de cada mes se
// ve exactamente qué valor entró— y funciona sin conexión, que es lo que
// necesita una aplicación que guarda los datos en el navegador.
//
// Nunca se escribe una serie que no pase la validación. Ante la duda, el
// fichero se queda como estaba y el trabajo termina en rojo: quedarse con el
// dato del mes pasado es recuperable, publicar un índice equivocado no.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUENTES, buscarSeriesINE } from './fuentes.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DESTINO = path.join(RAIZ, 'public', 'data', 'indices');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const soloArg = args.find((a) => a.startsWith('--solo='));
const solo = soloArg ? soloArg.slice('--solo='.length) : null;

const ES_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

// Modo mantenimiento · cuando la guarda por antigüedad avisa de que una serie
// dejó de publicarse, esto encuentra el código que la sustituye.
const buscarArg = args.find((a) => a.startsWith('--buscar='));
if (buscarArg) {
  const [operacion, ...resto] = buscarArg.slice('--buscar='.length).split(':');
  const filtro = resto.join(':');
  const { total, hallados } = await buscarSeriesINE(operacion, filtro);
  process.stdout.write(`\n${total} series en la operación ${operacion} · ${hallados.length} encajan con "${filtro}"\n\n`);
  for (const { cod, nombre } of hallados.slice(0, 40)) {
    process.stdout.write(`   ${cod}\t${nombre}\n`);
  }
  if (hallados.length > 40) process.stdout.write(`\n   … y ${hallados.length - 40} más · afina el filtro\n`);
  process.exit(0);
}

/**
 * Comprueba lo descargado antes de dejarlo entrar.
 *
 * El rango no valida el negocio —un euríbor del 8 % es raro pero real—, sino
 * que descarta una respuesta corrupta: una página de error parseada como CSV,
 * una columna leída de la posición equivocada, un cambio de formato del
 * organismo. Es la diferencia entre un trabajo en rojo y un número falso
 * viajando hasta la cuota de una hipoteca.
 */
function validar(fuente, valores) {
  const periodos = Object.keys(valores);
  if (periodos.length === 0) return 'la descarga no trajo ningún valor';
  const malFormado = periodos.find((p) => !ES_PERIODO.test(p));
  if (malFormado) return `periodo mal formado: ${malFormado}`;
  const [min, max] = fuente.rango;
  for (const [periodo, valor] of Object.entries(valores)) {
    if (!Number.isFinite(valor)) return `valor no numérico en ${periodo}`;
    if (valor < min || valor > max) {
      return `valor fuera de rango en ${periodo}: ${valor} (esperado entre ${min} y ${max})`;
    }
  }
  return null;
}

async function leerExistente(id) {
  const ruta = path.join(DESTINO, `${id}.json`);
  if (!existsSync(ruta)) return null;
  try {
    return JSON.parse(await readFile(ruta, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Funde lo nuevo sobre lo que ya había.
 *
 * Lo descargado gana, pero nada se borra: si la fuente deja de servir el
 * histórico completo, los meses viejos siguen en el fichero. Y una revisión
 * —el INE recalcula meses ya publicados— se detecta y se cuenta en vez de
 * pasar desapercibida, porque cambia cálculos que el usuario ya vio.
 */
function fundir(anterior, nuevos) {
  const previos = anterior?.valores ?? {};
  const revisados = Object.entries(nuevos).filter(
    ([periodo, valor]) => previos[periodo] !== undefined && previos[periodo] !== valor,
  );
  const nuevosMeses = Object.keys(nuevos).filter((p) => previos[p] === undefined);
  const valores = { ...previos, ...nuevos };
  const ordenados = {};
  for (const periodo of Object.keys(valores).sort()) ordenados[periodo] = valores[periodo];
  return { valores: ordenados, revisados, nuevosMeses };
}

/**
 * ¿El último dato es tan viejo que la serie huele a descatalogada?
 *
 * Una fuente puede seguir respondiendo con normalidad y estar devolviendo una
 * serie que dejó de publicarse —el INE renumera al cambiar de base—, y eso no
 * lo detecta ninguna validación de formato ni de rango: los valores son
 * correctos, solo que viejos. Sin este corte, el fichero se quedaría congelado
 * y todo seguiría en verde mes tras mes, que es la peor manera de fallar.
 *
 * El margen es generoso a propósito (la cadencia más tres meses): un retraso de
 * publicación es normal, media década de silencio no.
 */
function demasiadoVieja(fuente, valores, hoy) {
  const ultimoPeriodo = Object.keys(valores).sort().pop();
  if (!ultimoPeriodo) return null;
  const [a, m] = ultimoPeriodo.split('-').map(Number);
  const meses = (hoy.getUTCFullYear() - a) * 12 + (hoy.getUTCMonth() + 1 - m);
  const tope = fuente.cadenciaMeses + 3;
  if (meses <= tope) return null;
  return `el último dato es de ${ultimoPeriodo}, hace ${meses} meses (tope ${tope}) · ¿serie descatalogada?`;
}

const ultimo = (valores) => {
  const claves = Object.keys(valores).sort();
  return claves.length ? claves[claves.length - 1] : null;
};

async function procesar(fuente) {
  process.stdout.write(`\n── ${fuente.id} · ${fuente.nombre}\n`);
  let descarga;
  try {
    descarga = await fuente.descargar();
  } catch (error) {
    process.stdout.write(`   ✗ descarga fallida · ${error.message}\n`);
    return { id: fuente.id, ok: false, motivo: error.message };
  }

  // El nombre que devuelve el organismo es la única forma de confirmar que el
  // código de serie apunta a lo que creemos. Se imprime siempre, a propósito.
  process.stdout.write(`   serie en origen · "${descarga.nombre}"\n`);

  const problema =
    validar(fuente, descarga.valores) ||
    demasiadoVieja(fuente, descarga.valores, new Date());
  if (problema) {
    process.stdout.write(`   ✗ validación fallida · ${problema}\n`);
    return { id: fuente.id, ok: false, motivo: problema };
  }

  const anterior = await leerExistente(fuente.id);
  const { valores, revisados, nuevosMeses } = fundir(anterior, descarga.valores);

  process.stdout.write(
    `   ${Object.keys(valores).length} meses · último ${ultimo(valores)} = ${valores[ultimo(valores)]}\n`,
  );
  if (nuevosMeses.length) process.stdout.write(`   nuevos · ${nuevosMeses.join(', ')}\n`);
  for (const [periodo, valor] of revisados) {
    process.stdout.write(`   ⚠ revisado por la fuente · ${periodo}: ${anterior.valores[periodo]} → ${valor}\n`);
  }

  const serie = {
    esquema: 1,
    id: fuente.id,
    nombre: fuente.nombre,
    unidad: fuente.unidad,
    cadenciaMeses: fuente.cadenciaMeses,
    fuente: fuente.fuente,
    actualizadoEn: new Date().toISOString(),
    valores,
  };

  const sinCambios =
    anterior && JSON.stringify(anterior.valores) === JSON.stringify(valores);
  if (sinCambios) {
    process.stdout.write('   = sin cambios\n');
    return { id: fuente.id, ok: true, cambios: false };
  }

  if (dryRun) {
    process.stdout.write('   (--dry-run · no se escribe)\n');
    return { id: fuente.id, ok: true, cambios: true };
  }

  await mkdir(DESTINO, { recursive: true });
  await writeFile(path.join(DESTINO, `${fuente.id}.json`), `${JSON.stringify(serie, null, 2)}\n`, 'utf8');
  process.stdout.write('   ✓ escrito\n');
  return { id: fuente.id, ok: true, cambios: true };
}

const pendientes = FUENTES.filter((f) => !solo || f.id === solo);
if (pendientes.length === 0) {
  process.stderr.write(`No hay ninguna fuente con id "${solo}".\n`);
  process.exit(2);
}

const resultados = [];
for (const fuente of pendientes) resultados.push(await procesar(fuente));

const fallidas = resultados.filter((r) => !r.ok);
process.stdout.write(
  `\n${resultados.length - fallidas.length}/${resultados.length} series correctas\n`,
);

// Una fuente caída no debe impedir que las otras se guarden, pero sí tiene que
// dejar el trabajo en rojo: si nadie se entera, la serie se queda congelada
// meses y el fallo se descubre cuando alguien mira una cuota mal calculada.
if (fallidas.length > 0) {
  process.stderr.write(`Fallaron: ${fallidas.map((f) => `${f.id} (${f.motivo})`).join('; ')}\n`);
  process.exit(1);
}
