# ATLAS · Modelo canónico de 4 páginas

> **Tipo** · documento de arquitectura conceptual · ancla única · sustituye cualquier modelo paralelo previo
>
> **Fecha** · 2026-05-03
>
> **Estado** · canónico · cualquier especificación futura sobre presentación de datos al usuario debe respetar este documento
>
> **Versión** · 1.0
>
> **Aplica a** · CC (specs) · Claude (chat) · cualquier instancia futura que diseñe UI · proponga reorganización · o redacte arquitectura

---

## 0 · Por qué existe este documento

Sesiones repetidas de trabajo han propuesto modelos conceptuales distintos para presentar al usuario los datos financieros de ATLAS. Capas de 2 · capas de 3 · "Presupuesto vs Mi Plan" · "Operativo vs Plan" · "Mensual vs Anual" · etc. Cada propuesta abre nuevas opciones · genera dispersión · y obliga a Jose a re-decidir lo mismo cada semana.

**Este documento cierra esa puerta.** ATLAS tiene · y tendrá · 4 páginas. Cada una con una pregunta clara que responde. Cualquier propuesta futura que rompa este modelo debe modificar este documento explícitamente · justificar el cambio · y ser aprobada por Jose.

No es opinión. Es la consolidación de la decisión tomada por Jose el 2026-05-03 tras varias sesiones de discusión.

---

## 1 · Las 4 páginas

ATLAS presenta los datos financieros del usuario en 4 páginas · cada una respondiendo una pregunta concreta · en un horizonte concreto · con una granularidad concreta.

### 1.1 · Tesorería

> **¿Voy a poder pagar las cosas? ¿Cuánto tengo en cada cuenta?**

- **Horizonte** · día a día · mes en curso · próximos 12-24 meses
- **Granularidad** · cargo bancario individual
- **Fuentes de datos** · `treasuryEvents` (previstos) + `movements` (reales)
- **Acción del usuario** · puntear · conciliar · subir extracto · importar
- **Pertenece a** · módulo Tesorería en sidebar

**Lo que muestra:**
- Calendario de cargos previstos por cuenta · día y mes
- Movimientos reales conciliados con previsiones
- Saldos por cuenta · saldo consolidado
- Vista mensual del calendario anual

**Lo que NO muestra:**
- Estimaciones agregadas anuales (eso es Proyección)
- Disciplina 50/30/20 (eso es Presupuesto)
- Trayectoria multi-año (eso es Trayectoria)

### 1.2 · Personal > Presupuesto

> **¿Distribuyo bien mis ingresos del hogar este mes?**

- **Horizonte** · mes en curso (con histórico de meses cerrados)
- **Granularidad** · 3 categorías macro del método elegido (50/30/20 · zero-base · etc.)
- **Fuentes de datos** · ingresos del hogar (mes actual) + gastos clasificados (mes actual) leídos de `movements`
- **Acción del usuario** · ver cumplimiento · ajustar regla del método elegido
- **Pertenece a** · módulo Personal · tab Presupuesto

**Lo que muestra:**
- Ingresos del hogar mes en curso
- Distribución real vs meta del método (Necesidades · Deseos · Ahorro)
- Cumplimiento %

**Lo que NO muestra:**
- Caja mes a mes del año (eso es Proyección)
- Cargos individuales (eso es Tesorería)
- Patrimonio futuro (eso es Trayectoria)

**Por qué vive en Personal y no en Mi Plan:** la disciplina mensual del hogar es operativa personal · no estratégica. El usuario consulta esto cada mes · no cada año.

### 1.3 · Mi Plan > Proyección

> **¿Cómo va mi caja este año? ¿Tengo meses positivos o negativos?**

- **Horizonte** · año fiscal en curso · 12 meses
- **Granularidad** · mes · entradas · salidas · flujo neto
- **Fuentes de datos** · `treasuryEvents` (previstos del año) + `movements` (reales del año) agregados por mes
- **Acción del usuario** · ver liquidez anual · identificar meses problemáticos · planificar reservas
- **Pertenece a** · módulo Mi Plan · tab Proyección

**Lo que muestra:**
- Tabla mes a mes del año · entradas · salidas · flujo neto
- Meses con superávit · meses con déficit
- Total anual entradas · salidas · balance
- Mes más positivo · mes más negativo

**Lo que NO muestra:**
- Cargos individuales (eso es Tesorería)
- Disciplina 50/30/20 (eso es Presupuesto)
- Años futuros (eso es Trayectoria)

**Por qué vive en Mi Plan y no en Tesorería:** Tesorería es operativa diaria · cargo a cargo. Proyección es estratégica anual · pregunta sobre el año completo.

### 1.4 · Mi Plan > Trayectoria (antes "Libertad financiera")

> **¿Dónde voy a estar en 5 · 10 · 25 años? ¿Qué patrimonio tendré a los 65? ¿Cómo acelero · maximizo · reduzco?**

- **Horizonte** · desde hoy hasta 25-30 años
- **Granularidad** · año · varios indicadores patrimoniales agregados
- **Fuentes de datos** · función pura `proyectarTrayectoria` que combina · ingresos pasivos actuales · gastos vida · hitos del escenario · supuestos macro
- **Acción del usuario** · simular escenarios · ajustar supuestos · comparar trayectorias
- **Pertenece a** · módulo Mi Plan · tab Trayectoria

**Lo que muestra:**
- Curva de patrimonio neto año a año
- Hito · año libertad financiera (cruce renta pasiva ≥ gastos vida)
- Hito · patrimonio proyectado a 65 años
- Hito · año en que cada préstamo se amortiza
- Simulador con sliders · qué pasa si compras X · qué pasa si reduces gastos Y%

**Lo que NO muestra:**
- Detalle del año en curso (eso es Proyección)
- Cargos individuales (eso es Tesorería)
- Disciplina mensual (eso es Presupuesto)

**Importante · cambio de alcance:**
La tab que hoy se llama "Libertad financiera" se reposiciona como **Trayectoria patrimonial**. Razón · el usuario que ya alcanzó libertad sigue usando ATLAS porque quiere planificar patrimonio a 65 · acelerar amortizaciones · simular compras · etc. Libertad es UN hito · no el único.

---

## 2 · La capa subyacente · una sola fuente de verdad

Las 4 páginas anteriores son **vistas distintas de la misma realidad subyacente**. Esa realidad subyacente NO se duplica · NO se reescribe · vive una sola vez en stores de IndexedDB ya existentes.

### 2.1 · Stores que alimentan las 4 páginas

| Tipo de dato | Store(s) | Páginas que lo consumen |
|---|---|---|
| Eventos previstos (cargos futuros) | `treasuryEvents` con `status='predicted'` | Tesorería · Proyección |
| Movements reales conciliados | `movements` + `treasuryEvents` con `status='executed'` | Tesorería · Proyección · Presupuesto · Trayectoria (agregados) |
| Ingresos del hogar (nóminas · etc) | `ingresos` | Presupuesto · Trayectoria · genera previstos en `treasuryEvents` |
| Contratos alquiler | `contracts` | Tesorería · Proyección · Trayectoria · genera previstos |
| Préstamos | `prestamos` (con `planPagos` embebido) | Tesorería · Proyección · Trayectoria · genera cuotas previstas |
| Vivienda habitual | `viviendaHabitual` | Tesorería · Proyección · Presupuesto · genera previstos |
| Compromisos recurrentes | `compromisosRecurrentes` | Tesorería · Proyección · Presupuesto · genera previstos |
| Inmuebles · gastos de inmueble | `properties` · `gastosInmueble` · `mejorasInmueble` · `mueblesInmueble` | Trayectoria (rentabilidad) |
| Inversiones | `inversiones` | Trayectoria · Tesorería (cuando se registra cobro) |
| Planes pensiones | `planesPensiones` · `aportacionesPlan` | Trayectoria · Tesorería (cuando se aporta) |
| Configuración escenario | `escenarios` (singleton) | Trayectoria |
| Datos personales · CCAA · descendientes | `personalData` | Fiscal (no es página · es módulo aparte) |
| Configuración libertad parametrizable | `escenarios.libertadConfig` | Trayectoria (ver ADR `docs/ADR-libertad-financiera-parametrizable.md`) |

### 2.2 · Regla de oro · cero duplicación

Cada dato vive en UN solo store. Las 4 páginas LEEN del mismo dato · cada una procesándolo a su manera. Si una página necesita una agregación · la calcula al vuelo · NO escribe un nuevo store con datos pre-procesados.

**Excepciones permitidas (cache derivado):**
- KPIs cacheados en el documento del activo (ej · `prestamo.principalVivo` · `prestamo.cuotasPagadas`) · siempre derivables de los stores fuente · cache es solo proyección de función pura. Ver `docs/ARQUITECTURA-financiacion.md` §5.2.

---

## 3 · Las preguntas operativas que el usuario hace · y dónde responderlas

| Pregunta del usuario | Página correcta |
|---|---|
| "¿Tengo dinero para la cuota del 31?" | Tesorería |
| "¿Cuánto hay en Sabadell hoy?" | Tesorería |
| "¿Por qué este mes me he pasado en Deseos?" | Personal > Presupuesto |
| "¿Llego a fin de mes con holgura?" | Personal > Presupuesto |
| "¿Cómo va el año en flujo de caja?" | Mi Plan > Proyección |
| "¿En qué mes voy a tener menos margen?" | Mi Plan > Proyección |
| "¿Cuándo llegaré a libertad financiera?" | Mi Plan > Trayectoria |
| "¿Qué patrimonio tendré a los 65?" | Mi Plan > Trayectoria |
| "¿Qué pasa si compro 2 inmuebles más?" | Mi Plan > Trayectoria |
| "¿Cómo acelero la amortización de mis préstamos?" | Mi Plan > Trayectoria (con vínculo a Financiación · Snowball) |

Si una pregunta no encaja en ninguna de las 4 · NO se inventa una nueva página · se decide en cuál de las 4 cabe mejor · se actualiza este documento · y se procede.

---

## 4 · Anti-patrones · prohibidos en specs y código futuro

Lista cerrada. Si una propuesta cae en cualquiera · se rechaza sin discusión.

| Anti-patrón | Por qué |
|---|---|
| Crear "Mi Plan > Presupuesto" como página nueva | Presupuesto es del hogar · vive en Personal · no se duplica |
| Crear "Tesorería > Proyección anual" | Esa pregunta vive en Mi Plan > Proyección |
| Fusionar Presupuesto y Proyección | Responden preguntas distintas · disciplina vs liquidez |
| Renombrar "Trayectoria" como "Libertad" reduciendo el alcance | Trayectoria cubre patrimonio · 65 años · "qué pasa si" · no solo libertad |
| Crear store nuevo "presupuestoCalculado" con datos pre-agregados | Las 4 páginas leen y agregan al vuelo · no se cachean agregados |
| Mostrar cargos individuales en Mi Plan > Proyección | Los cargos viven en Tesorería · Proyección los agrega por mes |
| Crear "Mi Plan > Mes en curso" como copia de Personal > Presupuesto | Disciplina mensual ya tiene su sitio |
| Inventar capa intermedia "Plan operativo" entre Tesorería y Mi Plan | Las 4 páginas son la única estructura |
| Proponer "Mi Plan > Patrimonio" como página separada de Trayectoria | Patrimonio es métrica de Trayectoria · no página aparte |

---

## 5 · Procedimiento si surge una pregunta nueva

Si una nueva propuesta plantea una pregunta del usuario que las 4 páginas no responden bien · NO improvisar.

1. CC (o Claude chat) describe la pregunta nueva
2. Argumenta por qué no encaja en ninguna de las 4 páginas actuales
3. Plantea a Jose una de 3 opciones · (a) extender una de las 4 páginas · (b) modificar este documento añadiendo página 5 con justificación · (c) descartar la pregunta como fuera de alcance
4. Solo tras decisión de Jose · se actualiza este documento y se procede

Modificaciones a este documento son **mayores** · requieren commit explícito a `docs/MODELO-4-PAGINAS-atlas.md` con justificación en cuerpo del PR.

---

## 6 · Estado actual · qué falta

Inventario de gaps al 2026-05-03 · trabajo pendiente para que las 4 páginas funcionen plenamente:

| Página | Estado actual | Gaps |
|---|---|---|
| Tesorería | UI construida · `treasuryEvents` vacío en producción | Generadores desconectados de wizards · auditoría TreasuryGen-pre en curso · pendiente cablear |
| Personal > Presupuesto | UI 50/30/20 funcional | Le faltan datos de gastos categorizados · depende de Tesorería · zero-base no implementado · entidad `presupuestoPersonal` no materializada |
| Mi Plan > Proyección | UI construida · 0€ en todo | Le faltan datos · depende de Tesorería |
| Mi Plan > Trayectoria | UI placeholder "Sin escenario configurado" | Función pura `proyectarLibertadDesdeRepo` existe (T27.4.1) · escenario singleton sin inicializar · alcance limitado a libertad · necesita extensión a patrimonio 65 · simulador no implementado (T27.4.3 pendiente) |

**Bloqueador raíz · `treasuryEvents` está vacío.** Sin esto · las 4 páginas son teatro. La auditoría TreasuryGen-pre está investigando por qué · y propondrá fix concreto.

---

## 7 · Decisiones cerradas que este documento consolida

Histórico de decisiones consolidadas aquí:

- "ATLAS tiene 4 páginas · no 3 capas · no 2 capas · no N módulos paralelos" · cerrada por Jose 2026-05-03
- "Personal > Presupuesto vive en Personal · no se mueve a Mi Plan" · cerrada
- "Mi Plan > Libertad pasa a llamarse Trayectoria · alcance ampliado a patrimonio 65 · simuladores · no solo cruce libertad" · cerrada
- "Las 4 páginas leen de la misma capa subyacente · cero duplicación de datos" · cerrada
- "El bloqueador actual es Tesorería vacía · todo lo demás depende de eso" · diagnóstico cerrado

---

## 8 · Documentos canónicos relacionados

- `docs/ARQUITECTURA-financiacion.md` · módulo Financiación · vías de entrada · matching · cache derivado
- `docs/ADR-libertad-financiera-parametrizable.md` · regla universal de parametrización · STANDARD + Ajustes
- `docs/AUDIT-flujos-ingresos-gastos-financiacion-2026-05-02.md` · mapa exhaustivo de flujos
- `docs/AUDIT-treasury-generators-2026-05-02.md` · diagnóstico de por qué `treasuryEvents` está vacío (cuando esté mergeado)
- `docs/AUDIT-personal-2026-05-02.md` · estado módulo Personal
- `docs/AUDIT-mi-plan-landing-libertad-2026-05-02.md` · estado Mi Plan landing y Libertad

Cualquier sesión futura sobre presentación de datos al usuario empieza leyendo este documento · más los relacionados según el módulo que toque.

---

**Fin documento canónico · v1.0 · 2026-05-03 · 4 páginas · cero ambigüedad · referencia obligatoria.**
