# AUDIT · TAREA 15.1 · catálogo de claves del store `keyval`

> Auditoría exhaustiva del store IndexedDB `keyval` · clasificación A/B/C/D según `docs/TAREA-15-saneamiento-keyval.md` §1.3 · base para decisiones de limpieza/migración en sub-tareas 15.2 y 15.3.

> **NO se borra ni mueve nada en este commit.** Solo auditoría.

---

## 0 · Hallazgo crítico vs spec §1.2

La spec listaba 12 claves estáticas en `keyval`. Tras grep exhaustivo el reparto real es distinto · varias claves listadas allí **NO viven en keyval** sino en `localStorage`:

| Clave | Sitio real | Spec §1.2 decía |
|---|---|---|
| `atlas_account_migration_version` | `localStorage` (`accountMigrationService.ts:48,64`) | keyval |
| `atlas_iban_backfill_version` | `localStorage` (`accountMigrationService.ts:81,116`) | no listada |
| `atlas_migration_gastos_v1` | `localStorage` (`migracionGastosService.ts:21`) | keyval |
| `migration_backfill_importeBruto_0106_v1` | `localStorage` (`backfillImporteBruto0106.ts:90,92`) | keyval |
| `migration_clean_stale_cp_and_infer_itp_v1` | `localStorage` (`cleanStaleCPAndInferITP.ts:172,174`) | keyval |
| `migration_fix_reparaciones_duplicadas_v1` | `localStorage` (`fixReparacionesDuplicadas.ts:21,27`) | keyval |
| `migration_limpiar_gastos_reparacion_0106_v1` | `localStorage` (`limpiarGastosReparacionCasilla0106.ts:59,61`) | keyval |

**Implicación** · estas 6 claves quedan **fuera del alcance T15** (T15 audita el store `keyval`, no `localStorage`). Si Jose quiere sanearlas requeriría una T15-bis o ampliar scope. La auditoría runtime de `/dev/keyval-audit` no las verá porque solo lee IndexedDB.

---

## 1 · Claves identificadas en código

Búsqueda en `src/` (excluyendo `__tests__` y `*.test.*`) de toda invocación que tenga `'keyval'` como nombre de store. Las claves se resuelven a su literal cuando vienen de constantes.

### 1.1 · Claves fijas escritas/leídas activamente

| # | Clave literal | Constante / origen | Servicios consumidores | Naturaleza |
|---|---|---|---|---|
| 1 | `matchingConfig` | `MATCHING_CONFIG_KEY` (`budgetMatchingService.ts:56`) | `budgetMatchingService.ts:62,75,97` (R/W) · `transferDetectionService.ts:147,342` (R) | Configuración real |
| 2 | `dashboardConfiguration` | `DashboardService.indexedDbKey` (`dashboardService.ts:308`) | `dashboardService.ts:356,393` (R/W) | Configuración real |
| 3 | `base-assumptions` | `ASSUMPTIONS_KEY` (`proyeccionService.ts:51`) | `proyeccionService.ts:74,113` (R/W) | Configuración real (módulo legacy `horizon/proyeccion/`) |
| 4 | `base-projection` | `PROJECTION_KEY` (`proyeccionService.ts:52`) | `proyeccionService.ts:139,212` (R/W) | Cache recalculable (módulo legacy) |
| 5 | `proveedor-contraparte-migration` | literal (`migrationService.ts:31,92`) | `migrationService.ts` (R/W) · valor `'completed'` | Flag migración consumida |
| 6 | `migration_orphaned_inmueble_ids_v1` | `MIGRATION_KEY` (`migrations/migrateOrphanedInmuebleIds.ts:23`) | mismo archivo · `db.get/put('keyval', ...)` líneas 72,90,144 | Flag migración (puede re-correr si quedan huérfanos) |

### 1.2 · Claves documentadas en JSDoc sin escritor activo en código

Documentadas como destino canónico V60/V62 en `db.ts:2110-2126`, pero el grep no encuentra ningún `db.put('keyval', ..., '<clave>')` activo en el código actual. Si existen registros en la DB de Jose son de etapas anteriores a refactors recientes.

| # | Clave literal | Documentado en | Estado código actual | Naturaleza |
|---|---|---|---|---|
| 7 | `configFiscal` | `db.ts:2115` JSDoc | **0 lectores · 0 escritores** activos. La variable `configFiscal` que aparece en `treasurySyncService.ts:1007` es local (un objeto literal hardcoded), NO viene del keyval | desconocido · si Jose tiene registro · pertenece a T14 |
| 8 | `kpiConfig_horizon` | `db.ts:2119`, `kpiService.ts:3,238` | **0 lectores · 0 escritores** · `kpiService.saveConfiguration` es no-op (`kpiService.ts:237-239`), `getConfiguration` devuelve `DEFAULT_KPI_CONFIG` siempre | residual / posible huérfano si la migración V62 lo escribió |
| 9 | `kpiConfig_pulse` | `db.ts:2120`, `kpiService.ts:3,238` | igual que `kpiConfig_horizon` | residual / posible huérfano |

### 1.3 · Migración V63 → escritor implícito de `matchingConfig`

`db.ts:3577-3603` · durante el upgrade V63 copia `matchingConfiguration` (store antiguo) a `keyval['matchingConfig']`. Es un escritor one-shot dentro de la migración de schema, NO un escritor runtime. La clave queda viva como configuración persistente y la lee `budgetMatchingService` después.

---

## 2 · Claves dinámicas `planpagos_*`

### 2.1 · Patrón

`planpagos_${prestamoId}` · una entrada por préstamo activo. El valor es un objeto `PlanPagos` (ver `src/types/prestamos`) con · entre otros campos · un array `periodos[]` con `{fechaCargo, cuota}` por período de amortización.

### 2.2 · Productores (escritura)

| Sitio | Línea | Operación |
|---|---|---|
| `prestamosService.ts` | 631 | `db.put('keyval', plan, ...)` |
| `loanSettlementService.ts` | 623 | `tx.objectStore('keyval').put(totalPlan, ...)` (cancelación total) |
| `loanSettlementService.ts` | 649 | `tx.objectStore('keyval').put(partialPlan, ...)` (cancelación parcial) |
| `propertySaleService.ts` | 1198 | `tx.objectStore('keyval').put(...)` (rollback de venta) |
| `propertySaleService.ts` | 1292 | `tx.objectStore('keyval').put(truncatedPlan, ...)` (truncar plan tras venta) |

### 2.3 · Consumidores (lectura)

| Sitio | Línea | Operación |
|---|---|---|
| `prestamosService.ts` | 507 | `db.get('keyval', ...)` |
| `propertySaleService.ts` | 390 | `db.get('keyval', ...)` |
| `propertySaleService.ts` | 626 | `db.get('keyval', ...)` |
| `propertySaleService.ts` | 881 | `tx.objectStore('keyval').get(...)` |
| `propertySaleService.ts` | 1286 | `tx.objectStore('keyval').get(...)` |
| `historicalCashflowCalculator.ts` | 66 | `(db as any).get('keyval', ...)` |
| `loanSettlementService.ts` | (lectura previa al `put`) | dentro de transacción |
| `pages/inmuebles/InmueblesAnalisis.tsx` | 1230,1233,1240 | `getAllKeys('keyval')` + `filter(startsWith('planpagos_'))` + `db.get('keyval', key)` |
| `modules/horizon/tesoreria/HistoricoWizard.tsx` | 193 | `(db as any).get('keyval', ...)` |

### 2.4 · Cantidad esperada

Spec §1.2 dice "8+ préstamos activos en producción Jose". 1 entrada por préstamo activo. La auditoría runtime mostrará el número real.

### 2.5 · Formato del valor

Tipado como `PlanPagos` en `src/types/prestamos`. Importado en `prestamosService.ts:3` y consumido vía cast en otros sitios. Estructura mínima conocida:

```ts
{
  periodos: Array<{ fechaCargo: string; cuota: number; ... }>,
  // otros campos · ver src/types/prestamos
}
```

---

## 3 · Auditoría runtime · procedimiento para Jose

### 3.1 · Ejecutar la página

1. Arrancar deploy preview de la rama `chore/keyval-saneamiento`
2. Navegar a `/dev/keyval-audit` (DEV only, mismo patrón que `/dev/components` de T20.0)
3. La página invoca `auditKeyval()` y muestra una tabla con todas las claves vivas en IndexedDB del usuario
4. Para cada clave · botón **"Mostrar valor"** abre el contenido en un panel inspeccionable

### 3.2 · Output esperado

| Columna | Significado |
|---|---|
| `key` | nombre literal de la clave |
| `category` | A · B · C · D · `unknown` |
| `valueType` | tipo runtime de `value` (`object`, `array`, `string`, `number`, `boolean`) |
| `byteSize` | longitud de `JSON.stringify(value)` en bytes (aprox.) |
| `recommendation` | KEEP · DELETE · MOVE · TODO_T14 · TODO_PROYECCION · TODO_REVIEW |
| `reason` | breve justificación |

### 3.3 · Alternativa DevTools

Si Jose prefiere inspección directa · DevTools → Application → IndexedDB → `AtlasHorizonDB` → `keyval` · ver entradas y comparar con el listado del informe.

---

## 4 · Clasificación propuesta

Categorías según §1.3 de la spec:

- **A · Configuración real** → KEEP en keyval · documentar en JSDoc canónico (sub-tarea 15.4)
- **B · Cache recalculable** → BORRAR · recalcular al vuelo
- **C · Datos del usuario disfrazados** → MOVER al store correcto
- **D1 · Flag migración recurrente** → KEEP
- **D2 · Flag migración consumida** → BORRAR

| # | Clave | Categoría | Recomendación | Razón |
|---|---|---|---|---|
| 1 | `matchingConfig` | A | **KEEP** | Configuración activa de matching · destino canónico V63 |
| 2 | `dashboardConfiguration` | A | **KEEP** | Configuración del dashboard del usuario |
| 3 | `base-assumptions` | A | **KEEP** (TODO_PROYECCION) | Configuración de proyección · módulo legacy `horizon/proyeccion/` no migrado en T20 · revisitar cuando proyección migre (T21) |
| 4 | `base-projection` | B | **DELETE** (TODO_PROYECCION) | Cache de proyección recalculable. Habría que verificar que `loadBaseProjection()` puede regenerar de `base-assumptions` antes de borrar · revisitar en T21 si suficiente |
| 5 | `proveedor-contraparte-migration` | D2 | **DELETE** (sub-tarea 15.2) | Migración one-shot · valor `'completed'` · tras chequear código de `migrationService.ts` la migración no necesita re-correr |
| 6 | `migration_orphaned_inmueble_ids_v1` | D1 | **KEEP** | El código (`migrateOrphanedInmuebleIds.ts:71-76,87-95`) puede re-correr si la migración previa terminó sin huérfanos pero quedan en otros stores · borrarla forzaría re-ejecución |
| 7 | `configFiscal` | unknown | **TODO_T14 / TODO_REVIEW** | Documentada en JSDoc pero sin escritores ni lectores activos · si existe en DB de Jose · pertenece a T14 (configuración fiscal) · NO tocar en T15 |
| 8 | `kpiConfig_horizon` | unknown | **TODO_REVIEW** | `kpiService` es stub no-op tras V62 · si existe registro es residual de migración V62 · sin lectores activos · candidato a borrar pero requiere confirmación Jose |
| 9 | `kpiConfig_pulse` | unknown | **TODO_REVIEW** | Igual que `kpiConfig_horizon` |
| 10 | `planpagos_${prestamoId}` (N entradas) | C | **MOVE** (sub-tarea 15.3 si Jose la confirma) | Datos del usuario · debería vivir como campo `prestamo.planPagos` en el store `prestamos` |

---

## 5 · Decisiones que requieren input Jose

Antes de avanzar a sub-tarea 15.2, Jose debe responder a estas preguntas en deploy preview tras revisar `/dev/keyval-audit`:

### 5.1 · Borrados de categoría B y D2 confirmados

- **`proveedor-contraparte-migration`** (D2) · ¿confirmar borrado en 15.2? Riesgo: si Jose recargara fixtures antiguos sin contraparte la migración no re-correría. **Propuesta CC** · borrar.
- **`base-projection`** (B) · ¿borrar ya o esperar a T21? **Propuesta CC** · esperar a T21 (módulo proyección está congelado · no aporta riesgo dejarla viva)

### 5.2 · Claves residuales / huérfanas

- **`configFiscal`** · si existe en la DB de Jose · ¿confirmar que la maneja T14? **Propuesta CC** · NO tocar en T15 · aparcar para T14.
- **`kpiConfig_horizon` / `kpiConfig_pulse`** · `kpiService` es stub (no escribe ni lee). Si existen registros son residuales V62. ¿borrar en 15.2? **Propuesta CC** · borrar si existen · son cache muerto.

### 5.3 · Migración `planpagos_*` (15.3)

- **¿15.3 entra en alcance del PR T15?** · son datos reales del usuario (8+ préstamos) · 7 lugares de lectura + 5 de escritura adaptables · migración one-shot con flag idempotente. **Propuesta CC** · sí · cabe en este PR.
- **Alternativa** · si Jose prefiere · saltar 15.3 y dejar TODO para tarea futura.

### 5.4 · Flags `migration_*_v1` que viven en `localStorage`

Spec §1.2 las listaba como keyval pero el código las escribe en `localStorage`. **Fuera de scope T15** salvo decisión expresa. **Propuesta CC** · documentar y NO tocar en este PR · si Jose quiere sanear `localStorage` → tarea T15-bis.

### 5.5 · Claves sorpresa en runtime

Si la auditoría runtime descubre claves no listadas arriba (residuales históricas) Jose debe clasificarlas una a una antes de 15.2. La utility marca cualquier clave desconocida como `category: 'unknown'` + `recommendation: 'TODO_REVIEW'`.

---

## 6 · Resumen ejecutivo

- **9 claves estáticas** en keyval identificables desde el código (6 con escritor/lector activo · 3 documentadas pero residuales)
- **N claves dinámicas** `planpagos_*` (1 por préstamo activo · espera ~8 según spec)
- **Categorías propuestas** · A (3 claves) · B (1) · C (planpagos_* · N) · D1 (1) · D2 (1) · unknown (3)
- **Cambios reales en sub-tarea 15.2** · borrar 1 D2 confirmada (`proveedor-contraparte-migration`) + 0..2 huérfanas según runtime + 0..1 cache (B) según decisión Jose
- **Cambios reales en sub-tarea 15.3** (si confirmada) · mover N entradas `planpagos_*` a `prestamos.planPagos` · 7 consumidores adaptados · 5 productores adaptados
- **Spec §1.2 corregida** · 6 flags listados allí viven en `localStorage`, no en keyval · fuera de scope T15

> Fin del documento · pendiente revisión Jose en deploy preview vía `/dev/keyval-audit`.
