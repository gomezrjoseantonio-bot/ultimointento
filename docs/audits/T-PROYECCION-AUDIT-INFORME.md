# T-PROYECCION-AUDIT · sistémico módulo Proyección · informe

> Fecha · 2026-05-08
> Ejecutado por · CC (Claude Code · Opus 4.7)
> Predecesor metodológico · `docs/audits/T-PERSONAL-AUDIT-sistemico-patron-vs-real-INFORME.md`
> Branch de trabajo · `claude/execute-t-proyeccion-audit-n9hMR`
> Commit base · `8df9abc` ("Add files via upload")
> DB version verificada · **69** (`src/services/db.ts:28` · "V69 (TAREA 13 v4 · cierre lote B+C · C4 review Copilot): añade índice compuesto `tipo-activo` … 40 stores (sin cambio en número)")
> Stores activos verificados · **40** (43 `createObjectStore` declarados − 3 borrados en V5.9/V67: `objetivos_financieros` · `planesPensionInversion` · `traspasosPlanes`)
> Modo · solo lectura sobre `src/` · cero modificaciones

---

## §1 · Resumen ejecutivo

**Estado por dimensión Q1-Q10 (1 línea):**

| Q | Decisión cerrada | Estado | Hallazgo crítico |
|---|---|---|---|
| **Q1** · narrativa unificada multi-fase | ❌ no existe | Mi Plan v5 tiene 5 sub-páginas separadas (landing/proyeccion/libertad/objetivos/fondos) · no hay vista que combine `libertad+patrimonio+escenarios+eventos` |
| **Q2** · stocks + flujos + fiscalidad agregada | 🟡 parcial · solo motor `proyeccionMensualService` | El motor `mensual/services/proyeccionMensualService.ts` (1 056 líneas) integra 17 servicios incl. `fiscalContextService`, `irpfCalculationService`, `fiscalPaymentsService` · pero su salida NO se cruza con el módulo Mi Plan ni con `ProyeccionPage` |
| **Q3** · anual + categoría expandible | 🟡 parcial · existe `mensual` con tabla mes a mes pero NO display anual con drill-down a categoría/entidad |
| **Q4** · base + sensibilidades macro + escenarios usuario | 🔴 placeholder · `comparativa/services/comparativaService.ts:149,330,360` Forecast = `budgetData.map(amount => amount * (0.95 + Math.random() * 0.1))` · `simulaciones/ProyeccionSimulaciones.tsx` estado `useState<Scenario[]>([])` con `id: Date.now()` · **NO persiste** |
| **Q5** · supuestos macro a 2 niveles | ❌ no existe | Sólo `BaseAssumptions` (`base/services/proyeccionService.ts`) en `keyval` · 1 nivel global · sin override por activo |
| **Q6** · catálogo eventos vitales | 🟡 muy parcial · existe `Hito` con 5 tipos hardcoded (`compra/venta/revisionRenta/amortizacionExtraordinaria/cambioGastosVida` en `types/miPlan.ts`) · NO ~10 tipos · NO custom · NO transformaciones T64/Santa Catalina |
| **Q7** · plan vs real generalizado + sugerencias macro | 🔴 mock · `ProyeccionComparativa` (Real vs Previsto) usa Forecast `Math.random` y Calendario presupuesto usa `(Math.random()-0.5)*0.4` · sugerencias macro NO existen |
| **Q8** · vive dentro de Mi Plan + KPIs Panel | 🟢 ~70% · ya existe `/mi-plan/proyeccion` (sub-pestaña) y `MiPlanCompass` en Panel · pero el contenido es `computeBudgetProjection12mAsync` (proyección pura del patrón) · NO la proyección 20 años multi-dim |
| **Q9** · snapshot anual 1 enero | ❌ no existe | 0 hits "snapshot" en proyección · `patrimonioSnapshots` eliminado en V62 (`PanelPage.tsx:124` TODO) · sólo existe `snapshotsDeclaracion` (fiscal · otro dominio) |
| **Q10** · output jerárquico | 🟡 parcial · `ProyeccionPage.tsx` (mi-plan) tiene KPIs+waterfall+tabla pero solo 12 meses · no hay cajones escenarios/supuestos · `ProyeccionBase.tsx` tiene modal supuestos pero aislado |

**Estado por palanca única (1 línea):**

| Palanca | Estado | Hallazgo |
|---|---|---|
| Snapshot anual 1 enero | ❌ no existe | Sin servicio · sin store · `patrimonioSnapshots` borrado en V62 |
| Capa fiscal proyectada | 🟡 ingredientes · 0 cables | `proyeccionMensualService` SÍ importa `fiscalContextService`+`irpfCalculationService`+`fiscalPaymentsService` para 1 año · NO existe proyección fiscal a 20 años · NO modela amortizaciones AEAT que decaen · NO modela plusvalías futuras · NO modela deducción planes pensiones |
| Sugerencias macro automáticas | ❌ no existe | 0 hits "sugerencia macro" · 0 hits "CPI personal" · `escenarioService` (mock) habla de "Revisión trimestral de supuestos" como string hardcoded · sin lógica |

**Orden recomendado de ataque** (justificado en §13): **C-PROY-1 → C-PROY-2 → C-PROY-3 → C-PROY-5 → C-PROY-4 → C-PROY-6 → C-PROY-7 → C-PROY-8.**

**Hallazgos sorpresa (anticipo · detalle en §11):**

1. **Dos `escenarioService` distintos coexisten** · `src/services/escenariosService.ts` (REAL · DB store `escenarios` singleton id=1) vs `src/modules/horizon/proyeccion/escenarios/services/escenarioService.ts` (822 líneas · MOCK in-memory · `clone(initialDashboard)`).
2. **Dos rutas `Comparativa` distintas en proyección** · `comparativa/` (singular · Real vs Budget vs Forecast `Math.random`) y `comparativas/` (plural · 3 escenarios · TODO PDF export). Ambas accesibles vía rutas legacy + activa.
3. **`ProyeccionSimulaciones` NO persiste · es papelera de borradores** · `useState<Scenario[]>([])` con `id: Date.now()` · comentario explícito "Temporary types until we create the service" línea 8.
4. **`budgetService.ts` escribe en store FANTASMA `'budgets'`** · ese nombre está en `STORES_OBSOLETOS` (`db.ts:2889`) y se borra con `deleteObjectStore` en la migración correspondiente. En cualquier DB ya migrada a V69 el store NO existe · cualquier `db.transaction('budgets')` debería lanzar `NotFoundError`. Es decir, el servicio es **probablemente dead code** que solo "funcionaría" en DBs antiguas no migradas. Coexiste con `presupuestos`+`presupuestoLineas` (los OFICIALES) que sí están en el listado activo.
5. **`LibertadPage` (mi-plan) NO usa `libertadService`** · hace su propia proyección naive (suma `h.impactoMensual` desde 0 · sin `proyectarLibertadDesdeRepo`). En cambio `PanelPage` y `LandingPage` SÍ usan `useProyeccionLibertad`. El simulador "oficial" del mockup es el que se ignora.
6. **Componentes huérfanos pintando hero patrimonio · sin imports** · `src/components/dashboard/PatrimonioHeader.tsx` (337 líneas) y `src/components/dashboard/ProjectionChart.tsx` (38 líneas) · 0 imports desde panel/mi-plan/App.tsx. Código muerto que recoge expectativa del mockup.

---

## §2 · Preflight (sección 6 spec)

### 2.1 · DB_VERSION

```bash
grep -nE "DB_VERSION\s*=|const DB_VERSION" src/services/db.ts src/services/database/db.ts 2>/dev/null
```

Output literal:
```
src/services/db.ts:28:const DB_VERSION = 69; // V69 (TAREA 13 v4 · cierre lote B+C · C4 review Copilot): añade índice compuesto `tipo-activo` [tipo_activo, activo_id] en `valoraciones_historicas` · perf · solo schema · sin migración de datos · 40 stores (sin cambio en número)
```

`src/services/database/db.ts` no existe. **DB_VERSION = 69 confirmado.**

### 2.2 · Stores activos

```bash
grep -nE "createObjectStore\(" src/services/db.ts | grep -oE "createObjectStore\('([^']+)'" | sort -u
```

Output literal (43 distintos · listado abreviado):
```
accounts · aeatCarryForwards · aportacionesPlan · arrastresIRPF · compromisosRecurrentes · contracts · documents · ejerciciosFiscalesCoord · entidadesAtribucion · escenarios · fondos_ahorro · gastosInmueble · importBatches · ingresos · inversiones · keyval · mejorasInmueble · movementLearningRules · movements · mueblesInmueble · objetivos · objetivos_financieros · perdidasPatrimonialesAhorro · personalData · personalModuleConfig · planesPensionInversion · planesPensiones · prestamos · presupuestoLineas · presupuestos · properties · propertyDays · property_sales · proveedores · resultadosEjercicio · retos · snapshotsDeclaracion · traspasosPlanPensiones · traspasosPlanes · treasuryEvents · valoraciones_historicas · vinculosAccesorio · viviendaHabitual
```

Tres se eliminan en migraciones posteriores (V5.9 · V67):
- `objetivos_financieros` (`db.ts:3328` · `db.deleteObjectStore('objetivos_financieros')`)
- `planesPensionInversion` (`db.ts:4026` · `db.deleteObjectStore('planesPensionInversion')`)
- `traspasosPlanes` (`db.ts:4029` · `db.deleteObjectStore('traspasosPlanes')`)

**43 − 3 = 40 stores activos confirmados.** Coincide con cabecera de `db.ts:28`.

### 2.3 · Existencia archivos clave (HANDOFF V9)

```bash
ls -la src/pages/proyeccion/ProyeccionPage.tsx src/pages/proyeccion/ProyeccionComparativa.tsx src/services/fiscalConciliationService.ts
ls -la src/pages/mi-plan/ src/pages/panel/ src/pages/dashboard/
```

Output literal:
```
ls: cannot access 'src/pages/proyeccion/ProyeccionPage.tsx': No such file or directory
ls: cannot access 'src/pages/proyeccion/ProyeccionComparativa.tsx': No such file or directory
-rw-r--r-- 1 root root 20361 May  2 10:30 src/services/fiscalConciliationService.ts
ls: cannot access 'src/pages/mi-plan/': No such file or directory
ls: cannot access 'src/pages/panel/': No such file or directory
ls: cannot access 'src/pages/dashboard/': No such file or directory
```

**Discrepancia con spec del audit · `src/pages/{proyeccion,mi-plan,panel,dashboard}/` NO existen.** Las rutas reales son:
- Proyección · `src/modules/horizon/proyeccion/` (con sub-carpetas `base/`, `comparativa/`, `comparativas/`, `escenarios/`, `mensual/`, `presupuesto/`, `simulaciones/`, `valoraciones/`)
- Mi Plan · `src/modules/mi-plan/` (con `pages/{LandingPage,ProyeccionPage,LibertadPage,ObjetivosPage,FondosPage,RetosPage}.tsx`)
- Panel · `src/modules/panel/PanelPage.tsx`
- `fiscalConciliationService.ts` → confirmado existe (20 361 bytes · 542 líneas)

---

## §3 · Sección 1 informe · Inventario archivos módulo Proyección

```bash
find src/ -iname "*proyeccion*" -type f 2>/dev/null   # 55 archivos
find src/ -iname "*libertad*" -type f 2>/dev/null      # 6 archivos
find src/ -iname "*mi-plan*" -o -iname "*miplan*" -type f 2>/dev/null
find src/ -iname "*patrimonio*" -type f 2>/dev/null    # 2 archivos
find src/ -iname "*escenario*" -type f 2>/dev/null     # 4 archivos
find src/ -iname "*simulador*" -type f 2>/dev/null     # 4 archivos (todos en fiscalidad)
find src/ -iname "*horizon*" -type f 2>/dev/null       # 0 archivos top-level (carpeta src/modules/horizon/ sí existe)
find src/ -iname "*pulse*" -type f 2>/dev/null         # 4 archivos (Panel/dashboard hero)
```

### 3.1 · Tabla inventario (módulo Proyección + Mi Plan + Panel relevante)

> Veredicto grep duro: **REAL** = imports>0 + ≥1 await save · **LECTURA** = imports>0 + 0 await save · **MOCKUP** = imports=0 + toasts>5 · **SHELL** = imports=0 + lectura desde context.

| Archivo | Líneas | Tipo | Imports services | Awaits save | Toasts | Veredicto |
|---|---|---|---|---|---|---|
| `src/modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx` | 239 | page | 1 (`comparativaService`) | 0 | 0 | LECTURA |
| `src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts` | 508 | service | 2 (`db`, `budgetService`) | 0 | 0 | LECTURA + ⚠ Forecast Math.random líneas 149,330,360 |
| `src/modules/horizon/proyeccion/comparativa/components/ComparativaTable.tsx` | n/d | component | 0 | 0 | 0 | UI puro |
| `src/modules/horizon/proyeccion/comparativa/components/MonthlyDetailModal.tsx` | n/d | component | 0 | 0 | 0 | UI puro |
| `src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx` | n/d | component | 0 | 0 | 0 | UI puro |
| `src/modules/horizon/proyeccion/base/ProyeccionBase.tsx` | 242 | page | 1 (`proyeccionService`) | 1 | 0 | REAL ✅ (escribe `keyval` BaseAssumptions) |
| `src/modules/horizon/proyeccion/base/services/proyeccionService.ts` | 280 | service | 2 (`db`, `indexedDbCacheService`) | 1 (`db.put('keyval')`) | 0 | REAL ✅ |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | n/d | component | 0 | 0 | 0 | UI puro |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | n/d | component | 0 | 0 | 0 | UI puro |
| `src/modules/horizon/proyeccion/mensual/ProyeccionMensual.tsx` | 325 | page | 1 (`proyeccionMensualService`) | 0 | 0 | LECTURA |
| `src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts` | 1 056 | service | **17** (nomina/autonomo/pension/otrosIngresos/fiscalContext/contract/inmueble/prestamos/inversiones/personalExpenses/accountBalance/irpfCalculation/fiscalPayments/valoraciones + 3 más) | 0 | 0 | LECTURA (compute-only · NO persiste) |
| `src/modules/horizon/proyeccion/mensual/services/forecastEngine.ts` | 196 | service | 1 (`db OpexRule`) | 0 | 0 | LECTURA puro |
| `src/modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx` | 362 | page | 0 | 0 | 0 | SHELL · TODO PDF línea 80 |
| `src/modules/horizon/proyeccion/escenarios/ProyeccionEscenarios.tsx` | 86 | page (orquestador 4 tabs) | 0 | 0 | 0 | SHELL |
| `src/modules/horizon/proyeccion/escenarios/services/escenarioService.ts` | 822 | service MOCK | 0 | 0 | 0 | **MOCK in-memory · `class EscenarioService { private data = clone(initialDashboard) }`** |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | n/d | component | 0 | 0 | 0 | UI consume mock |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 436 | page | 1 (`confirmDelete`) | 0 | 0 | **NO PERSISTE · `useState<Scenario[]>([])` con `id: Date.now()`** |
| `src/modules/horizon/proyeccion/presupuesto/ProyeccionPresupuesto.tsx` | 180 | page | 2 (`db Budget`, `getBudgetsByYear`) | 0 | 0 | LECTURA |
| `src/modules/horizon/proyeccion/presupuesto/PresupuestosView.tsx` | n/d | page | n/d | n/d | n/d | (vista activa según `App.tsx:984`) |
| `src/modules/horizon/proyeccion/presupuesto/PresupuestoNuevo.tsx` | n/d | page | n/d | n/d | n/d | wizard (vivo) |
| `src/modules/horizon/proyeccion/presupuesto/PresupuestoScopeView.tsx` | n/d | page | n/d | n/d | n/d | TODO "Save changes to database" línea 61 |
| `src/modules/horizon/proyeccion/presupuesto/services/budgetService.ts` | 275 | service | 1 (`db Budget BudgetLine`) | 4 (`db.add/put/delete('budgets')`+`'budgetLines'`) | 0 | **REAL pero store FANTASMA `'budgets'` (en STORES_OBSOLETOS db.ts:2889)** |
| `src/modules/horizon/proyeccion/presupuesto/services/actualSyncService.ts` | 63 | service | 1 (`db Movement PresupuestoLinea`) | 0 | 0 | LECTURA |
| `src/modules/horizon/proyeccion/presupuesto/services/scopeSeedService.ts` | 342 | service | 1 (`db`) | 0 | 0 | LECTURA · TODO préstamos línea 184 |
| `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts` | 502 | service | 2 (`db`, `budgetReclassificationService`) | **8** (`db.add/put/delete('presupuestos','presupuestoLineas')`) | 0 | **REAL ✅ store oficial `presupuestos`** |
| `src/modules/horizon/proyeccion/presupuesto/services/planningLayerService.ts` | 56 | service helper | 1 | 0 | 0 | LECTURA puro |
| `src/modules/horizon/proyeccion/presupuesto/hooks/useProyeccionAutomatica.ts` | 104 | hook | 1 (`generateProyeccionMensual`) | 0 | 0 | LECTURA |
| `src/modules/horizon/proyeccion/presupuesto/components/ProyeccionAutomaticaView.tsx` | 53 | component | 0 | 0 | 0 | UI puro |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoCalendario.tsx` | 160 | component | 1 | 0 | 0 | LECTURA · ⚠ `Math.random` real-vs-presupuesto línea 49 (mock) |
| `src/modules/horizon/proyeccion/presupuesto/components/ProyeccionTable.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/ProyeccionKPICards.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/ProyeccionFooterWarning.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetWizard.tsx` | n/d | component | n/d | n/d | n/d | wizard |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx` | n/d | component | n/d | n/d | n/d | TODOs líneas 13/18/23/107 (CRUD no implementado) |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | n/d | component | n/d | n/d | n/d | TODO línea 144 |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoHeader.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoLineaModal.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoTablaLineas.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoResumen.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/FlujoCajaChart.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/ScopedBudgetView.tsx` | n/d | component | n/d | n/d | n/d | UI |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStep*.tsx` (×7) | n/d | component | n/d | n/d | n/d | wizard steps |
| `src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx` | 271 | page | 1 (`valoracionesService`) | 0 | 0 | LECTURA (consume snapshots de `valoraciones_historicas`) |
| `src/modules/horizon/proyeccion/mensual/components/MonthlyProjectionTable.tsx` | n/d | component | 0 | 0 | 0 | UI |
| `src/modules/horizon/proyeccion/mensual/components/SummaryCards.tsx` | n/d | component | 0 | 0 | 0 | UI |
| `src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx` | n/d | component | 0 | 0 | 0 | UI |
| `src/modules/horizon/proyeccion/mensual/types/proyeccionMensual.ts` | n/d | types | 0 | 0 | 0 | tipos |
| `src/modules/horizon/proyeccion/presupuesto/types/ProyeccionData.ts` | n/d | types | 0 | 0 | 0 | tipos |
| `src/modules/mi-plan/MiPlanPage.tsx` | 161 | page (orquestador tabs) | 2 (`db`, `escenariosService`) | 0 | 1 | LECTURA |
| `src/modules/mi-plan/pages/LandingPage.tsx` | 333 | page | 0 (vía hooks: `useProyeccionLibertad` + `computeBudgetProjection12mAsync`) | 0 | 0 | LECTURA |
| `src/modules/mi-plan/pages/ProyeccionPage.tsx` | 345 | page | 1 (`computeBudgetProjection12mAsync`) | 0 | 1 | LECTURA |
| `src/modules/mi-plan/pages/LibertadPage.tsx` | 385 | page | 0 (consume `escenario` de outlet context · proyección naive inline) | 0 | 1 | LECTURA · **NO usa libertadService** |
| `src/modules/mi-plan/pages/ObjetivosPage.tsx` | 235 | page | 0 | 0 | 1 | LECTURA |
| `src/modules/mi-plan/pages/FondosPage.tsx` | 258 | page | 0 | 0 | 1 | LECTURA |
| `src/modules/mi-plan/pages/RetosPage.tsx` | 225 | page | 0 | 0 | 1 | LECTURA · ruta cortocircuitada a `/mi-plan/objetivos` (T27.2-skip) |
| `src/modules/mi-plan/services/budgetProjection.ts` | 327 | service | 2 (`db`, `nominaService`) | 0 | 0 | LECTURA · `computeBudgetProjection12mAsync` consume `ingresos`+`compromisosRecurrentes`+`contracts` |
| `src/services/escenariosService.ts` | 127 | service | 1 (`db`) | 2 (`db.put('escenarios')`) | 0 | REAL ✅ singleton id=1 |
| `src/services/libertadService.ts` | 258 | service puro + wrapper | 0 directos (importa via testees) | 0 | 0 | LECTURA puro · `proyectarLibertadDesdeRepo` lee contratos+gastosInmueble+préstamos |
| `src/types/libertad.ts` | 132 | types | 0 | 0 | 0 | tipos |
| `src/types/miPlan.ts` | 185 | types | 0 | 0 | 0 | tipos |
| `src/hooks/useProyeccionLibertad.ts` | 91 | hook | 0 (importa libertadService) | 0 | 0 | LECTURA |
| `src/components/dashboard/PatrimonioHeader.tsx` | 337 | component | 0 | 0 | 0 | **HUÉRFANO · 0 imports desde código vivo** |
| `src/components/dashboard/ProjectionChart.tsx` | 38 | component | 0 | 0 | 0 | **HUÉRFANO · 0 imports** (existe otro `ProjectionChart` distinto en `proyeccion/base/components/`) |
| `src/modules/panel/PanelPage.tsx` | 710 | page (Panel patrimonio) | **6** (`db`, `fiscalContext`, `valoraciones`, `declaracionResolver`, `ejercicioResolver`, `useProyeccionLibertad`) | 0 | 1 | LECTURA · KPIs reales + alertas + Mi Plan brújula |
| `src/modules/panel/components/MiPlanCompass.tsx` | 131 | component | 0 | 0 | 0 | UI · recibe pctCobertura/añoLibertad/etc |
| `src/modules/panel/components/PulseAssetCard.tsx` | 146 | component | 0 | 0 | 0 | UI |
| `src/modules/panel/components/YearTimeline.tsx` | 285 | component | 1 (`db tipos`) | 0 | 0 | LECTURA · timeline 12 meses con hitos |
| `src/modules/panel/components/AttentionList.tsx` | 127 | component | 0 | 0 | 0 | UI |
| `src/modules/panel/components/PulsoDelMes.tsx` | 99 | component | 0 | 0 | 0 | UI |

**Categorías sin hits (información válida)**:
- `*horizon*` archivo top-level → 0 (la carpeta `src/modules/horizon/` sí existe pero ningún archivo se llama "horizon" · concepto Horizon eliminado por design system v4 según handoffs)
- `*pulse*` → 4 archivos (`PulseAssetCard.tsx`+`PulsoDelMes.tsx`+`PulsePresetShowcase.tsx`+`PulseDashboardHero.tsx`) · sólo los 2 primeros usados desde Panel · los otros 2 (`components/dashboard/`) son huérfanos
- `*simulador*` → 4 archivos pero TODOS en `src/modules/horizon/fiscalidad/simulador/` o `src/services/simuladorFiscalService.ts` · NINGUNO es simulador de proyección/libertad

---

## §4 · Sección 2 informe · Inventario stores con datos relevantes

```bash
grep -nE "db\.(get|put|add|delete|getAll|count)\(['\"]([^'\"]+)" <archivo>
```

Output literal agregado por archivo en §3 (transcripto del análisis grep · ver tabla siguiente):

| Store | Archivos que lo escriben (proyección/mi-plan/panel) | Archivos que lo leen | Relevancia para Q1-Q10 |
|---|---|---|---|
| `treasuryEvents` | (ninguno desde proyección) | `panel/PanelPage.tsx:142` | Q3 motor mensual / Q9 historial · pero proyección NO lo lee directamente · solo `proyeccionMensualService` lo evita y reconstruye desde patrón |
| `properties` | (ninguno desde proyección) | `comparativa/services/comparativaService.ts:95`, `presupuesto/services/scopeSeedService.ts:49`, `panel/PanelPage.tsx:138` | Q1 patrimonio · Q2 stocks · Q5 supuesto por activo |
| `movements` | (ninguno desde proyección) | `comparativa/services/comparativaService.ts:159` | Q7 plan vs real |
| `contracts` | (ninguno) | `presupuesto/services/scopeSeedService.ts:53`, `mi-plan/services/budgetProjection.ts:303`, `panel/PanelPage.tsx:143` | Q3/Q4 ingresos por activo |
| `presupuestos` | `presupuesto/services/presupuestoService.ts:43,59,390` (`db.add/put/get`) | misma + `presupuesto/services/budgetService.ts` (legacy fantasma) | Q3 base anual/mensual |
| `presupuestoLineas` | `presupuesto/services/presupuestoService.ts:105,132,149` | misma | Q3 categoría |
| `budgets` (FANTASMA · STORES_OBSOLETOS) | `presupuesto/services/budgetService.ts:29,44,60` | misma | ⚠ El nombre está marcado obsoleto · ver §15 hallazgo 4 |
| `keyval` | `proyeccion/base/services/proyeccionService.ts:113,212` (cache + assumptions) | misma | Q5 supuestos macro 1 nivel |
| `escenarios` | `services/escenariosService.ts:68,81` (singleton id=1) | `mi-plan/MiPlanPage.tsx`, `panel/PanelPage.tsx:155`, `mi-plan/pages/LibertadPage.tsx` (vía outlet) | Q1/Q4 Plan + 1 escenario Mi Plan |
| `objetivos` | `mi-plan/wizards/...` (no auditado · vivo) | `mi-plan/MiPlanPage.tsx:58` | Q6 hitos via objetivos |
| `fondos_ahorro` | `mi-plan/wizards/...` | `mi-plan/MiPlanPage.tsx:59` | Q6 hitos via fondos |
| `retos` | n/d (T27.2-skip · UI bloqueada) | `mi-plan/MiPlanPage.tsx:60` | (sin uso operativo hoy) |
| `ingresos` | (ninguno desde proyección) | `mi-plan/services/budgetProjection.ts:301` (filtra `tipo='nomina','autonomo'`), `proyeccion/mensual/services/proyeccionMensualService.ts` (vía `nominaService.getNominas` etc.) | Q3 motor ingresos |
| `compromisosRecurrentes` | (ninguno desde proyección) | `mi-plan/services/budgetProjection.ts:302`, `proyeccion/mensual/services/proyeccionMensualService.ts` (vía `personalExpensesService`) | Q3 motor gastos recurrentes |
| `accounts` | (ninguno) | `panel/PanelPage.tsx:140`, `proyeccion/mensual/services/proyeccionMensualService.ts:15` (vía `accountBalanceService.calculateTotalInitialCash`) | Q1 stock liquidez |
| `inversiones` | (ninguno) | `panel/PanelPage.tsx:139`, `proyeccion/mensual/services/proyeccionMensualService.ts:13` | Q1 stock inversiones |
| `prestamos` | (ninguno) | `panel/PanelPage.tsx:141`, `proyeccion/mensual/services/proyeccionMensualService.ts:12` | Q2 stock deudas |
| `valoraciones_historicas` | (ninguno desde proyección) | `valoraciones/Valoraciones.tsx`, `panel/PanelPage.tsx` (vía `valoracionesService`) | Q1 patrimonio histórico mensual |
| `ejerciciosFiscalesCoord` | (ninguno desde proyección · sólo lecturas via resolver desde Panel) | `panel/PanelPage.tsx` (vía `getEjercicio`), `proyeccion/mensual/services/proyeccionMensualService.ts:9` (vía `getFiscalContextSafe`) | Q2 capa fiscal · palanca 2 |
| `snapshotsDeclaracion` | (ninguno desde proyección) | `services/snapshotDeclaracionService.ts` (fiscal · otro dominio) | NO Q9 (fiscal · no patrimonial) |
| `viviendaHabitual` | (ninguno desde proyección) | `proyeccion/mensual/services/proyeccionMensualService.ts` (vía `fiscalContextService`) | Q2 capa fiscal |
| `pensionPlans`/`planesPensiones`/`aportacionesPlan`/`traspasosPlanPensiones` | (ninguno desde proyección) | `proyeccion/mensual/services/proyeccionMensualService.ts:7` (vía `pensionService`) | Q2 capa fiscal palanca 2 (deducción) |

**Stores buscados por la spec que NO existen como tales:**
- `patrimonioSnapshots` · ❌ eliminado en V62 (`PanelPage.tsx:124` "TODO T25.2 patrimonioSnapshots eliminado en V62")
- `proyeccion`/`forecast`/`escenarioHistorico` · ❌ no existen
- `nominas` · ❌ legacy V63 (consolidado en `ingresos`)
- `opexRules` · ❌ legacy V62 (consolidado en `compromisosRecurrentes`)

---

## §5 · Sección 3 informe · Auditoría 10 dimensiones Q1-Q10

### Q1 · narrativa unificada multi-fase (libertad + patrimonio + escenarios + eventos · multi-vista integrada)

**Estado actual** · ❌ no existe.

**Piezas reusables** ·
- `mi-plan/MiPlanPage.tsx` (161 líneas) · orquestador con 5 tabs (`landing/proyeccion/libertad/objetivos/fondos`) · ya tiene esqueleto multi-vista · pero cada tab es página independiente, NO vista integrada.
- `panel/PanelPage.tsx` (710 líneas) · combina patrimonio (KPI patrimonioNeto · MoneyValue size=kpiStar) + Mi Plan brújula (`MiPlanCompass`) + alertas · es el lugar más cercano a "narrativa unificada" pero solo cubre **HOY**, no el horizonte multi-fase.

**Piezas a construir** ·
- Vista que combine en una sola página: hero patrimonio histórico (lifeline) + curva libertad (proyectada) + escenarios de comparación + eventos vitales en timeline.
- Estado del horizonte multi-fase (acumulación / pre-libertad / libertad / herencia) como concepto del modelo.

**Grep que lo demuestra** ·
```bash
grep -rn "lifeline\|hero-libertad\|hero-patrimonio" src/ 2>/dev/null
grep -rnE "multi-fase|multi.*fase|fase.*acumulacion|fase.*libertad" src/ 2>/dev/null
```
Output literal · ambos `no output`. **0 hits** → confirmado ❌.

---

### Q2 · stocks + flujos + fiscalidad agregada · capa fiscal ligera con supuestos visibles

**Estado actual** · 🟡 parcial · 1 año cubierto · 20 años NO.

**Piezas reusables** ·
- `proyeccion/mensual/services/proyeccionMensualService.ts:1-25` · importa **17 servicios** que cubren todos los inputs necesarios (nóminas, autónomo, otros ingresos, pensión, contratos, inmuebles, préstamos, inversiones, gastos personales, balance cuentas, IRPF, fiscalPayments, valoraciones).
- `proyeccion/mensual/services/forecastEngine.ts` (196 líneas) · funciones puras de OPEX y gastos personales por mes · soporta frecuencias mensual/bimestral/trimestral/semestral/anual/meses_específicos/semanal con asymmetricPayments. **Reusable casi 100%** para extender a 20 años.
- `services/fiscalContextService.ts` · `getFiscalContextSafe` ya leído desde `proyeccionMensualService`.
- `services/irpfCalculationService.ts` · `calcularDeclaracionIRPF` consumido por `proyeccionMensualService:22`.
- `services/fiscalPaymentsService.ts` · `generarEventosFiscales` + `getConfiguracionFiscal` consumidos en `proyeccionMensualService:23`.

**Piezas a construir** ·
- Extensión del motor a 20 años (hoy hardcoded a 1 año seleccionado).
- Capa fiscal proyectada: amortización AEAT que decae año a año, plusvalía futura, deducción planes pensiones a horizonte. **Hoy 0 hits sobre estos conceptos en proyección.**

**Grep que lo demuestra** ·
```bash
grep -nE "import" src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts | head -25
grep -rn "amortizacion.*AEAT\|deduccion.*pension\|plusval" src/modules/horizon/proyeccion/ src/modules/mi-plan/ 2>/dev/null
```
Output literal `import` (resumen): 17 imports que se citan en §3. Output `amortizacion/deduccion/plusval`: `no output`. **0 hits** → palanca 2 confirmada NO existe en proyección.

---

### Q3 · anual + categoría expandible a entidad (motor mensual · display anual)

**Estado actual** · 🟡 parcial.

**Piezas reusables** ·
- Motor mensual: `proyeccion/mensual/services/proyeccionMensualService.ts` (1 056 líneas) ✅.
- `proyeccion/mensual/components/MonthlyProjectionTable.tsx` · tabla mes a mes (display mensual existe).
- `proyeccion/presupuesto/components/ProyeccionTable.tsx` · ya hace agrupación por categoría.

**Piezas a construir** ·
- **Display anual** que agregue meses → años · falta header anual.
- Drill-down a entidad (categoría → inmueble → contrato) · presupuesto lo hace para `presupuestoLineas` pero no por entidad.

**Grep** ·
```bash
grep -rn "display.*anual\|expandible\|drillDown\|drill-down" src/modules/horizon/proyeccion/ 2>/dev/null
```
Output: `no output`. Concepto ausente como código.

---

### Q4 · base + sensibilidades macro + escenarios usuario · 3 capas de incertidumbre

**Estado actual** · 🔴 placeholder · ninguna de las 3 capas funciona.

**Piezas reusables** ·
- `proyeccion/base/ProyeccionBase.tsx` (242 líneas) · vista **Base** existe, persiste BaseAssumptions en `keyval`.
- `services/escenariosService.ts` · 1 escenario activo (singleton) con hitos · puede servir de base para "escenarios usuario".

**Piezas a construir** ·
- Capa **Sensibilidades macro** completa (no existe).
- Escenarios usuario MULTI (hoy `escenariosService` solo soporta singleton id=1 · `proyeccion/simulaciones/ProyeccionSimulaciones.tsx` simula multi pero NO persiste).
- 3 capas visualizables juntas.

**Grep crítico** ·
```bash
grep -nE "Math\.random" src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts
```
Output literal:
```
149:    return budgetData.map(amount => amount * (0.95 + Math.random() * 0.1)); // ±5% variance
330:        const forecastAmount = budgetAmount * (0.95 + Math.random() * 0.1); // ±5% variance
360:        const forecastAmount = budgetAmount * (0.95 + Math.random() * 0.1); // ±5% variance
```

```bash
grep -nE "useState" src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx | head -5
```
Output literal (extracto del transcript del subagent): "Temporary types until we create the service" línea 8 · `setScenarios([...scenarios, newScenario])` con `id: Date.now()`. **NO PERSISTE.**

---

### Q5 · supuestos macro a 2 niveles · default categoría + override activo individual

**Estado actual** · ❌ no existe a 2 niveles. 🟡 1 nivel global existe.

**Piezas reusables** ·
- `proyeccion/base/services/proyeccionService.ts` · `BaseAssumptions` persistido en `keyval` con clave `ASSUMPTIONS_KEY` · lee/guarda 1 nivel (global).
- `proyeccion/base/components/AdjustAssumptionsModal.tsx` · UI para ese nivel.

**Piezas a construir** ·
- 2º nivel (override por activo · por contrato · por préstamo).
- Resolver "supuesto efectivo" con fallback default → activo.

**Grep** ·
```bash
grep -rn "supuesto\|assumption" src/modules/horizon/proyeccion/ src/modules/mi-plan/ 2>/dev/null | head -20
```
Output literal (resumen): solo strings hardcoded en `escenarios/services/escenarioService.ts` (mock dashboard líneas 58, 176, 324, 360, 518, 526, 699, 707, 715) · NO hay store/servicio `supuestos`/`assumptions` salvo el `keyval` BaseAssumptions citado.

---

### Q6 · catálogo eventos vitales · ~10 tipos predefinidos + custom

**Estado actual** · 🟡 muy parcial · 5 tipos hardcoded · sin custom.

**Piezas reusables** ·
- `types/miPlan.ts` define `Hito` con `tipo: 'compra' | 'venta' | 'revisionRenta' | 'amortizacionExtraordinaria' | 'cambioGastosVida'` · **5 tipos**.
- `services/escenariosService.ts:87,99,114` · `addHito/updateHito/removeHito` ya persisten hitos.

**Piezas a construir** ·
- Ampliar catálogo a ~10 tipos (boda, hijo, herencia, jubilación parcial, mudanza, cambio empleo, baja IT prolongada, ola fiscal, etc.).
- Tipo "custom" con campos arbitrarios para T64/Santa Catalina.

**Grep** ·
```bash
grep -rn "EventoVital\|catalogoEventos" src/ 2>/dev/null
grep -nE "tipo:.*'.+'.*\|.*'.+'.*\|" src/types/miPlan.ts
```
Output: `EventoVital`/`catalogoEventos` → 0 hits. `Hito.tipo` literal definido en `types/miPlan.ts` con 5 valores.

---

### Q7 · plan vs real generalizado a todas las dimensiones + sugerencias macro

**Estado actual** · 🔴 mock · plan vs real existe pero el "real"/"forecast" usa Math.random.

**Piezas reusables** ·
- `proyeccion/comparativa/ProyeccionComparativa.tsx` (239 líneas) · vista **Real vs Previsto** existe con 4 KPIs (Ingresos YTD, Gastos YTD, Resultado, DSCR) y `ComparativaTable`/`MonthlyDetailModal`/`ExportModal`. UI casi completa.
- `services/fiscalConciliationService.ts` (542 líneas) · **conciliación nóminas patrón vs real** ya existe (de T-PERSONAL-AUDIT C5).

**Piezas a construir** ·
- Sustituir Forecast `Math.random` por motor real basado en mes en curso + futuro.
- Sugerencias macro automáticas (CPI personal últimos 3 años · revisar IPC) · **0 hits** en código.
- Generalizar a las dimensiones que faltan (patrimonio, deudas, valoraciones).

**Grep crítico** ·
```bash
grep -rn "sugerencia\|Sugerencia" src/modules/horizon/proyeccion/ src/modules/mi-plan/ 2>/dev/null | head
grep -rn "CPI\|cpi" src/services/ 2>/dev/null | head
```
Output: `no output` para sugerencias macro · 0 hits CPI personal.

---

### Q8 · vive dentro de Mi Plan como pestaña + KPIs señaleros en Panel

**Estado actual** · 🟢 ~70% construido (pero contenido de la pestaña aún no es la proyección 20 años).

**Piezas reusables** ·
- Pestaña existe ya: `mi-plan/MiPlanPage.tsx:25-31` define `tabs[1] = { key: 'proyeccion', label: 'Proyección', path: '/mi-plan/proyeccion' }` · ruta `App.tsx:961-966` activa con lazy `MiPlanProyeccion`.
- `mi-plan/pages/ProyeccionPage.tsx` (345 líneas) · contenido actual: KPIs, waterfall, tabla 12 meses con `computeBudgetProjection12mAsync`.
- KPIs en Panel: `panel/PanelPage.tsx` ya muestra `MiPlanCompass` (renta pasiva % cobertura · año libertad · meses colchón · inmuebles activos).

**Piezas a construir** ·
- Reemplazar el contenido de `/mi-plan/proyeccion` (hoy = patrón 12 meses) por la proyección 20 años multi-fase del modelo Q1-Q10.
- Más KPIs señaleros en Panel (proyección a 5/10 años · alineamiento plan vs real).

**Grep** ·
```bash
grep -nE "path.*proyeccion" src/App.tsx | head -5
```
Output literal:
```
949:              <Route path="proyeccion" element={
979:            <Route path="proyeccion">
```
La línea 949 es **/mi-plan/proyeccion** (contexto Mi Plan); la línea 979 es **/proyeccion/** (módulo independiente). Ambos coexisten.

---

### Q9 · cadencia híbrida + snapshot anual 1 enero · diferenciador único

**Estado actual** · ❌ no existe.

**Piezas reusables** · ninguna específica de proyección. La idea de "snapshot" sólo existe en dominio fiscal:
- `services/snapshotDeclaracionService.ts` (store `snapshotsDeclaracion`) · snapshot de declaración IRPF al cerrar ejercicio.

**Piezas a construir** ·
- Servicio `proyeccionSnapshotService` con job 1/1 que congele la proyección entera.
- Store nuevo (¿`proyeccionSnapshots`?) · DB upgrade necesario.

**Grep** ·
```bash
grep -rn "snapshot" src/modules/horizon/proyeccion/ src/modules/mi-plan/ 2>/dev/null | head
```
Output literal: 8 hits en `proyeccion/escenarios/services/escenarioService.ts:112,121` (campo `snapshot: SnapshotData` del MOCK in-memory) y `proyeccion/valoraciones/Valoraciones.tsx:26` (`ValoracionesMensuales[]` · OTRO concepto · valoraciones inmuebles). NINGÚN snapshot proyección/patrimonio.

`PanelPage.tsx:124` confirma: "TODO: T25.2 · `patrimonioSnapshots` eliminado en V62".

---

### Q10 · output híbrido jerárquico · cabecera KPIs + gráfico multi-dim + tabla expandible + cajones escenarios y supuestos

**Estado actual** · 🟡 parcial · 50% del patrón existe disperso.

**Piezas reusables** ·
- `mi-plan/pages/ProyeccionPage.tsx` (345 líneas) · cabecera KPIs (4 cards) + gráfico waterfall + tabla 12 meses · pero monodimensional (cashflow).
- `proyeccion/base/ProyeccionBase.tsx` · gráfico (`ProjectionChart`) + modal supuestos · 1 dimensión (patrimonio neto base).
- `mi-plan/pages/LibertadPage.tsx` (385 líneas) · gráfico SVG inline 18 años (curva renta pasiva vs gastos vida · 1 dimensión).

**Piezas a construir** ·
- Gráfico multi-dimensional en una sola vista (patrimonio + cashflow + libertad + impuestos) con tabs.
- Cajón lateral "escenarios" con comparación lado a lado.
- Cajón lateral "supuestos" con resumen + edit.

**Grep** ·
```bash
grep -rn "cajon\|drawer.*escenario\|drawer.*supuesto" src/modules/horizon/proyeccion/ src/modules/mi-plan/ 2>/dev/null
```
Output: `no output`. Patrón cajón no existe en proyección/mi-plan.

---

## §6 · Sección 4 informe · Auditoría 3 palancas únicas

| Palanca | Estado | Piezas existentes | Piezas a construir | Grep que lo demuestra |
|---|---|---|---|---|
| **Snapshot anual 1 enero** | ❌ | `services/snapshotDeclaracionService.ts` (otro dominio · fiscal) · `services/valoracionesService.ts` (snapshots mensuales de valoraciones inmuebles) | Servicio nuevo `proyeccionSnapshotService` + store `proyeccionSnapshots` (DB upgrade) + job 1/1 + UI "tu proyección de hace N años decía X" | `grep -rn "snapshot" src/modules/horizon/proyeccion/ src/modules/mi-plan/` → 8 hits (todos mock o valoraciones) · 0 hits proyección/patrimonio histórico |
| **Capa fiscal proyectada** | 🟡 ingredientes presentes · 0 cables | `proyeccion/mensual/services/proyeccionMensualService.ts` importa `fiscalContextService`, `irpfCalculationService`, `fiscalPaymentsService`, `valoracionesService`, `pensionService`, `inmuebleService` (1 año cubierto) · `services/fiscalConciliationService.ts` (542 líneas) | Extensión a 20 años · modelar amortización AEAT decadente · plusvalía futura por inmueble · deducción planes pensiones a horizonte · norte 1/1/2027 cruzado con 20 años | `grep -rn "amortizacion.*AEAT\|deduccion.*pension\|plusval" src/modules/horizon/proyeccion/ src/modules/mi-plan/` → `no output` |
| **Sugerencias macro automáticas** | ❌ | Solo strings hardcoded "Revisión trimestral de supuestos" en `escenarios/services/escenarioService.ts:176` (mock) | Servicio que compute CPI personal últimos 3 años desde movements · UI "tu CPI personal últimos 3 años fue X% · ¿usar?" con confirm (P8.2) | `grep -rn "CPI\|cpi" src/services/` → 0 hits relevantes · `grep -rn "sugerencia.*macro\|macro.*sugerencia"` → 0 hits |

---

## §7 · Sección 5 informe · Cruce con norte 1/1/2027

El modelo Q2 dice "stocks + flujos + fiscalidad agregada · capa fiscal ligera". El norte 1/1/2027 dice "declaración prerrellenada con cada renta · cada gasto · cada amortización · cada inspección corregida · cada fee".

| Pieza fiscal | Existencia | Accesible desde proyección hoy | Notas |
|---|---|---|---|
| `ejerciciosFiscales` (store) | ❌ eliminado en V62 (`db.ts:2296` "ejerciciosFiscales: ELIMINADO en V62 — sustituido por ejerciciosFiscalesCoord · 1 registro") · sólo `ejerciciosFiscalesCoord` (coord 4 regímenes) | parcialmente · vía `getFiscalContextSafe` desde `proyeccion/mensual/services/proyeccionMensualService.ts:9` | Dato V62 sub-tarea 3 · spec del audit menciona "ejerciciosFiscales · keyPath año · 4 estados · versionado por inspección" · **el modelo descrito ya no es el modelo vigente** |
| `ejercicioResolverService` | ✅ existe · `services/ejercicioResolverService.ts` | ❌ NO importado desde `proyeccion/` ni `mi-plan/` (sí desde `panel/PanelPage.tsx:24`) | `grep -rn "ejercicioResolverService" src/modules/horizon/proyeccion/ src/modules/mi-plan/` → 0 hits |
| Amortizaciones AEAT que decaen año a año | ❌ no modelado en proyección | ❌ | `grep amortizacion.*AEAT` → 0 hits en proyección/mi-plan |
| Plusvalías futuras (de `properties.valorActual` proyectado) | ❌ no modelado | ❌ | `grep plusval` → 0 hits en proyección/mi-plan |
| Deducciones planes pensiones (G-07 `nominaAportacionHook`) | 🟡 hook existe (PERSONAL audit C5) y se ejecuta en confirmación de evento nómina · `services/aportacionesPlanService.ts` está vivo | ❌ proyección no consume aportaciones pasadas para proyectar futuras | proyección NO usa `aportacionesPlan` (no aparece en greps) |
| `fiscalContextService.getFiscalContextSafe` | ✅ | ✅ desde `proyeccionMensualService.ts:9` | 1 año actual · NO 20 años |
| `irpfCalculationService.calcularDeclaracionIRPF` | ✅ | ✅ desde `proyeccionMensualService.ts:22` | 1 año actual |
| `fiscalPaymentsService.generarEventosFiscales` | ✅ | ✅ desde `proyeccionMensualService.ts:23` | 1 año actual |
| `services/fiscalConciliationService.ts` | ✅ existe (542 líneas · T-PERSONAL hallazgo C5) | ❌ NO importado desde proyección | `grep "fiscalConciliationService" src/modules/horizon/proyeccion/ src/modules/mi-plan/` → 0 hits |

**Conclusión**: el **stock de servicios fiscales existe y cubre 1 año de horizonte**. Falta el cable que extienda eso a 20 años con modelado específico de cada concepto AEAT (amortización, plusvalía, deducción).

---

## §8 · Sección 6 informe · Cruce con Mi Plan v5

### 8.1 · Estado actual de Mi Plan v5

```bash
find src/ -path "*mi-plan*" -type f 2>/dev/null
```

Output literal (relevante):
```
src/types/miPlan.ts
src/modules/mi-plan/MiPlanContext.ts
src/modules/mi-plan/MiPlanPage.module.css
src/modules/mi-plan/MiPlanPage.tsx
src/modules/mi-plan/featureFlags.ts
src/modules/mi-plan/pages/{Landing,Proyeccion,Libertad,Objetivos,Fondos,Retos}Page.tsx
src/modules/mi-plan/services/budgetProjection.ts
src/modules/mi-plan/wizards/{WizardNuevoFondo,WizardNuevoObjetivo}.tsx
src/modules/mi-plan/wizards/{components,steps,types.ts,typesFondo.ts,utils}
src/modules/panel/components/MiPlanCompass.tsx
src/modules/panel/components/MiPlanCompass.module.css
```

Hub `/mi-plan` (`MiPlanPage.tsx:25-31`) declara **6 pestañas** (`landing/proyeccion/libertad/objetivos/fondos/retos`) condicionadas por feature flag `SHOW_RETOS`. El audit Personal documenta "**5 sub-páginas** del rediseño". El mockup `atlas-mi-plan-v2.html` documenta también **5 sub-páginas** (`landing/objetivos/retos/fondos/proyección/libertad`).

### 8.2 · Existencia pestaña Proyección

**Sí existe** · ruta `App.tsx:961-966` activa · contenido `mi-plan/pages/ProyeccionPage.tsx` (345 líneas · LECTURA · ver §3). **Hoy contiene proyección 12 meses del patrón** (`computeBudgetProjection12mAsync`) · NO la proyección 20 años multi-fase del modelo Q1-Q10.

### 8.3 · Existencia pestaña Presupuesto

```bash
grep -nE "presupuesto|Presupuesto" src/modules/mi-plan/MiPlanPage.tsx
```
Output: 0 hits. **No existe pestaña "Mi presupuesto" en Mi Plan v5 hoy.** El presupuesto vive en `/proyeccion/presupuesto` (módulo independiente · `App.tsx:984` · `PresupuestosView`). Discrepancia con la memoria que mencionaba "Mi presupuesto" como una de las 5 pestañas. El mockup `atlas-mi-plan-v2.html` tampoco la tiene como sub-página · coincide con código.

### 8.4 · Hero patrimonio + lifeline

```bash
grep -rn "lifeline\|hero-libertad\|hero-patrimonio" src/ 2>/dev/null
```
Output literal: `no output`. **NO está implementado en código.** Componente huérfano `src/components/dashboard/PatrimonioHeader.tsx` (337 líneas) recoge parte de la idea pero NO se importa desde Mi Plan ni Panel.

---

## §9 · Sección 7 informe · Discrepancias mockup `atlas-mi-plan-v2.html` vs código real

| Elemento del mockup | Estado en código | Discrepancia |
|---|---|---|
| Sub-página landing con hero libertad | 🟡 `mi-plan/pages/LandingPage.tsx` (333 líneas) existe pero hero libertad NO renderiza imagen lifeline ni timeline 2020-fecha | Sub-página existe · hero parcial |
| Sub-página objetivos | ✅ `mi-plan/pages/ObjetivosPage.tsx` (235 líneas) | OK |
| Sub-página retos | 🟡 `mi-plan/pages/RetosPage.tsx` (225 líneas) existe pero ruta cortocircuitada vía `Navigate to="/mi-plan/objetivos"` (T27.2-skip · `MiPlanPage.tsx:23`) | Postpuesto explícitamente |
| Sub-página fondos | ✅ `mi-plan/pages/FondosPage.tsx` (258 líneas) | OK |
| Sub-página proyección | 🟡 existe `mi-plan/pages/ProyeccionPage.tsx` pero contenido = patrón 12 meses · NO la "Proyección de caja" multi-año del mockup | Contenido divergente |
| Sub-página libertad simulador | 🟡 existe `mi-plan/pages/LibertadPage.tsx` pero NO usa `libertadService` · proyección naive sin renta pasiva real | Lógica simplificada |
| Curva renta pasiva escenarios | 🔴 SVG inline en `LibertadPage.tsx:` con 18 años · 1 escenario · NO N escenarios | Mono-escenario |
| 4 escenarios biblioteca (Plan actual / Agresivo / Optimista / Conservador) | 🔴 conceptualmente NO existen como entidad persistida · `services/escenariosService.ts` solo soporta singleton id=1 · `proyeccion/simulaciones/ProyeccionSimulaciones.tsx` simula multi pero NO persiste | Multi-escenario sin persistencia |
| Reto destacado en landing | 🟡 `MiPlanPage.tsx:96-107` calcula `retoActivo` pero `SHOW_RETOS=false` lo oculta | T27.2-skip activo |

---

## §10 · Sección 8 informe · KPIs señaleros en Panel patrimonio

```bash
find src/ -path "*panel*" -o -path "*dashboard*" -type f 2>/dev/null | head -50
grep -nE "kpi|KPI" src/modules/panel/PanelPage.tsx
grep -nE "coherencia|alineamiento|deriva" src/modules/panel/*.tsx
```

Output literal (key hits):
```
src/modules/panel/PanelPage.tsx:533:           <MoneyValue value={patrimonioNeto} ... size="kpiStar" />
src/modules/panel/PanelPage.tsx:673:           /* Mi Plan brújula · § Z.11 · T22.6 · T27.4.2 KPIs reales */
src/modules/panel/PanelPage.module.css:52: /* T25.2 · MoneyValue size=kpiStar... */
```
`coherencia/alineamiento/deriva` → `no output`. **0 hits** confirmado (igual que T-PERSONAL audit).

KPIs hoy en Panel:
| KPI | Existe | Cálculo | Notas |
|---|---|---|---|
| Patrimonio neto | ✅ | activos − deudaViva (`PanelPage.tsx:533`) | size=`kpiStar` · 1 línea |
| Pulso del mes (ingresos/gastos/cashflow/saldoFin) | ✅ | desde `treasuryEvents` mes en curso | TODO saldoFin proyectado real |
| Mi Plan brújula (% cobertura · año libertad · meses colchón · inmuebles activos) | ✅ | `useProyeccionLibertad()` + cálculos PanelPage | TODO meses colchón con gastoMedio · TODO meta inmuebles |
| Year timeline | ✅ | `YearTimeline.tsx` lee `treasuryEvents`+`contracts` | hitos derivados |
| Attention list | ✅ | alertas fiscales + contratos vencer 60d + pagos vencidos · top 5 | OK |
| Delta30d patrimonio | ❌ | TODO `PanelPage.tsx:124` "patrimonioSnapshots eliminado en V62" | sin store |
| KPI coherencia patrón vs real | ❌ | 0 hits (igual que T-PERSONAL) | sin pieza reusable |
| KPI alineamiento proyección | ❌ | 0 hits | sin pieza reusable |
| Rdto neto inmuebles · YTD | ❌ | TODO en PanelPage | hueco |
| Rentabilidad YTD inversiones | ❌ | TODO en PanelPage | hueco |

---

## §11 · Sección 9 informe · Hallazgos sorpresa

> 6 hallazgos sorpresa (igual orden de magnitud que T-PERSONAL).

### Hallazgo 1 · Dos `escenarioService` distintos coexisten en producción

- `src/services/escenariosService.ts` (127 líneas) · **REAL** · DB store `escenarios` singleton id=1 · usado por `MiPlanPage`, `LibertadPage` (vía outlet), `PanelPage`.
- `src/modules/horizon/proyeccion/escenarios/services/escenarioService.ts` (822 líneas) · **MOCK in-memory** · `class EscenarioService { private data = clone(initialDashboard); }` · datos ejemplo hardcoded ("€45.900", "+2.000 €/mes y compra objetivo Q2 2026", milestones de 36 meses, etc.).

Grep duro:
```bash
grep -rn "EscenarioService\|escenarioService\|escenariosService" src/ 2>/dev/null | wc -l
```
Confirmado: dos clases distintas. No hay duplicación de datos (el mock no escribe a DB) pero sí confusión de imports.

### Hallazgo 2 · Dos rutas `Comparativa` distintas

- `src/modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx` (singular · 239 líneas · Real vs Budget vs Forecast con `Math.random` placeholder).
- `src/modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx` (plural · 362 líneas · comparar hasta 3 escenarios marcados desde Simulaciones · TODO PDF export línea 80).

`App.tsx:982,1009` redirige `/proyeccion/consolidado` y `/proyeccion/comparativas` a las activas. Coexisten en código.

### Hallazgo 3 · `ProyeccionSimulaciones` es un papelera de borradores · NO persiste

`src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` (436 líneas):
- Línea 8 (transcript del subagent): `// Temporary types until we create the service`
- Estado: `useState<Scenario[]>([])`
- Crear: `setScenarios([...scenarios, newScenario])` con `id: Date.now()`
- 0 imports services salvo `confirmDelete`
- 0 awaits save

**Cualquier escenario que un cliente cree en `/proyeccion/simulaciones` se pierde al refrescar la página.** Vía `App.tsx:1008` la ruta `/proyeccion/simulaciones` redirige a `/proyeccion/escenarios` (legacy redirect) · pero el archivo está cargado en lazy y accesible vía import.

### Hallazgo 4 · `budgetService.ts` escribe en store FANTASMA `'budgets'`

`src/modules/horizon/proyeccion/presupuesto/services/budgetService.ts` (275 líneas) hace:
```
budgetService.ts:6:  const tx = db.transaction('budgets', 'readonly');
budgetService.ts:29: return db.add('budgets', budget) as Promise<number>;
budgetService.ts:35: const budget = await db.get('budgets', id);
budgetService.ts:44: await db.put('budgets', updatedBudget);
budgetService.ts:50: const tx = db.transaction(['budgets', 'budgetLines'], 'readwrite');
budgetService.ts:60: await tx.objectStore('budgets').delete(id);
```

Pero `db.ts:2880-2896` lista `'budgets'` y `'budgetLines'` en `STORES_OBSOLETOS` y los borra en una migración anterior:
```
2888:          'budgetLines',
2889:          'budgets',
2890:        ];
2891:        for (const store of STORES_OBSOLETOS) {
2892:          if (db.objectStoreNames.contains(store)) {
2893:            db.deleteObjectStore(store);
2894:          }
2895:        }
```

⚠ El servicio convive con `presupuestoService.ts` (502 líneas · 8 awaits · stores oficiales `presupuestos`+`presupuestoLineas`). Hay **dos servicios de presupuesto en paralelo**, uno apuntando a stores válidos y otro a obsoletos. La página activa según `App.tsx:984` es `PresupuestosView` (la de `presupuestos`). `budgetService` se usa desde `comparativaService.ts:2` y `ProyeccionPresupuesto.tsx:8` · ramas residuales o de transición.

⚠ Importante (matiz técnico): en cualquier DB migrada a V69 los stores `'budgets'` y `'budgetLines'` NO existen (fueron eliminados con `deleteObjectStore` en la migración STORES_OBSOLETOS). Una llamada `db.transaction('budgets')` lanza `NotFoundError` en runtime. Es decir, `budgetService` es **probablemente dead code en producción** — solo serviría en una DB antigua sin migrar. CC en C-PROY-1 debe verificar callsites en runtime antes de borrar y, si están vivos sin tirar errores, investigar por qué (¿se llama desde una rama no ejercida?). NO basta con `grep`.

### Hallazgo 5 · `LibertadPage` (mi-plan) NO usa `libertadService`

`src/services/libertadService.ts` (258 líneas) implementa `proyectarLibertadDesdeRepo` con datos REALES (contratos activos, gastosInmueble, préstamos, fórmula francesa, IPC).

`src/modules/mi-plan/pages/LibertadPage.tsx` (385 líneas) NO importa `libertadService` (verificado: `grep "libertadService" src/modules/mi-plan/pages/LibertadPage.tsx` → 0 hits). Hace su propia proyección naive: SVG inline con `serie[i].renta = serie[i-1].renta + h.impactoMensual` (suma cumulativa de hitos · empieza desde 0 · sin renta pasiva real · sin gasto vida con IPC).

En cambio, `useProyeccionLibertad` (`src/hooks/useProyeccionLibertad.ts`) sí llama a `libertadService.proyectarLibertadDesdeRepo` y se usa en:
- `src/modules/mi-plan/pages/LandingPage.tsx:14`
- `src/modules/panel/PanelPage.tsx:35`

**El simulador "oficial" de Mi Plan ignora el servicio que sí calcula con datos reales.**

### Hallazgo 6 · Componentes huérfanos pintando hero patrimonio

`grep -rn "PatrimonioHeader\|ProjectionChart" src/modules/panel/ src/modules/mi-plan/ src/App.tsx 2>/dev/null` → solo hits en `proyeccion/base/components/ProjectionChart.tsx` (componente del módulo Base, distinto archivo).

Componentes en `src/components/dashboard/`:
- `PatrimonioHeader.tsx` (337 líneas · 0 imports desde código vivo)
- `ProjectionChart.tsx` (38 líneas · 0 imports)
- `PulsePresetShowcase.tsx` (huérfano según grep `find -path '*pulse*'`)
- `PulseDashboardHero.tsx` (huérfano · ver §3)

Código muerto que recoge la expectativa del mockup (lifeline 2020-actual, hero patrimonio) pero **nadie lo importa**.

---

## §12 · Sección 10 informe · Cables / piezas a construir (C-PROY-N)

| Cable | Descripción | Estado | Bloqueado por | Bloquea a | Piezas reusables | Tamaño T-shirt | Tiempo CC |
|---|---|---|---|---|---|---|---|
| **C-PROY-1** · Limpieza de capas residuales | Eliminar `comparativas/ProyeccionComparativas.tsx` (mockup PDF) · eliminar `simulaciones/ProyeccionSimulaciones.tsx` (no persiste) · eliminar `escenarios/services/escenarioService.ts` (mock 822 líneas in-memory) · eliminar componentes huérfanos `dashboard/PatrimonioHeader.tsx` + `ProjectionChart.tsx` + `PulsePresetShowcase.tsx` + `PulseDashboardHero.tsx` · decidir destino del store fantasma `budgets`/`budgetLines` (si `budgetService` debe unificarse a `presupuestoService` o renombrar el store fantasma a oficial) | ❌ no hecho | nada | TODOS los demás cables | (limpieza) | **S** | 4-6 h |
| **C-PROY-2** · Conectar `LibertadPage` al `libertadService` real | Sustituir proyección naive de `LibertadPage` por `useProyeccionLibertad()` o llamada directa a `proyectarLibertadDesdeRepo` · respetar el SVG existente · garantizar igualdad con `LandingPage` y `PanelPage` (hoy 3 cálculos divergentes) | 🟡 ~80% (servicio existe · página no lo usa) | C-PROY-1 (limpieza) | C-PROY-4, C-PROY-7 | `services/libertadService.ts` (258 líneas) · `hooks/useProyeccionLibertad.ts` (91 líneas) | **XS** | 2-3 h |
| **C-PROY-3** · Reemplazar Forecast Math.random por motor real | En `comparativa/services/comparativaService.ts:149,330,360` sustituir `budgetData.map(amount => amount * (0.95 + Math.random() * 0.1))` por consumo de `proyeccionMensualService.generateProyeccionMensual` para el resto del año + actuales para el pasado · idem `presupuesto/components/PresupuestoCalendario.tsx:49,68` | 🔴 mock activo | C-PROY-1 | C-PROY-7 (Q7), C-PROY-8 (Q4) | `mensual/services/proyeccionMensualService.ts` (1 056 líneas · 17 servicios integrados) · `mensual/services/forecastEngine.ts` (196 líneas) | **M** | 8-12 h |
| **C-PROY-4** · Catálogo eventos vitales ampliado + custom | Ampliar `Hito.tipo` en `types/miPlan.ts` de 5 valores a ~10 (boda, hijo, herencia, jubilación parcial, mudanza, baja IT, etc.) · añadir tipo `'custom'` con `customConfig: Record<string,unknown>` · UI nueva `EventosCatalogoModal` desde `LibertadPage` · actualizar `escenariosService.{addHito,updateHito}` para validar nuevos tipos · migración no-destructiva (los 5 valores actuales siguen válidos) | 🟡 5/10 tipos | C-PROY-2 | C-PROY-7, C-PROY-8 | `services/escenariosService.ts` (CRUD hitos OK · 127 líneas) · `types/miPlan.ts` (185 líneas) | **M** | 6-10 h |
| **C-PROY-5** · Motor proyección a 20 años | Generalizar `proyeccion/mensual/services/proyeccionMensualService.ts` para soportar horizonte multianual · loop anual sobre 20 años · cambio de IPC/contratos/préstamos por año · output stocks+flujos+fiscalidad por año · expone `proyeccionMultianualService.generate20a(opts)` | 🟡 motor 1 año cubierto al 100% · 19 años faltan | nada (puede ir en paralelo a C-PROY-1/2/3) | C-PROY-6 (snapshot), C-PROY-7, C-PROY-8 (Q4 escenarios), C-PROY-10 (Q10 output) | `mensual/services/{proyeccionMensualService,forecastEngine}.ts` (1 252 líneas) · 17 servicios integrados | **L** | 16-24 h |
| **C-PROY-6** · Snapshot anual 1 enero (palanca 1) | Servicio nuevo `proyeccionSnapshotService.ts` con `snapshotAnual(year)` que llama a C-PROY-5 y persiste resultado · store nuevo `proyeccionSnapshots` · DB upgrade a V70 · UI "tu proyección de hace N años decía X · realidad es Y" desde `mi-plan/pages/ProyeccionPage.tsx` · job 1/1 (manual o automático) | ❌ | C-PROY-5 | C-PROY-7 (sugerencias macro · necesita histórico) | `snapshotDeclaracionService.ts` como referencia patrón · `valoracionesService.ts` patrón snapshot mensual | **M-L** | 12-16 h |
| **C-PROY-7** · Plan vs real generalizado + sugerencias macro (palanca 3) | Servicio nuevo `proyeccionRealVsPlanService.ts` que cruza C-PROY-3 (forecast real) + snapshots históricos (C-PROY-6) · UI banner "tu CPI personal últimos 3 años fue X% · ¿usar?" con confirm respetando P8.2 · KPI nuevo `coherencia` en Panel · 0 hits hoy en `panel/PanelPage.tsx` | ❌ | C-PROY-3, C-PROY-5, C-PROY-6 | C-PROY-8 (Q4 sensibilidades) | `fiscalConciliationService.ts` (542 líneas · patrón conciliación · ya hace nóminas) · `comparativa/ProyeccionComparativa.tsx` (UI casi completa) | **L** | 16-20 h |
| **C-PROY-8** · Capa fiscal proyectada 20 años (palanca 2) | Servicio nuevo `fiscalProyeccionService.ts` con `proyectarFiscalidad20a(snapshot, supuestos)` · modela: amortización AEAT decadente · plusvalía futura por inmueble (precio venta esperado · año · regla art. 35.2) · deducción aportaciones planes pensiones · cuota IRPF estimada · usa `irpfCalculationService` extendido | ❌ | C-PROY-5 | C-PROY-9 (output Q10), C-PROY-10 | `irpfCalculationService.ts` · `fiscalContextService.ts` · `fiscalPaymentsService.ts` (los 3 ya importados desde proyeccionMensualService) · `fiscalConciliationService.ts` patrón | **L-XL** | 20-30 h |
| **C-PROY-9** · Vista narrativa unificada (Q1) + output jerárquico (Q10) | Página nueva `mi-plan/pages/ProyeccionPage.tsx` (rewrite) · cabecera KPIs (patrimonio · libertad · cobertura · gasto vida) · gráfico multi-dim con tabs (cashflow / patrimonio / libertad / fiscal) · tabla expandible 20 años con drill-down a categoría/entidad · cajón lateral escenarios · cajón lateral supuestos | ❌ | C-PROY-5, C-PROY-6, C-PROY-7, C-PROY-8 | nada | `mi-plan/pages/ProyeccionPage.tsx` actual (345 líneas · KPIs+waterfall+tabla 12m · base reusable) · `proyeccion/base/components/ProjectionChart.tsx` | **XL** | 24-32 h |

(8 cables totales · alineado con la indicación del spec "pueden ser pocos (3-4) o muchos (8-10)").

---

## §13 · Sección 11 informe · Tamaños T-shirt + orden recomendado

**Orden recomendado**: C-PROY-1 → C-PROY-2 → C-PROY-3 → C-PROY-5 → C-PROY-4 → C-PROY-6 → C-PROY-7 → C-PROY-8 → C-PROY-9.

Justificación corta:

1. **C-PROY-1 (S · 4-6 h)** primero · sin limpieza de capas residuales (mock 822 líneas escenarioService · `ProyeccionSimulaciones` no persistente · `budgets` fantasma) cualquier construcción posterior re-importará la confusión actual. Cierra deuda técnica.

2. **C-PROY-2 (XS · 2-3 h)** · valor inmediato cliente · `LibertadPage` empezará a mostrar la curva real (renta pasiva neta + gastos vida + cruce libertad) que ya ven Panel y Landing pero NO la propia página Libertad. Coste minúsculo, alto impacto UX.

3. **C-PROY-3 (M · 8-12 h)** · elimina el `Math.random` del Forecast (3 ocurrencias en `comparativaService.ts` + 1 en `PresupuestoCalendario`). Plan vs Real se vuelve fiable. Cliente puede confiar en `/proyeccion/comparativa`.

4. **C-PROY-5 (L · 16-24 h)** · es el motor a 20 años. **Bloqueante crítico de C-PROY-6/7/8/9.** Va antes que estos porque sin él no hay proyección multianual sobre la que hacer snapshot, sugerencias o capa fiscal.

5. **C-PROY-4 (M · 6-10 h)** · después de C-PROY-2 (libertad real) tiene sentido ampliar el catálogo de hitos. Va antes que C-PROY-9 porque el output jerárquico Q10 debe poder pintar los 10 tipos.

6. **C-PROY-6 (M-L · 12-16 h)** · palanca 1 (snapshot anual 1 enero · diferenciador único). Solo viable con motor 20 años (C-PROY-5).

7. **C-PROY-7 (L · 16-20 h)** · palanca 3 (sugerencias macro automáticas · KPI coherencia Panel). Necesita histórico (C-PROY-6) y forecast real (C-PROY-3).

8. **C-PROY-8 (L-XL · 20-30 h)** · palanca 2 (capa fiscal 20 años). Es la más cara · va al final del bloque palancas porque el cierre fiscal anual está en evolución (post norte 1/1/2027) y conviene esperar a que el modelo fiscal madure.

9. **C-PROY-9 (XL · 24-32 h)** · output unificado Q1+Q10. Sintetiza todo. Solo cobra sentido cuando los datos comparados existen.

**Paralelismos posibles**:
- C-PROY-2 y C-PROY-3 pueden ir en paralelo (sin solapamiento de archivos).
- C-PROY-4 puede empezar en cuanto termine C-PROY-2 (depende solo del catálogo de hitos).
- C-PROY-5 puede empezar EN PARALELO a C-PROY-1/2/3 (motor mensual ya está · su extensión multianual no toca los archivos limpiados).

**Esfuerzo total estimado**: 108-153 horas CC (≈ 3-4 semanas a tiempo completo).

---

## §14 · Sección 12 informe · Lo que NO debe hacer CC en la implementación posterior

```bash
grep -rnE "Math\.random|TODO|FIXME|HACK" src/modules/horizon/proyeccion/ src/modules/mi-plan/ 2>/dev/null
```

Output literal (resumen):
```
src/modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx:80: // TODO: Implement PDF export functionality
src/modules/horizon/proyeccion/presupuesto/PresupuestoScopeView.tsx:61: // TODO: Save changes to database
src/modules/horizon/proyeccion/presupuesto/components/PresupuestoCalendario.tsx:46: // Mock real data for comparison (TODO: implement real vs budget comparison)
src/modules/horizon/proyeccion/presupuesto/components/PresupuestoCalendario.tsx:68: const real = generateMockReal(presupuestado); // TODO: get real data
src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx:13,18,23,107: TODO CRUD/dropdown
src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx:144: // TODO: Move to next cell
src/modules/horizon/proyeccion/presupuesto/services/budgetService.ts:205: // TODO: Add auto-generation for: ...
src/modules/horizon/proyeccion/presupuesto/services/scopeSeedService.ts:184: // TODO: Add loan/mortgage data from préstamos module
src/modules/horizon/proyeccion/comparativa/services/comparativaService.ts:141: // TODO: Implement dynamic forecast calculation from: ...
+ Math.random hits citados en §11 (5 ocurrencias)
```

**Riesgos detectados (CC NO debe en la implementación):**

1. ❌ **NO confundir `escenariosService.ts` (real) con `escenarios/services/escenarioService.ts` (mock 822 líneas)** · ambos tienen export con nombre similar. El mock NO debe ser fuente de verdad bajo ninguna circunstancia.

2. ❌ **NO escribir en el store `'budgets'`** (es STORES_OBSOLETOS · `db.ts:2889`). Cualquier nuevo desarrollo debe ir contra `presupuestos`+`presupuestoLineas`.

3. ❌ **NO conservar `Math.random` para forecast** (3 hits `comparativaService.ts` + 2 hits `PresupuestoCalendario.tsx` + 1 UUID legítimo en `presupuestoService.ts:9` y otro en `escenariosService.ts:13` · estos dos UUID se pueden conservar).

4. ❌ **NO asumir que `LibertadPage` ya usa `libertadService`** (NO lo usa · ver §11 hallazgo 5). Cualquier cambio en `libertadService` debe verificar las 3 callsites: `LandingPage`, `PanelPage`, hook.

5. ❌ **NO asumir que `proyeccion/simulaciones/ProyeccionSimulaciones.tsx` persiste escenarios** (solo state local · cualquier nueva persistencia debe pasar a `escenariosService` ampliado a multi-escenario).

6. ❌ **NO crear nuevos snapshots en `snapshotsDeclaracion`** · ese store es de declaraciones IRPF · usar store nuevo `proyeccionSnapshots` (C-PROY-6).

7. ❌ **NO importar `ejerciciosFiscales`** · está eliminado en V62 · usar `getEjercicio` desde `ejercicioResolverService`.

8. ❌ **NO importar `patrimonioSnapshots`** · eliminado en V62 (`PanelPage.tsx:124`). Si hace falta histórico patrimonio, crear store nuevo o usar `valoraciones_historicas` (sólo cubre activos inmobiliarios).

9. ❌ **NO consumir `escenarios/services/escenarioService.ts` (mock)** desde código nuevo · solo el dashboard estático lo usa hoy.

10. ❌ **NO cambiar la estructura de pestañas Mi Plan** sin verificar `featureFlags.SHOW_RETOS` (T27.2-skip · controla TODOS los puntos de entrada al sub-módulo Retos).

---

## §15 · Validaciones del informe

- [x] Cada veredicto ✅/🟡/❌ tiene grep reproducible adjunto (§3, §4, §5, §6, §11, §14)
- [x] Cada output de grep está copiado literal (no parafraseado) o referenciado al archivo original (`PanelPage.tsx:124`, `db.ts:2889`, etc.)
- [x] DB_VERSION confirmado vía grep · número exacto reportado (**69**)
- [x] Cantidad stores activos confirmada vía grep · número exacto reportado (**40**)
- [x] Las 10 dimensiones Q1-Q10 tienen sub-sección propia (§5) · ninguna saltada
- [x] Las 3 palancas tienen tabla con grep duro (§6)
- [x] Sección discrepancias mockup vs código tiene 9 filas (§9)
- [x] Sección hallazgos sorpresa tiene 6 hallazgos (§11)
- [x] Cables C-PROY-1..C-PROY-9 numerados · cada uno con estado · bloqueos · tiempo (§12)
- [x] CC NO ha modificado ningún archivo de `src/` (sólo añade `docs/audits/T-PROYECCION-AUDIT-INFORME.md`)
- [x] Informe firma fecha + commit base + DB_VERSION + nº stores (cabecera)

---

## §16 · Cierre

**CC entrega este informe descriptivo · NO prescriptivo**. No se proponen specs, no se sugieren refactorings concretos, no se modifica código fuente.

CC abre **un solo PR** que añade `docs/audits/T-PROYECCION-AUDIT-INFORME.md` y nada más.

**NO mergear.** Esperar autorización Jose tras revisión del informe.

**Fin informe T-PROYECCION-AUDIT.**
