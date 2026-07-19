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

// §5 · deben seguir VIVOS (guardia anti "solo persigue muertos"). Incluye los dos
// tipos de raíz menos obvios, para fijar que se detectan: la función Netlify y el
// candado de tsc (__typeguards__ · raíz typecheck-guard) + el ErrorBoundary ya
// enchufado a nivel app.
const MUST_BE_ALIVE = [
  'scripts/completeDataCleanup.js', // raíz: package.json scripts.cleanup:complete
  'src/services/documentaiClient.ts', // vía functions/ocr-fein.ts (handler Netlify)
  'src/services/__typeguards__/dbschema-valores.ts', // raíz typecheck-guard (candado tsc)
  'src/services/__typeguards__/dbschema-nombres.ts', // raíz typecheck-guard (candado tsc)
  'src/components/common/ErrorBoundary.tsx', // enchufado en App.tsx (envuelve <Routes>)
];

// BORRADOS al actuar la detección · el detector ya no debe verlos como nodos.
// Árbol muerto (#1433) + par completeDataCleanup.ts/optimizedDbService (barrido #1434)
// + las piezas apartadas resueltas (Header, FiscalPageShell, FormErrorSummary+dep).
const MUST_BE_GONE = [
  'src/components/treasury/TesoreriaV4.tsx',
  'src/modules/horizon/tesoreria/HistoricoWizard.tsx',
  'src/services/historicalCashflowCalculator.ts',
  'src/services/historicalTreasuryService.ts',
  'scripts/completeDataCleanup.ts',
  'src/services/optimizedDbService.ts',
  'src/components/navigation/Header.tsx',
  'src/modules/horizon/fiscalidad/components/FiscalPageShell.tsx',
  'src/components/common/FormErrorSummary.tsx',
  'src/utils/formValidation.ts',
];

const fails = [];
for (const p of MUST_BE_ALIVE) {
  const c = g.classOf(p);
  if (c !== 'alive') fails.push(`  ✗ esperado ALIVE · obtenido ${c.toUpperCase()} · ${p}`);
}
for (const p of MUST_BE_GONE) {
  const c = g.classOf(p);
  if (c !== 'not-a-node') fails.push(`  ✗ esperado BORRADO (not-a-node) · obtenido ${c.toUpperCase()} · ${p}`);
}
// Invariante de barrido: tras resolver las apartadas, NO deben quedar muertos.
// Si aparece uno nuevo, decidir (enchufar/borrar) o justificar antes de tocar esto.
if (g.counts.dead !== 0) {
  fails.push(`  ✗ esperado dead=0 (barrido completo) · obtenido dead=${g.counts.dead}: ${g.dead.join(', ')}`);
}

console.log(`\nACEPTACIÓN · detector de muerte transitiva`);
console.log(
  `  raíces ${g.roots.length} · nodos ${g.counts.nodes} · alive ${g.counts.alive} · ` +
    `dead ${g.counts.dead} · solo_tests ${g.counts.solo_tests} · ` +
    `solo_stories ${g.counts.solo_stories} · indeterminado ${g.counts.indeterminado}`
);
console.log(`  ${MUST_BE_ALIVE.length} vivos exigidos · ${MUST_BE_GONE.length} borrados exigidos · dead=0`);

if (fails.length) {
  console.log(`\n✗ ACEPTACIÓN FALLA (${fails.length}):`);
  console.log(fails.join('\n'));
  process.exit(1);
}
console.log(`\n✓ ACEPTACIÓN OK · ${MUST_BE_ALIVE.length} vivos + ${MUST_BE_GONE.length} borrados + dead=0 correctos.`);
