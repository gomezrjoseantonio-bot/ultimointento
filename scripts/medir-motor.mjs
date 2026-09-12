// ============================================================================
// E3.1 · MEDIR EL MOTOR sobre el corpus REAL · no en frío
// ============================================================================
//
// Carga un snapshot de ATLAS (el que el usuario exporta), monta el contexto de
// verdad —sus cuentas, su nombre, sus tarjetas, su catálogo— y clasifica sus
// `lineasExtracto` una a una. Mide dos cosas distintas:
//
//   · TOTAL      · qué porcentaje sale clasificado con el motor entero;
//   · SIN REGLAS · qué porcentaje sale clasificado usando SOLO lo que escala
//                  (cruce entre cuentas + identificador + catálogo nacional),
//                  con las reglas duras apagadas. Ése es el número de §7.
//
// Uso:  node scripts/medir-motor.mjs <snapshot.json> [--sin-reglas]
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const [, , rutaSnapshot, ...flags] = process.argv;
if (!rutaSnapshot) {
  console.error('uso: node scripts/medir-motor.mjs <snapshot.json> [--sin-reglas] [--detalle]');
  process.exit(1);
}

// El motor es TypeScript y este script es Node a secas: se empaqueta al vuelo
// con esbuild (ya está en el árbol) en vez de pedir un runner más.
const salida = path.join(os.tmpdir(), `atlas-motor-${process.pid}.mjs`);
// El punto de entrada va INLINE (`stdin`) y no como fichero suelto: un `.ts`
// que solo se nombra dentro de una cadena no lo alcanza nadie en el grafo de
// imports, y el detector de código muerto lo contaría —con razón— como muerto.
const ENTRADA = `
export { clasificarLinea } from './src/services/clasificacion/clasificarLinea';
export { construirCatalogo, desdeProveedoresIrpf } from './src/services/catalogoNacional/catalogoNacional';
export { semillaDelCatalogo } from './src/services/catalogoNacional/entidadesNacionales';
export { nombresDelTitular, traspasosPropios } from './src/services/deterministas/traspasosPropios';
export { cuotasQueCuadran } from './src/services/deterministas/cuotasDePrestamo';
export { recurrentesQueCuadran } from './src/services/deterministas/recurrentes';
`;

await build({
  stdin: { contents: ENTRADA, resolveDir: process.cwd(), loader: 'ts', sourcefile: 'medir-motor.entry.ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: salida,
  logLevel: 'error',
});
const motor = await import(pathToFileURL(salida).href);

const snapshot = JSON.parse(fs.readFileSync(path.resolve(rutaSnapshot), 'utf8'));
const stores = snapshot.stores ?? snapshot;

const {
  clasificarLinea,
  construirCatalogo,
  desdeProveedoresIrpf,
  semillaDelCatalogo,
  nombresDelTitular,
  traspasosPropios,
  cuotasQueCuadran,
  recurrentesQueCuadran,
} = motor;

const lineas = stores.lineasExtracto ?? [];
const cuentas = stores.accounts ?? [];
const tarjetas = stores.tarjetas ?? [];
const personas = stores.personalData ? [].concat(stores.personalData) : [];
const proveedores = stores.proveedores ?? [];

const nombres = nombresDelTitular(personas, cuentas);
const catalogo = construirCatalogo(semillaDelCatalogo(), desdeProveedoresIrpf(proveedores));

// La línea como movimiento · lo mismo que hace `lineaComoMovimiento`.
const movimientos = lineas
  .filter((l) => !l.descarte && l.fechaOperacion && Number.isFinite(l.importe))
  .map((l, i) => ({
    id: l.id ?? i + 1,
    accountId: l.accountId,
    date: l.fechaOperacion,
    amount: l.importe,
    description: l.conceptoLiteral ?? '',
    counterparty: l.contraparte,
    reference: l.referencia,
  }));

// Los deterministas PUROS · lo que ATLAS reconoce contra los libros que el
// usuario ya le dio, sin tocar la base. El cruce (§7.1) va el último para que
// no pise una cuota ni un recurrente ya reconocidos.
const origenes = new Map();
const pon = (lista) => { for (const o of lista) if (!origenes.has(o.movementId)) origenes.set(o.movementId, o); };
pon(cuotasQueCuadran(movimientos, stores.prestamos ?? []));
pon(recurrentesQueCuadran(movimientos, stores.compromisosRecurrentes ?? []));
const cruce = traspasosPropios(movimientos, cuentas, nombres, []);
pon(cruce);

function medir({ conReglas }) {
  const ctx = {
    cuentas,
    tarjetas,
    nombresTitular: conReglas ? nombres : nombres,
    catalogo,
    contratosDePrestamo: stores.prestamos ?? [],
  };
  let clasificadas = 0;
  const porOrigen = new Map();
  const sinClasificar = [];
  for (const m of movimientos) {
    const c = clasificarLinea(m, {
      ...ctx,
      origen: origenes.get(m.id),
      ...(conReglas ? {} : { sinReglasDuras: true }),
    });
    const tieneFamilia = c.familia !== undefined || c.naturaleza === 'movimiento_interno';
    if (tieneFamilia) {
      clasificadas++;
      const o = c.origen.familia ?? c.origen.naturaleza;
      porOrigen.set(o, (porOrigen.get(o) ?? 0) + 1);
    } else {
      sinClasificar.push(m.description);
    }
  }
  return { clasificadas, total: movimientos.length, porOrigen, sinClasificar };
}

function pinta(titulo, r) {
  const pct = ((r.clasificadas / r.total) * 100).toFixed(1);
  console.log(`\n${titulo}`);
  console.log(`  ${r.clasificadas} de ${r.total} líneas · ${pct}%`);
  for (const [o, n] of [...r.porOrigen].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(o).padEnd(16)} ${n}`);
  }
  if (flags.includes('--detalle')) {
    const top = new Map();
    for (const d of r.sinClasificar) {
      const k = String(d).toUpperCase().replace(/\d/g, '#').split(/\s+/).slice(0, 4).join(' ');
      top.set(k, (top.get(k) ?? 0) + 1);
    }
    console.log('  sin clasificar · lo más repetido:');
    for (const [k, n] of [...top].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`    ${String(n).padStart(4)} ${k}`);
  }
}

console.log(`corpus: ${movimientos.length} líneas · ${cuentas.length} cuentas · ${proveedores.length} proveedores`);
console.log(`catálogo: ${catalogo.porNif.size} NIF · ${catalogo.porAlias.length} alias`);
console.log(`cruce (§7.1): ${cruce.length} líneas · deterministas en total: ${origenes.size}`);
pinta('SIN reglas duras · solo cruce + identificador + catálogo', medir({ conReglas: false }));
pinta('CON reglas duras · el motor entero', medir({ conReglas: true }));
