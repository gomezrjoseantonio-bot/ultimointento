# Análisis Exhaustivo del Módulo Personal — Atlas Horizon

**Fecha:** 2026-04-03  
**Propósito:** Documentar el estado actual completo del módulo Personal para diseñar la gestión de ingresos y gastos personales.

---

## 1. STORES IndexedDB (db.ts)

**Archivo:** `src/services/db.ts` — Base de datos `AtlasHorizonDB`, versión **42** (V4.2), usa librería `idb`.

### Stores relacionados con Personal / Ingresos / Gastos / Financiación / Previsiones / Configuración:

| # | Store | KeyPath | AutoIncrement | Indexes | Versión |
|---|-------|---------|---------------|---------|---------|
| 1 | **personalData** | `id` | true | `dni` (UNIQUE), `fechaActualizacion` | V1.2 |
| 2 | **personalModuleConfig** | `personalDataId` | false | `fechaActualizacion` | V1.2 |
| 3 | **nominas** | `id` | true | `personalDataId`, `activa`, `fechaActualizacion` | V1.2 |
| 4 | **autonomos** | `id` | true | `personalDataId`, `activo`, `fechaActualizacion` | V1.2 |
| 5 | **pensiones** | `id` | true | `personalDataId`, `activa` | V2.5 |
| 6 | **otrosIngresos** | `id` | true | `personalDataId`, `tipo`, `activo`, `fechaActualizacion` | V1.2 |
| 7 | **personalExpenses** | `id` | true | `personalDataId` | V2.3 |
| 8 | **gastosRecurrentes** | `id` | true | `personalDataId` | V2.4 |
| 9 | **gastosPuntuales** | `id` | true | `personalDataId` | V2.4 |
| 10 | **planesPensionInversion** | `id` | true | `personalDataId`, `tipo`, `titularidad`, `esHistorico`, `fechaActualizacion` | V1.2 |
| 11 | **movimientosPersonales** | `id` | false | `tipo`, `origenId`, `fecha`, `cuenta`, `esRecurrente` | V1.2 |
| 12 | **prestamos** | `id` | false (UUID) | `inmuebleId`, `tipo`, `createdAt` | Financiación |
| 13 | **configuracion_fiscal** | `id` | false (singleton) | ninguno | V2.6 |
| 14 | **ejerciciosFiscales** | `ejercicio` | false | `estado`, `año`, `ejercicio`, `origen`, `snapshotId` | V2.7 |
| 15 | **inversiones** | `id` | true | `tipo`, `activo`, `entidad` | V1.3 |
| 16 | **opexRules** | `id` | true | `propertyId` | V2.2 |
| 17 | **budgets** | `id` | true | `year`, `version`, `status`, `year-version` (UNIQUE) | H9 |
| 18 | **presupuestos** | `id` | false (UUID) | `year`, `estado` | H9 |
| 19 | **valoraciones_historicas** | `id` | true | `tipo_activo`, `activo_id`, `fecha_valoracion` | V2.1 |
| 20 | **patrimonioSnapshots** | `id` | true | `fecha` (UNIQUE), `createdAt` | Dashboard |

---

## 2. GAPS IDENTIFICADOS

### Duplicidad de sistemas de gastos
- `personalExpenses` (UI activa) vs `gastosRecurrentes`/`gastosPuntuales` (legacy/abandonado)
- Categorías no coinciden entre sistemas

### Store `movimientosPersonales` sin uso
- Type `MovimientoPersonal` definido, store creado, pero sin servicio activo

### Sin presupuesto personal
- No hay store para definir presupuesto por categoría vs gasto real

### Sin inflación en proyecciones
- Proyección a 20 años sin ajuste IPC

### Sincronización Personal→Fiscal parcial
- Flags de integración existen pero la sincronización es manual
