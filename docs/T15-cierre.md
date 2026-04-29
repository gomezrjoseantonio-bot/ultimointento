# T15 · Cierre · saneamiento `keyval`

> Resumen ejecutivo · TAREA 15 cerrada en main tras 4 sub-tareas y 3 PRs (#1188 audit, #1189 cleanup+migration, este PR hardening+docs).

## 1 · Qué hacía cada categoría · qué se hizo

| Categoría | Política | Acción T15 |
|---|---|---|
| **A · Configuración real** | KEEP en keyval · documentar formato + dueño | Documentadas en JSDoc `services/db.ts:keyval` |
| **B · Cache recalculable** | BORRAR · regenerar al vuelo | `base-projection` borrada en 15.2 |
| **C · Datos del usuario disfrazados** | MOVER al store correcto | `planpagos_*` → `prestamos[id].planPagos` en 15.3 |
| **D1 · Flag migración recurrente** | KEEP | `migration_orphaned_inmueble_ids_v1` conservada |
| **D2 · Flag migración consumida** | BORRAR | `proveedor-contraparte-migration` borrada en 15.2 |
| **Residuales V62** | BORRAR si existen | `kpiConfig_horizon`, `kpiConfig_pulse` borradas en 15.2 |

## 2 · Cambios en cifras

### Claves antes / después

| Estado | A | B | C | D1 | D2 | residual | Total estáticas |
|---|---|---|---|---|---|---|---|
| Pre-T15 | 3 | 1 | N (≈8 dinámicas) | 1 | 1 | 3 | 9 + N |
| Post-T15 | 3 | 0 | 0 | 3 | 0 | 0 | 6 |

**Claves vivas post-T15** (todas A o D1):
- `matchingConfig` (A · KEEP)
- `dashboardConfiguration` (A · KEEP)
- `base-assumptions` (A · KEEP · TODO_PROYECCION T21)
- `migration_orphaned_inmueble_ids_v1` (D1 · KEEP)
- `cleanup_T15_v1` (D1 · flag idempotencia limpieza T15.2)
- `migration_keyval_planpagos_to_prestamos_v1` (D1 · flag idempotencia migración T15.3)

### Diff bytes en keyval

Estimación · cada `planpagos_${id}` ronda 5-15 KB (cuadro de amortización completo). Con ~8 préstamos activos en producción Jose · entre 40 y 120 KB liberados de keyval. Las claves cache/residuales (`base-projection`, `kpiConfig_*`, `proveedor-contraparte-migration`) suman menos de 5 KB.

**Diff orientativo** · keyval reducido en aproximadamente 50-130 KB · todos esos bytes se preservan en `prestamos[id].planPagos` (no se pierde dato del usuario · solo se reubica) o se descartan (cache regenerable, flags consumidos, residuales sin lectores).

## 3 · Ficheros tocados por sub-tarea

### 15.1 · Auditoría (PR #1188)
- `docs/AUDIT-T15-keyval.md` (nuevo)
- `src/services/__keyvalAudit.ts` (nuevo)
- `src/pages/dev/KeyvalAudit.tsx` + `.module.css` (nuevo)
- `src/services/__tests__/keyvalAudit.test.ts` (nuevo · 7 tests)
- `src/App.tsx` (ruta DEV `/dev/keyval-audit`)

### 15.2 · Limpieza (PR #1189 commit 1)
- `src/services/keyvalCleanupService.ts` (nuevo)
- `src/services/__tests__/keyvalCleanupService.test.ts` (nuevo · 7 tests)
- `src/App.tsx` (invocación tras `migrateFinanciacionV2`)
- `src/types/prestamos.ts` (campo `planPagos?: PlanPagos`)

### 15.3 · Migración planpagos_* (PR #1189 commit 2)
- `src/services/migrations/migrateKeyvalPlanpagosToPrestamos.ts` (nuevo)
- `src/services/migrations/__tests__/migrateKeyvalPlanpagosToPrestamos.test.ts` (nuevo · 9 tests con hardening)
- Consumidores adaptados (8 ubicaciones · `prestamosService`, `propertySaleService` ×4, `loanSettlementService`, `historicalCashflowCalculator`, `HistoricoWizard`, `InmueblesAnalisis`)
- Productores adaptados (5 ubicaciones · folded en `prestamos.put` existentes)
- Tests existentes adaptados (`propertySaleService.test.ts` · 3 tests con planPagos en prestamo)
- `src/App.tsx` (invocación tras `runKeyvalCleanup`)

### 15.4 · Docs canónicos + hardening (este PR)
- `src/services/db.ts:keyval` JSDoc · catálogo canónico completo
- `docs/STORES-V60-ACTIVOS.md` · sección keyval actualizada · TAREA 15 marcada cerrada
- `docs/T15-cierre.md` (este documento)
- Hardening defensivo del Copilot review en PR #1189:
  - `migrateKeyvalPlanpagosToPrestamos.ts` · helper `resolvePrestamo` con fallback numérico para préstamos legacy con `id` numérico residual
  - `propertySaleService.ts` · mismo fallback en restore de venta cancelada
  - `InmueblesAnalisis.tsx` · `db = await initDB()` sin uso eliminado
  - +2 tests para el caso loanId numérico legacy

## 4 · DB_VERSION

Sigue en **65**. T15 se ejecuta enteramente como limpieza/migración runtime · no toca el schema · no requiere `objectStore.createIndex`/`createObjectStore`/etc.

El campo `planPagos?: PlanPagos` en interfaz `Prestamo` es opcional · IndexedDB es schemaless por registro · los préstamos existentes simplemente ganan el campo cuando la migración corre.

## 5 · Idempotencia

Las dos operaciones runtime escriben flags `'completed'` en keyval que previenen re-ejecución:

- `cleanup_T15_v1` · si ya está `'completed'` → `runKeyvalCleanup` retorna `{ skipped: true, ... }` sin tocar nada
- `migration_keyval_planpagos_to_prestamos_v1` · si ya está `'completed'` → `migrateKeyvalPlanpagosToPrestamos` retorna `{ skipped: true, ... }` sin tocar nada

Para forzar re-ejecución (si Jose añade nuevas claves o quiere re-correr la migración con datos nuevos), borrar manualmente el flag desde DevTools.

## 6 · Lo que T15 NO hizo (alcance fuera)

- ❌ NO consolidó configuración fiscal · `configFiscal` queda fuera · es **T14**
- ❌ NO migró `base-assumptions` ni `base-projection` por completo · módulo legacy `proyeccion/` esperando T21
- ❌ NO subió DB_VERSION
- ❌ NO modificó lógica de negocio · solo limpieza/movimiento de datos
- ❌ NO tocó claves listadas en spec §1.2 que viven en `localStorage` (no IndexedDB) · 7 claves fuera de scope

## 7 · Verificación final post-T15

- [x] Catálogo canónico en JSDoc `services/db.ts:keyval` · 6 claves vivas + lista prohibidas + checklist alta de claves
- [x] `docs/STORES-V60-ACTIVOS.md` actualizado · sección keyval describe estado post-T15 · TAREA 15 marcada cerrada
- [x] `tsc --noEmit` sin errores nuevos
- [x] `CI=true npm run build` OK
- [x] Tests T15: 9 + 7 + 7 = 23/23 passed (hardening incluido)
- [x] Grep `planpagos_` solo en archivos T15 (audit, cierre, migración, tests, jsdoc) · ninguna referencia activa a `keyval[planpagos_*]` en código de producción
- [x] DB_VERSION sigue en 65
- [x] Datos del usuario intactos · planPagos se preserva en migración + spread en updates · fallback numérico defensivo previene pérdida en préstamos legacy

## 8 · Después de T15

Según spec §8:
1. **Descongelar T14** · configuración fiscal sitio único
2. T14 → T9 → T8 → T10 (resto de saneamientos)
3. Tras los 5 saneamientos cerrados, valorar T21 (purga horizon legacy) o nuevo bloque de features

---

**Fin del cierre T15 · 4 sub-tareas + hardening · todas mergeadas a main.**
