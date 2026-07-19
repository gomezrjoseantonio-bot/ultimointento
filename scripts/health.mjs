#!/usr/bin/env node
// @ts-nocheck
/**
 * MARCADOR DE SALUD · ATLAS
 * =========================
 * Implementa el PROTOCOLO DE GARANTÍA (§2 / §6). Un único comando que MIDE
 * el estado del repositorio en ~16 indicadores numéricos, en vez de narrarlo.
 *
 * Principios (§6 · requisitos):
 *   1. Cero dependencias nuevas · Node puro.
 *   2. NO modifica `src/` · solo lee.
 *   3. Cada indicador documenta EN SU FUNCIÓN qué cuenta y qué excluye
 *      (los tests SIEMPRE se excluyen).
 *   4. Salida doble: docs/health/HEALTH-AAAA-MM-DD.json + tabla por consola.
 *   5. Indicador no calculable en el entorno → `null` + marca NO MEDIBLE
 *      (nunca 0).
 *   6. Si existe un JSON anterior, imprime la diferencia y marca en rojo
 *      cualquier empeoramiento.
 *   7. Código de salida != 0 si algún indicador empeoró (para CI).
 *
 * Uso:
 *   node scripts/health.mjs              → mide y escribe la foto de hoy
 *   node scripts/health.mjs --regresion  → re-ejecuta ARREGLOS-CERTIFICADOS.md
 *   node scripts/health.mjs --no-write   → mide e imprime, sin escribir JSON
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { analyzeReachability } from './lib/deadcode.mjs';

const ROOT = process.cwd();
// Modo CI: `npm run health:ci` (--with-tests) autoriza ejecutar la suite de
// tests para medir `tests_rojos` (solo si hay node_modules). Ver testsRojos().
const WITH_TESTS = process.argv.includes('--with-tests');
// Comparación del trinquete contra la rama destino (main) en vez de por fecha.
// Se activa en GitHub Actions (env GITHUB_ACTIONS) o con --base-main. El ref se
// puede sobreescribir con HEALTH_BASELINE_REF (útil para tests locales).
const CI_BASELINE =
  process.env.GITHUB_ACTIONS === 'true' || process.argv.includes('--base-main');
const BASELINE_REF = process.env.HEALTH_BASELINE_REF || 'origin/main';
const SRC = path.join(ROOT, 'src');
const HEALTH_DIR = path.join(ROOT, 'docs', 'health');
const DB_FILE = path.join(SRC, 'services', 'db.ts');
const APP_FILE = path.join(SRC, 'App.tsx');
const TOKENS_FILE = path.join('src', 'design-system', 'v5', 'tokens.css');

// ─────────────────────────────────────────────────────────────────────────
// Utilidades de lectura (SOLO LECTURA · nunca escribe en src/)
// ─────────────────────────────────────────────────────────────────────────

/** ¿Es un archivo de test/spec? Se excluyen SIEMPRE de todos los conteos. */
function isTestPath(p) {
  return /(\.test\.|\.spec\.|__tests__|(^|\/)tests?\/|tests_disabled|setupTests|__mocks__)/.test(
    p.replace(/\\/g, '/')
  );
}

/** Recorre un directorio y devuelve rutas de archivo que cumplan `match`. */
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

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** Archivos de código de PRODUCCIÓN (no test) bajo src/. */
function prodFiles(exts) {
  const set = new Set(exts);
  return walk(SRC, (p) => set.has(path.extname(p)) && !isTestPath(p));
}

const DB_SRC = read(DB_FILE);
const APP_SRC = read(APP_FILE);

// ─────────────────────────────────────────────────────────────────────────
// Modelo de datos: interfaz AtlasHorizonDB y stores físicos
// ─────────────────────────────────────────────────────────────────────────

/** Claves declaradas de nivel superior en `interface AtlasHorizonDB { … }`. */
function interfaceKeys() {
  const m = DB_SRC.match(/interface AtlasHorizonDB\s*\{([\s\S]*?)\n\}/);
  if (!m) return [];
  const body = m[1];
  const lines = body.split('\n');
  const keys = [];
  let depth = 0; // profundidad de llaves para ignorar props de objetos anidados
  for (const line of lines) {
    const trimmed = line.trim();
    if (depth === 0) {
      const km = trimmed.match(/^([a-zA-Z0-9_]+)\s*[:?]/);
      if (km && !trimmed.startsWith('//') && !trimmed.startsWith('*')) keys.push(km[1]);
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
  }
  return keys;
}

/** Nombres usados en `createObjectStore('X')` en db.ts. */
function createdStores() {
  return new Set(
    [...DB_SRC.matchAll(/createObjectStore\((['"])([a-zA-Z0-9_]+)\1/g)].map((m) => m[2])
  );
}

/** Nombres usados en `deleteObjectStore('X')` en db.ts (stores retirados). */
function deletedStores() {
  return new Set(
    [...DB_SRC.matchAll(/deleteObjectStore\((['"])([a-zA-Z0-9_]+)\1/g)].map((m) => m[2])
  );
}

/**
 * ¿La declaración de la clave `key` está marcada como legacy/deprecated?
 * Se inspecciona el bloque de comentario inmediatamente anterior + la línea.
 */
function keyIsDeprecated(key) {
  const re = new RegExp('\\n\\s*' + key + '\\s*[:?]');
  const idx = DB_SRC.search(re);
  if (idx < 0) return false;
  const before = DB_SRC.slice(Math.max(0, idx - 900), idx);
  const lineEnd = DB_SRC.indexOf('\n', idx + 1);
  const line = DB_SRC.slice(idx, lineEnd < 0 ? undefined : lineEnd);
  return /@deprecated|@legacy|\bDEPRECATED\b|\bLEGACY\b/.test(before + line);
}

const IFACE_KEYS = interfaceKeys();
const CREATED = createdStores();
const DELETED = deletedStores();

/**
 * INDICADOR 1 · stores_fantasma
 * Claves declaradas en la interfaz `AtlasHorizonDB` que NO tienen store físico:
 *   CUENTA  · clave de la interfaz sin `createObjectStore('clave')`
 *   EXCLUYE · claves con `deleteObjectStore('clave')` (store retirado a propósito)
 *   EXCLUYE · claves anotadas @deprecated/@legacy (mantenidas solo para que
 *             el código de migración compile · p. ej. `valoraciones_historicas`)
 * Resultado esperado por la auditoría: 4
 *   → gastos · propertyImprovements · fiscalSummaries · operacionesFiscales
 */
function storesFantasma() {
  const list = IFACE_KEYS.filter(
    (k) => !CREATED.has(k) && !DELETED.has(k) && !keyIsDeprecated(k)
  );
  return { value: list.length, detail: list };
}

/**
 * INDICADOR 2 · stores_no_tipados · TIPADO REAL (value:any) desde 2026-07-19
 * Claves de la interfaz `AtlasHorizonDB extends DBSchema` cuyo `value` sigue en
 * `any` (sin endurecer a su tipo de dominio):
 *   CUENTA  · `store: { key: …; value: any; indexes: … }` en la interfaz
 *   EXCLUYE · las endurecidas (`value: <TipoReal>`)
 *
 * CAMBIO DE DEFINICIÓN (autorizado por Jose · ampliación libre · el nº sube 0→N):
 * ANTES medía PRESENCIA (createObjectStore sin clave en la interfaz). Tras la
 * Fase 0 de DBSchema las 45 claves están declaradas → ese contador daba 0 y ya
 * no medía nada útil (un indicador que mide lo que no importa). AHORA mide TIPADO
 * REAL: con `extends DBSchema`, `StoreValue<…>` SÍ se propaga, así que un `value`
 * tipado es garantía de tsc de verdad (un `put`/`get` mal formado no compila · lo
 * fijan los candados B de __typeguards__). El número sube porque mide algo más
 * estricto (deuda antes invisible), no por regresión. BAJA al endurecer cada
 * store en las tandas siguientes de DBSchema.
 */
function storesNoTipados() {
  // Cuerpo de `interface AtlasHorizonDB extends DBSchema { … }`. El `\s+extends\s+`
  // desambigua de la línea `interface AtlasHorizonDB {` que aparece en un comentario.
  // `\r?\n` tolera CRLF; el cierre es `\r?\n\s*\}` (permite indentación del `}`).
  const m = DB_SRC.match(/interface AtlasHorizonDB\s+extends\s+DBSchema\s*\{([\s\S]*?)\r?\n\s*\}/);
  // FALLO EXPLÍCITO, no verde-en-falso (review Copilot #1435): si el regex no casa
  // (cambio de formato/indentación), NO caer a 0 en silencio — eso escondería toda
  // la deuda de tipado y pasaría el trinquete en falso. Se marca NO MEDIBLE (null).
  if (!m) {
    return {
      value: null,
      note:
        'NO MEDIBLE · no se pudo parsear `interface AtlasHorizonDB extends DBSchema { … }` ' +
        '(¿cambió el formato/indentación?). No se cae a 0 en silencio para no esconder deuda.',
    };
  }
  const body = m[1];
  const untyped = [];
  let parsed = 0;
  for (const line of body.split(/\r?\n/)) {
    // `store: { key: …; value: <tipo>; indexes: { … } };` · el `value` va antes del
    // primer `}` (el de `indexes`), así que `[^}]*` no se lo salta.
    const km = line.match(/^\s+([a-zA-Z0-9_]+)\s*:\s*\{[^}]*\bvalue:\s*([^;]+);/);
    if (!km) continue;
    parsed++;
    if (km[2].trim() === 'any') untyped.push(km[1]);
  }
  // Sanidad: la interfaz tiene decenas de stores. 0 claves parseadas = regex roto,
  // no un schema vacío → NO MEDIBLE, no 0 (mismo motivo que arriba).
  if (parsed === 0) {
    return {
      value: null,
      note:
        'NO MEDIBLE · la interfaz existe pero no se parseó ninguna clave `store: { … }` ' +
        '(regex de línea roto). No se cae a 0 en silencio.',
    };
  }
  untyped.sort();
  return {
    value: untyped.length,
    detail: untyped,
    note:
      'claves con `value: any` en la interfaz AtlasHorizonDB (DBSchema). Mide TIPADO ' +
      'REAL, no presencia: baja al endurecer cada store a su tipo de dominio.',
    calibracion: {
      fecha: '2026-07-19',
      anterior: 0,
      nueva: untyped.length,
      motivo:
        'presencia-en-interfaz → tipado real (value: any). Tras Fase 0 las 45 claves ' +
        'existen (presencia daba 0 e inútil); ahora mide cuántos value siguen en any. ' +
        'Ampliación libre autorizada por Jose · sube porque mide algo más estricto.',
    },
  };
}

/**
 * INDICADOR 3 · lecturas_store_inexistente
 * Lecturas (get/getAll/getFromIndex/getAllFromIndex/count) sobre un store
 * "fantasma" (declarado en la interfaz pero sin `createObjectStore`) que
 * podrían lanzar `NotFoundError` en runtime:
 *   CUENTA  · llamada `.getAll('X')` etc. en producción con X ∈ stores_fantasma
 *             cuyo archivo NO contiene un guard `objectStoreNames.contains('X')`
 *             para EL MISMO store X
 *   EXCLUYE · tests
 *   EXCLUYE · lecturas GUARDADAS: si el archivo comprueba la existencia del
 *             mismo store con `db.objectStoreNames.contains('X')`, `getAll('X')`
 *             NO puede lanzar NotFoundError → no cuenta.
 *   EXCLUYE · `.get('X')` sobre Maps/keyval/refs (X no es un store fantasma)
 * El guard se empareja POR NOMBRE de store, no por proximidad: un
 * `contains('Y')` NO exime un `getAll('X')` (sería un agujero nuevo).
 *
 * RECALIBRACIÓN 2026-07-18 · anterior = 2 · nueva = 0. La definición vieja
 * contaba lecturas guardadas (imposibles de lanzar NotFoundError). El hallazgo
 * nº 2 de la auditoría (`migracionGastosService.ts:29,142`) fue un falso
 * positivo de grep: los guards `objectStoreNames.contains(...)` existen desde
 * antes de `f97122b`. Autorizada por Jose ANTES de la tarea (no hay bug que
 * tapar). Ver GOBERNANZA DE RECALIBRACIÓN.
 */
function lecturasStoreInexistente() {
  const fantasma = new Set(storesFantasma().detail);
  // AMPLIADO (auditoría puntos ciegos): además de get/getAll/…, ahora también
  // accesos vía `transaction('X')` / `transaction(['X'])` y `objectStore('X')`
  // (abrir una transacción/objectStore sobre un store inexistente TAMBIÉN lanza
  // NotFoundError). RESIDUO conocido: el nombre del store en una VARIABLE
  // (`const S='fiscalSummaries'; db.getAll(S)`) sigue sin verse.
  const readRe = /\.(get|getAll|getAllFromIndex|getFromIndex|count|objectStore)\((['"])([a-zA-Z0-9_]+)\2/g;
  // transaction acepta 1 store o un ARRAY multi-store: `transaction(['a','b'])`.
  // Se captura el argumento y se extraen TODOS los literales (no solo el 1º).
  const txRe = /\.transaction\(\s*(\[[^\]]*\]|['"][a-zA-Z0-9_]+['"])/g;
  const litRe = /['"]([a-zA-Z0-9_]+)['"]/g;
  const guardedFor = (src, store) =>
    new RegExp(`objectStoreNames\\.contains\\((['"])${store}\\1\\)`).test(src);
  const hits = [];
  for (const f of prodFiles(['.ts', '.tsx'])) {
    const src = read(f);
    let m;
    while ((m = readRe.exec(src))) {
      const store = m[3];
      if (fantasma.has(store) && !guardedFor(src, store)) {
        hits.push(`${rel(f)} · ${m[1]}('${store}')`);
      }
    }
    while ((m = txRe.exec(src))) {
      let sm;
      const litScan = new RegExp(litRe.source, 'g');
      while ((sm = litScan.exec(m[1]))) {
        const store = sm[1];
        if (fantasma.has(store) && !guardedFor(src, store)) {
          hits.push(`${rel(f)} · transaction('${store}')`);
        }
      }
    }
  }
  return {
    value: hits.length,
    detail: hits,
    calibracion: {
      fecha: '2026-07-18',
      anterior: 2,
      nueva: hits.length,
      motivo:
        'la definición contaba lecturas guardadas, que no pueden lanzar ' +
        'NotFoundError · autorizada por Jose antes de la tarea · no hay bug que tapar',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Servicios
// ─────────────────────────────────────────────────────────────────────────

/**
 * INDICADOR 4 · servicios_muertos · DETECCIÓN POR ALCANZABILIDAD TRANSITIVA
 * (TAREA-CC-DETECTOR-MUERTE-TRANSITIVA · Adenda 2 · raíces ESTRICTAS · 2026-07-19)
 *
 * ANTES (importadores directos · bloque 3): un módulo con ≥1 importador se
 * contaba VIVO, aunque ese importador fuera él mismo inalcanzable. Punto ciego
 * demostrado: el árbol muerto TesoreriaV4 → HistoricoWizard → historical{Cashflow,
 * Treasury} pasaba como vivo porque HistoricoWizard los importa — pero a
 * HistoricoWizard solo lo alcanza TesoreriaV4, que NO está enrutado. También ese
 * método daba por vivo a `optimizedDbService` "porque lo usa un script npm": falso,
 * lo importa solo `completeDataCleanup.ts`, huérfano (npm corre el `.js`).
 *
 * AHORA (grafo de alcanzabilidad · scripts/lib/deadcode.mjs): un módulo está VIVO
 * solo si hay un camino de imports desde una RAÍZ ejecutable. Raíz = EVIDENCIA de
 * ejecución (Adenda 2 · estricto · NUNCA por convención/homonimia/shebang):
 *   1. app-entry        · src/index.tsx (entry fijo react-scripts)
 *   2. netlify-function · functions/*.ts que exporta handler (netlify.toml)
 *   3. npm-script       · fichero referenciado en package.json > scripts
 * Categorías: alive · solo_tests (§4) · solo_stories · indeterminado (§3 · import()
 * NO literal · hoy 0) · dead. `import()`/`React.lazy` con string literal SÍ se
 * resuelven (rutas del router incluidas).
 *
 * CUENTA · los `dead`: módulos de src/·functions/·scripts/ (no test/story, no
 * `.d.ts`) inalcanzables desde CUALQUIER raíz. No solo servicios: componentes,
 * hooks y utilidades muertas también cuentan (§1 de la tarea).
 *
 * AMPLIACIÓN (autorizada · amplía la búsqueda de problemas): el número SUBE de 0 a
 * N porque aflora deuda antes invisible (árboles muertos completos), NO por una
 * regresión. Exención transitoria en AMPLIACIONES (antes:0) · se desactiva sola
 * cuando main incorpora el nuevo baseline. NO se borra nada aquí (§8): detecta,
 * no limpia. El borrado es tarea posterior, con la lista delante.
 */
function serviciosMuertos() {
  const g = analyzeReachability(ROOT);
  return {
    value: g.counts.dead,
    detail: g.dead,
    note:
      `grafo de alcanzabilidad desde ${g.roots.length} raíces estrictas · ` +
      `alive ${g.counts.alive} · dead ${g.counts.dead} · solo_tests ${g.counts.solo_tests} · ` +
      `solo_stories ${g.counts.solo_stories} · indeterminado ${g.counts.indeterminado}. ` +
      `Un módulo es muerto si NINGÚN camino de imports lo alcanza desde una raíz ` +
      `(app-entry · netlify · npm script). Antes se miraban importadores directos ` +
      `(ciego a muerte transitiva). Ver scripts/lib/deadcode.mjs.`,
    calibracion: {
      fecha: '2026-07-19',
      anterior: 0,
      nueva: g.counts.dead,
      motivo:
        'importadores-directos → grafo de alcanzabilidad transitiva (Adenda 2 · ' +
        'raíces estrictas por evidencia). Amplía la búsqueda: aflora deuda muerta ' +
        'antes invisible (árboles muertos completos, no solo hojas). No borra nada.',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Rutas y navegación (reconstrucción del árbol de <Route> de App.tsx)
// ─────────────────────────────────────────────────────────────────────────

/** Reconstruye las rutas absolutas registradas a partir del árbol JSX. */
function parseRoutes() {
  const src = APP_SRC;
  const routes = [];
  const stack = [];
  const events = [];
  for (const m of src.matchAll(/<Route\b/g)) events.push({ pos: m.index, type: 'open' });
  for (const m of src.matchAll(/<\/Route>/g)) events.push({ pos: m.index, type: 'close' });
  events.sort((a, b) => a.pos - b.pos);
  for (const ev of events) {
    if (ev.type === 'close') {
      if (stack.length) stack.pop();
      continue;
    }
    // Leer la etiqueta hasta su '>' de cierre (respetando llaves y strings)
    let j = ev.pos + 5;
    let depth = 0;
    let inStr = null;
    let selfClose = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (inStr) {
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        inStr = c;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) {
        selfClose = src[j - 1] === '/';
        break;
      }
    }
    const tag = src.slice(ev.pos, j + 1);
    const pm = tag.match(/\bpath=("([^"]*)"|'([^']*)'|\{`([^`]*)`\})/);
    const isIndex = /\bindex\b/.test(tag) && !pm;
    const p = pm ? pm[2] ?? pm[3] ?? pm[4] : null;
    let full;
    if (isIndex) full = '/' + stack.join('/');
    else if (p == null) full = null;
    else if (p.startsWith('/')) full = p;
    else full = '/' + [...stack, p].join('/');
    if (full) {
      full = full.replace(/\/+/g, '/');
      if (full.length > 1) full = full.replace(/\/$/, '');
      routes.push(full);
    }
    if (!selfClose && p != null && p !== '*') stack.push(p.replace(/^\//, ''));
  }
  // Excluye el catch-all raíz ('*' / '/*'): su función es ABSORBER lo no
  // registrado (→ /panel). Los splats anidados (/empezar/*, /dev/*) SÍ son
  // manejadores reales y se conservan.
  return [...new Set(routes)].filter((r) => r && r !== '*' && r !== '/*');
}

const REGISTERED = parseRoutes();
const ROUTE_SEGS = REGISTERED.map((r) => r.split('/').filter(Boolean));

/**
 * ¿Algún route registrado sirve estos segmentos de destino?
 * Emparejamiento con comodines SIMÉTRICO: un segmento `:param` del route, un
 * splat `*` final, o un segmento COMPUTADO del destino (`${var}`) casan con
 * cualquier valor. Así un destino calculado no se marca roto por no poder
 * resolverse estáticamente (se le da el beneficio de la duda contra rutas
 * hermanas del mismo patrón).
 */
function routeServes(dSegs) {
  return ROUTE_SEGS.some((rs) => {
    const splat = rs[rs.length - 1] === '*';
    const rlen = splat ? rs.length - 1 : rs.length;
    if (splat) {
      if (dSegs.length < rlen) return false;
    } else if (dSegs.length !== rs.length) return false;
    for (let i = 0; i < rlen; i++) {
      const r = rs[i];
      const d = dSegs[i];
      if (!d) return false;
      if (r.startsWith(':') || d.c) continue; // comodín en cualquier lado
      if (r !== d.v) return false;
    }
    return true;
  });
}

/** Recolecta destinos de navegación estáticos (navigate/to/href) en producción. */
function navDestinations() {
  const dests = new Map(); // key → {segs, files:Set}
  // AMPLIADO (auditoría puntos ciegos): antes solo `navigate(`/`to=`/`href=`.
  // Ahora también `onNavigate(` (callback · N mayúscula, invisible al viejo
  // regex), `window.location.href=/assign/replace`. `Link`/`NavLink to=` ya
  // los cubría `to=`. RESIDUO conocido: `navigate(variable)` / `onNavigate(var)`
  // con la ruta en una constante (no literal) sigue sin verse.
  const PREFIX =
    "(?:navigate\\(\\s*|onNavigate\\(\\s*|\\bto=|\\bhref=|window\\.location\\.(?:href\\s*=|assign\\(|replace\\())\\{?\\s*";
  const litRe = new RegExp(PREFIX + "(['\"])(\\/[^'\"]*)\\1(\\s*\\+)?", 'g');
  const tplRe = new RegExp(PREFIX + '`(\\/[^`]*)`', 'g');
  const ASSET = /\.(md|html|pdf|png|jpe?g|svg|json|csv|txt|xml|ico)$/i;
  const add = (segs, f) => {
    if (!segs.length) return;
    const key = '/' + segs.map((s) => (s.c ? ':p' : s.v)).join('/');
    const e = dests.get(key) || { segs, files: new Set() };
    e.files.add(rel(f));
    dests.set(key, e);
  };
  for (const f of prodFiles(['.ts', '.tsx'])) {
    const s = read(f);
    let m;
    while ((m = litRe.exec(s))) {
      let p = m[2].split(/[?#]/)[0];
      const concat = !!m[3];
      if (ASSET.test(p)) continue;
      if (concat || /\/$/.test(p)) {
        // concatenación (`'/x/' + v`): el segmento final es computado
        const segs = p
          .replace(/\/$/, '')
          .split('/')
          .filter(Boolean)
          .map((v) => ({ v }));
        segs.push({ c: true });
        add(segs, f);
      } else {
        add(
          p.split('/').filter(Boolean).map((v) => ({ v })),
          f
        );
      }
    }
    while ((m = tplRe.exec(s))) {
      const p = m[1].split(/[?#]/)[0];
      if (ASSET.test(p)) continue;
      const segs = p
        .split('/')
        .filter(Boolean)
        .map((v) => (/\$\{/.test(v) ? { c: true } : { v }));
      add(segs, f);
    }
  }
  return dests;
}

/**
 * INDICADOR 5 · rutas_huerfanas
 * Rutas registradas que renderizan una pantalla real (no redirect) y a las que
 * NADIE navega ni enlaza desde el menú:
 *   CUENTA  · route no-comodín cuyo elemento NO es `<Navigate>` y que ningún
 *             destino de navegación (ni entrada de navigation.ts) alcanza
 *   EXCLUYE · comodines · redirects · rutas /dev/* y /login /register
 * APROXIMADO · la auditoría lo estimó en ~18.
 */
function rutasHuerfanas() {
  const dests = navDestinations();
  const navKeys = [...dests.values()].map((e) => e.segs);
  const navConfig = read(path.join(SRC, 'config', 'navigation.ts'));
  // rutas que son redirect (elemento Navigate) — se detectan por su path en App
  const redirectPaths = new Set(
    [...APP_SRC.matchAll(/path=("([^"]*)"|'([^']*)')\s+element=\{<Navigate/g)].map(
      (m) => m[2] ?? m[3]
    )
  );
  const orphans = [];
  for (const r of REGISTERED) {
    if (r === '/' || /\/(login|register)$/.test(r)) continue;
    if (r.startsWith('/dev') || r.includes('*')) continue;
    const segs = r.split('/').filter(Boolean).map((v) => ({ v }));
    // ¿es un redirect? El path del redirect debe casar por SEGMENTO completo,
    // no por sufijo de cadena (si no, `/mi-documentacion` casaría con el
    // redirect `documentacion`). Se compara igualdad o sufijo con `/` delante.
    const isRedirect = [...redirectPaths].some((rp) => {
      const seg = rp.replace(/^\//, '');
      return r === '/' + seg || r.endsWith('/' + seg);
    });
    if (isRedirect) continue;
    const reached = navKeys.some((dSegs) => sameRoute(dSegs, segs)) ||
      navConfig.includes(`'${r}'`) || navConfig.includes(`"${r}"`);
    if (!reached) orphans.push(r);
  }
  return { value: orphans.length, detail: orphans, approx: true };
}

/** ¿Dos listas de segmentos describen la misma ruta (comodines simétricos)? */
function sameRoute(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.c || y.c || (x.v || '').startsWith(':') || (y.v || '').startsWith(':')) continue;
    if (x.v !== y.v) return false;
  }
  return true;
}

/**
 * INDICADOR 6 · enlaces_rotos
 * Destinos de navegación que NINGUNA ruta registrada puede servir (caen al
 * catch-all raíz → /panel):
 *   CUENTA  · destino `navigate('/x')` / `to="/x"` sin ruta que case
 *   EXCLUYE · tests · enlaces a assets (.md/.pdf/…) · el propio catch-all
 *   TRATA   · segmentos computados (`${var}`, concatenación) como comodín →
 *             no se marcan rotos si existe una ruta hermana del mismo patrón
 *   TRATA   · redirects (`<Navigate>`) como rutas que SÍ sirven el destino
 * CALIBRACIÓN (autorizada por Jose · opción 1 · estricta) · baseline = 8.
 * El "11" de la auditoría era una CIFRA MANUAL IMPRECISA, no una medición: su
 * propia prosa enumera solo 10 destinos, y 2 de ellos (/inmuebles/cartera/nuevo
 * y /inmuebles/cartera/:id) SÍ tienen ruta registrada (redirects a /inmuebles,
 * App.tsx:861) → bajo esta definición NO son enlaces rotos. Esos 2 casos NO
 * entran en este indicador, pero SÍ en la lista de arreglos del bloque 1 como
 * "pierden la intención del usuario · redirect catch-all". Los 8 que sí cuentan
 * son inequívocos (ver detail del JSON).
 */
function enlacesRotos() {
  const dests = navDestinations();
  const broken = [];
  for (const [key, e] of dests) {
    if (!routeServes(e.segs)) broken.push({ key, files: [...e.files].slice(0, 3) });
  }
  broken.sort((a, b) => a.key.localeCompare(b.key));
  return { value: broken.length, detail: broken.map((b) => `${b.key}  ← ${b.files[0]}`) };
}

// ─────────────────────────────────────────────────────────────────────────
// Guía de diseño V5
// ─────────────────────────────────────────────────────────────────────────

/**
 * INDICADOR 7 · hex_hardcoded
 * Colores escritos a mano fuera del archivo de tokens:
 *   CUENTA  · `#RRGGBB` (6 díg) · `#RGB` (3 díg) · `rgb()/rgba()/hsl()/hsla()`
 *             · tailwind arbitrario `[#…]` · en .ts/.tsx/.css de producción Y en
 *             `tailwind.config.js` (fuente de la paleta v4 legacy · auditoría)
 *   EXCLUYE · tests · `src/design-system/v5/tokens.css` (paleta canónica)
 * OBJETIVO · baja.
 *
 * AMPLIADO (auditoría puntos ciegos): antes SOLO `#RRGGBB` de 6 díg en src.
 * No veía 3 díg, funciones de color rgb/hsl, arbitrarios de tailwind, ni el
 * `tailwind.config.js`. Todo eso es color hardcoded igual. Al ampliar sube el
 * número → nuevo baseline (no regresión).
 */
function hexHardcoded() {
  const hex = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  const fn = /\b(?:rgba?|hsla?)\(/g;
  let count = 0;
  const files = walk(SRC, (p) => /\.(ts|tsx|css)$/.test(p) && !isTestPath(p));
  const twConfig = path.join(ROOT, 'tailwind.config.js');
  if (fs.existsSync(twConfig)) files.push(twConfig);
  for (const f of files) {
    if (rel(f) === TOKENS_FILE) continue;
    const src = read(f);
    count += (src.match(hex) || []).length;
    count += (src.match(fn) || []).length;
  }
  return { value: count };
}

/**
 * INDICADOR 8 · emojis_ui
 * Emojis en componentes `.tsx` de pantalla (producción):
 *   CUENTA  · caracteres en rangos emoji Unicode en .tsx no test
 *   EXCLUYE · tests · .ts (ver nota)
 * OBJETIVO · baja.
 * NO AMPLIADO A .ts (decisión de la auditoría de puntos ciegos): los .ts
 * contienen 122 caracteres de rango emoji, pero concentrados en SERVICIOS
 * (logs, comentarios, constantes de `treasuryCreationService`, `ocrService`,
 * `config/envFlags`…), NO en UI de pantalla. Ampliar a todo `.ts` haría DERIVAR
 * el significado ("emojis de pantalla" → "cualquier emoji en TS") y metería
 * ruido. Distinguir "string de UI" dentro de un servicio no es mecanizable
 * limpio → se deja como hallazgo, no se amplía. RESIDUO: `content:` CSS y
 * `\uXXXX` escapado tampoco se cuentan.
 */
function emojisUi() {
  // Rangos emoji frecuentes (pictográficos, símbolos, dingbats, banderas)
  const re =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F0FF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;
  let count = 0;
  for (const f of walk(SRC, (p) => p.endsWith('.tsx') && !isTestPath(p))) {
    const m = read(f).match(re);
    if (m) count += m.length;
  }
  return { value: count };
}

/**
 * INDICADOR 9 · iconos_no_lucide
 * Imports de librerías de iconos distintas de `lucide-react`:
 *   CUENTA  · imports de @heroicons / react-icons / @mui/icons / @fortawesome /
 *             feather / react-feather en producción
 *   EXCLUYE · tests · lucide-react (permitido)
 * OBJETIVO · 0.
 */
function iconosNoLucide() {
  const re = /from\s+['"](@heroicons|react-icons|@mui\/icons|@fortawesome|feather|react-feather)/;
  const hits = [];
  for (const f of prodFiles(['.ts', '.tsx'])) {
    if (re.test(read(f))) hits.push(rel(f));
  }
  return { value: hits.length, detail: hits };
}

/**
 * INDICADOR 10 · kpis_hardcoded
 * Placeholders vivos `TODO: conectar` que acompañan a un valor RENDERIZADO:
 *   CUENTA  · línea con `TODO … conectar` que sea comentario de línea `//`
 *             o comentario JSX inline `{/* … *​/}` (grupo A: 4 tarjetas KPI del
 *             Panel · grupo B: 5 placeholders vivos en otros widgets/módulos)
 *   EXCLUYE · tests
 *   EXCLUYE · líneas dentro de un bloque JSDoc/`/* … *​/` (grupo C: 8 menciones
 *             en cabeceras de componente o prop) — se detectan porque su
 *             contenido, tras `trim()`, empieza por `*` o `/*`. Describen la
 *             intención en documentación, no son un KPI distinto en pantalla.
 *   NO restringe por archivo · si mañana aparece un placeholder vivo en otro
 *             módulo, DEBE contar.
 * OBJETIVO · 0.
 *
 * RECALIBRACIÓN 2026-07-18 · definición ANTERIOR = 17 (toda línea "TODO
 * conectar", incluidas cabeceras JSDoc) · NUEVA = 9 (solo placeholders vivos,
 * A+B). Motivo: la definición vieja mezclaba documentación con KPIs vivos e
 * inflaba el indicador. Autorizada por Jose ANTES de cualquier tarea de
 * arreglo (ver GOBERNANZA DE RECALIBRACIÓN más abajo).
 *
 * LIMITACIÓN CONOCIDA (auditoría puntos ciegos · confirmada, NO ampliable):
 * el PEOR caso — un número clavado en una tarjeta SIN comentario `TODO`
 * (`1.284 €` inventado, sin origen en props/estado) — es INVISIBLE a este
 * indicador y NO es mecanizable limpio (buscar literales de importe/porcentaje
 * daría un ruido enorme: fechas, cálculos, IDs, ejemplos). Decisión de Jose:
 * NO se amplía con una regla ruidosa. Se resolverá por REVISIÓN MANUAL de las
 * tarjetas KPI dentro del rediseño del Panel. Este `9` mide solo los
 * placeholders que llevan `TODO`.
 */
function kpisHardcoded() {
  const re = /TODO:?\s*conectar/i;
  let count = 0;
  const detail = [];
  for (const f of walk(SRC, (p) => p.endsWith('.tsx') && !isTestPath(p))) {
    const lines = read(f).split('\n');
    lines.forEach((l, i) => {
      if (!re.test(l)) return;
      const t = l.trim();
      if (t.startsWith('*') || t.startsWith('/*')) return; // bloque JSDoc (grupo C)
      count++;
      if (detail.length < 20) detail.push(`${rel(f)}:${i + 1}`);
    });
  }
  return {
    value: count,
    detail,
    calibracion: {
      fecha: '2026-07-18',
      anterior: 17,
      nueva: count,
      motivo:
        'Definición A+B: solo placeholders vivos junto a un valor renderizado ' +
        '(comentarios // y JSX {/* */}); se excluyen las 8 menciones en ' +
        'cabeceras JSDoc /** */ (grupo C). Sin restricción por archivo.',
    },
  };
}

/**
 * INDICADOR 11 · todos_totales
 * Marcadores de deuda `TODO/FIXME/HACK/XXX` en src:
 *   CUENTA  · ocurrencias en .ts/.tsx/.css/.js/.cjs/.mjs de producción
 *   EXCLUYE · tests
 * OBJETIVO · baja.
 * AMPLIADO (auditoría puntos ciegos): antes .ts/.tsx/.css · ahora también
 * .js/.cjs/.mjs (había marcadores potenciales en archivos JS sueltos de src).
 */
function todosTotales() {
  const re = /\b(TODO|FIXME|HACK|XXX)\b/g;
  let count = 0;
  for (const f of walk(SRC, (p) => /\.(ts|tsx|css|js|cjs|mjs)$/.test(p) && !isTestPath(p))) {
    const m = read(f).match(re);
    if (m) count += m.length;
  }
  return { value: count };
}

/**
 * INDICADOR 12 · archivos_800
 * Archivos de código de más de 800 líneas (candidatos a trocear):
 *   CUENTA  · .ts/.tsx/.css/.js de producción con > 800 líneas
 *   EXCLUYE · tests · .json
 * OBJETIVO · baja.
 * AMPLIADO (auditoría puntos ciegos): antes solo .ts/.tsx · ahora también .css
 * y .js (había CSS grandes que no se veían).
 */
function archivos800() {
  const big = [];
  for (const f of walk(SRC, (p) => /\.(ts|tsx|css|js)$/.test(p) && !isTestPath(p))) {
    const n = read(f).split('\n').length;
    if (n > 800) big.push({ f: rel(f), n });
  }
  big.sort((a, b) => b.n - a.n);
  return { value: big.length, detail: big.slice(0, 15).map((b) => `${b.n} · ${b.f}`) };
}

/**
 * INDICADOR 13 · pct_v5  (ÚNICO que SUBE · trinquete invertido)
 * % de componentes .tsx de producción que importan el barrel `design-system/v5`:
 *   NUMERADOR   · .tsx no test que contienen `design-system/v5`
 *   DENOMINADOR · todos los .tsx no test
 * OBJETIVO · sube. La auditoría midió 23,5 % (137/583).
 */
function pctV5() {
  // AMPLIADO (auditoría puntos ciegos): antes solo `import '…/design-system/v5'`.
  // Ahora también consumo INDIRECTO vía un `.module.css` que usa tokens v5
  // (`var(--atlas-v5-*)`) — señal fiable del prefijo canónico de tokens.css.
  // Es indicador que SUBE; ampliarlo cuenta más consumidores reales → sube el %.
  // Correlación por RUTA RESUELTA (no por basename · hay basenames duplicados
  // como PanelPage.module.css en dos carpetas): se resuelve el import relativo
  // contra la carpeta del .tsx y se comprueba ESE archivo exacto.
  const v5Modules = new Set(); // rutas absolutas de .module.css que usan v5
  for (const f of walk(SRC, (p) => p.endsWith('.module.css') && !isTestPath(p))) {
    if (/var\(--atlas-v5-/.test(read(f))) v5Modules.add(path.resolve(f));
  }
  const tsx = walk(SRC, (p) => p.endsWith('.tsx') && !isTestPath(p));
  const withV5 = tsx.filter((f) => {
    const src = read(f);
    if (/design-system\/v5/.test(src)) return true;
    const imports = [...src.matchAll(/from\s+['"]([^'"]+\.module\.css)['"]/g)].map((m) => m[1]);
    return imports.some(
      (imp) => imp.startsWith('.') && v5Modules.has(path.resolve(path.dirname(f), imp))
    );
  });
  const pct = tsx.length ? (withV5.length / tsx.length) * 100 : 0;
  return {
    value: Math.round(pct * 10) / 10,
    detail: [`${withV5.length} / ${tsx.length} (directo o vía .module.css con var(--atlas-v5-*))`],
  };
}

/**
 * INDICADOR 14 · prs_abiertos
 * PRs abiertos sin mergear.
 *   MODO CI · con `GITHUB_TOKEN` + `GITHUB_REPOSITORY` (los pone GitHub Actions)
 *             cuenta los PRs `state=open` vía la API, paginando. Requiere que el
 *             workflow declare `permissions: pull-requests: read`.
 *   LOCAL · sin token → NO MEDIBLE (nunca 0).
 * El token NO se interpola en la cadena: se expande en el shell desde el env.
 * NOTA · es estado EXTERNO y variable en el tiempo (no código); su baseline no
 * se congela desde una medición de repo · ver informe.
 */
function prsAbiertos() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // "owner/repo" · lo pone Actions
  if (!token || !repo) {
    return { value: null, note: 'NO MEDIBLE · sin GITHUB_TOKEN/GH_TOKEN + GITHUB_REPOSITORY (modo CI)' };
  }
  // Normaliza: el curl usa `$GITHUB_TOKEN`, así que se inyecta el token resuelto
  // en el env (funciona aunque solo estuviera GH_TOKEN).
  const env = { ...process.env, GITHUB_TOKEN: token };
  try {
    let page = 1;
    let total = 0;
    for (;;) {
      const out = execSync(
        'curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" ' +
          '-H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" ' +
          `"https://api.github.com/repos/${repo}/pulls?state=open&per_page=100&page=${page}"`,
        { env, stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000, maxBuffer: 32 * 1024 * 1024 }
      ).toString();
      const arr = JSON.parse(out);
      // Un error de la API (rate limit/permisos) devuelve un OBJETO, no un array:
      // eso es NO MEDIBLE, nunca un 0 medido.
      if (!Array.isArray(arr)) {
        const msg = arr && arr.message ? arr.message : 'respuesta no-array';
        return { value: null, note: 'NO MEDIBLE · API GitHub: ' + msg };
      }
      if (arr.length === 0) break;
      total += arr.length;
      if (arr.length < 100 || page >= 50) break;
      page++;
    }
    return { value: total, note: 'medido vía API GitHub (CI)' };
  } catch (e) {
    return { value: null, note: 'NO MEDIBLE · error API GitHub: ' + e.message };
  }
}

/**
 * INDICADOR 15 · tests_rojos
 * Suites de test en rojo (Test Suites failed).
 *   MODO CI · con `npm run health:ci` (--with-tests) Y `node_modules` presente,
 *             ejecuta `react-scripts test` en modo CI y cuenta suites en rojo.
 *   POR DEFECTO · `npm run health` NO ejecuta la suite (marcador barato) →
 *             NO MEDIBLE. Sin `node_modules` → NO MEDIBLE (nunca 0).
 * El script NUNCA instala dependencias (§6): la instalación va fuera (CI).
 * NOTA · el camino que ejecuta jest se ejercita en CI (donde hay deps); en un
 * entorno sin node_modules solo se ejercita el camino NO MEDIBLE.
 */
function testsRojos() {
  const hasNodeModules = fs.existsSync(path.join(ROOT, 'node_modules'));
  if (!hasNodeModules) {
    return { value: null, note: 'NO MEDIBLE · sin node_modules (jest no disponible)' };
  }
  if (!WITH_TESTS) {
    return {
      value: null,
      note: 'NO MEDIBLE · usa `npm run health:ci` (--with-tests) para ejecutar la suite',
    };
  }
  let out;
  try {
    out = execSync('npx --no-install react-scripts test --watchAll=false 2>&1', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20 * 60 * 1000, // corta cuelgues: 20 min
      maxBuffer: 128 * 1024 * 1024, // la salida de 313 suites supera 1 MB (default)
      env: { ...process.env, CI: 'true' },
    }).toString();
  } catch (e) {
    // jest sale con código != 0 cuando hay tests en rojo: NO es un fallo de
    // medición · su salida trae el resumen "Test Suites: X failed".
    out =
      ((e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '')).trim();
    if (!out) {
      return { value: null, note: 'NO MEDIBLE · runner sin salida (¿timeout/cuelgue?): ' + e.message };
    }
  }
  const failed = out.match(/Test Suites:[^\n]*?(\d+)\s+failed/);
  if (failed) return { value: Number(failed[1]), note: 'medido vía react-scripts test (CI)' };
  if (/Test Suites:[^\n]*\d+\s+passed/.test(out)) {
    return { value: 0, note: 'medido vía react-scripts test (CI) · todas verdes' };
  }
  return { value: null, note: 'NO MEDIBLE · no se pudo parsear el resumen de jest' };
}

/**
 * INDICADOR 16 · ccaa_no_verificadas
 * Escalas autonómicas marcadas `verified: false` (sin auditar):
 *   CUENTA  · ocurrencias de `verified: false` bajo services/fiscal/ccaaRules
 *   EXCLUYE · tests
 * OBJETIVO · 0 (~13 en la auditoría, por CCAA · aquí se cuentan ocurrencias).
 */
function ccaaNoVerificadas() {
  const dir = path.join(SRC, 'services', 'fiscal', 'ccaaRules');
  let count = 0;
  const files = new Set();
  for (const f of walk(dir, (p) => p.endsWith('.ts') && !isTestPath(p))) {
    const m = read(f).match(/verified\s*:\s*false/g);
    if (m) {
      count += m.length;
      files.add(rel(f));
    }
  }
  return { value: count, detail: [`${files.size} archivos CCAA con verified:false`] };
}

// ─────────────────────────────────────────────────────────────────────────
// Definición del marcador
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// GOBERNANZA DE RECALIBRACIÓN
// ─────────────────────────────────────────────────────────────────────────
// La DEFINICIÓN de un indicador (qué cuenta / qué excluye) SOLO puede cambiarse
// ANTES de lanzar una tarea de arreglo, NUNCA durante. Si se pudiera recalibrar
// a mitad de un arreglo, el trinquete sería burlable: bastaría relajar la regla
// para que un indicador "bajara" sin tocar el código. Toda recalibración:
//   1. la autoriza Jose explícitamente, antes de la tarea;
//   2. queda registrada (anterior · nueva · fecha · motivo) en el campo
//      `calibracion` del indicador y se agrega a `recalibraciones` del JSON;
//   3. se documenta en el docstring del indicador.
//
// REGLA ASIMÉTRICA (autorizada por Jose · 2026-07-18):
//   · AMPLIAR una definición (capturar MÁS casos · p. ej. que enlaces_rotos
//     también vea `onNavigate(`, rutas en variables, template strings, Link
//     to=, href dinámicos) está SIEMPRE permitido y es deseable · NO requiere
//     autorización. Si al ampliar el número sube, ese es el NUEVO BASELINE, no
//     una regresión (el punto ciego ya existía, solo ahora se mide).
//   · ESTRECHAR una definición (capturar MENOS casos) requiere autorización
//     explícita de Jose y queda registrada en `recalibraciones`.
// Así el sistema nunca puede usarse para ESCONDER, solo para DESCUBRIR.
const GOBERNANZA_RECALIBRACION =
  'Recalibrar solo ANTES de una tarea, nunca durante. AMPLIAR (capturar más) ' +
  'siempre permitido y deseable, sin autorización (si sube, es el nuevo ' +
  'baseline, no regresión). ESTRECHAR (capturar menos) requiere autorización ' +
  'explícita de Jose y registro. El sistema descubre, no esconde.';

// ─────────────────────────────────────────────────────────────────────────
// AMPLIACIONES DE DEFINICIÓN (auditoría de puntos ciegos · 2026-07-18)
// ─────────────────────────────────────────────────────────────────────────
// Al ampliar una definición el número puede SUBIR (se mide lo que antes era
// invisible). Por gobernanza eso es el NUEVO BASELINE, no una regresión. Para
// que el trinquete no falle en falso EN LA TRANSICIÓN, cada entrada exime a su
// indicador de la subida SOLO mientras el baseline previo siga siendo el valor
// `antes` (pre-ampliación). En cuanto `main` incorpora el nuevo número, `antes`
// deja de coincidir y la exención SE DESACTIVA SOLA — no oculta subidas futuras
// (eso sería esconder, prohibido). Solo se listan las que suben en dirección de
// empeoramiento; las que bajan (rutas_huerfanas) o suben siendo 'up' (pct_v5)
// no necesitan exención.
const AMPLIACIONES = {
  enlaces_rotos: { antes: 0, motivo: 've onNavigate( y window.location' },
  hex_hardcoded: { antes: 974, motivo: 've #RGB, rgb()/hsl(), tailwind [#], tailwind.config.js' },
  archivos_800: { antes: 49, motivo: 've .css y .js' },
  servicios_muertos: {
    antes: 0,
    motivo:
      'importadores-directos → grafo de alcanzabilidad transitiva (raíces estrictas) · ' +
      'aflora deuda muerta antes invisible',
  },
  rutas_huerfanas: {
    antes: 19,
    motivo:
      'barrido de código muerto · /configuracion/preferencias-datos era alcanzable ' +
      'SOLO desde el KPIsBlock muerto (deep-link «configurar KPIs», borrado) · ' +
      'huérfano PREEXISTENTE que el código muerto tapaba, no una regresión · ' +
      'autorizado por Jose · pantalla marcada como pieza a re-conectar',
  },
  stores_no_tipados: {
    antes: 0,
    motivo:
      'nueva definición · presencia-en-interfaz → tipado real (value: any). Tras Fase 0 ' +
      'la presencia daba 0; ahora mide cuántos value siguen en any (35). Ampliación libre.',
  },
};

// direction: 'down' = mejor bajar (empeora si sube) · 'up' = mejor subir
const INDICATORS = [
  { key: 'stores_fantasma', dir: 'down', obj: 0, fn: storesFantasma },
  { key: 'stores_no_tipados', dir: 'down', obj: 0, fn: storesNoTipados },
  { key: 'lecturas_store_inexistente', dir: 'down', obj: 0, fn: lecturasStoreInexistente },
  { key: 'servicios_muertos', dir: 'down', obj: 0, fn: serviciosMuertos },
  { key: 'rutas_huerfanas', dir: 'down', obj: null, fn: rutasHuerfanas },
  { key: 'enlaces_rotos', dir: 'down', obj: 0, fn: enlacesRotos },
  { key: 'hex_hardcoded', dir: 'down', obj: null, fn: hexHardcoded },
  { key: 'emojis_ui', dir: 'down', obj: null, fn: emojisUi },
  { key: 'iconos_no_lucide', dir: 'down', obj: 0, fn: iconosNoLucide },
  { key: 'kpis_hardcoded', dir: 'down', obj: 0, fn: kpisHardcoded },
  { key: 'todos_totales', dir: 'down', obj: null, fn: todosTotales },
  { key: 'archivos_800', dir: 'down', obj: null, fn: archivos800 },
  { key: 'pct_v5', dir: 'up', obj: null, fn: pctV5 },
  { key: 'prs_abiertos', dir: 'down', obj: 0, fn: prsAbiertos },
  { key: 'tests_rojos', dir: 'down', obj: 0, fn: testsRojos },
  { key: 'ccaa_no_verificadas', dir: 'down', obj: 0, fn: ccaaNoVerificadas },
];

// ─────────────────────────────────────────────────────────────────────────
// Ejecución, comparación y salida
// ─────────────────────────────────────────────────────────────────────────

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function gitInfo() {
  const run = (cmd) => {
    try {
      return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      return null;
    }
  };
  return { branch: run('git rev-parse --abbrev-ref HEAD'), head: run('git rev-parse --short HEAD') };
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Busca el JSON de salud anterior más reciente (distinto del de hoy). */
function previousReport(todayFile) {
  if (!fs.existsSync(HEALTH_DIR)) return null;
  const files = fs
    .readdirSync(HEALTH_DIR)
    .filter((f) => /^HEALTH-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const prior = files.filter((f) => path.join(HEALTH_DIR, f) !== todayFile);
  if (!prior.length) return null;
  try {
    return { report: JSON.parse(read(path.join(HEALTH_DIR, prior[prior.length - 1]))), source: `local:${prior[prior.length - 1]}` };
  } catch {
    return null;
  }
}

/**
 * Baseline del trinquete tomado de un ref de git (la rama destino en CI).
 * Lee el HEALTH-*.json commiteado más reciente en `ref` (p. ej. origin/main).
 * Así, en un PR del mismo día, se compara contra lo que ya está en main —no
 * contra la foto de hoy, que se excluiría por fecha—. Solo lectura de git.
 */
function baselineFromRef(ref) {
  const git = (cmd) =>
    execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  // Best-effort: asegurar el ref remoto (en CI con fetch-depth:0 ya está).
  try {
    execSync(`git fetch --depth=1 origin ${ref.replace(/^origin\//, '')}`, {
      cwd: ROOT,
      stdio: 'ignore',
    });
  } catch {
    /* ref local o sin red: se intenta ls-tree igualmente */
  }
  let list;
  try {
    list = git(`git ls-tree --name-only ${ref} docs/health/`);
  } catch {
    return null;
  }
  const files = list
    .trim()
    .split('\n')
    .filter((f) => /HEALTH-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!files.length) return null;
  const latest = files[files.length - 1];
  try {
    return { report: JSON.parse(git(`git show ${ref}:${latest}`)), source: `${ref}:${latest}` };
  } catch {
    return null;
  }
}

function measure() {
  const indicators = {};
  for (const ind of INDICATORS) {
    let res;
    try {
      res = ind.fn();
    } catch (e) {
      res = { value: null, note: 'ERROR: ' + e.message };
    }
    indicators[ind.key] = {
      value: res.value,
      direction: ind.dir,
      objetivo: ind.obj,
      measurable: res.value !== null,
      approx: res.approx || false,
      note: res.note || null,
      detail: res.detail || null,
      calibracion: res.calibracion || null,
    };
  }
  return indicators;
}

/** Compara y decide si un indicador EMPEORÓ respecto al previo. */
function worsened(key, dir, prev, cur) {
  if (prev == null || cur == null) return false;
  const empeora = dir === 'up' ? cur < prev : cur > prev;
  if (!empeora) return false;
  // Exención de AMPLIACIÓN, auto-desactivable: si el baseline previo es aún el
  // valor pre-ampliación, la subida es la ampliación autorizada (nuevo
  // baseline), no una regresión. Solo aplica en la transición.
  const amp = AMPLIACIONES[key];
  if (amp && prev === amp.antes) return false;
  return empeora;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--regresion')) return regresion();

  const date = todayISO();
  const outFile = path.join(HEALTH_DIR, `HEALTH-${date}.json`);
  const indicators = measure();
  // Fuente del "antes": en CI, el baseline commiteado en la rama destino
  // (main); en local, el JSON de fecha anterior más reciente.
  const prevWrap = CI_BASELINE ? baselineFromRef(BASELINE_REF) : previousReport(outFile);
  const prev = prevWrap ? prevWrap.report : null;
  const prevSource = prevWrap ? prevWrap.source : null;

  const recalibraciones = INDICATORS.filter((i) => indicators[i.key].calibracion).map((i) => ({
    indicador: i.key,
    ...indicators[i.key].calibracion,
  }));

  const report = {
    protocolo: 'GARANTIA-ATLAS-v1',
    schema: 1,
    date,
    generatedAt: new Date().toISOString(),
    git: gitInfo(),
    gobernanza: GOBERNANZA_RECALIBRACION,
    recalibraciones,
    ampliaciones: Object.entries(AMPLIACIONES).map(([indicador, a]) => ({
      indicador,
      antes: a.antes,
      despues: indicators[indicador]?.value ?? null,
      motivo: a.motivo,
      exencion: 'transitoria · se desactiva cuando main incorpora el nuevo baseline',
    })),
    indicators,
  };

  // Tabla
  const W = 30;
  console.log('\n' + C.bold('MARCADOR DE SALUD · ATLAS') + C.gray(`  ·  ${date}`));
  console.log(C.gray(`git ${report.git.branch || '?'} @ ${report.git.head || '?'}`));
  console.log(
    C.gray(
      `baseline (antes): ${prevSource || '— (sin baseline previo)'}` +
        (CI_BASELINE ? '  [modo CI · contra rama destino]' : '  [modo local · por fecha]') +
        '\n'
    )
  );
  console.log(
    C.bold(
      'indicador'.padEnd(W) +
        'hoy'.padStart(9) +
        'antes'.padStart(9) +
        'Δ'.padStart(8) +
        '  objetivo'
    )
  );
  console.log(C.gray('─'.repeat(W + 9 + 9 + 8 + 12)));

  let anyWorse = false;
  for (const ind of INDICATORS) {
    const cur = indicators[ind.key];
    const p = prev?.indicators?.[ind.key];
    const prevVal = p ? p.value : null;
    const curStr = cur.value === null ? C.yellow('NO MEDIBLE') : String(cur.value);
    const prevStr = prevVal === null || prevVal === undefined ? C.gray('—') : String(prevVal);
    let deltaStr = C.gray('—');
    if (cur.value !== null && prevVal !== null && prevVal !== undefined) {
      const d = Math.round((cur.value - prevVal) * 10) / 10;
      if (d === 0) deltaStr = C.gray('0');
      else {
        const w = worsened(ind.key, ind.dir, prevVal, cur.value);
        const rawWorse = ind.dir === 'up' ? cur.value < prevVal : cur.value > prevVal;
        const exempt = rawWorse && !w; // subió pero es AMPLIACIÓN (nuevo baseline)
        const sign = d > 0 ? '+' : '';
        deltaStr = exempt
          ? C.yellow(sign + d + ' ⇧amp')
          : w
            ? C.red(sign + d + ' ▲')
            : C.green(sign + d);
        if (w) anyWorse = true;
      }
    }
    const objStr =
      ind.obj === null ? (ind.dir === 'up' ? 'sube' : 'baja') : String(ind.obj);
    const arrow = ind.dir === 'up' ? '↑' : '↓';
    const name = (ind.key + (cur.approx ? ' ~' : '')).padEnd(W);
    console.log(
      name +
        curStr.padStart(cur.value === null ? 18 : 9) +
        prevStr.padStart(prevVal === null || prevVal === undefined ? 18 : 9) +
        deltaStr.padStart(deltaStr === C.gray('—') ? 17 : 16) +
        `  ${arrow} ${objStr}`
    );
  }
  console.log(C.gray('─'.repeat(W + 9 + 9 + 8 + 12)));

  // Chequeo de calibración contra la auditoría 2026-07. Solo `stores_fantasma`
  // conserva la cifra de auditoría como medición exacta. `lecturas_store_
  // inexistente` y `enlaces_rotos` se recalibraron (autorizado por Jose,
  // registrado en `recalibraciones`): la auditoría los reportó a 2 y 11 pero
  // ambas eran cifras imprecisas (lecturas guardadas · redirects con ruta).
  const audit = { stores_fantasma: 4 };
  console.log('\n' + C.bold('Calibración vs auditoría 2026-07 (medición exacta):'));
  for (const [k, exp] of Object.entries(audit)) {
    const got = indicators[k].value;
    console.log(
      `  ${got === exp ? C.green('OK ') : C.yellow('≠  ')} ${k.padEnd(30)} medido=${got}  auditoría=${exp}`
    );
  }
  console.log(
    C.gray(
      `  ·   ${'lecturas_store_inexistente'.padEnd(30)} medido=${indicators.lecturas_store_inexistente.value}  ` +
        `· recalibrado 2→0 (auditoría contaba lecturas guardadas = falso positivo)`
    )
  );
  console.log(
    C.gray(
      `  ·   ${'enlaces_rotos'.padEnd(30)} medido=${indicators.enlaces_rotos.value}  ` +
        `· calibrado a 8 (auditoría manual 11 = imprecisa, no medición)`
    )
  );

  if (!args.includes('--no-write')) {
    fs.mkdirSync(HEALTH_DIR, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
    console.log('\n' + C.gray('escrito → ' + rel(outFile)));
  }

  if (anyWorse) {
    console.log('\n' + C.red('✗ TRINQUETE: al menos un indicador empeoró respecto al previo.'));
    process.exit(1);
  } else if (prev) {
    console.log('\n' + C.green('✓ Trinquete OK: ningún indicador empeoró.'));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Regresión · re-ejecuta ARREGLOS-CERTIFICADOS.md
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parsea docs/health/ARREGLOS-CERTIFICADOS.md y re-ejecuta cada comando de la
 * columna "Comando de verificación", comparando su salida con "Esperado".
 * Formato de fila esperado:
 *   | fecha | qué se arregló | `comando` | `esperado` |
 * El comando y el esperado van SIEMPRE entre backticks; se extraen como las dos
 * últimas secuencias `…` de la fila, NO partiendo por '|'. Así el comando puede
 * contener tuberías (`grep … | wc -l`) sin romper el parseo de la tabla.
 * Si algún comando no devuelve lo esperado, un arreglo antiguo se rompió.
 */
function regresion() {
  const file = path.join(HEALTH_DIR, 'ARREGLOS-CERTIFICADOS.md');
  if (!fs.existsSync(file)) {
    console.log(C.yellow('No existe ARREGLOS-CERTIFICADOS.md · nada que regresar.'));
    return;
  }
  const rows = [];
  for (const l of read(file).split('\n')) {
    if (!l.trim().startsWith('|')) continue;
    if (/^\s*\|\s*-+/.test(l)) continue; // separador de tabla
    if (/\|\s*Fecha\s*\|/.test(l)) continue; // cabecera
    const matches = [...l.matchAll(/`([^`]*)`/g)];
    if (matches.length < 2) continue; // fila sin comando+esperado (p. ej. nota)
    // Comando y esperado son SIEMPRE las dos ÚLTIMAS secuencias `…` de la fila.
    // `\|` en la celda (escape de tubería para que GitHub renderice la tabla)
    // se convierte en `|` real para el shell / grep -E.
    const cmd = matches[matches.length - 2][1].replace(/\\\|/g, '|').trim();
    const esperado = matches[matches.length - 1][1].replace(/\\\|/g, '|').trim();
    // "qué" = 2ª columna del texto ANTES de que empiece el comando (así el
    // inline code de "qué", p. ej. `fiscalSummaries`, no trunca el mensaje).
    const que = (l.slice(0, matches[matches.length - 2].index).split('|')[2] || '').trim();
    rows.push({ que, cmd, esperado });
  }

  if (!rows.length) {
    console.log(C.gray('Registro de arreglos vacío · 0 comandos que re-ejecutar. (OK)'));
    return;
  }

  console.log(C.bold(`\nREGRESIÓN · ${rows.length} arreglo(s) certificado(s)\n`));
  let failed = 0;
  for (const { que, cmd, esperado } of rows) {
    let out;
    try {
      out = execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
        .toString()
        .trim();
    } catch (e) {
      out = (e.stdout ? e.stdout.toString() : '').trim() || 'ERROR: ' + e.message;
    }
    const ok = out === esperado;
    if (!ok) failed++;
    console.log(
      `  ${ok ? C.green('OK ') : C.red('FAIL')}  ${que}\n` +
        C.gray(`       $ ${cmd}\n`) +
        C.gray(`       esperado: ${esperado}   ·   obtenido: ${out.replace(/\n/g, ' ')}`)
    );
  }
  console.log('');
  if (failed) {
    console.log(C.red(`✗ ${failed} arreglo(s) roto(s). Una regresión antigua ha reaparecido.`));
    process.exit(1);
  }
  console.log(C.green('✓ Todos los arreglos certificados siguen verdes.'));
}

main();
