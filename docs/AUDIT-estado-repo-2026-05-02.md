# AUDIT · Estado real repo vs HANDOFF V7

**Fecha auditoría** · 2026-05-02
**Rama auditada** · `origin/main`
**Último commit auditado** · `517bedb` (2026-05-02 00:49 +0200)
**Auditor** · Claude (lectura · sin modificar código)

> ⚠ **NOTA CRÍTICA · drift documental**
> El fichero `HANDOFF-V7-atlas.md` referenciado en la tarea **NO existe** ni en
> `main` ni en ningún ref del remoto (búsqueda `repo:gomezrjoseantonio-bot/ultimointento HANDOFF-V7` → 0 resultados). El handoff publicado más reciente en repo es `HANDOFF-V5-atlas.md` (root). Hay además `HANDOFF-V3-atlas.md` y `HANDOFF-V4-atlas.md` en `docs/audit-inputs/`. Esta auditoría toma las afirmaciones de V7 desde el enunciado de la tarea (Jose) y compara con el código tal cual está hoy. Cualquier afirmación V7 sin contrastar queda marcada `[V7-NO-VERIFIABLE]`.

---

## SECCIÓN 1 · Estado de main

| Item | Valor |
|---|---|
| Último commit · hash | `517bedb` |
| Último commit · fecha | 2026-05-02 00:49 +0200 |
| Último commit · autor | gomezrjoseantonio-bot |
| Último commit · mensaje | `Merge pull request #1221 from gomezrjoseantonio-bot/copilot/choreinversiones-cierre-23-6` |
| `DB_VERSION` (`src/services/db.ts:22`) | **65** |
| Comentario inline V65 | "TAREA 13 · módulo planes de pensiones · 3 stores nuevos (`planesPensiones`, `aportacionesPlan`, `traspasosPlanPensiones`) · `planesPensionInversion`+`traspasosPlanes` eliminados" |
| Stores activos en interface `AtlasHorizonDB` | **40 entradas** declaradas |
| · de las cuales legacy/compile-only | 2 (`traspasosPlanes` documentado como eliminado V65 · `objetivos_financieros` documentado como migrado a `escenarios` en V5.4) |
| · stores reales esperados runtime | **38 + 3 nuevos V65 (planesPensiones·aportacionesPlan·traspasosPlanPensiones)** = ~41 si la migración V65 corrió, ~38 si todavía no |
| Discrepancia vs handoff "DB_VERSION 65 · 40 stores" | **NO** · número coincide en orden de magnitud · ver §1.1 nota técnica |
| Branch `feature/migration-v5` existe? | **SÍ** · sha `d22c47d` (2026-04-29) · merge de PR #1185 (`claude/migrate-mockups-ui-tDCYy`) · 16 commits adelante de main · **141 commits detrás de main** · stale |

### §1.1 · Nota técnica sobre número de stores

El comentario `// V65 (TAREA 13)` afirma "3 stores nuevos". Sin embargo la interface `AtlasHorizonDB` (lines 2039-2234) **NO incluye** los tres campos nuevos `planesPensiones`, `aportacionesPlan`, `traspasosPlanPensiones`. Sí están creados en el `upgrade()` callback (lines 2632-2660 y 3754-3923). Esto es **gap de tipado TS**: a runtime los stores existen pero no son accesibles type-safe vía `db.transaction(['planesPensiones'])`. Pendiente: añadirlos a la interface.

Adicionalmente la interface aún declara `traspasosPlanes` (line 2091) y `objetivos_financieros` (line 2203) como campos vivos pese a estar marcados como eliminados/migrados — son relictos de compile que conviene limpiar.

---

## SECCIÓN 2 · PRs mergeados desde 2026-05-01

Cronología (todos en main · `git log --merges --since="2026-05-01"`):

| # | Fecha merge | PR título resumido | Categoría V7 |
|---|---|---|---|
| 1191 | 2026-05-01 08:35 | `chore(audit-t14-fiscal-config)` — auditoría T14 fiscal config | T14 (V7) |
| 1193 | 2026-05-01 08:30 | `claude/fiscal-irpf-gaps-cierre` — cierre gaps IRPF | T-fiscal (V7) |
| 1194 | 2026-05-01 09:04 | `fiscal-context-migracion-consumidores` — T14.4 gateway | T14.4 (V7) |
| 1195 | 2026-05-01 10:04 | `compromise-detection-audit` — T9.1 detection service | T9.1 (V7) |
| 1196 | 2026-05-01 10:24 | `feat/compromiso-creation` — T9.2 idempotent | T9.2 (V7) |
| 1197 | 2026-05-01 10:42 | `feat/compromiso-aprobacion-ui` — T9.3 UI aprobación | T9.3 (V7) |
| 1198 | 2026-05-01 11:11 | `22-1-sidebar-v5-topbar-global` — TAREA 22.1 sidebar+topbar v5 | T22.1 (V7) |
| 1199 | 2026-05-01 11:03 | `fix/compromiso-aprobacion-a11y` — T9.3 a11y | T9.3 (V7) |
| 1200 | 2026-05-01 11:15 | `chore/compromiso-cierre-t9` — **T9 cierre ✅** | T9 (V7) |
| 1201 | 2026-05-01 11:32 | `featdashboard-22-2` — saludo+hero+composición γ | T22.2 (V7) |
| 1202 | 2026-05-01 11:51 | `featdashboard-223` — pulse asset card 4 activos | T22.3 (V7) |
| 1203 | 2026-05-01 12:50 | `featdashboard-22-4` — pulso del mes § Z.10 | T22.4 (V7) |
| 1204 | 2026-05-01 14:11 | `featdashboard-22-5` — AttentionList § Z.11 | T22.5 (V7) |
| 1205 | 2026-05-01 14:12 | `investments-gallery-helpers` — T23.1 galería v2 | T23.1 (V7) |
| 1206 | 2026-05-01 14:33 | `featdashboard-22-6` — MiPlanCompass brújula | T22.6 (V7) |
| 1207 | 2026-05-01 14:36 | `inversiones-wizard-23-2` — T23.2 wizard nueva posición | T23.2 (V7) |
| 1208 | 2026-05-01 15:22 | `featdashboard-227` — YearTimeline 12 meses | T22.7 (V7) |
| 1209 | 2026-05-01 15:24 | `inversiones-fichas-23-3` — T23.3 fichas detalle | T23.3 (V7) |
| 1210 | 2026-05-01 15:38 | `inversiones-cerradas-23-4` — T23.4 posiciones cerradas | T23.4 (V7) |
| 1211 | 2026-05-01 16:21 | `featdashboard-228` — T22.8 panel cierre | T22.8 (V7) |
| 1212 | 2026-05-01 16:21 | `inversiones-cierre-23-5` — **T23 + T22 cierre** | T23.5 (V7) |
| 1213 | 2026-05-01 21:27 | `fix-valoraciones-historicas-unique-source` — **T24** centralizar valoraciones | T24 (V7) |
| 1214 | 2026-05-01 21:44 | `featinversiones-galeria-unificada` — T23.6.1 galería unificada | T23.6.1 (V7) |
| 1215 | 2026-05-01 22:23 | `featinversiones-cinta-cartas-refinadas` — T23.6.2 cinta sticky | T23.6.2 (V7) |
| 1216 | 2026-05-01 23:12 | `featinversiones-wizard-v5-11-tipos` — T23.6.3 wizard v5 12 tipos | T23.6.3 (V7) |
| 1217 | (incluido en 1216) | T25 valor inmuebles + hero + nav contratos + timeline | T25 (V7) |
| 1219 | 2026-05-01 23:33 | `claude/fix-card-number-size` — fix tamaño tarjetas pulso | T22-fix (V7) |
| 1218 | 2026-05-01 23:48 | `featinversiones-ficha-plan-pensiones` — T23.6.4 ficha detallada | T23.6.4 (V7) |
| 1220 | (squash en 1216) | fix cinta resumen mockup canónico | T23.6.2-fix (V7) |
| **1221** | **2026-05-02 00:49** | `chore(inversiones)/cierre-23-6` — **T23.6 cierre ✅** | T23.6.5 · **POST-V7** (cierre del scope T23.6.x) |

**Marcado V7 vs post-V7**

- **30 merges** caen entre 2026-05-01 08:35 y 2026-05-02 00:49.
- **29 están dentro del scope V7** (T9 · T14 · T22 · T23 · T23.6.x · T24 · T25).
- **1 PR (#1221)** se mergeó tras la fecha nominal de cierre V7 (2026-05-01 23:59) por 50 minutos · pero su contenido es un **cierre ceremonial** del scope T23.6.x ya en V7 (`docs(t23.6): cierre + e2e`). NO añade scope nuevo.
- **No hay PRs mergeados con scope nuevo posterior a HANDOFF V7**.

---

## SECCIÓN 3 · PRs abiertos ahora

Total PRs abiertos · **49** · todos antiguos · ninguno relevante para "próximo merge".

| Top 5 más recientes (por created_at) | Estado |
|---|---|
| #1025 · 2026-04-06 · `[WIP] Fix handling of contracts and incomes without NIF` · Copilot · **draft** | abandonado |
| #992 · 2026-04-03 · `Delete obsolete IndexedDB stores in v42 upgrade` · bot | obsoleto (DB ya en V65) |
| #945 · 2026-03-31 · `package.json validation script for Netlify` | obsoleto |
| #925 · 2026-03-29 · `Remove unused DeclaracionXmlResult type and xmlResult state` | revisar/cerrar |
| #917 · 2026-03-29 · `docs Netlify extension/plugin troubleshooting guide` | docs · low priority |

| Más antiguos (cola larga) | |
|---|---|
| #106 · 2025-09-08 · `[WIP] Conectar APIs reales backend` · Copilot · **draft** · 8+ meses | cerrar |
| #391 · 2026-02-28 · `Refactoriza análisis para usar datos reales IndexedDB` | obsoleto · ya migrado por otras vías |
| #435 · 2026-03-01 · `[WIP] Add visual+lógica confirmación acciones críticas` · Copilot · draft | cerrar |
| #444-#592 · varias del 2026-03 · cluster fiscal/dashboard/codex | obsoleto · trabajo recubierto por T9·T14·T22·T23 |

**Bloqueantes para próximo merge** · **NINGUNO**.

Conclusión §3 · Hay **49 PRs zombies** (creado >25 días sin actividad). Ningún PR abierto representa trabajo activo. **Recomendación**: ronda de cierre masivo (cerrar 40+ PRs obsoletos) o etiquetado `wontfix`.

---

## SECCIÓN 4 · Branches activas no mergeadas

**Total branches en remoto** · **1.171** (`git ls-remote --heads origin | wc -l`).

Esta cifra es síntoma claro de housekeeping pendiente · la inmensa mayoría son ramas Copilot/Claude antiguas (PR ya mergeado o cerrado) que nunca se borraron.

| Branches con PR abierto activo | 49 (vinculadas a §3) |
| Branches sin PR · stale | ~1.120 |
| Branch local de esta auditoría | `claude/audit-repo-handoff-QhIfU` |

**Branch destacada · `feature/migration-v5`**

| Campo | Valor |
|---|---|
| Tip sha | `d22c47d` |
| Fecha tip | 2026-04-29 |
| Origen | Merge de PR #1185 `claude/migrate-mockups-ui-tDCYy` |
| Commits adelante de main | 16 |
| Commits detrás de main | 141 |
| Estado | **stale · NO borrar todavía** sin revisión · puede contener trabajo perdido si no se rebasara |

**Recomendación §4** · Programar **purga ramas mergeadas** (script: `git for-each-ref --format='%(refname:short)' refs/remotes/origin/ | xargs -I{} sh -c 'git merge-base --is-ancestor {} origin/main && echo {}'`). De 1.171 → debería bajar a <50.

---

## SECCIÓN 5 · TODOs y FIXMEs en código

`grep -rn -E "TODO|FIXME|XXX|HACK|@deprecated" src/`

| Métrica | Valor |
|---|---|
| Total ocurrencias TODO/FIXME/XXX/HACK | **152** (excluyendo "TODOS los/tus/_" decorativos) |
| Total `@deprecated` | **11** |

### Distribución por módulo (Top)

| Módulo | TODOs | Notas |
|---|---:|---|
| `modules/panel/` | **32** | Esperable · panel acaba de salir T22 · TODOs apuntan a "conectar con servicio X cuando esté disponible" (proyección, alertas, simulador Mi Plan, snapshot patrimonio) |
| `modules/horizon/` | 17 | dispersos (proyección PDF/Excel export, presupuesto v3 placeholders, financiación export) |
| `design-system/v5/` | 11 | `TopbarV5.tsx` · stubs búsqueda + notificaciones + ayuda |
| `services/__tests__/` | 6 | tests de keyvalAudit · referencias documentadas |
| `pages/dev/` | 6 | ventana de desarrollo · ignorar |
| `data/fiscal/` | 6 | datos fiscales · revisar |
| `modules/inversiones/` | 5 | placeholders T23.6.4+ (composición plan pensiones · ficha posición pendiente) |
| resto | <5 c/u | bajo ruido |

### TODOs que son **trabajo real pendiente** (filtrado · ignorar decorativos)

**A · Panel (T22 cierre dejó deuda de "conectar con")**

- `panel/PanelPage.tsx:81` · TODO T25.2 delta 30d real cuando exista snapshot histórico patrimonio.
- `panel/PanelPage.tsx:220-248` · 6× TODOs conexiones panel: proyección saldo fin de mes · alertas deudas/borradores fiscales/obligaciones próximas.
- `panel/PanelPage.tsx:325-348` · `añoLibertad` y `metaInmuebles` requieren simulador Mi Plan.
- `panel/PanelPage.tsx:538-562` · KPIs activos requieren rdto neto inmuebles · rentabilidad YTD inversiones · meses colchón tesorería.
- `panel/components/YearTimeline.tsx:114·156` · servicio dedicado obligaciones fiscales + fecha exacta préstamos.
- `panel/components/MiPlanCompass.tsx:9·14·36·122` · meta inmuebles · simulador Mi Plan.
- `panel/components/PulseAssetCard.tsx:117` · historial valores por activo (delta 30d real).
- `panel/components/AttentionList.tsx:8-10` · 3× servicios alertas pendientes.
- `panel/components/PulsoDelMes.tsx:30·92` · servicio proyección.

**B · Topbar v5 stubs (T22.1 cerrado pero deja stubs)**

- `design-system/v5/TopbarV5.tsx:20-196` · 9× TODOs · búsqueda real · panel notificaciones · centro de ayuda · badge dinámico desde store. **Cierre cosmético**.

**C · Inversiones (T23.6 cerrado pero ficha plan pensiones incompleta)**

- `inversiones/pages/FichaPlanPensiones.tsx:624·628` · composición detallada pendiente API gestora (T23.6.4+).
- `inversiones/pages/FichaPosicionPage.tsx:12` · placeholder hasta T23.6.4 implementación completa (¿está realmente cerrado T23.6?).
- `inversiones/components/FichaValoracionSimple.tsx:149` · datos composición plan/fondo (T23.3+).

**D · Mi Plan / Proyección (T20 incompleto)**

- `modules/horizon/proyeccion/presupuesto/PresupuestoScopeView.tsx:61` · save changes to DB.
- `modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx:13·18·23` · view/edit/delete budget.
- `modules/horizon/proyeccion/presupuesto/components/PresupuestoCalendario.tsx:46·68` · real vs budget comparison.
- `modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx:80` · PDF export.
- `modules/horizon/proyeccion/comparativa/services/comparativaService.ts:141` · forecast dynamic calculation.
- `modules/horizon/proyeccion/presupuesto/services/scopeSeedService.ts:184` · loan/mortgage data.
- `modules/horizon/proyeccion/presupuesto/services/budgetService.ts:205` · auto-generation pendiente.

**E · Financiación**

- `modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx:141·146` · PDF + Excel export.

**F · Servicios core**

- `services/realPropertyService.ts:17·25·31` · 3× TODO "Replace with actual database query".
- `services/dashboardService.ts:1678·1679` · IPC + EURIBOR pending integraciones.
- `services/ejercicioResolverService.ts:589` · distinguir 0105 vs 0106.
- `services/unicornioInboxProcessor.ts:145·312·680` · treasury import + dedup fingerprint + RealPropertyService.
- `services/postalCodeApiService.ts:16` · stub API.

**G · UI dispersos**

- `modules/horizon/configuracion/cuentas/components/BancosManagement.tsx:191` · ATLAS confirmation modal.
- `modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx:144` · navegación por celdas.
- `modules/inmuebles/pages/ListadoPage.tsx:258` · cálculo real desde gastos (T20.3a follow-up).

**@deprecated relevantes**

- `services/aeatPdfParserService.ts:1` · usar `aeatParserService.ts` (Claude Vision).
- `components/dashboard/InvestorDashboardV2.tsx:31` · usar `InvestorDashboard`.
- `modules/inversiones/components/PosicionDetailDialog.tsx:1` · sustituido por ficha T23.3.
- `types/prestamos.ts:61·64·69` · campos legacy (usar `destinos[]`).

**Total TODOs trabajo real estimado** · ~50 puntos de conexión / cierre.

---

## SECCIÓN 6 · Cobertura mockups → componente real

Mockups en `docs/audit-inputs/` (no `docs/mockups/`).

Leyenda · ✅ V5 · 🟡 V3/V4 (necesita actualización) · ❌ NO MIGRADO · ➖ no aplica

| Mockup | Componente real | Estado |
|---|---|---|
| `atlas-panel.html` | `src/modules/panel/PanelPage.tsx` | **✅ MIGRADO V5** (T22.1-22.8 mayo 1 · sidebar v5 · TopbarV5 · ActivosGrid · PulseAssetCard · AttentionList · YearTimeline · MiPlanCompass) |
| `atlas-tesoreria-v8.html` | `src/modules/tesoreria/` (TesoreriaPage + tabs) | **✅ MIGRADO V5** (CashflowChart + VistaGeneralTab) |
| `atlas-inmuebles-v3.html` | `src/modules/inmuebles/` (ListadoPage + parent outlet) | **🟡 MIGRADO PERO V3/V4** · parent outlet OK · subpáginas mixtas · ListadoPage TODO 20.3a follow-up |
| `atlas-inversiones-v2.html` | `src/modules/inversiones/InversionesGaleria.tsx` | **✅ MIGRADO V5** (T23.1-T23.6 mayo 1) |
| ↳ alt: `src/modules/horizon/inversiones/` | InversionesPage | **❌ NO MIGRADO** · ruta legacy · candidata a borrar |
| `atlas-contratos-v4.html` | `src/modules/horizon/inmuebles/contratos/` | **🟡 V3/V4** · `ContractsListaEnhanced.tsx` borrada en T23.6.2 (commit `60c5681`) · página activa requiere revisión v5 |
| `atlas-mi-plan-v2.html` (+ v3 variants) | `src/modules/mi-plan/` (LandingPage + sub-páginas v3) | **✅ MIGRADO V5** (V5.4-V5.7 stores · escenarios+objetivos+fondos+retos) |
| `atlas-fiscal.html` | `src/modules/fiscal/` (FiscalPage + CalendarioFiscalPage + CorreccionWizard) | **✅ MIGRADO V5** |
| `atlas-financiacion-v2.html` | `src/modules/horizon/financiacion/` | **🟡 V3/V4** · ruta `horizon/financiacion` no v5 · `PrestamoDetailDrawer` con TODOs export |
| `atlas-personal-v3.html` | `src/modules/horizon/personal/` (GestionPersonalPage) | **🟡 V3/V4** · `pages/GestionPersonal/` con 2 TODOs · cluster `claude/fix-gestion-personal-*` (3 ramas pendientes) |
| `atlas-archivo.html` | `src/modules/archivo/` o equivalente | **🟡 PARCIAL** · módulo existe · v5 no auditado a fondo |
| `atlas-ajustes-v2.html` | `src/modules/horizon/configuracion/` | **🟡 V3/V4** · `BancosManagement` con TODO ATLAS modal · `PreferenciasDatos` · NotificacionesPage v5 |
| `atlas-onboarding.html` | `src/modules/onboarding/` | **🟡 PARCIAL** · existe · v5 no auditado a fondo |
| `atlas-wizard-nuevo-contrato.html` | `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx` | **✅ MIGRADO V5** |
| `atlas-inmueble-fa32-v2.html` | `src/modules/inmuebles/pages/DetallePage.tsx` (+ FichaTab) | **✅ MIGRADO V5** (T25 fixes mayo 1) |
| `atlas-correccion.html` | `src/modules/fiscal/pages/CorreccionWizard.tsx` | **✅ MIGRADO** · ya implementado (5 pasos) · contradice nota original "NO migrado · flujo futuro" del enunciado |
| `atlas-historia-jose-v2.html` | — | **➖ narrativo · no UI** |
| Variantes Mi Plan v3 (landing/proyección/objetivos/fondos/retos/libertad) | `src/modules/mi-plan/pages/*` | **✅ MIGRADO V5** |

**Resumen §6**

- **9 MIGRADOS V5** (panel · tesorería · inversiones · mi-plan · fiscal · wizard contrato · ficha inmueble · corrección · todas las variantes mi-plan v3).
- **5 MIGRADOS V3/V4 · necesitan refresh** (inmuebles parent · contratos v4 · financiación v2 · personal v3 · ajustes v2).
- **1 NO MIGRADO** (`horizon/inversiones/InversionesPage.tsx` legacy · candidato a borrar).
- **2 PARCIAL/no auditado** (archivo · onboarding) · revisar in situ.
- **2 N/A** (corrección — ya migrada · historia — narrativo).

---

## SECCIÓN 7 · Backlog vs realidad (HANDOFF V7 §8.2)

| # | Tarea pendiente declarada en V7 | Evidencia en repo | Veredicto |
|---|---|---|---|
| 1 | **Mi Plan redesign · Objetivos broken** | `src/modules/mi-plan/pages/ObjetivosPage.tsx` existe y es funcional (V5.5 store `objetivos`). Toast "Crear objetivo · pendiente wizard dedicado" indica wizard pendiente, no la página. | **PARCIAL · página OK · falta wizard creación** |
| 2 | **GAPs XML → stores** | `src/services/aeatXmlParserService.ts` operativo · GAPs declarados en `irpfCalculationService.ts` (GAP 5.1-5.6 autonómicas, edad bono, vivienda habitual, discapacidad). Cierre PR #1193 (`fiscal-irpf-gaps-cierre`) merged 2026-05-01. | **EN CURSO · cierre parcial mayo 1 · revisar deltas restantes** |
| 3 | **Pieza 7 CAPEX/historical improvements** | `services/gananciaPatrimonialService.ts` + venta wizard `Step3Confirmar.tsx` con "Mejoras CAPEX acumuladas" · `treasury/TreasuryEvolucion.tsx` · histórico soportado. | **IMPLEMENTADO · revisar mejoras incrementales** |
| 4 | **Piezas 4-10 implementation roadmap** | Sólo Pieza 8 con evidencia clara: `components/inbox/DocumentLinkingPanel.tsx` + `services/documentMatchingService.ts` + `services/documentIngestionService.ts`. **Sin evidencia** de Piezas 4·5·6·7·9·10. | **MAYORÍA PENDIENTE · sólo P8** |
| 5 | **Inspection correction flow** | `src/modules/fiscal/pages/CorreccionWizard.tsx` · 5 pasos (paralela → cambia → delta → impacto → cascada). Mockup `atlas-correccion.html` ✅ | **IMPLEMENTADO** (contradice enunciado V7) |
| 6 | **Inmueble transformation entity** | `components/tax/blocks/DataTraceabilityBlock.tsx` · field `transformacion` (agregación · prorrateo · compensación). | **IMPLEMENTADO · revisar alcance** |
| 7 | **Proactive fiscal calendar con alertas** | `src/modules/fiscal/pages/CalendarioFiscalPage.tsx` · plurianual 6 años. `modules/ajustes/pages/NotificacionesPage.tsx` · alertas fiscales en email. | **IMPLEMENTADO · validar UX proactividad** |
| 8 | **AEAT direct connection** | NO EVIDENCIA · sin `fetchFromAEAT`, sin endpoint, sin OAuth. XML parser local-only. | **100% PENDIENTE** |
| 9 | **T18 Revolut calibración** | `services/bankProfilesService.ts` detecta Revolut Bank UAB (1583). Comentario en `bankStatementOrchestrator.ts`: "T18 will tighten this". | **PENDIENTE · base existe · falta calibración** |
| 10 | **T8 refactor schemas** | `docs/T9-cierre.md` · "T8 · refactor schemas restantes · descongelable tras T9". T9 cerrado 2026-05-01 → T8 ya **desbloqueado**. Sin trabajo iniciado. | **DESBLOQUEADO · no iniciado** |
| 11 | **T10 TODOs T7** | `docs/T9-cierre.md` · "T10 (tras T8) · cierre TODOs T7 sub-tareas 3-5". Bloqueado por T8. | **BLOQUEADO por T8** |

### Branches con nombre relacionado (señal de trabajo iniciado pasado · ¿abandonado?)

```
claude/aeat-xml-parser-FfNsw         → potencial GAPs XML
claude/audit-xml-aeat-fields-Qs4RM   → potencial GAPs XML
claude/fiscal-irpf-gaps-cierre       → cerrado en #1193
claude/fiscal-context-*              → cerrados (T14)
claude/compromise-detection-audit    → cerrado (T9.1)
claude/atlas-fiscal-tasks-cvtn0      → ?
claude/diagnose-capex-improvements   → potencial Pieza 7
claude/cleanup-legacy-stores-v42     → PR #992 abierto · obsoleto
```

Ninguna rama reciente apunta directamente a AEAT direct (#8), T18 Revolut (#9), T8 refactor (#10), T10 (#11).

---

## RESUMEN EJECUTIVO

| Hallazgo | Severidad |
|---|---|
| `HANDOFF-V7-atlas.md` no está versionado en repo | 🔴 alto · drift documental |
| Schema TS `AtlasHorizonDB` no incluye 3 stores V65 nuevos | 🟠 medio · deuda tipado |
| Schema TS aún declara `traspasosPlanes` y `objetivos_financieros` (legacy) | 🟢 bajo · cosmético |
| 49 PRs abiertos zombie (latest 2026-04-06) | 🟠 medio · housekeeping |
| 1.171 ramas remotas (la mayoría stale) | 🟠 medio · housekeeping |
| `feature/migration-v5` 141 commits behind main · stale | 🟢 bajo · revisar antes de borrar |
| 152 TODOs · ~50 son trabajo real (concentrados en Panel + Mi Plan + Inversiones) | 🟠 medio · cierre técnico |
| 5 mockups V3/V4 sin refresh a V5 (inmuebles · contratos · financiación · personal · ajustes) | 🟠 medio |
| AEAT direct (#8) · T18 Revolut (#9) · T8 (#10) · T10 (#11) | 🔴 alto · 100% pendiente |

**Próximo paso recomendado** · regenerar `HANDOFF-V8-atlas.md` con el estado actual + plan T8 (desbloqueado) + housekeeping ramas/PRs + refresh mockups V3/V4 → V5.

---

_Este documento es solo lectura. No se ha modificado código. No se han abierto PRs de código._
