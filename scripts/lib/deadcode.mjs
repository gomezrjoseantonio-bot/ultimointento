// ─────────────────────────────────────────────────────────────────────────
// DETECTOR DE MUERTE TRANSITIVA · grafo de alcanzabilidad de módulos
// TAREA-CC-DETECTOR-MUERTE-TRANSITIVA (+ Adenda 2 · política de raíces ESTRICTA)
// ─────────────────────────────────────────────────────────────────────────
//
// Sustituye la detección por "importadores directos" (que marcaba vivo cualquier
// módulo con ≥1 importador, aunque ese importador fuera él mismo inalcanzable) por
// un GRAFO DE ALCANZABILIDAD real: un módulo está vivo solo si hay un camino de
// imports desde una RAÍZ ejecutable hasta él.
//
// RAÍZ = módulo que se ejecuta SIN que nadie del repo lo importe. Política ESTRICTA
// (Adenda 2 · confirmada por Jose): raíz = EVIDENCIA de ejecución real. Un `.ts`
// NO es raíz por existir un `.js` homónimo en package.json, ni por shebang, ni por
// convención. Solo estas tres fuentes cuentan:
//   1. app-entry       · src/index.tsx (entry fijo de react-scripts/CRA)
//   2. netlify-function· fichero de functions/ (nivel superior) que exporta `handler`
//                        (netlify.toml [functions] directory = "functions")
//   3. npm-script      · fichero referenciado en package.json > scripts
//
// Una raíz de MÁS convierte árboles muertos en vivos (el detector deja de servir).
// Una raíz de MENOS produce falsos muertos (alguien borra código vivo). Por eso la
// lista de raíces se emite con evidencia y NO se añade ninguna por convención.
//
// Categorías de un módulo de producción (no test):
//   alive        · alcanzable desde una raíz
//   solo_tests   · NO alcanzable desde raíz, pero SÍ desde un *.test.* (§4 · no es
//                  vivo en producción ni muerto · categoría propia · no se borra)
//   indeterminado· alcanzable solo por `import()` dinámico con argumento no-literal
//                  que el grafo no puede resolver (§3 · falso muerto es peor que
//                  falso vivo). En este repo hoy = 0 (todos los import() son literal).
//   dead         · no alcanzable de ninguna forma
//
// SOLO LECTURA · este módulo no escribe nada. No borra nada (§8).

import fs from 'fs';
import path from 'path';

const MODULE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
// Orden de resolución al estilo bundler (react-scripts): .ts/.tsx antes que .js.
const RESOLVE_ORDER = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SCAN_DIRS = ['src', 'functions', 'scripts'];

/** ¿Es un fichero de test/spec? (mismo criterio que health.mjs) */
export function isTestPath(p) {
  return /(\.test\.|\.spec\.|__tests__|(^|\/)tests?\/|tests_disabled|setupTests|__mocks__)/.test(
    p.replace(/\\/g, '/')
  );
}

/** ¿Es un fichero de Storybook (`*.stories.*`)? Es un ENTRY de Storybook, no
 *  código de producción: netlify no lo sirve ni la app lo importa, pero
 *  `.storybook/main.js` lo referencia por glob. Se trata como los tests (§4):
 *  ni vivo en producción ni muerto → categoría `solo_stories`. */
export function isStoryPath(p) {
  return /\.stories\.[jt]sx?$/.test(p.replace(/\\/g, '/'));
}

function walk(dir, match, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, match, acc);
    } else if (match(p)) {
      acc.push(p);
    }
  }
  return acc;
}

const read = (p) => {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};

const isModuleFile = (p) =>
  MODULE_EXTS.includes(path.extname(p)) && !p.endsWith('.d.ts');

/**
 * Especificadores importados por un fichero: static `from`, `import '…'`,
 * `import('…')` dinámico y `require('…')`. Los `import type` cuentan igual (un
 * módulo usado solo para tipos NO es borrable sin romper el build → no es muerto).
 * Los `import()` con argumento NO literal se listan aparte (para §3).
 */
export function specifiers(src) {
  const specs = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g, // import/export … from '…'
    /\bimport\s*['"]([^'"]+)['"]/g, // import '…' (side-effect)
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('…') dinámico literal
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('…')
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) specs.push(m[1]);
  }
  return specs;
}

/**
 * Detecta `import()` dinámico con argumento NO literal (variable o plantilla) →
 * categoría indeterminado (§3). Un import dinámico REAL lleva un identificador o
 * un template literal sin espacios como argumento. Se descarta la prosa de los
 * comentarios que casualmente contiene ese texto seguido de una frase (lleva
 * espacios y no es código). En este repo hoy el resultado es 0: todos los
 * import dinámicos usan string literal.
 */
export function dynamicNonLiteralImports(src) {
  const hits = [];
  const re = /\bimport\s*\(\s*([^'")\s][^)]*?)\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const arg = m[1].trim();
    if (/\s/.test(arg)) continue; // prosa en comentario, no un import() real
    hits.push(arg);
  }
  return hits;
}

/** Resuelve un especificador RELATIVO al fichero real del grafo (o null). */
function resolveSpec(fromFile, spec, nodeSet) {
  if (!spec.startsWith('.')) return null; // bare/externo · no hay alias en este repo
  const base = path.resolve(path.dirname(fromFile), spec);
  const tries = [];
  if (path.extname(base)) tries.push(base);
  for (const ext of RESOLVE_ORDER) tries.push(base + ext);
  for (const ext of RESOLVE_ORDER) tries.push(path.join(base, 'index' + ext));
  for (const t of tries) {
    const n = path.normalize(t);
    if (nodeSet.has(n)) return n;
  }
  return null;
}

/**
 * Construye el grafo, marca raíces, propaga alcanzabilidad y clasifica.
 * Devuelve un objeto con las listas y un helper `classOf(relPath)`.
 */
export function analyzeReachability(ROOT) {
  const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

  // 1 · nodos
  const nodes = [];
  for (const d of SCAN_DIRS) {
    for (const f of walk(path.join(ROOT, d), isModuleFile)) nodes.push(path.normalize(f));
  }
  const nodeSet = new Set(nodes);
  const contents = new Map(nodes.map((n) => [n, read(n)]));

  // 2 · aristas
  const edges = new Map();
  const nonLiteral = [];
  for (const n of nodes) {
    const set = new Set();
    for (const spec of specifiers(contents.get(n))) {
      const r = resolveSpec(n, spec, nodeSet);
      if (r && r !== n) set.add(r);
    }
    edges.set(n, set);
    for (const h of dynamicNonLiteralImports(contents.get(n))) {
      nonLiteral.push({ file: rel(n), arg: h });
    }
  }

  // 3 · raíces (estrictas · con evidencia)
  const roots = [];
  const seenRoot = new Set();
  const addRoot = (abs, type, evidence) => {
    const n = path.normalize(abs);
    if (!nodeSet.has(n) || seenRoot.has(n)) return;
    seenRoot.add(n);
    roots.push({ path: rel(n), type, evidence, _abs: n });
  };
  // 3a · app entry
  addRoot(
    path.join(ROOT, 'src', 'index.tsx'),
    'app-entry',
    'entry fijo de react-scripts/CRA (convención del framework · no hay otro entry)'
  );
  // 3b · funciones Netlify (ficheros de nivel superior de functions/ que exportan handler)
  const fnDir = path.normalize(path.join(ROOT, 'functions'));
  const handlerRe =
    /export\s+(?:const|async\s+function|function)\s+handler\b|exports\.handler\b|module\.exports\s*=\s*\{[^}]*\bhandler\b/;
  for (const n of nodes) {
    if (path.dirname(n) !== fnDir) continue;
    if (handlerRe.test(contents.get(n))) {
      addRoot(n, 'netlify-function', 'exporta handler · netlify.toml [functions] directory="functions"');
    }
  }
  // 3c · scripts npm (ficheros referenciados en package.json > scripts)
  let pkg = {};
  try {
    pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  } catch {
    /* sin package.json legible */
  }
  const scriptFileRe = /(?:^|\s|=)((?:scripts|src|functions)\/[\w./-]+\.(?:js|mjs|cjs|ts|tsx))/g;
  for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
    let m;
    while ((m = scriptFileRe.exec(cmd))) {
      addRoot(path.join(ROOT, m[1]), 'npm-script', `package.json scripts.${name}`);
    }
  }
  // 3d · candados de tipos (`src/services/__typeguards__/*`). Existen para ser
  // CHEQUEADOS por `tsc`, no para ser importados: nadie los importa POR DISEÑO
  // (un `@ts-expect-error` que sólo se consume si el schema tiene el tipo real).
  // Son entradas del gate de tsc, igual que un test lo es de jest → son raíces.
  // Sin esto, cuentan como "muertos" siendo load-bearing (falso positivo).
  for (const n of nodes) {
    if (n.replace(/\\/g, '/').includes('/__typeguards__/')) {
      addRoot(n, 'typecheck-guard', 'candado chequeado por tsc · no importable por diseño');
    }
  }

  // 4 · alcanzabilidad (BFS)
  const bfs = (seeds) => {
    const seen = new Set();
    const q = [...seeds];
    while (q.length) {
      const n = q.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of edges.get(n) || []) if (!seen.has(m)) q.push(m);
    }
    return seen;
  };
  const prodAlive = bfs(roots.map((r) => r._abs));
  const testReach = bfs(nodes.filter(isTestPath));
  const storyReach = bfs(nodes.filter(isStoryPath));

  // 5 · clasificación (solo nodos de producción · tests y stories no se clasifican)
  const alive = [];
  const dead = [];
  const soloTests = [];
  const soloStories = [];
  for (const n of nodes) {
    if (isTestPath(n) || isStoryPath(n)) continue;
    if (prodAlive.has(n)) alive.push(rel(n));
    else if (testReach.has(n)) soloTests.push(rel(n));
    else if (storyReach.has(n)) soloStories.push(rel(n));
    else dead.push(rel(n));
  }
  alive.sort();
  dead.sort();
  soloTests.sort();
  soloStories.sort();

  const classOf = (relPath) => {
    const n = path.normalize(path.join(ROOT, relPath));
    if (!nodeSet.has(n)) return 'not-a-node';
    if (isTestPath(n)) return 'test';
    if (isStoryPath(n)) return 'story';
    if (prodAlive.has(n)) return 'alive';
    if (testReach.has(n)) return 'solo_tests';
    if (storyReach.has(n)) return 'solo_stories';
    return 'dead';
  };

  return {
    roots: roots.map(({ _abs, ...r }) => r),
    counts: {
      nodes: nodes.length,
      alive: alive.length,
      dead: dead.length,
      solo_tests: soloTests.length,
      solo_stories: soloStories.length,
      indeterminado: 0,
    },
    dead,
    soloTests,
    soloStories,
    indeterminado: [], // 0 hoy: todos los import() del repo son string literal
    dynamicNonLiteral: nonLiteral,
    classOf,
  };
}
