# PR-C-PROY-1-bis · Eliminar dead code `budgetService.ts`

> **Tipo** · Limpieza técnica · XS
> **Tiempo estimado** · 1-2h CC
> **Cierra** · deuda abierta del PR-C-PROY-1 · decisión Jose A/B/C resuelta como **A · eliminar**
> **Bloqueado por** · ninguno
> **Bloquea** · ninguno
> **DB upgrade** · NO · no hay store que borrar · `'budgets'` nunca existió en `initDB`

---

## 1 · Contexto

En PR-C-PROY-1 (Tanda 1 Proyección · limpieza módulo) se identificó `src/services/budgetService.ts` como dead code · el servicio escribe en un store llamado `'budgets'` que NO está registrado en `initDB`. Toda llamada `db.put('budgets', ...)` falla silenciosamente o lanza excepción que ningún consumer captura. El servicio aparenta funcionar · no graba nada · ningún flujo real de la app depende de él.

CC documentó 3 caminos posibles · A · eliminar · B · refactor a `presupuestoService` con store real · C · conservar.

**Jose decidió A · eliminar.**

Razón estratégica · el mockup `atlas-mi-plan-v2.html` (Fase 1 mockups · pendiente) define la tab "Mi presupuesto" con un modelo concreto (50/30/20 o base cero). Cuando ese mockup cierre · `presupuestoService` se construirá desde cero alineado con ese modelo. Refactorizar AHORA `budgetService.ts` (opción B) sería trabajo regalado porque la API actual probablemente no encaje con el modelo Mi Plan v2.

Conservar (opción C) deja una mentira técnica latente · cualquier desarrollador que lea el archivo asume que graba · no graba.

Eliminar (opción A) cierra el módulo Proyección 100% saneado tras Tanda 1.

---

## 2 · Decisión cerrada

| Pregunta | Respuesta |
|---|---|
| ¿Qué hacemos con `budgetService.ts`? | Eliminar archivo completo |
| ¿Y sus consumers? | Eliminar también si solo dependen de `budgetService` (pedir aprobación in-loop si la cadena se extiende más de 1 nivel) |
| ¿Y los algoritmos útiles dentro? | Documentar en `docs/audits/algoritmos-budgetservice-rescate.md` para reuso futuro cuando se construya `presupuestoService` desde Mi Plan v2 |
| ¿DB upgrade? | NO · `'budgets'` no existe en `initDB` · no hay store que borrar |
| ¿Tests nuevos? | NO · solo verificar que tests existentes no degradan |

---

## 3 · Pre-flight obligatorio · CC NO arranca sin esto

CC ejecuta los siguientes comandos · pega el output literal en el PR · y SOLO entonces arranca el plan de ejecución.

### 3.1 · Confirmar que el archivo existe

```bash
ls -la src/services/budgetService.ts
wc -l src/services/budgetService.ts
head -50 src/services/budgetService.ts
```

### 3.2 · Confirmar que el store `'budgets'` NO existe en la DB

```bash
grep -nE "budgets" src/database/initDB.ts
grep -nE "createObjectStore.*budget" src/database/
grep -nE "STORES.*budget" src/database/
```

**Resultado esperado** · cero matches en `createObjectStore` · cero matches en constantes de stores. Si aparece algún match · DETENERSE y reportar a Jose · la premisa de la decisión cambia.

### 3.3 · Listar TODOS los imports de `budgetService`

```bash
grep -rnE "from.*budgetService|import.*budgetService" src/ --include="*.ts" --include="*.tsx"
```

Output esperado · lista de archivos consumers. Para cada consumer · verificar si el consumer:
- (a) Solo importa `budgetService` y nada más útil → candidato a eliminación también
- (b) Importa `budgetService` junto con otros servicios vivos → solo eliminar la línea de import + el código que la usa
- (c) Importa `budgetService` pero ese import nunca se ejecuta (dead code dentro del consumer) → eliminar import + bloque muerto

### 3.4 · Listar referencias a `'budgets'` como string en todo el repo

```bash
grep -rnE "'budgets'|\"budgets\"" src/ --include="*.ts" --include="*.tsx"
```

Cualquier match es dead code · catalogar y eliminar.

### 3.5 · Disambiguar `budgetService` vs `presupuestoService`

```bash
ls -la src/services/ | grep -iE "budget|presupuesto"
```

**Importante** · son nombres diferentes para conceptos diferentes. NO confundir. Solo se elimina `budgetService` (en inglés). Si existe `presupuestoService` (en español) · NO TOCAR · es código vivo de otro flujo.

---

## 4 · Plan de ejecución

### Fase 1 · Documentación previa de algoritmos rescatables (obligatoria)

Antes de borrar · CC crea el archivo `docs/audits/algoritmos-budgetservice-rescate.md` con la siguiente estructura ·

```markdown
# Algoritmos rescatables de `budgetService.ts` · pre-eliminación

> Capturado en PR-C-PROY-1-bis · 2026-XX-XX · antes de eliminar el archivo
> Para reuso cuando se construya `presupuestoService` desde el modelo Mi Plan v2

## Resumen del archivo eliminado
- Líneas · [N]
- Imports · [lista]
- Stores que intentaba escribir · `'budgets'` (FANTASMA · no existe en initDB)

## Funciones/algoritmos potencialmente reutilizables

### [nombreFuncion]
- **Propósito** · [qué hace]
- **Input** · [tipo]
- **Output** · [tipo]
- **Notas** · [si tiene dependencias raras · si parece bien diseñado · etc.]
- **Código** · ```ts [pegar el código] ```

[repetir por cada función con valor]

## Funciones que NO vale la pena rescatar
- [lista breve · puro CRUD sobre store fantasma]

## Conclusión
Cuando se construya `presupuestoService` desde Mi Plan v2 · revisar este documento como referencia. Probablemente la API final será distinta · pero los cálculos puros (agregados · proyecciones · clasificación) pueden ahorrar trabajo.
```

CC pega contenido real en `[…]`. Documento queda en repo como rastro.

### Fase 2 · Eliminación

1. Eliminar `src/services/budgetService.ts`
2. Por cada consumer detectado en pre-flight 3.3 ·
   - Caso (a) · solo importa `budgetService` → eliminar archivo consumer entero · **PEDIR APROBACIÓN IN-LOOP a Jose si el archivo tiene >50 líneas** (puede haber UI muerta no obvia)
   - Caso (b) · importa más cosas vivas → eliminar línea de import + bloque que lo usa · NO tocar el resto
   - Caso (c) · import muerto · nunca ejecutado → eliminar import + bloque dead
3. Eliminar cualquier referencia a `'budgets'` como string detectada en pre-flight 3.4
4. NO tocar `presupuestoService` (si existe) · NO tocar nada en español

### Fase 3 · Verificación cadena de huérfanos transitivos

Tras eliminar consumers caso (a) · re-ejecutar `grep -rnE "from.*[archivo-borrado]"` para detectar si OTROS archivos quedaron huérfanos.

**Si la cadena se extiende más de 1 nivel** (es decir · borraste un consumer y eso deja huérfano a un tercer archivo) ·

- DETENERSE
- PEDIR APROBACIÓN IN-LOOP a Jose con · "encontré huérfano transitivo · archivo X solo se usaba en Y que acabo de eliminar · ¿elimino X también?"
- NO continuar sin OK explícito de Jose

### Fase 4 · Validación final

```bash
npm run build
npm run lint
npm test 2>&1 | tail -20
```

**Criterios:**
- Build · debe pasar (cero errores TS · cero errores import resuelto)
- Lint · debe pasar (cero `unused-import`)
- Tests · número de suites failing debe ser igual o menor que main pre-existente (43 suites failing pre-existing · si sale 44 · CC introdujo regresión · DETENERSE y reportar)

---

## 5 · Caso especial · cadena de huérfanos transitivos

(reglas explícitas porque la lección NUEVO V10 #16 lo marca)

| Caso | Acción CC |
|---|---|
| 1 nivel · borras `budgetService.ts` · su consumer único es archivo X de <50 líneas · X no exporta nada usado por otros | Eliminar X también · documentar en PR description |
| 1 nivel · X es de >50 líneas O exporta algo usado por terceros | PEDIR APROBACIÓN IN-LOOP a Jose · NO eliminar sin OK |
| 2 niveles · borras `budgetService.ts` · X queda huérfano · Y solo dependía de X | DETENERSE · PEDIR APROBACIÓN IN-LOOP a Jose · explicar la cadena · esperar OK |
| 3+ niveles | DETENERSE · escalar a Jose · NO ejecutar |

---

## 6 · Reglas de ejecución · NO ROMPER

(canon Jose · idéntico a PR-C-PROY-1)

1. **Stop-and-wait** · CC abre PR · NO mergea · espera autorización Jose
2. **1 sub-task = 1 PR** · este es 1 PR único · NO subdividir · NO parallel
3. **Grep duro obligatorio** · pre-flight sección 3 · pegar output literal en PR description
4. **NO confiar en docs/handoffs/headers** · solo grep
5. **In-loop approval** para huérfanos transitivos · cadena >1 nivel · siempre preguntar
6. **Disambiguar nombres** · `budgetService` (inglés) eliminar · `presupuestoService` (español · si existe) NO tocar
7. **Documento de rescate obligatorio** · NO eliminar el archivo sin haber creado primero `docs/audits/algoritmos-budgetservice-rescate.md`
8. **NO crear nuevos tests** · este PR solo elimina código · si hay test específico de `budgetService` · eliminar también
9. **NO tocar tests pre-existentes failing** · 43 suites failing en main son deuda separada · spec T-TESTS-SANEAR pendiente · este PR no toca eso
10. **NO subir DB_VERSION** · sigue en 70 · `'budgets'` nunca existió como store · no hay nada que migrar

---

## 7 · Criterios de aceptación

CC declara el PR listo solo si TODOS estos puntos se cumplen ·

- [ ] Pre-flight 3.1-3.5 ejecutado · output pegado en PR description
- [ ] `docs/audits/algoritmos-budgetservice-rescate.md` creado y poblado con contenido real (no plantilla vacía)
- [ ] `src/services/budgetService.ts` eliminado
- [ ] Todos los imports de `budgetService` eliminados (`grep -rnE "budgetService" src/` retorna cero matches · excepto en el archivo de rescate)
- [ ] Todas las referencias a `'budgets'` como string store eliminadas
- [ ] Consumers caso (a) eliminados con aprobación Jose · caso (b) limpiados · caso (c) eliminados
- [ ] Cadena huérfanos transitivos · si existió · resuelta con OK explícito Jose
- [ ] Build pasa · cero errores TS · cero `unused-import`
- [ ] Tests · suites failing ≤ 43 (no introducir regresiones)
- [ ] DB_VERSION sigue en 70 (no se toca)
- [ ] PR description incluye · resumen · lista archivos eliminados · lista imports limpiados · enlace al archivo de rescate · output pre-flight

---

## 8 · Entregables al PR

### 8.1 · Título PR

`PR-C-PROY-1-bis · Eliminar dead code budgetService.ts (decisión Jose · opción A)`

### 8.2 · Description PR · estructura

```markdown
## Objetivo
Cierra deuda abierta del PR-C-PROY-1 · decisión Jose A/B/C resuelta como A (eliminar).

## Pre-flight ejecutado
[pegar output literal de comandos sección 3]

## Archivos eliminados
- `src/services/budgetService.ts` · [N] líneas
- [otros si los hay · caso a]

## Imports/referencias limpiados
- `archivo X` · línea Y · import eliminado
- [...]

## Cadena de huérfanos transitivos
- [N/A · ninguno detectado] O [detectado · resuelto con OK Jose en comentario · enlace]

## Documento de rescate
Creado · `docs/audits/algoritmos-budgetservice-rescate.md` · [N] algoritmos documentados.

## Validación
- Build · OK
- Lint · OK
- Tests · X suites failing (≤43 pre-existing · sin regresión)
- DB_VERSION · 70 (sin cambio)

## Decisión Jose
Confirmada en chat sesión 2026-XX-XX · elegir opción A · eliminar · documentar algoritmos rescatables · construir `presupuestoService` desde cero cuando llegue Mi Plan v2.

## NO MERGEAR
Esperar autorización Jose tras revisión deploy preview.
```

---

## 9 · Comandos de referencia (canon · usar tal cual)

```bash
# Pre-flight 3.1
ls -la src/services/budgetService.ts
wc -l src/services/budgetService.ts

# Pre-flight 3.2
grep -nE "budgets" src/database/initDB.ts
grep -nE "createObjectStore.*budget" src/database/

# Pre-flight 3.3
grep -rnE "from.*budgetService|import.*budgetService" src/ --include="*.ts" --include="*.tsx"

# Pre-flight 3.4
grep -rnE "'budgets'|\"budgets\"" src/ --include="*.ts" --include="*.tsx"

# Pre-flight 3.5
ls -la src/services/ | grep -iE "budget|presupuesto"

# Validación final
npm run build && npm run lint && npm test 2>&1 | tail -20

# Confirmación post-borrado
grep -rnE "budgetService" src/
# Resultado esperado · cero matches en src/ (solo aparece en docs/audits/)
```

---

## 10 · Riesgo conocido y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Encontrar consumer caso (a) grande no documentado en audit previo | Media | Pierde 1-2h reviewing | Pedir aprobación in-loop a Jose antes de eliminar |
| Cadena huérfanos transitivos >1 nivel | Baja | Spec se alarga · Jose tiene que decidir | Stop-and-wait obligatorio · Jose decide |
| Build se rompe por import implícito no detectado por grep (dynamic import) | Muy baja | Re-trabajar | Build pasa antes de PR · si falla · CC investiga `await import()` y corrige |
| Algoritmo útil dentro de `budgetService.ts` se pierde | Baja | Reescribir cuando llegue Mi Plan v2 (4-6h) | Documento de rescate sección 6 captura los algoritmos antes de borrar |
| Confundir `budgetService` con `presupuestoService` y borrar el bueno | Muy baja | Romper código vivo | Sección 3.5 disambigua explícitamente |

---

## 11 · Notas para Claude próximo (post-merge)

Tras merge · actualizar handoff con ·
- PR-C-PROY-1-bis cerrado · módulo Proyección 100% saneado tras Tanda 1
- Decisión `budgetService` A/B/C cerrada definitivamente · A
- Documento `docs/audits/algoritmos-budgetservice-rescate.md` existe · consultar si se construye `presupuestoService` desde Mi Plan v2
- DB sigue en 70 · 40 stores

---

**Fin del spec.**
**Listo para entregar a CC.**
