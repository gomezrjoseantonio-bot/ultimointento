# TAREA CC · T16 · Verificación `movementLearningRules` · v1

> **Tipo** · Sub-tarea única DE AUDITORÍA · CC reporta · Jose decide acción técnica posterior
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **DB** · NO se toca en esta sub-tarea (solo lectura/análisis)
> **Esfuerzo** · 30-60 min CC real · solo audit · 1h total con revisión Jose
> **Prioridad** · BAJA · saneamiento técnico · NO bloqueante
> **Fase** · 1 PR de auditoría · si sale acción correctiva · Jose lanza T16-fix con spec separada

---

## 0 · Reglas inviolables

### 0.1 · Auditoría · NO refactor en este PR
Esta sub-tarea es **solo lectura y análisis**. Si CC detecta bugs · los reporta · NO los arregla.

### 0.2 · Output esperado
Un único documento `docs/AUDIT-movementLearningRules-T16.md` con las respuestas concretas a las 3 preguntas de Jose · más diagnóstico técnico.

### 0.3 · NO inventar
Si CC no encuentra evidencia clara de algo (ej · "history[] no se escribe en ningún sitio") · lo reporta como tal · NO infiere.

---

## 1 · Contexto · qué se quiere saber

El store `movementLearningRules` se creó en TAREA 7 con un schema parcial. La auditoría TAREA 7-bis no respondió a 3 preguntas críticas que Jose había planteado.

**3 preguntas abiertas:**

| # | Pregunta | Por qué importa |
|---|---|---|
| 1 | Schema completo del registro · ¿qué campos tiene exactamente? La auditoría solo mencionó los índices `learnKey · categoria · ambito · createdAt` | Saber con qué se trabaja realmente |
| 2 | ¿Cuándo se dispara la escritura? · manual al clasificar movimiento · auto-detección de patrón al importar · ¿qué exactamente? | Entender el flujo de aprendizaje y dónde puede fallar |
| 3 | ¿`history[]` añadido en sub-tarea 1 (que absorbió `learningLogs`) está siendo escrito por algún flujo · o quedó código muerto? | Detectar trabajo incompleto · si está muerto · arreglar o eliminar |

---

## 2 · Alcance · solo análisis

### 2.1 · Análisis de código · 5 vectores

CC analiza el código real y reporta cada vector:

**A · Schema completo**
- Localizar interface TypeScript de `movementLearningRules` (probablemente en `src/services/db.ts` o tipos)
- Listar TODOS los campos (no solo índices) · tipos · opcionalidad · valores esperados
- Detectar campos huérfanos sin uso · campos sin tipado claro

**B · Escritores (write paths)**
- `grep` en `src/` por `movementLearningRules.add` · `.put` · `.update` · `.bulkAdd` · etc.
- Listar TODOS los puntos del código que ESCRIBEN al store · con archivo:línea
- Para cada uno · explicar **cuándo se dispara** (manual · automático · al importar · al clasificar · etc.)

**C · Lectores (read paths)**
- `grep` en `src/` por `movementLearningRules.get` · `.where` · `.toArray` · `.find` · etc.
- Listar TODOS los puntos que LEEN del store · con archivo:línea
- Para cada uno · explicar **para qué se usa la lectura**

**D · Estado del campo `history[]`**
- ¿Existe en el schema actual?
- ¿Algún punto del código escribe a `history[]`?
- ¿Algún punto del código lee de `history[]`?
- Veredicto · ACTIVO · CÓDIGO MUERTO · O REFACTORIZADO bajo otro nombre

**E · Coherencia con propósito declarado**
- El propósito declarado del store es "aprender clasificación de movimientos para auto-categorizar futuros"
- ¿El código real cumple este propósito?
- ¿Hay desviaciones · campos que sugieran otro uso?

### 2.2 · Output `docs/AUDIT-movementLearningRules-T16.md`

Estructura mínima:

```markdown
# AUDIT · movementLearningRules · T16

## 1 · Schema real (Pregunta 1)
[Listado completo de campos con tipos y opcionalidad]

## 2 · Escritores (Pregunta 2)
[Lista de puntos del código que escriben al store]
| # | Archivo:línea | Cuándo se dispara | Estado |
|---|---|---|---|
| 1 | ... | ... | ✅ activo / ⚠️ dudoso / 🚫 muerto |

## 3 · Lectores
[Lista de puntos del código que leen del store]

## 4 · Veredicto sobre `history[]` (Pregunta 3)
- Existe en schema · sí/no
- Es escrito · sí/no/dónde
- Es leído · sí/no/dónde
- Veredicto · ACTIVO / CÓDIGO MUERTO / REFACTORIZADO

## 5 · Coherencia con propósito
[Análisis de si el store cumple su propósito declarado]

## 6 · Bugs · gaps · code smells detectados
[Lista de problemas encontrados · cada uno con severidad]
| Severidad | Descripción | Archivo:línea | Acción sugerida |

## 7 · Recomendaciones para Jose
[Acciones concretas · cada una con esfuerzo estimado]
- Si todo OK · "ningún cambio necesario · auditoría positiva"
- Si hay bugs menores · "T16-fix-bugs · 1-2h"
- Si `history[]` es código muerto · "T16-cleanup · eliminar campo o activarlo · 1h"
- Si propósito no se cumple · "T16-refactor · rediseñar flujo aprendizaje · 4-6h"
```

### 2.3 · Verificación auditoría

- [ ] DB_VERSION = 69 · 40 stores · sin cambios
- [ ] Documento `docs/AUDIT-movementLearningRules-T16.md` publicado
- [ ] Las 3 preguntas de Jose respondidas explícitamente con evidencia código
- [ ] Recomendaciones priorizadas con esfuerzo CC estimado

---

## 3 · Cómo lanzar a CC

```
@CC ejecuta T16 · Auditoría movementLearningRules
Spec · docs/TAREA-T16-verificacion-movementLearningRules.md

PUNTO DE PARTIDA · auditoría · NO refactor
- DB_VERSION = 69 · 40 stores
- Store movementLearningRules existe · creado en TAREA 7 · campos parciales
- 3 preguntas críticas de Jose abiertas (ver §1 del spec)

ALCANCE · SOLO ANÁLISIS · NO arreglar nada
1. Localizar interface TypeScript completo de movementLearningRules
2. grep escritores · listar todos · explicar cuándo se disparan
3. grep lectores · listar todos · explicar para qué se usan
4. Estado del campo history[] · ¿activo · muerto · refactorizado?
5. Coherencia con propósito declarado
6. Listar bugs · gaps · code smells

OUTPUT · 1 archivo único
- docs/AUDIT-movementLearningRules-T16.md
- Estructura §2.2 del spec
- Veredicto sobre history[] · ACTIVO / MUERTO / REFACTORIZADO con evidencia
- Recomendaciones priorizadas con esfuerzo CC estimado

REGLAS
- NO modificar código · solo leer y reportar
- NO inventar · si no hay evidencia · "no encontrado" · NO infiere
- 1 PR único · solo el doc nuevo · NO commits de código
- NO mergear sin autorización Jose

VERIFICACIÓN
- DB_VERSION sin cambios
- 3 preguntas Jose respondidas con evidencia archivo:línea
- Veredicto history[] explícito
- Recomendaciones con esfuerzo

TIEMPO ESTIMADO CC real · 30-60 min
```

---

## 4 · Después de T16 · qué viene

| Resultado auditoría | Acción siguiente |
|---|---|
| **Auditoría positiva** · todo cumple propósito · history[] activo | Cerrar T16 · NO acción técnica |
| **Bugs menores · history[] activo** | T16-fix · 1-2h CC |
| **history[] código muerto** | Decidir · eliminar campo (T16-cleanup · 1h) o activar el flujo (T16-activate · 2-3h) |
| **Propósito no se cumple · refactor necesario** | T16-refactor · 4-6h CC con spec separada · Jose lanza solo si compensa |

---

**Fin spec T16 · auditoría limpia · 3 preguntas respondidas · 1 PR de doc · stop-and-wait.**
