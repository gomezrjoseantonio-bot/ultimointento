# TAREA CC · T16-fix-functional · Bugs funcionales appliedCount + patrones vacíos · v1

> **Tipo** · 1 sub-tarea única · 1 PR contra `main` · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **DB** · NO se toca · DB_VERSION sigue **69**
> **Esfuerzo** · 2-3h CC real · 1h tu revisión
> **Prioridad** · MEDIA · feature comercial real (auto-categorización ATLAS)
> **Predecesor** · T16 (auditoría) mergeada · `docs/AUDIT-movementLearningRules-T16.md` publicado

---

## 0 · Reglas inviolables

### 0.1 · DB_VERSION sin cambios
Sigue 69 · 40 stores · NO migración. Esta tarea solo arregla **lógica de servicios** · NO toca schema.

### 0.2 · NO inventar comportamiento
Los 2 bugs están **diagnosticados con archivo:línea** en el doc auditoría T16 § 6 (B1 y B2). CC se ciñe al fix · NO altera flujos relacionados.

### 0.3 · Auditoría preflight obligatoria
Antes de codear · CC verifica:
- DB_VERSION = 69 · 40 stores
- `docs/AUDIT-movementLearningRules-T16.md` existe (predecesor)
- T34/T35-fix-2 mergeada (predecesor anterior)
- Localizar funciones `createOrUpdateRule` y `feedLearningRule` con líneas exactas

### 0.4 · Cero regresión en orchestrator
La ruta UI activa (`bankStatementOrchestrator.confirmDecisions` desde `/tesoreria/importar`) DEBE seguir funcionando idéntico. Tests existentes deben pasar.

### 0.5 · Stop-and-wait
1 PR único contra `main` · NO mergear sin autorización Jose.

---

## 1 · Contexto · qué arregla

### 1.1 · Bug B1 · `appliedCount` no se incrementa (severidad 🟠 media)

**Diagnosis del audit T16 § 6** · `createOrUpdateRule` (`movementLearningService.ts:211-245`) **NO incrementa `appliedCount`** ni en branch new ni en branch existing. La ruta UI activa (orchestrator → `feedLearningRule` → `createOrUpdateRule`) deja todas las reglas con `appliedCount = 0` indefinidamente.

**Impacto real** · `movementSuggestionService.ts:247-254` calcula confianza así:
```
applied === 0 → confidence = 50
applied >= 3 → confidence = 70 (boost)
```
Como `appliedCount` nunca crece · ATLAS **NUNCA aprende a confiar más en reglas** que el usuario ha confirmado muchas veces. El boost de confianza está roto.

### 1.2 · Bug B2 · Reglas nuevas nacen "mudas" (severidad 🟠 media)

**Diagnosis del audit T16 § 6** · `createOrUpdateRule` rama new (`movementLearningService.ts:227-229`) inicializa:
```typescript
counterpartyPattern: '',
descriptionPattern: '',
// Will be filled when movement is processed
```

Pero **ningún flujo posterior los rellena**. Las reglas creadas por orchestrator quedan permanentemente con patrones vacíos. Solo el `learnKey` (hash) las identifica.

**Impacto real** · pérdida de capacidad de matching por patrón textual · degradación silenciosa para futuras heurísticas o debug.

---

## 2 · Alcance del fix

### 2.1 · Fix B1 · incrementar `appliedCount` correctamente

Discriminar 2 casos:
- **Crear regla nueva** · `appliedCount = 1` (la primera aplicación es la que la creó)
- **Aplicar regla existente** · `appliedCount += 1`

Modificar `createOrUpdateRule` (`movementLearningService.ts:211-245`):

```typescript
// Pseudocódigo
async createOrUpdateRule(input: CreateOrUpdateRuleInput): Promise<MovementLearningRule> {
  const existing = await getRuleByLearnKey(input.learnKey);
  
  if (existing) {
    // RAMA EXISTING · incrementar
    return await db.put('movementLearningRules', {
      ...existing,
      categoria: input.categoria,
      ambito: input.ambito,
      inmuebleId: input.inmuebleId,
      appliedCount: existing.appliedCount + 1,        // ★ FIX B1
      lastAppliedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: appendHistory(existing.history, {
        action: 'APPLY_RULE',
        movimientoId: input.movimientoId,             // ★ FIX B8 (trivial · si CC quiere)
        ts: new Date().toISOString(),
      }),
    });
  }
  
  // RAMA NEW · crear con count = 1 (la creación cuenta como aplicación)
  return await db.add('movementLearningRules', {
    learnKey: input.learnKey,
    counterpartyPattern: input.counterpartyPattern,   // ★ FIX B2 · ya no vacío
    descriptionPattern: input.descriptionPattern,     // ★ FIX B2 · ya no vacío
    amountSign: input.amountSign,
    categoria: input.categoria,
    ambito: input.ambito,
    inmuebleId: input.inmuebleId,
    source: 'IMPLICIT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    appliedCount: 1,                                  // ★ FIX B1 · arranca en 1
    lastAppliedAt: new Date().toISOString(),
    history: [{
      action: 'CREATE_RULE',
      movimientoId: input.movimientoId,               // ★ FIX B8 trivial
      ts: new Date().toISOString(),
    }],
  });
}
```

### 2.2 · Fix B2 · cambiar firma para aceptar patrones rellenos

Modificar `feedLearningRule` (`bankStatementOrchestrator.ts:551`) para que pase los patrones normalizados al crear la regla:

```typescript
// Pseudocódigo en feedLearningRule
async function feedLearningRule(movement: Movement, decision: ConfirmedDecision) {
  const counterpartyPattern = normalizeCounterparty(movement.counterparty);
  const descriptionPattern = normalizeDescription(movement.description);
  const learnKey = computeLearnKey(movement);
  
  await createOrUpdateRule({
    learnKey,
    counterpartyPattern,        // ★ FIX B2
    descriptionPattern,         // ★ FIX B2
    amountSign: movement.amount > 0 ? 'positive' : 'negative',
    categoria: decision.categoria,
    ambito: decision.ambito,
    inmuebleId: decision.inmuebleId,
    movimientoId: movement.id,  // ★ FIX B8 trivial
  });
}
```

Reutilizar las funciones `normalizeCounterparty` y `normalizeDescription` que ya existen en `movementLearningService.ts` (las usa `createLearningRule` rama existing/new). Si no son exportadas · exportarlas o duplicar lógica mínima en orchestrator.

### 2.3 · Tests obligatorios

| # | Test | Verifica |
|---|---|---|
| 1 | Crear regla nueva via orchestrator · `appliedCount === 1` | Fix B1 rama new |
| 2 | Aplicar regla existente via orchestrator (mismo learnKey) · `appliedCount === 2` | Fix B1 rama existing |
| 3 | Aplicar regla existente otra vez · `appliedCount === 3` (suma incremental) | Fix B1 incremental |
| 4 | Crear regla nueva via orchestrator · `counterpartyPattern !== ''` y `descriptionPattern !== ''` | Fix B2 rama new |
| 5 | `movementSuggestionService.ts:247-254` · regla con `appliedCount >= 3` da confidence 70 (boost) | Integración fix B1 con suggestionService |
| 6 | Cero regresión · tests existentes de `bankStatementOrchestrator.confirmDecisions` siguen pasando | Cero regresión orchestrator |
| 7 | Cero regresión · tests existentes de `movementLearningService.createLearningRule` (la rama de manual reconciliation que ya incrementa correctamente) siguen pasando | Cero regresión manual |

### 2.4 · NO entra en este PR

- B3 · history[] eliminación → T16-cleanup (PR 2)
- B4 · performManualReconciliation eliminación → T16-cleanup (PR 2)
- B5 · bankStatementImportService legacy → T16-cleanup (PR 2)
- B6-B9 · cosméticos → T16-cleanup (PR 2 lo agrupa)

---

## 3 · Verificación post-deploy preview (Jose validará)

1. DB_VERSION = 69 · 40 stores sin cambios
2. 7 tests pasan
3. tsc --noEmit pasa · App arranca sin errores
4. Reconciliar movimiento via `/tesoreria/importar` con regla nueva · DevTools `movementLearningRules` muestra `appliedCount === 1` · `counterpartyPattern` y `descriptionPattern` rellenos
5. Reconciliar segundo movimiento que match misma regla · `appliedCount === 2`
6. Tras 3-4 confirmaciones de la misma regla · sugerencia futura de ATLAS muestra confianza ≥70 (boost activo)
7. Cero regresión en otros módulos · Tesorería · Personal · Inmuebles · Fiscal funcionan idéntico

---

## 4 · Cómo lanzar a CC

```
@CC ejecuta T16-fix-functional · Bugs B1+B2 movementLearningRules
Spec · docs/TAREA-T16-fix-functional.md
Predecesor · T16 auditoría mergeada · docs/AUDIT-movementLearningRules-T16.md publicado

PUNTO DE PARTIDA · auditoría preflight
- DB_VERSION = 69 · 40 stores
- Localizar funciones · createOrUpdateRule (movementLearningService.ts:211-245) · feedLearningRule (bankStatementOrchestrator.ts:551)
- Confirmar que B1+B2 siguen como dice el audit (no se solucionaron entre tanto)

ALCANCE
1. FIX B1 · createOrUpdateRule incrementa appliedCount correctamente (rama new = 1 · rama existing += 1)
2. FIX B2 · feedLearningRule pasa counterpartyPattern y descriptionPattern normalizados a createOrUpdateRule
3. FIX B8 trivial (opcional · si encaja sin scope creep) · pasar movimientoId al history
4. Tests §2.3 · 7 casos obligatorios

REGLAS INVIOLABLES
- DB_VERSION sin cambios · sigue 69
- NO eliminar history[] (B3) · NO eliminar performManualReconciliation (B4) · NO eliminar legacy (B5) · esos van en T16-cleanup PR 2
- NO refactor amplio · solo el fix de B1 y B2 (+ B8 si encaja trivial)
- 1 PR único contra main · stop-and-wait
- NO mergear sin autorización Jose

VERIFICACIÓN
- 7 tests pasan
- Boost de confianza funciona · regla con appliedCount >= 3 da confidence 70 en suggestionService
- Reglas nuevas tienen counterpartyPattern y descriptionPattern no vacíos
- Cero regresión orchestrator · cero regresión manual reconciliation

ENTREGA
- 1 PR único contra main
- Título · fix(learning): T16-fix-functional · appliedCount + patrones vacíos
- Descripción · referencia audit T16 §6 B1+B2 + tests pasados
- NO mergear · stop-and-wait

TIEMPO ESTIMADO CC real · 2-3h
```

---

**Fin spec T16-fix-functional · 2 bugs funcionales · 1 PR · stop-and-wait.**
