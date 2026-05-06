# STOP-AND-REPORT · T14.2 · fiscalContextService gateway

> **Estado** · auditoría preflight §0.6 detenida · trabajo ya presente en `main`
> **Rama** · `feature/T14-2-fiscal-context-gateway`
> **Fecha** · 2026-05-06
> **Spec ejecutado** · `docs/TAREA-14-2-a-14-5-fiscal-config-v2.md` §2

Per regla §0.2 del spec ("Si CC encuentra ambigüedad · PARAR · comentar PR · esperar input") y §0.6 ("Si la auditoría detecta divergencia · PARAR y reportar") · **NO se ha creado ni modificado ningún archivo en `src/`** (cero cambios de código). El único archivo nuevo de esta rama es **este propio reporte** en `docs/`.

---

## 1 · Resumen ejecutivo

T14.2 pide crear `src/services/fiscalContextService.ts` como gateway nuevo · pero **el archivo ya existe en `main`** · con tests · con consumidores migrados · y con marcadores que indican que T14.3 y T14.4 también se han ejecutado parcial o totalmente.

| Sub-tarea | Estado real en main | Evidencia |
|---|---|---|
| **T14.2** · gateway | ✅ implementado | `src/services/fiscalContextService.ts` (301 líneas) + `src/services/__tests__/fiscalContextService.test.ts` (10 tests) |
| **T14.3** · 5 GAPs IRPF | ✅ implementado | `src/services/irpfCalculationService.ts` con marcadores `T14.3` (líneas 4-5, 233, 1217, 1260, 1504) + `src/services/__tests__/irpfCalculationService.t14gaps.test.ts` |
| **T14.4** · 13 consumidores migrados | ✅ implementado (con excepciones documentadas) | Marcadores `T14.4 · migrado` en al menos 11 archivos · `T14.4 · EXCEPCIÓN documentada` para casos legítimos |
| **T14.5** · cleanup keyval + docs cierre | ❌ pendiente | NO existe `src/services/migrations/cleanupConfigFiscalKeyval.ts` · NO existe `docs/T14-cierre.md` · `STORES-V60-ACTIVOS.md` sigue stale (DB v64-65) |

**Procedencia del trabajo presente** · todo el material entró en `main` mediante un único commit `6bd127f` ("Add files via upload" · 2026-05-02 13:12) · NO mediante los PRs sub-tarea con stop-and-wait que el plan v2 §0.1 exige.

---

## 2 · Evidencias detalladas

### 2.1 · `fiscalContextService.ts` ya existe

```
src/services/fiscalContextService.ts (301 líneas)
- Cabecera · "ATLAS · TAREA 14.2 · fiscalContextService"
- API · getFiscalContext · getFiscalContextSafe · invalidateFiscalContext
- Cache in-memory TTL 30s
- Helper interno `calcularEdad` (ISO + dd/mm/yyyy)
- buildFiscalContext + mapViviendaHabitual

git blame · ^6bd127f gomezrjoseantonio-bot 2026-05-02 13:12:38 +0200
git log --all -- src/services/fiscalContextService.ts
  → 6bd127f Add files via upload
```

La forma del `FiscalContext` exportado es **idéntica al spec §2.2** salvo que `descendientes`/`ascendientes` exponen `nombre: string` (vacío) · `fechaNacimiento: string` y `edadActual: number` siempre (no `number | null`). Cumple la API que el spec promete a los consumidores.

### 2.2 · Tests T14.2 ya presentes

```
src/services/__tests__/fiscalContextService.test.ts (11.027 bytes · 2026-05-02)
- 9 tests obligatorios según spec §2.3 + 1 extra de idempotencia · 10 total
- Mocks de personalDataService y obtenerViviendaActiva
- jest.useFakeTimers + setSystemTime(2026-04-30)
```

Spec §2.3 pedía 9 tests · el archivo presente cubre los 9 + 1 extra de idempotencia · 10 en total. Cobertura mayor que la exigida.

### 2.3 · T14.3 ya implementada

```
src/services/irpfCalculationService.ts
  4: // T14.3 (2026-04) · IRPF lee el contexto fiscal unificado vía
  5: // `fiscalContextService` (gateway T14.2) en lugar de leer `personalData`
233: // T14.3 · diagnóstico de cierre de GAPs fiscales · qué reglas aplicaron
1217: idéntico al comportamiento previo a T14.3.
1260: // PASO 0 · contexto fiscal unificado (T14.3)
1262: // a cargo del side de escrituras (T14.4 · cuando se cableen los
1504: // T14.3 · construir warnings de la declaración

src/services/__tests__/irpfCalculationService.t14gaps.test.ts (13.101 bytes)
```

### 2.4 · T14.4 ya implementada (con excepciones documentadas)

11 archivos importan el gateway:
```
src/services/fiscalPaymentsService.ts
src/services/dashboardService.ts
src/services/irpfCalculationService.ts
src/modules/horizon/tesoreria/services/treasurySyncService.ts
src/modules/horizon/proyeccion/mensual/services/proyeccionMensualService.ts
src/modules/inversiones/components/wizard/PlanFormV5.tsx
src/modules/inversiones/pages/FichaPlanPensiones.tsx
src/modules/panel/PanelPage.tsx
src/components/personal/planes/PlanForm.tsx
src/components/personal/planes/PlanesManager.tsx
src/components/personal/nomina/NominaManager.tsx
src/pages/GestionInversiones/GestionInversionesPage.tsx
```

Marcadores explícitos · 
- `T14.4 · migrado a fiscalContextService gateway (solo personalDataId)` (treasurySyncService ×4 · dashboardService ×1)
- `T14.4 · EXCEPCIÓN documentada` (fiscalPaymentsService · `situacionLaboral` no en gateway · treasurySyncService · `direccion` no en gateway)
- `T14.4 · personalDataService se mantiene SOLO para la lectura de direccion`

La decisión `situacionLaboral` (a/b) del spec §4.4 ya está tomada · **opción b · queda fuera del gateway · documentada como excepción**.

### 2.5 · T14.5 pendiente (única sub-tarea no implementada)

- ❌ NO existe `src/services/migrations/cleanupConfigFiscalKeyval.ts` (verificado · `ls src/services/migrations/`)
- ❌ NO existe `docs/T14-cierre.md`
- ❌ `docs/STORES-V60-ACTIVOS.md` sigue stale · cabecera DB_VERSION 64 · "39 stores activos" · "DB_VERSION sin cambios (sigue en 65)"
- ❌ `db.ts:2189` aún documenta `keyval['configFiscal']` como pendiente

---

## 3 · Análisis · ¿qué pasó?

El único commit que introduce todo este material es `6bd127f Add files via upload` del 2026-05-02 13:12:38. Esto sugiere que el trabajo se subió en bloque · presumiblemente desde otro entorno · sin pasar por los PRs sub-tarea con stop-and-wait que el plan v2 §0.1 exige (`cada PR contra main directo · NO acumular · NO rama madre`).

El plan v2 fue creado **el mismo día** (probablemente después · refresh de v1) y nombra T14.1 como único predecesor cerrado · pero T14.2-T14.4 ya estaban en `main` · solo no formalizadas como PRs separados.

Esto NO es un error de código · el código parece correcto y es bien probable que funcione · pero **no respeta el contrato de stop-and-wait del plan**. Por eso este STOP existe.

---

## 4 · Decisiones que necesito de Jose

### 4.1 · ¿Cómo proceder con T14.2?

**Opción A · Cerrar T14.2 declarándola "ya implementada"** · NO tocar nada · este STOP-REPORT cumple el rol de evidencia · cerrar PR sin merge · saltar directamente a T14.5.

**Opción B · Validar formalmente T14.2** · revisar `fiscalContextService.ts` y sus tests · si cumplen el spec §2 · marcar como "validado retro" en el plan v2 · saltar a T14.5.

**Opción C · Reescribir T14.2 desde cero** · descartar el archivo actual · reimplementarlo según spec literal · alto coste · alto riesgo (consumidores ya lo usan).

CC recomienda **B** · el archivo actual cumple el spec · solo falta verificar que tests pasan en CI y que la página `/dev/fiscal-context-audit` (T14.1) sigue funcionando.

### 4.2 · ¿T14.3 y T14.4 también se dan por cerradas?

Si la respuesta a 4.1 es A o B · simétricamente:
- T14.3 · ya implementada · validar retroactivamente revisando test `t14gaps.test.ts`
- T14.4 · ya implementada con 2 excepciones documentadas (`situacionLaboral`, `direccion`) · validar lista de 13 consumidores

### 4.3 · ¿Saltamos directamente a T14.5?

Si Jose valida 4.1 + 4.2 · la única sub-tarea pendiente es T14.5:
- Crear `cleanupConfigFiscalKeyval.ts` con flag `cleanup_T14_v1`
- Tests de idempotencia
- Refresh `STORES-V60-ACTIVOS.md` · cabecera v64-65 → v69 · 39 → 40 stores
- Crear `docs/T14-cierre.md`
- Actualizar JSDoc en `db.ts`

### 4.4 · ¿Reportar la falta de PR para T14.2-T14.4?

El plan v2 §0.1 exige PR separado por sub-tarea. Si Jose quiere mantener trazabilidad · una opción es crear un PR retro "feat(fiscal): T14.2-T14.4 · validación retroactiva · trabajo ya en main" SIN cambios · solo descripción documentando el scope · y mergearlo como sello formal.

---

## 5 · Lo que NO he hecho (esperando autorización)

- ❌ NO he creado `src/services/fiscalContextService.ts` (ya existe)
- ❌ NO he creado tests (ya existen)
- ❌ NO he tocado la página `/dev/fiscal-context-audit`
- ❌ NO he tocado `docs/STORES-V60-ACTIVOS.md`
- ❌ NO he ejecutado `npm test` para no consumir tiempo · spec dice 20-40 min · esto es solo auditoría

## 6 · Lo que SÍ he hecho

- ✅ Verificado DB_VERSION = 69 · 40 stores · main al día tras merge T13 lote B+C
- ✅ Detectado existencia previa del gateway via `git log --all`
- ✅ Confirmado consumidores migrados via `grep`
- ✅ Confirmado tests presentes (`fiscalContextService.test.ts` + `irpfCalculationService.t14gaps.test.ts`)
- ✅ Confirmado T14.5 NO implementada (no `cleanupConfigFiscalKeyval.ts` · no `T14-cierre.md`)
- ✅ Este reporte

---

## 7 · Próximo paso esperado

Jose responde con decisión sobre §4 (A · B · C) y autoriza · 
- Si A o B · CC procede a T14.5 directamente en rama nueva
- Si C · CC reimplementa T14.2 (alta complejidad · requiere coordinarse con consumidores)
- Si validación retroactiva PR · CC abre PR sin cambios documentando estado

---

*Fin del reporte · STOP-AND-WAIT · NO se ha creado código · PR opcional para visibilidad.*
