# AUDIT INPUTS · TAREA 6 · Arquitectura objetivo de stores ATLAS

> **Para GitHub Copilot · empieza leyendo este README.**

---

## 1 · Qué tienes que hacer

Ejecutar la tarea descrita en `01-spec/TAREA-CC-6-ARQUITECTURA-OBJETIVO.md`.

Es una **auditoría exhaustiva + diseño de arquitectura objetivo + plan de transición** del modelo de datos de ATLAS · una aplicación de gestión patrimonial para inversores en alquiler.

**No modificas código.** Solo produces 1 documento markdown · `docs/ATLAS-ARQUITECTURA-OBJETIVO-V1.md` · que será revisado por Jose (founder) antes de cualquier acción posterior.

---

## 2 · Qué hay en cada carpeta

### 📁 `01-spec/` · LA TAREA · LEER PRIMERO
- `TAREA-CC-6-ARQUITECTURA-OBJETIVO.md` · spec completa con 3 sub-tareas (diagnóstico · diseño · plan)

### 📁 `02-mockups-mi-plan-v3/` · MOCKUPS ACTIVOS · roadmap visual
- 6 mockups HTML del módulo Mi Plan · cerrados · son la guía visual de lo que la app debe hacer
- Cada uno representa una vista navegable que el usuario verá

### 📁 `03-mockups-resto/` · MOCKUPS ACTIVOS · resto del producto
- 14 mockups HTML del resto de módulos (Panel · Personal · Inmuebles · Tesorería · Financiación · Inversiones · Contratos · Fiscal · Archivo · Onboarding · Ajustes · Corrección)
- Todos son la fuente visual de qué datos se muestran al usuario

### 📁 `04-arquitectura/` · ESTADO DEL CÓDIGO Y DECISIONES
- `ATLAS-mapa-stores-VIGENTE.md` · auditoría TÉCNICA previa de los 59 stores (uso real · lecturas/escrituras con archivo:línea)
- `HANDOFF-V4-atlas.md` · contexto del proyecto · decisiones tomadas · roadmap
- `GUIA-DISENO-V5-atlas.md` · sistema de diseño cerrado (no aplica al backend pero da contexto)
- `MAPEO-DATOS-mi-plan-landing-DEFINITIVO.md` · primer mapeo de un mockup → stores · ejemplo del formato esperado

### 📁 `05-snapshot/` · ESTADO REAL DE DATOS
- `atlas-snapshot-20260426-10.json` · 1.4 MB · export completo de la DB de Jose · 26 abril 2026 · 59 stores · 25 con datos · 34 vacíos
- Útil para saber **cuántos registros tiene cada store en uso real** · pero NO es fuente de verdad para decidir VIVO (algunos stores con datos están en drift · algunos vacíos son legítimos del roadmap)

### 📁 `06-modelo-datos/` · AXIOMAS
- `ATLAS-Personal-modelo-datos-v1.md` · 14 axiomas inviolables del modelo de datos del módulo Personal · sigue vigente · referencia obligatoria para entender separación de stores

### 📁 `07-historico/` · REFERENCIA · NO obligatorio leer
- Documentos previos · mapa de stores antiguo (9 abril) · handoffs anteriores · mockup Mi Plan v2 (DESCARTADO · no usar para diseño)
- Útil solo si necesitas entender la evolución de alguna decisión

---

## 3 · Realidades importantes que debes asumir

### 3.1 · Los datos NO son productivos
La app NO está en uso real. Jose ha estado importando XMLs fiscales (5 ejercicios 2020-2024) en modo prueba/error. Los datos del snapshot son **referencia · no sagrados**. Al diseñar la arquitectura objetivo · NO sobre-protejas datos existentes.

### 3.2 · Estrategia de migración asumida · wipe + re-importar
Cuando se implemente la limpieza (TAREA 7+ · NO en esta tarea) · el plan es **borrar la DB y reconstruirla desde los XMLs originales**. NO necesitas preservar registros campo a campo. Diseña para wipe + re-import.

### 3.3 · Sé propositivo · no conservador
Ante la duda · proponer y justificar. Si un store tiene propósito ambiguo · márcalo como AMBIGUO + apunta lo que sí entiendes. NO mantengas stores "por si acaso" · eso es lo que ha llevado a la deuda actual.

### 3.4 · Cero modificaciones de código
Esta tarea es 100% diagnóstico + diseño + plan. Cero cambios de código. Cero refactors aprovechando. Cero PRs de fix paralelos.

---

## 4 · Estructura del documento que vas a producir

`docs/ATLAS-ARQUITECTURA-OBJETIVO-V1.md` con esta estructura:

```
1. Resumen ejecutivo (1 página · revisable en 5 min)
2. SUB-TAREA A · Diagnóstico (59 fichas + 4 preguntas arquitectónicas + tabla resumen)
3. SUB-TAREA B · Diseño objetivo (N stores · agrupados por dominio · invariantes · 4 decisiones cerradas)
4. SUB-TAREA C · Plan de transición (mapeo · listas eliminar/crear/refactorizar · plan wipe+reimport · tareas posteriores)
5. Próximos pasos · qué decide Jose
```

Detalle completo en la spec.

---

## 5 · Las 4 preguntas arquitectónicas críticas

Tu documento DEBE responderlas explícitamente · con análisis del código actual + recomendación + justificación:

1. **Treasury vs gastosInmueble** · ¿quién manda en presente/futuro vs histórico declarado?
2. **`compromisosRecurrentes`** · ¿se autopuebla desde gastosInmueble · o solo manual · o híbrido?
3. **`accounts.balance`** · ¿campo derivado o persistido?
4. **Renta mensual** · ¿escalar en `contracts` · o histórico en store separado?

---

## 6 · Outputs esperados

### Archivos que creas
- `docs/ATLAS-ARQUITECTURA-OBJETIVO-V1.md` · el documento maestro

### Pull Request
- Título · `audit: arquitectura objetivo de stores · diagnóstico + diseño + plan`
- Solo añade el documento · CERO cambios de código
- En la descripción del PR · pegar las tablas resumen para revisión rápida

---

## 7 · Checklist antes de cerrar la tarea

- [ ] Leíste `01-spec/TAREA-CC-6-ARQUITECTURA-OBJETIVO.md` completa
- [ ] Recorriste los 6 mockups Mi Plan v3 (entendiendo qué dato muestra cada componente)
- [ ] Recorriste los 14 mockups del resto del producto
- [ ] Leíste `04-arquitectura/ATLAS-mapa-stores-VIGENTE.md` para tener uso real de cada store
- [ ] Leíste `06-modelo-datos/ATLAS-Personal-modelo-datos-v1.md` para conocer los 14 axiomas
- [ ] Inspeccionaste `05-snapshot/atlas-snapshot-20260426-10.json` para conteos reales
- [ ] Auditaste el código del repo · grep en cada uno de los 59 stores
- [ ] 59 fichas detalladas escritas
- [ ] 4 preguntas arquitectónicas respondidas
- [ ] Diseño objetivo con N stores propuesto
- [ ] Plan de transición completo (mapeo · listas · wipe+reimport · tareas posteriores)
- [ ] Tabla resumen al inicio del documento
- [ ] PR abierto con descripción de tablas

---

## 8 · Si te bloqueas

- Si un store tiene propósito ambiguo tras 5+ minutos de lectura · **marca AMBIGUO** · no inventes
- Si dos mockups muestran el mismo dato pero con formato distinto · **documenta el conflicto** · propón resolución
- Si encuentras un bug · **documenta en "Hallazgos transversales"** · NO arregles
- Si el alcance se desborda · **para · documenta el bloqueo** · espera input

---

## 9 · Lo que NO debes hacer

- ❌ NO modificar código
- ❌ NO eliminar stores
- ❌ NO arreglar bugs
- ❌ NO crear stores nuevos en migración
- ❌ NO completar refactors a medias
- ❌ NO seguir las recomendaciones del documento `07-historico/atlas-mi-plan-v2.html` · ESTÁ DESCARTADO

---

**Empieza por leer `01-spec/TAREA-CC-6-ARQUITECTURA-OBJETIVO.md` · ahí está todo el detalle.**
