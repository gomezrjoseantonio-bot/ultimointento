# VERIFICACIÓN · estado real de tesorería / conciliación en `main`

**Fecha:** 2 sep 2026 · **HEAD de `main`:** `9ef1381` (#1836) · **Método:** lectura del código + ejecución de tests. No se ha tocado una sola línea de producto.

Convención de este documento:
- **[V]** VERIFICADO leyendo la línea citada, o ejecutando el test citado.
- **[D]** DEDUCIDO: consecuencia de dos o más hechos verificados, pero no observada en ejecución.

Todos los `fichero:línea` son sobre `9ef1381`. Un comentario del código nunca se usa como prueba de comportamiento: cuando el comentario y el código dicen cosas distintas, se señala.

---

## PARTE A · ESTADO DE LAS FASES

| # | Fase | Estado | Commit |
|---|---|---|---|
| 1 | FASE 1 · no-borrado + cuadre | **MERGEADA en `main` y viva** | `3a8a9a2` (#1827) |
| 2 | 2.0.1 · referencia al movimiento | **MERGEADA, pero nació en el módulo equivocado** · corregida en 2.0.2 | `a4311b7` (#1831) + `670d344` (#1832) |
| 3 | 2.0.2 · ×10, fecha, parser muerto | **MERGEADA** · el parser muerto se borró de verdad | `670d344` (#1832) |
| 4 | 2.1 · cascada de identificación de cuota | **NO EXISTE** · ni código ni commit | — |
| 5 | #1834 · doble conteo de gasto | **MERGEADO** · test de regresión presente y **verde** | `28c1d98` (#1834) |

Además de las cinco del encargo, después de #1830 entraron **#1833, #1835 y #1836**, que no eran fases numeradas y sí cambian el comportamiento de conciliar. Van en la **Parte A bis**.

Las diez PRs #1827–#1836 están en `main` y ninguna ha sido revertida **[V]** (`git log --oneline origin/main`, los diez asuntos aparecen con su número).

### A.1 · FASE 1 · sigue viva

**[V]** El borrado que destruía 88 de 119 líneas está retirado en el sitio que lo causaba: `src/modules/tesoreria/v6/extractoSesion.ts:391-395` — `lineasPendientes()` devuelve **siempre** `[]`. Es la única entrada de la lista que `consolidarSesion` usa para borrar (`DrawerExtracto.tsx:423`).

**[V]** El cuadre existe y **bloquea Guardar**, no solo informa: `conciliarBuckets.ts:111-136` calcula `cuadra = colocadas === lineas.length && huerfanas.length === 0`; `DrawerExtracto.tsx:361-364` corta el guardado con «*No se guarda: N línea(s) del banco no han quedado colocadas*».

**[V]** Los veredictos `mes_cerrado` / `mes_anterior` ya no pueden nacer: `construirLineas` sólo produce `ignorada | cuadra | resolver` (`extractoSesion.ts:215-219`).

**[V]** Tests verdes (ejecutados hoy): `conciliarCuadre`, `extractoSesion`, `conciliarBuckets`, `statementSessionService`, `bankStatementOrchestrator`, `importadorRealBBVA`, `columnaDeReferencia`, `numeroConUnDecimal`, `fechaDelExtracto`, `huellaDeDuplicado` → **10 suites, 128 tests, 0 fallos**.

**Matiz que hay que saber, porque «ninguna línea se pierde» no es absoluto [V]:**
- `cancelImportBatch` (`bankStatementOrchestrator.ts:476-489`) **borra todos los movimientos del lote**. Se invoca al salir con el aspa (`DrawerExtracto.tsx:435-441`). Es un borrado deliberado y con consentimiento, pero es un borrado.
- El `db.delete('movements', …)` de `statementSessionService.ts:104` **sigue en el código**. Hoy no borra nada sólo porque quien lo alimenta devuelve lista vacía. La red de seguridad es un valor de retorno, no una barrera.

### A.2 · 2.0.1 · la referencia · sí llega hoy, y por el parser que corre

El handoff decía «se aplicó en el módulo equivocado». **Es cierto y está corregido**.

**[V]** #1831 arregló `bankProfilesService.mapHeaders`. Ese módulo **no corría** en el camino de importación. #1832 lo borró entero junto con el parser que lo usaba (`git show --stat 670d344`: `src/services/csvParserService.ts` −526 líneas, `bankProfilesService.ts` −66).

**[V]** El arreglo bueno vive en el parser real, `BankParserService`. Cadena completa, línea a línea:

| Paso | Fichero:línea | Qué hace |
|---|---|---|
| 1 | `src/features/inbox/importers/bankParser.ts:540-546` | pasada aparte que rescata la columna del identificador, **sólo si `reference` quedó vacío y sólo sobre columnas que no reclamó nadie** |
| 2 | `src/services/importador/columnaDeReferencia.ts:36-52` | orden de preferencia de alias (`referencia` … `observaciones`, `movimiento`) |
| 3 | `bankParser.ts:705` | lee la celda de esa columna |
| 4 | `bankParser.ts:715` | la pone en `ParsedMovement.reference` |
| 5 | **`src/services/bankStatementOrchestrator.ts:651`** | **`reference: row.reference`** — aquí se escribe en el `Movement` |
| 6 | `bankStatementOrchestrator.ts:683` | `db.add('movements', candidate)` |

**[V]** Hay test punta a punta con las filas reales del extracto de BBVA: `src/services/importador/__tests__/importadorRealBBVA.test.ts:29-42` comprueba sobre la misma cuota que el importe es `-285,40` (no `-2854`), la fecha `2026-02-02` (no el 1) y que `reference` contiene `0182-5322-27-0830842450`. **Ejecutado hoy: pasa.**

**Límite honesto [V]:** ese test entra por `parseSheet`, no por `processFile`. El paso 5 (orchestrator:651) está verificado **leyendo el código**, no ejecutándolo en ese test.

**[D] Riesgo a tener en cuenta para el replanteamiento:** `Movement.reference` es hoy un campo con **dos significados**. Además del texto del banco, es la FK interna de otros caminos: `treasury_event:<id>` (`punteo/punteoAdapter.ts:433`, `reconciliarConfirmado.ts:122`) y `property_sale:<id>` (`propertySaleService.ts:1313`). Hoy no colisiona porque todos los lectores usan prefijo o regex, y `esMovimientoEditable` exige antes `source === 'manual'` (`altaMovimientoService.ts:292`), lo que ya excluye a los importados **[V]**. Pero es un campo sobrecargado y cualquier lector futuro que mire «¿tiene reference?» se equivocará.

### A.3 · 2.0.2 · el parser muerto se borró de verdad

**[V]** `src/services/csvParserService.ts` **no existe** (`ls` → No such file). `grep -rn "csvParserService\|mapHeaders\|celdaDeReferencia" src` → **0 referencias de código**; sólo dos menciones en comentarios que explican el borrado.

**[V]** También se fue `src/pages/ProfileSeederPage.tsx` (−434) y `src/services/__tests__/referenciaDelExtracto.test.ts` (−155, el test que probaba el módulo equivocado).

**Pero quedan dos caminos de importación sin llamante que nadie ha barrido [V]:**

1. **`src/services/universalBankImporter/`** (6 ficheros: `localeDetector`, `signDerivationService`, `dateFormatDetector`, `columnRoleDetector`, `ledgerValidationService`, `localeAmount`). Su único consumidor en todo `src` es un test: `src/tests/treasuryV12Enhanced.test.ts:6-8`.
2. **`TreasuryImportAPI.importTransactions`** (`src/services/treasuryApiService.ts:541-760`): un importador completo y paralelo que **escribe `movements` (`:722`) e `importBatches` (`:740`)**, con su propia deduplicación (`:655-660`), su propio parseo de signo y su propia auto-conciliación (`:742`). `grep` de `TreasuryImportAPI|treasuryAPI.import|importTransactions` sobre todo `src` → **ninguna llamada de producción**; el único import de `treasuryAPI` fuera es `cuentaCobro.ts:22`, que usa `.accounts`, no `.import`. **[D]** Está muerto, pero sigue exportado y compilando, y escribe en los dos stores centrales de tesorería.

### A.4 · FASE 2.1 · cascada de identificación de cuota · NO EXISTE

No hay commit que la implemente (`git log --all` entre #1826 y #1836: ninguno la menciona; #1835 y #1836 tocan sólo la pantalla y `movementSuggestionService`).

Lo que hay hoy para identificar una cuota de préstamo es **fecha + importe exactos y nada más [V]**: `src/services/deterministas/cuotasDePrestamo.ts:65-67` casa con `mismoDia(p.fechaCargo, m.date)` y `mismoImporte(p.cuota, m.amount)`, marca `como: 'fecha_importe'` (`:74`) y, si empatan dos préstamos, **no elige** (`:85`, `if (candidatos.length === 1)`).

Los cuatro escalones de la cascada, uno a uno:

| Escalón de la spec | Estado | Prueba |
|---|---|---|
| nº de contrato | **no implementado** | `grep '\.reference'` en `src/services` + `src/modules`: el único lector del texto del banco es la UI (`extractoSesion.ts:227`, para pintarlo). Nadie lo usa para identificar. |
| prestamista | **no implementado** | `cuotasDePrestamo.ts` no lee `m.reference` ni `m.counterparty` ni el nombre del prestamista. |
| importe recurrente propone/aprende | **parcial y en contra** | El aprendizaje existe (`movementLearningService.createOrUpdateRule`), pero su normalizador **borra los números largos del patrón**: `movementLearningService.ts:54-62` (`removeVolatileTokens`) elimina fechas, importes con decimales, números de ≥4 cifras y códigos alfanuméricos de ≥8. Un nº de contrato no puede llegar a la regla. |
| genérico | es lo que hay | `movementSuggestionService` |

**Conclusión [V]:** 2.1 es **spec en papel**. Y no es sólo «falta escribirla»: el aprendizaje actual está diseñado para tirar justamente el dato en el que se apoyaría el primer escalón.

### A.5 · #1834 · doble conteo de gasto

**[V]** Mergeado en `main` (`28c1d98`). El test de regresión está y pasa:

```
PASS src/services/__tests__/punteoManualCierraLinea.test.ts
  ✓ la línea del recurrente se CIERRA · no nace una segunda (1009 ms)
```

Comprueba contra `fake-indexeddb` real (no un doble) que `confirmTreasuryEvent` sobre una previsión de recurrente deja **una sola** fila en `gastosInmueble`, que es la que ya existía, en estado `confirmado`, con su `treasuryEventId` y conservando la `casillaAEAT` **[V]** (`punteoManualCierraLinea.test.ts:85-107`).

---

## PARTE A bis · TODO LO QUE SE HIZO DESPUÉS DE #1830, PR A PR

La FASE 2 (#1830) no fue el final. Después entraron **seis PRs más**, todas en `main`, ninguna revertida **[V]**. Tres de ellas (#1833, #1835, #1836) no eran fases numeradas del tren y por eso no aparecían en el encargo, pero han cambiado el comportamiento de la pantalla de conciliar más que algunas de las que sí estaban.

| PR | Commit | Qué toca | Estado |
|---|---|---|---|
| #1831 | `a4311b7` | importador · referencia | en `main` · corregida por #1832 |
| #1832 | `670d344` | importador · ×10, fecha, parser muerto | en `main` |
| #1833 | `dff4699` | **detector de sugerencias · el signo** | en `main` · **no estaba en el encargo** |
| #1834 | `28c1d98` | fiscal · doble conteo + censo de stores | en `main` |
| #1835 | `c9ac497` | **pantalla · abrir, corregir, buscar, bloque** | en `main` · **no estaba en el encargo** |
| #1836 | `9ef1381` | **pantalla · enseñar la referencia, no afirmar, clasificar en bloque** | en `main` · **no estaba en el encargo** · es el HEAD |

Tests de estas seis PRs, ejecutados hoy: **19 suites, 231 tests, 0 fallos [V]**.

### #1833 · «el signo manda primero» — un negativo no puede ser una renta

**El fallo real [V]:** el detector proponía «*Parece la renta de un inquilino*» sobre líneas que son dinero que **sale** (`Bizum A Favor De Aroa Gómez −80 €`). Y el nombre coincidía con una inquilina viva **precisamente porque es ella quien cobra**, lo que subía la confianza a 60.

**Lo que se construyó [V]:** módulo nuevo `src/services/sugerencias/signoDelMovimiento.ts` (79 líneas) con la regla en un solo sitio:

- `direccionDelImporte` (`:43`) — `>0 entra`, `<0 sale`, `0 ninguna`.
- `direccionDeLaAccion` (`:57`) — `assign_to_contract` ⇒ entra; `mark_personal_expense` ⇒ sale; `create_treasury_event` según su `type`. `financing` queda fuera a propósito (una disposición entra, una cuota sale).
- `contradiceElSigno` (`:74`) — el guardián.

**[V] El guardián cubre las tres vías, comprobado una a una:** vía A en `movementSuggestionService.ts:101`, vía B en `:108`, y vía C **dentro** de `suggestFromHeuristics` en `:540` (`respetandoElSigno(sugerencia, movement.amount) ?? noSeQueEs(movement)`). La afirmación del commit se sostiene.

**Diseño que importa para el replanteamiento [V]:** una sugerencia que contradice el signo **se descarta entera**, no se «corrige» dándole la vuelta al tipo (`:127-141`, comentario explícito). Y descartar nunca deja la tarjeta vacía: cae a `noSeQueEs(movement)`.

**Alcance honesto:** esto **no** decide si la propuesta es acertada; sólo tira lo imposible. Un ingreso de 900 € puede ser una renta, la devolución de un préstamo o la venta de un sofá.

Test: `src/services/__tests__/elSignoMandaPrimero.test.ts` (318 líneas) · **verde [V]**.

### #1835 · «abrir lo que ATLAS cierra solo, corregirlo, y actuar en bloque»

Cuatro carencias de la pantalla, y las cuatro eran de fondo, no de pintura.

1. **ABRIR [V].** La columna derecha enseñaba «4 · Gas» y punto: `agruparResueltas` contaba, sumaba y **tiraba las líneas**. Ahora el grupo se las lleva dentro (`conciliar/agruparResueltas.ts:37` campo `lineas`, `:109` donde se rellena) y cada fila se despliega con el texto literal del banco, la fecha y el importe.

2. **CORREGIR [V].** No existía vuelta atrás sobre lo que ATLAS cerraba solo. Se añade `desemparejados` a `DecisionesSesion` (`extractoSesion.ts:106-124`) y —esto es lo que lo hace funcionar— **va la primera** de las ramas de `bucketDeLinea` (`conciliarBuckets.ts:68`), justo detrás de «ignorada» y **antes** del `switch` del veredicto automático. Puesta después, el veredicto de la máquina volvería a ganar. **No borra nada:** devuelve la línea a «te necesitan». Y **no designora** — eso sigue siendo «reactivar», que son operaciones sobre poblaciones distintas.

3. **BUSCAR [V].** `conciliar/buscarLineas.ts` — `filtrarPorTexto` (`:65`) busca sin acentos y con varias palabras que piden todas, sobre texto, fecha o importe. Y `atajosDeBusqueda` (`:96`) **calcula** los atajos contando palabras sobre el fichero que hay delante, en vez de una lista fija: así el botón siempre corresponde a algo que está ahí y su contador es verdad por construcción. Mínimo dos líneas para ser atajo (`:19-20`).

4. **EN BLOQUE [V].** Selección por casilla + barra de acciones. Dos reglas con criterio: la barra toca **lo elegido que se ve** (si eliges el gas, buscas «bizum» y le das a ignorar, el gas no se lleva por delante), y el traspaso en bloque **sólo se ofrece sobre cargos**, porque la pata de salida de un traspaso es un cargo y ofrecerlo sobre un abono sería invitar a crear dinero.

**Efecto colateral bueno [V]:** `DrawerExtracto.tsx` pasó de 800 líneas y el trinquete lo paró. Los doce gestos sobre una línea salieron a `decisionesDeSesion.ts` (259 líneas) — que es lo que son, mutaciones puras de `DecisionesSesion`, sin red ni base de datos. El drawer está hoy en **750 líneas [V]**.

Tests: `abrirYCorregir`, `buscarLineas`, `conciliarLayout`, `corregirYEnBloque` · **verdes [V]**.

### #1836 · «enseñar lo que el banco escribió, no afirmar lo que no se sabe»

Es el HEAD de `main`, y **cierra el círculo de #1831/#1832**.

1. **EL DATO ESTABA GUARDADO Y LA PANTALLA LO TIRABA [V].** Dos PRs costó llevar el nº de contrato hasta la base, y `construirLineas` hacía `textoBanco: m.description` y ahí se quedaba. Ahora la línea lleva `referencia` y `contraparte` (`extractoSesion.ts:227-228`) y se pintan bajo el texto del banco (`LineaExtractoItem.tsx:105-107`, unidas por « · »).

   **Y van en campos APARTE, no concatenadas dentro de `description` [V].** No es estética: `generateLineHash` se calcula sobre `description`, y meterle la referencia dentro cambiaría el hash de todos los movimientos ya importados — el dedupe entre importaciones solapadas dejaría de reconocerlos y **los cargos se duplicarían**. Está escrito en el propio tipo (`extractoSesion.ts:38-47`).

2. **LA PROPUESTA AFIRMABA LO QUE NO SABE [V].** «Parece la renta de un inquilino» salía **sin contrato ninguno**, con `action: { kind: 'assign_to_contract', contractId: undefined }`. Dos cosas mal: afirma lo que no sabe (la misma frase salía sobre +200 € y sobre +83,37 €), y **es una acción imposible de ejecutar** — el evento nacería sin `sourceId` ni `contratoId`, huérfano, sin contar para el estado de cobro ni para el dedupe de previsiones.

   Verificado en el diff (`movementSuggestionService.ts:449-480`): ahora, sin contrato reconocido, devuelve `confidence: 30` con `action: { kind: 'ignore' }` y la frase honesta «*Un ingreso que no reconozco · si me dices de quién es una vez, el resto de sus cobros los coloco solos*». Con contrato, `confidence: 60` y `contractId: contrato.id` — ya no opcional.

   **[V]** Dos tests viejos que exigían el `assign_to_contract` sin contrato fueron **invertidos, no borrados**, con el porqué al lado (`asignarCobroAContrato.test.ts`, `movementSuggestionService.test.ts` — ambos verdes hoy).

3. **CLASIFICAR EN BLOQUE [V].** Con cinco recibos del agua marcados, la barra sólo ofrecía «ignorar» y «son traspaso» — justo lo que no se hace con cinco recibos del agua. Ahora la ficha se abre **una vez** y su concepto se aplica a todas: `clasificarEnBloque.ts:32` (`valoresPorLinea`).

   **La regla que evita el desastre [V]:** se comparte **el concepto**; el **importe y la fecha salen de cada línea**, y **el tipo lo manda su signo** (`:36-38`). Copiar los de la primera metería gasto que nunca salió de la cuenta, con fecha falsa, y en la declaración. Por eso la regla vive en su propio módulo con sus propios tests.

4. **LO QUE CUADRA, DICHO ANTES DE PULSAR [V].** El botón pasa de «Asignar a un previsto» a «Asignar a un previsto · 2 cuadran».

Tests: `clasificarEnBloque`, `quePuedoPuntear`, `corregirYEnBloque`, `movementSuggestionService`, `asignarCobroAContrato` · **verdes [V]**.

### Lo que estas tres PRs NO cambian

**[V]** Ninguna toca el modelo de datos. `git show --stat` de las tres: no hay una sola línea en `bankStatementOrchestrator.ts`, ni en `statementSessionService.ts`, ni en `db.ts`, ni en `deterministas/`. Todo es pantalla (`modules/tesoreria/v6/`) y detector de sugerencias.

Es decir: **el fallo central de la Parte B sigue intacto después de #1836.** Importar sigue escribiendo las 300+ líneas en `movements` (`orchestrator:683`), sigue habiendo un solo filtro para esconderlas, y sigue sin poderse retomar un fichero a medias. Lo que #1835 y #1836 arreglan es que ahora, **dentro de la sesión**, se ve lo que hay y se puede corregir y actuar en bloque — que era imprescindible, pero es otra capa.

---

## PARTE B · EL FALLO CENTRAL

### B.1 · Al IMPORTAR, ¿se crean movimientos? · **SÍ, todos, de inmediato**

**[V]** El flujo real, sin intermediarios:

```
DrawerExtracto.tsx:270      processFile(file, {accountId}) | processPdf(...)
  ↓
bankStatementOrchestrator.ts:164   hash del fichero → ¿ya importado? (D1 bis)
bankStatementOrchestrator.ts:206   BankParserService.parseFile → ParsedMovement[]
  ↓
bankStatementOrchestrator.ts:262   procesarLoteParseado
   :271  persistImportBatch      → db.put('importBatches')   (:579)
   :279  insertMovements         → db.add('movements')       (:683)   ← AQUÍ
   :281  matchBatch              (sólo propone, no escribe)
   :282  suggestForUnmatched     (sólo propone)
   :295  reconocerDeterministas  (sólo lee los libros)
```

**El punto exacto: `src/services/bankStatementOrchestrator.ts:683`**

```ts
const id = (await db.add('movements', candidate)) as number;
```

Está dentro de un bucle `for (const row of parsed)` (`:632`), así que **las 300+ líneas se escriben nada más importar**, antes de que el usuario mire ninguna. El `candidate` nace así (`:637-669`) **[V]**:

| Campo | Valor al importar |
|---|---|
| `unifiedStatus` | `'no_planificado'` |
| `source` | `'import'` |
| `movementState` | `'Confirmado'` |
| `state` / `status` | `'pending'` / `'pendiente'` |
| `statusConciliacion` | `'sin_match'` |
| `importBatch` | id del lote |
| `category` | `{ tipo: amount >= 0 ? 'Ingresos' : 'Gastos' }` |

**No se guarda el fichero en bruto en ese momento [V].** El fichero sólo se archiva al pulsar Guardar, y va al store `documents`, no a `importBatches` (`statementSessionService.ts:143-177`, `archivarExtracto` → `saveDocumentWithBlob`).

**Lo que sostiene el invariante «un extracto abierto no mueve saldos» es un filtro, no el modelo [V]:** el `ImportBatch` sin `consolidadoAt` es un borrador, y `TesoreriaV6Page.tsx:221,229` filtra sus movimientos con `sinBorradores(...)`.

**[V] Y ese filtro tiene UN solo consumidor.** `grep -rn "batchesEnBorrador\|sinBorradores" src` → fuera de su propio servicio y sus tests, **sólo** `TesoreriaV6Page.tsx`. Los otros **60 lectores de producción de `movements`** no lo aplican. Entre ellos:

- `accountBalanceService.ts:147,168` — y `rollForwardAccountBalancesToMonth` (`:162-187`) **escribe `accounts.balance`** con ese cálculo (`:182-186`).
- `modules/panel/PanelPage.tsx:192`, `modules/mi-plan/services/presupuestoAnualService.ts:360`, `modules/horizon/informes/generators/generateTesoreria.ts:25`, `estimacionFiscalEnCursoService.ts:84`, `compromisoDetectionService.ts:249`…

El comentario de `types-fiscal.ts:149-152` es preciso al acotar el alcance —dice «**la V6** no cuenta sus movimientos en ningún saldo ni lista»— pero remata con «*un borrador nunca sobrevive a la sesión salvo por cierre abrupto — y ahí sigue sin contar, que es lo seguro*» (`:151-152`). **Eso último no se sostiene fuera de la V6 [D]:** un extracto abierto y sin guardar sí puede mover el saldo persistido de la cuenta y sí entra en panel, informes y estimación fiscal, porque esos 60 lectores no conocen el filtro.

### B.2 · ¿Existe una entidad «fichero cargado / lote» separada? · **Sí, pero es sólo un recibo**

**[V]** `ImportBatch` (`src/services/db/types-fiscal.ts:104-177`) guarda **exclusivamente metadatos**:

`id`, `filename`, `accountId`, contadores (`totalRows`, `importedRows`, `skippedRows`, `duplicatedRows`, `errorRows`), `origenBanco`, `formatoDetectado`, `cuentaIban?`, `rangoFechas{min,max}`, `timestampImport`, `hashLote` (SHA-256 del fichero), `lineasIgnoradas[]` (`hashLinea` + fecha de ignorado), `consolidadoAt?`, `lineasPendientes[]` (`hashLinea`, `fecha`, `importe`, `concepto`), `usuario?`, `inboxItemId?`, `createdAt`.

**No guarda ni una sola línea en bruto del fichero.** El otro camino lo dice explícitamente en el código: `treasuryApiService.ts:738` — *«Save import batch metadata (NO FILE CONTENT)»*.

Respuestas directas:
- **¿Se puede reconstruir el fichero desde ahí?** **No [V].** No hay contenido. Sólo `lineasPendientes[]` conserva identidad de líneas (4 campos), y ese array **hoy nunca se escribe** porque `lineasPendientes()` devuelve `[]` (`extractoSesion.ts:391-395`). Es un campo del modelo que quedó sin fuente.
- **¿Se puede borrar un fichero sin tocar movimientos?** **No [V].** La única operación de borrado de lote es `cancelImportBatch` (`bankStatementOrchestrator.ts:476-489`), que borra **primero los movimientos y luego el batch**. No existe una operación «borra el lote y deja los movimientos» ni la inversa.
- **¿Dónde vive entonces el fichero de verdad?** En `documents`, como blob, sólo si se llegó a Guardar **[V]** (`statementSessionService.ts:143-177`). Y **no lleva FK al `importBatch`**: se vincula por `entityId = cuenta.id` y tags de periodo (`:166-172`). **[D]** No hay forma programática de ir de un lote a su fichero archivado.

### B.3 · ¿Se puede volver a un fichero a medio conciliar? · **NO**

**[V]** Todo el estado de la sesión vive en memoria de React, en `DrawerExtracto.tsx`: el fichero en `ficheroRef` (`:271`), las líneas en `setLineas(...)` (`:284`), y las decisiones del usuario en `decisiones` (`decisionesDeSesion.ts`). **Nada de eso se persiste.**

Sólo hay dos salidas **[V]**:
1. **Guardar** → `confirmDecisions` + `consolidarSesion` (`:423`) → el batch deja de ser borrador.
2. **Aspa / salir sin guardar** → `cancelImportBatch` (`:435-441`) → **se borran los movimientos y el batch**.

**No existe UI para reabrir un lote en borrador [V]:** el único consumidor de `batchesEnBorrador()` es `TesoreriaV6Page.tsx:221`, y lo usa para **esconder**, no para ofrecer retomar.

**[D] Y el cierre abrupto deja el fichero irrecuperable.** Si se cierra la pestaña a media sesión:
- el batch se queda sin `consolidadoAt` para siempre; sus movimientos existen pero están ocultos en la V6 (y, por B.1, sí cuentan en saldos e informes);
- volver a subir el mismo fichero se frena por `hashLote` (`:164-166`);
- y forzando `allowReimport`, `insertMovements` deduplica contra **todos** los movimientos existentes —incluidos los ocultos— (`:623` lee `getAll('movements')`, `:678-681` descarta por `hashMovement`), así que insertaría **cero**.

Resultado: el extracto queda ni conciliado ni recuperable, y sin ninguna pantalla que lo diga.

### B.4 · Relación fichero ↔ movimiento

**[V]** El campo es **`Movement.importBatch`**, escrito en `bankStatementOrchestrator.ts:666` (`importBatch: importBatchId`). Está indexado: `db.ts:106` declara el índice `'importBatch'` en el store `movements`.

**[V] Sobrevive a la conciliación:** `confirmDecisions` (`:357-473`) escribe `categoryKey`, `ambito`, `unifiedStatus`, etc., pero **nunca toca `importBatch`**. El vínculo aguanta indefinidamente.

**[V] Pero «deshacer una importación» sólo existe ANTES de Guardar.** `cancelImportBatch` es la única función que usa ese vínculo para borrar, y su único llamante es el aspa del drawer. Después de consolidar no hay ninguna operación de «deshacer este lote», ni en servicios ni en UI.

---

## PARTE C · MAPA DE LOS 7 STORES DE TESORERÍA

Generado con `node scripts/censo-stores.mjs --json` sobre `9ef1381` **[V]** (resuelve accesos por literal, por constante de módulo y por `objectStore()`). Se listan escritores de producción; los lectores, agrupados por fichero. Se excluyen tests.

### `movements` — la línea del banco
**87 accesos de escritura (46 de producción) · 102 de lectura (60 de producción).** Es el store más manoseado del repo.

**Escriben (producción, agrupado):**
| Fichero | Líneas |
|---|---|
| `bankStatementOrchestrator.ts` | **683** (alta al importar) · 393 (conciliar) · 467 (ignorar) · 482 (cancelar lote) |
| `altaMovimientoService.ts` | 187, 224, 337, 366, 458 |
| `treasuryConfirmationService.ts` | 1031, 1228, 1436 |
| `treasuryApiService.ts` | 302, 310, 473, **722** (importador muerto) |
| `reconciliarConfirmado.ts` | 58, 98, 136 |
| `traspasoDesdeMovimiento.ts` / `traspasoInterno.ts` | 117, 126 / 134 |
| `deterministas/cierreDeterminista.ts` | 98 |
| `statementSessionService.ts` | 104 (borrado D4 · hoy sin fuente) |
| `cuentasService.ts` · `demoDataCleanupService.ts` · `lineasInmuebleService.ts` · `loanSettlementService.ts` · `propertySaleService.ts` · `personal/conciliarExtractoTarjeta.ts` · `treasuryCreationService.ts` · `treasuryForecastService.ts` · `migrations/*` · `db/post-open.ts` · `pages/GestionInmuebles/tabs/LineasAnualesTab.tsx` · `modules/inversiones/pages/FichaPlanPensiones.tsx` | resto |

**Leen (producción · los que deciden dinero):** `accountBalanceService.ts:147,168` · `TesoreriaV6Page.tsx:218` (**único que filtra borradores**) · `DrawerExtracto.tsx:274` · `PanelPage.tsx:192` · `presupuestoAnualService.ts:360` · `generateTesoreria.ts:25` · `estimacionFiscalEnCursoService.ts:84` · `movementMatchingService.ts:94` · `movementSuggestionService.ts:89` · `compromisoDetectionService.ts:249` · `onboardingDetectionService.ts:284,316` · `treasuryConfirmationService.ts:621,879,1015,1224` · `comparativaService.ts:203` · `atlasExportService.ts:669` · +20 más.

### `treasuryEvents` — la previsión
**77 escrituras de producción · 86 lecturas.** Los generadores son quienes lo llenan; el extracto **no** crea eventos.

**Escriben:** `treasuryForecastService.ts` (46,79,105,132,161,189,342) · `treasuryConfirmationService.ts` (706,904,1125,1142,1153,1218,1250,1386,1446,1473,1483) · `treasurySyncService.ts` (249,260,613) · `personal/recibosDeTarjetaPrevistos.ts` (180,197,404,421) · `personal/previsionesDelCompromiso.ts:97` · `prestamos/previsionesDelPlan.ts` (104,127) · `treasuryBootstrapService.ts:149` · `treasuryDiscardService.ts` (36,61) · `treasuryTransferService.ts` (69,90,95) · `cierreDeMes.ts` (213,252,266) · `lineasInmuebleService.ts` (88,130,197) · `duplicadosPrevisionService.ts` (225,311) · `loanSettlementService.ts` (547,614) · `propertySaleService.ts` (1110,1335) · `contractService.ts` (302,307) · `reconciliarConfirmado.ts:126` · `traspasoInterno.ts:121` · **`bankStatementOrchestrator.ts:375`** (única escritura desde el extracto: `predicted → executed` al conciliar) · `db/post-open.ts` + `migrations/*`.

### `importBatches` — el recibo del fichero
**8 escrituras · 9 lecturas.** Store pequeño y muy acotado **[V]**.

| | Fichero:línea |
|---|---|
| **W** | `bankStatementOrchestrator.ts:579` (alta), `:601` (resumen), `:485` (borrado); `statementSessionService.ts:110` (consolidar); `statementIgnoredLinesService.ts:96,118` (ignoradas); `treasuryApiService.ts:740` (importador muerto); `migrations/v88-borrarCuentasDeTarjeta.ts:180` |
| **R** | `bankStatementOrchestrator.ts:138,599`; `statementSessionService.ts:38,89,129`; `statementIgnoredLinesService.ts:42,44,90`; `utils/batchHashUtils.ts:180` |

Ninguna pantalla lo lee directamente **[V]**: sólo lo ven los tres servicios de importación.

### `accounts` — la cuenta
**17 escrituras · 66 lecturas** (el store más leído de tesorería).

| | Fichero:línea |
|---|---|
| **W** | `treasuryApiService.ts:129,177,232,318,412,450,485` (alta/edición/baja) · `cuentasService.ts:222,233,745,932` · **`accountBalanceService.ts:182`** (persiste el saldo calculado) · `treasuryEventsService.ts:103,187` · `demoDataCleanupService.ts:189` · `migrations/v86-tiposDeCuenta.ts:27`, `v88-borrarCuentasDeTarjeta.ts:187` |
| **R** | 66 puntos en toda la app (tesorería, panel, inmuebles, contratos, préstamos, onboarding, informes) |

### `tarjetas` — la tarjeta (V87)
Modelo limpio y encapsulado **[V]**: un único servicio dueño.

| | Fichero:línea |
|---|---|
| **W** | `tarjetasService.ts:86,112,121` · `migrations/v87-tarjetas.ts:89` |
| **R** | `tarjetasService.ts:62,68,104` · `migrations/v87-tarjetas.ts:57` · `__tarjetaDiagnostico.ts:77` |

### `compromisosRecurrentes` — el gasto que se repite
**12 escrituras · 30 lecturas.** También con dueño único, salvo dos excepciones.

| | Fichero:línea |
|---|---|
| **W** | `personal/compromisosRecurrentesService.ts:91,124,197,245,272,341,384` · `propertySaleService.ts:880,1110` (la venta da de baja los compromisos del piso) · `migrations/*` (3) |
| **R** | 30 puntos · principalmente el generador de previsiones (`previsionesDelCompromiso`), la pantalla de gastos y `compromisoDetectionService` |

### `movementLearningRules` — lo que ATLAS aprendió
| | Fichero:línea |
|---|---|
| **W** | `movementLearningService.ts:294,316,390,444` — **una sola puerta** |
| **R** | `movementLearningService.ts:195,261,342,434` · `movementSuggestionService.ts:269` |

Se alimenta **sólo** al Guardar un extracto: `confirmDecisions → feedLearningRule → createOrUpdateRule` **[V]** (`bankStatementOrchestrator.ts:427-432`).

---

### C.1 · ¿Dónde vive el bruto y dónde la interpretación? — **la pregunta que decide el replanteamiento**

**Respuesta corta: la separación de stores existe y está bien pensada, pero la interpretación se COPIA encima del bruto al conciliar, y el bruto no tiene un sitio propio antes de ser movimiento.**

**Lo que está bien [V]:**

| | `movements` | `treasuryEvents` |
|---|---|---|
| Qué es | la línea del banco · **el hecho** | la previsión · **la interpretación** |
| Estado | `unifiedStatus` | `status`: predicted/confirmed/executed |
| Origen | `source`: import/manual/inbox | `sourceType` + `sourceId` |
| Quién escribe al importar | **sí** (`orchestrator:683`) | **no** — el extracto no crea previsiones |

El texto crudo del banco es intocable por diseño: `description` **nunca** se reescribe al conciliar, y el nombre bonito de la previsión se guarda aparte en `descripcionPrevision` (`orchestrator:400-404`) **[V]**. La razón es dura: `hashMovement` (`:698-703`) deduplica por `description`, así que reescribirla haría que un reimport solapado no reconociera sus propias líneas y duplicara los cargos.

**Lo que está mezclado [V]:** al conciliar, `confirmDecisions` copia la clasificación del evento **dentro del movimiento** (`orchestrator:393-407`): `categoryKey`, `subtypeKey`, `conceptoId`, `ambito`, `inmuebleId`, `descripcionPrevision`. Es denormalización consciente y está comentada como tal. Consecuencia real: **la categoría de un gasto conciliado vive en dos filas**, y si alguien reclasifica el evento después, el movimiento se queda con la vieja. Nadie reconcilia esa divergencia **[D]**.

**Lo que falta, y es el hueco del modelo [V]:**

> **No existe ninguna entidad «línea del extracto» distinta de `Movement`.**

En cuanto el fichero se parsea, la línea **ya es un movimiento en el store**. `LineaExtracto` (`extractoSesion.ts:27-70`) —que sí es el objeto «línea del fichero» con su veredicto, sus candidatos y su identidad `hashLinea`— **existe sólo en memoria de React** y muere al cerrar el drawer. `importBatches` no la guarda: sólo hashes de ignoradas y un `lineasPendientes[]` que hoy no se escribe nunca.

De ahí salen los tres síntomas de la Parte B, y los tres son el mismo problema:
1. importar mueve saldos (B.1) — porque el bruto ya es un movimiento contable;
2. no se puede retomar un fichero (B.3) — porque el estado de la sesión no tiene store;
3. la única forma de «no materializar» era borrar (`consolidarSesion`) — porque no había otro sitio donde dejar la línea.

El propio código lo dice, y esta vez el comentario coincide con el código **[V]** (`statementSessionService.ts:5-20`): *«`processFile` inserta los movimientos al procesar el fichero, pero §4.7 dice que lo no resuelto no se mezcla con la lista de la cuenta. Las dos cosas no pueden ser verdad a la vez sin un filtro. La alternativa era reescribir `processFile` para no insertar hasta el final. Se descartó: es cirugía mayor.»*

**El filtro se puso. Y se puso en un solo sitio** (`TesoreriaV6Page.tsx:229`), mientras hay 60 lectores de `movements`.

---

## RESUMEN DE HECHOS PARA EL REPLANTEAMIENTO

1. **Importar escribe las 300+ líneas en `movements` de inmediato** (`orchestrator:683`), como hechos contables. **[V]**
2. **Lo único que las «esconde» es un filtro en una pantalla.** Saldos persistidos, panel, informes y estimación fiscal las cuentan. **[V] escritura+lecturas / [D] el efecto**
3. **No hay entidad «línea de extracto» persistida.** `LineaExtracto` vive en React; `importBatches` es un recibo sin contenido. **[V]**
4. **Una sesión no se puede retomar**, y un cierre abrupto deja el extracto irrecuperable por el doble candado hash-de-lote + dedupe-de-movimiento. **[V] los candados / [D] la combinación**
5. **La identificación de cuota es fecha+importe y nada más**; el nº de contrato llega al `Movement` pero **nadie lo usa** para identificar, y el aprendizaje lo borra activamente. **[V]**
6. **Dos importadores más siguen en el árbol sin llamante**, uno de ellos escribiendo en `movements` e `importBatches`. **[V] el código / [D] que estén muertos** (por ausencia de llamantes en `grep`).
