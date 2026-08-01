# STOP-AND-REPORT · TESORERÍA V5 · Fase 0

**Fecha:** 1 agosto 2026
**Tarea:** `docs/TAREA-CC-TESORERIA-V5.md`
**Mockups:** `docs/mockups/atlas-tesoreria-v5-escritorio.html` · `docs/mockups/atlas-tesoreria-v5-movil.html`
**Estado:** ⛔ **PARADO** · no se ha escrito una línea de código de implementación, según §0.

La tarea ordena parar y reportar si algo contradice lo escrito. **Contradice en varios puntos
sustanciales.** Abajo, primero las respuestas A–E que pide la tabla, después las contradicciones
y las decisiones que necesito de Jose.

---

## Respuestas a la tabla A–E

### A · DB_VERSION actual · ¿hace falta bump?

`src/services/db.ts:55` → **`DB_VERSION = 83`** (la tarea avisaba de v75+; el mapa
`ATLAS-mapa-stores-VIGENTE.md` documenta v53 y está, en efecto, obsoleto). 44 stores físicos.

**Sí hace falta decisión sobre bump.** La tarea dice en §2 que esto *no debería* necesitarlo, pero
tres requisitos funcionales piden datos que hoy **no existen en el modelo**:

| Requisito | Dónde | Campo que falta |
|---|---|---|
| Drag & drop para reordenar tarjetas, **persistiendo el orden** | §4.2 | `Account` no tiene `orden` / `sortOrder` / `posicion` |
| **Color del punto** elegido por el usuario (paleta + "Sin color") | §4.8 | `Account` solo tiene `banco.brand.color` (color de marca, no elección del usuario) y `logo_url` |
| **Descartar un previsto** lo marca como descartado, *sin* borrarlo | §2 regla 5 | `TreasuryEvent.status` es `'predicted' \| 'confirmed' \| 'executed'` · no hay `descartado` |
| **Ignorar** una línea de extracto, reversible ("recuperar") | §4.7 | Sin campo ni store donde vive el "ignorado" entre sesiones |

Hay salida **sin bump** para los dos primeros: el store `keyval` sigue vivo y ya es el destino
canónico de config retirada de stores (`keyval['matchingConfig']`, `keyval['kpiConfig_*']`, ver
`db.ts:101` y `db.ts:108`). Orden de tarjetas y color de punto son preferencias de UI puras y
encajan ahí (`keyval['tesoreria.cuentas.orden']`, `keyval['tesoreria.cuentas.color']`).

Los dos últimos (**descartado** e **ignorado**) **no** son preferencia de UI: son estado de dominio
que debe sobrevivir y que el resto del sistema tiene que respetar (el motor de previsiones no puede
volver a proponer lo descartado). Aquí hay tres caminos y **no elijo yo**:

1. **Bump a v84** con campos opcionales en `TreasuryEvent` (`descartado?: boolean`,
   `descartadoAt?: string`, `motivoDescarte?: string`) — sin stores nuevos, sin migración de datos
   (mismo patrón que V79 y V83). Es lo más limpio y lo que menos deuda deja.
2. **Sin bump**, usando `deleteTreasuryEventCompletely()` (ya existe,
   `treasuryConfirmationService.ts:836`) — pero entonces "descartar" es **borrar**, y el "Deshacer"
   del toast que exige §4.10 deja de ser posible pasados unos segundos. Contradice §2 regla 5, que
   distingue explícitamente descartar de borrar.
3. **Sin bump**, marcando en `keyval` una lista de ids descartados — funciona, pero es un estado de
   dominio escondido en un saco de config, invisible para los servicios de previsión. Lo
   desaconsejo.

**Mi recomendación: opción 1 (bump v84, campos opcionales).** Pero §2 dice "no se bumpea salvo que
la fase 0 revele que falta un campo imprescindible — en ese caso, PARA y reporta antes". Es
exactamente este caso. **Decisión pendiente de Jose.**

### B · Interfaces reales vs. lo que pide el mockup

- **`Account`** → `src/services/db/types-contratos.ts:424`.
  Cubre bien §4.8: `tipo` incluye `'TARJETA_CREDITO'`, `cardConfig.{settlementDay, chargeAccountId}`,
  `limiteCredito`, `diaPago`, `ultimosCuatro`, `bancoEmisor`, y **`openingBalance` +
  `openingBalanceDate`** — que es literalmente el "saldo inicial + a fecha de" que pide la tarea.
  `balance` está documentado como **cache derivada, no fuente de verdad** (`types-contratos.ts:456-466`);
  la fuente es `openingBalance` + Σ `movements.amount`, y se recalcula con
  `accountBalanceService.recalculateBalance(accountId)`. El "saldo vivo" de §4.6 debe ir por ahí.
  **Faltan** orden y color de punto (ver A).

- **`Movement`** → `src/services/db/types-movimientos.ts:31`.
  Campo de conciliación único: **`unifiedStatus`** (`previsto|confirmado|vencido|no_planificado|conciliado`).
  `estado_conciliacion` fue **retirado en V81** — no volver a usarlo. Tiene `source`
  (`import|manual|inbox`), `categoryKey`, `subtypeKey`, `transferMetadata.{targetAccountId, pairEventId}`,
  `importBatch`, `ambito`, `inmuebleId`. Cubre §4.5 y §4.7 sin campos nuevos.

- **`TreasuryEvent`** → `src/services/db/types-movimientos.ts:188`.
  `status: 'predicted' | 'confirmed' | 'executed'`, `executedMovementId`, `categoryKey`, `subtypeKey`,
  `tipoFamilia`, `transferMetadata`, `isEsporadico`. **Falta solo el estado descartado** (ver A).

### C · Rutas actuales de tesorería

```
/tesoreria                      → modules/tesoreria/TesoreriaPage.tsx   (layout, 2 tabs)
  index                         → tabs/VistaGeneralTab.tsx
  /movimientos                  → tabs/MovimientosTab.tsx
/tesoreria/cuenta/:accountId    → pages/VistaCuentaPage.tsx
/tesoreria/importar             → modules/horizon/tesoreria/import/BankStatementUploadPage.tsx
/tesoreria/importar-cuentas     → modules/tesoreria/import/ImportarCuentas.tsx
/conciliacion                   → ConciliacionPage (v2, intacta por decisión §3.5 previa)
/configuracion/cuentas          → Navigate a /tesoreria  (App.tsx:1481 · ya no es pantalla propia)
/configuracion/bancos-cuentas   → Navigate a /tesoreria  (App.tsx:1376)
```

### D · Catálogo familia→concepto del alta de gasto del inmueble

**Vive en `src/modules/inmuebles/wizards/utils/tiposDeGastoInmueble.ts` →
`TIPOS_GASTO_INMUEBLE_V2`**, consumido por `ListadoGastosRecurrentes` desde
`src/modules/inmuebles/pages/DetallePage.tsx:462`. El gemelo personal es `TIPOS_GASTO_PERSONAL`
(`src/modules/personal/wizards/utils/tiposDeGastoPersonal.ts`), usado en
`modules/personal/pages/GastosPage.tsx:27`.

**El mockup lo copia casi literalmente.** `CATG` (línea 733 de
`docs/mockups/atlas-tesoreria-v5-escritorio.html`) coincide
concepto a concepto con `TIPOS_GASTO_INMUEBLE_V2` — p. ej. `'Tributos': ['IBI', 'Basuras y
alcantarillado', 'Licencia turística', 'Otros']` es exactamente el grupo `tributos` del fichero.
Confirmado: **ése es el catálogo único que hay que reutilizar**, no uno nuevo.

**Pero hay un segundo catálogo y ahí está el problema.** `src/services/categoryCatalog.ts` es el
"catálogo canónico de categorías de movimientos" y es **el que se persiste**: su `key` va a
`TreasuryEvent.categoryKey` / `Movement.categoryKey` / `GastoInmueble.categoryKey`. Su cabecera se
declara a sí mismo fuente única y prohíbe hardcodear listas en componentes.

O sea: **hay dos "fuentes únicas" y no son la misma.** Una manda en la UI de gastos del inmueble
(`TIPOS_GASTO_INMUEBLE_V2`, familia→concepto, la que el mockup dibuja), la otra manda en lo que se
guarda en DB (`categoryCatalog.ts`, `categoryKey`). La tarea dice "no dupliques el catálogo" pero no
dice cuál de los dos gana. Ver contradicción 5.

### E · ¿`treasuryEvents` = previsión y `movements` = confirmado?

**Sí, el modelo del 19/04/2026 sigue vigente**, y además se acaba de formalizar. Los **cinco últimos
commits de `main`** (#1499–#1503, "Punteo unificado · P1…P5") introdujeron el modelo canónico en
`src/services/punteo/punteoModel.ts`:

```
PREVISTO   = TreasuryEvent status 'predicted'
CONFIRMADO = TreasuryEvent 'confirmed' (legacy)  ∨  Movement con source ≠ 'import'
CONCILIADO = Movement con source === 'import'
real = confirmado ∨ conciliado
```

Servicios que ya implementan el ciclo completo, listos para reutilizar en §4.5/§4.6:
`confirmTreasuryEvent()` (:312) · `revertTreasuryConfirmation()` (:602) ·
`updateConfirmedMovement()` (:911) · `deleteTreasuryEventCompletely()` (:836) ·
`bulkConfirmTreasuryEvents()` (:1346), todos en `treasuryConfirmationService.ts`.
Traspasos: `treasuryTransferService.ts`. Saldo: `accountBalanceService.recalculateBalance()`.

**Ojo al matiz, que no es menor:** la tarea define `conciliado` como *"movement casado con línea de
extracto"*. El código lo deriva de `source === 'import'` — es decir, **cualquier** movimiento que
venga de un extracto es conciliado, esté o no casado con un previsto. Un cargo que aparece en el
extracto y no cuadra con nada nace `conciliado`, no "a resolver". Para §4.7 esto importa: lo que la
tarea llama "a resolver" no tiene reflejo en el modelo de estados actual.

---

## Contradicciones · §3 no describe este repositorio

**Ninguno de los componentes que §3 manda sustituir o absorber existe.** Verificado con grep sobre
todo `src/`:

| §3 dice | Realidad |
|---|---|
| `TesoreriaV4.tsx` → SUSTITUIR | **No existe.** Hoy: `modules/tesoreria/TesoreriaPage.tsx` + 2 tabs |
| `TreasuryReconciliationView.tsx` → ABSORBER | **No existe.** Solo aparece en un `.sh` muerto (`src/components/treasury/push-treasury-v3.sh`) |
| `NewMovementModal` → SUSTITUIR | **No existe.** Hoy: `AddMovementModal` (conciliación v2) y `MovimientoDrawer` (581 líneas) |
| `BancosManagement` → ABSORBER | **No existe** en `src/` (solo en un test). Hoy: `components/cuenta/CuentaWizard.tsx` (1118 líneas) |
| `ImportModal` / `BankStatementWizard` → reutilizar servicio | **No existen** |
| `bankStatementImportService` | **No existe.** Se llama `bankStatementOrchestrator.ts` (572 líneas) + `services/universalBankImporter/` |
| `BalancesBancariosView` | **No existe** (solo una mención en `BankStatementUploadPage`) |
| `RadarPanel` / `treasuryRecommendations` → NO TOCAR | Correcto: no existen / store eliminado en V62. Nada que tocar |

`matchingConfiguration` tampoco es store: se retiró en V63 → `keyval['matchingConfig']`.

Lo que la tarea describe corresponde a un estado del repo anterior a la refactorización T20. **No
puedo "sustituir TesoreriaV4" porque no hay TesoreriaV4.** Esto no bloquea el trabajo — el mapeo
real es evidente — pero sí obliga a reescribir §3 antes de dar la tarea por buena, porque el alcance
real no es el que está escrito.

### Las 6 contradicciones que necesitan decisión

**1 · Ya existe una "Tesorería v5" y no es ésta.**
`App.tsx:896` rotula la pantalla actual como *"T20 Fase 2 · Tesorería v5 (sustituye Tesoreria.tsx
legacy) · Mockup atlas-tesoreria-v8.html"* (en el repo: `docs/audit-inputs/atlas-tesoreria-v8.html`
y `docs/mockups/atlas-tesoreria-v8-completo.html`). La tarea nueva también se llama V5 y apunta a un
mockup distinto (`docs/mockups/atlas-tesoreria-v5-escritorio.html`). Dos cosas distintas con el
mismo nombre. Propongo llamar a ésta
**Tesorería V6** en código y comentarios, o renombrar la anterior, pero no dejar dos "v5".

**2 · La tarea manda rehacer trabajo que se mergeó hace cinco commits.**
Ésta es la contradicción seria. §3 dice "ABSORBER `TreasuryReconciliationView` — su función vive
ahora dentro del drawer de cuenta (pestañas Pendientes / Todo)". Eso es, casi palabra por palabra,
lo que hicieron los PR #1499–#1502 con `PunteoList`: P3a llevó la vista de cuenta a `PunteoList`,
P3b alineó Conciliación al lenguaje canónico, P4 el drawer del calendario, P5 el conciliado verde y
el check compartido. El modelo `previsto/confirmado/conciliado` que pide §2 **ya está implementado y
mergeado**.

Rehacer Tesorería desde el mockup sin partir de `PunteoList` tiraría ese trabajo y volvería a tener
dos lenguajes de punteo. Necesito saber si la V5 nueva debe **construirse sobre `PunteoList`**
(mi recomendación: la lista de "Pendientes" y "Todo {mes}" de §4.4 es exactamente lo que
`PunteoList` ya hace) o si Jose quiere sustituirlo también.

**3 · `conciliado` no se deriva como dice la tarea.**
La tarea: `conciliado` = casado con línea de extracto. El código: `source === 'import'`.
Consecuencia práctica en §4.7 — una línea del extracto que no cuadra con ningún previsto, si se
materializa como movimiento, nace ya `conciliado` y no "a resolver". O se cambia la derivación
(toca `punteoModel.ts`, recién mergeado, y las 4 vistas que cuelgan de él), o §4.7 acepta que "a
resolver" es un estado **de la sesión de importación**, no del movimiento. **Recomiendo lo segundo**
— no tocar el modelo recién cerrado — pero cambia el texto de §4.7.

**4 · `confirmado` reversible vs. `conciliado` no reversible.**
§2 y §4.4 lo exigen y **es implementable tal cual**: `revertTreasuryConfirmation()` ya existe. Pero
con la derivación actual, "desconciliar" sería cambiar `source` de un movimiento importado, que no
es reversible de forma limpia. Coherente con §2 regla 4 (no se puede deshacer). Sin problema, solo
lo dejo por escrito.

**5 · Dos catálogos, ambos declarados "fuente única".**
Ver D. `TIPOS_GASTO_INMUEBLE_V2` es el que el mockup dibuja; `categoryCatalog.ts` es el que se
persiste (`categoryKey`). La ficha de movimiento de §4.5 tiene que **mostrar** familia/concepto del
primero y **guardar** `categoryKey` del segundo, lo que exige una tabla de mapeo entre ambos que hoy
no existe. Además el mockup mete `'Financiación'` como familia de gasto, que en el modelo no es
categoría sino un `sourceType` con selector de préstamo propio (`categoryCatalog.ts` lo dice
explícitamente: "Financiación y Traspaso NO usan catálogo de categorías").

Decisión que necesito: **¿construyo el mapeo `TIPOS_GASTO_INMUEBLE_V2 → categoryKey`** (unas 40
entradas, mecánico pero hay que revisarlo uno a uno y algunos no tienen destino claro), **o se
unifican de verdad los dos catálogos** en una tarea aparte antes de ésta? Lo segundo es lo correcto
a medio plazo y lo primero es lo que permite entregar esta tarea. No lo decido yo.

**6 · Defectos en el propio mockup, que es la fuente de verdad.**
Tres cosas del mockup se contradicen con §5 de la tarea y con el checklist §17 de la guía. **No las
he tocado** — el mockup es la fuente de verdad y arreglarlo por mi cuenta sería justo la "solución
intermedia" que prohíbe §7. Las reporto para que Jose decida qué manda:

- **`.pager` está definido dos veces** (`atlas-tesoreria-v5-escritorio.html:82-87` y `:89-92`).
  El primer bloque es el que describe §4.2 — `position:absolute`, `border-radius:50%`, flechas
  circulares superpuestas sobre los bordes. El segundo, misma especificidad y posterior, **gana**:
  `flex:0 0 48px` (vuelve al flujo, ya no superpuesta) y `border-radius:13px` (deja de ser
  circular). Tal como está, el mockup renderiza lo contrario de lo que pide su propia
  especificación. Parece CSS muerto de una iteración anterior. **Asumo que manda §4.2** (bloque 1)
  salvo que Jose diga lo contrario, pero conviene borrar el bloque 2 del mockup.
- **`--gold-ink` sobre cifras**, que §5 prohíbe explícitamente ("se lee marrón · usar `--gold`"),
  en cuatro sitios: `escritorio:222` (`.res-row .rv.gold` · el Neto de "Cómo va {mes}"),
  `escritorio:379` (`.drw-sum .sv.gold` · el Cierre del drawer de calendario), `escritorio:161`
  (`.rvend .tt b` · la cifra destacada de la desviación) y `movil:73` (`.okfin .v` · el cierre
  proyectado). **Al implementar usaré `--gold`**, porque §5 es regla vinculante y el checklist §17
  lo verifica; lo dejo escrito por si el mockup tenía razón y la regla es la que sobra.
  El resto de usos de `--gold-ink` en los mockups (hovers, avatares, fondos de icono, número del
  día de hoy) son legítimos: no son cifras.

**7 · Rama.** La tarea pide `feat/tesoreria-v5`; este PR va en `claude/new-session-hq2846`. Si Jose
quiere el nombre de la tarea, se renombra.

**8 · `ATLAS-mapa-stores-VIGENTE.md` está duplicado** — copias byte a byte en la raíz y en
`docs/audit-inputs/`, ambas documentando DB_VERSION 53. Un documento llamado "VIGENTE" por
duplicado y ocho versiones por detrás invita al error que la fase 0 venía a evitar. Sugiero dejar
una sola copia y marcarla como histórica, en tarea aparte.

---

## Lo que sí está listo para reutilizar

Para que quede claro que el camino existe una vez resueltas las decisiones:

| §  | Qué pide | Con qué se hace |
|---|---|---|
| 4.2 | Carrusel 5/4/3 tarjetas | `modules/tesoreria/components/BankAccountCard.tsx` (ya pagina a 5) |
| 4.4 | Pendientes / Todo | `shared/components/Punteo/PunteoList.tsx` + `services/punteo/punteoAdapter.ts` |
| 4.5 | Ficha de movimiento | `confirmTreasuryEvent` · `updateConfirmedMovement` · `treasuryTransferService` |
| 4.6 | Saldo vivo | `accountBalanceService.recalculateBalance()` + `invalidateCachedStores()` |
| 4.7 | Extracto | `bankStatementOrchestrator.ts` + `universalBankImporter/` + `movementMatchingService.ts` |
| 4.8 | Ficha de cuenta | `components/cuenta/CuentaWizard.tsx` (tipo, tarjeta, openingBalance ya cubiertos) |
| 4.9 | Calendario diario | `components/treasury/CalendarioMes12.tsx` + `MesDetalleDrawer.tsx` |
| 4.7 | Archivar el fichero | Módulo Archivo ya enrutado (`App.tsx:707`) |

Nada de esto exige stores nuevos. El único bloqueo de modelo es el estado **descartado/ignorado**
del punto A.

---

## Qué necesito para arrancar

1. **A** · ¿Bump a v84 con `descartado?` opcional en `TreasuryEvent`, o "descartar" = borrar?
2. **2** · ¿La V5 nueva se construye **sobre `PunteoList`** (recomendado) o lo sustituye?
3. **5** · ¿Mapeo `TIPOS_GASTO_INMUEBLE_V2 → categoryKey`, o unificación previa de los dos catálogos?
4. **1** · ¿Nombre? Propongo "Tesorería V6" para no chocar con la V5 ya mergeada.
5. **3** · ¿Se acepta que "a resolver" sea estado de la sesión de import y no del movimiento?

Con esas cinco respuestas, §3 se reescribe con los nombres reales y se implementa.

No bloquean, pero conviene confirmarlas (punto 6): que en `.pager` manda el bloque circular de
§4.2 y no el segundo que lo pisa, y que en las cuatro cifras en `--gold-ink` manda §5 (`--gold`).
Si no hay respuesta, tiro por esas dos asunciones.
