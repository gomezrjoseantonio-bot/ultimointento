# TAREA CC · Auditoría completa + diseño de arquitectura objetivo + plan de transición

> **Tipo** · auditoría exhaustiva + diseño + plan · solo lectura · cero modificaciones de código
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
>
> **Rama** · crear `audit/arquitectura-objetivo` desde `main`
>
> **Tiempo estimado** · 12-20 horas (es un trabajo denso · pero produce el plan de los próximos 2-3 meses de desarrollo)
>
> **Prioridad** · CRÍTICA · bloquea TAREA 5 (mapeo) · TAREA 7 (limpieza) · y todo el resto del roadmap
>
> **Predecesores** · `audit/stores-25abril`, TAREA 2, TAREA 4, correcciones post-deploy · TODOS mergeados
>
> **DB actual** · DB_VERSION 59 · 59 stores
>
> **Sustituye** · si hay otro PR de auditoría en curso · cancelarlo · este es más ambicioso

---

## 1 · Contexto · arrancar leyendo esto

ATLAS lleva semanas acumulando deuda técnica. 4 refactors mayores (G-01 · gastosInmueble fases A-F · tesorería restructure · Mi Plan v3) han dejado:
- 59 stores · 34 vacíos en producción
- 3 deprecaciones declaradas pero no completadas (`opexRules` · `rentaMensual` · `ejerciciosFiscales`)
- Datos que se escriben en X y se leen de Y · drift permanente
- Stores con propósitos solapados sin claridad de fuente de verdad

**Tres realidades importantes que el ejecutor debe saber:**

1. **Los datos NO son productivos.** Jose ha estado importando XMLs (5 ejercicios fiscales 2020-2024) en modo prueba/error. La app NO está en uso real · está en validación. Por tanto · el ejecutor NO debe sobre-proteger los datos existentes.

2. **Jose prefiere romper con claridad antes que parchear más.** La actitud correcta es ser propositivo · no conservador. Si un store tiene propósito ambiguo · marcarlo como tal y proponer su destino · no mantenerlo "por si acaso".

3. **La estrategia de migración será wipe + re-importar XMLs.** Cuando llegue TAREA 7 (implementación de la limpieza) · se asumirá que la DB se borra y se reconstruye desde los XMLs originales. Esto significa que el plan de transición NO necesita preservar registros existentes campo a campo · solo definir cómo el flujo de re-importación rellena la nueva arquitectura.

---

## 2 · Objetivo · 3 sub-tareas en un solo documento

Producir 1 documento maestro · `ATLAS-ARQUITECTURA-OBJETIVO-V1.md` · estructurado en 3 sub-tareas:

### Sub-tarea A · DIAGNÓSTICO
Para cada uno de los 59 stores actuales · ficha exhaustiva con propósito · uso real · veredicto.

### Sub-tarea B · DISEÑO OBJETIVO
Partiendo de los mockups v3 + tipologías cerradas · diseñar la arquitectura de stores correcta. Mínimo · suficiente · sin solapamientos · con UN solo escritor por dato.

### Sub-tarea C · PLAN DE TRANSICIÓN
Mapeo store_actual → store_objetivo. Lista de stores a eliminar · crear · refactorizar. Estrategia de re-importación XMLs paso a paso.

---

## 3 · Reglas inviolables

1. **Cero modificaciones de código** · esto es diagnóstico + diseño · NO implementación
2. **Cero asunciones** · cada hecho con archivo + línea
3. **Cero invenciones** · si algo no se entiende del código · marcar como AMBIGUO + apuntar lo que sí se ve
4. **Sé propositivo · no conservador** · ante la duda · proponer · NO mantener "por si acaso"
5. **Datos NO son sagrados** · asumir wipe + re-import desde XMLs como estrategia · diseñar para eso
6. **Cero MVPs** · auditar y diseñar para los 59 stores · sin saltarse ninguno
7. **Cada decisión justificada** · 3-5 frases con evidencia · sin templates

---

## 4 · Inputs disponibles

### 4.1 · Documentación

- `ATLAS-mapa-stores-VIGENTE.md` · auditoría técnica del 25 abril
- `HANDOFF-V4-atlas.md` · contexto del proyecto · roadmap
- `ATLAS-Personal-modelo-datos-v1.md` · 14 axiomas del modelo Personal
- `MAPEO-DATOS-mi-plan-landing-DEFINITIVO.md` · primer mapeo con verdad codebase
- `GUIA-DISENO-V5-atlas.md` · sistema de diseño cerrado

### 4.2 · Snapshot real

`atlas-snapshot-20260426-10.json` · 59 stores · 34 vacíos · 25 con datos · DB_VERSION 59

### 4.3 · Mockups · roadmap visual

**Mi Plan v3 · 6 mockups · cerrados:**
- `atlas-mi-plan-landing-v3.html`
- `atlas-mi-plan-proyeccion-v3.html`
- `atlas-mi-plan-libertad-v3.html`
- `atlas-mi-plan-objetivos-v3.html`
- `atlas-mi-plan-fondos-v3.html`
- `atlas-mi-plan-retos-v3.html`

**Resto del producto · 12+ mockups en `/mnt/project/`:**
- `atlas-panel.html` · panel general
- `atlas-personal-v3.html` · módulo Personal
- `atlas-inmuebles-v3.html` · listado inmuebles
- `atlas-inmueble-fa32-v2.html` · ficha inmueble
- `atlas-tesoreria-v8.html` · tesorería
- `atlas-financiacion-v2.html` · préstamos
- `atlas-inversiones-v2.html` · inversiones
- `atlas-contratos-v4.html` · contratos rentales
- `atlas-wizard-nuevo-contrato.html` · alta contrato
- `atlas-fiscal.html` · módulo fiscal
- `atlas-archivo.html` · archivo documental
- `atlas-correccion.html` · corrección por inspección
- `atlas-onboarding.html` · onboarding inicial
- `atlas-ajustes-v2.html` · ajustes

### 4.4 · Repo

`gomezrjoseantonio-bot/ultimointento` · branch `main` · CC tiene acceso de lectura completo

---

## 5 · SUB-TAREA A · DIAGNÓSTICO

### 5.1 · Para cada uno de los 59 stores · ficha completa

```markdown
## <nombre_store>

**Schema actual** (interface TypeScript pegada literal de db.ts)
**KeyPath e índices** (de db.ts)
**Registros en producción** · N (del snapshot)
**Servicio dedicado** · existe / no existe · path

**Quién escribe** · lista exhaustiva de archivo:línea + función
- src/services/X.ts:N · función fn() · contexto

**Quién lee** · lista exhaustiva de archivo:línea + función
- src/components/Y.tsx:N · función fn() · contexto

**Mockups que lo necesitan** · cuáles · qué dato muestran
- atlas-tesoreria-v8.html · "Saldo total" · campo balance

**Propósito declarado** · 2-4 frases describiendo qué dato representa este store en términos de negocio · NO en términos técnicos

**Veredicto** · uno de:
  - VIVO · usado activamente · arquitectura correcta
  - HUÉRFANO · vacío en producción pero planificado en roadmap
  - FÓSIL · vacío + sin lectores + sin plan · ELIMINABLE
  - DUPLICADO · función cubierta por otro store · ESPECIFICAR cuál
  - AMBIGUO · propósito no claro tras leer código · necesita decisión Jose

**Justificación** · 3-5 frases con evidencia
**Riesgos al eliminar** · si VEREDICTO ≠ VIVO · qué se rompe si se quita
```

### 5.2 · 4 preguntas arquitectónicas que el diagnóstico debe responder

Mientras audita · CC va llenando estas 4 cuestiones que **deben estar respondidas explícitamente** en sección dedicada del documento:

**Pregunta 1 · Treasury vs gastosInmueble · ¿quién manda en presente/futuro?**
- ¿`treasuryEvents` es única fuente de verdad para presente/futuro?
- ¿`gastosInmueble` se reduce a histórico declarado fiscalmente?
- ¿Cómo se conectan? · ¿treasuryEvents.confirmed se proyecta como gasto declarado?

**Pregunta 2 · Compromisos recurrentes · ¿cómo se inicializan?**
- ¿`compromisosRecurrentes` se puebla automáticamente desde `gastosInmueble` histórico al primer arranque?
- ¿O sólo se crea manualmente?
- ¿O ambas · con detección de patrones?

**Pregunta 3 · Saldo de cuenta · ¿derivado o persistido?**
- ¿`accounts.balance` debe ser campo derivado (calculado de movements) en cada lectura?
- ¿O persistido (actualizado tras cada movement)?
- ¿Qué pasa con `openingBalance` y `openingBalanceDate`?

**Pregunta 4 · Renta mensual · ¿escalar o histórico?**
- ¿`contracts.rentaMensual` (escalar actual) es suficiente?
- ¿O se necesita histórico de rentas (revisiones · indexaciones · cambios)?
- ¿Dónde vive ese histórico · embebido en contract o store separado?

**Cada respuesta** · análisis del código actual + recomendación de la arquitectura objetivo + justificación.

### 5.3 · Tabla resumen del diagnóstico

Al inicio del documento · tabla:

| # | Store | Veredicto | Motivo · 1 línea | Acción propuesta |
|---|---|---|---|---|
| 1 | accounts | VIVO | tesorería · usado en panel + tesorería | mantener · ver pregunta 3 |
| ... | ... | ... | ... | ... |

Ordenable. Permite revisión 5-10 minutos sin leer 59 fichas.

---

## 6 · SUB-TAREA B · DISEÑO DE ARQUITECTURA OBJETIVO

### 6.1 · Aproximación

Olvidar los 59 stores actuales. Partir desde los mockups v3 y las decisiones arquitectónicas cerradas (axiomas Personal v1.1 · decisiones Mi Plan v3 · etc).

Para cada **dato visible** en algún mockup v3 + cada **dato que el sistema necesita gestionar internamente** · proponer:
- ¿En qué store vive?
- ¿Quién es el ÚNICO escritor?
- ¿Quiénes son los lectores?

Proponer la **lista mínima de stores** que satisface todos los mockups v3.

### 6.2 · Para cada store del modelo objetivo

```markdown
## <nombre_store_objetivo>

**Propósito** · 1 frase clara · qué dato representa · contrato con el negocio

**Schema TypeScript propuesto** · interface completa

**KeyPath e índices propuestos**

**Único escritor** · qué servicio o flujo escribe en este store · NUNCA dos
- ej. importador XML AEAT · onboarding · UI form X

**Lectores** · qué componentes/servicios leen
- ej. atlas-mi-plan-landing → fórmula 3.1
- ej. atlas-tesoreria-v8 → KPI saldo total

**Relaciones FK con otros stores**
- inmuebleId → properties.id (number)
- prestamoId → prestamos.id (string UUID)

**Reglas de invariante** · qué NUNCA debe pasar
- ej. dos fondos no pueden tener la misma cuenta en modo 'completo'
- ej. el campo año debe ser ≥ 2020 y ≤ 2099

**Origen del primer dato** · cómo se rellena en el primer arranque
- importación XML AEAT · alta manual usuario · cálculo derivado · etc

**Datos típicos en producción** · cuántos registros se esperan en uso normal
- ej. ~5-10 inmuebles · ~10-30 préstamos a lo largo del ciclo de vida
```

### 6.3 · Categorización de stores objetivo

Agrupar los stores objetivo por dominio:

- **Activos · físicos** · `properties` · `mejorasInmueble` · `mueblesInmueble` · etc
- **Activos · financieros** · `inversiones` · `accounts`
- **Compromisos · entrantes** · `contracts` · `nominas` · `otrosIngresos`
- **Compromisos · salientes** · `prestamos` · `compromisosRecurrentes`
- **Operación · pasado** · `movements` · `gastosInmueble` (histórico declarado)
- **Operación · presente/futuro** · `treasuryEvents` · `presupuestoLineas`
- **Fiscal** · `ejerciciosFiscalesCoord` · `arrastres*` · `documentosFiscales`
- **Personal** · `personalData` · `personalModuleConfig` · `patronGastosPersonales`
- **Mi Plan** · `objetivos` · `fondos_ahorro` · `retos` · `escenarios`
- **Documental** · `documents`
- **Sistema** · `keyval` · `learningLogs` · `importBatches`

Cada bloque con justificación de por qué los stores que contiene están separados (no se pueden fusionar) y por qué los stores que NO están aquí no son necesarios.

### 6.4 · Comparación de tamaños

Tabla:
- Stores actuales · 59
- Stores objetivo · N (probablemente 30-40)
- Reducción · X%

### 6.5 · 4 respuestas arquitectónicas explícitas

Cerrar las 4 preguntas de §5.2 con la decisión recomendada · justificada.

---

## 7 · SUB-TAREA C · PLAN DE TRANSICIÓN

### 7.1 · Mapeo actual → objetivo

Tabla maestra:

| Store actual | Veredicto | Store objetivo destino | Acción |
|---|---|---|---|
| accounts | VIVO | accounts | mantener · ajustar campo balance |
| opexRules | DUPLICADO | compromisosRecurrentes | eliminar · datos ya migrados V5.4 |
| objetivos_financieros | YA ELIMINADO | escenarios | (ya se hizo en V59) |
| ... | ... | ... | ... |

### 7.2 · Lista de stores a ELIMINAR

Lista priorizada · mayor riesgo arriba · menor riesgo abajo:
- Stores claramente FÓSIL · sin datos · sin lectores · ningún mockup
- Stores DUPLICADOS · función cubierta · datos migrables o re-importables
- Stores con funciones que CC propone disolver en otros (con justificación)

Para cada uno · estimación de impacto · qué archivos hay que modificar.

### 7.3 · Lista de stores a CREAR

Si el diseño objetivo introduce stores que no existen hoy · lista con:
- Nombre
- Cuándo se crea (V60+ migración)
- Cómo se rellena en re-importación

Probablemente esta lista sea corta o vacía · ya creamos los 4 nuevos en TAREA 4.

### 7.4 · Lista de stores a REFACTORIZAR

Stores que se mantienen pero cambian schema · campos · índices:
- Schema viejo → schema nuevo
- Campos añadidos · borrados · renombrados
- Migraciones necesarias

### 7.5 · Estrategia de wipe + re-importación

Proceso paso a paso para reconstruir la DB desde cero:

1. **Punto de partida** · DB_VERSION 60 (post limpieza) · stores creados según diseño objetivo · todos vacíos
2. **Datos manuales mínimos** · qué tiene que introducir el usuario antes de re-importar (ej. crear cuentas bancarias · personalData básico)
3. **Re-importación XMLs** · 5 ejercicios fiscales (2020-2024)
   - Qué stores se rellenan automáticamente · en qué orden
   - Qué validaciones se aplican
   - Qué hacer con los datos que el XML no aporta (ej. saldos actuales · contratos en vigor)
4. **Reconciliación opcional** · pasos manuales que el usuario puede hacer después (ej. corregir préstamos liquidados · alta contratos vivos · etc)
5. **Estado esperado tras transición** · cuántos registros tendrá cada store · cuáles seguirán vacíos a la espera de uso real

### 7.6 · Plan de implementación · TAREAS posteriores

Listar las tareas CC concretas que vendrán después · ordenadas:

- **TAREA 7** · limpieza quirúrgica V60 · eliminar FÓSILES y DUPLICADOS aprobados
- **TAREA 8** · refactorización de stores que cambian schema · V61
- **TAREA 9** · creación de stores nuevos (si aplica) · V62
- **TAREA 10** · adaptación de servicios y componentes consumidores
- **TAREA 11** · UI de re-importación + flujo wipe
- **TAREA 12** · TAREA 5 retomada · mapeo component → data sobre arquitectura nueva

Cada tarea con scope · prerequisites · estimación.

---

## 8 · Estructura del documento entregable

`ATLAS-ARQUITECTURA-OBJETIVO-V1.md` · estructura:

```
1. Resumen ejecutivo (1 página)
   - Veredicto general arquitectura actual
   - Reducción propuesta · 59 → N stores
   - Riesgo y esfuerzo de transición

2. SUB-TAREA A · Diagnóstico
   2.1 · Tabla resumen 59 stores
   2.2 · Fichas detalladas (59 secciones)
   2.3 · Respuestas arquitectónicas (4 preguntas)
   2.4 · Hallazgos transversales

3. SUB-TAREA B · Diseño objetivo
   3.1 · Tabla resumen stores objetivo
   3.2 · Fichas detalladas por dominio
   3.3 · Comparación 59 actuales vs N objetivo
   3.4 · 4 decisiones arquitectónicas cerradas

4. SUB-TAREA C · Plan de transición
   4.1 · Mapeo actual → objetivo
   4.2 · Stores a eliminar
   4.3 · Stores a crear
   4.4 · Stores a refactorizar
   4.5 · Wipe + re-importación paso a paso
   4.6 · Plan de tareas posteriores

5. Próximos pasos · qué decidir Jose · cuándo arrancar TAREA 7
```

---

## 9 · Pull Request

PR único · título · `audit: arquitectura objetivo de stores · diagnóstico + diseño + plan`

Solo añade `docs/ATLAS-ARQUITECTURA-OBJETIVO-V1.md`. Cero cambios de código.

En la descripción del PR · pegar:
- Sección 1 (Resumen ejecutivo)
- Tabla resumen de Sub-tarea A (59 stores con veredicto)
- Tabla resumen de Sub-tarea B (stores objetivo)
- Tabla resumen de Sub-tarea C (mapeo actual → objetivo)

Para que la revisión sea posible en 15-20 minutos sin leer las 50+ páginas.

---

## 10 · Criterios de aceptación

### Sub-tarea A
- [ ] 59 fichas detalladas · sin omisiones
- [ ] 4 preguntas arquitectónicas respondidas con análisis del código actual
- [ ] Tabla resumen ordenable por veredicto
- [ ] Hallazgos transversales documentados

### Sub-tarea B
- [ ] N stores objetivo definidos · con schema · escritor único · lectores · invariantes
- [ ] 4 decisiones arquitectónicas cerradas con recomendación
- [ ] Stores agrupados por dominio · justificación de separaciones
- [ ] Comparación 59 → N con porcentaje de reducción

### Sub-tarea C
- [ ] Mapeo completo actual → objetivo
- [ ] 3 listas claras · eliminar · crear · refactorizar
- [ ] Plan wipe + re-importación detallado
- [ ] Plan de tareas posteriores con prerequisites

### Globales
- [ ] PR contra `main` · revisable
- [ ] Cero modificaciones de código
- [ ] Documento legible en 15-20 minutos vía resumen ejecutivo + tablas

---

## 11 · Reglas operativas

- **Sé propositivo** · no conservador · ante la duda · proponer y justificar
- **Documenta AMBIGUO** · si tras 5+ minutos no entiendes el propósito · márcalo · NO inventes
- **No ejecutes nada** · diagnóstico + diseño + plan · ejecución es TAREA 7+
- **Si encuentras bugs nuevos** · documentar en sección "Hallazgos transversales" · no arreglar
- **Los datos NO son sagrados** · diseñar para wipe + re-import · no para preservación campo a campo
- **Si el alcance se desborda** · parar · documentar bloqueo · esperar input
- **Si descubres conflicto entre 2 mockups** · documentar · proponer resolución · pedir validación

---

## 12 · Lo que esta tarea NO hace

- ❌ NO modifica ningún store
- ❌ NO elimina nada
- ❌ NO refactoriza código
- ❌ NO arregla bugs
- ❌ NO implementa migración
- ❌ NO crea UI de wipe + re-import
- ❌ NO escribe el código de re-importación

Todo eso son tareas posteriores · esto es **diagnóstico + diseño + plan**.

---

## 13 · Después de TAREA 6

Cuando este PR esté mergeado y Jose haya revisado:

1. **Revisión de Jose** · 15-20 min con resumen ejecutivo + tablas
2. **Decisiones de Jose:**
   - Aprobar · modificar · rechazar diseño objetivo
   - Para cada FÓSIL · confirmar eliminación
   - Para cada DUPLICADO · confirmar ganador
   - Para cada AMBIGUO · cerrar decisión
   - Validar respuestas a las 4 preguntas arquitectónicas
3. **TAREA 7** · arrancar limpieza quirúrgica con plan aprobado
4. **TAREAS 8-12** · ejecutar el plan de transición secuencialmente

---

## 14 · Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Documento demasiado largo · imposible revisar | Alta | Resumen ejecutivo + 3 tablas resumen al inicio |
| Diseño objetivo desconectado de mockups reales | Media | Cada store objetivo cita mockups que lo necesitan · sección 6.2 obligatoria |
| Plan de re-importación incompleto | Media | Sección 7.5 detallada paso a paso |
| Decisiones arquitectónicas no consensuadas | Baja | 4 preguntas explícitas en §5.2 y §6.5 · Jose valida |
| CC propone cambios fuera de alcance | Baja | Reglas operativas claras · "no ejecutes" · esperar TAREA 7+ |

---

## 15 · Inputs ya disponibles · CC puede arrancar

- `ATLAS-mapa-stores-VIGENTE.md`
- `HANDOFF-V4-atlas.md`
- `ATLAS-Personal-modelo-datos-v1.md`
- `MAPEO-DATOS-mi-plan-landing-DEFINITIVO.md`
- `GUIA-DISENO-V5-atlas.md`
- `atlas-snapshot-20260426-10.json` (1.4 MB)
- 6 mockups Mi Plan v3
- 12+ mockups del resto del producto en `/mnt/project/`
- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`

CC tiene todo. Puede arrancar.

---

**Fin de la spec · esperar PR de CC con `ATLAS-ARQUITECTURA-OBJETIVO-V1.md` · revisar resumen ejecutivo · cerrar decisiones · abrir TAREA 7.**
