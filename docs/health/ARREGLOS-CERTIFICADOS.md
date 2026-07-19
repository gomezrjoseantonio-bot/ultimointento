# ARREGLOS CERTIFICADOS · ATLAS

> **Rango** · VINCULANTE (PROTOCOLO DE GARANTÍA §3)
> **Qué es** · el test de regresión del proyecto. Cada bug arreglado añade una
> fila con un **comando de verificación** y el **valor exacto** que debe
> devolver. `npm run health:regresion` re-ejecuta TODOS los comandos de golpe:
> si alguno deja de dar lo esperado, un arreglo antiguo se ha roto.
>
> **Un arreglo ya no es un recuerdo — es un comando que se puede volver a
> lanzar en cualquier momento, incluso dentro de un año.**

## Cómo añadir una fila

1. Arregla el bug en un PR.
2. Escribe un comando de terminal que DEMUESTRE el arreglo y que devuelva un
   valor estable y exacto (idealmente un número: `… | wc -l` → `0`).
3. Añade la fila abajo. El comando va entre `` ` `` y el esperado entre `` ` ``.
4. Verifica con `npm run health:regresion` que la fila pasa antes de mergear.

Reglas del formato (las parsea `scripts/health.mjs --regresion`):

- El comando debe imprimir EXACTAMENTE el texto esperado (sin líneas extra).
- Prefiere comandos deterministas y de una sola línea de salida.
- El esperado se compara tras `trim()` (se ignoran espacios al principio/fin).

## Hallazgos · falsos positivos de la auditoría

**Hallazgo nº 2 de `AUDIT-ESTADO-REAL-2026-07` (lecturas a stores inexistentes) ·
FALSO POSITIVO de grep.** La auditoría marcó `migracionGastosService.ts:29,142`
(`getAll('fiscalSummaries')` / `getAll('operacionesFiscales')`) como riesgo de
`NotFoundError`. En realidad **ambas lecturas ya estaban guardadas** con
`db.objectStoreNames.contains('<store>')` (líneas 28 y 141) — un `getAll` guardado
no puede lanzar `NotFoundError`. Por eso el indicador `lecturas_store_inexistente`
se recalibró (2 → 0, autorizado por Jose antes de la tarea).

**SUPERSEDIDO por el bloque 2 (2026-07-18).** La decisión anterior era *"los bloques
NO deben borrarse · migran DBs antiguas"* y dos filas del registro protegían esos
guards. El nuevo encargo de Jose (BLOQUE 2+3) **cambia la premisa**: ATLAS tiene un
solo usuario, base en `DB_VERSION 79`, **no hay DBs antiguas que proteger**. Los
stores `fiscalSummaries`/`operacionesFiscales` tienen 0 `createObjectStore` en
cualquier versión (nunca existen en v79). Por tanto `migracionGastosService` migra
desde stores inexistentes hacia stores ya poblados, para usuarios que no existen:
**código muerto, borrado entero en el bloque 2.3.** Las dos filas que protegían sus
guards quedan **RETIRADAS** (abajo, tachadas) y sustituidas por filas que certifican
el borrado. Regla de supersesión: una decisión anulada por un encargo posterior de
Jose no es una regresión.

**Hallazgo · punto ciego del indicador `enlaces_rotos` (`onNavigate`).** El
regex del indicador casa `navigate(` pero NO `onNavigate(` (N mayúscula), ni
rutas guardadas en variables, ni ciertos template strings. Toda esa clase de
destinos de navegación es invisible a la métrica. Destinos rotos hallados vía
`onNavigate` (todos en componentes muertos): `IncomeExpensesBlock:72`,
`FlujosGrid:151`, `TresBolsillosGrid:79` (todos `/inmuebles/cartera` · mismo
destino confirmado · YA corregidos a `/inmuebles`) y `TaxBlock:53`
(`/fiscalidad/estado`, ruta inexistente · **PENDIENTE bloque 3**, junto con la
decisión de si el componente muerto sobrevive · destino desconocido, no se
inventa).

Plan (autorizado por Jose): NO ampliar la definición ahora. Tarea aparte
**antes del bloque 2** · auditar las 16 definiciones buscando puntos ciegos
equivalentes (rutas en variables, template strings, `Link to=`, `href`
dinámicos, cualquier patrón que el regex no vea). Al ampliar, si el número sube,
ese es el NUEVO BASELINE, no una regresión (regla asimétrica · ver GOBERNANZA en
`scripts/health.mjs`).

## Registro

| Fecha | Qué se arregló | Comando de verificación | Esperado |
|---|---|---|---|
| 2026-07-18 · bloque 3.2 | Enlaces de navegación rotos: 0. El residuo `1` (TaxBlock `/fiscalidad/estado`, ruta inexistente) desapareció al borrar el componente muerto TaxBlock | `grep -rnE "'/portfolio'\|'/treasury'\|'/settings'\|'/tax'\|'/fiscalidad/" src --include=*.ts --include=*.tsx \| grep -vE "\.test\.\|__tests__\|\.spec\." \| wc -l` | `0` |
| 2026-07-18 · bloque 3.2 | 5 componentes de dashboard muertos borrados (TaxBlock · FlujosGrid · TresBolsillosGrid · IncomeExpensesBlock · InmueblesAnalisis) | `ls src/components/dashboard/TaxBlock.tsx src/components/dashboard/FlujosGrid.tsx src/components/dashboard/TresBolsillosGrid.tsx src/components/dashboard/IncomeExpensesBlock.tsx src/pages/inmuebles/InmueblesAnalisis.tsx 2>/dev/null \| wc -l` | `0` |
| 2026-07-18 · bloque 3.1 | Servicios muertos borrados (canario: representativos de los 38 · 31 verificados + 7 transitivos) | `ls src/services/migrationService.ts src/services/unifiedOcrService.ts src/services/loanService.ts src/services/aeatPdfParserService.ts 2>/dev/null \| wc -l` | `0` |
| 2026-07-18 · bloque 3 commit A | Lifecycle de upgrade de `traspasosPlanes` retirado de db.ts (create/migrar/delete) | `grep -c "createObjectStore('traspasosPlanes'\|deleteObjectStore('traspasosPlanes'" src/services/db.ts` | `0` |
| 2026-07-18 · bloque 3 commit B | Stash + migración V5.5/V5.9 de `objetivos_financieros` retirados (initDB abre limpio · verificado por initDBBloque3.test.ts) | `grep -c "stashOldObjetivosFinancieros\|v59MergePayload\|deleteObjectStore('objetivos_financieros'" src/services/db.ts` | `0` |
| 2026-07-18 · bloque 2.3 | `migracionGastosService` borrado entero (migración legacy muerta · sin DBs antiguas) · 0 referencias fuera de tests | `grep -rn "migracionGastosService" src --include=*.ts --include=*.tsx \| grep -v "__tests__" \| wc -l` | `0` |
| 2026-07-18 · bloque 2.2 | 4 claves fantasma fuera de la interfaz `AtlasHorizonDB` (gastos · propertyImprovements · fiscalSummaries · operacionesFiscales) | `grep -cE "^  (gastos\|propertyImprovements\|fiscalSummaries\|operacionesFiscales):" src/services/db.ts` | `0` |
| 2026-07-18 · bloque 2.4 | 3 tipos legacy fuera del schema (traspasosPlanes · valoraciones_historicas · objetivos_financieros) | `grep -cE "^  (traspasosPlanes\|valoraciones_historicas\|objetivos_financieros):" src/services/db.ts` | `0` |
| 2026-07-18 · bloque 2.4 | Cascada de `eliminarPlan` redirigida del store legacy `valoraciones_historicas` (inexistente en v79 → NotFoundError antes de borrar el plan) al actual `valoracionesActivos` vía `deleteAllByActivo` (review Copilot #1428) | `grep -c "getAll('valoraciones_historicas'" src/services/planesPensionesService.ts` | `0` |
| 2026-07-18 · bloque 2.4 | Creación legacy de `objetivos_financieros` bajo guard `oldVersion<32` eliminada | `grep -c "createObjectStore('objetivos_financieros'" src/services/db.ts` | `0` |
| 2026-07-19 · paletas-fase-1 | Árbol muerto borrado (TesoreriaV4 · HistoricoWizard · historicalCashflowCalculator · historicalTreasuryService) | `find src/components/treasury/TesoreriaV4.tsx src/modules/horizon/tesoreria/HistoricoWizard.tsx src/services/historicalCashflowCalculator.ts src/services/historicalTreasuryService.ts 2>/dev/null \| wc -l` | `0` |
| 2026-07-19 · paletas-fase-1 | Subárbol muerto `modules/horizon/inversiones/` (v4 · superseded por galería v2) borrado entero | `find src/modules/horizon/inversiones -type f 2>/dev/null \| wc -l` | `0` |
| 2026-07-19 · paletas-fase-1 | `gastosInmueble` endurecido a `GastoInmueble` (diferido de Tanda 1 · tras borrar los 2 lectores muertos) | `grep -c "gastosInmueble: { key: IDBValidKey; value: GastoInmueble;" src/services/db.ts` | `1` |
| 2026-07-19 · barrido muerto | Barrido de código muerto · representativos de las 4 tandas + commit final borrados (TaxView · KPIsBlock · financiacion/HeaderSection · optimizedDbService · completeDataCleanup.ts) | `find src/components/tax/TaxView.tsx src/components/dashboard/KPIsBlock.tsx src/modules/horizon/financiacion/components/detail/HeaderSection.tsx src/services/optimizedDbService.ts scripts/completeDataCleanup.ts 2>/dev/null \| wc -l` | `0` |
| 2026-07-19 · apartadas resueltas | Header/FiscalPageShell/FormErrorSummary(+formValidation) borradas (superseded/sin uso · autorizado por Jose) | `find src/components/navigation/Header.tsx src/modules/horizon/fiscalidad/components/FiscalPageShell.tsx src/components/common/FormErrorSummary.tsx src/utils/formValidation.ts 2>/dev/null \| wc -l` | `0` |
| 2026-07-19 · apartadas resueltas | ErrorBoundary enchufado a nivel app (envuelve `<Routes>` en App.tsx) | `grep -c "import ErrorBoundary from './components/common/ErrorBoundary'" src/App.tsx` | `1` |
| 2026-07-19 · apartadas resueltas | Candados DBSchema reconocidos como raíces typecheck-guard (chequeados por tsc, no importables) y preservados | `find src/services/__typeguards__/dbschema-nombres.ts src/services/__typeguards__/dbschema-valores.ts 2>/dev/null \| wc -l` | `2` |
| 2026-07-19 · preferencias-datos a v5 | Pantalla huérfana migrada a Ajustes v5 (`DatosPage`) y la vieja `PreferenciasDatos` (v4 · PageLayout) borrada | `find src/modules/ajustes/pages/DatosPage.tsx src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx 2>/dev/null \| wc -l` | `1` |
| 2026-07-19 · preferencias-datos a v5 | Ruta legacy `/configuracion/preferencias-datos` reconvertida en redirect a `/ajustes/datos` (deja de ser huérfana · rutas_huerfanas 20→19) | `grep -cF 'path="preferencias-datos" element={<Navigate to="/ajustes/datos"' src/App.tsx` | `1` |
| 2026-07-19 · preferencias-datos a v5 | Nueva sub-página enganchada al sidebar de Ajustes v5 (`/ajustes/datos`) | `grep -cF "path: '/ajustes/datos'" src/modules/ajustes/AjustesPage.tsx` | `1` |
| 2026-07-19 · muro/deadcode | Clúster `TreasuryReconciliationView` v3 borrado (render `solo_tests` · superseded por ConciliacionPageV2 · −172 hex) + util huérfano `normalizeText` | `find src/components/treasury/TreasuryReconciliationView.tsx src/components/treasury/treasury-reconciliation.css src/components/treasury/treasuryBalanceSummary.ts src/utils/normalizeText.ts 2>/dev/null \| wc -l` | `0` |

### Retiradas (supersedidas por el bloque 2)

Estas dos filas certificaban guards dentro de `migracionGastosService`, borrado en
el bloque 2.3. Se retiran del registro activo porque el código que protegían ya no
existe **por decisión explícita de Jose** (no por regresión):

- ~~Guard de existencia de `fiscalSummaries` en migracionGastosService~~
- ~~Guard de existencia de `operacionesFiscales` en migracionGastosService~~
