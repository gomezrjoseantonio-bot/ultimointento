# TAREA AUDITORÍA · Flujos-pre · Mapa exhaustivo Tesorería · Movimientos · Confirmación · escritura en stores

> **Tipo** · auditoría de lectura exhaustiva · 1 PR único con 1 archivo markdown · NO modificar código · NO crear features · NO proponer arquitectura
>
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama `main`
>
> **Predecesor** · todas las tareas previas mergeadas (T26 · T27.1 · T27.2-skip · T27.3 · T27.4.1 · T27.4.2 · T28.1 · T29 · T30) o en producción · DB_VERSION 65/66/67 estable
>
> **Tiempo estimado** · 3-4h CC · 1-2h revisión Jose
>
> **Output** · 1 PR contra `main` con archivo `docs/AUDIT-flujos-ingresos-gastos-financiacion-2026-05-02.md`
>
> **Regla absoluta** · NO modificar código · NO abrir issues · NO proponer arquitectura · NO sugerir refactor · solo REPORTAR exhaustivamente lo que el código hace HOY

---

## 0 · Contexto · por qué esta auditoría

Tras varias sesiones de trabajo · síntomas reportados por Jose en producción:

- Mi Plan landing muestra "0 € · añade nóminas" cuando hay datos en `personalData`
- "Cobertura 115% · mayo 2026" sin sentido matemático con `gastosVida` desconocido
- `budgetProjection.ts:290` lanza `NotFoundError · One of the specified object stores was not found`
- Store `escenarios` con 0 registros · función `proyectarLibertadDesdeRepo` opera sobre defaults
- Página Personal carga ingresos vacíos pese a haber datos en `ingresos` (T30.1 pendiente)

Causa profunda · **NO está claro · cuándo · adónde · y con qué criterio · ATLAS escribe la información de ingresos · gastos · financiación**. Hay múltiples documentos de arquitectura dispersos · cada uno cubriendo un módulo · con contradicciones aparentes y huecos no documentados.

**Antes de proponer cualquier arquitectura unificadora · necesitamos el mapa real de lo que el código hace HOY.**

Esta auditoría es ese mapa. Es exhaustiva · es larga · pero **es prerequisito para cualquier decisión arquitectónica futura**. Cero specs · cero refactor · cero opinión · solo el qué pasa hoy.

---

## 1 · Reglas inviolables

1. **NO modificar código** · solo lectura
2. **NO crear features** · solo documentar
3. **NO proponer arquitectura** · documentar la existente · aunque sea inconsistente
4. **NO opinar sobre si el código está bien o mal** · solo describirlo
5. **Reportar exhaustivamente · no resumir** · si una sección requiere 5 párrafos para describirse · 5 párrafos
6. **Si no localizas algo · escribir explícitamente "no localizado"** · NO inferir · NO suponer
7. **Si encuentras 2 servicios que parecen hacer lo mismo · listar AMBOS** · señalar que son duplicados · NO recomendar cuál usar
8. **Si encuentras un hook implementado pero no invocado** · listarlo como zombie · NO arreglar
9. **Si encuentras error en consola en una vista · documentar · NO arreglar**

---

## 2 · Sección 1 · Qué es Tesorería en código

### 2.1 · Stores · servicios · tipos

```bash
# Store treasuryEvents
grep -n "treasuryEvents" src/services/db.ts | head -10
grep -n "interface TreasuryEvent\|type TreasuryEvent" src/types/ -r | head -10

# Servicio principal
ls src/services/ | grep -iE "(treasury|tesoreria)"
ls src/modules/horizon/tesoreria/services/ 2>/dev/null
ls src/modules/tesoreria/services/ 2>/dev/null
```

CC reporta:

- Path completo de `treasuryEvents` en `db.ts` · línea · keyPath · indices
- Path del tipo `TreasuryEvent` · transcribir interface completo
- Lista de TODOS los servicios que escriben en `treasuryEvents` (puede haber varios)
- Lista de TODOS los servicios que leen de `treasuryEvents`

### 2.2 · Estados de un evento

CC localiza el campo `status` del `TreasuryEvent` y reporta:

- Valores posibles (ej · `predicted` · `confirmed` · `executed` · `cancelled` · ...)
- Diagrama textual de transiciones · qué función transiciona cada estado · path · línea
- ¿Qué función llama qué función para cambiar el estado? · cadena completa

### 2.3 · Campos del evento

CC transcribe **TODOS los campos** de `TreasuryEvent` con sus comentarios JSDoc si los tienen. Especial atención a:

- `sourceType` · qué valores posibles · qué significa cada uno
- `sourceId` · cómo se vincula al origen
- `cuentaId` · cuenta bancaria
- `prestamoId` · `numeroCuota` · si existen
- `gastoInmuebleId` · `contractId` · si existen
- Cualquier campo de vinculación a otra entidad

---

## 3 · Sección 2 · Qué son Movimientos en código

### 3.1 · Stores · servicios · tipos

```bash
# Store movements
grep -n "'movements'" src/services/db.ts | head -10
grep -n "interface Movement\|type Movement\|interface Movimiento" src/types/ -r | head -10

# Servicio
ls src/services/ | grep -iE "(movement|movimiento)"
```

CC reporta · igual que §2 · stores · servicios · tipo completo · campos.

### 3.2 · Cómo entran movements al sistema

CC busca exhaustivamente todos los puntos del código que **crean** un `Movement`:

```bash
grep -rn "db.add('movements'\|db.put('movements'" src/ | head -30
grep -rn "createMovement\|insertMovement\|registerMovement" src/services/ | head -20
```

Para cada punto encontrado · CC reporta:

- Path · función
- Trigger · qué lo dispara (importación CSV · OCR · cobro manual · conciliación · webhook · onboarding · etc)
- Datos que escribe (qué campos pobla)
- ¿Crea también `treasuryEvent` asociado? · si sí · cuál es el orden

### 3.3 · Cómo se vincula un movement a un evento

CC busca el patrón de matching/conciliación:

```bash
grep -rn "movimientoTesoreriaId\|matchMovement\|reconcileMovement\|conciliar" src/ | head -20
grep -rn "buscarCandidatos\|conciliacion" src/ | head -20
```

CC reporta:

- Función que matchea movement con treasuryEvent (`buscarCandidatosConciliacion` u otra)
- Score · tolerancias · ventanas temporales
- Punto donde se confirma el match · qué stores se actualizan
- ¿Es bidireccional? · si llega movement nuevo · busca evento · si llega evento nuevo · busca movement
- ¿Existe queue de huérfanos · o se descartan?

---

## 4 · Sección 3 · Confirmación · qué pasa exactamente

### 4.1 · `confirmTreasuryEvent` · función central

```bash
# Localizar función
find src -name "treasuryConfirmation*"
grep -n "confirmTreasuryEvent\|confirmEvent" src/services/ -r | head -10

# Leer la función entera
sed -n '1,50p' src/services/treasuryConfirmationService.ts
sed -n '280,540p' src/services/treasuryConfirmationService.ts
```

CC reporta · **paso a paso · línea por línea · qué hace `confirmTreasuryEvent`** desde que se invoca hasta que retorna:

1. Validaciones que hace
2. Carga de datos
3. Transición de estado
4. **TODOS los stores que escribe** (treasuryEvents · movements · gastosInmueble · ingresos · aportacionesPlan · prestamos.planPagos · contracts · cualquier otro)
5. **TODOS los hooks/servicios que invoca** (dynamic imports · llamadas directas)
6. Manejo de errores
7. Idempotencia

Si el código tiene un switch/if por `sourceType` · CC documenta CADA rama · qué hace para nómina · para cuota préstamo · para gasto inmueble · para venta inmueble · etc.

### 4.2 · Hooks invocados al confirmar

CC reporta:

- ¿`procesarConfirmacionEvento` (nominaAportacionHook) se invoca? · sí/no · si no · marcar como zombie
- ¿`finalizePropertySaleLoanCancellationFromTreasuryEvent` se invoca? · sí/no
- ¿Hay otros hooks que deberían invocarse y no se hace?
- Cualquier dynamic import en la función de confirmación

### 4.3 · Idempotencia

CC reporta:

- Si confirmas el mismo evento 2 veces · qué pasa
- ¿Hay deduplicación?
- ¿Hay verificación de "ya confirmado"?

---

## 5 · Sección 4 · Catálogo exhaustivo · flujos de INGRESO

Para cada flujo de ingreso identificado · CC documenta:

| Campo | Qué reportar |
|---|---|
| Trigger UI | Qué pantalla / wizard / acción dispara la entrada |
| Servicio orquestador | Path · función |
| Stores escritos | Lista exhaustiva con orden · `treasuryEvents` con qué `sourceType` · `movements` cuándo · `ingresos` con qué `tipo` · etc |
| Generación recurrencia | Si genera proyección a futuro · qué función · qué horizonte · qué patrón |
| Confirmación | Cómo se marca real · qué dispara |
| Cruce con Tesorería | Si entra al calendario · cuándo · con qué `sourceType` |
| Estado actual | ✅ funcional · 🟡 parcial · 🟠 roto · ❌ no implementado |

CC cubre los siguientes flujos · **uno por uno · sin abreviar**:

### 5.1 · Nómina propia (titular)

### 5.2 · Nómina pareja (co-titular si activado)

### 5.3 · Autónomo propio (titular)

### 5.4 · Autónomo pareja

### 5.5 · Pensión propia · pensión pareja

### 5.6 · Otros ingresos personales (becas · premios · indemnizaciones · etc · NO alquiler · NO dividendos)

### 5.7 · Cobro de alquiler · contrato larga estancia (vivienda completa)

### 5.8 · Cobro de alquiler · contrato larga estancia (por habitaciones)

### 5.9 · Cobro de alquiler · contrato temporada (vivienda completa)

### 5.10 · Cobro de alquiler · contrato turístico

### 5.11 · Cobro de alquiler · contrato local comercial

### 5.12 · Cobro de alquiler · parking · trastero (post-T29)

### 5.13 · Dividendos / cupones de inversiones

CC presta atención especial a este flujo. Jose declara que tiene ~1000 €/mes que vienen de aquí. CC reporta:

- ¿Hay módulo Inversiones funcional? · path
- ¿Hay tipo `Inversion` · `Posicion` · `Dividendo` · `Cupon`?
- ¿Hay generación de eventos previstos en Tesorería para dividendos esperados?
- ¿Hay confirmación cuando llega el cargo bancario?
- Si NO hay nada · documentar · es un hueco grande

### 5.14 · Venta de inversión (capital ganancia/pérdida) · si existe

### 5.15 · Ingresos extraordinarios puntuales (devolución hacienda · regalo · indemnización inesperada)

### 5.16 · Venta de inmueble (cuando aplique) · ingreso por venta

---

## 6 · Sección 5 · Catálogo exhaustivo · flujos de GASTO

Misma plantilla por flujo:

### 6.1 · Cuota préstamo (interés + capital) cobrada por banco

### 6.2 · Amortización anticipada préstamo (parcial)

### 6.3 · Liquidación total de préstamo

### 6.4 · IBI inmueble

### 6.5 · Comunidad inmueble

### 6.6 · Seguro hogar inmueble

### 6.7 · Tasa basuras inmueble · tributos locales

### 6.8 · Gasto suministro inmueble (luz · agua · gas) si lo paga el propietario

### 6.9 · Gasto reparación / mantenimiento inmueble (operativo · NO mejora)

### 6.10 · Mejora · reforma capitalizable inmueble (CAPEX · amortizable)

### 6.11 · Mobiliario inmueble (amortizable · separado de mejoras)

### 6.12 · Comisión gestión inmueble · honorarios · publicidad

### 6.13 · Gasto financiero inmueble (intereses) · imputación deducible

### 6.14 · Gasto vivienda habitual del titular · alquiler propio · cuota hipoteca propia · IBI · suministros (NO inmueble inversión)

### 6.15 · Gastos personales recurrentes (suscripciones · seguros vida · gimnasio · móvil · etc)

### 6.16 · Gastos personales puntuales (compras · ocio · viaje · etc)

### 6.17 · Aportación propia a plan de pensiones (no de empresa)

### 6.18 · Compra de inversión (capital aportado · NO gasto deducible · pero sale dinero)

---

## 7 · Sección 6 · Catálogo exhaustivo · flujos de FINANCIACIÓN

### 7.1 · Alta de préstamo nuevo · vía wizard manual

### 7.2 · Alta de préstamo nuevo · vía importación FEIN

### 7.3 · Alta de préstamo nuevo · vía importación masiva onboarding

### 7.4 · Cobro de cuota mensual · matching automático con movement

### 7.5 · Cobro de cuota mensual · sin matching · manual marcado pagado

### 7.6 · Amortización extraordinaria · regeneración del cuadro

### 7.7 · Liquidación total · cierre del préstamo · venta inmueble

### 7.8 · Cambio de tipo de interés (revisión variable)

### 7.9 · Modificación parámetros préstamo (refinanciación · novación)

Para cada uno · CC documenta el detalle del §5 plantilla.

---

## 8 · Sección 7 · Mapa de servicios duplicados · contradicciones · huecos

### 8.1 · Servicios duplicados

CC busca en el repo casos donde 2+ servicios hacen lo mismo:

```bash
# Ejemplo · 2 generadores de eventos
grep -rn "generateMonthlyForecasts\|generarEventos\|expandir" src/services/ | head -30

# Cálculo de cashflow / proyección
grep -rn "computeBudget\|calcularCashflow\|proyectarCaja" src/services/ | head -20
```

CC reporta lista exhaustiva · path · función · qué hace · si hay solapamiento.

### 8.2 · Hooks zombie · implementados pero no invocados

CC busca funciones exportadas en `src/services/` que NO tienen consumidores · usando `grep -rn` sobre el nombre de la función. Lista todos los hits sin consumidores externos.

### 8.3 · Stores referenciados por código pero eliminados de la DB

CC busca todos los `db.getAll('xxx')` · `db.add('xxx')` · `db.put('xxx')` · `db.transaction(['xxx'])` y verifica que cada `'xxx'` exista hoy en `db.ts`. Lista los que NO existen.

```bash
# Patrón candidato a generar bugs como T30.1
grep -rn "db.getAll('\|db.add('\|db.put('\|db.transaction(\[" src/ | grep -oE "'[a-zA-Z]+'" | sort -u
# Cruzar con stores reales declarados
grep -nE "store.createObjectStore\|createObjectStore(" src/services/db.ts
```

CC reporta:

- Lista de stores referenciados por código
- Lista de stores reales en `db.ts` actualmente
- Diferencia · stores referenciados que NO existen → bugs garantizados

### 8.4 · Errores en consola en vistas reales

CC NO ejecuta la app · pero busca código que claramente puede lanzar error:

- `db.getAll('store_eliminado')` · ya cubierto en 8.3
- Servicios con `try/catch` que silencian errores
- Hooks que retornan datos vacíos cuando hay error

### 8.5 · `budgetProjection` específico · qué hace · qué stores lee

CC abre `src/services/budgetProjection.ts` y lee 270-300 (línea del error reportado por Jose) · documenta:

- Qué stores intenta abrir en transacción
- Cuáles existen · cuáles no
- Quién lo invoca
- Qué UI consume el resultado

---

## 9 · Sección 8 · Cruce módulo Inversiones

CC dedica una sección completa a Inversiones · porque es el módulo menos cubierto en auditorías previas y Jose declara flujo regular de ~1000 €/mes:

```bash
find src -path "*inversion*" -o -path "*inversiones*" | head -20
ls src/modules/inversiones/ 2>/dev/null
ls src/modules/horizon/inversiones/ 2>/dev/null
grep -n "inversiones\|posiciones\|dividendos\|cupones" src/services/db.ts | head -10
```

CC reporta:

- Stores existentes
- Tipos
- Servicios
- UI (páginas · componentes)
- Cómo se introduce una posición nueva
- Cómo se registra un dividendo / cupón
- Cómo se vincula con Tesorería · si lo hace
- Cómo se vincula con la fecha en que el cargo aparece en `movements`
- Estado real · ✅ / 🟡 / 🟠 / ❌ (con paths de evidencia)

---

## 10 · Sección 9 · Cruce módulo Personal · "vivienda habitual"

`viviendaHabitual` genera eventos directos en treasuryEvents según auditoría Personal §1.2 regla C. CC verifica:

- Función `generarEventosVivienda()` · path
- Casos cubiertos · `inquilino` · `propietarioSinHipoteca` · `propietarioConHipoteca`
- Qué eventos genera para cada caso (pago alquiler · cuota hipoteca · IBI · seguro · suministros)
- Cómo se confirman cuando llega el cargo
- Si genera también escritura en `gastosInmueble` (NO debería · porque es vivienda habitual · NO inmueble de inversión)

---

## 11 · Sección 10 · Cruce módulo Inmuebles · operativa de gastos e ingresos

CC verifica:

- Cómo se introduce un gasto recurrente de un inmueble (IBI · comunidad · seguro · suministro)
- Cómo genera proyección futura
- Cómo confirma cargo real
- Cómo escribe en `gastosInmueble`
- Diferencia entre `compromisosRecurrentes` con `ambito='inmueble'` y registros directos en `gastosInmueble`
- Cuándo cada uno · con qué criterio

---

## 12 · Sección 11 · Pareja co-titular · si está activada

Auditoría Personal §3 menciona "Pareja co-titular · solo si hay pareja con la que se comparte hogar". CC verifica:

- Si hoy en código está implementado o no
- Si los ingresos de la pareja se suman al hogar
- Si los gastos compartidos se prorratean
- Cómo se distinguen "ingresos titular" vs "ingresos pareja" en `ingresos`
- Cómo se distinguen "gastos titular" vs "gastos pareja"
- Si hay flag `titular: 'principal' | 'pareja'` o similar

---

## 13 · Sección 12 · Hallazgos generales

CC lista al final hallazgos transversales que no encajan en secciones anteriores:

- Servicios huérfanos (sin consumidores)
- Datos en stores sin lógica de mantenimiento (huérfanos)
- TODOs · FIXMEs · comentarios `@deprecated`
- Inconsistencias entre tipos y datos reales
- Cualquier patrón sospechoso

---

## 14 · Output · estructura del archivo

CC crea `docs/AUDIT-flujos-ingresos-gastos-financiacion-2026-05-02.md`:

```markdown
# AUDITORÍA · Flujos exhaustivos · Tesorería · Movimientos · Confirmación · escritura en stores

> Fecha · 2026-05-02
> Repo · main · DB_VERSION 65/66/67
> NO modifica código · solo lectura · 1 archivo · 1 PR

## 0 · Contexto y motivación
(copiar §0 del spec)

## 1 · Tesorería · qué es en código
(rellenar §2)

## 2 · Movimientos · qué son
(rellenar §3)

## 3 · Confirmación · paso a paso
(rellenar §4)

## 4 · Catálogo INGRESOS (16 sub-flujos)
(rellenar §5 · uno por uno)

## 5 · Catálogo GASTOS (18 sub-flujos)
(rellenar §6)

## 6 · Catálogo FINANCIACIÓN (9 sub-flujos)
(rellenar §7)

## 7 · Servicios duplicados · zombies · stores fantasma
(rellenar §8)

## 8 · Inversiones · auditoría dedicada
(rellenar §9)

## 9 · Vivienda habitual personal
(rellenar §10)

## 10 · Inmuebles · operativa
(rellenar §11)

## 11 · Pareja co-titular
(rellenar §12)

## 12 · Hallazgos generales
(rellenar §13)

---

## Resumen ejecutivo (al final · NO al inicio)

CC escribe AL FINAL · tras todo el detalle · un resumen ejecutivo de máximo 30 líneas que responda:

1. ¿Hay arquitectura coherente o son varios sistemas paralelos?
2. ¿Cuántos flujos están cableados end-to-end · cuántos parcial · cuántos rotos?
3. ¿Cuáles son los 5 problemas más graves de cara a confiabilidad?
4. ¿Dónde están los huecos más grandes (flujos sin implementar)?
5. ¿Hay algún módulo que parezca estar "vivo y muerto" a la vez?

Generated by Claude Code (auditoría Flujos-pre · 2026-05-02)
```

---

## 15 · PR

**Rama** · `claude/audit-flujos-2026-05-02`

**Título PR** · `docs(audit): mapa exhaustivo flujos ingresos · gastos · financiación · Tesorería · escritura en stores · 2026-05-02`

**Body PR**:

```
## Resumen

Auditoría exhaustiva de TODOS los flujos de ingreso · gasto · financiación. Documenta · paso a paso · qué stores escribe ATLAS cuando ocurre cada tipo de evento · cuándo · con qué criterio. Incluye Inversiones (1000€/mes regulares según Jose).

Pre-arquitectura unificadora · objetivo · tener mapa real antes de redactar el documento canónico que sustituye los 1000 docs dispersos.

**Hallazgos clave** (CC rellena 8-12 líneas con hallazgos)

## NO toca código

Solo añade `docs/AUDIT-flujos-ingresos-gastos-financiacion-2026-05-02.md` · NO modifica fuentes · NO mergear sin que Jose lea.

## Test plan
- [ ] Jose lee el archivo entero
- [ ] Jose marca contradicciones · huecos · cosas que no cuadran
- [ ] A partir del audit · sesión Claude redacta arquitectura única canónica

**STOP** · solo lectura · 1 PR.
Generated by Claude Code
```

**NO mergear.** Esperar Jose.

---

## 16 · Si CC encuentra contradicción

- 2 servicios que hacen lo mismo → reportar AMBOS · no recomendar
- Hook implementado sin invocar → marcar zombie · NO arreglar
- Store referenciado pero eliminado → listar como bug pendiente · NO arreglar
- Función con error garantizado → documentar · NO arreglar
- Algo que parece bug pero CC no está seguro → describir comportamiento · marcar "comportamiento extraño · pendiente confirmar"

NO inferir · NO suponer. Si no localiza algo · escribir explícitamente "no localizado".

---

## 17 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- DB_VERSION 65/66/67 · estable
- Auditorías previas como referencia (NO sustituyen esta · son parciales):
  - `docs/AUDIT-mi-plan-landing-libertad-2026-05-02.md`
  - `docs/AUDIT-personal-2026-05-02.md`
  - `docs/AUDIT-39-stores-V60.md`
  - `docs/AUDIT-financiacion-cuotas-2026-05-02.md` (si existe)
- Documentos de arquitectura existentes (NO LEER COMO VERDAD · solo como referencia · esta auditoría debe partir del CÓDIGO):
  - `docs/ARQUITECTURA-financiacion.md`
  - `docs/ADR-libertad-financiera-parametrizable.md`
  - `docs/audit-inputs/ATLAS-Personal-modelo-datos-v1.md`
- HANDOFF V8 · contexto

---

## 18 · Resumen ejecutivo del spec

> Audita exhaustivamente · sin tocar código · qué hace ATLAS HOY cuando ocurre un ingreso · gasto o financiación. Catálogo de 16 ingresos · 18 gastos · 9 flujos financiación · cada uno con su mapa de stores escritos. Incluye Inversiones (1000€/mes regulares). Mapa de servicios duplicados · zombies · stores fantasma. Inversiones · vivienda habitual · pareja · todo cubierto. Output · 1 archivo markdown grande. Tras leerlo · construimos arquitectura única que sustituye toda la dispersión documental. NO arregles nada · NO propongas nada · solo describe lo que hay. 1 PR · 3-4h CC · stop al cierre.

---

**Fin spec auditoría Flujos-pre · 1 PR · 1 archivo · 3-4h CC · NO toca código.**
