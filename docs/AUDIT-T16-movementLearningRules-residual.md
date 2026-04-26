# AUDIT-T16 · Verificación residual `movementLearningRules` + estado importación masiva

**Fecha:** 2026-04-26
**Branch:** `claude/verify-movement-learning-rules-KV5RY`
**Alcance:** auditoría sobre `src/services/movementLearningService.ts` y servicios/UI de importación bancaria. NO toca `DB_VERSION` ni `schema`. NO refactor de la importación.

---

## Verificación 1 · Invocaciones de `appendHistory()` en los 4 puntos de escritura

`appendHistory()` está definida en `src/services/movementLearningService.ts:5-9`.

| # | Función | Línea de `db.put`/`db.add` | ¿Llama a `appendHistory()`? | Detalle |
|---|---|---|---|---|
| 1 | `createLearningRule` (rama "regla existente") | `db.put` en línea 157 | **SÍ** | `appendHistory(rule, { action: 'CREATE_RULE', ... })` en línea 155. |
| 2 | `createLearningRule` (rama "nueva regla") | `db.add` en línea 179 | N/A — inicializa `history: [...]` inline en línea 176 con la primera entrada. Equivalente funcionalmente (FIFO no aplica con un solo elemento). |
| 3 | `createOrUpdateRule` (rama "regla existente") | `db.put` en línea 215 | **SÍ (corregido en este PR)** | Antes del fix no invocaba `appendHistory`. Tras el fix se llama en la línea 214: `appendHistory(rule, { action: 'CREATE_RULE', ... })`. |
| 4 | `createOrUpdateRule` (rama "nueva regla") | `db.add` en línea 235 | N/A — tras el fix inicializa `history: [{ action: 'CREATE_RULE', ts }]` inline en línea 232 (antes del fix no inicializaba el campo en absoluto). |
| 5 | `applyRuleToGrays` (acumulación batch) | `db.put` en línea 327 | **SÍ inline** | No usa el helper, pero implementa el mismo recorte FIFO `> 50` en líneas 324-326. |
| 6 | `applyAllRulesOnImport` (actualización por regla aplicada) | `db.put` en línea 397 | **SÍ** | `appendHistory(rule, { action: 'APPLY_RULE', ts })` en línea 396. |

**Resultado:** antes del PR había **2 puntos sin `appendHistory`** (ambas ramas de `createOrUpdateRule`). Tras el fix de este PR todos los puntos de escritura sobre `movementLearningRules` alimentan `history[]`.

> Nota: `performManualReconciliation` (línea 421+) sí escribe en el store `movements` (línea 463) pero la mutación de `movementLearningRules` la delega a `createLearningRule` (línea 472), que ya está cubierta arriba. No es un cuarto put directo sobre el store de reglas.

---

## Verificación 2 · Causa raíz de 0 registros en producción

**Hallazgo principal:** la UI que dispara la creación de reglas de aprendizaje está implementada pero **no está enchufada en ninguna ruta activa** de `src/App.tsx`.

`performManualReconciliation` solo se invoca desde `src/modules/horizon/tesoreria/components/MovementDrawer.tsx:100`. La cadena de renderizado de ese componente es:

- `MovementDrawer.tsx` ← `AccountCalendar.tsx`
- `AccountCalendar.tsx` ← `AccountCard.tsx` (`src/modules/horizon/tesoreria/components/AccountCard.tsx`) y `Movimientos.tsx` (`src/modules/horizon/tesoreria/movimientos/Movimientos.tsx`)
- `Movimientos.tsx` no se importa en ningún sitio (huérfano)
- `AccountCard.tsx` (en `tesoreria/components`) no se referencia en ningún sitio
- `TreasuryMainView.tsx` y `TreasuryMainPage.tsx` no se referencian en `App.tsx`

La ruta `/tesoreria` resuelve a `Tesoreria.tsx → TesoreriaSupervisionPage.tsx`, que es **read-only** (tabs Evolución y Balances bancarios) y no instancia `MovementDrawer`. La ruta `/tesoreria/cuenta/:id` resuelve al mismo `Tesoreria.tsx`. La ruta `/conciliacion` resuelve a `ConciliacionPageV2.tsx`, que usa `treasuryConfirmationService` y tampoco invoca `performManualReconciliation`.

**Por eso `movementLearningRules` está vacío después de 6 meses:** no hay camino UI rutado que clasifique manualmente un movimiento y aterrice en `performManualReconciliation`. El punteo manual real que hace Jose ocurre en `ConciliacionPageV2`, que confirma/elimina/revierte eventos pero no crea reglas de aprendizaje.

**Hipótesis secundarias evaluadas:**

- **Hash demasiado estricto:** `buildLearnKey()` (línea 94) construye la clave con `v1|signo|ngramA|ngramB|ngramC` donde los ngramas son 2-3 palabras tras eliminar tokens volátiles (fechas, importes, IBANs, números largos). Es razonable pero **no robusto** a variaciones banales: `MERCADONA SAU` y `MERCADONA SAU C/ ALCALA` producen sets de ngramas distintos (al añadirse `c alcala` cambian los 2-gramas top-3 ordenados por frecuencia), por lo que un mismo proveedor con concepto ligeramente alargado en otro extracto no matchearía. Riesgo confirmado pero no es la causa raíz primaria — sin UI no hay reglas que matchear contra nada.
- **Feature flag desactivada:** no existe ningún flag tipo `LEARNING_ENABLED` en `src/config/flags.ts`. Confirmado: no hay flag bloqueando.

---

## Verificación 3 · FIFO 50 en `appendHistory()`

```ts
function appendHistory(rule: MovementLearningRule, entry: HistoryEntry): void {
  const prev = rule.history ?? [];
  const updated = [...prev, entry];
  rule.history = updated.length > 50 ? updated.slice(updated.length - 50) : updated;
}
```

**Estado:** **OK.** La rama `> 50` recorta correctamente conservando los últimos 50 elementos. `applyRuleToGrays` replica el mismo recorte inline (línea 326). No hay bug.

---

## Verificación 4 · Estado de la importación masiva de movimientos bancarios

### 4.1 Parser CSB43 / AEB43 · **NO EXISTE**

Búsqueda `grep -rni "csb43\|aeb43\|cuaderno 43\|norma 43"` en `src/`: 0 resultados. Solo se referencia en docs (`docs/STORES-V60-ACTIVOS.md:664`, `docs/AUDIT-39-stores-V60.md:546`). El campo `origin: 'CSB43'` está modelado en el tipo `Movement`, pero no existe parser que produzca movimientos con ese origen.

### 4.2 Parser OFX · **EXISTE PARCIAL (placeholder)**

- `src/services/universalBankImporter/fileFormatDetector.ts:17-21` detecta firmas OFX correctamente (`OFXHEADER:`, `<OFX>`, `OFXHEADER`, `DATA:OFXSGML`).
- `src/services/universalBankImporter/universalBankImporter.ts:413-422`: `parseOFXFile()` retorna `{ success: false, error: 'OFX parsing not yet implemented' }`. Es un TODO explícito (`// TODO: Implement OFX parsing`).
- `parseQIFFile()` mismo estado (placeholder).

### 4.3 Parser CSV / XLS / XLSX · **EXISTE**

Implementación robusta y duplicada en varios servicios:

- `src/features/inbox/importers/bankParser.ts` (901 líneas) — soporta XLS/XLSX/CSV con detección de cabeceras y aliases multi-banco.
- `src/services/bankStatementParser.ts` (707 líneas) — versión paralela.
- `src/services/universalBankImporter/universalBankImporter.ts` (918 líneas) — pipeline con detección de columnas, locale, signo, deduplicación.
- `public/assets/bank-profiles.json` cubre **10 bancos**: ABANCA, BBVA, Santander, Unicaja, Sabadell, Bankinter, ING, Openbank, CaixaBank, Revolut. Los 3 bancos reales de Jose (Santander, Sabadell, Unicaja) están cubiertos.

### 4.4 UI de upload de extracto · **EXISTE PERO HUÉRFANA**

Cinco componentes de upload coexisten, ninguno alcanzable desde rutas activas:

| Componente | Importado por | Rutado |
|---|---|---|
| `src/modules/horizon/tesoreria/components/ImportStatementModal.tsx` | `TreasuryMainView.tsx`, `AccountDetailPage.tsx` | NO (ambos padres huérfanos) |
| `src/modules/horizon/tesoreria/movimientos/ImportModal.tsx` | `Movimientos.tsx` | NO |
| `src/components/inbox/BankStatementModal.tsx` | — | NO |
| `src/components/inbox/BankStatementWizard.tsx` | — | NO |
| `src/components/treasury/CSVImportModal.tsx` | (a confirmar en T17) | NO en rutas auditadas |

### 4.5 Flujo a `movements` · **EXISTE PERO DESCONECTADO DE UI**

Trazado del happy-path `bankStatementImportService.importBankStatement`:

1. `parseFileToRows(file)` → `BankParserService.parseFile` (CSV/XLS/XLSX) → `ParsedRow[]` (líneas 128-168).
2. Asignación de `destinationAccountId` a todas las filas (línea 87).
3. `createMovements` (línea 199) — detecta duplicados por hash `{accountId|date|amount|description}`, valida cuenta, rechaza demos, construye objetos `Movement` con `statusConciliacion: 'sin_match'`.
4. **Aplica learning rules antes de insertar:** línea 301 `applyLearningRulesToNewMovements(movementsToCreate)`.
5. Bulk insert con `db.add('movements', movement)` en línea 311.

El flujo es funcional, pero solo se invoca desde `ImportModal.tsx` y `BankStatementModal.tsx` (ambos huérfanos). `documentRoutingService.ts:5` importa `importBankStatement` pero **nunca lo llama** (el `switch` de `routeInboxDocument` no tiene case para `extracto`/`bank_statement`).

### 4.6 Conexión con `movementLearningRules` durante importación · **EXISTE PARCIAL**

- `bankStatementImportService.importBankStatement` → SÍ aplica reglas de learning (`applyLearningRulesToNewMovements` en línea 301).
- `enhancedBankStatementImportService.importBankStatementEnhanced` (`src/services/enhancedBankStatementImportService.ts`) → **NO aplica reglas de learning**. Esta es la ruta usada por `Movimientos.tsx` y `ImportStatementModal.tsx` (huérfanos), por lo que actualmente no tiene impacto, pero genera fragmentación si se reactivara.

### 4.7 Pantalla de reconciliación masiva post-importación · **NO EXISTE**

`ConciliacionPageV2.tsx` (`src/modules/horizon/conciliacion/v2/`) reconcilia evento por evento (confirmar / eliminar / revertir). No hay UI tipo "lista bulk de movimientos `sin_match` con sugerencias de categoría/ámbito y acciones masivas". `MovementDrawer.tsx` resuelve por movimiento individual y, como se vio en V2, está huérfano.

---

## Decisión sobre `movementLearningRules`

**MANTENER (con corrección menor aplicada).**

Justificación:

- El schema, los índices y la función `appendHistory()` con FIFO 50 son correctos.
- Tras el fix de este PR, los 4 puntos de escritura sobre el store alimentan consistentemente `history[]`.
- La ausencia de registros en producción **no es un bug del store**: la causa es que la UI que dispara la creación (`MovementDrawer.tsx → performManualReconciliation`) no está enchufada en rutas activas.
- El motor de learning ya está integrado en el flujo de importación (`bankStatementImportService.importBankStatement` línea 301). Eliminar el store significaría tirar trabajo que TAREA 17 va a reaprovechar al rutar correctamente la UI.
- No se sube `DB_VERSION` ni se toca el schema.

---

## Recomendaciones para TAREA 17 (importación bancaria end-to-end)

### Piezas que existen y se reaprovechan tal cual

- **Parser CSV/XLS/XLSX** robusto en `src/features/inbox/importers/bankParser.ts` con perfiles multi-banco en `public/assets/bank-profiles.json` (10 bancos, incluidos Santander, Sabadell, Unicaja).
- **Detector de formato** `src/services/universalBankImporter/fileFormatDetector.ts` (CSV/XLS/XLSX/OFX/QIF).
- **Pipeline de importación** `src/services/bankStatementImportService.ts` ya con: deduplicación por hash, validación de cuenta, rechazo de demos, hookeo a learning (`applyLearningRulesToNewMovements`).
- **Servicio de learning** `src/services/movementLearningService.ts` (corregido en este PR): `performManualReconciliation`, `createLearningRule`, `applyAllRulesOnImport`, `applyRuleToGrays`, `getLearningLogs`.
- **Componente UI de upload** `ImportStatementModal.tsx` listo para enchufar; solo hay que rutarlo desde una página activa.
- **Drawer de reconciliación** `MovementDrawer.tsx` ya cableado a `performManualReconciliation`; falta integrarlo desde una página rutada.

### Piezas que faltan

- **Parser CSB43/AEB43**: no existe. Si los bancos del usuario exportan en CSB43 hay que implementarlo desde cero (o descartarlo si XLS/CSV es suficiente).
- **Parser OFX/QIF**: solo placeholder. Decidir si se prioriza o se descarta.
- **Pantalla de reconciliación masiva post-importación**: no existe. Lista de movimientos `sin_match` con sugerencias y acciones bulk (asignar categoría/ámbito, marcar como inmueble, crear regla con backfill). Esta es la pieza más cara de TAREA 17.
- **Routing de extractos en inbox**: `documentRoutingService.routeInboxDocument` no tiene case para extracto bancario; `importBankStatement` se importa pero no se llama. O bien se enruta desde el inbox o se elimina la importación muerta.
- **Unificación**: hay 3 servicios de importación paralelos (`bankStatementImportService`, `enhancedBankStatementImportService`, `enhancedStatementImportService`) y 5 modales de upload. T17 debería consolidar a uno.

### Bugs/riesgos detectados (no se arreglan en este PR salvo el menor)

1. **(corregido en este PR)** `createOrUpdateRule` no llamaba a `appendHistory` ni inicializaba `history[]`.
2. `enhancedBankStatementImportService.importBankStatementEnhanced` **no aplica reglas de learning**. Si T17 lo elige como ruta principal, hay que añadir la llamada a `applyLearningRulesToNewMovements`.
3. **Hash `learnKey` no robusto a variaciones banales** del concepto bancario (sufijos, direcciones añadidas, etc.). Si T17 mide tasa de match baja en `applyAllRulesOnImport`, considerar simplificar la clave a `signo + counterparty normalizado` con un threshold de similitud (Levenshtein/Jaccard) en vez de hash exacto de ngramas.
4. **5 modales de upload + 3 servicios de import + 0 rutas activas** = mucho código muerto. Inventariar y eliminar duplicados antes de seguir construyendo.
5. **`history[]` puede quedar huérfana sin uso** si TAREA 17 decide no implementar UI de auditoría. El consumidor actual `getLearningLogs()` solo se llama desde tests. Si tras T17 sigue sin consumirse, proponer eliminar el campo `history` en una tarea futura (NO en este PR).

---

## Cambios aplicados en este PR

- `src/services/movementLearningService.ts`:
  - `createOrUpdateRule` (rama existente, línea 207-217): añadida llamada a `appendHistory(rule, { action: 'CREATE_RULE', ts })` antes del `db.put`.
  - `createOrUpdateRule` (rama nueva, línea 219-238): añadido `history: [{ action: 'CREATE_RULE', ts }]` en la inicialización del `newRule`.
- `docs/AUDIT-T16-movementLearningRules-residual.md`: este documento.

NO se sube `DB_VERSION`. NO se toca schema. NO se modifica importación masiva.
