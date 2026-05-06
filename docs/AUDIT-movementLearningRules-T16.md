# AUDIT · movementLearningRules · T16

> **Tipo** · Auditoría de solo lectura · NO refactor en este PR
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **Branch** · `claude/audit-movement-learning-rules-0dohw`
> **DB** · DB_VERSION = 69 · 40 stores · sin cambios en este PR
> **Fecha** · 2026-05-06
> **Spec** · `docs/TAREA-T16-verificacion-movementLearningRules.md`

---

## Resumen ejecutivo

Las 3 preguntas abiertas de Jose se responden con evidencia directa de código:

1. **Schema** · 14 campos en `MovementLearningRule` (`src/services/db.ts:1239-1261`, incluyendo `history?`) + 3 campos en `HistoryEntry` (`src/services/db.ts:1268-1272`).
2. **Cuándo se escribe** · 6 puntos en `src/services/movementLearningService.ts` + 1 punto de migración en `src/services/db.ts`. De ellos, **solo 2 están en una ruta UI activa hoy** (creación/actualización vía `bankStatementOrchestrator.confirmDecisions` desde `/tesoreria/importar`); 3 puntos están enchufados a `performManualReconciliation` que **no tiene caller de producción**, y 1 punto cuelga del legacy `bankStatementImportService` cuyo único importador es un archivo `.backup`.
3. **`history[]`** · Veredicto · **PARCIALMENTE MUERTO**. **Se escribe** desde los 6 puntos de escritura (incluido el path activo). **No se lee** desde ningún consumidor de producción · `getLearningLogs` (`movementLearningService.ts:578`) y `getLearningRulesStats` (`movementLearningService.ts:535`) son los únicos lectores y **solo se llaman desde tests**.

El propósito declarado ("aprender clasificación de movimientos para auto-categorizar futuros") se cumple parcialmente · el ciclo *escribir regla → aplicar regla en futuras importaciones* funciona vía orchestrator + `movementSuggestionService`. El subsistema de auditoría (`history[]` + `getLearningLogs`) está implementado pero sin UI.

---

## 1 · Schema real (Pregunta 1)

### 1.1 · Interface `MovementLearningRule`

Definida en `src/services/db.ts:1239-1261`:

| # | Campo | Tipo | Opcional | Notas |
|---|---|---|---|---|
| 1 | `id` | `number` | sí (autoIncrement) | PK del store · IndexedDB lo genera |
| 2 | `learnKey` | `string` | no | Clave única del patrón · v1 hash de `signo+ngramas` |
| 3 | `counterpartyPattern` | `string` | no | Counterparty normalizado (lowercase, sin acentos) |
| 4 | `descriptionPattern` | `string` | no | Descripción normalizada · sin tokens volátiles |
| 5 | `amountSign` | `'positive' \| 'negative'` | no | Income vs expense |
| 6 | `categoria` | `string` | no | Categoría aprendida |
| 7 | `ambito` | `'PERSONAL' \| 'INMUEBLE'` | no | Ámbito de la categoría |
| 8 | `inmuebleId` | `string` | sí | Solo cuando `ambito === 'INMUEBLE'` |
| 9 | `source` | `'IMPLICIT'` | no | Reservado para futuro `'EXPLICIT'` (no se usa hoy) |
| 10 | `createdAt` | `string` (ISO) | no | |
| 11 | `updatedAt` | `string` (ISO) | no | |
| 12 | `appliedCount` | `number` | no | Veces que la regla se ha aplicado |
| 13 | `lastAppliedAt` | `string` (ISO) | sí | |
| 14 | `history` | `HistoryEntry[]` | sí | FIFO max 50 (V60 sub-tarea 1) |

### 1.2 · Interface `HistoryEntry`

Definida en `src/services/db.ts:1268-1272`:

| Campo | Tipo | Opcional |
|---|---|---|
| `action` | `'CREATE_RULE' \| 'APPLY_RULE' \| 'BACKFILL'` | no |
| `movimientoId` | `number` | sí |
| `ts` | `string` (ISO) | no |

### 1.3 · Object store / índices

`src/services/db.ts:2635-2642`:

```ts
const learningRulesStore = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
learningRulesStore.createIndex('learnKey', 'learnKey', { unique: true });
learningRulesStore.createIndex('categoria', 'categoria', { unique: false });
learningRulesStore.createIndex('ambito', 'ambito', { unique: false });
learningRulesStore.createIndex('createdAt', 'createdAt', { unique: false });
learningRulesStore.createIndex('appliedCount', 'appliedCount', { unique: false });
```

Nota · la auditoría TAREA 7-bis citada en el spec T16 §1 enumera solo 4 índices (`learnKey · categoria · ambito · createdAt`). El código real (`db.ts:2641`) registra **5 índices** · falta `appliedCount` en aquel listado.

### 1.4 · Campos sin uso real detectado

- **`source: 'IMPLICIT'`** · sin consumidor real. Nunca se compara ni se filtra. `grep -rn "'IMPLICIT'\\|'EXPLICIT'" src/` devuelve solo · (a) la definición del tipo (`db.ts:1248`), (b) las dos inicializaciones en `movementLearningService.ts:175,233`, y (c) usos en tests (`__tests__/dbV60Migration.test.ts:354`, `__tests__/dbV64Migration.test.ts:147,246`, `__tests__/movementSuggestionService.test.ts:114,262`, `__tests__/movementLearningService.test.ts:219,446`) que solo lo asignan o lo afirman como valor esperado · no lo comparan como discriminante de rama. (Aparte, `'EXPLICIT_SELECTION'` en `propertyAssignmentService.ts` es un enum no relacionado.) Reserva sin consumidor en producción.

---

## 2 · Escritores (Pregunta 2)

Búsqueda · `db.put('movementLearningRules', …)` y `db.add('movementLearningRules', …)` en `src/`.

| # | Archivo:línea | Función | Tipo | Cuándo se dispara | Estado |
|---|---|---|---|---|---|
| 1 | `src/services/movementLearningService.ts:161` | `createLearningRule` (rama existing) | `db.put` | Llamado por `performManualReconciliation:478` cuando un movimiento se reconcilia manualmente | ⚠️ DUDOSO · `performManualReconciliation` solo tiene callers de tests (ver §6) |
| 2 | `src/services/movementLearningService.ts:183` | `createLearningRule` (rama new) | `db.add` | Idem · primera vez que se ve el `learnKey` | ⚠️ DUDOSO · mismo motivo |
| 3 | `src/services/movementLearningService.ts:220` | `createOrUpdateRule` (rama existing) | `db.put` | Llamado por `bankStatementOrchestrator.feedLearningRule:551` desde `confirmDecisions:219,445` cuando el usuario confirma matches/sugerencias en `/tesoreria/importar` | ✅ ACTIVO · ruta UI rutada (`BankStatementUploadPage` en `src/App.tsx:760-764`) |
| 4 | `src/services/movementLearningService.ts:240` | `createOrUpdateRule` (rama new) | `db.add` | Idem · primera vez que se ve el `learnKey` | ✅ ACTIVO |
| 5 | `src/services/movementLearningService.ts:333` | `applyRuleToGrays` (actualización post-backfill) | `db.put` | Llamado por `performManualReconciliation:487` para incrementar `appliedCount` y empujar entries `BACKFILL` a `history[]` | ⚠️ DUDOSO · cuelga de `performManualReconciliation` |
| 6 | `src/services/movementLearningService.ts:403` | `applyAllRulesOnImport` (count++) | `db.put` | Llamado por `applyLearningRulesToNewMovements:520`, importado solo por `bankStatementImportService.ts:17,301`. Único importador de ese servicio en `src/`: `src/components/inbox/BankStatementModal.tsx.backup` | 🚫 MUERTO · servicio legacy desconectado de la UI activa (la UI activa va por orchestrator, no por este service) |
| 7 | `src/services/db.ts:3806` | Migración V64 (`learningLogs → history[]`) | `rulesDst.put` | Una sola vez por DB cuando `oldVersion < 64` | ✅ ACTIVO (one-shot) |

### 2.1 · Mapa de triggers · qué UI dispara qué writer

```
/tesoreria/importar  (BankStatementUploadPage)
  └─ orchestratorProcessFile        ← lee rules (no escribe)
  └─ orchestratorConfirmDecisions
       └─ feedLearningRule          ← escribe vía W3/W4 (createOrUpdateRule)

[no UI activa]  performManualReconciliation
  └─ createLearningRule              ← W1/W2
  └─ applyRuleToGrays                ← W5 (rule update)
       └─ db.put movements           (mutación de movimientos · ortogonal)

[ruta legacy]  bankStatementImportService.importBankStatement
  └─ applyLearningRulesToNewMovements
       └─ applyAllRulesOnImport      ← W6 (count++)
       (único caller: archivo .backup)
```

### 2.2 · Verificación de callers

```
$ grep -rn "performManualReconciliation\b" src/ | grep -v movementLearningService.ts
src/services/__tests__/movementLearningService.test.ts (×9)
src/services/__tests__/propertySaleService.test.ts (×2)
```

→ 0 callers de producción.

```
$ grep -rn "bankStatementImportService\|importBankStatement\b" src/ | grep -v __tests__
src/components/inbox/BankStatementModal.tsx.backup:6
src/components/inbox/BankStatementModal.tsx.backup:90
src/services/bankStatementImportService.ts:60   (definición)
src/services/bankStatementOrchestrator.ts:422   (solo comentario)
```

→ 0 importadores activos del legacy import service.

```
$ grep -rn "bankStatementOrchestrator\|orchestratorConfirmDecisions\|orchestratorProcessFile" src/App.tsx src/modules
src/App.tsx:113,762  (ruta /tesoreria/importar)
src/modules/horizon/tesoreria/import/BankStatementUploadPage.tsx:30,31,35
```

→ Confirmado · orchestrator es la ruta activa.

---

## 3 · Lectores

Búsqueda · `db.get('movementLearningRules', …)`, `db.getAll('movementLearningRules')`, `db.getAllFromIndex('movementLearningRules', …)`.

| # | Archivo:línea | Función | API | Para qué se usa | Estado |
|---|---|---|---|---|---|
| 1 | `src/services/movementLearningService.ts:148` | `createLearningRule` | `getAllFromIndex('learnKey', …)` | Localizar regla existente para upsert | ⚠️ vía test-only |
| 2 | `src/services/movementLearningService.ts:209` | `createOrUpdateRule` | `getAllFromIndex('learnKey', …)` | Localizar regla existente para upsert | ✅ activo (orchestrator) |
| 3 | `src/services/movementLearningService.ts:266` | `applyRuleToGrays` | `getAllFromIndex('learnKey', …)` | Recuperar la regla cuyo backfill se va a ejecutar | ⚠️ vía test-only |
| 4 | `src/services/movementLearningService.ts:354` | `applyAllRulesOnImport` | `getAll(…)` | Construir mapa `learnKey → rule` y auto-categorizar movimientos en bulk import | 🚫 vía service legacy (sin UI) |
| 5 | `src/services/movementLearningService.ts:542` | `getLearningRulesStats` | `getAll(…)` | Devolver `{totalRules, totalApplications, recentRules}` | 🚫 solo tests · no hay panel/UI |
| 6 | `src/services/movementLearningService.ts:581` | `getLearningLogs` | `getAll(…)` | Aplanar `rule.history[]` en log unificado | 🚫 solo tests · no hay panel/UI |
| 7 | `src/services/movementSuggestionService.ts:217,223` | `loadLearningRulesIndex` | `getAllFromIndex` con fallback `getAll` | Construir mapa `learnKey → rule` para sugerir categoría a movimientos `sin_match` durante importación | ✅ ACTIVO · invocado desde `suggestForUnmatched` que ejecuta `bankStatementOrchestrator.processFile` |
| 8 | `src/services/db.ts:3794` | Migración V64 | `rulesDst.get(ruleId)` | Adjuntar logs heredados a `history[]` por regla | ✅ activo (one-shot) |

### 3.1 · Lectores con consumidor UI real

Solo R2 (`createOrUpdateRule` upsert) y R7 (`movementSuggestionService.loadLearningRulesIndex`) tienen camino UI rutado. R7 es el cierre del loop · transforma reglas guardadas en sugerencias de categoría que el usuario ve y aprueba en `BankStatementUploadPage` durante una importación.

---

## 4 · Veredicto sobre `history[]` (Pregunta 3)

### 4.1 · Existe en schema

✅ **Sí.** `src/services/db.ts:1260` (`history?: HistoryEntry[]`).

### 4.2 · Es escrito

✅ **Sí · todos los writers actuales lo alimentan.**

| Writer | Cómo escribe a `history[]` | Ref |
|---|---|---|
| W1 `createLearningRule` (existing) | `appendHistory(rule, {action:'CREATE_RULE', movimientoId, ts})` | `movementLearningService.ts:159` |
| W2 `createLearningRule` (new) | Inicialización inline `history: [{action:'CREATE_RULE', …}]` | `movementLearningService.ts:180` |
| W3 `createOrUpdateRule` (existing) | `appendHistory(rule, {action:'CREATE_RULE', ts})` | `movementLearningService.ts:218` |
| W4 `createOrUpdateRule` (new) | Inicialización inline `history: [{action:'CREATE_RULE', ts}]` | `movementLearningService.ts:237` |
| W5 `applyRuleToGrays` | Bucle inline · `merged = [...prev, ...backfillEntries]` con FIFO 50 (`backfillEntries` acumula `{action:'BACKFILL', movimientoId, ts}` por movimiento backfilleado) | `movementLearningService.ts:298,317,330-332` |
| W6 `applyAllRulesOnImport` | `appendHistory(rule, {action:'APPLY_RULE', ts})` por regla aplicada | `movementLearningService.ts:402` |

Helper único `appendHistory` (`movementLearningService.ts:5-9`) implementa el cap FIFO 50.

> Observación · W3/W4/W5 omiten `movimientoId` en su entrada de history (solo `action` y `ts`). W1/W2/W6 sí lo incluyen cuando lo tienen. La definición de `HistoryEntry` declara `movimientoId?` opcional, por lo que es válido pero pierde trazabilidad cuando viene del orchestrator (W3/W4 — la ruta activa).

### 4.3 · Es leído

⚠️ **Sí, pero solo por código que solo se ejecuta en tests.**

| Lector | Caller | Estado |
|---|---|---|
| `getLearningLogs` (`movementLearningService.ts:585` itera `rule.history`) | `movementLearningService.test.ts:234,371,401,411` | 🚫 sin UI |
| `appendHistory` y bucle inline en `applyRuleToGrays` (lectura para append) | mismos writers | n/a · lectura interna |
| Migración V64 (`rule.history` para concatenar) | `db.ts:3796` | ✅ one-shot |

`grep -rn "\.history\b" src/components src/modules` · sin resultados relacionados con `MovementLearningRule`. No existe panel/timeline/auditoría que muestre `history[]` al usuario.

### 4.4 · Veredicto

**`history[]` ESCRITO · NO LEÍDO en producción.**

Categorización · **CÓDIGO PARCIALMENTE MUERTO** ·
- el productor (writers) está vivo en la ruta activa (W3/W4 vía orchestrator);
- el consumidor (`getLearningLogs`, `getLearningRulesStats`) existe en código pero **0 callers de producción · solo tests** (verificado con `grep -rn "getLearningLogs\|getLearningRulesStats" src/ | grep -v movementLearningService.ts`, devuelve solo `__tests__`).

No es código *muerto absoluto* (los writers funcionan, los tests verifican el ciclo). Es código *huérfano de UI* · el log se mantiene pero nadie lo consulta.

---

## 5 · Coherencia con propósito declarado

**Propósito declarado** (per spec T16 §1) · "aprender clasificación de movimientos para auto-categorizar futuros".

### 5.1 · Ciclo *aprender → aplicar* en producción (orchestrator)

```
[1] Usuario sube extracto en /tesoreria/importar (BankStatementUploadPage)
[2] orchestrator.processFile parsea movimientos · NO toca rules
    └─ suggestForUnmatched llama loadLearningRulesIndex (R7)
       → propone categoría/ámbito a partir de reglas existentes
[3] Usuario aprueba/desaprueba sugerencias
[4] orchestrator.confirmDecisions
    └─ feedLearningRule por cada confirmación
       → createOrUpdateRule (W3/W4) refuerza/crea la regla
```

**El loop cierra.** Una primera importación crea reglas vacías de count; la siguiente importación las consume vía R7 y las aplica.

### 5.2 · Desviaciones / piezas sueltas

| Desviación | Detalle |
|---|---|
| `performManualReconciliation` está implementado pero sin UI | Diseñado en TAREA 7 para reconciliación manual movimiento-a-movimiento con backfill por periodo y cuenta. Hoy solo lo invocan tests. La UI equivalente que existe (`ConciliacionPageV2`) no lo llama. |
| `appliedCount` en orchestrator no se incrementa con la aplicación efectiva | `feedLearningRule` (orchestrator) usa `createOrUpdateRule`, que **no incrementa `appliedCount` ni en upsert ni en creación** (`createOrUpdateRule:236` inicializa a 0; el branch existing no toca `appliedCount`). Solo `createLearningRule` (`movementLearningService.ts:156`) incrementa. Resultado · en la ruta UI activa, `appliedCount` queda en 0 indefinidamente, lo que afecta al cálculo de confianza en `movementSuggestionService.ts:247-254` (siempre cae en la rama `applied === 0 → confidence = 50`). |
| `applyAllRulesOnImport` (W6 · `appliedCount += 1`) no se ejecuta porque el legacy service no se llama | Si se reactivara `bankStatementImportService`, se duplicaría la lógica con orchestrator. |
| `descriptionPattern` y `counterpartyPattern` quedan en `''` cuando `createOrUpdateRule` crea regla nueva | `createOrUpdateRule:227-229` deja strings vacíos con un comentario `// Will be filled when movement is processed`. No hay flujo posterior que los rellene. La regla queda con patrones vacíos y solo `learnKey` para matchear. |

### 5.3 · Veredicto coherencia

**Cumple el propósito en su forma mínima** (loop create-rule → apply-on-next-import vía orchestrator + suggestionService). Tiene 3 piezas sueltas que reducen su efectividad · `appliedCount` que no avanza, patrones que quedan vacíos y un servicio legacy paralelo (`bankStatementImportService`) que duplica la idea sin ejecutarse.

---

## 6 · Bugs · gaps · code smells detectados

| # | Severidad | Descripción | Archivo:línea | Acción sugerida |
|---|---|---|---|---|
| B1 | 🟠 Media | `createOrUpdateRule` no incrementa `appliedCount` (ni upsert ni creación). En la ruta UI activa (orchestrator → feedLearningRule), todas las reglas quedan con `appliedCount = 0` indefinidamente. Rompe la lógica de boost de confianza en `movementSuggestionService.ts:247-254`. | `src/services/movementLearningService.ts:211-245` | Incrementar `rule.appliedCount += 1` en branch existing y arrancar en `1` en branch new. O bien diferenciar "regla creada" (count=0) de "regla aplicada" (count++) llamando a `applyAllRulesOnImport` después del orchestrator. |
| B2 | 🟠 Media | `createOrUpdateRule` rama new inicializa `counterpartyPattern: ''` y `descriptionPattern: ''` con comentario "Will be filled when movement is processed", pero **ningún flujo posterior los rellena**. Reglas creadas por orchestrator quedan con patrones vacíos. | `src/services/movementLearningService.ts:227-229` | Cambiar firma de `createOrUpdateRule` para aceptar el `Movement` (o los patrones ya normalizados) y rellenarlos en la creación. Alternativa · llamar a `createLearningRule(movement, …)` desde `feedLearningRule` en vez de `createOrUpdateRule({learnKey, …})`. |
| B3 | 🟡 Baja | `history[]` es escrito por todos los writers pero **0 lectores de producción**. `getLearningLogs` y `getLearningRulesStats` solo se usan en tests. | `src/services/movementLearningService.ts:578-606`, `:535-562` | Decidir · (a) construir UI de auditoría que consuma `getLearningLogs`, o (b) eliminar campo `history`, helper `appendHistory`, ambos getters y la migración V64. NO eliminar sin decisión explícita de Jose. |
| B4 | 🟡 Baja | `performManualReconciliation` tiene 0 callers de producción. Implementa una UX coherente (reconciliación 1-a-1 + backfill periodo/cuenta) pero la UI que la dispararía nunca se rutó. | `src/services/movementLearningService.ts:427-514` | Decidir si la T17 actual ya cubre este caso (reconciliación masiva post-importación) o si hace falta el flujo 1-a-1. Si se descarta, eliminar `performManualReconciliation`, `createLearningRule`, `applyRuleToGrays` (W1/W2/W5). |
| B5 | 🟡 Baja | `bankStatementImportService` (servicio legacy, 1 archivo entero) es importado solo desde un `.tsx.backup`. Toda su lógica (`applyLearningRulesToNewMovements`) es código muerto duplicado del orchestrator. | `src/services/bankStatementImportService.ts:60`, `src/components/inbox/BankStatementModal.tsx.backup:6` | Inventariar y borrar el legacy junto con el `.backup`. |
| B6 | 🟢 Trivial | Listado de índices desactualizado en la auditoría TAREA 7-bis · cita 4 (`learnKey · categoria · ambito · createdAt`) cuando el código real registra 5 (falta `appliedCount`). | `src/services/db.ts:2637-2641` (código real · 5 índices) | Documentar los 5 índices completos en cualquier doc futura del schema. |
| B7 | 🟢 Trivial | `source: 'IMPLICIT'` no se usa en ninguna comparación · solo en inicialización. Reservado para futuro `'EXPLICIT'` que nunca llegó. | `src/services/movementLearningService.ts:175,233`, `src/services/db.ts:1248` | Si tras T17/T18 sigue sin uso, eliminar el campo. |
| B8 | 🟢 Trivial | W3/W4 (orchestrator path) escriben entradas `CREATE_RULE` en `history[]` sin `movimientoId`, mientras W1/W2 (manual reconciliation) sí lo incluyen. Pérdida de trazabilidad en la ruta activa. | `src/services/movementLearningService.ts:218,237` | Aceptar `movimientoId` opcional en la firma de `createOrUpdateRule` y propagarlo desde `feedLearningRule`. |
| B9 | 🟢 Trivial | W5 (`applyRuleToGrays:330-332`) duplica inline el FIFO 50 en vez de usar `appendHistory` en bucle (decisión consciente para no recortar 50 veces, pero rompe DRY). | `src/services/movementLearningService.ts:330-332` | Refactor menor · helper `appendHistoryBatch(rule, entries[])`. Cosmético. |

### 6.1 · NO bugs (verificado y descartado)

- FIFO 50 está correcto · `appendHistory` (`movementLearningService.ts:5-9`) y el inline de `applyRuleToGrays` (`:330-332`) recortan conservando los últimos 50.
- Migración V64 idempotente · solo procesa si los dos stores coexisten, y elimina `learningLogs` después.
- DB_VERSION sin tocar · 69 confirmado en `src/services/db.ts:28`.
- Índice `learnKey` único · sí, `db.ts:2637` (`{ unique: true }`). El upsert `getAllFromIndex` + put/add respeta la unicidad.

---

## 7 · Recomendaciones para Jose · priorizadas

| Prioridad | Acción | Esfuerzo CC estimado | Justificación |
|---|---|---|---|
| **P1** | **T16-fix-appliedCount** · arreglar B1 (incrementar `appliedCount` en `createOrUpdateRule` o llamar a una nueva función `recordRuleApplication` cuando una regla efectivamente categoriza un movimiento). Bug funcional · afecta confianza de sugerencias. | 1-2h | Mejora la calidad de las sugerencias inmediatamente · sin tocar schema. |
| **P1** | **T16-fix-patterns** · arreglar B2 (rellenar `counterpartyPattern`/`descriptionPattern` cuando `createOrUpdateRule` crea regla nueva). Hoy las reglas nacen mudas. | 1h | El `learnKey` solo basta como discriminante hash; los patrones servirían para futuras heurísticas / migraciones / debug. |
| **P2** | **T16-decision-history** · decidir destino de `history[]` (B3) · activar (UI) o eliminar (campo + getters + migración V64). | activar · 3-4h CC · eliminar · 1h CC + 1 incremento DB_VERSION | Hoy es overhead sin valor. Mantenerlo solo tiene sentido si se planea panel de auditoría. |
| **P2** | **T16-decision-manual-reconciliation** · decidir si `performManualReconciliation` se rutea (UI 1-a-1) o se elimina junto a `createLearningRule` y `applyRuleToGrays` (B4). | rutar · 4-6h CC · eliminar · 2h CC | Es un sub-sistema completo sin caller. Decidir antes de seguir construyendo. |
| **P3** | **T16-cleanup-legacy** · eliminar `bankStatementImportService.ts` y el `.tsx.backup` que lo importa (B5). | 1-2h CC | Reduce ruido y elimina la duplicación del path de import. |
| **P4** | **T16-polish** · B6/B7/B8/B9 · cosmético, hacer en una sola pasada cuando se entre por otro motivo. | 30-60min CC | No urgente. |

### 7.1 · Si Jose quiere mínima intervención

P1 (B1+B2) es el único bloque con impacto real en la UX hoy · ~2-3h CC. El resto son decisiones de arquitectura que el T16-fix puede esperar.

### 7.2 · Si Jose quiere saneamiento completo

P1 + P2 + P3 + P4 · ~10-15h CC distribuidas. Cierra el subsistema "learning" como código limpio · sin huérfanos · sin duplicados.

### 7.3 · Si Jose quiere statu quo

Auditoría queda archivada · ningún cambio · el ciclo learn→apply funciona en su forma mínima por orchestrator.

---

## 8 · Verificación de la auditoría

- [x] DB_VERSION = 69 sin cambios (`src/services/db.ts:28`).
- [x] Documento `docs/AUDIT-movementLearningRules-T16.md` publicado (este archivo).
- [x] Las 3 preguntas de Jose respondidas explícitamente con evidencia archivo:línea (§1, §2, §4).
- [x] Veredicto `history[]` explícito · CÓDIGO PARCIALMENTE MUERTO · escrito sí · leído solo en tests (§4.4).
- [x] Recomendaciones priorizadas con esfuerzo CC estimado (§7).
- [x] Sin modificación de código fuera de este documento.

---

## 9 · Caminos posibles tras la auditoría

| Resultado leído | Acción siguiente sugerida |
|---|---|
| **Auditoría positiva** · loop learn→apply funciona · piezas sueltas tolerables | Cerrar T16 · NO acción técnica |
| **Bugs funcionales (B1+B2) confirmados** | T16-fix-functional · 2-3h CC · NO toca DB_VERSION |
| **`history[]` se decide eliminar** | T16-cleanup-history · 1h CC + DB_VERSION 70 (eliminar campo en TS · keepalive de datos hasta DB next-vac) |
| **`performManualReconciliation` se decide rutar** | T16-activate-manual-reconciliation · 4-6h CC · UI nueva en `/tesoreria` o `/conciliacion` |

---

**Fin del audit T16.** · NO mergear sin autorización Jose.
