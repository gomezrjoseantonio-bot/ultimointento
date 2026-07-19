#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// PRUEBA DE ACEPTACIÓN · detector de muerte transitiva (§5 · Adenda 2)
// ─────────────────────────────────────────────────────────────────────────
//
// Test EJECUTABLE (no comprobación manual). Fija el comportamiento del grafo
// contra casos verificados a mano. Sale != 0 si cualquier expectativa falla.
//
// Los dos criterios son IGUAL de obligatorios (§5): si el detector acierta los
// muertos pero da por muerto un vivo, la tarea NO cierra. `documentaiClient` es
// el único guardia contra un detector que solo persiga muertos.
//
// Uso: node scripts/deadcode-acceptance.mjs   (o npm run test:deadcode)

import { analyzeReachability } from './lib/deadcode.mjs';

const ROOT = process.cwd();
const g = analyzeReachability(ROOT);

// §5 (corregida por Adenda 2) · deben salir MUERTOS. Los 4 nodos del árbol muerto
// original (TesoreriaV4 · HistoricoWizard · historical{Cashflow,Treasury}) YA NO
// figuran aquí: se BORRARON en paletas-fase-1 tras confirmarlos muertos → pasan a
// MUST_BE_GONE. Quedan como muertos-estables las dos premisas del bloque 3 que se
// cayeron al verificarlas (no se borran sin decisión propia · ver DEADCODE report §7).
const MUST_BE_DEAD = [
  'scripts/completeDataCleanup.ts', // huérfano · npm corre el .js
  'src/services/optimizedDbService.ts', // solo lo importa completeDataCleanup.ts (muerto)
];

// §5 · deben seguir VIVOS (guardia anti "solo persigue muertos")
const MUST_BE_ALIVE = [
  'scripts/completeDataCleanup.js', // raíz: package.json scripts.cleanup:complete
  'src/services/documentaiClient.ts', // vía functions/ocr-fein.ts (handler Netlify)
];

// Árbol muerto BORRADO en paletas-fase-1 · el detector ya no debe verlos como nodos.
// (Documenta que la detección se actuó: de dead → not-a-node por borrado.)
const MUST_BE_GONE = [
  'src/components/treasury/TesoreriaV4.tsx',
  'src/modules/horizon/tesoreria/HistoricoWizard.tsx',
  'src/services/historicalCashflowCalculator.ts',
  'src/services/historicalTreasuryService.ts',
];

const fails = [];
for (const p of MUST_BE_DEAD) {
  const c = g.classOf(p);
  if (c !== 'dead') fails.push(`  ✗ esperado DEAD · obtenido ${c.toUpperCase()} · ${p}`);
}
for (const p of MUST_BE_ALIVE) {
  const c = g.classOf(p);
  if (c !== 'alive') fails.push(`  ✗ esperado ALIVE · obtenido ${c.toUpperCase()} · ${p}`);
}
for (const p of MUST_BE_GONE) {
  const c = g.classOf(p);
  if (c !== 'not-a-node') fails.push(`  ✗ esperado BORRADO (not-a-node) · obtenido ${c.toUpperCase()} · ${p}`);
}

console.log(`\nACEPTACIÓN · detector de muerte transitiva`);
console.log(
  `  raíces ${g.roots.length} · nodos ${g.counts.nodes} · alive ${g.counts.alive} · ` +
    `dead ${g.counts.dead} · solo_tests ${g.counts.solo_tests} · ` +
    `solo_stories ${g.counts.solo_stories} · indeterminado ${g.counts.indeterminado}`
);
console.log(`  ${MUST_BE_DEAD.length} muertos exigidos · ${MUST_BE_ALIVE.length} vivos exigidos · ${MUST_BE_GONE.length} borrados exigidos`);

if (fails.length) {
  console.log(`\n✗ ACEPTACIÓN FALLA (${fails.length}):`);
  console.log(fails.join('\n'));
  process.exit(1);
}
console.log(`\n✓ ACEPTACIÓN OK · ${MUST_BE_DEAD.length} muertos + ${MUST_BE_ALIVE.length} vivos + ${MUST_BE_GONE.length} borrados correctos.`);
