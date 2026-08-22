#!/usr/bin/env node
// Precios de escritura por código postal · Portal Estadístico del Notariado.
//
//   node scripts/valoracion/notariado.mjs --explorar
//   node scripts/valoracion/notariado.mjs --cp=08272
//
// El portal del Notariado se apoya en un servicio ArcGIS público. Interesa
// porque publica PRECIOS DE ESCRITURA —dinero que cambió de manos— y no precios
// de anuncio, y porque su granularidad es el CÓDIGO POSTAL, que es justo lo que
// ATLAS ya guarda de cada inmueble: no hace falta geocodificar nada.
//
// Este fichero es, de momento, la herramienta para MIRAR el servicio: qué
// campos tiene, qué significan sus códigos y qué devuelve para un CP. Lo que se
// aprenda aquí decide cómo se construye la valoración.

const BASE =
  'https://services-eu1.arcgis.com/UpPGybwp9RK4YtZj/arcgis/rest/services/PRO_Inmuebles_Datos/FeatureServer';
const CAPA = 4;

const args = process.argv.slice(2);
const cpArg = args.find((a) => a.startsWith('--cp='));
// `--explorar` mira la capa 4 (código postal) · `--explorar=2`, la que se diga.
const explorarArg = args.find((a) => a === '--explorar' || a.startsWith('--explorar='));
const capaAExplorar = explorarArg?.includes('=')
  ? Number(explorarArg.split('=')[1])
  : CAPA;

// `f=json` en lugar del `f=pbf` que usa el portal · el mismo servicio sirve
// JSON plano y así no hay que decodificar protobuf para nada.
async function pedir(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  const cuota = r.headers.get('x-esri-org-request-units-per-min');
  if (cuota) process.stdout.write(`   [cuota del servicio · ${cuota}]\n`);
  const dato = await r.json();
  if (dato?.error) throw new Error(`ArcGIS: ${JSON.stringify(dato.error)}`);
  return dato;
}

// Qué más hay en el servicio.
//
// La capa 4 da el precio por código postal pero NO dice de qué periodo son las
// operaciones, y sus códigos `tipo_construccion_id` / `clase_finca_urbana_id`
// vienen sin diccionario. Las dos cosas suelen estar en otras capas o tablas
// del mismo FeatureServer, así que lo primero es ver qué hay.
if (args.includes('--capas')) {
  process.stdout.write('\n── Capas y tablas del servicio\n');
  const info = await pedir(`${BASE}?f=json`);
  process.stdout.write(`   descripción · ${(info?.serviceDescription || '(vacía)').slice(0, 500)}\n`);
  process.stdout.write(`   copyright · ${(info?.copyrightText || '(vacío)').slice(0, 300)}\n\n`);
  for (const c of [...(info?.layers ?? []), ...(info?.tables ?? [])]) {
    process.stdout.write(`   ${c.id}\t${c.name}${c.type ? `\t(${c.type})` : ''}\n`);
  }
  process.exit(0);
}

// Qué combinaciones de tipo × clase existen de verdad.
//
// El servicio no trae diccionario para `tipo_construccion_id` ni para
// `clase_finca_urbana_id`, así que sus códigos hay que deducirlos. De las
// peticiones del portal se sabe que 9 es segunda mano, 7 obra nueva, 14 pisos y
// 99 «todas». Si las combinaciones existentes son exactamente nueve, la
// deducción cierra: tres tipos por tres clases, que es el 468 = 52 × 9 de la
// capa de provincia.
if (args.includes('--combos')) {
  process.stdout.write('\n── Combinaciones tipo × clase que existen\n');
  const datos = await pedir(
    `${BASE}/2/query?f=json&where=1%3D1&outFields=tipo_construccion_id,clase_finca_urbana_id` +
      `&returnDistinctValues=true&returnGeometry=false&orderByFields=tipo_construccion_id,clase_finca_urbana_id`,
  );
  const filas = (datos?.features ?? []).map((f) => f.attributes);
  for (const a of filas) {
    process.stdout.write(`   tipo ${a.tipo_construccion_id}\tclase ${a.clase_finca_urbana_id}\n`);
  }
  process.stdout.write(`\n   ${filas.length} combinaciones\n`);
  process.exit(0);
}

if (explorarArg) {
  process.stdout.write(`\n── Metadatos de la capa ${capaAExplorar}\n`);
  const meta = await pedir(`${BASE}/${capaAExplorar}?f=json`);
  process.stdout.write(`   nombre · ${meta?.name}\n`);
  process.stdout.write(`   descripción · ${(meta?.description || '(sin descripción)').slice(0, 300)}\n`);
  process.stdout.write(`\n   CAMPOS:\n`);
  for (const c of meta?.fields ?? []) {
    process.stdout.write(`     ${c.name}\t${c.type?.replace('esriFieldType', '')}\t${c.alias ?? ''}\n`);
  }
  // Los dominios traducen los códigos: sin esto, «9» y «14» no significan nada
  // y cualquier filtro que escribamos sería adivinar.
  for (const c of meta?.fields ?? []) {
    if (c.domain?.codedValues?.length) {
      process.stdout.write(`\n   DOMINIO de ${c.name}:\n`);
      for (const v of c.domain.codedValues.slice(0, 40)) {
        process.stdout.write(`     ${v.code}\t${v.name}\n`);
      }
    }
  }
  process.stdout.write(`\n── Una fila de muestra (todos los campos)\n`);
  const muestra = await pedir(
    `${BASE}/${capaAExplorar}/query?f=json&where=1%3D1&outFields=*&returnGeometry=false&resultRecordCount=1`,
  );
  process.stdout.write(`${JSON.stringify(muestra?.features?.[0]?.attributes ?? muestra, null, 2)}\n`);

  // Cuántas filas hay en total. Con una sola foto por zona, el número cuadra
  // con el número de zonas; si hubiera histórico por año sería un múltiplo, y
  // eso delataría un periodo aunque no haya un campo que se llame así.
  const cuenta = await pedir(
    `${BASE}/${capaAExplorar}/query?f=json&where=1%3D1&returnCountOnly=true`,
  );
  process.stdout.write(`\n   filas en la capa · ${cuenta?.count}\n`);
  process.exit(0);
}

if (cpArg) {
  const cp = cpArg.slice('--cp='.length);
  // Los mismos filtros que usa el portal · 9 = segunda mano, 14 = pisos, según
  // lo que se vio en su petición. Los dominios de `--explorar` lo confirman.
  const where = encodeURIComponent(
    `cp='${cp}' and (tipo_construccion_id = 9) AND (clase_finca_urbana_id = 14)`,
  );
  process.stdout.write(`\n── Precio por m² en el CP ${cp} (segunda mano · pisos)\n`);
  const datos = await pedir(
    `${BASE}/${CAPA}/query?f=json&where=${where}&outFields=*&returnGeometry=false`,
  );
  const filas = datos?.features ?? [];
  process.stdout.write(`   ${filas.length} filas\n\n`);
  for (const f of filas.slice(0, 12)) {
    process.stdout.write(`${JSON.stringify(f.attributes)}\n`);
  }
  process.exit(0);
}

process.stderr.write('Usa --capas, --combos, --explorar[=N] o --cp=NNNNN\n');
process.exit(2);
