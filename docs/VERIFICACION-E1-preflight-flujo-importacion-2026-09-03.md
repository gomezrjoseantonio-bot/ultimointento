# VERIFICACIÓN · E1-preflight · el flujo de importación tal y como está

**Fecha:** 3 sep 2026 · **HEAD:** `b4af0d2` (rama `claude/new-session-38uzuj`, sin diferencias de producto respecto a `main`) · **Método:** lectura del código, `git log`, y el censo automático `node scripts/censo-stores.mjs --json`. **No se ha tocado una sola línea de código.**

Convención:
- **[V]** VERIFICADO leyendo la línea citada o ejecutando la herramienta citada.
- **[D]** DEDUCIDO: consecuencia de dos o más hechos verificados, no observada en ejecución.

Todos los `fichero:línea` son sobre `b4af0d2`. Un comentario del código nunca se usa como prueba de comportamiento; cuando comentario y código difieren, se señala.

**Rutas.** Para que las tablas quepan, un fichero se cita por su nombre corto salvo la primera vez o cuando hay homónimos. Cada nombre corto resuelve a UNA ruta del repo:

| nombre corto | ruta repo-relativa |
|---|---|
| `bankStatementOrchestrator.ts` | `src/services/bankStatementOrchestrator.ts` |
| `statementSessionService.ts` | `src/services/statementSessionService.ts` |
| `statementIgnoredLinesService.ts` | `src/services/statementIgnoredLinesService.ts` |
| `movementMatchingService.ts`, `movementSuggestionService.ts` | `src/services/…` |
| `matcheoDeterminista.ts`, `cierreDeterminista.ts` | `src/services/deterministas/…` |
| `reconciliarConfirmado.ts`, `conciliacionConfirmados.ts`, `reconciliarDuplicadosExistentes.ts` | `src/services/…` |
| `traspasoDesdeMovimiento.ts`, `altaMovimientoService.ts`, `accountBalanceService.ts`, `treasuryApiService.ts`, `cuentasService.ts`, `dashboardService.ts`, `treasuryEventsService.ts`, `treasuryCreationService.ts`, `treasuryForecastService.ts`, `compromisoDetectionService.ts`, `onboardingDetectionService.ts`, `estimacionFiscalEnCursoService.ts`, `fondosService.ts`, `demoDataCleanupService.ts`, `__buscarApunteAudit.ts`, `__tarjetaDiagnostico.ts` | `src/services/…` |
| `conciliarExtractoTarjeta.ts`, `extractoTarjeta.ts`, `compromisosRecurrentesService.ts` | `src/services/personal/…` |
| `punteoModel.ts` | `src/services/punteo/punteoModel.ts` |
| `backfillClasificacionConciliados.ts` | `src/services/migrations/…` |
| `types-fiscal.ts`, `types-movimientos.ts`, `upgrade-a.ts` | `src/services/db/…` |
| `db.ts` | `src/services/db.ts` |
| `batchHashUtils.ts`, `duplicateDetection.ts` | `src/utils/…` |
| `bankParser.ts` | `src/features/inbox/importers/bankParser.ts` |
| `DrawerExtracto.tsx`, `TesoreriaV6Page.tsx`, `extractoSesion.ts`, `decisionesDeSesion.ts`, `conciliarBuckets.ts`, `PanelExtractoTarjeta.tsx` | `src/modules/tesoreria/v6/…` |
| `ZonaSoltar.tsx` | `src/modules/tesoreria/v6/conciliar/ZonaSoltar.tsx` |
| `PanelPage.tsx` | `src/modules/panel/PanelPage.tsx` (hay otros dos `PanelPage.tsx` en el repo; este documento solo cita este) |
| `getCurrentSaldoCuenta.ts`, `presupuestoAnualService.ts` | `src/modules/mi-plan/wizards/utils/…`, `src/modules/mi-plan/services/…` |
| `generateTesoreria.ts`, `comparativaService.ts`, `atlasExportService.ts`, `treasurySyncService.ts` | `src/modules/horizon/informes/generators/…`, `src/modules/horizon/proyeccion/comparativa/services/…`, `src/modules/horizon/herramientas/exporters/…`, `src/modules/horizon/tesoreria/services/…` |
| `LineasAnualesTab.tsx` | `src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx` |
| `*.test.ts` | `src/services/__tests__/…` salvo `extractoSesion.test.ts` (`src/modules/tesoreria/v6/__tests__/…`) |

---

## 0 · Lo esencial en diez líneas

1. **[V]** Importar escribe **todas** las líneas del fichero en `movements` **antes** de que el usuario vea nada: `bankStatementOrchestrator.ts:686` (`db.add('movements', candidate)`), un `add` por fila, en bucle, sin transacción única. La cita previa «`:683`» apunta al `continue` del dedupe; el `add` es `:686` (tres líneas de diferencia por commits posteriores a la auditoría anterior).
2. **[V]** Nacen con `unifiedStatus: 'no_planificado'`, `source: 'import'`, `movementState: 'Confirmado'`, `status: 'pendiente'`, `statusConciliacion: 'sin_match'`, `importBatch: <id del lote>` (`:657-669`).
3. **[V]** `source: 'import'` es, para el modelo de punteo, **conciliado** (`punteo/punteoModel.ts:60-62`), aunque `unifiedStatus` diga `no_planificado`. De ahí la necesidad del parche «borrador».
4. **[V]** `importBatches` guarda **solo metadatos del lote** (`types-fiscal.ts:104-177`): nombre, cuenta, contadores, `hashLote`, `consolidadoAt`, `lineasIgnoradas[]` (hashes) y `lineasPendientes[]` (hoy siempre vacío). **No guarda las líneas del fichero ni el fichero.** El fichero solo sobrevive si el usuario pulsa Guardar, como documento (`statementSessionService.ts:143-173`).
5. **[V]** El matcheo (`matchBatch`), las sugerencias, el reconocimiento determinista, la conciliación contra confirmados, el traspaso, la ficha de gasto/mejora y **toda la sesión del drawer** trabajan sobre **`Movement.id` ya insertado**. `LineaExtracto.movementId` (`extractoSesion.ts:29`) es la clave de todas las decisiones.
6. **[V]** Hay **un** filtro de borradores (`statementSessionService.ts:36-58`) y **un** consumidor (`TesoreriaV6Page.tsx:221-229`). El censo cuenta **60 sitios de lectura de `movements` en producción** (38 ficheros) y **45 sitios de escritura**; ninguno de los otros 59 lectores aplica el filtro.
7. **[V]** Saldo vivo (`accountBalanceService.ts:103-135`), Panel (`src/modules/panel/PanelPage.tsx:192`), saldo del wizard (`getCurrentSaldoCuenta.ts:40`), presupuesto, estimación fiscal, informes y exportación leen `movements` **sin** filtro: un extracto abierto sin guardar **ya cuenta** ahí.
8. **[V]** Hay tres huellas distintas de «la misma línea»: `hashLote` (SHA-256 del fichero), `hashMovement` (`accountId|fecha|céntimos|descripción cruda`) y `hashLinea` (`v1:fecha|céntimos|descripción normalizada`, sin cuenta). No coinciden entre sí.
9. **[V]** El comentario «cirugía mayor» está en `statementSessionService.ts:16-19`. Su premisa «otro consumidor vivo» **ya no se sostiene**: `processFile` tiene hoy **un solo** llamante de producción (`DrawerExtracto.tsx:270`). La otra premisa («`matchBatch` trabaja sobre ids ya insertados») sigue siendo cierta.
10. **[V]** Existe un precedente interno de «leer y emparejar sin escribir, aplicar al confirmar»: el extracto de **tarjeta** (`conciliarExtractoTarjeta.ts:1-12`, `planificarExtractoTarjeta` `:130` → `aplicarPlanTarjeta` `:154`). Es el patrón que E1 quiere para banco.

---

## 1 · EL FLUJO DE IMPORTACIÓN, PASO A PASO

### 1.0 · Entrada desde la UI

- **[V]** El único punto de entrada en producción es el drawer: `src/modules/tesoreria/v6/DrawerExtracto.tsx:261-307` (`procesar`). Decide PDF o hoja de cálculo en `:270`: `esPdf(file) ? processPdf(file, opc) : processFile(file, opc)`.
- **[V]** `opc` es `{ accountId, allowReimport }` (`:269`). **Nunca se pasa `periodStart`/`periodEnd`**, así que el filtro por periodo del orquestador (`:508-521`) no actúa en producción.
- **[V]** Antes de procesar, si el drawer no tiene cuenta, detecta la cuenta por IBAN (`detectarCuenta`, `:323`) o pide destino (`ZonaSoltar.tsx:66-95`). Elegir una tarjeta desvía a otro flujo (`PanelExtractoTarjeta.tsx`), que no pasa por el orquestador.
- **[V]** Otros callers de `processFile`/`processPdf`/`confirmDecisions`/`cancelImportBatch` fuera de tests: **ninguno** (grep sobre `src/`, excluidos `__tests__`). Los demás resultados del grep son comentarios.

### 1.1 · Parseo (objetos en memoria)

**Hoja de cálculo / CSV** — `BankParserService.parseFile` (`src/features/inbox/importers/bankParser.ts:61-140`):
- **[V]** Importa `xlsx` (SheetJS) dinámicamente (`:70`). CSV → texto → workbook (`:75-77`); XLS/XLSX → `XLSX.read(buffer)` (`:78-80`).
- **[V]** Elige la primera hoja con datos (`:88-91`) y llama a `parseSheet` (`:94`, definido en `:270`).
- **[V]** Las filas se convierten una a una con `parseMovementRow` y se marca `originalRow` (`:640-650`).
- **[V]** Al final pasa por `detectDuplicates` (`:657`, `src/utils/duplicateDetection.ts:58-80`), que rellena `isDuplicate`/`duplicateHash` **dentro del fichero**. **Nadie consume ese flag en el orquestador**: el único uso es contar (`bankParser.ts:231`).
- **[V]** Produce `BankParseResult` (`src/types/bankProfiles.ts:126-133`, extiende `ParseResult` `:56-70`): `{ success, error?, movements: ParsedMovement[], warnings?, metadata, sheetInfo, ... }`.

**PDF** — `leerExtractoBancoPdf(file)` (`src/services/leerExtractoBancoPdf.ts:48`): lo lee la IA y devuelve directamente `ParsedMovement[]`.

**La forma en memoria** — `ParsedMovement` (`src/types/bankProfiles.ts:31-45`) **[V]**:

| campo | tipo | nota |
|---|---|---|
| `date` | `Date` | medianoche local (`parseSpanishDate`) |
| `valueDate?` | `Date` | |
| `amount` | `number` | ya con signo |
| `description` | `string` | texto literal del banco |
| `counterparty?`, `balance?`, `reference?`, `currency?` | | |
| `originalRow?`, `rawData?`, `raw?` | | trazabilidad de fila |
| `isDuplicate?`, `duplicateHash?` | | solo intra-fichero, no usados después |

Esto **es** ya, en memoria, una «línea de extracto». Lo que E1 quiere persistir existe como estructura; lo que no existe es un store para ella.

### 1.2 · Orquestación — `bankStatementOrchestrator.ts`

`processFile` (`:154-220`) hace, en este orden **[V]**:

| paso | línea | qué hace | escribe en DB |
|---|---|---|---|
| 1 | `:163-164` | `generateBatchHash(file)` → SHA-256 del fichero completo (`batchHashUtils.ts:76-99`) | no |
| 2 | `:165-168` | `findBatchByHash` (`:135-145`, `getAll('importBatches')` y filtro) → si hay batch con el mismo `hashLote` y no `allowReimport`, lanza `StatementAlreadyImportedError` **antes de parsear** | no |
| 3 | `:176` | `resolveFormat` por extensión (`:499-506`) | no |
| 4 | `:186` | `deriveBankHintFromAccount` (`:324-358`): lee `accounts` y deduce banco por IBAN / nombre / código | no |
| 5 | `:188-203` | `bankProfileMatcher.match` + avisos de confianza | no |
| 6 | `:205-212` | `BankParserService.parseFile` → `ParsedMovement[]` | no |
| 7 | `:214` | `procesarLoteParseado(...)` | **sí** (ver abajo) |

`processPdf` (`:228-258`) repite 1-2, lee con IA (`:246`) y entra en el mismo `procesarLoteParseado` (`:252`).

`procesarLoteParseado` (`:265-318`) **[V]**:

| paso | línea | qué hace | escribe |
|---|---|---|---|
| a | `:271` | `filterByPeriod` (no-op en producción, ver 1.0) | no |
| b | `:274-281` | `persistImportBatch` (`:556-584`) → **`db.put('importBatches', batch)` `:582`** con `importedRows: 0` | `importBatches` |
| c | `:282` | `insertMovements` (`:619-691`) → **`db.add('movements', …)` `:686`** por cada fila | `movements` |
| d | `:284` | `matchBatch(insertResult.insertedIds)` (`movementMatchingService.ts:80-106`): **relee cada movimiento por id de la DB** (`:92-96`) y lo empareja contra `treasuryEvents` | no |
| e | `:285` | `suggestForUnmatched(matchResult.sinMatch)` (`movementSuggestionService.ts:79-89`): también por id de DB | no |
| f | `:290-303` | relee de DB los `sinMatch` (`:294-297`) y llama `reconocerDeterministas(Movement[])` (`deterministas/matcheoDeterminista.ts:39`) | no |
| g | `:305` | `updateImportBatchSummary` (`:595-611`): `db.put('importBatches')` con `totalRows`, `importedRows`, `duplicatedRows`, `skippedRows` | `importBatches` |
| h | `:307-317` | devuelve `OrchestratorResult` (`:61-81`): `importBatchId`, contadores, `matchResult`, `suggestions`, `reconocido`, `warnings` | — |

**[V]** Ni `processFile` ni `procesarLoteParseado` tocan `treasuryEvents` ni reglas de aprendizaje. Eso lo hace `confirmDecisions` (`:360-477`) al pulsar Guardar.

### 1.3 · La escritura exacta en `movements` — `insertMovements` (`:619-691`)

- **[V]** `:626-627`: lee **todos** los movimientos de la base (`getAll('movements')`, de todas las cuentas) y calcula un `Set` de `hashMovement` de cada uno.
- **[V]** Por cada `ParsedMovement` (`:632`):
  - `:633-634` `isoDate(row.date)`; sin fecha válida → `continue` (la fila **se pierde en silencio**: no cuenta como duplicada ni como error; solo aparece en `skippedRows = parsed − inserted − duplicates`, `:609`).
  - `:635-636` importe no finito → `continue` (igual).
  - `:639-672` construye el `Movement` completo (campos en la tabla de abajo).
  - `:681-684` si `hashMovement(candidate)` ya existía → `duplicates++` y `continue`. **El hash del nuevo NO se añade al set** (`:674-680`), así que dos líneas idénticas del mismo fichero entran las dos (test `1b`, `bankStatementOrchestrator.test.ts:221`).
  - **`:686` `const id = await db.add('movements', candidate)`** ← el punto exacto.
- **[V]** Escribe **todas** las filas que pasan los tres filtros, **de golpe** (en el sentido de: en el mismo `processFile`, antes de devolver nada a la UI), **una a una** (un `add` por fila, sin `transaction` explícita). Un fallo a mitad deja un lote parcialmente insertado con el `importBatches` ya escrito **[D]**.

Campos con los que nace un movimiento importado (`:639-672`) **[V]**:

| campo | valor |
|---|---|
| `accountId` | la cuenta destino elegida en la UI |
| `date` / `valueDate` | día local ISO (`isoDate`, `:534-547`); `valueDate` cae a `date` |
| `amount` | tal cual, con signo |
| `description` | texto literal del banco (`row.description ?? ''`) |
| `counterparty` | columna del banco o deducido de Bizum (`:652`) |
| `paymentMethod` | `'Bizum'` si el texto lo parece (`:653`) |
| `reference`, `balance`, `currency` | del parser |
| `unifiedStatus` | `'no_planificado'` |
| `source` | `'import'` |
| `type` | `'Ingreso'` / `'Gasto'` por signo |
| `origin` | `'CSV'` (también para PDF) |
| `movementState` | `'Confirmado'` |
| `state` / `status` | `'pending'` / `'pendiente'` |
| `category` | `{ tipo: 'Ingresos' \| 'Gastos' }` |
| `ambito` | `'PERSONAL'` |
| `statusConciliacion` | `'sin_match'` |
| `importBatch` | id del lote |
| `createdAt` / `updatedAt` | ahora |

**[V]** El id del lote se genera en `:565`: `import_${Date.now()}_${random}`; el store `importBatches` tiene `keyPath: 'id'` sin autoincremento (`src/services/db/upgrade-a.ts:225`).

### 1.4 · ¿Hay algún punto donde una línea NO se convierta en movimiento?

Durante la importación, solo estos cuatro **[V]**:

1. Sin fecha parseable (`:633-634`).
2. Sin importe numérico (`:635-636`).
3. Fuera del periodo (`:271`, `:508-521`) — **inactivo en producción** porque el drawer no pasa periodo.
4. Duplicado por `hashMovement` contra lo ya existente (`:681-684`).

**Todo lo demás entra como `Movement`**: traspasos, retiradas de efectivo, líneas que el usuario va a ignorar, líneas «te necesitan». No hay apartado. Lo que pasa después con cada una:

- **Ignoradas** (`payloadDeConfirmacion` → `ignoredMovementIds`, `extractoSesion.ts:319-326`): `confirmDecisions:466-476` las deja como `no_planificado` / `sin_match` **y no las borra**; además su `hashLinea` se apunta en `ImportBatch.lineasIgnoradas` (`DrawerExtracto.tsx:386-392` → `statementIgnoredLinesService.ts:83-101`). **[D]** Es decir: una línea ignorada **sigue existiendo como `Movement` con `source: 'import'`** tras Guardar y, por 1.3 y `punteoModel.ts:60-62`, el saldo y el punteo la cuentan como conciliada.
- **Sin resolver («te necesitan»)**: `lineasPendientes()` devuelve **siempre `[]`** desde FASE 1 (`extractoSesion.ts:391-396`), así que `consolidarSesion` (`statementSessionService.ts:101-108`) **no borra nada** y `lineasPendientes` del batch **nunca se rellena**. Se quedan como `Movement` `no_planificado` y cuentan en saldo.
- **Traspaso / efectivo** (`DrawerExtracto.tsx:397-410` → `convertirEnTraspaso`, `traspasoDesdeMovimiento.ts:59-130`): el movimiento importado **se transforma** en pata de salida (`put` `:126`) y nace la pata de entrada (`add` `:117`). No se descarta.
- **Cuadra con confirmado** (`aplicarReconciliacionConfirmado`, `reconciliarConfirmado.ts:45-140`): sobrevive la **línea del import** (`put` `:58`) y se **borra el confirmado manual** (`delete` `:136`), repuntando patas y líneas de gasto.
- **Salir sin guardar** (`DrawerExtracto.tsx:434-445` → `cancelImportBatch`, `:479-495`): borra por `Movement.importBatch` (`getAll` + filtro, `:481-482`; **no usa el índice `importBatch`** que existe en `upgrade-a.ts:218`) y luego el batch (`:488`).

**[D] Efecto colateral del «crear desde ficha» a mitad de sesión:** `crearDesdeFicha` (`DrawerExtracto.tsx:453-503`, y en bloque `:560-580`) llama a `gastoDesdeMovimiento` (`altaMovimientoService.ts:430-531`) o `mejoraDesdeMovimiento` (`:211-250`) **antes de Guardar**. Esas funciones hacen `put('movements')` (`:458`, `:224`) y crean filas en `gastosInmueble` (`:530`) o `mejorasInmueble` (`:250`). Si después el usuario pulsa «salir sin guardar», `cancelImportBatch` borra los movimientos pero **no toca** `gastosInmueble` ni `mejorasInmueble` (grep: el orquestador no nombra esos stores). Queda una fila de gasto/mejora apuntando a un `movimientoId` inexistente.

---

## 2 · `importBatches` — qué es hoy

### 2.1 · Interface y store

**[V]** `src/services/db/types-fiscal.ts:104-177`:

| campo | tipo | quién lo escribe |
|---|---|---|
| `id?` | `string` (`import_…`) | `persistImportBatch:565` |
| `filename` | `string` | `:568` |
| `accountId` | `number` | `:569` |
| `totalRows`, `importedRows`, `skippedRows`, `duplicatedRows`, `errorRows` | contadores | `:570-574` (ceros) → `updateImportBatchSummary:604-610` |
| `origenBanco` | `string` | `:575` (`bankProfileUsed ?? 'unknown'`; `'IA (PDF)'` para PDF) |
| `formatoDetectado` | `'CSV' \| 'XLS' \| 'XLSX'` | `:576` (CSB43 se guarda como CSV, `:586-593`) |
| `cuentaIban?` | | **nadie en el orquestador** |
| `rangoFechas` | `{min,max}` | `:577` — **siempre `''`/`''`** en producción (viene de `periodStart/End`, que el drawer no pasa). No se calcula de las líneas. |
| `timestampImport` | ISO | `:578` |
| `hashLote` | SHA-256 | `:579` |
| `lineasIgnoradas?` | `{hashLinea, ignoradaAt}[]` | `statementIgnoredLinesService.ts:96-99` (al Guardar) |
| `consolidadoAt?` | ISO | `statementSessionService.ts:110-112` (al Guardar) |
| `lineasPendientes?` | `{hashLinea, fecha, importe, concepto}[]` | `:113-121` — **nunca, porque la lista llega vacía** |
| `usuario?`, `inboxItemId?` | | solo el camino muerto de `treasuryApiService` |
| `createdAt` | ISO | `:580` |

**[V]** Store: `src/services/db/upgrade-a.ts:224-228`, `keyPath: 'id'`, índices `accountId` y `createdAt`. Declarado en `src/services/db.ts:107`.

### 2.2 · ¿Guarda las líneas del fichero?

**No. [V]** Ni las líneas ni el contenido. Lo único por línea son **hashes** de las ignoradas. El comentario del camino legacy lo dice explícitamente («NO FILE CONTENT», `treasuryApiService.ts:739`), y el orquestador sigue el mismo criterio.

**[V]** El fichero como tal se persiste **solo al Guardar**, como documento en el Archivo (`archivarExtracto`, `statementSessionService.ts:143-178`, llamado desde `DrawerExtracto.tsx:413-419`), con el periodo deducido de las fechas de las líneas. Si la sesión se cierra sin guardar (o el navegador se cae), **el fichero no está en ningún sitio**.

### 2.3 · ¿Se puede reconstruir/borrar un fichero desde `importBatches` sin tocar `movements`?

- **Reconstruir: no. [D]** Con lo que hay en el batch (metadatos, contadores, hashes de ignoradas) no se puede volver a mostrar ni una línea. Todo el detalle está en `movements`.
- **Borrar: solo vía `movements`. [V]** `cancelImportBatch:479-495` localiza qué borrar por `Movement.importBatch`. No hay ninguna otra operación de «deshacer una importación» (`consolidarSesion` no deshace; `v88-borrarCuentasDeTarjeta.ts` borra batches por cuenta en una migración, no por lote).

### 2.4 · Qué liga un `Movement` a su batch, y si sobrevive

- **[V]** `Movement.importBatch?: string` (`types-movimientos.ts:122`), escrito en `:669`. Índice `importBatch` en el store (`upgrade-a.ts:218`).
- **[V]** Ningún código de producción lo borra ni lo reescribe tras consolidar (grep de `.importBatch`/`importBatch:` fuera de orquestador/sesión/tipos: solo `DrawerExtracto.tsx:278`, lectura). Sí **sobrevive** para deshacer.
- **[D]** Pero deshacer **después de Guardar** no sería limpio: `confirmDecisions` ha marcado eventos como `executed` (`:378-389`), cerrado líneas de gasto (`:421`), creado reglas (`:430-434`), y `convertirEnTraspaso` ha creado patas nuevas **sin** `importBatch` (`traspasoDesdeMovimiento.ts:80-118`: los estados «se fijan enteros, no se heredan», y `reference: undefined`; si `importBatch` se hereda o no por el spread inicial no se ha verificado en ejecución). `cancelImportBatch` solo borra movimientos, no revierte nada de eso.

### 2.5 · El otro escritor de `importBatches`

**[V]** `TreasuryImportAPI.importTransactions` (`src/services/treasuryApiService.ts:541-760`) es un importador **completo y paralelo**: parsea con el mismo `BankParserService` (`:590-592`), dedupe propio por `(accountId, date, |amount|<0.01, description)` (`:644-660`), inserta (`:722`), escribe el batch (`:740`) y lanza `performAutoReconciliation`. **No tiene ningún llamante de producción** (grep de `importTransactions`/`TreasuryImportAPI`/`treasuryAPI.import` fuera de su fichero y tests: vacío). Es código muerto que **sigue compilando y sigue exportado** (`treasuryAPI`, `:811`). Mientras exista, cualquier cambio de esquema en `ImportBatch` o `Movement` tiene que seguir siendo compatible con él, o hay que retirarlo.

---

## 3 · QUIÉN DEPENDE de que los movimientos existan al importar

### 3.1 · Cuántos lectores hay

Dos recuentos, y los dos son verdad **[V]**:

| método | resultado |
|---|---|
| `node scripts/censo-stores.mjs --json` (resuelve literal, constante y `objectStore()`), excluidos tests | **60 sitios de lectura** en **38 ficheros** · **45 sitios de escritura** |
| `grep -rl "'movements'" src` excluidos tests | **45 ficheros** que nombran el store (lectura o escritura) |

El «~60» de la auditoría anterior son **sitios de lectura**, no ficheros. Confirmado.

### 3.2 · Lo que se ROMPE si dejo de crear movimientos al importar (trabaja sobre `Movement.id` ya insertado)

Esto es el grupo A: hay que reescribirlo o darle otra entrada. Todo **[V]**:

| pieza | fichero:línea | cómo depende |
|---|---|---|
| Emparejamiento con previstos | `movementMatchingService.ts:80-106` | recibe `movementIds`, relee por id (`:92-96`), devuelve `matches/multiMatches/sinMatch` por `movementId` |
| Sugerencias | `movementSuggestionService.ts:79-89` | ídem, por id |
| Reconocimiento determinista | `bankStatementOrchestrator.ts:290-303` + `matcheoDeterminista.ts:39` | recibe `Movement[]` (los relee el orquestador); `OrigenDeterminista.movementId` |
| Cierre determinista | `deterministas/cierreDeterminista.ts:90-98` | `get('movements', o.movementId)` + `put` |
| Conciliación con confirmados | `conciliacionConfirmados.ts:139-145` (recibe `Movement[]` del lote) y `reconciliarConfirmado.ts:45-140` (`put` del import, `delete` del confirmado) | por id y por objeto |
| `confirmDecisions` | `bankStatementOrchestrator.ts:360-477` | todo el payload son `movementId` (`:84-100`); `get`/`put` en `:371`, `:396`, `:459`, `:468-470` |
| Aprendizaje | `confirmDecisions:430-434` → `feedLearningRule(movement, …)` | recibe el `Movement` |
| Cierre de línea de gasto del evento | `:421` → `cerrarLineaDeGastoDelEvento(db, event, movement)` | recibe el `Movement` |
| **Modelo de sesión** | `extractoSesion.ts:27-67` (`LineaExtracto.movementId`), `:146-244` (`construirLineas(Movement[], …)`), `:77-125` (`DecisionesSesion`: `Set`/`Map` de `movementId`) | **la identidad de línea en toda la sesión es el `Movement.id` autoincrement** |
| Drawer | `DrawerExtracto.tsx:273-286` | relee `getAll('movements')` y filtra por `importBatch` (`:278`) para construir las líneas |
| Traspaso / efectivo | `traspasoDesdeMovimiento.ts:59-130` | `get` por id (`:64`), exige que exista (`MovimientoNoEncontradoError`) |
| Ficha de gasto / mejora (a mitad de sesión) | `altaMovimientoService.ts:430-531`, `:211-250` | `get`+`put` por id, crea `gastosInmueble`/`mejorasInmueble` |
| Ignorar / recuperar | `statementIgnoredLinesService.ts:83-121` | **NO depende**: usa `StatementLineIdentity` (fecha, importe, texto). Es la única pieza del flujo que ya habla en «líneas» |
| Consolidar | `statementSessionService.ts:84-124` | borra por `movementId` (hoy lista vacía) |
| Cancelar | `bankStatementOrchestrator.ts:479-495` | por `Movement.importBatch` |
| Tests | `bankStatementOrchestrator.test.ts` (10), `statementSessionService.test.ts` (11), `conciliacionCaminosCompletos.test.ts` (13), `huellaDeDuplicado.test.ts` (3), `extractoSesion.test.ts` (44), `statementIgnoredLinesService.test.ts` (14) | los que afirman «processFile inserta N» o construyen `LineaExtracto` con `movementId` habrá que reescribirlos |

**Respuesta a la pregunta clave:** **[V]** el matcheo/conciliación actual opera **sobre movimientos ya creados**, no sobre las líneas del parseo. `ParsedMovement[]` vive solo entre `parseFile` y `insertMovements`; a partir de `:686` todo es `Movement.id`.

### 3.3 · Lo que HOY ve los borradores sin querer (y que NO se rompe, sino que mejora)

Grupo B: lectores fuera del flujo que **no aplican** `sinBorradores`. Si importar deja de crear movimientos, **dejan de ver lo no resuelto**, que es el objetivo. Pero cambia lo que el usuario ve hoy (ver 3.4). Todo **[V]** por el censo:

| lector | línea | qué calcula | ¿filtra borrador / estado? |
|---|---|---|---|
| **Saldo vivo** `calculateAccountBalanceAtDate` | `accountBalanceService.ts:103-135` | suma **todo** movimiento de la cuenta (`m.accountId === account.id`, sin mirar `unifiedStatus`, `source` ni `importBatch`) | **no** |
| `calculateTotalInitialCash`, `rollForwardAccountBalancesToMonth` | `:140-150`, `:160-172` | `getAll('movements')` propio; el segundo **persiste** `account.balance`; lo llaman `treasurySyncService.ts:172` y `dashboardService.ts:1410` | **no** |
| Panel («hoy tienes») | `src/modules/panel/PanelPage.tsx:192` → `:324-334` | saldo con `accountBalanceService` sobre `getAll` sin filtro | **no** |
| Saldo del wizard | `getCurrentSaldoCuenta.ts:37-41` | ídem | **no** |
| Tesorería V6 | `TesoreriaV6Page.tsx:218-229` → `:361-380` | ídem pero **con** `sinBorradores` | **sí (el único)** |
| Presupuesto anual | `presupuestoAnualService.ts:360` | | no |
| Estimación fiscal en curso | `estimacionFiscalEnCursoService.ts:84` | | no |
| Informe tesorería | `generateTesoreria.ts:25` | | no |
| Comparativa proyección | `comparativaService.ts:203` | | no |
| Exportación ATLAS | `atlasExportService.ts:669` | | no |
| Fondos | `fondosService.ts:37` | | no |
| Detección de compromisos / onboarding / recurrentes | `compromisoDetectionService.ts:249`, `onboardingDetectionService.ts:284`, `compromisosRecurrentesService.ts:750` | | no |
| Previsión (índice `status='pendiente'`) | `treasuryForecastService.ts:360` | los importados nacen con `status: 'pendiente'` (`:663`) → **entran** | no |
| Conciliar extracto de tarjeta | `conciliarExtractoTarjeta.ts:97` | | no |
| Cuentas (borrado en cascada) | `cuentasService.ts:732`, `:912` | | no |
| Eventos / creación | `treasuryEventsService.ts:64`, `treasuryCreationService.ts:294` | | no |
| Migraciones / limpieza / diagnóstico | `backfillClasificacionConciliados.ts:66`, `reconciliarDuplicadosExistentes.ts:50`, `demoDataCleanupService.ts:112-268`, `v88-borrarCuentasDeTarjeta.ts`, `__buscarApunteAudit.ts:271`, `__tarjetaDiagnostico.ts:78` | | no |
| Líneas anuales de inmueble | `LineasAnualesTab.tsx:130`, `:953` | por `movimientoId` | no |

**[D]** Consecuencia hoy: soltar un fichero en el drawer y **no hacer nada** ya cambia el saldo del Panel, del wizard y de cualquier `rollForward` que se ejecute entre medias, aunque la pantalla de Tesorería V6 no lo enseñe. El comentario de `types-fiscal.ts:149-152` («la V6 no cuenta sus movimientos… y ahí sigue sin contar, que es lo seguro») es correcto **solo dentro de la V6**.

### 3.4 · Lo que cambia para el usuario si E1 se hace tal cual (a decidir, no técnico)

**[D]** Hoy, **después de Guardar**, las líneas «te necesitan» sin resolver y las **ignoradas** siguen siendo `Movement` (1.4) y **cuentan en el saldo** de todas las pantallas. Con E1 («el movimiento nace solo al conciliar/confirmar/crear»), esas líneas **no** contarían hasta que alguien las resuelva. Es decir: el saldo que enseña ATLAS **bajaría/subiría** respecto a hoy en el importe de lo no resuelto. Es coherente con §4.7 («lo no resuelto espera en el extracto»), pero es un cambio visible que conviene decidir antes de codificar: ¿el saldo vivo debe incluir lo que el banco ya cobró aunque ATLAS no sepa clasificarlo? Hoy sí; con E1 literal, no.

---

## 4 · EL ESTADO DE SESIÓN / CONCILIACIÓN ACTUAL

### 4.1 · ¿Existe una «sesión de extracto»? Dónde vive

Sí, en **tres capas** **[V]**:

1. **Modelo puro** — `src/modules/tesoreria/v6/extractoSesion.ts` (516 líneas). Define `LineaExtracto` (`:27-67`: `movementId`, `hashLinea`, `textoBanco`, `fecha`, `referencia`, `contraparte`, `importe`, `veredicto`, `previsto?`, `confirmado?`, `candidatos?`), `DecisionesSesion` (`:77-125`: `asignados: Map`, `ignorados: Set`, `recuperados`, `creados`, `aEfectivo`, `aTraspaso: Map`, …), y las funciones que traducen decisiones a payload (`payloadDeConfirmacion:304-368`, `lineasAIgnorar:369`, `movimientosAEfectivo:419`, `movimientosATraspaso:478`). Sin acceso a DB.
2. **Estado React** — `DrawerExtracto.tsx:105-168` (`useState`: `paso`, `resultado: OrchestratorResult`, `lineas: LineaExtracto[]`, `previstos`, `reglas`, `creando`, …; `useRef`: `ficheroRef` con el `File`, `pendienteRef`) y `decisionesDeSesion.ts:53` (`useState<DecisionesSesion>`). **Todo en memoria de la pestaña.** No hay store, `localStorage` ni `sessionStorage` (grep en `decisionesDeSesion.ts`: solo `useState`).
3. **Marca en DB** — `src/services/statementSessionService.ts`: `ImportBatch.consolidadoAt` ausente = borrador (`:21-22`, `:36-44`), `sinBorradores` (`:52-58`), `consolidarSesion` (`:84-124`), `estaConsolidada` (`:127-131`), `archivarExtracto` (`:143-178`).

**[D]** Por tanto, lo que persiste de una sesión a medias es: el `ImportBatch` sin `consolidadoAt`, sus `Movement` (invisibles en V6, visibles en el resto), y las filas de `gastosInmueble`/`mejorasInmueble` que el usuario haya creado desde la ficha. **No** persisten: las decisiones (asignar, ignorar, traspaso, efectivo), los veredictos, el `matchResult`, ni el fichero. Cerrar la pestaña = perder el trabajo de la sesión y dejar un borrador huérfano que **no se ofrece retomar** (no hay UI que liste batches sin `consolidadoAt`; grep de `batchesEnBorrador`: solo el filtro de la página).

### 4.2 · El comentario «cirugía mayor», literal

`src/services/statementSessionService.ts:1-23` **[V]**:

> ```
> // El problema que resuelve, en una frase: `processFile` inserta los movimientos
> // al procesar el fichero, pero §4.7 dice que "lo no resuelto no se mezcla con
> // la lista de la cuenta: espera en el extracto".
> //
> // Las dos cosas no pueden ser verdad a la vez sin un filtro. Los movimientos
> // recién insertados nacen con `source: 'import'`, y en el modelo de punteo eso
> // es `conciliado` (`punteoModel.estadoDeMovimiento`). Sin este filtro, soltar
> // un fichero en la dropzone haría aparecer TODAS sus líneas en el drawer de
> // cuenta, ya conciliadas, antes de que el usuario mire ninguna — y moviendo el
> // saldo. Justo lo contrario de lo que pide la sección.
> //
> // La alternativa era reescribir `processFile` para no insertar hasta el final.
> // Se descartó: es cirugía mayor sobre un servicio en producción con otro
> // consumidor vivo, y el emparejamiento (`matchBatch`) trabaja sobre ids ya
> // insertados. Marcar la sesión es aditivo y se comprueba en un solo sitio.
> //
> // Regla: un `ImportBatch` sin `consolidadoAt` es un BORRADOR, y sus movimientos
> // no existen para nadie fuera del drawer que los está resolviendo.
> ```

Contraste con el código de hoy:

| afirmación del comentario | estado en `b4af0d2` |
|---|---|
| «`processFile` inserta los movimientos al procesar» | **[V]** cierto (`:686`) |
| «`source: 'import'` es conciliado en el punteo» | **[V]** cierto (`punteoModel.ts:60-62`) |
| «otro consumidor vivo» de `processFile` | **[V] ya no**: un solo llamante (`DrawerExtracto.tsx:270`). El comentario es de `232f5e9` (#1791); desde entonces el drawer es la única entrada. El importador paralelo (`treasuryApiService`) nunca llamó a `processFile` y hoy no tiene llamantes. |
| «`matchBatch` trabaja sobre ids ya insertados» | **[V]** cierto (`movementMatchingService.ts:92-96`), y no solo él: 3.2 entero |
| «se comprueba en un solo sitio» | **[V]** cierto, y ese es el problema: **un** sitio (`TesoreriaV6Page.tsx:229`) de 60 lectores |
| «sus movimientos no existen para nadie fuera del drawer» | **[V] falso** fuera de la V6 (3.3) |

El mismo argumento está repetido en `types-fiscal.ts:139-154` (`consolidadoAt`) y `:155-165` (`lineasPendientes`).

### 4.3 · El precedente: tarjeta

**[V]** El extracto de tarjeta ya sigue el patrón que E1 quiere: `leerExtractoTarjeta` (`extractoTarjeta.ts:107`) → `LineaExtractoTarjeta[]` en memoria → `planificarExtractoTarjeta` (`conciliarExtractoTarjeta.ts:130`, «se LEE y se EMPAREJA sin escribir nada», `:5-8`) → `aplicarPlanTarjeta` (`:154`) solo al confirmar. `PanelExtractoTarjeta.tsx:39` y `:67`. No persiste las líneas entre sesiones (tampoco lo pretende), pero demuestra que el emparejamiento puede correr sobre líneas sin `Movement.id`.

---

## 5 · DEDUPE

Hay **cuatro** huellas vivas y una muerta. Todas **[V]**:

| # | nombre | fórmula | campos | dónde se calcula | dónde se aplica | ámbito |
|---|---|---|---|---|---|---|
| 1 | `hashLote` | SHA-256 del `ArrayBuffer` del fichero (respaldo `generateFallbackHash` si `crypto.subtle` falla) | bytes completos | `batchHashUtils.ts:76-99` | `orchestrator:163-174` (bloquea reimport salvo `allowReimport`), `findBatchByHash:135-145` | fichero |
| 2 | `hashMovement` | `${accountId}\|${date}\|${céntimos}\|${description.trim()}` | cuenta, fecha de cargo, importe, **descripción cruda** (solo `trim`) | `orchestrator:701-707` | `insertMovements:626-627` (set de **todos** los movimientos existentes, de todas las cuentas y orígenes, incluidos manuales y saldo de apertura) y `:681-684` | movimiento vs. base |
| 3 | `hashLinea` | `v1:${iso}\|${céntimos}\|${normalizeDescription(desc)}` | fecha, importe, **descripción normalizada** (minúsculas, sin acentos, sin puntuación, espacios colapsados) — **sin cuenta** | `batchHashUtils.ts:49-54` (`normalizeDescription` de `duplicateDetection.ts:43-56`), versionado `v1` (`:29`, `:57-59`) | `ImportBatch.lineasIgnoradas` (`statementIgnoredLinesService.ts:56-64`, `:83-101`), `LineaExtracto.hashLinea` (`extractoSesion.ts:186-190`) | línea, por cuenta (el servicio consulta los batches de la cuenta, `:38-46`) |
| 4 | `duplicateHash` del parser | base64 de `${fecha}\|${importe.toFixed(2)}\|${desc normalizada}` recortado a 16 | fecha, importe, descripción normalizada | `duplicateDetection.ts:8-27`, `detectDuplicates:58-80` | `bankParser.ts:657` marca `isDuplicate`; **nadie lo consume** salvo contar (`:231`) | intra-fichero |
| 5 | legacy `treasuryApiService` | `accountId` igual, `date` igual, `\|amount−x\|<0.01`, `description` igual | | `:644-660` | camino muerto | — |

Además: **[V]** el índice compuesto `duplicate-key` (`accountId, date, amount, description`) existe en el store (`upgrade-a.ts:220`) y **no lo usa nadie** (grep: solo un test de estructura).

Observaciones que importan para E2 (solape) y para el reimport **[D]**:

- **#2 y #3 no coinciden.** Dos líneas iguales salvo por acentos/puntuación/mayúsculas son «la misma» para `hashLinea` y «distintas» para `hashMovement`. Y #2 lleva cuenta, #3 no. Al reimportar un fichero solapado con `allowReimport`, lo que decide si una línea entra es #2; lo que decide si se enseña como ignorada es #3.
- **#2 depende de `description` cruda**, y por eso `confirmDecisions:404-409`, `reconciliarConfirmado.ts:65-68` y `extractoSesion.ts:38-44` se prohíben reescribirla (guardan el nombre legible aparte, en `descripcionPrevision`). Cualquier E1 que persista líneas tiene que conservar el texto **exacto** del banco o perder el dedupe entre importaciones.
- **#2 compara contra toda la base**, no contra la cuenta: una línea idéntica en otra cuenta (mismo importe, fecha y texto) no colisiona porque `accountId` va en la clave, pero el `getAll` completo es O(total) por importación.
- **#2 no dedupe intra-lote** a propósito (`:674-680`, test `1b`). #4 sí lo detecta y se ignora. Si E1 quiere avisar «hay dos cargos iguales en el fichero», el dato ya existe en `ParsedMovement.isDuplicate`.
- **Reimportar el mismo fichero** hoy: bloqueado por #1; con `allowReimport`, #2 descarta todas las líneas (test `2 bis`, 0 insertadas) **pero se crea un `ImportBatch` nuevo igualmente** (`:274-281` va antes de `insertMovements`), de modo que quedan dos batches con el mismo `hashLote` (`findBatchByHash:128-131` ya lo contempla).

---

## 6 · VALORACIÓN DE CC · por dónde partir E1 en sub-tareas seguras

Lectura del código, no decisión. El criterio: cada sub-tarea deja la app funcionando igual que antes, con tests verdes, y puede mergearse sola.

**E1.0 · Retirar el importador muerto.** Borrar `TreasuryImportAPI.importTransactions` (`treasuryApiService.ts:530-810`) y su exportación. Cero llamantes verificados. Quita el único «otro consumidor» que podría frenar cambios de esquema y elimina el segundo dedupe. Riesgo nulo; tamaño pequeño.

**E1.1 · Nuevo store `lineasExtracto` (o campo del batch) — aditivo, sin lectores.** Bump físico de DB con un store `lineasExtracto` (`keyPath id` autoincrement, índices `importBatchId`, `accountId`, `hashLinea`) cuyo registro sea, esencialmente, el `ParsedMovement` serializado (`date`/`valueDate` como ISO, `amount`, `description` **cruda**, `counterparty`, `reference`, `balance`, `currency`, `originalRow`) más `importBatchId`, `accountId`, `hashLinea`, `hashMovement`, y un `estado` (`pendiente | conciliada | creada | ignorada | traspaso | duplicada`) y `movementId?`. En esta sub-tarea el orquestador **además** de insertar en `movements` escribe la línea, y la enlaza (`movementId`). Nada la lee todavía. Riesgo: solo el upgrade de DB (el patrón `contains()` ya existe). Ventaja inmediata: `ImportBatch` pasa a poder reconstruir un fichero (2.3) y `cancelImportBatch` puede borrar por índice.

**E1.2 · Hacer que la sesión hable en `lineaId` y no en `movementId`.** `LineaExtracto.movementId` → `lineaId` (+ `movementId?`), `DecisionesSesion` sobre `lineaId`, `construirLineas` desde `lineasExtracto` en vez de `getAll('movements')` filtrado (`DrawerExtracto.tsx:273-286`). Como en E1.1 cada línea sigue teniendo su `movementId`, `payloadDeConfirmacion` puede seguir traduciendo a `movementId` al final y `confirmDecisions` no cambia. Es el cambio más grande de UI (44 tests de `extractoSesion` + drawer), pero **no cambia comportamiento**. Puede hacerse en dos mitades: primero el tipo con ambos ids, luego quitar la dependencia.

**E1.3 · Persistir las decisiones en la línea (retomar una sesión).** Con E1.1 y E1.2, cada gesto del usuario puede escribir `estado`/`decision` en `lineasExtracto` (además de en React). Esto da «retomar un fichero a medias» y elimina el borrador huérfano de 4.1 **sin** tocar todavía cuándo nace el movimiento. Añadir en `ZonaSoltar` la lista de batches sin `consolidadoAt`. Riesgo bajo; valor alto para el usuario.

**E1.4 · El emparejamiento sobre líneas.** `matchBatch`, `suggestForUnmatched`, `reconocerDeterministas` y `confirmadosPorLinea` reciben hoy `Movement`/ids. Darles una entrada alternativa por `LineaExtracto`/`lineaId` (internamente pueden construir un `Movement` en memoria con los mismos campos: la lógica de `collectCandidates` no necesita que esté en la DB). El precedente es `emparejarExtractoTarjeta` (`conciliarExtractoTarjeta.ts:40`). Mantener los tests actuales pasando con un adaptador `Movement → línea`. Esta es la sub-tarea con más código «de servicio» y la que conviene hacer con tests de caracterización antes (los 13 de `conciliacionCaminosCompletos` son un buen punto de partida).

**E1.5 · Dejar de insertar al importar (el corte real).** Solo cuando E1.1-E1.4 estén mergeadas: `insertMovements` deja de hacer `db.add('movements')` y se convierte en `insertLineas`; el `Movement` nace en `confirmDecisions` (para cuadres), en `gastoDesdeMovimiento`/`mejoraDesdeMovimiento` (crear), en `convertirEnTraspaso` (traspaso/efectivo) y en `aplicarReconciliacionConfirmado`; cada uno recibe la línea y escribe `movementId` en ella. `cancelImportBatch` borra líneas, no movimientos. `consolidarSesion` y `sinBorradores` quedan sin función (retirarlos o dejarlos como no-op). **Aquí es donde cambia el saldo** (3.4): hay que decidir antes si las líneas `pendiente` cuentan en `accountBalanceService` (opción: que el saldo sume `lineasExtracto` pendientes de la cuenta, como hoy suma movimientos; o que no, como pide §4.7 literal).

**E1.6 · Limpieza.** Retirar `consolidadoAt`/`lineasPendientes`/`batchesEnBorrador`, el comentario de `statementSessionService.ts:16-19`, el índice `duplicate-key` sin uso, y unificar #2/#3 del dedupe si se decide (sección 5). Reescribir los tests que afirmaban «processFile inserta N».

**Dos decisiones que no son de CC y conviene fijar antes de E1.5:**
1. **Saldo con lo pendiente o sin ello** (3.4).
2. **Qué pasa con las líneas ignoradas**: hoy sobreviven como `Movement` `no_planificado` y cuentan; con E1 serían líneas con `estado: 'ignorada'` y no contarían. Si se quiere mantener el saldo, «ignorar» tendría que seguir materializando algo, y entonces no es «ignorar».

**Orden propuesto:** E1.0 → E1.1 → E1.2 → E1.3 (ya se entrega valor: retomar sesión) → E1.4 → decisiones → E1.5 → E1.6. Cada paso deja `main` mergeable y sin cambio de comportamiento hasta E1.5.
