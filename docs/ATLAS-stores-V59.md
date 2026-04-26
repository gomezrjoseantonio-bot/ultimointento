# ATLAS-stores-V59 · estado tras correcciones post-deploy

> Estado vivo del esquema IndexedDB tras la migración V5.9.
>
> Documento de referencia rápida. La auditoría histórica completa sigue en `ATLAS-mapa-stores-VIGENTE.md` (DB_VERSION 53) y el detalle Mi Plan v3 en `docs/STORES-MI-PLAN-v3.md`.

---

## 1 · Datos clave

| Métrica | Valor |
|---|---|
| `DB_NAME` | `AtlasHorizonDB` |
| `DB_VERSION` | **59** (V5.9) |
| Archivo fuente | `src/services/db.ts` |
| Stores activos esperados tras V59 | **59** |
| Stores eliminados en V5.9 | 1 (`objetivos_financieros`) |

---

## 2 · Origen del descuadre detectado en producción

Verificación manual del deploy (`ultimointentohoy.netlify.app`) reportó **60 stores · DB_VERSION 58** mientras la auditoría base (`ATLAS-mapa-stores-VIGENTE.md`, DB_VERSION 53) listaba **56 stores activos**.

Cuenta esperada tras TAREA 2 + TAREA 4 (V58):

```
56 (auditoría V53)
 + 1  escenarios          (V5.5 nuevo)
 + 1  objetivos           (V5.6 nuevo)
 + 1  fondos_ahorro       (V5.7 nuevo)
 + 1  retos               (V5.8 nuevo)
 - 1  objetivos_financieros (debía eliminarse en V5.5)
 = 59 stores
```

Real observado: **60**. Diferencia: **+1** = `objetivos_financieros` que la migración V5.5 no consiguió eliminar (los `deleteObjectStore` agendados dentro de `rawGetReq.onsuccess` no se ejecutaron de forma determinista en el commit de la `versionchange` transaction).

V5.9 cierra la migración de forma síncrona y determinista: tras subir a V59, el conteo queda en **59 · sin stores extra**.

---

## 3 · Inventario completo de los 59 stores tras V59

> Listado canónico generado a partir de `db.ts`. Cada store está agrupado por bloque temático y trazado a la migración (`V53` = preexistente en V5.3, `V55-V58` = añadidos por TAREA 4, `V59` = correcciones post-deploy).

### BLOQUE 1 — INMUEBLES (14)

| # | Store | Origen | Estado |
|---|---|---|---|
| 1 | `properties` | V53 | ACTIVO |
| 2 | `property_sales` | V53 | ACTIVO |
| 3 | `loan_settlements` | V53 | ACTIVO |
| 4 | `prestamos` | V53 | ACTIVO |
| 5 | `aeatCarryForwards` | V53 | ACTIVO |
| 6 | `propertyDays` | V53 | ACTIVO |
| 7 | `proveedores` | V53 | ACTIVO |
| 8 | `operacionesProveedor` | V53 | ACTIVO |
| 9 | `gastosInmueble` | V53 | ACTIVO |
| 10 | `mejorasInmueble` | V53 | ACTIVO |
| 11 | `mueblesInmueble` | V53 | ACTIVO |
| 12 | `vinculosAccesorio` | V53 | ACTIVO |
| 13 | `contracts` | V53 | ACTIVO |
| 14 | `rentaMensual` | V53 | ACTIVO (BUG-07 conocido) |

### BLOQUE 2 — INGRESOS / PERSONAL (11)

| # | Store | Origen | Estado |
|---|---|---|---|
| 15 | `personalData` | V53 | ACTIVO |
| 16 | `personalModuleConfig` | V53 | ACTIVO |
| 17 | `nominas` | V53 | ACTIVO |
| 18 | `autonomos` | V53 | ACTIVO |
| 19 | `pensiones` | V53 | ACTIVO |
| 20 | `planesPensionInversion` | V53 | ACTIVO |
| 21 | `traspasosPlanes` | V53 | ACTIVO |
| 22 | `otrosIngresos` | V53 | ACTIVO |
| 23 | `patronGastosPersonales` | V53 | ACTIVO |
| 24 | `gastosPersonalesReal` | V53 | ACTIVO |
| 25 | `viviendaHabitual` | V53 (nuevo V5.3) | ACTIVO |

### BLOQUE 3 — GASTOS / COMPROMISOS (4)

| # | Store | Origen | Estado |
|---|---|---|---|
| 26 | `opexRules` | V53 | DEPRECATED · dual-write |
| 27 | `compromisosRecurrentes` | V53 (nuevo V5.3) | ACTIVO |
| 28 | `presupuestos` | V53 | ACTIVO |
| 29 | `presupuestoLineas` | V53 | ACTIVO |

### BLOQUE 4 — TESORERÍA (10)

| # | Store | Origen | Estado |
|---|---|---|---|
| 30 | `accounts` | V53 | ACTIVO |
| 31 | `movements` | V53 | ACTIVO |
| 32 | `importBatches` | V53 | ACTIVO |
| 33 | `treasuryEvents` | V53 | ACTIVO |
| 34 | `treasuryRecommendations` | V53 | ACTIVO |
| 35 | `matchingConfiguration` | V53 | ACTIVO |
| 36 | `reconciliationAuditLogs` | V53 | INERTE (sin consumidor) |
| 37 | `movementLearningRules` | V53 | ACTIVO |
| 38 | `learningLogs` | V53 | ACTIVO |
| 39 | `kpiConfigurations` | V53 | ACTIVO |

### BLOQUE 5 — DOCUMENTOS / INBOX (1)

| # | Store | Origen | Estado |
|---|---|---|---|
| 40 | `documents` | V53 | ACTIVO |

### BLOQUE 6 — FISCALIDAD (10)

| # | Store | Origen | Estado |
|---|---|---|---|
| 41 | `ejerciciosFiscales` | V53 | DEPRECATED |
| 42 | `ejerciciosFiscalesCoord` | V53 | ACTIVO |
| 43 | `documentosFiscales` | V53 | ACTIVO |
| 44 | `arrastresManual` | V53 | ACTIVO |
| 45 | `resultadosEjercicio` | V53 | ACTIVO |
| 46 | `arrastresIRPF` | V53 | ACTIVO |
| 47 | `perdidasPatrimonialesAhorro` | V53 | ACTIVO |
| 48 | `snapshotsDeclaracion` | V53 | ACTIVO |
| 49 | `entidadesAtribucion` | V53 | ACTIVO |
| 50 | `configuracion_fiscal` | V53 | ACTIVO |

### BLOQUE 7 — INVERSIONES / PATRIMONIO (4)

| # | Store | Origen | Estado |
|---|---|---|---|
| 51 | `inversiones` | V53 | ACTIVO |
| 52 | `valoraciones_historicas` | V53 | ACTIVO |
| 53 | `valoraciones_mensuales` | V53 | ACTIVO |
| 54 | `patrimonioSnapshots` | V53 | ACTIVO |

### BLOQUE 8 — CONFIGURACIÓN / MISC (1)

| # | Store | Origen | Estado |
|---|---|---|---|
| 55 | `keyval` | V53 | ACTIVO |

### BLOQUE 9 — MI PLAN v3 (4)

| # | Store | Origen | Estado |
|---|---|---|---|
| 56 | `escenarios` | V5.5 (TAREA 4) | ACTIVO · singleton |
| 57 | `objetivos` | V5.6 (TAREA 4) | ACTIVO |
| 58 | `fondos_ahorro` | V5.7 (TAREA 4) | ACTIVO |
| 59 | `retos` | V5.8 (TAREA 4) | ACTIVO |

---

## 4 · Stores eliminados (referencia histórica)

| Store | Eliminado en | Motivo |
|---|---|---|
| `objetivos_financieros` | **V5.9** (este PR) | Renombrado a `escenarios` en V5.5; la deletion no se garantizaba |
| `rentCalendar` | V4.5 | Migrado a `rentaMensual` |
| `rentPayments` | V4.5 | Migrado a `rentaMensual` |
| `importLogs` | V4.7 | Sin consumidor |
| `personalExpenses` | V4.4 | Renombrado a `patronGastosPersonales` |
| `capex`, `gastosRecurrentes`, `gastosPuntuales` | V4.4 | Refactor gastosInmueble |
| `expensesH5`, `mejorasActivo`, `mobiliarioActivo`, `reforms`, `reformLineItems` | V4.2 | Refactor inmueble |
| `movimientosPersonales`, `ingresos`, `budgetLines`, `budgets`, `expenses`, `fiscalSummaries`, `gastos`, `operacionesFiscales`, `propertyImprovements` | V4.2-V4.4 | Limpieza arquitectónica |

---

## 5 · Cómo verificar el conteo

Tras refrescar `ultimointentohoy.netlify.app` y permitir la subida automática a V59:

```js
// DevTools console
await window.atlasDB.getDBVersion();   // → 59
await window.atlasDB.listStores();     // → array de 59 stores (sin objetivos_financieros)
(await window.atlasDB.listStores()).length;  // → 59
```

`window.atlasDB` queda expuesto al cargar `src/services/db.ts` y agrupa: `exportSnapshot` (ZIP), `exportSnapshotJSON`, `importSnapshot`, `resetAllData`, `getDBVersion`, `listStores`.
