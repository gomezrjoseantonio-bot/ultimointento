# TAREA CC · T16-cleanup · Eliminar piezas muertas y duplicados · v1

> **Tipo** · 1 sub-tarea única · 1 PR contra `main` · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **DB** · NO se toca · DB_VERSION sigue **69**
> **Esfuerzo** · 4-5h CC real · 1.5h tu revisión
> **Prioridad** · MEDIA · saneamiento · libera carga técnica
> **Predecesor** · T16-fix-functional mergeada (B1+B2 arreglados)

---

## 0 · Reglas inviolables

### 0.1 · DB_VERSION sin cambios
Sigue 69 · 40 stores · NO migración · NO bump.

**Decisión Jose** · el campo `history?: HistoryEntry[]` queda **dormido** en los registros existentes (no se lee · no se escribe nuevo). En el próximo bump natural de DB (T19 · T36 · etc.) se aprovechará para borrar el campo huérfano de los registros existentes.

### 0.2 · Eliminaciones permitidas en este PR
- **B3** · helper `appendHistory` · getters `getLearningLogs` y `getLearningRulesStats` · escritura del campo `history` desde TODOS los writers · interface `HistoryEntry` · TODO sin tocar el SCHEMA del store
- **B4** · función `performManualReconciliation` · función `createLearningRule` · función `applyRuleToGrays` (todo el subsistema de manual reconciliation que NO tiene UI)
- **B5** · archivo entero `src/services/bankStatementImportService.ts` · archivo `.tsx.backup` que lo importa
- **B6/B7/B8/B9** · polish trivial agrupado

### 0.3 · NO se elimina del schema
La definición TypeScript `MovementLearningRule.history?: HistoryEntry[]` se MANTIENE (pero comentada como deprecated). El campo en runtime queda dormido en los 14 registros tuyos · NO afecta funcionalidad. La eliminación schema vendrá en bump DB futuro.

### 0.4 · Cero regresión en orchestrator
La ruta UI activa (`bankStatementOrchestrator.confirmDecisions`) DEBE seguir funcionando idéntico tras la limpieza. Tests existentes deben pasar.

### 0.5 · Auditoría preflight obligatoria
Antes de codear · CC verifica:
- DB_VERSION = 69 · 40 stores
- T16 auditoría mergeada · `docs/AUDIT-movementLearningRules-T16.md` publicado
- T16-fix-functional mergeada · `appliedCount` incrementa · patrones rellenos
- Confirmar que `performManualReconciliation` SIGUE sin callers UI (solo tests) · `bankStatementImportService` sigue solo importado desde `.backup` · `getLearningLogs` y `getLearningRulesStats` siguen solo en tests

Si CC encuentra que algo cambió entre la auditoría y este PR · STOP-REPORT.

### 0.6 · Stop-and-wait
1 PR único contra `main` · NO mergear sin autorización Jose.

---

## 1 · Contexto · qué elimina

### 1.1 · B3 · `history[]` parcialmente muerto

**Diagnosis audit T16 §4** · escrito por TODOS los writers · pero **0 lectores en producción** · solo tests llaman a `getLearningLogs` y `getLearningRulesStats`.

**Decisión Jose** · eliminar lógica · mantener tipo dormido en schema hasta próximo bump DB.

### 1.2 · B4 · `performManualReconciliation` sin UI

**Diagnosis audit T16 §6** · subsistema completo · 0 callers UI · solo tests. La UX equivalente la cubre `ConciliacionPageV2` por otro camino.

**Decisión Jose** · eliminar `performManualReconciliation` + `createLearningRule` + `applyRuleToGrays` (W1/W2/W5 del audit). T17 ya cubre reconciliación masiva.

### 1.3 · B5 · `bankStatementImportService` legacy

**Diagnosis audit T16 §6** · servicio entero · solo importado desde `src/components/inbox/BankStatementModal.tsx.backup`. Código muerto duplicado del orchestrator.

**Decisión Jose** · eliminar archivo + eliminar `.backup`.

### 1.4 · B6-B9 polish

| # | Detalle |
|---|---|
| B6 | Documentar 5 índices completos del store (cualquier doc futura) |
| B7 | Eliminar `source: 'IMPLICIT'` si tras este PR sigue sin uso · OPCIONAL si sale natural |
| B8 | Ya cubierto en T16-fix-functional (movimientoId opcional en createOrUpdateRule) |
| B9 | Refactor cosmético `appendHistoryBatch` · NO aplica si eliminamos history[] · NULL |

---

## 2 · Alcance del cleanup

### 2.1 · Eliminaciones código

**Archivos a eliminar enteros:**
- `src/services/bankStatementImportService.ts`
- `src/components/inbox/BankStatementModal.tsx.backup`
- Tests directos a esos archivos · NO eliminar tests del orchestrator (que sí siguen activos)

**Funciones a eliminar de `movementLearningService.ts`:**
- `performManualReconciliation` (líneas 427-514 según audit)
- `createLearningRule` (rama new + existing · líneas 142-200 aprox)
- `applyRuleToGrays` (líneas 290-335 aprox)
- `appendHistory` helper (líneas 5-9)
- `getLearningLogs` (líneas 578-606)
- `getLearningRulesStats` (líneas 535-562)

**Tests a eliminar:**
- `__tests__/movementLearningService.test.ts` · sub-tests de `performManualReconciliation` · `createLearningRule` · `applyRuleToGrays` · `getLearningLogs` · `getLearningRulesStats`
- Mantener tests de `createOrUpdateRule` y `feedLearningRule` (esos siguen activos en orchestrator path)

### 2.2 · Cambios en interfaces

**`src/services/db.ts`** · interface `MovementLearningRule`:

```typescript
interface MovementLearningRule {
  id?: number;
  learnKey: string;
  counterpartyPattern: string;
  descriptionPattern: string;
  amountSign: 'positive' | 'negative';
  categoria: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: string;
  source: 'IMPLICIT';
  createdAt: string;
  updatedAt: string;
  appliedCount: number;
  lastAppliedAt?: string;
  
  /**
   * @deprecated · campo huérfano · será eliminado en próximo bump DB.
   * No se escribe ni se lee desde T16-cleanup (2026-05).
   * Los registros existentes pueden tener valores · ignorar.
   */
  history?: HistoryEntry[];
}

/**
 * @deprecated · ver MovementLearningRule.history
 */
interface HistoryEntry {
  action: 'CREATE_RULE' | 'APPLY_RULE' | 'BACKFILL';
  movimientoId?: number;
  ts: string;
}
```

### 2.3 · Cambios en orchestrator (`bankStatementOrchestrator.ts`)

`createOrUpdateRule` (que sigue vivo y arreglado por T16-fix-functional) **NO debe seguir escribiendo `history[]`**. Eliminar las líneas que añaden entries a `history` en rama new y existing.

Esto significa:
- `createOrUpdateRule` rama new · eliminar `history: [{...}]` del objeto
- `createOrUpdateRule` rama existing · eliminar `history: appendHistory(...)` del objeto
- Mantener todo lo demás (incluido `appliedCount` que arregló T16-fix-functional)

### 2.4 · Tests obligatorios

| # | Test | Verifica |
|---|---|---|
| 1 | `createOrUpdateRule` rama new NO tiene campo `history` en el objeto persistido | Eliminación escritura history |
| 2 | `createOrUpdateRule` rama existing NO modifica el campo `history` (queda intacto si registro antiguo lo tenía) | Cero impacto en datos existentes |
| 3 | `getLearningLogs` ya no existe (import compilation error si alguien intenta usarla) | Eliminación getter |
| 4 | `performManualReconciliation` ya no existe | Eliminación función |
| 5 | `bankStatementImportService` ya no existe en `src/services/` | Eliminación archivo legacy |
| 6 | Cero regresión orchestrator · `bankStatementOrchestrator.confirmDecisions` sigue pasando todos sus tests | Cero regresión |
| 7 | Cero regresión `movementSuggestionService` · sigue funcionando con reglas creadas en orchestrator path | Cero regresión integración |
| 8 | `tsc --noEmit` pasa · cero referencias huérfanas a símbolos eliminados | Compilación limpia |

### 2.5 · NO entra en este PR

- Bump DB_VERSION → 70 · NO toca schema en runtime
- Eliminación `history?` del TypeScript completo · queda como `@deprecated` para próximo bump
- Eliminación `source: 'IMPLICIT'` del campo · OPCIONAL · si sale natural CC lo hace · si introduce scope creep · NO

---

## 3 · Verificación post-deploy preview (Jose validará)

1. DB_VERSION = 69 · 40 stores · sin cambios
2. 8 tests pasan
3. tsc --noEmit pasa · cero referencias huérfanas
4. App arranca sin errores
5. `/tesoreria/importar` reconciliación funciona idéntica a T16-fix-functional
6. DevTools · `movementLearningRules` registros existentes con `history[]` siguen ahí (intactos · no se borra)
7. DevTools · registros nuevos creados tras el merge · NO tienen campo `history` en el objeto persistido (solo aparece si registro antiguo)
8. Cero regresión otros módulos · Personal · Inmuebles · Fiscal · Tesorería siguen idénticos
9. Repo más limpio · `bankStatementImportService.ts` ya no existe · `.backup` ya no existe

---

## 4 · Cómo lanzar a CC

```
@CC ejecuta T16-cleanup · Eliminar piezas muertas y duplicados
Spec · docs/TAREA-T16-cleanup.md
Predecesor · T16-fix-functional mergeada (appliedCount + patrones rellenos)

PUNTO DE PARTIDA · auditoría preflight
- DB_VERSION = 69 · 40 stores
- T16 auditoría mergeada · T16-fix-functional mergeada
- Confirmar que performManualReconciliation sigue sin callers UI · bankStatementImportService sigue solo en .backup · getLearningLogs y getLearningRulesStats siguen solo en tests

ALCANCE · 4 áreas de eliminación
1. B3 · eliminar lógica history[] · helper appendHistory · getters getLearningLogs y getLearningRulesStats · escritura desde createOrUpdateRule (NO escribir más entries) · interface HistoryEntry queda como @deprecated en TS
2. B4 · eliminar performManualReconciliation + createLearningRule + applyRuleToGrays
3. B5 · eliminar archivo bankStatementImportService.ts + .backup
4. B6/B7/B8/B9 · polish trivial agrupado (B7 eliminar 'source: IMPLICIT' OPCIONAL si encaja · NO si scope creep)

REGLAS INVIOLABLES
- DB_VERSION sin cambios · sigue 69 · NO migración runtime
- Mantener interface MovementLearningRule.history?: HistoryEntry[] como @deprecated en TypeScript · campo dormido en runtime
- NO tocar createOrUpdateRule más allá de eliminar escritura history (los fix de T16-fix-functional ya aplicados se mantienen)
- 1 PR único contra main · stop-and-wait
- NO mergear sin autorización Jose

VERIFICACIÓN
- 8 tests pasan · tsc --noEmit pasa
- Reconciliar movimiento via /tesoreria/importar funciona idéntico
- Registros nuevos NO tienen history en el objeto persistido
- Registros existentes (14 de Jose) mantienen su history dormido (NO se borra en este PR)
- Repo limpio · bankStatementImportService.ts y .backup eliminados

ENTREGA
- 1 PR único contra main
- Título · refactor(learning): T16-cleanup · eliminar history[] · performManualReconciliation · legacy bankStatementImportService
- Descripción · 4 áreas de eliminación + tests pasados + nota sobre history dormido pendiente bump DB futuro
- NO mergear · stop-and-wait

TIEMPO ESTIMADO CC real · 4-5h
```

---

## 5 · Después de T16-cleanup · qué queda

| Estado tras este PR | Detalle |
|---|---|
| Subsistema learning | ✅ Solo orchestrator path · createOrUpdateRule + feedLearningRule · 2 funciones limpias con appliedCount + patrones · funcional |
| `history[]` runtime | 🟡 Dormido · 14 registros existentes lo tienen · nadie lee/escribe · pendiente eliminar en próximo bump DB |
| `performManualReconciliation` | ❌ Eliminada |
| `bankStatementImportService` | ❌ Eliminado |
| `.tsx.backup` | ❌ Eliminado |
| Reconciliación manual | Solo via T17 (reconciliación masiva) · 1 camino único · sin duplicados |
| TODO técnico futuro | Próximo bump DB (T19 · T36 · etc.) elimina campo `history` del schema y limpia los 14 registros · 30 min trabajo extra |

---

**Fin spec T16-cleanup · saneamiento profundo · 1 PR · stop-and-wait · subsistema learning queda como código limpio.**
