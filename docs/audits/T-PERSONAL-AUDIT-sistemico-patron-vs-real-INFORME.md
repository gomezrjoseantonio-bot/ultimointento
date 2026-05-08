# T-PERSONAL-AUDIT · sistémico patrón vs real · informe

> Fecha · 2026-05-08
> Ejecutado por · CC (Claude Code · Opus 4.7)
> Predecesor · PR-B → asumido `merged` (la rama base de este audit es `main` con HEAD `d2521fb` · "Merge pull request #1289 · fix-vivienda-habitual"; el último feat de Vivienda habitual es `0950eff feat(personal): C-4 ficha vivienda habitual · alcance esencial con persistencia real")
> DB version verificada · **69** (`src/services/db.ts:28` · "V69 (TAREA 13 v4 · cierre lote B+C · C4 review Copilot)")
> Stores activos verificados · 40 (declarado en cabecera de db.ts)
> Modo · solo lectura · cero modificaciones a `src/`
> Branch de trabajo del informe · `claude/system-audit-review-H38XP`

---

## §1 · Resumen ejecutivo

**Estado por cable (1 línea):**

| Cable | Estado actual | Tamaño handoff | Tamaño REAL | Hallazgo crítico |
|---|---|---|---|---|
| **C1** · Alta gasto esporádico desde Tesorería con clasificación | 🟢 ~80% construido en `ConciliacionPageV2 + AddMovementModal.tsx` (`/conciliacion`) | S-M | **XS-S** (solo retoque de ámbito personal) | **El catálogo de "GASTOS PERSONALES" tiene HOY 1 sola categoría (`gasto_personal`) · NO 14**. Discrepancia con spec |
| **C2** · ATLAS aprende patrón anual · resumen + aplicar selectivo | ❌ **NO EXISTE** | L | **L** | Hay `movementLearningRules` y `compromisoDetectionService` pero ambos detectan movimientos individuales · no agregan ni proponen ajustes anuales del patrón |
| **C3** · Vista comparativa patrón vs real (módulos + consolidada Mi Plan + KPI Panel + 2 escenarios simulador) | 🟡 PARCIAL · existe `ProyeccionComparativa` (consolidado · Inmuebles) con UI cableada y datos REAL `movements`+`presupuestos` · pero NO hay flag de Personal · NO usa `compromisosRecurrentes ámbito='personal'` ni `ingresos` · forecast usa `Math.random` placeholder | XL | **XL (sigue siendo XL)** | El esqueleto está · falta ámbito Personal, fuente forecast real, y módulos locales |
| **C4** · Edición cómoda del patrón nómina (subida abril) | 🟡 LECTURA-EDICIÓN parcial · `nominaService.updateNomina()` y `NominaWizard.tsx` permiten editar pero NO modelan "cambio importe a partir de fecha X" como patrón temporal · es un overwrite | S-M | **M** | El modelo `Nomina` (en store `ingresos`) no tiene historial · ningún campo `vigenciaDesde` |
| **C5** · Atadura semi-automática nómina real Tesorería ↔ patrón Personal | 🟡 SOLO POST-CONFIRMACIÓN · `nominaAportacionHook.procesarConfirmacionEvento()` engancha `treasuryEvents.sourceType='nomina'` confirmados al patrón ÚNICAMENTE para crear aportación al plan pensiones · NO existe matching automático "movement entrante con concepto X · importe ~Y · cuenta Z → ¿es esta nómina patrón?" | M | **M-L** | Al ingresar un movement nuevo (via CSB43 o manual) NO se sugiere atarlo a un evento `predicted` de tipo nómina · solo el reconciliador genérico por importe/fecha lo intenta · y la confirmación NO pregunta "¿el importe real difiere del patrón?" |

**Orden recomendado de ataque:** **C1 → C4 → C5 → C2 → C3.**

Justificación corta: C1 está casi hecho · cerrarlo es ganar valor inmediato (cliente puede registrar gasto esporádico HOY) y desbloquea la fuente "real esporádica" que C2 y C3 necesitan. C4 + C5 son la pareja de la nómina (patrón editable + atadura) y deben ir juntas porque C5 sin C4 obliga al cliente a hacer overwrite manual del patrón cada vez que detecta desviación. C2 viene cuarto porque depende de tener historia REAL acumulada (lo que C1+C5 generan). C3 es el techo: la vista consolidada solo cobra sentido cuando los datos comparados (patrón ajustable + real fiable) existen y son confiables.

**Hallazgos sorpresa:**

1. **Discrepancia de catálogo personal:** la spec asume "14 categorías personales"; la realidad es **1 categoría** (`gasto_personal`) en `categoryCatalog.ts:243`. La granularidad real del Personal hoy se modela vía `compromisosRecurrentes.tipoFamilia` y `tipoSubcategoria`, no en `CategoryDef`.
2. **Dos hubs Personal coexistiendo en producción:** `/personal/*` (módulos v5 · `src/modules/personal`) y `/gestion/personal` (legacy · `src/pages/GestionPersonal`) ambos están wired en `App.tsx` líneas 1022 y 1107. Comparten servicios (`nominaService`, `autonomoService`, `otrosIngresosService`) → no hay duplicación de datos pero sí duplicación de UI con flujos divergentes.
3. **Mi Plan NO tiene comparativa patrón vs real hoy.** Las 5 sub-páginas (Landing · Proyección · Libertad · Objetivos · Fondos) no cruzan `compromisosRecurrentes` con `movements`/`treasuryEvents` confirmados. `ProyeccionPage.tsx` consume `computeBudgetProjection12mAsync` que es **proyección pura del patrón** (nóminas + compromisos) sin contraste real.
4. **Panel V5 tampoco tiene KPI de coherencia patrón vs real.** Grep "coherencia/coherence/alineamiento/alignment" en `src/modules/panel/**` → 0 hits. `PulsoDelMes` solo agrega `treasuryEvents` (real) del mes.
5. **Sólo `nominaAportacionHook.ts` engancha nómina real → algo del patrón** (aportaciones plan pensiones). Es un hook UNI-direccional · NO actualiza el patrón nómina con la cifra real, y NO pregunta confirmación al cliente (P8.3).
6. **`movementLearningRules` aprende solo categoría/ámbito/inmueble** (ver `movementLearningService.ts:151-211`), NO aprende patrón anual de gasto. C2 es un cable nuevo · no hay base.

---

## §2 · Bloque 1 · Patrón Personal hoy

### 2.1 · Tabla stores patrón Personal

| Store | Veredicto | Escritor principal | Lector clave | Notas |
|---|---|---|---|---|
| `ingresos` | ✅ REAL · cobertura nómina/autónomo/otros/pensión unificados | `nominaService.saveNomina/updateNomina/deleteNomina` (`src/services/nominaService.ts:165, 196, 234` · `STORE='ingresos'`); `autonomoService.saveAutonomo/updateAutonomo/deleteAutonomo` (`src/services/autonomoService.ts:93, 139, 186`); `otrosIngresosService.saveIngreso/updateIngreso/deleteIngreso` (`src/services/otrosIngresosService.ts:65, 93, 126`); `pensionService` (`src/services/pensionService.ts:9 STORE='ingresos'`) | `personalResumenService`, `treasurySyncService`, `irpfCalculationService`, `fiscalConciliationService`, `nominaAportacionHook`, `treasuryBootstrapService` | **Store unificado**: nóminas, autónomos, otros ingresos y planes de pensiones discriminados por `tipo`. Schema dice `tipo: 'nomina' \| 'autonomo' \| 'otrosIngresos' \| 'capitalMobiliario' \| 'imputacion' \| 'alquiler' \| 'dividendos' \| 'interes' \| 'pension' \| 'otros'` (ver `src/services/db.ts:1172` para `sourceType` paralelo) |
| `compromisosRecurrentes` | ✅ REAL · `ambito='personal'` (gastos recurrentes personales) o `'inmueble'` (OPEX) | `compromisosRecurrentesService.crearCompromiso/actualizarCompromiso/eliminarCompromiso` (vía `src/services/personal/compromisosRecurrentesService.ts`); también `opexService` delega ahí (`opexService.ts:333`) | `treasuryBootstrapService.regenerateForecastsForward` línea 207 (genera `treasuryEvents` predicted); `propertyExpenses`, `operacionFiscalService`, `compromisoDetectionService`, `movementSuggestionService` | Schema único con discriminador `ambito`. **Personal aquí = gastos recurrentes** (luz, alquiler de vivienda habitual, etc) |
| `viviendaHabitual` | ✅ REAL · alcance A C-4 (datos esenciales · 1 ficha activa por personalDataId) | `viviendaHabitualService.guardarVivienda/eliminarVivienda` (`src/services/personal/viviendaHabitualService.ts`) | `fiscalContextService.obtenerViviendaActiva` (`fiscalContextService.ts:31`); `irpfCalculationService` (excluye renta inmobiliaria art. 85) | Recién aterrizado (commits 2026-05-07/08 PR-B/B-bis) |
| `personalData` | ✅ REAL | `personalDataService.savePersonalData` (`src/services/personalDataService.ts:38, 54`) | `PersonalPage`, `nominaService`, `autonomoService`, `otrosIngresosService`, `viviendaHabitualService`, todos los wizards | Datos del titular fiscal (`personalDataId` raíz) |
| `presupuestos` + `presupuestoLineas` | 🟡 LECTURA-PARCIAL · NO se ve UI de alta de presupuesto Personal · solo presupuesto/inmueble v5 | escritura: `budgetService.ts` (módulo proyeccion) | lectura: `budgetMatchingService.ts:117-128`; `comparativaService.ts:2`; `budgetReclassificationService.ts:99-157` | Schema en `db.ts:2079-2628` · usado por `ProyeccionComparativa` para columna "budget"; el módulo Personal NO escribe aquí |
| `escenarios` | ✅ REAL · singleton patron de libertad financiera | `escenariosService.saveEscenarioActivo/resetEscenario/addHito/updateHito/removeHito` (`src/services/escenariosService.ts:56, 74, 87, 99, 114`) | `MiPlanPage`, `LibertadPage`, `libertadService.proyectarLibertadDesdeRepo:146` | Patron del simulador · NO multi-escenario · ver §6 |
| `nominas` (legacy) | ❌ FÓSIL · eliminado en V63 · documentado en `nominaAportacionHook.ts:25-27` "el store legacy `nominas` se eliminó; los registros viven en `ingresos` con `tipo='nomina'`" | — | — | Confirmado fósil. NO presente en los 40 stores activos |
| `opexRules` (legacy) | ❌ FÓSIL · eliminado en V62 · documentado en `treasuryForecastService.ts:577` "opexRules store eliminado en V62 — migrado a compromisosRecurrentes" | — | — | Confirmado fósil. `opexService.ts` ahora delega a `compromisosRecurrentesService` con `ambito='inmueble'` |

### 2.2 · Tabla componentes UI patrón Personal

> grep duro aplicado a cada archivo (count `import.*services?/` + count `await…(save\|create\|update\|put\|add\|delete\|crear\|guardar\|actualizar\|eliminar)`)

| Ruta | Función | Service que consume / escribe | Veredicto | Evidencia grep duro |
|---|---|---|---|---|
| `src/modules/personal/PersonalPage.tsx` | Hub `/personal` · carga datos vía outlet context (`PersonalContext.ts`) | `nominaService.getNominas`, `autonomoService.getAutonomos`, `otrosIngresosService.getOtrosIngresos`, `personalDataService.getPersonalData`, `db.getAll('compromisosRecurrentes')` | LECTURA-PURA (orquestador) | imports services=4 · awaits save=0 (carga, no escribe) · líneas=145 |
| `src/modules/personal/pages/PanelPage.tsx` | `/personal` (índice) · resumen contra outlet context | (consume context) | LECTURA-PURA | imports=0 · awaits=0 · toasts=2 · líneas=503. Sub-página, recibe vía useOutletContext |
| `src/modules/personal/pages/IngresosPage.tsx` | `/personal/ingresos` · listado y navega a wizard | (navega a `/gestion/personal/nueva-nomina`) | LECTURA-PURA | imports=0 · awaits=0 · líneas=374 |
| `src/modules/personal/pages/GastosPage.tsx` | `/personal/gastos` · listado + delete | `compromisosRecurrentesService.eliminarCompromiso`, `treasuryBootstrapService.regenerateForecastsForward` | ✅ REAL (escribe) | imports=2 · líneas=36 (es shell · delega a `ListadoGastos` shared) |
| `src/modules/shared/components/ListadoGastos/components/EditDrawer.tsx` | edición inline gasto | `compromisosRecurrentesService.actualizarCompromiso` | ✅ REAL | grep:`actualizarCompromiso` import (línea 4) |
| `src/modules/personal/pages/NuevoGastoRecurrentePage.tsx` | `/personal/gastos/nuevo` y `/editar` · alta y edición | `compromisosRecurrentesService.crearCompromiso/actualizarCompromiso` (líneas 14-17, 520, 522), `personalDataService`, `cuentasService`, `treasuryBootstrapService.regenerateForecastsForward` | ✅ REAL | imports=4 · awaits=2 (`actualizarCompromiso` + `crearCompromiso`) · líneas=1597 |
| `src/modules/personal/pages/ViviendaPage.tsx` | `/personal/vivienda` · ficha vivienda habitual | `viviendaHabitualService.guardarVivienda/eliminarVivienda` (líneas 24-26, 365, 386), `personalDataService` | ✅ REAL | imports=1 (servicios) · awaits=2 (`guardarVivienda` + `eliminarVivienda`) · líneas=990 |
| `src/modules/personal/pages/PresupuestoPage.tsx` | `/personal/presupuesto` · vista presupuesto personal | (consume context) | 🟡 LECTURA · sin escritura | imports=0 · awaits=0 · líneas=184 |
| `src/modules/personal/pages/DetectarCompromisosPage.tsx` | `/personal/gastos/detectar-compromisos` · detección desde movements | `compromisoCreationService.createCompromisosFromCandidatos` (línea 758), `compromisoDetectionService.detectCompromisos` | ✅ REAL | imports=2 (compromisoCreationService + compromisoDetectionService) · awaits=1 (`createCompromisosFromCandidatos`) · líneas=1051 |
| `src/pages/GestionPersonal/GestionPersonalPage.tsx` | `/gestion/personal` · hub legacy | `nominaService`, `autonomoService`, `otrosIngresosService` | LECTURA-PURA (orquestador) | múltiples service imports |
| `src/pages/GestionPersonal/wizards/NominaWizard.tsx` | `/gestion/personal/nueva-nomina` · wizard alta/edición nómina | `nominaService.getNominaById/saveNomina/updateNomina` (líneas 254, 446, 448) | ✅ REAL | awaits=2 |
| `src/pages/GestionPersonal/wizards/AutonomoWizard.tsx` | `/gestion/personal/nuevo-autonomo` · wizard autónomo | `autonomoService.getAutonomos/saveAutonomo/updateAutonomo` (líneas 167, 328, 330) | ✅ REAL | awaits=2 |
| `src/pages/GestionPersonal/wizards/OtrosIngresosWizard.tsx` | `/gestion/personal/otros-ingresos` · wizard otros | `otrosIngresosService.*` | ✅ REAL | (verificado import) |

### 2.3 · Hallazgos cruzados Bloque 1

- **Duplicación de hubs Personal:** `/personal` (v5) y `/gestion/personal` (legacy) están ambos en `App.tsx`. Wizards de ingresos viven en el legacy y son **el único punto de alta para nóminas/autónomos/otros**. La parte v5 (`/personal/ingresos`) navega al legacy. → **No es duplicación de datos** (ambos van al mismo `ingresos` store), pero sí confunde flujo. Pequeña deuda · no bloqueante para los 5 cables.
- **No hay duplicación de stores fósiles:** los esperables (`nominas`, `opexRules`) están eliminados y re-mapeados. Sin sorpresas tipo "inversiones vs planesPensionInversion".
- **DetectarCompromisosPage existe ya** y persiste (caja `compromisoCreationService.createCompromisosFromCandidatos`). Es un cable parcial hacia C2 (aprendizaje), pero opera sobre **detección uno a uno** desde movimientos brutos · NO sobre desviación del patrón anual. Distinto problema.

---

## §3 · Bloque 2 · Real Personal hoy

### 3.1 · Cómo entra el real

| Vía | Fichero | Stores escritos | Notas |
|---|---|---|---|
| Importación CSB43/AEB43 (extracto bancario) | `src/services/bankStatementOrchestrator.ts` líneas 202-449 | `treasuryEvents` (predicted/confirmed) y `movements` (`db.put('treasuryEvents'…)` y `db.add('movements'…)`) | Crea evento + movement vinculado por `executedMovementId` |
| Confirmación manual en pantalla `/conciliacion` (V2) | `src/services/treasuryConfirmationService.ts:538` engancha `procesarConfirmacionEvento` | `movements` (via `db.put('movements'…)` líneas 298, 486, 735), `treasuryEvents.status='confirmed'` | Dispara hooks downstream incluido `nominaAportacionHook` |
| Alta manual desde `/conciliacion` V2 (cliente registra movement esporádico) | `src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx:353` `await db.add('treasuryEvents', eventPayload)` | `treasuryEvents` con `sourceType='manual'`, `categoryKey`, `ambito` ('PERSONAL' o 'INMUEBLE') | Si `mode='confirmed'` también llama `confirmTreasuryEvent(eventId)` que crea movement |
| Bootstrap forecast desde patrón | `src/services/treasuryBootstrapService.ts:139, 232` | `treasuryEvents` predicted (NO movements) | Lee `compromisosRecurrentes` activos y nominas/otros ingresos |
| Aprendizaje categorización (rule-based) | `src/services/movementLearningService.ts:151-211` | `movementLearningRules` (store) | Aprende `learnKey → categoria + ambito + inmuebleId`. NO aprende patrón anual |
| Sugerencia conciliación movement → compromiso | `src/services/movementSuggestionService.ts` (Vía A `compromisosRecurrentes` + Vía B contratos/préstamos) | sugiere matches; al aceptar, escribe en movement | Reciprocidad de la atadura (B6 parcial) |
| Apertura de cuenta · saldo inicial | `src/services/cuentasService.ts:364` `db.add('movements'…)` | `movements` openingMovement | Real, no patrón |
| Ingresos manuales desde declaración fiscal / wizard inmuebles | `src/services/enhancedTreasuryCreationService.ts:194, 276` (`treasuryCreationService.ts:78, 123, 229, 321`) | crea `ingresos` y `movements` en una transacción | Used by varios wizards |
| Conciliación budget | `src/services/budgetMatchingService.ts:359`, `budgetReclassificationService.ts:192` | `db.put('movements'…)` con metadata fiscal | Re-categorización backend |

### 3.2 · Categorías Personal · cobertura del catálogo

> **DISCREPANCIA con el spec:** la spec menciona "14 categorías personales". El código real:

```
src/services/categoryCatalog.ts:237  GASTO_PERSONAL_CATEGORIES → 1 sola entrada
{ key: 'gasto_personal', label: 'Gasto personal', tipo: 'gasto', ambito: 'personal',
  availableInOpex: false, requiereInmueble: false, hasSubtype: false }

src/services/categoryCatalog.ts:83  INGRESO_CATEGORIES → 2 entradas
{ key: 'alquiler', ambito: 'inmueble' }
{ key: 'otros_ingresos', ambito: 'ambos' }   ← única que cubre Personal en ingresos
```

La granularidad real del Personal no se modela en `CategoryDef` sino en:
- `compromisosRecurrentes.tipoFamilia` (alquiler vivienda · suministros · seguros · etc)
- `compromisosRecurrentes.tipoSubcategoria`
- `nomina.*`, `autonomo.*`, `otrosIngresos.tipo` (sub-tipos de ingreso)

→ **Cobertura "14 categorías" como tal NO aplica**. Para el ámbito Personal en `AddMovementModal`, hoy el cliente solo puede elegir "Gasto personal" o "Otros ingresos" en la modal · sin sub-clasificación. **C1 implica decidir si añadir sub-categorías al catálogo o reusar `tipoFamilia` de compromisos**.

### 3.3 · Aprendizaje automático

`movementLearningService.ts` aprende **cada vez que cliente conciliación una vez**: guarda `learnKey + categoria + ambito + (inmuebleId)`. Cuando llega un movement nuevo con `learnKey` igual, lo pre-clasifica. **NO aprende sobre patrón anual ni desviaciones**. Es prerequisito útil para C2 pero NO es C2.

---

## §4 · Bloque 3 · Comparativas locales

### 4.1 · ¿Existen comparativas patrón vs real hoy?

| Pantalla | Ruta | Veredicto | Cruce de fuentes | Alineación con P3 §2 |
|---|---|---|---|---|
| `ProyeccionComparativa.tsx` | `/proyeccion/comparativa` (wired App.tsx:991) | 🟡 PARCIAL · MIXTO | `presupuestos` (budget) ⨯ `forecast` (Math.random placeholder · ver `comparativaService.ts:329-330`) ⨯ `movements` con `estado_conciliacion='conciliado'` (real) | 🟡 SOLO consolidado o por inmueble · **no soporta filtro Personal** · forecast mockeado · no usa `compromisosRecurrentes` ni `ingresos` |
| `MonthlyDetailModal.tsx` (sub-componente) | (modal en /proyeccion/comparativa) | 🟡 sigue lógica de `comparativaService` | igual que arriba | igual |
| `ProyeccionMensual.tsx` | `/proyeccion/mensual` (wired App.tsx:1014) | 🟡 LECTURA · proyección pura del patrón · NO compara | usa `proyeccionMensualService.generateProyeccionMensual` que cruza nominas/autonomos/otros + compromisos · **sin contraste real** | NO es comparativa |
| `pages/inmuebles/InmueblesAnalisis.tsx` | ❌ **NO ROUTED** (grep `InmueblesAnalisis` en App.tsx → 0 hits) | LECTURA · página huérfana | cruza `compromisosRecurrentes` + `gastosInmueble` + `valoraciones` + `prestamos` | Página huérfana · **no accesible al usuario** |
| `pulse` / `inmuebles/pages/DetallePage.tsx` | `/inmuebles/:id` | LECTURA · ficha inmueble · muestra `compromisosRecurrentes` | NO cruza con `movements` | NO comparativa |
| `pages/personal/PanelPage`, `IngresosPage`, `GastosPage` | `/personal/*` | NO comparativa · muestran patrón en aislado | — | NO comparativa |

### 4.2 · Greps clave ejecutados (literales, ver §12 anexo)

- `grep -rln "patron.*real|previsto.*real|esperado.*real|forecast.*actual" src/pages src/components src/modules` → **0 hits con patrón "X.real"**; los hits son sobre forecast/treasury context.
- `grep -rln "desviacion|desviación|deviation|variance" src/pages src/components src/modules` → 5 archivos: `mi-plan/wizards/utils/calcularRitmo.ts`, `proyeccion/comparativa/{services,components}/*`, `inversiones/components/tabs/TabResumen.tsx`. Solo `proyeccion/comparativa` calcula deviation budget vs actual (no patron vs real).
- `grep -rln "compromisosRecurrentes.*movements|movements.*compromisosRecurrentes" src/` → **1 hit** (`propertySaleService.ts`, transacción de venta · NO comparativa).

### 4.3 · Conclusión Bloque 3

**No existe HOY ninguna comparativa "patrón previsto Personal" vs "real Tesorería confirmado".** Lo más cercano (`ProyeccionComparativa`) opera sobre presupuestos/forecast/movements en ámbito Inmueble · y su forecast usa Math.random placeholder. Para C3, este componente es **reciclable como esqueleto pero requiere reescribir la fuente forecast → leer `compromisosRecurrentes` + `ingresos` patrón** y añadir filtro ámbito Personal.

---

## §5 · Bloque 4 · Vista consolidada Mi Plan / Panel

### 5.1 · Mi Plan

Tabs (todos wired en App.tsx 938-967):

| Tab | Ruta | Lineas | Veredicto grep duro | Función |
|---|---|---|---|---|
| Landing | `/mi-plan` | 333 | 🟡 LECTURA · imports=0 · awaits=0 (consume `MiPlanContext` outlet · usa `useProyeccionLibertad` hook) | Resumen · escenario · objetivos · fondos |
| Proyección | `/mi-plan/proyeccion` | 345 | 🟡 LECTURA · imports=1 (`computeBudgetProjection12mAsync`) · awaits=0 | Proyección 12m · NO contraste con real |
| Libertad | `/mi-plan/libertad` | 385 | 🟡 LECTURA · imports=0 · consume context · usa `escenario` | Trayectoria libertad · gráfica única |
| Objetivos | `/mi-plan/objetivos` | 235 | 🟡 LECTURA · imports=0 (escrituras vía wizards) | Listado de objetivos |
| Fondos | `/mi-plan/fondos` | 258 | 🟡 LECTURA · imports=0 (escrituras vía wizards) | Listado fondos |
| Retos | redirige a `/mi-plan/objetivos` | — | flag `SHOW_RETOS=false` · postpuesto T27.2-skip | — |

`MiPlanContext` (`src/modules/mi-plan/MiPlanContext.ts`) expone solo: `escenario`, `objetivos`, `fondos`, `retos`, `retoActivo`, `retosUltimos12`, `reload`. **NO incluye comparativa patrón vs real ni KPI de coherencia.**

`computeBudgetProjection12mAsync` (`src/modules/mi-plan/services/budgetProjection.ts`) **es proyección pura del patrón** (`nominas`, `autonomos`, `otrosIngresos` activos + `compromisosRecurrentes` ámbito personal + `contracts` ámbito inmueble). Línea 300-310: lee solo patrón · NO lee `movements`.

→ **Mi Plan NO tiene la vista consolidada P7 hoy.**

### 5.2 · Panel `/panel`

`src/modules/panel/PanelPage.tsx` (710 líneas) compone 5 widgets:

| Componente | Veredicto | ¿Cruza patrón vs real? |
|---|---|---|
| `PulseAssetCard` | LECTURA · no cruza | NO |
| `PulsoDelMes` | LECTURA · agrega `treasuryEvents` (real) del mes en curso | NO compara con patrón · solo muestra real |
| `AttentionList` | LECTURA · alertas | NO |
| `MiPlanCompass` | LECTURA · puntero al `escenario` | NO |
| `YearTimeline` | LECTURA · timeline anual | NO |

Greps clave:
- `grep -rln "coherencia|coherence|alineamiento|alignment" src/modules/panel/` → **0 hits**
- `grep -rln "patron|previsto.*real" src/modules/panel/` → solo "Saldo fin mes previsto" (forecast genérico, no comparativa)

→ **Panel NO tiene KPI señalero patrón vs real hoy.**

### 5.3 · Conclusión Bloque 4

**NO existe vista consolidada P7 hoy ni en Mi Plan ni en Panel.** El esqueleto Mi Plan está limpio (5 sub-páginas que consumen outlet context) y se le puede añadir un nuevo tab "Patrón vs Real" o un nuevo widget en Landing. Panel V5 puede sumar un `KpiCoherenciaCard` al lado de `PulsoDelMes` sin romper layout.

Para alinear con P7/P7.1/P7.2/P7.3/P7.4 haría falta:
- (P7.1 expandible): los componentes actuales son flat · necesitan un patrón disclosure tipo `<Accordion>` por categoría
- (P7.2 toggle mensual/anual con default anual): hoy `PulsoDelMes` solo mes · `ProyeccionPage` solo 12m · ningún toggle vivo
- (P7.3 dos escenarios libertad): ver §6 simulador
- (P7.4 año en curso = real cerrado + patrón pendiente): hoy `PulsoDelMes` muestra real del mes y forecast del resto sin distinción visual entre "cerrado" y "pendiente"

---

## §6 · Bloque 5 · Simulador libertad financiera

### 6.1 · Topología

| Pieza | Ruta | Veredicto |
|---|---|---|
| Component UI | `src/modules/mi-plan/pages/LibertadPage.tsx` (385 líneas) | LECTURA · consume `useProyeccionLibertad` hook |
| Hook | `src/hooks/useProyeccionLibertad.ts` (envoltorio asíncrono) | LECTURA · llama a `proyectarLibertadDesdeRepo` |
| Service función pura | `src/services/libertadService.ts:28` `proyectarRentaPasivaLibertad(datos, supuestos, config)` | ✅ REAL · pura (sin DB, sin side effects) |
| Service async | `src/services/libertadService.ts:142` `proyectarLibertadDesdeRepo(supuestos?, configOverride?)` | ✅ REAL · lee `escenarios`, `contracts`, `prestamos`, `gastosInmueble` |
| Calculadora renta pasiva real | `libertadService.ts:198 calcularRentaPasivaActual()` | Calcula renta neta = alquileres − OPEX/12 − cuota préstamo | 

### 6.2 · Inputs del simulador

`proyectarLibertadDesdeRepo` lee:
- `escenarios` (singleton) → `gastosVidaLibertadMensual`, `hitos`, `libertadConfig`, `estrategia`, `modoVivienda`
- `contracts` activos (renta bruta)
- `prestamos` activos (cuota fórmula francesa)
- `gastosInmueble` ejercicio en curso (OPEX mensualizado)

**No lee** `nominas`, `autonomos`, `otrosIngresos` ni `compromisosRecurrentes` ámbito personal · porque libertad financiera STANDARD = "alcanceRentaPasiva: alquiler-neto" (ver `libertadService.ts:35-39` que tira `Error` si se cambia el alcance). Solo Inmuebles cuentan en la renta pasiva.

### 6.3 · ¿Multi-escenario?

- Store `escenarios` es **singleton** (ver `db.ts:2306` "V5.4: singleton escenario libertad activo").
- `getEscenarioActivo()` siempre devuelve uno. `saveEscenarioActivo` actualiza el único.
- En `LibertadPage.tsx:18-20`: `const [escenarioActivo, setEscenarioActivo] = useState<Escenario>(...)` pero `Escenario` aquí es un **string** ('alquiler' | 'propia') que solo cambia el modoVivienda mostrado en la gráfica · NO cambia los datos calculados (siempre los mismos del escenario singleton persistido).

→ **NO soporta dos escenarios paralelos hoy.** El switch UI `propia/alquiler` es cosmético.

### 6.4 · Estimación añadir P7.3 (escenario "según tu plan" + "según tu realidad")

Para añadir el escenario "según tu realidad" sin romper:
1. Refactor `Escenario` de singleton → admitir 2 instancias o introducir un parámetro `modo: 'plan' | 'realidad'` en `proyectarLibertadDesdeRepo`.
2. En modo "realidad": leer renta pasiva real **del último mes confirmado** vía cruzar `contracts` con `treasuryEvents` confirmados (donde `sourceType='contrato'`) en lugar de `rentaMensual` declarada.
3. UI: doble línea en la misma gráfica + leyenda + dos cruces "libertad".

**Tamaño estimado: M.** El motor `proyectarRentaPasivaLibertad` es puro y reusable; el cambio principal es duplicar `calcularRentaPasivaActual` en una variante que lea real (de `treasuryEvents`/`movements`) en lugar de patrón (de `contracts.rentaMensual`).

---

## §7 · Bloque 6 · Atadura nómina real ↔ patrón

### 7.1 · ¿Existe `nominaAportacionHook`?

**Sí.** `src/services/personal/nominaAportacionHook.ts` (171 líneas, exportado desde `src/services/personal/index.ts:21`).

Vivo y enganchado: `treasuryConfirmationService.ts:536-539` lo invoca dinámicamente cuando un `TreasuryEvent` con `sourceType='nomina'` pasa a `confirmed`/`executed`.

Funciones públicas:
- `onNominaConfirmada(evento, nomina)` (línea 45) — crea/incrementa `aportacionesPlan` (store V65) si la nómina tiene `planPensiones.aportacionEmpleado` y `productoDestinoId`.
- `procesarConfirmacionEvento(evento)` (línea 119) — wrapper que recupera la `nomina` de `ingresos` y delega.
- `aportacionesAcumuladasEjercicio(productoId, ejercicio)` (línea 148) — agregador para Fiscal.

**Confirmación CC: este es el G-07 hook moderno crítico. No tocado durante este audit.** Es uni-direccional patrón→aportación pensiones · NO hace matching desde movement entrante a patrón nómina mes X.

### 7.2 · ¿Existe matching automático "movement entra → ¿es nómina patrón?"?

| Mecanismo | Existe | Cubre nómina patrón |
|---|---|---|
| `treasuryBootstrapService.regenerateForecastsForward` genera `treasuryEvents predicted` con `sourceType='nomina'` (ver `treasurySyncService.ts:434-456`) | ✅ | Sí, **forward** desde el patrón |
| Cuando llega un movement (CSB43 o manual), reconciliador genérico lo cruza por importe/fecha contra `treasuryEvents.predicted` | 🟡 (vía `incomeReconciliationService.ts` + `bankStatementOrchestrator.ts`) | **Solo si el evento predicted ya existe** (es decir, el patrón ya generó forecast). NO crea evento "nómina" desde la nada |
| Sugerir match desde un movement HUÉRFANO a una nómina activa | ❌ | NO existe `matchNominaFromMovement` ni similar. `movementSuggestionService.ts` solo sugiere `compromisosRecurrentes` y `contracts/prestamos` (Vía A y B), no `ingresos` patrón |
| Confirmar evento nómina con importe REAL distinto del patrón → preguntar al cliente "¿es este el nuevo patrón?" | ❌ | NO existe. La confirmación graba `actualAmount` en el `treasuryEvent` pero NO actualiza el patrón `nomina.salarioBrutoAnual` ni similar |

→ **C5 estado real:** flujo forward del patrón al evento ✅ + reconciliación por importe/fecha 🟡. Falta:
1. Sugerir match de movement entrante huérfano → nómina patrón.
2. Detectar discrepancia importe (real ≠ patrón) y preguntar "¿actualizar patrón a partir de este mes?".
3. Si confirma, actualizar `nomina.salarioBrutoAnual` (y/o variable, paga extra) con `vigenciaDesde=fecha` (campo no existe hoy → C4).

**Tamaño C5: M-L** (más grande que el handoff "M" porque la atadura completa requiere C4 primero).

### 7.3 · `fiscalConciliationService.conciliarNominas`

`src/services/fiscalConciliationService.ts:180-228` ya **calcula desviación patrón vs real por mes** (`estimado` desde `nominaService.calculateSalary` vs `real` desde `eventoMes.actualAmount`). Es solo cálculo agregado para informe fiscal · no genera UI de "ajustar patrón" ni preguntas al cliente. **Pieza reusable para C3** (renderizar la diferencia ya está calculada).

---

## §8 · Bloque 7 · Gastos esporádicos desde Tesorería

### 8.1 · ¿Existe alta manual con clasificación?

**Sí, en `/conciliacion`** (que está wired vía `ConciliacionPage` → `ConciliacionPageV2`):

- `src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx` (838 líneas)
- Botón "Añadir movimiento" en `ConciliacionPageV2.tsx:217` → `setShowAddModal(true)`
- Submit: `await db.add('treasuryEvents', eventPayload)` línea 353; si `mode='confirmed'` además llama `confirmTreasuryEvent(eventId)` que crea movement.
- **Soporta clasificación al alta**: tipo (ingreso/gasto/financiación/traspaso) + ámbito (personal/inmueble) + categoría (catálogo) + sub-tipo + inmueble + cuenta + proveedor (nombre/NIF/factura). Ver `AddMovementModal.tsx:286-340`.

### 8.2 · Veredicto C1

🟢 **~80% construido.** El flujo de alta manual desde Tesorería con clasificación EXISTE y persiste real (treasuryEvents → movements). Cumple casi P4+P8.1.

Lo que falta para cerrar P4+P8.1:
1. **El catálogo de categorías Personal está vacío de granularidad** (1 sola entrada `gasto_personal`). La spec asume granularidad fina · hay que decidir: añadir N categorías Personal a `categoryCatalog.ts` ó reutilizar `compromisosRecurrentes.tipoFamilia` como sub-clasificador.
2. **Entry point UX**: hoy el botón está en `/conciliacion`, NO en `/tesoreria/movimientos` (V5 v8 mockup). En `MovimientosTab.tsx` no hay botón "Nuevo movimiento" — solo confirmación de eventos predicted existentes. Decisión de spec: ¿se mueve `AddMovementModal` a `/tesoreria/movimientos` o se mantiene en `/conciliacion`?
3. **Tagging "esporádico"**: hoy `sourceType='manual'` se solapa con altas predicted manuales (no esporádicas). Recomendable añadir `metadata.isEsporadico` o `categoryGroup='esporadico'` para que las analítics de C2/C3 puedan distinguir "esporádico no recurrente" de "real de un compromiso".
4. **Spec menciona "pantalla nueva NO"** — efectivamente hoy es modal, alineado.

### 8.3 · Tamaño C1

**XS-S** (no S-M como el handoff). Lo construido cubre el grueso.

---

## §9 · Bloque adicional · sanidad cruzada (sin spec)

| Verificación | Resultado |
|---|---|
| DB version coincide con spec (69) | ✅ `db.ts:28 DB_VERSION = 69` |
| 40 stores activos | ✅ documentado en cabecera de db.ts |
| `nominas`/`opexRules` legacy fósiles | ✅ confirmado eliminados, comentarios explícitos |
| Stores duplicados o no documentados encontrados (>3 sería bloqueante) | 🟢 0 hallazgos · sin bloqueo |
| Algún cable >70% construido (sería bloqueante) | 🟡 C1 a ~80% (matiz: catálogo vacío). NO bloquea pero **cambia estrategia**: empezar por C1 con scope reducido a "decidir granularidad categorías Personal + entry-point" · NO reescritura |
| `nominaAportacionHook` legacy o moderno | ✅ moderno, V63+ · no tocado |

**No se ha encontrado ningún hallazgo bloqueante para reportar como issue GitHub** según los criterios §7 del spec.

---

## §10 · Tabla priorizada de los 5 cables

| Cable | Estado actual | Tamaño REAL | Riesgo | Bloqueado por | Bloquea a | Orden recomendado |
|---|---|---|---|---|---|---|
| C1 | 🟢 ~80% (`AddMovementModal` ya escribe + clasifica) · falta granularidad catálogo Personal + decisión entry-point | XS-S | bajo | nada | C2 (necesita historial real esporádico clasificado) y C3 (vista necesita esporádicos clasificados) | **1º** |
| C4 | 🟡 LECTURA-EDICIÓN parcial · `nominaService.updateNomina` overwrites · falta modelo `vigenciaDesde` (historial patrón) | M | medio (toca tipo `Nomina` en `ingresos` store · cuidado con migraciones · DB v70 inevitable si añade campo) | nada (puede empezarse en paralelo a C1) | C5 (la atadura semi-auto necesita poder versionar el patrón) | **2º** (paralelable con C1) |
| C5 | 🟡 forward + reconciliación importe/fecha existen · falta sugerir match desde movement huérfano + detectar desviación + UI confirmación cliente | M-L | medio (requiere extender `treasuryConfirmationService` y `movementSuggestionService` · UI nueva en confirmación drawer) | C4 (sin `vigenciaDesde`, "actualizar patrón" es overwrite peligroso) | C2 (atadura calidad alimenta aprendizaje) y C3 | **3º** |
| C2 | ❌ NO EXISTE · `movementLearningRules` solo aprende categoría/ámbito · NO aprende patrón anual ni propone ajustes selectivos | L | medio-alto (es lógica nueva pesada · requiere job 1-enero + UI de revisión + workflow "aplicar selectivo") | C1 + C5 (necesita histórico real categorizado y atadura fiable) | C3 (la consolidada incluye "patrones desviados" como señal) | **4º** |
| C3 | 🟡 PARCIAL · `ProyeccionComparativa` esqueleto reusable · necesita ámbito Personal + fuente forecast real (no Math.random) + módulos locales por sub-tab + KPI Panel + 2 escenarios simulador | XL | alto (toca Mi Plan, Panel, simulador, módulos locales · es cable transversal) | C1, C2, C4, C5 (la vista solo es útil con datos confiables atrás) | nada (es el techo) | **5º** |

---

## §11 · Recomendación final

**Empezar por C1 con scope minimalista.** El 80% está construido (`AddMovementModal` escribe `treasuryEvents` + clasifica + soporta ámbito personal). El trabajo restante es decisión de producto + retoque ligero: (a) decidir granularidad de categorías Personal en `categoryCatalog.ts` (añadir N entradas vs reutilizar `tipoFamilia` como sub-clasificador), (b) decidir entry-point UX (mover/duplicar el botón "Añadir movimiento" desde `/conciliacion` V2 hacia `/tesoreria/movimientos` V5 si Mockup atlas-tesoreria-v8 lo pide), (c) etiquetar "esporádico" para que C2/C3 puedan distinguirlo del real de un compromiso. Esto es 1 PR pequeño · cero riesgo de migración DB · valor inmediato al cliente.

**A continuación, C4 + C5 como pareja** porque sin C4 (versionar `salarioBrutoAnual` con `vigenciaDesde`) la atadura semi-automática de C5 se reduce a un overwrite destructivo del patrón. C4 implica un bump DB inevitable (añadir `vigenciaDesde` o un sub-array de cambios al tipo `Nomina` en store `ingresos`); por tanto recomendado planificar como DB v70 en una rama propia. C5 luego añade el matching desde movement huérfano (`movementSuggestionService.ts`) y el prompt UI de "¿actualizar patrón?" en el flujo de confirmación de evento `sourceType='nomina'`. C2 cuarto (cuando ya hay historial real fiable de varios meses con esporádicos clasificados y atadura nómina ajustada). C3 al final como techo consolidador.

**Pre-trabajo necesario antes de redactar spec C1:** decidir con Jose la pregunta de catálogo (granularidad categorías Personal · ¿cuántas y cuáles?) y la pregunta de UX (entry-point en `/tesoreria/movimientos` o seguir en `/conciliacion`). Sin esas dos respuestas, el spec C1 quedaría ambiguo.

---

## §12 · Anexos

### 12.1 · Greps ejecutados literales (reproducibilidad)

**Bloque 1 · patrón Personal stores:**
```bash
grep -rn "compromisosRecurrentes" src/services/ src/types/
grep -rn "ambito.*personal\|ambito.*'personal'" src/services/ src/types/
grep -rn "store.*ingresos\|STORE_INGRESOS\|'ingresos'" src/services/ src/types/
grep -rn "viviendaHabitual" src/services/ src/types/
grep -rn "presupuestos\|presupuestoLineas" src/services/ src/types/
find src/modules/personal -type f \( -name "*.tsx" -o -name "*.ts" \)
find src/pages/GestionPersonal -type f \( -name "*.tsx" -o -name "*.ts" \)
ls src/services/personal/
grep -rln "compromisosRecurrentesService\|nominaService\|otrosIngresosService\|viviendaHabitualService\|personalDataService" src/
```

**Bloque 1 · grep duro pages:**
```bash
for f in src/modules/personal/pages/*.tsx; do
  imports=$(grep -cE "import.*services?/" "$f")
  awaits=$(grep -cE "await.*\.(put|add|delete|update|save|create|crear|guardar|actualizar|eliminar)" "$f")
  toasts=$(grep -cE "showToast|alert\(|console\.log" "$f")
  echo "$f imports=$imports awaits=$awaits toasts=$toasts"
done
```

Resultados (líneas ejecutadas en this session):
```
PanelPage.tsx     lines=503  imports=0 awaits=0 toasts=2  (LECTURA-PURA · sub-página outlet context)
IngresosPage.tsx  lines=374  imports=0 awaits=0 toasts=3  (LECTURA-PURA)
GastosPage.tsx    lines=36   imports=2 awaits=0 toasts=0  (REAL · delega a ListadoGastos shared)
ViviendaPage.tsx  lines=990  imports=1 awaits=2 toasts=7  (REAL · guardarVivienda + eliminarVivienda)
PresupuestoPage   lines=184  imports=0 awaits=0 toasts=0  (LECTURA)
NuevoGastoRec     lines=1597 imports=4 awaits=2 toasts=5  (REAL · crearCompromiso + actualizarCompromiso)
DetectarCompromisosPage lines=1051 imports=2 awaits=1 toasts=5 (REAL · createCompromisosFromCandidatos)
PersonalPage.tsx  lines=145  imports=4 awaits=0 toasts=- (LECTURA · orquestador outlet)
```

**Bloque 2 · Real Personal:**
```bash
grep -rnE "db\.(put|add)\(['\"]movements['\"]" src/services/
grep -rnE "db\.(put|add)\(['\"]treasuryEvents['\"]" src/services/
grep -rln "csb43\|aeb43\|importBatches\|csbParser\|aebParser" src/services/ src/components/
grep -rln "movementLearningRules" src/
grep -nE "GASTO_PERSONAL_CATEGORIES\|INGRESO_PERSONAL_CATEGORIES" src/services/categoryCatalog.ts
```

**Bloque 3 · Comparativas:**
```bash
grep -rln "patron.*real\|previsto.*real\|esperado.*real\|forecast.*actual" src/pages/ src/components/ src/modules/
grep -rln "desviacion\|desviación\|deviation\|variance" src/pages/ src/components/ src/modules/
grep -rln "comparativa\|comparison" src/pages/ src/components/ src/modules/
grep -rln "compromisosRecurrentes.*movements\|movements.*compromisosRecurrentes" src/
```

**Bloque 4 · Mi Plan / Panel:**
```bash
ls src/modules/mi-plan/pages/
ls src/modules/panel/components/
grep -nE "^import" src/modules/mi-plan/pages/*.tsx
grep -nE "^import" src/modules/panel/PanelPage.tsx
grep -rln "coherencia\|coherence\|alineamiento\|alignment" src/modules/panel/ src/modules/mi-plan/
```

**Bloque 5 · Simulador libertad:**
```bash
find src -name "*libertad*"
grep -nE "^export.*function" src/services/libertadService.ts
grep -nE "^export.*function" src/services/escenariosService.ts
grep -rn "escenarios.*activo\|escenario.*libertad\|multiEscenario\|dosEscenarios" src/services/ src/modules/
```

**Bloque 6 · nómina hook:**
```bash
ls -la src/services/personal/nominaAportacionHook.ts
grep -rn "nominaAportacionHook" src/
grep -rn "matchNomina\|reconcileNomina\|conciliarNomina" src/services/
grep -nE "procesarConfirmacionEvento\|onNominaConfirmada\|nomina\|sourceType" src/services/treasuryConfirmationService.ts
grep -rln "tipo.*'nomina'\|'nomina'" src/services/
```

**Bloque 7 · esporádicos:**
```bash
grep -rln "Nuevo movimiento\|nuevo movimiento\|NewMovementModal\|AddMovementModal\|crearMovimiento\|createManualMovement" src/
grep -nE "AddMovementModal\|setShowAdd" src/modules/horizon/conciliacion/v2/ConciliacionPageV2.tsx
grep -nE "db\.(put|add)\|treasuryEvents\|movements\|categoria\|origen.*manual" src/modules/horizon/conciliacion/v2/components/AddMovementModal.tsx
```

### 12.2 · Notas de discrepancia con HANDOFF V8 / docs previos

| Asunción spec | Realidad código | Acción |
|---|---|---|
| "14 categorías personales" en catálogo | 1 sola (`gasto_personal`) en `GASTO_PERSONAL_CATEGORIES` + 2 ingresos donde 1 es `ambos` | Decidir granularidad antes de spec C1 |
| "C1 puede existir parcial" tamaño S-M | C1 existe a ~80% (AddMovementModal) tamaño REAL **XS-S** | Reducir tamaño y enfoque del spec |
| HANDOFF V8 estima C5 a M | C5 real M-L (depende de C4 y de UI nueva en confirmación) | Aumentar estimación |
| HANDOFF V8 estima C2 a L | C2 real L (sin sorpresa) | OK |
| HANDOFF V8 estima C3 a XL | C3 real XL (sin sorpresa, esqueleto reusable pero ámbito Personal nuevo + 2 escenarios + KPI Panel + módulos locales sigue siendo XL) | OK |

### 12.3 · No se ha entrado a inspeccionar DB en runtime · todas las afirmaciones provienen de grep duro y lectura de fuente.

### 12.4 · Modificaciones a `src/` durante este audit · CERO. Solo se ha creado este informe en `docs/audits/`.

---

**Fin del informe T-PERSONAL-AUDIT.**
