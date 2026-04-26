# Cierre 5 Deudas Técnicas Bloqueantes · Pre-reset v3

PR: `fix: cierre 5 deudas técnicas pre-reset v3`  
Branch: `fix/deudas-bloqueantes-pre-reset`  
Fecha: 2026-04-26  
DB_VERSION: 54

---

## Sub-tarea 1 · G-01 · `opexRules` → `compromisosRecurrentes` (V5.4)

### Decisión
Migración progresiva: `opexRules` queda DEPRECATED V5.4, sin escrituras nuevas desde producción.
Todos los consumidores leen/escriben `compromisosRecurrentes` con `ambito='inmueble'`.

### Cambios
- **`db.ts`**: `DB_VERSION` subido a 54. Migración V5.4 copia registros nuevos de
  `opexRules` → `compromisosRecurrentes` de forma idempotente (evita duplicados por `derivadoDe.refId`).
  `opexRules` marcado `// DEPRECATED V5.4`.
- **`opexService.ts`**: 100% lecturas/escrituras a `compromisosRecurrentes`. Nueva función
  `getCompromisosForInmueble` para código nuevo. `mapCompromisoToOpexRule` exportado para
  backward compat.
- **`propertyExpenses.ts`**: `getPropertyExpensesSnapshot` lee `compromisosRecurrentes`
  (ambito='inmueble') y mapea a `PropertyExpense[]`.
- **`operacionFiscalService.ts`**: `generarOperacionesDesdeRecurrentes` lee
  `compromisosRecurrentes` (ambito='inmueble', estado='activo').
- **`InmueblesAnalisis.tsx`**: `mapToSnapshot` recibe `compromisos: CompromisoRecurrente[]`
  en lugar de `opexRules: OpexRule[]`. Carga usa `getCachedStoreRecords('compromisosRecurrentes')`.

### Ambigüedades documentadas
- El store `opexRules` tenía `categoria: 'otro'` (sin 's'). El mapeo usa `'otro'` como fallback.
- Campos sin equivalente directo en `CompromisoRecurrente` (`casillaAEAT`, `categoria` OPEX)
  se serializan en `notas` como `{ _opexCategoria, _opexCasillaAEAT }` y se recuperan al
  mapear de vuelta.

---

## Sub-tarea 2 · BUG-07 · `rentaMensual` → `treasuryEvents` (V5.6)

### Decisión: Opción A
Usar `treasuryEvents` como fuente única de verdad para rentas de alquiler confirmadas.
Justificación: `treasuryEvents` ya cubre el modelo unificado de tesorería (PR3+). `rentaMensual`
no se alimenta de nuevos flujos desde la integración de contratos con `treasuryEvents`.

### Cambios
- **`estimacionFiscalEnCursoService.ts`**: `calcularMesesConDatos` usa `treasuryEvents`
  (type='income', status IN ['confirmed','executed'], isRentEvent) en lugar de `rentaMensual`.
- **`db.ts`**: `rentaMensual` marcado `// DEPRECATED V5.6`.

### Ambigüedades documentadas
- La spec dice `categoryKey='renta'` pero el catálogo (`categoryCatalog.ts`) usa `'alquiler'`
  para ingresos de alquiler. Se aceptan ambos: `['renta', 'alquiler', 'renta_inmueble']`.
- También se aceptan eventos con `sourceType='contrato'` y `type='income'` para garantizar
  compatibilidad con datos generados antes de la categorización por `categoryKey`.

---

## Sub-tarea 3 · BUG-08 · Cerrar dual-write `ejerciciosFiscales` legacy (V5.5)

### Decisión
Redirigir todas las escrituras de estado a `ejerciciosFiscalesCoord` via `ejercicioResolverService`.
`ejerciciosFiscales` queda DEPRECATED V5.5.

### Cambios
- **`ejercicioLifecycleService.ts`**: Todas las funciones write (`cerrarEjercicioConAtlas`,
  `procesarXMLSobreCierreAtlas`, `marcarPendienteCierre`, `marcarPrescrito`) redirigidas a
  `actualizarEstadoEjercicioCoord` de `ejercicioResolverService`. Cero escrituras a
  `ejerciciosFiscales`.
- **`ejercicioResolverService.ts`**:
  - `actualizarEstadoEjercicioCoord(año, estadoLegacy)`: nueva función exportada que mapea
    estados legacy a estados coord y escribe en `ejerciciosFiscalesCoord`.
  - `syncAndCleanupLegacyStore()`: nueva función exportada. Migra registros de
    `ejerciciosFiscales` a `ejerciciosFiscalesCoord` (solo si no existen). Idempotente.
- **`FiscalDashboard.tsx`**: Llama `syncAndCleanupLegacyStore()` una vez por sesión en el
  `useEffect` de carga inicial (junto a `bootstrapEjercicios`).
- **`db.ts`**: `ejerciciosFiscales` marcado `// DEPRECATED V5.5`.

### Mapeo de estados
| Legacy                    | Coord       | Justificación                                      |
|---------------------------|-------------|----------------------------------------------------|
| `vivo` / `en_curso`       | `en_curso`  | Año en curso sin datos definitivos                 |
| `cerrado` / `pendiente_cierre` | `pendiente` | Año cerrado por ATLAS, pendiente de declaración |
| `declarado`               | `declarado` | Año declarado ante AEAT                            |
| `prescrito`               | `prescrito` | Año prescrito (>4 años desde presentación)         |

### Limitaciones conocidas (pendiente V5.5)
- `cierreAtlasMetadata` (de `cerrarEjercicioConAtlas`) no se persiste en coord en V5.4.
  `procesarXMLSobreCierreAtlas` usará `ej.atlas.resumen` para el cálculo de diferencias;
  si no hay cálculo ATLAS previo, las diferencias se computan contra 0 (comportamiento
  conservador, no rompe UI). Pendiente campo `cierreAtlasMetadata` en `EjercicioFiscalCoord`.

---

## Sub-tarea 4 · GAP-D6 · `cuotaLiquida` hardcoded en `taxSlice`

### Decisión
Se mantiene `cuotaLiquida = cuotaIntegra` en el modelo básico (sin deducciones de la cuota
configuradas por el usuario). El fix principal es:
1. Computar `cuotaIntegraEstatal` y `cuotaIntegraAutonomica` por separado en `recalcular()`.
2. Exponer `cuotaLiquidaEstatal` y `cuotaLiquidaAutonomica` en el estado para que
   `ResumenDeclaracion` muestre valores correctos.
3. Eliminar el comentario engañoso "sin deducciones adicionales por ahora" → la asignación
   `cuotaLiquida = cuotaIntegra` es correct para el modelo básico pero ahora está
   correctamente documentada.

### Cambios
- **`taxSlice.ts`**: `TaxState` ampliado con `cuotaIntegraEstatal`, `cuotaIntegraAutonomica`,
  `cuotaLiquidaEstatal`, `cuotaLiquidaAutonomica`. `recalcular()` calcula estos valores
  separadamente.

### Fallback CCAA
La tarifa autonómica usa Madrid (CCAA 13) como fallback cuando no hay CCAA explícita configurada.
Documentado aquí y en comentario de código. Pendiente UI para seleccionar CCAA.

### Pendiente validación
Los datos reales de Jose 2024 no están disponibles en el repo. La validación con datos reales
queda pendiente.

---

## Sub-tarea 5 · Backup completo: `exportSnapshot` / `importSnapshot`

### Cambios
- **`db.ts`** `exportSnapshot`: serializa TODOS los stores activos (obtenidos de
  `db.objectStoreNames`) en formato V2:
  ```json
  {
    "metadata": { "dbVersion": 54, "exportDate": "...", "version": "2.0", "stores": [...] },
    "stores": { "storeName": [...records] }
  }
  ```
  Los documentos con `Blob` se guardan en la carpeta `documents/` del ZIP (igual que V1).
  Los campos V1 (`properties`, `contracts`, `documents`) se mantienen para backward compat.
- **`db.ts`** `importSnapshot`: detecta V2 vs V1 automáticamente. En V2, restaura todos los
  stores encontrados en el JSON que existan en la DB actual. En V1, comportamiento idéntico
  al anterior (solo `properties`, `documents`, `contracts`).

### Reversibilidad y cero pérdida de datos
- Import en modo `replace` borra el store antes de restaurar.
- Import en modo `merge` hace `put` por ID (no duplica) o `add` si no hay ID.
- Errores por duplicado se silencian (`/* dup, skip */`).

---

## Tests

Ver archivos en `src/services/__tests__/` y `src/store/__tests__/`.
