# TAREA CC · T-AUDIT-9 · Auditoría profunda 9 necesidades cliente · v1

> **Tipo** · Sub-tarea única DE AUDITORÍA · CC investiga el código real y reporta · NO modifica nada
> **Repo** · `gomezrjoseantonio-bot/ultimointento`
> **DB** · NO se toca
> **Esfuerzo** · 4-6h CC real · 1-2h tu revisión
> **Prioridad** · ALTA · bloqueante para tomar decisiones de qué arreglar
> **Output esperado** · 1 documento `docs/AUDIT-9-necesidades-cables-2026-05-08.md` con inventario completo

---

## 0 · Reglas inviolables

### 0.1 · CERO modificación de código
Esta tarea es **solo lectura y análisis**. CC investiga · documenta · sugiere · NO arregla nada · NO renombra · NO elimina · NO mueve · NO refactoriza. Solo el archivo nuevo de auditoría.

### 0.2 · NO inventar
Si CC no puede confirmar algo (ej · "esta función debería llamarse pero no encuentro caller") · lo reporta como tal · NO infiere. Cada afirmación con evidencia archivo:línea.

### 0.3 · Output único
Un único archivo `docs/AUDIT-9-necesidades-cables-2026-05-08.md`. Sin commits de código.

### 0.4 · Stop-and-wait
1 PR único contra `main` · NO mergear sin autorización Jose. Después de mergear · este documento será la base para construir el plan real de reconexión.

### 0.5 · NO asumir nada
Tres premisas explícitas para CC:

- **NO asumas que los cables sueltos funcionaban bien** antes de desconectarse · puede que funcionaran mal y nadie se enterara
- **NO asumas que los cables conectados funcionan bien** ahora · puede que haya pantallas mostrando basura silenciosamente
- **NO asumas que los mockups están implementados al 100%** en producción · contrasta mockup vs código real

---

## 1 · Contexto · qué se está auditando y por qué

### 1.1 · Hallazgo del cliente

Tras una sesión larga · el cliente (Jose) ha identificado el siguiente síntoma de fondo en ATLAS:

> *"El 95% está pero todo a medias. Los problemas que dices que hay las hay en mockup · las hay en otras versiones · o no acaban de funcionar. Entonces por ejemplo cuando dices gastos de inmuebles están · están los gastos previstos · el catálogo · pero no se ve lo que realmente llevamos gastado en ese inmueble · ni se ven las reformas etc."*

Y · *"al rehacer cosas se han ido desenchufando y no volviendo a conectar o no adaptar al nuevo entorno."*

### 1.2 · Las 9 necesidades del cliente

ATLAS debe responder a 9 necesidades del cliente (perfil A asalariado · perfil B consolidado 30 pisos pareja hijos · y mutación A→B). El detalle:

| # | Necesidad |
|---|---|
| 1 | Conocer mi patrimonio (consolidado · activos − pasivos) |
| 2 | Controlar lo que gasto (real · no solo previsto) |
| 3 | Controlar mi nómina y la de la pareja |
| 4 | Gestionar contratos con inquilinos (alta · renovaciones · vencimientos · cobros) |
| 5 | Tener claro el rumbo · plan financiero |
| 6 | Ver si me desvío del plan |
| 7 | Saber qué más invertir o disfrutar (con datos del cliente) |
| 8 | Hacer la declaración con un dedo (1/1/2027) |
| 9 | App única para A · A→B · B (UX progresiva con perfil) |

### 1.3 · Por qué esta auditoría

Antes de construir cualquier tarea de reconexión · necesitamos saber con precisión:

- Qué piezas existen (en código · no en mockup)
- Cuáles están **conectadas y funcionando**
- Cuáles están **conectadas pero mostrando basura**
- Cuáles están **desconectadas (cables sueltos)**
- Cuáles **faltan** (mockup las prometió · código no las tiene)

Y de las desconectadas · cuáles **funcionarían bien si se reconectan** · cuáles **necesitan adaptación** · cuáles **están mal hechas y mejor descartar**.

---

## 2 · Alcance · 3 frentes × 3 capas por necesidad

Para cada una de las **9 necesidades** · CC reporta:

### 2.1 · Los 3 frentes

| Frente | Qué busca CC |
|---|---|
| **1 · Cables sueltos** | Piezas (servicios · funciones · helpers · componentes) que existen en código pero no las llama nadie · o las llamaban y los callers se eliminaron · o las llamaban con firma vieja |
| **2 · Cables conectados pero defectuosos** | Piezas que se llaman desde algún sitio · pero producen resultado incorrecto · empty states cuando hay datos · incoherencias entre pantallas (ej · Mi Plan dice 0€ y Tesorería dice 90.665€ para el mismo concepto) |
| **3 · Cables que faltan** | Cosas que el mockup promete (atlas-*.html en `docs/`) pero el código no las tiene · o las tiene incompletas |

### 2.2 · Las 3 capas por hallazgo

Para cada cable suelto / defectuoso / faltante · CC reporta las 3 capas:

| Capa | Qué reporta CC |
|---|---|
| **1 · Existencia** | ¿La pieza existe en el código? · ¿qué hace? · ¿de qué la llamaba antes? · ¿por qué se rompió o desconectó? · evidencia archivo:línea |
| **2 · Salud** | ¿Funciona según su propio diseño? · ¿hay tests · pasan? · si no hay tests · ¿la lógica leída es correcta? · ¿hay bugs visibles a inspección? |
| **3 · Compatibilidad** | ¿Sirve para el entorno actual? · ¿lee de stores que existen con schema actual? · ¿usa firmas que siguen siendo válidas? · ¿asume estructura vieja? · si requiere adaptación · qué |

### 2.3 · Decisión sugerida por hallazgo

Tras las 3 capas · CC sugiere acción:

| Acción sugerida | Cuándo aplica |
|---|---|
| **A · Reconectar tal cual** | Cable suelto · funciona bien · compatible con entorno · solo perdió referencia |
| **B · Adaptar y reconectar** | Cable suelto o defectuoso · funciona bien · pero entorno cambió · requiere ajuste de firma o lectura |
| **C · Arreglar y reconectar** | Cable suelto o defectuoso · lógica con bugs · arreglar antes de usar |
| **D · Descartar** | Cable suelto · lógica obsoleta · mejor reescribir si se necesita la funcionalidad · NO reconectar |
| **E · Construir nuevo** | Cable que falta · mockup lo promete · código no lo tiene · construir desde cero |
| **F · Investigación adicional** | CC no puede determinar acción · requiere input Jose (ej · "esta función parece de un flujo viejo de antes de T7 · ¿se descontinuó?") |

---

## 3 · Estructura del documento de salida

```markdown
# AUDIT · 9 necesidades · cables sueltos · 2026-05-08

## 0 · Resumen ejecutivo
- Total hallazgos · X
  - Frente 1 (sueltos) · X
  - Frente 2 (defectuosos) · X
  - Frente 3 (faltantes) · X
- Acciones sugeridas
  - A reconectar tal cual · X
  - B adaptar y reconectar · X
  - C arreglar y reconectar · X
  - D descartar · X
  - E construir nuevo · X
  - F investigación adicional · X
- Hallazgos críticos · piezas que requieren input Jose

## 1 · Necesidad 1 · Conocer mi patrimonio
### 1.1 · Mockup esperado
[Lista lo que el mockup atlas-panel.html y otros prometen]
### 1.2 · Estado en código real
[Inventario de stores · servicios · pantallas existentes]
### 1.3 · Hallazgos
#### Frente 1 · Cables sueltos
[Lista por hallazgo · con 3 capas + decisión sugerida]
#### Frente 2 · Cables conectados pero defectuosos
[Idem]
#### Frente 3 · Cables que faltan
[Idem]
### 1.4 · Síntesis
[Estado real cobertura necesidad 1]

## 2 · Necesidad 2 · Controlar lo que gasto
[Misma estructura]

## 3 · Necesidad 3 · Controlar mi nómina y la de la pareja
[Misma estructura]

## ... continúa hasta Necesidad 9

## 10 · Tabla matriz consolidada
| # Necesidad | Estado producción | Frente 1 | Frente 2 | Frente 3 | Acción global sugerida |
| 1 Patrimonio | ... | ... | ... | ... | ... |
...

## 11 · Patrones recurrentes detectados
[Si CC detecta que el mismo tipo de bug aparece múltiples veces · lo agrupa aquí]

## 12 · Preguntas para Jose
[Lo que CC no puede resolver sin contexto humano]
```

### 3.1 · Especificidades por hallazgo

Cada hallazgo individual sigue este formato:

```markdown
#### Hallazgo · [Nombre breve]

**Capa 1 · Existencia**
- Pieza · `src/services/foo.ts:120` · función `calculatePatrimonioTotal`
- Hace · suma activos · resta pasivos · devuelve número
- Caller histórico · estaba en `src/pages/Panel.tsx:45` (eliminado en commit X · si CC encuentra)
- Por qué se rompió · refactor de Panel · nuevo Panel no llama a esta función

**Capa 2 · Salud**
- Tests · `__tests__/foo.test.ts` · 3 tests · 2 pasan · 1 falla porque [razón]
- Lógica · revisada · correcta excepto que asume `accounts.balance` (campo eliminado en T7) · debería leer `accounts.saldo`

**Capa 3 · Compatibilidad**
- Lee de · `accounts` (existe · OK) · `loans` (NO existe · se renombró a `prestamos`) · `inversiones` (existe · schema cambió en T35)
- Adaptación necesaria · cambiar nombre de store + ajustar lectura schema inversiones

**Decisión sugerida · B · Adaptar y reconectar**
**Esfuerzo estimado** · S (30-60 min CC)
**Bloqueante para** · necesidad 1 patrimonio
```

---

## 4 · Áreas específicas a auditar

CC debe priorizar la auditoría en estas zonas (de los hallazgos previos de Jose):

| Zona | Sospecha del hallazgo |
|---|---|
| **Mi Plan vs Tesorería** | Tesorería tiene 90.665€ cierre previsto · Mi Plan dice 0€ · cable suelto entre fuentes (probablemente Frente 2 defectuoso) |
| **Personal · Presupuesto** | Existe en mockup completo · cliente dice "está dormido · no lo uso" · puede ser Frente 3 (no implementado) o Frente 2 (pantalla existe pero pide datos que cliente no aporta) |
| **Inmueble · Gastos** | Mockup tiene gastos previstos · catálogo · pero NO se ve gastado real ni reformas · cable suelto entre `gastosInmueble` (real) y la pantalla |
| **Inmueble · CAPEX/OPEX** | Cliente confirmó · "el trabajo de OPEX/CAPEX se hizo · pero al rehacer cosas se desenchufó" · probablemente Frente 1 (sueltos) o Frente 2 (defectuosos) |
| **Patrimonio total consolidado** | NO existe vista de suma activos − pasivos · puede ser Frente 1 (helper huérfano) o Frente 3 (nunca se construyó) |
| **Sistema de alertas / desvíos** | Mockup tiene "Piden tu atención" · "Pendientes del día" · "EN PROGRESO" objetivos · pero sin cerebro de alertas · probablemente Frente 3 (falta) |
| **Recomendaciones (necesidad 7)** | Datos existen · síntesis no · probablemente Frente 3 (falta) |
| **Botón "1 click declaración" (necesidad 8)** | Motor fiscal completo (T13/T14/T18) · pero NO existe pantalla "presiona y declara" · probablemente Frente 3 (falta) |
| **UX progresiva A→B (necesidad 9)** | Datos sí crecen · UX plana · probablemente Frente 3 (falta) |
| **Onboarding** | Mockup detallado · contrastar con producción · puede haber Frentes 2 y 3 |

---

## 5 · Áreas que NO entran en esta auditoría

Para acotar el scope:

- ❌ NO auditar tests del repo · solo señalar si los tests existen y pasan/fallan
- ❌ NO auditar performance · solo correctitud
- ❌ NO auditar accesibilidad · solo funcionalidad
- ❌ NO auditar i18n · solo lógica
- ❌ NO modificar código · solo reportar
- ❌ NO crear specs de tareas · solo el documento de auditoría

---

## 6 · Cómo lanzar a CC

```
@CC ejecuta T-AUDIT-9 · Auditoría profunda 9 necesidades cliente · cables sueltos · defectuosos · faltantes
Spec · docs/TAREA-T-AUDIT-9-necesidades-cables.md

PUNTO DE PARTIDA · auditoría preflight
- DB_VERSION = 69 · 40 stores
- Todas las tareas previas mergeadas (T13 · T14 · T18 · T-MIPLAN · T34/T35-fix-2 · T16-fix-functional · T16-cleanup)
- Mockups en docs/atlas-*.html como referencia ideal
- Repo entero como objeto de análisis

ALCANCE · 3 FRENTES × 3 CAPAS por las 9 necesidades del cliente

NECESIDADES (audit cada una)
1. Conocer patrimonio (consolidado activos − pasivos)
2. Controlar gastos (real · no solo previsto)
3. Controlar nómina titular y pareja
4. Gestionar contratos con inquilinos
5. Tener claro el rumbo · plan
6. Ver si me desvío del plan
7. Qué más invertir o disfrutar (con datos cliente)
8. Hacer declaración con un dedo (1/1/2027)
9. App única para A · A→B · B

3 FRENTES POR NECESIDAD
- Frente 1 · Cables sueltos · piezas existentes sin caller activo
- Frente 2 · Cables conectados pero defectuosos · resultado incorrecto · empty states con datos · incoherencias entre pantallas
- Frente 3 · Cables que faltan · mockup promete · código no tiene

3 CAPAS POR HALLAZGO
- Capa 1 · Existencia · pieza · función · evidencia archivo:línea · caller histórico · por qué rompió
- Capa 2 · Salud · tests pasan · lógica leída · bugs visibles
- Capa 3 · Compatibilidad · lee de stores actuales · firmas válidas · adaptación requerida

DECISIÓN POR HALLAZGO
- A reconectar tal cual / B adaptar y reconectar / C arreglar y reconectar / D descartar / E construir nuevo / F investigación adicional

ZONAS PRIORITARIAS A AUDITAR
- Mi Plan vs Tesorería (Mi Plan 0€ vs Tesorería 90.665€)
- Personal · Presupuesto (cliente dice dormido)
- Inmueble · Gastos (no se ve real · solo previsto · ni reformas)
- Inmueble · CAPEX/OPEX (cliente confirmó desenchufado)
- Patrimonio total consolidado (NO existe pantalla)
- Sistema alertas / desvíos
- Recomendaciones (necesidad 7)
- Botón "1 click declaración" (necesidad 8)
- UX progresiva A→B (necesidad 9)
- Onboarding mockup vs producción

REGLAS INVIOLABLES
- CERO modificación de código · solo lectura y análisis
- NO inventar · cada afirmación con evidencia archivo:línea
- NO asumir cables sueltos funcionaban bien · validar con Capa 2 salud
- NO asumir cables conectados funcionan bien · validar Capa 2
- NO asumir mockups están al 100% · contrastar
- 1 PR único · solo el doc nuevo · NO commits de código
- NO mergear sin autorización Jose

OUTPUT
- 1 archivo único · docs/AUDIT-9-necesidades-cables-2026-05-08.md
- Estructura §3 del spec
- Cada hallazgo con 3 capas + decisión sugerida + esfuerzo estimado
- Tabla matriz consolidada al final · 9 necesidades × frentes
- Sección "Patrones recurrentes detectados"
- Sección "Preguntas para Jose"

VERIFICACIÓN
- 9 necesidades cubiertas con sus 3 frentes
- Cada hallazgo con archivo:línea de evidencia
- Resumen ejecutivo con conteos por frente y por acción sugerida
- Tabla matriz visible en un golpe de vista

ENTREGA
- 1 PR único contra main
- Título · docs(audit): T-AUDIT-9 · auditoría profunda 9 necesidades · cables sueltos · defectuosos · faltantes
- Descripción · resumen ejecutivo + total hallazgos por frente · esperando autorización Jose
- NO mergear · stop-and-wait

TIEMPO ESTIMADO CC real · 4-6h
```

---

## 7 · Después de T-AUDIT-9 · qué viene

Una vez Jose tiene el documento mergeado · Jose y Claude juntos:

1. Leen el documento
2. Identifican los hallazgos que más duelen (intersección "alto impacto cliente" × "esfuerzo bajo")
3. Construyen un plan T-RECONNECT con sub-tareas por bloques temáticos · cada una stop-and-wait
4. Las sub-tareas T-RECONNECT NO añaden cosas nuevas · reconectan lo que ya existe (acciones A · B · C principalmente)
5. Si aparecen acciones D (descartar) o E (construir nuevo) · son tareas separadas · cada una con su decisión

---

**Fin spec T-AUDIT-9 · auditoría profunda · solo lectura · base para construir plan real de reconexión sin inventar nada.**
