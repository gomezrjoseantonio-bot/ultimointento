#!/usr/bin/env node
// ============================================================================
// censo-stores · la foto de la arquitectura de datos, DERIVADA DEL CÓDIGO
// ============================================================================
//
// Por qué existe: el mapa de stores se escribía a mano y quedaba viejo. El de
// abril (v53) seguía en el repo 37 versiones después, contando 56 stores donde
// ya solo hay 46. Un documento que hay que acordarse de actualizar es un
// documento que miente; este script lo regenera del código real.
//
// Qué hace · sobre `src/`:
//   1. Lee los stores FÍSICOS de los `createObjectStore()` del upgrade.
//   2. Los contrasta con las claves declaradas en `interface AtlasHorizonDB`.
//   3. Recorre el código y localiza quién ESCRIBE y quién LEE cada store,
//      resolviendo las tres formas de acceso que usa la casa:
//        · literal        db.put('movements', x)
//        · constante      const STORE = 'movements'; db.put(STORE, x)
//        · objectStore    const s = tx.objectStore('movements'); s.put(x)
//   4. Clasifica cada store: VIVO · SOLO-ESCRITURA · SOLO-LECTURA · SIN-ACCESO.
//
// Uso:
//   node scripts/censo-stores.mjs             # tabla resumen
//   node scripts/censo-stores.mjs --json      # censo completo con fichero:línea
//   node scripts/censo-stores.mjs --anomalias # solo lo que no es VIVO
//
// LÍMITES CONOCIDOS (leer antes de fiarse del resultado):
//   · Es análisis léxico, no del AST. Un acceso construido dinámicamente
//     (`db.put(stores[i], x)`) no se ve. Hoy no hay ninguno así, pero si
//     aparece, este script lo perderá en silencio.
//   · "Escribe" incluye `transaction([...], 'readwrite')`, que abre la
//     posibilidad de escribir aunque esa línea no escriba todavía.
//   · Los `__typeguards__` escriben para que el compilador falle, no en
//     ejecución: se marcan aparte (no cuentan como escritor real).
//   · Cuenta ficheros que TOCAN el store, no si el flujo es alcanzable desde
//     la UI. Un store con escritor puede seguir sin poder poblarse si su
//     única llamada cuelga de una ruta muerta — eso lo dice el grep de
//     reachability, no esto.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const UPGRADES = ['services/db/upgrade-a.ts', 'services/db/upgrade-b.ts'].map((f) => path.join(ROOT, f));
const DB_TS = path.join(ROOT, 'services/db.ts');

const WRITE = new Set(['put', 'add', 'delete', 'clear']);
const READ = new Set(['get', 'getAll', 'getAllFromIndex', 'getFromIndex', 'count', 'getKey', 'getAllKeys', 'openCursor']);

const isTest = (f) => /__tests__|\.test\.|\.spec\.|tests_disabled|[\\/]tests[\\/]|setupTests/.test(f);
const isTypeguard = (f) => /__typeguards__/.test(f);
// El schema se describe a sí mismo: sus menciones no son uso.
const isSchema = (f) => f === DB_TS || UPGRADES.includes(f);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); }
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// ── 1 · stores físicos y declarados ─────────────────────────────────────────
const fisicos = new Set();
for (const f of UPGRADES) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/createObjectStore\(\s*'([A-Za-z_]+)'/g)) fisicos.add(m[1]);
}
const dbSrc = fs.readFileSync(DB_TS, 'utf8');
const ifaceBlock = dbSrc.slice(dbSrc.indexOf('export interface AtlasHorizonDB'));
const declarados = new Set(
  [...ifaceBlock.slice(0, ifaceBlock.indexOf('\n}')).matchAll(/^ {2}([a-zA-Z_]+):\s*\{\s*key:/gm)].map((m) => m[1]),
);

const STORES = [...fisicos].sort();
const SS = fisicos;

// ── 2 · censo de accesos ────────────────────────────────────────────────────
const files = walk(ROOT);

// Constantes de módulo (`const STORE = 'movements'`) · se recogen de todo el
// árbol porque varias viajan importadas entre ficheros.
const constGlobal = new Map();
const CONST_RE = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*['"]([A-Za-z_]+)['"]/g;
for (const f of files) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(CONST_RE)) if (SS.has(m[2])) constGlobal.set(m[1], m[2]);
}

const censo = Object.fromEntries(STORES.map((s) => [s, { W: [], R: [] }]));
const push = (store, kind, file, line, text) => {
  if (!SS.has(store)) return;
  const rel = path.relative(path.join(ROOT, '..'), file);
  const key = `${rel}:${line}`;
  const bucket = censo[store][kind];
  if (bucket.some((h) => h.at === key)) return;
  bucket.push({ at: key, test: isTest(file), typeguard: isTypeguard(file), code: text.trim().slice(0, 200) });
};

for (const f of files) {
  if (isSchema(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');

  const alias = new Map(constGlobal);
  for (const ln of lines) for (const m of ln.matchAll(CONST_RE)) if (SS.has(m[2])) alias.set(m[1], m[2]);

  // Variables ligadas a un objectStore concreto.
  const osVar = new Map();
  for (const ln of lines) {
    for (const m of ln.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*?\.objectStore\(\s*['"]([A-Za-z_]+)['"]/g)) if (SS.has(m[2])) osVar.set(m[1], m[2]);
    for (const m of ln.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*?\.objectStore\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) { const s = alias.get(m[2]); if (s) osVar.set(m[1], s); }
    for (const m of ln.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*?\.transaction\(\s*['"]([A-Za-z_]+)['"][^)]*\)\s*\.store/g)) if (SS.has(m[2])) osVar.set(m[1], m[2]);
  }

  lines.forEach((ln, i) => {
    const n = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return; // los comentarios no acceden a nada

    for (const m of ln.matchAll(/\.(\w+)\(\s*['"]([A-Za-z_]+)['"]/g)) {
      if (WRITE.has(m[1])) push(m[2], 'W', f, n, ln);
      else if (READ.has(m[1])) push(m[2], 'R', f, n, ln);
    }
    for (const m of ln.matchAll(/\.(\w+)\(\s*([A-Za-z_$][\w$]*)\b/g)) {
      const s = alias.get(m[2]); if (!s) continue;
      if (WRITE.has(m[1])) push(s, 'W', f, n, ln);
      else if (READ.has(m[1])) push(s, 'R', f, n, ln);
    }
    if (osVar.size) {
      for (const m of ln.matchAll(/\b([A-Za-z_$][\w$]*)\.(\w+)\(/g)) {
        const s = osVar.get(m[1]); if (!s) continue;
        if (WRITE.has(m[2])) push(s, 'W', f, n, ln);
        else if (READ.has(m[2])) push(s, 'R', f, n, ln);
      }
      for (const m of ln.matchAll(/\b([A-Za-z_$][\w$]*)\.index\([^)]*\)\.(\w+)\(/g)) {
        const s = osVar.get(m[1]); if (s && READ.has(m[2])) push(s, 'R', f, n, ln);
      }
    }
    // `transaction(..., 'readwrite')` habilita escritura aunque no escriba aquí.
    if (/\.transaction\(/.test(ln) && /readwrite/.test(ln)) {
      for (const m of ln.matchAll(/['"]([A-Za-z_]+)['"]/g)) push(m[1], 'W', f, n, ln);
    }
  });
}

// ── 3 · clasificación ───────────────────────────────────────────────────────
const real = (h) => !h.test && !h.typeguard;
const estado = (s) => {
  const w = censo[s].W.filter(real).length, r = censo[s].R.filter(real).length;
  if (w && r) return 'VIVO';
  if (w) return 'SOLO-ESCRITURA';
  if (r) return 'SOLO-LECTURA';
  return 'SIN-ACCESO-PROD';
};

const args = process.argv.slice(2);
if (args.includes('--json')) {
  console.log(JSON.stringify({ fisicos: STORES, declarados: [...declarados].sort(), censo, estado: Object.fromEntries(STORES.map((s) => [s, estado(s)])) }, null, 2));
  process.exit(0);
}

const soloFisico = STORES.filter((s) => !declarados.has(s));
const soloDeclarado = [...declarados].filter((s) => !fisicos.has(s));

console.log(`\nATLAS · censo de stores · ${STORES.length} físicos · ${declarados.size} declarados en AtlasHorizonDB`);
if (soloFisico.length) console.log(`  ⚠ físicos SIN declarar: ${soloFisico.join(', ')}`);
if (soloDeclarado.length) console.log(`  ⚠ declarados SIN crear (fantasma): ${soloDeclarado.join(', ')}`);
if (!soloFisico.length && !soloDeclarado.length) console.log('  ✓ físicos y declarados cuadran · 0 fantasma');

const filas = STORES.map((s) => ({ s, e: estado(s),
  wp: censo[s].W.filter(real).length, rp: censo[s].R.filter(real).length,
  wt: censo[s].W.filter((h) => h.test).length, rt: censo[s].R.filter((h) => h.test).length }));

const mostrar = args.includes('--anomalias') ? filas.filter((f) => f.e !== 'VIVO') : filas;
console.log('\n' + 'STORE'.padEnd(28) + 'W'.padStart(5) + 'R'.padStart(5) + 'W(test)'.padStart(9) + 'R(test)'.padStart(9) + '  ESTADO');
console.log('-'.repeat(74));
for (const f of mostrar) {
  console.log(f.s.padEnd(28) + String(f.wp).padStart(5) + String(f.rp).padStart(5) + String(f.wt).padStart(9) + String(f.rt).padStart(9) + '  ' + f.e);
}

const anom = filas.filter((f) => f.e !== 'VIVO');
console.log(`\n${filas.length - anom.length} VIVOS · ${anom.length} a revisar`);
for (const f of anom) {
  const lado = f.e === 'SOLO-LECTURA' ? censo[f.s].R : censo[f.s].W;
  console.log(`\n  ${f.s} · ${f.e}`);
  for (const h of lado.filter(real).slice(0, 6)) console.log(`      ${h.at}`);
  if (f.e === 'SIN-ACCESO-PROD') {
    const tg = [...censo[f.s].W, ...censo[f.s].R].filter((h) => h.typeguard);
    if (tg.length) console.log(`      (solo __typeguards__: ${tg.map((h) => h.at).join(', ')})`);
  }
}
console.log('');
