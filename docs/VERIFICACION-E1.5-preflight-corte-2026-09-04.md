# VERIFICACIÓN · E1.5-preflight · el CORTE (dejar de crear movimientos al importar)

**Fecha:** 4 sep 2026 · **HEAD:** `88f4f6d` (rama `claude/new-session-0ol6qe`) · **Método:** lectura del código y `git log`. **No se ha tocado una sola línea de código.** `npx tsc --noEmit` pasa limpio en este HEAD (línea base).

Convención:
- **[V]** VERIFICADO leyendo la línea citada.
- **[D]** DEDUCIDO: consecuencia de dos o más hechos verificados, no observada en ejecución.

Las decisiones de producto del encabezado de la tarea (el saldo incluye lo no clasificado; ignorar no saca del saldo; solo el fiscal excluye) son de Jose y **no se re-preguntan**: este documento verifica *cómo* aplicarlas. Sus referencias `§20`/`§29`/`§16.x` son del documento de modelo de Jose, que **no está en el repo** (`grep §29 docs/*.md`: sin resultados) — se citan como dadas, no verificadas.

**Rutas** (nombre corto → ruta repo-relativa):

| nombre corto | ruta |
|---|---|
| `accountBalanceService.ts`, `bankStatementOrchestrator.ts`, `treasuryEventsService.ts`, `treasuryConfirmationService.ts`, `treasuryForecastService.ts`, `altaMovimientoService.ts`, `traspasoDesdeMovimiento.ts`, `reconciliarConfirmado.ts`, `conciliacionConfirmados.ts`, `lineasExtractoService.ts`, `lineaComoMovimiento.ts`, `reabrirLote.ts`, `statementSessionService.ts`, `movementMatchingService.ts`, `movementSuggestionService.ts`, `cierreLineaInmueble.ts`, `fondosService.ts`, `cuentasService.ts`, `dashboardService.ts` | `src/services/…` |
| `matcheoDeterminista.ts`, `cierreDeterminista.ts` | `src/services/deterministas/…` |
| `types-lineasExtracto.ts`, `types-fiscal.ts`, `upgrade-a.ts` | `src/services/db/…` |
| `extractoSesion.ts`, `DrawerExtracto.tsx`, `TesoreriaV6Page.tsx`, `montarSesion.ts`, `decisionesPersistidas.ts` | `src/modules/tesoreria/v6/…` |
| `PanelPage.tsx` | `src/modules/panel/PanelPage.tsx` |
| `getCurrentSaldoCuenta.ts`, `presupuestoAnualService.ts` | `src/modules/mi-plan/wizards/utils/…`, `src/modules/mi-plan/services/…` |
| `treasuryMonthOpeningBalance.ts` | `src/components/treasury/…` |
| `proyeccionMensualService.ts`, `treasurySyncService.ts` | `src/modules/horizon/…` |

---

## 0 · Lo esencial en diez líneas

1. **[V] Sí hay un único punto donde vive «el saldo de una cuenta»:** `calculateAccountBalanceAtDate` (`accountBalanceService.ts:50-139`), función **pura** (recibe los arrays, no lee la base). **8 sitios de llamada, de los que 6 son vivos** (los otros 2 son de un fichero sin ningún llamante de producción, ver 1.1). No está calculado en N sitios. Esto es la mejor noticia del preflight.
2. **[V] Con una excepción: hay un SEGUNDO cálculo de saldo, paralelo y divergente** — `recalculateAccountBalance` (`treasuryEventsService.ts:55-111`), que suma `movements` a mano y **persiste** `account.balance` (`:103`). No comparte una línea con el hub. Tres llamantes vivos.
3. **[V] La fórmula anti-doble-conteo que propone la tarea es la correcta, pero le falta un guard:** `Σ movimientos + Σ líneas con movementIds vacío` cuenta **dos veces** cada línea con `descarte: 'duplicada'` — nace con `movementIds: []` (`bankStatementOrchestrator.ts:723`) y su dinero ya está en el movimiento de la importación anterior. El filtro correcto es `movementIds.length === 0 && !descarte`.
4. **[V] El cambio de saldo se puede mergear ANTES del corte y es un no-op exacto hoy:** hoy toda línea que generó movimiento tiene `movementIds` con un id (`:729`) y toda la que no lo generó lleva `descarte` (`:671`, `:675`, `:723`). El término nuevo vale **cero euros** en la base actual. Es la única costura barata del corte.
5. **[V] Los puntos de creación hacen HOY `get` antes de `put`** y ninguno crea: `confirmDecisions` (`:373`, `:461`, `:470`), `gastoDesdeMovimiento` (`altaMovimientoService.ts:453`), `mejoraDesdeMovimiento` (`:222`), `convertirEnTraspaso` (`traspasoDesdeMovimiento.ts:64`, con `throw MovimientoNoEncontradoError` en `:65`), `aplicarReconciliacionConfirmado` (`reconciliarConfirmado.ts:51`). Hay un **quinto** que la tarea no lista: `aplicarReconocimiento` (`cierreDeterminista.ts:95-98`), la vía de los deterministas.
6. **[V] La mina más peligrosa del corte:** `movementDesdeLinea` (`lineaComoMovimiento.ts:53-86`) construye el movimiento en memoria **con `id: linea.id`** (`:57`). `movements` y `lineasExtracto` son los dos `keyPath 'id', autoIncrement` (`upgrade-a.ts:227`, `:192`), así que ese id **es una clave válida de otro movimiento real**. Hoy es inofensivo (nadie escribe ese objeto); en E1.5 el mismo objeto llega a `confirmDecisions`, que hace `db.put('movements', {...movement, …})` en `:398` y `:472`. Un `put` con ese id **pisa un movimiento ajeno sin error**.
7. **[V] El dedupe entre importaciones se rompe con el corte** y la tarea no lo menciona: `insertMovements` construye el set de huellas con `getAll('movements')` (`:637-638`). Tras el corte, una línea sin resolver no tiene movimiento → reimportar un extracto **solapado** dejaría de reconocerla y **duplicaría el cargo**. El set tiene que incluir el `hashMovement` de las `lineasExtracto` existentes (el campo ya está persistido, `types-lineasExtracto.ts:95`).
8. **[V] `consolidadoAt` YA NO está sin función.** E1-preflight §4.2 lo dio por retirable; desde E1.3 es el marcador de «lote a medias» que alimenta `decisionesPersistidas.ts:217` y guarda `reabrirLote.ts:37`. **Retirarlo mata «retomar un lote».**
9. **[V] `sinBorradores` no se queda en no-op: se vuelve activamente dañino.** Tras el corte los únicos movimientos con `importBatch` de un lote sin guardar son los que el usuario **ya resolvió** (patas de traspaso, gasto desde ficha). `TesoreriaV6Page.tsx:229` los **escondería** justo cuando deben verse. Hay que retirarlo **en el mismo commit**, no dejarlo.
10. **[V] `cancelImportBatch` ya borra las líneas** desde E1.3 (`:491-497`). Esa parte de la tarea está hecha.

---

## 1 · EL SALDO

### 1.1 · ¿Un punto único o N sitios? — un hub, y un segundo cálculo suelto

**[V] El hub.** `calculateAccountBalanceAtDate` (`accountBalanceService.ts:50-139`). Es **pura**: recibe `{ account, cutoffDate, treasuryEvents, movements, incluirRealesFuturos? }` y devuelve el número. Todo el saldo de la aplicación sale de aquí — salvo el punto 1.2.

Su fórmula de hoy, verificada línea a línea:

```
saldo = openingBalance                          (:69, cero si la apertura es posterior al corte)
      + Σ eventos comprometidos                 (:96, :137 · status null|confirmed|executed)
      + Σ movimientos                           (:125-134)
```
con estos filtros sobre los movimientos (`:104-117`) **[V]**:
- misma cuenta; `!m.gastoTarjetaCredito` (una compra con crédito sale en el recibo, no el día de la compra); `!m.isOpeningBalance`;
- **no conciliados ya por un evento** (`reconciledMovementIds`, `:99-103`) — evita contar el evento y su movimiento;
- fecha `< cutoffDate`, salvo `incluirRealesFuturos` (saldo vivo);
- fecha `>= openingBalanceDate`;
- y un **casado implícito por `cuenta|fecha|importe`** (`:118-134`) para eventos ejecutados sin `movementId` guardado.

**[V] Los 8 sitios de llamada al hub** — 6 vivos y 2 muertos (marcados, ver la nota bajo la tabla):

| # | fichero:línea | qué pinta | corte |
|---|---|---|---|
| 1 | `accountBalanceService.ts:153` | dentro de `calculateTotalInitialCash` | el que le pasen |
| 2 | `accountBalanceService.ts:174` | dentro de `rollForwardAccountBalancesToMonth` — **persiste** `account.balance` (`:182-187`) | inicio de mes |
| 3 | `PanelPage.tsx:343` | «hoy tienes» del Panel | `corteParaSaldoVivo`, `incluirRealesFuturos: true` |
| 4 | `TesoreriaV6Page.tsx:368` | SALDO de Tesorería V6 | idem |
| 5 | `getCurrentSaldoCuenta.ts:55` | saldo de cuenta en los wizards de Mi Plan | mañana, `incluirRealesFuturos: true` |
| 6 | `treasuryMonthOpeningBalance.ts:57` | saldo de apertura de un mes pasado/actual · **muerto** | inicio del mes |
| 7 | `treasuryMonthOpeningBalance.ts:65` | base del roll-forward a meses futuros · **muerto** | inicio del mes en curso |
| 8 | `fondosService.ts:42` | saldo de la cuenta de un fondo | mañana |

**[V] Ojo con 6 y 7:** `calculateTreasuryMonthOpeningBalance` (`treasuryMonthOpeningBalance.ts:46`) **no tiene ningún llamante de producción** — grep fuera de tests: solo su propio `treasuryMonthOpeningBalance.test.ts`. Es código muerto, como lo era `TreasuryImportAPI` antes de E1.0. **Candidato a retirarlo en vez de tocarlo**: son 2 de los 8 sitios que desaparecen gratis. Sitios de llamada **vivos: 6, en 5 ficheros**.

**[V] Y dos consumidores indirectos por cada envoltorio:**
- `calculateTotalInitialCash` → `presupuestoAnualService.ts:491` (saldo de partida del presupuesto), `proyeccionMensualService.ts:996` (caja inicial de la proyección).
- `rollForwardAccountBalancesToMonth` → `treasurySyncService.ts:172`, `dashboardService.ts:1410`.

### 1.2 · El segundo cálculo — el que se escapa del hub

**[V]** `recalculateAccountBalance` (`treasuryEventsService.ts:55-111`) calcula el saldo de una cuenta **por su cuenta**:

```
balance = account.openingBalance
        + Σ movements de la cuenta, saltando isOpeningBalance (:88) y lo anterior a la apertura (:89-92)
```
y lo **escribe** en `accounts` (`:97-103`).

**[V] Diverge del hub en cuatro cosas:** no mira `treasuryEvents`, no excluye `gastoTarjetaCredito`, no tiene corte por fecha (suma el futuro), y no hace el casado implícito. Es un cálculo distinto que pisa el mismo campo que escribe `rollForwardAccountBalancesToMonth` (`accountBalanceService.ts:184`).

**[V] Llamantes:** `treasuryConfirmationService.ts:50` (tras confirmar un previsto, fire-and-forget), `treasuryEventsService.ts:207` y `:215` (dentro de `triggerTreasuryUpdate`).
**[V] Quién lee `account.balance` después:** `treasuryForecastService.ts:240-241`, `:288`, `treasuryEventsService.ts:169`. El Panel y Tesorería **no** lo leen a propósito (`PanelPage.tsx:326-330`).

**[D] Consecuencia para E1.5:** o se le añade también el término de líneas, o el saldo de la previsión (`treasuryForecastService`) se queda por debajo del de Tesorería en el importe de lo no resuelto. Recomendación de CC: **retirarlo y que llame al hub** — su fórmula es peor que la del hub en las cuatro cosas de arriba, y mantener dos definiciones de saldo es exactamente lo que se está intentando evitar.

### 1.3 · Los que leen `movements` pero NO calculan saldo (no hay que tocarlos)

E1-preflight §3.3 listaba estos como «lectores que ven los borradores». Es cierto — pero **no calculan saldo de cuenta**, y por tanto el corte no les cambia el número por esta vía. Verificado uno a uno:

| lector | línea | qué calcula de verdad | ¿tocar en E1.5? |
|---|---|---|---|
| `presupuestoAnualService.buildReal` | `:357-382` | ingresos/gastos reales por mes y grupo | **no** (su saldo entra por `:491`, ya contado arriba) |
| `estimacionFiscalEnCursoService` | `:84` | estimación fiscal | **no** — decisión de Jose: el fiscal **sí** excluye lo no clasificado |
| `generateTesoreria` (informe PDF) | `:25-33` | listado de movimientos de 6 meses; el saldo del informe viene ya calculado en `data.tesoreria.totales` (`:85`) | **no** |
| `comparativaService` | `:201-225` | real vs previsto por mes | **no** |
| `atlasExportService.exportarTesoreria` | `:668-690` | export de filas de movimientos | **no** (pero **[D]** exportar «lo que hay» sin las líneas pendientes es una pérdida de información: candidato a E1.6) |
| `compromisoDetection`, `onboardingDetection`, `compromisosRecurrentes`, `conciliarExtractoTarjeta` | `:249`, `:284`, `:750`, `:97` | detección de patrones | **no** funcionalmente; **[D]** detectarán menos patrones al no ver lo no resuelto |
| `LineasAnualesTab.tsx` | `:129-130` | cruce por `movimientoId` | **no** |
| `treasuryForecastService` | `:360` | previsión por índice `status='pendiente'` | **no** directamente, pero **sí** vía `account.balance` (1.2) |

**Corrección a E1-preflight §3.3 [V]:** la lista de allí es «lectores de `movements` sin filtro de borrador», no «lectores de saldo». Lectores de **saldo** son exactamente los 8 + 1 de 1.1 y 1.2.

### 1.4 · La fórmula limpia · propuesta

```
saldo(cuenta, corte) = openingBalance
                     + Σ eventos comprometidos          ← sin cambios
                     + Σ movimientos (filtros de hoy)   ← sin cambios
                     + Σ líneas HUÉRFANAS de la cuenta  ← NUEVO
```

**Línea huérfana** = una fila de `lineasExtracto` que cumple **todo** esto:

| condición | por qué | dónde se comprueba hoy |
|---|---|---|
| `linea.accountId === account.id` | obvio | índice `accountId` ya existe (`upgrade-a.ts:194`) |
| **`linea.movementIds.length === 0`** | **el guard anti-doble-conteo**: si engendró movimiento, ese movimiento ya suma | `types-lineasExtracto.ts:107` |
| **`!linea.descarte`** | **el guard que falta en el enunciado**: una `duplicada` tiene `movementIds: []` y su dinero **ya está** en el movimiento del lote anterior. Contarla la sumaría dos veces. `sin_fecha` no tiene fecha con la que compararse con el corte; `sin_importe` vale 0 | `bankStatementOrchestrator.ts:671`, `:675`, `:723` |
| `fechaOperacion < corte` (o `incluirRealesFuturos`) | mismo corte que los movimientos, o el saldo del Panel y el de Tesorería dejan de cuadrar | `accountBalanceService.ts:114-116` |
| `fechaOperacion >= openingBalanceDate` | la frontera del saldo inicial vale igual para una línea | `:107-109`, `:117` |

y se suma `linea.importe` (ya viene con signo, `types-lineasExtracto.ts:69`).

**Lo que la fórmula da gratis, verificado contra las decisiones de Jose [D]:**
- **Ignorar no saca del saldo.** Ignorar escribe `decision.ignorada` / `atencion: 'silenciada'` (`types-lineasExtracto.ts:25`, `:46`) y **no crea movimiento** → `movementIds` sigue vacío → la línea sigue sumando. Correcto y sin código extra.
- **El saldo no baja respecto a hoy.** Hoy suma el movimiento; mañana suma la línea; el importe es el mismo (`lineaDesdeFila` guarda `importe` = el mismo `amount` que va al `Movement`, `lineasExtractoService.ts:59` vs `bankStatementOrchestrator.ts:683`).
- **Solo el fiscal excluye lo no clasificado.** `estimacionFiscalEnCursoService` no se toca: nunca verá las líneas.

**Tres decisiones de forma que hay que tomar antes de escribir [D]:**

1. **Cómo entra el término nuevo al hub.** Dos vías:
   - **(A) parámetro nuevo** `lineas: Array<{accountId, fechaOperacion, importe, movementIds, descarte}>` en `calculateAccountBalanceAtDate`. Cuesta tocar los 6 sitios vivos de llamada + cargar `lineasExtracto` en 5 ficheros (4 si se retira el código muerto de 1.1).
   - **(B) inyectar las líneas huérfanas como `Movement` en memoria** con `movementDesdeLinea` y no tocar el hub. **CC desaconseja (B):** es la mina del punto 0.6 — mete objetos con ids que colisionan con movimientos reales en arrays que otro código indexa por id (`TesoreriaV6Page.tsx:353-357`, `PanelPage.tsx:347` los pasa además a los KPIs). Un saldo correcto a cambio de KPIs corruptos.
   **Recomendación: (A).**
2. **Qué guarda `movementIds` en un traspaso.** `convertirEnTraspaso` crea **dos** patas, una en cada cuenta (`traspasoDesdeMovimiento.ts:117` entrada, `:126` salida). Si `movementIds = [salida, entrada]`, la regla de §16.4 que cita `types-lineasExtracto.ts:19-22` («la suma de los importes de esos movimientos debe ser igual a `importe`») **se rompe**: −100 + 100 = 0 ≠ −100. **Recomendación:** `movementIds` guarda solo los movimientos **de la cuenta de la línea**. La pata de la otra cuenta la cuenta esa otra cuenta por su propia Σ movimientos. Así la invariante se conserva y no hay doble conteo.
3. **Coste de lectura.** El hub se llama por cuenta dentro de bucles (`TesoreriaV6Page.tsx:364`, `PanelPage.tsx:339`). Las líneas hay que cargarlas **una vez** fuera del bucle y repartirlas por cuenta, como ya se hace con eventos y movimientos (`TesoreriaV6Page.tsx:344-359`). El índice `accountId` existe.

### 1.5 · La costura barata: el cambio de saldo es un no-op HOY

**[V]** En la base actual, tras E1.1:
- toda fila que generó movimiento se persiste con `movementIds: [id]` (`bankStatementOrchestrator.ts:729`);
- toda fila que no lo generó lleva `descarte` (`:671` sin fecha, `:675` sin importe, `:723` duplicada);
- no existe ninguna otra escritura de `lineasExtracto` que deje `movementIds` vacío sin `descarte` (único otro escritor: `decisionesPersistidas.ts:184`, que hace `put` sobre la fila leída en `:179` y **no** toca `movementIds`).

**[D]** Por tanto el conjunto «líneas huérfanas» está **vacío hoy**, y el término nuevo suma **exactamente 0 €** en toda la base. El cambio de saldo se puede escribir, testear y mergear **sin cambiar ni un euro de lo que el usuario ve** — y con un test que lo demuestre. Ver §6.

---

## 2 · LOS PUNTOS DE CREACIÓN

**Cinco servicios · ocho sitios.** La tarea lista cuatro servicios; hay un quinto (`aplicarReconocimiento`, la vía de los deterministas). Esos cinco servicios se reparten en **ocho sitios de código** que hay que tocar —`confirmDecisions` tiene tres bloques independientes—, y son los ocho que numera la tabla. **[V]** Todos hacen hoy `get` antes de `put` y **ninguno crea el movimiento**:

| # | pieza | fichero:línea | qué hace hoy | qué tiene que hacer en E1.5 |
|---|---|---|---|---|
| 1 | `confirmDecisions` · cuadres con previsto | `bankStatementOrchestrator.ts:372-437` — `get` `:373`, `put` `:398` | pisa el movimiento importado con la clasificación del evento | **crear** el `Movement` desde la línea, marcar el evento `executed` con su id (`:383`), escribir `movementIds` en la línea |
| 2 | `confirmDecisions` · reconciliar con Confirmado | `:460-465` — `get` `:461` | pasa `importMov` a `aplicarReconciliacionConfirmado` | ver #5 |
| 3 | `confirmDecisions` · ignoradas | `:468-478` — `get` `:470`, `put` `:472` | deja el movimiento `no_planificado`/`sin_match` | **desaparece**: ignorar no crea nada. Se sustituye por `atencion: 'silenciada'` en la línea |
| 4 | `aplicarReconocimiento` (deterministas) | `cierreDeterminista.ts:95-98` — `get` `:95`, `put` `:98`; devuelve `false` si no existe (`:96`) | cierra el movimiento con el origen reconocido | **crear** y luego cerrar. **No está en la lista de la tarea** |
| 5 | `aplicarReconciliacionConfirmado` | `reconciliarConfirmado.ts:45-137` — `get` del confirmado `:51`, `put` del import `:58`, `delete` del confirmado `:136` | **sobrevive la línea del import, muere el confirmado**; repunta patas de traspaso (`:93-105`), líneas de gasto (`:112-116`) y el evento (`:122-135`) | **invertirlo** (ver abajo) |
| 6 | `gastoDesdeMovimiento` | `altaMovimientoService.ts:453-476` — `get` `:453`, `put` `:458` | clasifica el movimiento y escribe la fila de `gastosInmueble` (`:530`) | **crear** el movimiento, luego lo demás |
| 7 | `mejoraDesdeMovimiento` | `altaMovimientoService.ts:222-224` | ídem con `mejorasInmueble` | ídem |
| 8 | `convertirEnTraspaso` | `traspasoDesdeMovimiento.ts:64-135` — `get` `:64`, **`throw MovimientoNoEncontradoError` `:65`**, `add` entrada `:117`, `put` salida `:126` | transforma el importado en pata de salida y crea la entrada | **crear las dos patas**. La guarda de idempotencia `:77-78` (`transferMetadata.pairMovementId`) pasa a tener que leerse de la línea, no del movimiento |

### 2.1 · La inversión que recomienda CC en `aplicarReconciliacionConfirmado`

**[V]** Hoy esa función existe para resolver un conflicto que el corte **elimina**: el import creaba un movimiento duplicado del Confirmado que el usuario ya tenía, y había que colapsar los dos. Por eso borra el confirmado (`:136`) y tiene que **repuntar** todo lo que le apuntaba: patas de traspaso (`:93-105`), líneas de gasto (`repuntarLineasAlMovimiento`, `:112`), el evento de tesorería (`:126-133`).

**[D]** Tras el corte **no nace ningún duplicado**: solo existe el Confirmado. Lo natural es al revés — **conservar el Confirmado**, subirlo a `unifiedStatus: 'conciliado'` / `movementState: 'Conciliado'`, y escribir `movementIds: [confirmadoId]` en la línea. Con eso:
- el saldo no se mueve (el confirmado ya estaba contado);
- la línea deja de ser huérfana y no se cuenta dos veces;
- **desaparece toda la maquinaria de repunteo** (`:88-135`), que existe solo porque hoy se borra un id al que otros apuntan.

Es la simplificación más grande que el corte permite, y hay que decidirla **antes** de escribirlo, no después.

### 2.2 · Dónde queda hoy la frontera línea↔movimiento (lo que hay que girar)

**[V]** Tras E1.2b la sesión ya decide por `lineaId` (`extractoSesion.ts:35`) y traduce a `movementId` **en la frontera**:
- `movementIdsDe` (`extractoSesion.ts:327-329`) — **`return l.movementIds?.length ? l.movementIds : [l.movementId]`**. Tras el corte `movementIds` estará vacío y el *fallback* devolverá `[l.movementId]`, que ya no existirá. **Punto de rotura directo.**
- `payloadDeConfirmacion` (`:389-401`) devuelve `approvedMatches[].movementId`, `ignoredMovementIds[]`, `reconciliacionesConfirmado[].importMovementId`.
- `movimientosAEfectivo` (`:516-527`) y `movimientosATraspaso` (`:580-592`) devuelven `movementId`.
- `DrawerExtracto.tsx` pasa `linea.movementId` a `mejoraDesdeMovimiento` (`:498`), a `gastoDesdeMovimiento` (`:518`) y a `convertirEnTraspaso` (`:435`, `:443`).

**[V]** Y las **puertas por línea de E1.4b ya están abiertas y sin usar en producción**: `matchLineas` (`movementMatchingService.ts:115`), `suggestForLineas` (`movementSuggestionService.ts:107`), `reconocerDeterministasDeLineas` (`matcheoDeterminista.ts:99`), `confirmadosPorLineaExtracto` (`conciliacionConfirmados.ts:166`). Grep de llamantes fuera de `__tests__`: **ninguno**. El orquestador sigue por `matchBatch(insertResult.insertedIds)` (`:286`) y `montarSesion.ts:91` sigue usando `confirmadosPorLinea` (la versión por `Movement`). Cruzar esas cuatro puertas **es** E1.5.

---

## 3 · `insertMovements` Y `cancelImportBatch`

### 3.1 · `insertMovements` (`:630-733`)

**[V] Qué hace hoy:** por cada `ParsedMovement`, persiste **siempre** la línea (`:654-668`) y **además**, si tiene fecha e importe y no es duplicada, inserta el `Movement` (`:727`) y enlaza (`:729`).

**[V] Qué se rompe de lo que devuelve.** `InsertResult.insertedIds` (`:625`) tiene **dos consumidores**:

| consumidor | línea | qué pasa tras el corte |
|---|---|---|
| `matchBatch(insertResult.insertedIds, …)` | `:286` | pasa a `matchLineas(lineas)` (puerta ya abierta) |
| `movementsInserted: insertResult.inserted` en `OrchestratorResult` | `:312`, tipo en `:66` | pasa a significar «líneas guardadas». Lo lee `reabrirLote.ts:56` desde `batch.importedRows`, y los tests lo afirman en **10 asserts** de `bankStatementOrchestrator.test.ts` (`:235`, `:266`, `:278`, `:303`, `:535`, `:564`, `:598`, `:638`, `:675`, `:724`) |

**[V] LO QUE LA TAREA NO LISTA Y ES LO MÁS GRAVE DE ESTA FUNCIÓN — el dedupe se rompe.** `:637-638`:
```
const existing = ((await db.getAll('movements')) ?? []) as Movement[];
const existingHashes = new Set(existing.map(hashMovement));
```
El único freno a que un **extracto solapado** duplique cargos es que la línea repetida encuentre su `hashMovement` en ese set (`:721`). Tras el corte, **una línea sin resolver no tiene movimiento**, así que su huella no está en el set: reimportar un extracto que solape con ella la **volvería a insertar** como línea nueva, y al resolverla nacerían **dos** movimientos del mismo cargo. El hash del lote (`:163-174`) no protege: solo bloquea el **mismo fichero**, no uno solapado.

**Arreglo [D]:** el set tiene que ser la unión de `hashMovement` de `movements` **y** de `lineasExtracto` — el campo ya está persistido en cada línea (`types-lineasExtracto.ts:95`, escrito en `:663`), así que es una lectura más y un `for`, no un cálculo nuevo. **Esto es obligatorio en el mismo commit del corte**, no en la limpieza posterior.

**[V] Y un matiz sobre `descarte: 'duplicada'`:** tras el corte, «duplicada» pasa a significar «ya la vi como línea o como movimiento». La semántica del campo aguanta; lo que cambia es contra qué se compara.

### 3.2 · `cancelImportBatch` (`:481-506`)

**[V] Ya borra las líneas** — E1.3 lo hizo (`:491-497`, vía `lineasDelLote`, con `try/catch` no fatal). Esa parte de la tarea **está hecha**.

**[V] Lo que queda:** `toRemove` sigue siendo «movimientos con `importBatch === id`» (`:483-484`, con `getAll` completo, sin usar el índice `importBatch` que existe en `upgrade-a.ts:231`). Tras el corte esa lista **no queda vacía**: son los movimientos que el usuario **ya creó** en la sesión (gasto desde ficha, patas de traspaso). Y sigue siendo correcto borrarlos — «salir sin guardar» significa deshacer la sesión entera.

**[D] Dos matices verificables:**
- La pata de **entrada** de un traspaso hereda `importBatch` por el *spread* `...movimiento` (`traspasoDesdeMovimiento.ts:85`; se anulan `reference`, `documentIds`, `id`, pero **no** `importBatch`). Hoy eso hace que `cancelImportBatch` la borre — que es lo correcto. Tras el corte, si las patas se crean de cero, hay que **acordarse de ponerles `importBatch`** o «salir sin guardar» dejará patas huérfanas y el saldo de la cuenta destino inflado.
- `{ removed }` cambia de significado (movimientos borrados → siempre pocos). `DrawerExtracto.tsx:472` lo llama sin leer el valor **[V]**.

---

## 4 · LO QUE SE DESCOLOCA

### 4.1 · `consolidadoAt` — ya NO está sin función (corrección a E1-preflight §4.2)

**[V]** E1.3 le dio un trabajo nuevo:
- `decisionesPersistidas.ts:217`: `if (!b.id || b.consolidadoAt) continue;` — así se listan los lotes a medias que se ofrecen retomar.
- `reabrirLote.ts:37`: `if (batch.consolidadoAt) throw …('ya se guardó · no hay nada que retomar')`.
- `statementSessionService.ts:110-112` lo escribe; `estaConsolidada` (`:127-131`) lo lee.

**Veredicto: NO retirar.** Retirarlo rompe «retomar un lote a medias», que es la funcionalidad que E1.3 acaba de entregar.

### 4.2 · `sinBorradores` / `batchesEnBorrador` — hay que retirarlos, no dejarlos

**[V]** Un solo consumidor: `TesoreriaV6Page.tsx:221` (`batchesEnBorrador()`) y `:229` (`sinBorradores(movimientos, borradores)`). Definición en `statementSessionService.ts:36-58`.

**[D] Tras el corte deja de ser inocuo.** Hoy esconde «los movimientos de un lote sin guardar», que son las líneas sin mirar. Mañana los únicos movimientos con `importBatch` de un lote sin guardar serán los que el usuario **ya resolvió** (patas de traspaso `:117`/`:126`, gasto desde ficha). `sinBorradores` los **escondería de Tesorería V6** justo cuando ya son realidad clasificada. **Retirar en el mismo commit del corte.**

### 4.3 · `consolidarSesion` y `lineasPendientes`

**[V]** `lineasPendientes` (`extractoSesion.ts:488-493`) devuelve `[]` a propósito desde FASE 1 (comentario `:473-487`: la «desmaterialización» destruyó 88 movimientos reales y se retiró). `consolidarSesion` (`statementSessionService.ts:84-124`) recibe esa lista vacía y por tanto **no borra nada**; lo único vivo que hace es escribir `consolidadoAt` (`:110-112`).

**Veredicto [D]:** `consolidarSesion` **se queda** (por 4.1) pero se le puede quitar el parámetro y el bloque de borrado (`:93-108`) y el campo `ImportBatch.lineasPendientes` (`types-fiscal.ts:166`). `lineasPendientes()` se puede borrar entera junto con su llamada (`DrawerExtracto.tsx:457`).

### 4.4 · La ficha huérfana — el corte lo deja **igual de roto, por otro camino**

**[V] Hoy** (E1-preflight §1.4): crear un gasto desde la ficha a mitad de sesión escribe una fila en `gastosInmueble` (`altaMovimientoService.ts:530`) con `movimientoId` = el movimiento del import (`camposDeCierre`, `cierreLineaInmueble.ts:204`, llamado en `altaMovimientoService.ts:485-491` con `id: params.movementId`). Si el usuario sale sin guardar, `cancelImportBatch` borra el movimiento y **no toca** `gastosInmueble`. Queda una fila fiscal apuntando al vacío.

**[D] Tras el corte:** exactamente lo mismo, porque el movimiento seguirá existiendo (ahora lo crea la propia ficha) y `cancelImportBatch` seguirá borrándolo sin limpiar la fila fiscal. **Ni mejor ni peor.**

**[V] Y aparece una avería NUEVA si no se tiene cuidado:** `camposDeCierre` recibe `{ id: params.movementId }` y escribe `movimientoId: String(movimiento.id)`. Como la sesión ya habla en `lineaId` (`extractoSesion.ts:35`), pasar por descuido el `lineaId` en vez del id del movimiento recién creado escribiría **el id de una línea como si fuera un movimiento** en la fila fiscal — sin error, sin aviso, y cruzando contra un movimiento ajeno cuando los contadores coincidan.

**¿Enlazar la ficha a la LÍNEA en vez de al movimiento? [D] CC dice que no.** `camposDeCierre` necesita `amount`, `date`, `valueDate` y `accountId` **del movimiento** (`cierreLineaInmueble.ts:200-214`), y `repuntarLineasAlMovimiento` (`reconciliarConfirmado.ts:112`) y `buscarLineaDelEvento` cruzan por `movimientoId`. La fila fiscal declara **un pago**, y el pago es el movimiento. **Lo correcto es lo contrario:** que `cancelImportBatch` limpie también `gastosInmueble`/`mejorasInmueble` por los `movimientoId` que va a borrar. Eso es un arreglo **independiente del corte** y se puede hacer hoy mismo, en E1.5 o antes.

---

## 5 · LAS MINAS · lo que puede salir mal en silencio

Ninguna de estas da error: todas producen un número equivocado o un dato pisado.

| # | mina | dónde | qué pasa si se olvida |
|---|---|---|---|
| M1 | **`id: linea.id`** en el movimiento en memoria | `lineaComoMovimiento.ts:57`; escritores expuestos: `confirmDecisions:398`, `:472`, `cierreDeterminista.ts:98`, `reconciliarConfirmado.ts:58` | un `put` **pisa un movimiento real ajeno**. Los dos stores son `autoIncrement` desde 1 (`upgrade-a.ts:192`, `:227`), así que los ids **colisionan por diseño** |
| M2 | **`descarte` sin excluir** en la fórmula de saldo | §1.4 | cada línea duplicada de un extracto solapado **suma dos veces** |
| M3 | **`movementIds` no escrito** al crear | los 8 sitios de §2 | la línea sigue huérfana Y ya hay movimiento → **doble conteo** del mismo cargo |
| M4 | **dedupe sin las líneas** | `bankStatementOrchestrator.ts:637-638` | reimportar un extracto solapado **duplica cargos no resueltos** |
| M5 | **`sinBorradores` no retirado** | `TesoreriaV6Page.tsx:229` | movimientos ya resueltos **invisibles** en Tesorería |
| M6 | **`camposDeCierre` con un `lineaId`** | `altaMovimientoService.ts:486` | fila fiscal apuntando a un movimiento que no es el suyo |
| M7 | **`movementIdsDe` con `movementIds` vacío** | `extractoSesion.ts:328` | el *fallback* `[l.movementId]` devuelve un id inexistente y el traspaso/efectivo falla o toca otro movimiento |
| M8 | **invariante §16.4 en traspasos** | `types-lineasExtracto.ts:19-22` vs `traspasoDesdeMovimiento.ts:117`,`:126` | Σ importes de `movementIds` ≠ `importe` |
| M9 | **`recalculateAccountBalance` sin tocar** | `treasuryEventsService.ts:55-111` | `account.balance` y la previsión (`treasuryForecastService.ts:240`) por debajo del saldo real |
| M10 | **`importBatch` no puesto** en los movimientos nuevos | los 8 sitios de §2 | «salir sin guardar» deja movimientos huérfanos y el saldo inflado |

---

## 6 · VALORACIÓN DE CC · ¿cabe en UNA tarea?

Lectura del código, no decisión. Jose decidió no partirlo; esto es lo que CC ve.

### 6.1 · El corte propiamente dicho: **sí cabe, y además NO debería partirse**

**[D]** Los ocho sitios de creación, `insertMovements`, la frontera de la sesión y las cuatro puertas de E1.4b son **una sola pieza**: cualquier corte intermedio deja la app en un estado donde importar no crea nada y resolver tampoco. No hay un punto medio mergeable. La decisión de Jose es técnicamente la correcta para esta parte.

**[V]** Y el terreno está mucho mejor preparado de lo que sugería E1-preflight §6:
- las cuatro puertas por línea ya existen y tienen tests de equivalencia (`matcheoPorLinea.equivalencia.test.ts`, `caracterizacionMatcheo.test.ts`);
- la sesión ya decide por `lineaId` (E1.2b) y la traducción está **concentrada en la frontera**, no repartida;
- `cancelImportBatch` ya borra líneas;
- el saldo tiene **un hub puro** con 6 llamantes vivos, no N sitios;
- `tsc --noEmit` está limpio.

### 6.2 · Lo que CC **no** metería en el mismo commit: el saldo

**Esta es la única reserva concreta, y es barata de resolver.**

El corte es un cambio de **flujo**: si algo sale mal, sale mal a la vista — una línea no aparece, un traspaso falla, un test rojo. El cambio de **saldo** es distinto: si la fórmula tiene un guard de menos (M2) o un `movementIds` sin escribir (M3), **el número sale mal y nadie se entera**. No hay excepción, no hay pantalla en blanco: hay un saldo que no cuadra con el banco, y para cuando alguien lo note habrá pasado por el Panel, los wizards, el presupuesto, la proyección y los fondos.

**Y hay una costura que no cuesta nada [V]:** por §1.5, el término nuevo del saldo **vale 0 € en la base de hoy**. Se puede escribir, testear y mergear **antes** del corte:
- `calculateAccountBalanceAtDate` acepta las líneas y suma las huérfanas;
- los 5 ficheros vivos que llaman al hub cargan `lineasExtracto` (4 si antes se retira el muerto de 1.1);
- `recalculateAccountBalance` se retira o se alinea (M9);
- tests: (a) una línea huérfana suma; (b) una línea con `movementIds` **no** suma; (c) una `duplicada` **no** suma; (d) sobre la base de hoy el saldo es **idéntico** al de antes del cambio.

Ese commit **no cambia ni un euro** de lo que el usuario ve, y el día del corte el saldo ya está probado. Sin él, el corte y la fórmula del saldo se estrenan a la vez y no hay forma de saber cuál de los dos falló si el número no cuadra.

**Coste de la costura:** un commit pequeño, un día. **Lo que compra:** que el único cambio silencioso del corte llegue ya verificado.

### 6.3 · Veredicto

**El corte cabe en una tarea. No hay ningún punto que lo haga inviable de una** — no encontré nada del tipo «esto obliga a rehacer X antes». Pero CC recomienda mover **una** cosa fuera: el cambio de la fórmula del saldo, por delante, como no-op verificable. No es partir el corte: el corte sigue entero. Es sacar de él la parte que, si sale mal, sale mal sin avisar.

Si Jose prefiere que vaya todo junto, entonces el commit **tiene que llevar sí o sí** los diez guards de §5, y en particular M1 (el `id: linea.id`), M2 (`descarte`) y M4 (el dedupe), que son los tres que hoy no están escritos en ninguna parte y no los recuerda ningún test.

### 6.4 · Lo que hay que decidir antes de escribir (no es de CC)

1. **¿Se invierte `aplicarReconciliacionConfirmado`?** (§2.1) — conservar el Confirmado en vez de borrarlo. CC lo recomienda: borra ~50 líneas de repunteo que solo existen por el duplicado que el corte elimina.
2. **¿`movementIds` guarda solo los movimientos de la cuenta de la línea?** (§1.4, M8) — CC lo recomienda: conserva la invariante de §16.4 y evita el doble conteo en traspasos.
3. **¿Se retira `recalculateAccountBalance`** y `treasuryForecastService` pasa a leer el hub? (§1.2, M9).
4. **¿`cancelImportBatch` limpia `gastosInmueble`/`mejorasInmueble`?** (§4.4) — independiente del corte, se puede hacer antes.
