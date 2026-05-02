# ATLAS · Handoff V8 · estado al cierre de sesión

> **Fecha de cierre** · 2026-05-02 mañana
>
> **Sesión previa** · ver [HANDOFF-V5-atlas.md](./HANDOFF-V5-atlas.md) (V6 y V7 redactadas pero NUNCA commiteadas a repo · drift documental detectado en auditoría 2026-05-02 · regla nueva en §7 lo obliga a partir de ahora)
>
> **Auditoría base de este handoff** · [AUDIT-estado-repo-2026-05-02.md](./AUDIT-estado-repo-2026-05-02.md)
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama `main`
>
> **Deploy** · [ultimointentohoy.netlify.app](http://ultimointentohoy.netlify.app)
>
> **DB_VERSION** · 65 · 40 stores · sin migración pendiente
>
> **Stack** · React 18 · TS · Vite · Redux · IndexedDB · Netlify Functions · Claude API OCR

---

## 1 · Resumen ejecutivo

Sesiones previas (V6 + V7 sin commitear) cerraron mucho más de lo que el último handoff oficial (V5) recoge. La auditoría 2026-05-02 contrasta repo real vs handoffs perdidos y revela:

- 30 PRs mergeados entre 2026-05-01 y 2026-05-02 · todos en scope cerrado · sin scope nuevo abierto.
- DB_VERSION 65 · 40 stores · cifra coincide con afirmaciones V7.
- 3 stores V65 (`planesPensiones` · `aportacionesPlan` · `traspasosPlanPensiones`) creados en runtime pero **NO tipados en interface `AtlasHorizonDB`** · servicios usan `as any` casts · cierre cosmético en T26 (esta tarea).
- 4 tareas que V7 daba como pendientes están **YA IMPLEMENTADAS** · Pieza 7 CAPEX · Inspection correction flow · Inmueble transformation · Calendario fiscal proactivo.
- 1 tarea V7 está parcial · Mi Plan · página existe pero **NO se puede crear nada vía UI** (3 toasts "pendiente wizard dedicado" en Objetivos · Retos · Fondos).
- Cobertura mockup→V5 recalibrada · **0 mockups V5 completos** · 5 V5+minor · 5 V5 a medias · 3 fachadas V5 (Panel · Mi Plan · Topbar transversal · "dan vergüenza ajena" según auditor) · 3 V3/V4 sin migrar (Contratos · Financiación · Personal) · 1 mixto (Ajustes).
- Backlog 100% pendiente · AEAT direct · T18 Revolut · T8 schemas (desbloqueado tras T9) · T10 (bloqueado por T8) · Piezas 4·5·6·7·9·10 implementation roadmap.

Característica de la sesión 2026-05-02 · auditoría exhaustiva post-V7 + corrección de drift documental + tarea quirúrgica T26 (tipado + limpieza interface).

---

## 2 · Estado de tareas al cierre 2026-05-02

| ID | Tarea | Estado | PR/refs | Notas |
|---|---|---|---|---|
| T7 sub-tareas 1-7 | Limpieza V60 | ✅ | varios pre-V6 | sub-tarea 8 (docs) cerrada en sesión V6 |
| T9 · T9.1 · T9.2 · T9.3 | Bootstrap compromisos recurrentes | ✅ | #1195 #1196 #1197 #1199 #1200 | cerrada 2026-05-01 11:15 |
| T13 | Módulo planes de pensiones | ✅ | pre-V6 + cierre con 3 stores nuevos V65 | runtime OK · tipado pendiente T26 |
| T14 · T14.4 | Configuración fiscal sitio único | ✅ | #1191 #1193 #1194 | cerrada 2026-05-01 |
| T22 · T22.1-22.8 | Panel V5 · sidebar · topbar · hero · 4 activos · pulso · alertas · brújula · timeline | ✅ | #1198 #1201 #1202 #1203 #1204 #1206 #1208 #1211 #1219 | cerrada 2026-05-01 16:21 |
| T23 · T23.1-23.5 | Inversiones inicial | ✅ | #1205 #1207 #1209 #1210 #1212 | mergeadas con bugs · resueltos en T23.6 |
| T24 | Centralizar valoraciones · listado dos valores | ✅ | #1213 | matching id+nombre |
| T23.6 · T23.6.1-23.6.5 | Galería unificada · cinta · wizard v5 · ficha plan pensiones · cierre | ✅ | #1214 #1215 #1216 #1218 #1220 #1221 | T23.6.5 cierre formal 2026-05-02 00:49 |
| T25 | Fix Panel + timeline | ✅ | incluido en #1216 / #1217 | matching nombre + tipografía hero + click contratos + timeline grid |
| **T26** | **Handoff V8 + tipado stores V65 + cleanup interface** | ⏳ **EN CURSO** | — | esta tarea |

**Resumen de scope cerrado vs V5** · sesiones V6+V7 cerraron T9 · T13 · T14 · T22 (8 sub) · T23 (5 sub) · T23.6 (5 sub) · T24 · T25. Total · ~30 PRs en scope cerrado entre 2026-04-26 y 2026-05-02.

---

## 3 · Hitos arquitectónicos cerrados al cierre 2026-05-02

### 3.1 · Módulo planes de pensiones (T13 · cerrado pre-V6)

3 stores nuevos · `planesPensiones` (entidad estable con id UUID que sobrevive traspasos) · `aportacionesPlan` (eventos · cardinalidad alta · 3 roles aportante) · `traspasosPlanPensiones` (eventos de traspaso fiscal neutro). Stores legacy retirados · `planesPensionInversion` · `traspasosPlanes`.

Servicios · `planesInversionService.ts` · `aportacionesPlanService.ts` · `traspasosPlanPensionesService.ts` · `limitesFiscalesPlanesService.ts` (validación deducibilidad y cálculo reducción base IRPF por rol aportante).

**Pendiente cosmético** · tipar los 3 stores en `AtlasHorizonDB` y retirar `as any` casts (T26 · esta tarea).

### 3.2 · Bootstrap compromisos recurrentes (T9)

Detección automática de patrones desde `gastosInmueble` histórico (IBI · comunidad · seguros) · genera borradores en estado `sugerido` · UI aprobación · workflow `sugerido → confirmado → activo` que genera `treasuryEvents`.

### 3.3 · Configuración fiscal sitio único (T14)

Consolidación datos titular · gateway `fiscalContextService` · migración de consumidores legacy completada en T14.4.

### 3.4 · Panel V5 · 8 sub-tareas (T22.1-22.8)

Sidebar v5 transversal · Topbar v5 transversal (con stubs visibles) · saludo + hero patrimonial + composición · 4 activos pulse cards · pulso del mes · attention list · brújula Mi Plan · year timeline 12 meses.

**Deuda crítica al cierre** · 32 TODOs · alertas no conectadas · simulador Mi Plan no enchufado · año libertad sin valor real · KPIs activos hardcoded. Pendiente T28+.

### 3.5 · Inversiones (T23 + T23.6)

Galería unificada lee `inversiones` + `planesPensiones` con dedup · cinta resumen sticky con 4 KPIs alineada con mockup canónico tras fix · wizard v5 con 12 tipos + 2 atajos · ficha plan pensiones detallada con 4 KPIs + sparkline + estructura aportación + ventaja fiscal · camino doble Tesorería ↔ ficha confirmado.

**Deuda al cierre** · `FichaPosicionPage` placeholder · `FichaPlanPensiones` composición pendiente API gestora · `FichaValoracionSimple` datos composición pendientes.

### 3.6 · Valoraciones fuente única (T24 + T25)

`valoracionesService.getMapValoracionesMasRecientesConMatchingPorNombre` con fallback id→nombre. Listado Inmuebles muestra dos valores ("Comprado por" · "Vale hoy"). Audit `docs/[AUDIT-T24-valoraciones-matching.md](http://AUDIT-T24-valoraciones-matching.md)`.

### 3.7 · Panel fix (T25)

4 sub-bugs en 1 PR · valor inmuebles cuadrado (~1.106k) · tipografía hero `kpiStar` · click contratos a tab Acciones · timeline grid 12 cols con stack vertical libre por mes.

---

## 4 · Estado actual del modelo de datos

### 4.1 · Stores activos · 40 · DB_VERSION 65

40 stores en `upgrade()` callback (`src/services/db.ts`). Sin cambios en esta sesión · T26 solo tipa · no toca runtime.

Stores clave consumidos por scope cerrado V6+V7:
- `planesPensiones` · entidad estable plan
- `aportacionesPlan` · eventos aportación 3 roles
- `traspasosPlanPensiones` · eventos traspaso fiscal neutro
- `compromisosRecurrentes` · plantillas T9 generadas desde detección
- `inversiones` · posiciones financieras no-plan
- `valoraciones_historicas` · fuente única valoraciones
- `movements` + `treasuryEvents` · destino único movimientos
- `properties` · 8 inmuebles del usuario
- `contracts` · 30 contratos · 6 vencen próximos 60d

### 4.2 · Servicios canónicos · NO acceder directo al store

- `valoracionesService` · fuente única valoraciones
- `inversionesService` · CRUD posiciones store `inversiones`
- `planesInversionService` · CRUD planes store `planesPensiones`
- `aportacionesPlanService` · CRUD aportaciones store `aportacionesPlan`
- `traspasosPlanPensionesService` · CRUD traspasos store `traspasosPlanPensiones`
- `rendimientosService` · pagos de rendimientos · genera movements al confirmar
- `dashboardService` · KPIs Panel · ya migrado a `valoracionesService`
- `ejercicioResolverService` · gateway único datos fiscales
- `fiscalContextService` · gateway configuración fiscal sitio único T14

### 4.3 · Deuda de tipado al cierre · resuelta en T26

Interface `AtlasHorizonDB` (`src/services/db.ts`) · NO declara los 3 stores V65 nuevos como campos · servicios usan `db.add('planesPensiones' as any, ...)` · `db.getAll('aportacionesPlan' as any)` · etc.

Adicionalmente declara legacy ya retirados en runtime:
- `traspasosPlanes` (line 2091) · eliminado en V65
- `objetivos_financieros` (line 2203) · legacy

T26 cierra los 3 stores V65 + `as any` casts. Los 2 tipos legacy se mantienen por motivos legítimos · ver §4.4.

### 4.4 · Tipos legacy mantenidos en interface (decisión T26)

- `traspasosPlanes` · mantenido · `traspasosPlanesService.ts` aún consumido por 4 componentes UI · cleanup en T27-pre antes de migración Mi Plan
- `objetivos_financieros` · mantenido · necesario para upgrade() de DBs antiguas · eliminable solo a largo plazo

Ambos llevan JSDoc `@legacy` en el interface explicando la razón y la condición de eliminación.

---

## 5 · Datos confirmados del usuario al cierre

Sin cambios respecto V7. 5 hipotecas · 8 préstamos · deuda viva ~637k · 8 inmuebles · valoración real ~1.106.000 € · patrimonio neto ~+469k · 22 unidades arrendables · 15 contratos activos · 7 libres · renta mensual 7.715 € · 6 contratos vencen mayo-junio · Carles Buigas valoración real 230.000 €.

---

## 6 · Errores acumulados del asistente reconocidos al cierre 2026-05-02

Heredados de V7 · más uno nuevo de drift documental:

1. Etiquetar planes pensiones como "del módulo Personal" sin verificar
2. Proponer migración stores en auditoría inicial · contradiciendo saneamiento T15 cerrado
3. Olvidar cinta resumen entera del mockup en spec T23 inicial
4. Inventar brand-mark "Atlas / Patrimonio & Renta" en spec Z.1 que NO está en mockup
5. Inventar flujo `<DialogAportar>` desde galería que NO está en mockup
6. Criticar estética del wizard cuando el problema era completitud de tipos
7. Leer mal IndexedDB · escribir "23.000 €" cuando era "230.000 €"
8. Mapear tab "Acción" como inexistente en contratos · estaba mirando archivo legacy
9. Asumir que T23.6.2-fix bastaría con CSS sin verificar stop-and-wait CC
10. **NUEVO 2026-05-02** · redactar HANDOFF V6 y V7 sin commitearlos al repo · drift documental · próxima sesión arrancaba con V5 como verdad · obliga a regla nueva en §7

**Patrón** · falta de verificación previa antes de proponer · falta de cierre operativo de los entregables del propio asistente · cada error cuesta dinero al usuario en iteraciones evitables.

---

## 7 · Convenciones operativas reforzadas al cierre 2026-05-02

Heredadas de V7 · más una nueva por el drift detectado:

- Stop-and-wait estricto entre sub-tareas · violado en T23.6.2 · ahora explícito en cada prompt
- Verificar antes de inventar · grep en repo real · NO basarse en memoria
- Cero hex hardcoded fuera de tokens.css · si falta token · CREARLO
- Mockup canónico es ley · si conflicto con guía v5 · prevalece mockup
- Datos del usuario intactos · DB_VERSION 65 · 40 stores · NO se toca schema
- Servicios canónicos sobre acceso directo a stores
- Camino doble Tesorería ↔ ficha confirmado · ambos escriben en `movements + treasuryEvents`
- Inversiones NO usa lenguaje fiscal · puente discreto opcional · Fiscal vive aparte
- Planes de pensiones · 4 tipos administrativos PPI · PPE · PPES · PPA · NO colapsar
- **NUEVO 2026-05-02** · **el handoff de cierre de cada sesión SE COMMITEA al repo en `docs/[HANDOFF-VN-atlas.md](http://HANDOFF-VN-atlas.md)` como parte del último PR de la sesión** · sin commit · la sesión NO se considera cerrada · próxima sesión carece de verdad referenciable

---

## 8 · Pendiente al cierre · backlog re-priorizado tras auditoría 2026-05-02

### 8.1 · 🔴 Bloqueo del momento · 3 fachadas V5 (lo que da vergüenza enseñar)

| Fachada | Problema concreto | Impacto |
|---|---|---|
| **Panel** | 32 TODOs · alertas (deudas/borradores/obligaciones) NO conectadas · `añoLibertad`/`metaInmuebles` null sin simulador Mi Plan · KPIs 4 activos hardcoded · delta 30d sin snapshot · MiPlanCompass meta inmuebles null · PulsoDelMes proyección no conectada | Pantalla de bienvenida muerta |
| **Mi Plan** | NO se puede crear NADA vía UI · Objetivos·Retos·Fondos toast "pendiente wizard dedicado" · LandingPage punto cruce sin simulador escenarios · KPI estrella sin valor | Brújula del producto sin manos |
| **Topbar v5** | 9 TODOs · búsqueda real · panel notificaciones · centro ayuda · todos "próximamente" · badge count hardcoded a 12 · visible en TODAS las pantallas V5 | Rompe la ilusión en cada navegación |

Trabajo a abordar en T27 (Mi Plan wizards · 3 sub-PRs) · T28 (Panel conectar alertas + KPIs + simulador) · T29 (Topbar cerrar stubs o esconder).

### 8.2 · 🟠 Operativa · housekeeping

| Tarea | Detalle |
|---|---|
| Cierre 49 PRs zombies | Latest 2026-04-06 · cluster fiscal/dashboard/codex obsoleto · etiquetar `wontfix` y cerrar · 1 ronda CC |
| Purga ~1.120 ramas mergeadas | Script `git for-each-ref` + `merge-base --is-ancestor` · 1.171 → <50 |
| `feature/migration-v5` · 141 commits behind main | Stale · revisar antes de borrar por si trabajo perdido |

### 8.3 · 🟠 Arquitectónico · pendiente real

| Tarea | Estado | Por qué |
|---|---|---|
| **T27-pre** migración consumidores `traspasosPlanesService` → `traspasosPlanPensionesService` | Pendiente · prioridad inmediata pre-T27 | `traspasosPlanesService.ts` (5 llamadas store legacy `traspasosPlanes`) sigue importado por `PlanesManager` · `TraspasoForm` · `TraspasosHistorial` · `GestionInversionesPage`. Migrar consumidores al canónico desbloquea retirar el tipo legacy del interface y cierra el círculo del módulo planes pensiones de una vez. 30-60min CC. |
| **T8** schemas restantes | Desbloqueado tras T9 cierre · sin iniciar | Cache balance · histórico rentas activado · liquidación préstamo UI · backfill metadata documents · campos ya creados en T7 sub1 esperando uso real |
| **T18** Revolut calibración | Base existe · perfil detecta Revolut Bank UAB (1583) · falta calibrar parser | Comentario `bankStatementOrchestrator.ts` · "T18 will tighten this" |
| **T10** TODOs T7 cierre | Bloqueado por T8 | Tras T8 |

### 8.4 · 🟠 V3/V4 sin migrar a V5 (look antiguo · funcional)

| Mockup | Componente real | Deuda |
|---|---|---|
| `atlas-contratos-v4.html` | `src/modules/horizon/inmuebles/contratos/` | `ContractsListaEnhanced` borrada en T23.6.2 sin reemplazo claro · varias ramas claude/fix-contract-* abiertas |
| `atlas-financiacion-v2.html` | `src/modules/horizon/financiacion/` | PageHeader antiguo · `PrestamoDetailDrawer` PDF + Excel export TODO |
| `atlas-personal-v3.html` | `src/modules/horizon/personal/GestionPersonalPage` | 2 TODOs · 3 ramas claude/fix-gestion-personal-* abiertas (señal bugs sin cerrar) |
| `atlas-ajustes-v2.html` | mixto V3/V4 + V5 | `BancosManagement:191` `window.confirm` sin migrar a ATLAS modal · `PreferenciasDatos` antigua · ruta unificada pendiente |

### 8.5 · 🟡 V5 a medias · follow-ups acotados

| Mockup | Follow-up concreto |
|---|---|
| `atlas-inmuebles-v3.html` | `ListadoPage:258` cálculo real desde gastos · `PortfolioMap:27` mapa con pins relativos (decoración no datos reales) |
| `atlas-inversiones-v2.html` | `FichaPosicionPage` placeholder · `FichaPlanPensiones` composición API gestora · `FichaValoracionSimple` datos composición |
| `atlas-fiscal.html` | `DetalleEjercicioPage:344` integración bandeja Inbox · GAPs IRPF restantes (autonómicas · edad bono · vivienda habitual · discapacidad) |
| `atlas-archivo.html` | revisar end-to-end |
| `atlas-onboarding.html` | revisar flujo completo |

### 8.6 · 🟢 V5 + minor · cierre cosmético

`atlas-tesoreria-v8.html` (CashflowChart sub-tarea 20.3c) · `atlas-wizard-nuevo-contrato.html` · `atlas-inmueble-fa32-v2.html` · `atlas-correccion.html`.

### 8.7 · Largo plazo

- AEAT direct connection · certificado digital · sin evidencia en repo
- T19 IA fallback parsing CSV · post-T18
- T21 features sobre UI v5 estable · agrupará lo del §8.6 cuando V5 esté completa
- Piezas 4·5·6·7·9·10 implementation roadmap · solo P8 con evidencia (`DocumentLinkingPanel` + `documentMatchingService` + `documentIngestionService`)

### 8.8 · ✅ Cerrado en sesiones V6+V7 (NO confundir con pendiente · backlog V7 estaba mal)

- Pieza 7 CAPEX/mejoras históricas · `gananciaPatrimonialService` + venta wizard "Mejoras CAPEX acumuladas" + `TreasuryEvolucion`
- Inspection correction flow · `CorreccionWizard.tsx` 5 pasos
- Inmueble transformation entity · `DataTraceabilityBlock` campo `transformacion`
- Calendario fiscal proactivo · `CalendarioFiscalPage` plurianual + `NotificacionesPage` alertas email

---

## 9 · Mockups y documentos del proyecto al cierre 2026-05-02

### 9.1 · Mockups validados (en `docs/audit-inputs/`)

Sin cambios respecto V7. 16 archivos HTML en proyecto · 15 son UI · 1 narrativo (`atlas-historia-jose-v2.html`).

### 9.2 · Documentos arquitecturales

Sin cambios respecto V7. Añadidos en sesión 2026-05-02:
- `docs/[AUDIT-estado-repo-2026-05-02.md](http://AUDIT-estado-repo-2026-05-02.md)` · auditoría base de este handoff
- `docs/[HANDOFF-V8-atlas.md](http://HANDOFF-V8-atlas.md)` · este documento

### 9.3 · Outputs de sesión 2026-05-02

- `[AUDIT-estado-repo-2026-05-02.md](http://AUDIT-estado-repo-2026-05-02.md)` · auditoría exhaustiva de drift V7 vs realidad repo
- `[TAREA-26-handoff-v8-tipado-stores-V65.md](http://TAREA-26-handoff-v8-tipado-stores-V65.md)` · spec de esta tarea
- `[HANDOFF-V8-atlas.md](http://HANDOFF-V8-atlas.md)` · este documento

---

## 10 · Stack y workflow al cierre

### 10.1 · Stack
- React 18 · TypeScript strict · Vite · Redux Toolkit · IndexedDB (idb) · Netlify Functions · Claude API (OCR + extracción documentos)

### 10.2 · Workflow
1. Diseño/spec en chat Claude → markdown exhaustivo en `/mnt/user-data/outputs/`
2. Prompt corto a CC con referencia al spec
3. CC implementa en GitHub → branch + PR
4. Auto-deploy Netlify a deploy preview
5. Jose valida visual + funcional en deploy preview
6. Jose autoriza merge → main → deploy production
7. Si bugs · Jose reporta · vuelta al paso 1 (NO al paso 3)
8. **NUEVO** · cada sesión cierra con commit del HANDOFF-VN actualizado en `docs/`

### 10.3 · Reglas inviolables
- Stop-and-wait entre sub-tareas
- Cero hex hardcoded fuera de tokens.css
- Mockup canónico > guía v5 si conflicto
- Datos del usuario intactos · DB_VERSION en 65 · NO migrar schema
- Verificar antes de inventar · grep en repo real
- Servicios canónicos sobre acceso directo a stores
- Camino doble Tesorería ↔ ficha (movements + treasuryEvents destino único)
- **NUEVO** · handoff commiteado por sesión

### 10.4 · Diseño v5
- Tokens en `src/design-system/v5/tokens.css`
- Componentes base · `MoneyValue` · `PageHead` · `Icons` (lucide-react) · `TopbarV5` (con stubs · ver §8.1) · etc en `src/design-system/v5/`
- Tokens nuevos T23.6.2-fix · `--atlas-v5-pos-bright` (#6FD48A) · `--atlas-v5-gold-bright` (#E8D9AE)
- Distinción firme · `pos-wash`/`gold-light` para FONDOS · `pos-bright`/`gold-bright` para TEXTO sobre navy

---

## 11 · Próxima sesión · cómo arrancar

### 11.1 · Cargar contexto
1. Leer este handoff entero (V8)
2. Leer `docs/[AUDIT-estado-repo-2026-05-02.md](http://AUDIT-estado-repo-2026-05-02.md)` (auditoría base)
3. Pull `main` de `gomezrjoseantonio-bot/ultimointento`
4. Verificar deploy actual en `[ultimointentohoy.netlify.app](http://ultimointentohoy.netlify.app)`

### 11.2 · Primer paso
- Confirmar T26 cerrada y mergeada (handoff V8 commiteado · stores tipados · interface limpia)
- Arrancar **T27 · Mi Plan · 3 wizards de creación** (Objetivos · Retos · Fondos) con 3 sub-PRs stop-and-wait + simulador escenarios funcional para LandingPage punto de cruce
- Tras T27 · T28 (Panel conectar) · T29 (Topbar stubs) · T30 (housekeeping ramas/PRs) · T31 (T8 schemas)

### 11.3 · Lo que NO debe hacer el asistente
- NO proponer migraciones de schema
- NO etiquetar arbitrariamente stores como "del módulo X" sin verificar
- NO inventar elementos UI que no estén en mockup
- NO usar archivos legacy como referencia
- NO leer datos de IndexedDB sin verificar exactitud
- NO romper stop-and-wait en sub-tareas
- NO proponer specs sin antes haber validado todo en código real
- NO cerrar sesión sin commit del handoff

### 11.4 · Contexto crítico
- Jose es founder único · no programador · vende a pequeños inversores
- Bottleneck es técnico no comercial · canales pre-instalados (Zona 3 · Libertad Inmobiliaria · Unihouser)
- Espera proactividad · proposiciones claras · no preguntas vacías
- Intolerante con vaivenes · cambios de criterio · errores de verificación
- Trabaja con pantallazos · NO compila código · NO tiene CLI · NO ejecuta tests
- Validación = visual en deploy preview

---

**Fin handoff V8 · sesión cerrada · backlog re-priorizado · listo para retomar en T27.**
