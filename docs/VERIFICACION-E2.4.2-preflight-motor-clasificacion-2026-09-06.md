# VERIFICACIÓN · E2.4.2 · PREFLIGHT · motor de clasificación (clasificar bien sobre el catálogo único)

**Fecha:** 2026-09-06 · **Base:** `main` @ `4550e56` (tras #1863 · E2.4.1c) · **Rama:** `claude/audit-categories-types-scopes-p5966s` ·
**Estado:** PREFLIGHT · sin código · stop-and-wait. Los puntos con **PARA** son decisiones de Jose antes de escribir una línea.

**Cómo leer las marcas:** VERIFICADO = leído/ejecutado · DEDUCIDO = inferido por grep.

---

## 0 · Lo esencial en diez líneas

1. **E2.4.1 está mergeada** (#1861, #1862, #1863 · `main` `4550e56`): el catálogo único existe (`src/services/catalogo/catalogoUnico.ts`) y la lente fiscal aparte (`src/services/fiscal/lenteFiscal.ts`). No hay que PARAR por dependencia.
2. **La cuenta ya se detecta por IBAN** (`src/modules/tesoreria/v6/detectarCuenta.ts:75-83`), pero leyendo los primeros 64 KB del fichero **como texto**. Un XLS/XLSX es un ZIP: el IBAN no se ve, y la detección devuelve `sin-iban` → selector manual. Por eso «solo autodetecta Santander» (CSV). Es el motivo exacto, no un perfil que falte.
3. **HALLAZGO INESPERADO:** existe un lector de cabecera que SÍ abre XLS/XLSX (`src/services/extractoHeaderService.ts:190` `extractExtractoHeader` · P12) con IBAN + banco + titular + saldo + fecha, y **no lo llama nadie en producción** (solo su test). El Paso 0 es engancharlo en `detectarCuenta`, no escribir otro lector.
4. **El orden del Paso 1 no existe como tal.** Hoy `analizarLineas` (`src/services/bankStatementOrchestrator.ts:310-330`) hace tres cosas en paralelo sobre lo que no casó con previsión: sugerencias (vía A compromisos → vía B reglas aprendidas → vía C heurísticas · `movementSuggestionService.ts:140-160`) y reconocimiento determinista (`deterministas/matcheoDeterminista.ts`). Las reglas aprendidas van **segundas**, detrás de los compromisos; nada devuelve «los 4 ejes con su origen»; la fusión la hace la UI (`DrawerExtracto.tsx:174`) y el Guardar (`confirmarDecisiones.ts:149-175`).
5. **Defectos de hoy al nacer el movimiento** (`src/services/lineaComoMovimiento.ts:72-100`): `naturaleza` por signo ✓, `ambito: 'personal'` ✓, `paymentMethod` **solo** `bizum` (`:83`) ✗, `familia` ausente ✓. `Movement` lleva los 4 ejes (`db/types-movimientos.ts:37,83-103`) pero **ningún origen por eje** → campo nuevo opcional, sin índice, sin bump.
6. **Regla dura 1 se incumple hoy**: `deterministas/texto.ts:31-36` `contieneConcepto` compara por `includes` sobre palabras de ≥3 letras (substring: «ONCE» dentro de «CONCEPTO»), y las heurísticas de `movementSuggestionService.ts:404-532` usan regex sin `\b` (`/BIZUM/i`, `/(AMAZON|ALIEXPRESS)/i`). Regla 2 (el signo manda) sí existe: `respetandoElSigno` `:170-185`.
7. **Aprendizaje: solo al Guardar.** `confirmDecisions` → `feedLearningRule` (`confirmarDecisiones.ts:142,174`) → `createOrUpdateRule`. Durante la sesión las decisiones viven en memoria + fila (`decisionesPersistidas.ts` · E1.3). **No hay reproceso intra-lote ni sobre la cola**; el único reproceso es `reabrirLote` (`src/services/reabrirLote.ts:28`) a gesto del usuario (`DrawerExtracto.tsx:309`). `reanalizarPendientes` no existe con ese nombre.
8. **Sabadell pierde la 2ª columna de referencia**: el parser captura UNA (`bankParser.ts:722` `rowData[columns.reference]`; `lineasExtractoService.ts:62` `referencia` es un string); `Referencia 1` gana por orden de alias y `Referencia 2` (CUPS / nº contrato) se descarta. El extractor E2.1 (`identificadoresDelConcepto.ts:212,272`) no la ve.
9. **Fechas en serie Excel: sin soporte.** `bankParser.parseSpanishDate` (`:762-800`) solo entiende dd/mm/yyyy · dd/mm/yy · yyyy/mm/dd; `sheet_to_json` va con `raw:false` (`:280`), así que una celda con formato fecha llega como texto, pero una serie sin formato llega «46269» y la fila cae a `descarte: sin_fecha`. `bank-profiles.json` no tiene `dateHints` de serie ni columnas a ignorar (ING CATEGORIA/SUBCATEGORIA, Unicaja Categoría — hoy se ignoran por no tener alias, no por decisión).
10. **`movementLearningRules` y `documents` vacíos en el snapshot: REAL, no bug de export.** `db/snapshot.ts:18` recorre `db.objectStoreNames` entero (incluye reglas); `documents` va con el blob aparte y la meta en el JSON (`:28-50`). Vacíos = nunca se escribió (regla solo al Guardar con familia; documentos solo desde Inbox). Con Regla A además arrancan de cero.

---

## 1 · Preflight punto por punto (fichero:línea · VERIFICADO)

### 1 · E2.4.1 mergeada
`git log main`: `4550e56` (#1863 · 1c) · `6680ddc` (#1862 · 1b) · `4b02841` (#1861 · cimiento). Catálogo: `src/services/catalogo/catalogoUnico.ts` (`FAMILIAS`, `familiasSugeridas`, `naturalezaPorSigno`, `MetodoPago` 7 valores). Lente: `src/services/fiscal/lenteFiscal.ts`. ✓ No se PARA.

### 2 · Dónde se detecta hoy el banco y la cuenta

| Qué | Dónde | Cómo | Por qué solo Santander |
|---|---|---|---|
| **Cuenta** (la que mueve saldos) | `src/modules/tesoreria/v6/detectarCuenta.ts:75-83` `detectarCuenta(file, cuentas)` → `cuentaPorIban` `:47-66` (IBAN completo vs `accounts.iban`, cuentas `DELETED` fuera) | `file.slice(0, 65536).text()` · regex `ES\d{2}…20` | XLS/XLSX es ZIP → el texto no contiene el IBAN (lo admite el propio comentario `:70-74`). Santander exporta CSV (fixture `src/services/universalBankImporter/__tests__/fixtures/santander.csv`); Sabadell/Unicaja/ING llegan en Excel → `sin-iban` → selector |
| Quién lo llama | `src/modules/tesoreria/v6/DrawerExtracto.tsx:337` (solo en la **puerta global**; entrando por una cuenta ya está fijada) · PDF salta la detección `:330-334` | resultado `DeteccionCuenta`: `detectada` \| `sin-iban` \| `iban-desconocido` \| `ambigua` | |
| Selector de respaldo | `src/modules/tesoreria/v6/conciliar/ZonaSoltar.tsx:117-145` («Elige cuenta o tarjeta…») | `iban-desconocido` hoy dice «no es de ninguna cuenta tuya» y pide elegir (`:56`) — **no propone crear** | |
| **Banco** (perfil de parseo) | `src/features/inbox/importers/bankProfileMatcher.ts:59,150-159` (código de entidad del IBAN → `bankKey`, peso 25) · `src/services/bankProfilesService.ts:10-21` mapa entidad→banco (10 bancos) · `bankStatementOrchestrator.ts:177,334-370` `deriveBankHintFromAccount` (del IBAN de la cuenta elegida) | Funciona una vez se sabe la cuenta | |
| **Lector de cabecera completo (SIN USO)** | `src/services/extractoHeaderService.ts` · `parseHeaderGrid` `:84-150` (IBAN, banco por IBAN o «CUENTA <BANCO>», titular, saldo, fecha TZ-safe) · `readGrid` `:166-186` abre CSV **y XLS/XLSX** (25 primeras filas vía `xlsx`) · `extractExtractoHeader` `:190` | `grep -rn extractExtractoHeader src` → solo su propio fichero y su test. **Cero llamadores en producción.** | Es la pieza que falta: da IBAN en Excel y los datos para «crear la cuenta con banco+IBAN ya rellenos» |

**Punto donde AÑADIR (Paso 0):** `detectarCuenta` deja de leer bytes y llama a `readGrid`/`parseHeaderGrid` (exportar `readGrid`); mismo contrato `DeteccionCuenta` + cabecera (`ExtractoHeader`) para que `iban-desconocido` pueda ofrecer crear la cuenta (banco, IBAN, titular, saldo, fecha ya leídos). Capa añadida: `bankParser` y el orquestador no se tocan. Revolut (CSV sin IBAN · la cuenta es la tarjeta) seguirá en `sin-iban` → selector, como dice la tabla del encargo.

### 3 · `bank-profiles.json`
`public/assets/bank-profiles.json` · 10 perfiles (ABANCA, BBVA, Santander, Unicaja, Sabadell, Bankinter, ING, Openbank, CaixaBank, Revolut). Campos por perfil: `bankKey`, `bankVersion`, `dateHints`, `headerAliases` (date, valueDate, amount, cargo, abono, description, counterparty, balance, currency, reference), `minScore`, `noisePatterns`, `numberFormat`, `useCargoAbono`. Consumidores: `bankProfilesService.loadProfiles` (`:26`) y `bankProfileMatcher` (puntuación).

Lo que NO tiene y el encargo pide: `dateHints` de **serie Excel** (todos llevan `dd/mm/yyyy`/`dd-mm-yyyy`; Revolut añade `yyyy-mm-dd`), etiqueta de **cabecera IBAN**, **columnas a ignorar** (ING CATEGORIA/SUBCATEGORIA, Unicaja Categoría), la 2ª columna de referencia de Sabadell, el `COMENTARIO` de ING como texto útil.

**Ojo (DEDUCIDO):** la detección de columnas del importador real (`BankParserService` · `bankParser.ts:20-51`) usa **sus propias tablas de alias**, no `headerAliases` del perfil. Ampliar el JSON solo sirve si el parser lo lee; hoy el perfil pesa en la puntuación y en `noisePatterns`/`numberFormat`. Se verifica en implementación qué campos del perfil consume `parseFile` con el `bankProfileHint` (`bankStatementOrchestrator.ts:177`).

### 4 · Dónde asigna el motor hoy (post E2.4)

```
analizarLineas (bankStatementOrchestrator.ts:310-330)
 ├─ matchLineas            → previsiones (emparejador · NO se toca)
 ├─ suggestForLineas       → movementSuggestionService.ts:113 · sugerirEnMemoria :129-160
 │     vía A compromisos (:225-235, atajo si confianza ≥ SHORT_CIRCUIT)
 │     vía B reglas aprendidas (:296-353 · learnKey v2→v1)
 │     vía C heurísticas (:361-563 · regex por proveedor/IBI/comunidad/bizum/amazon)
 │     guardián de signo `respetandoElSigno` :170-185
 └─ reconocerDeterministasDeLineas → deterministas/matcheoDeterminista.ts:55
       cuotas de préstamo · ventas · rendimientos · nóminas · recurrentes (E2.4 · por
       identidad CUPS/contrato/NIF > texto > importe > calendario) · rentas · traspasos
       propios (IBAN o nombre del titular) · gasto declarado por inmueble
```

- Resultado: `OrchestratorResult{matchResult, suggestions, reconocido{origenes, atribuciones}}`. Fusión: UI `DrawerExtracto.tsx:174` (`propuestasDeLineas`) y `:201` (origenes cierran solos); Guardar `confirmarDecisiones.ts:91` → `:149-175` (reconocido → `cierreDeterminista.aplicarReconocimiento`; después decisiones del usuario).
- Defectos al nacer (`lineaComoMovimiento.ts:72-100`): `naturaleza: naturalezaPorSigno`, `ambito: 'personal'`, `paymentMethod` solo `bizum` (`:83`), sin familia.
- `Movement`: eje 1 `naturaleza` (`types-movimientos.ts:83`), eje 2 `familia?/subtipo?` (`:85-87`), eje 3 `paymentMethod?` (`:37`), eje 4 `ambito` + `inmuebleId?` (`:102-103`). `learnKey?` (`:126`). **Sin origen por eje.**
- `MovementSuggestion.via` (`movementSuggestionService.ts:78`: `compromiso_recurrente` \| `learning_rule` \| `heuristica`) es lo más parecido a un origen, pero solo en la sugerencia, no en lo persistido.
- Orden real hoy ≠ Paso 1: aprendidas segundas (tras compromisos), deterministas en paralelo, «personal por defecto» implícito.

**Punto donde AÑADIR:** un 4º resultado de `analizarLineas` (`clasificacion: Map<lineaId, ClasificacionPropuesta>`) calculado por un módulo puro nuevo que **consume** `reconocido` + `suggestions` + el texto y devuelve los ejes con origen en el orden del Paso 1. `matchLineas`, el marcador y las vías existentes no se reescriben.

### 5 · Extractor E2.1
`src/services/identificadoresDelConcepto.ts` · tipos `cups | iban | nif | contrato | tarjeta` (`:35`) · `extraerIdentificadores(texto)` `:212` · `identificadoresDeMovimiento(m)` `:272` · tarjeta = 4 últimos («Revolut**9527*») `:172,247`. Consumidores: `movementLearningService.buildLearnKey` `:176-186` (clave v2), `recurrentes/reconocerRecurrente.ts:82-97` (CUPS/nº contrato/NIF vs `cups`/`numeroContrato`/`proveedor.referencia`/`proveedor.nif` del compromiso), `deterministas/traspasosPropios.ts` (IBAN propio). **La 2ª referencia de Sabadell no le llega** (punto 8 del §0).

### 6 · Reproceso
- `reabrirLote(importBatchId)` (`src/services/reabrirLote.ts:28-40`) → `analizarLineas` sobre las líneas del lote. Llamador único: `DrawerExtracto.tsx:309` (retomar un lote a medias · `lotesAMedias` `decisionesPersistidas.ts:213`).
- No hay disparador al crear/editar estructura ni al aprender. El aprendizaje se escribe solo al Guardar (`confirmarDecisiones.ts:142,174` → `aplicarSugerencia.feedLearningRule` `:69` → `createOrUpdateRule` `movementLearningService.ts:305+`).
- En sesión: decisiones en memoria + fila (`decisionesPersistidas.ts` · E1.3, cola de escritura en `montarSesion.ts:31-48`); `clasificarEnBloque.valoresPorLinea` (`src/modules/tesoreria/v6/clasificarEnBloque.ts`) ya permite un concepto para varias líneas **seleccionadas a mano**.

**Punto donde AÑADIR (Paso 2):** (a) función pura `aplicarAprendizajeEnLote(lineas, reglaRecienAprendida)` que, al clasificar una línea en sesión, resuelve las hermanas del mismo lote con la misma clave (`learnKey` v2/v1) con origen `aprendida`; (b) al Guardar, `analizarLineas` sobre `lotesAMedias()` para que la cola vea lo recién guardado. Sin tocar el emparejador.

### 7 · Campos de los stores del cruce (VERIFICADO)

| Store · campo | Dónde | Estado |
|---|---|---|
| `prestamos.planPagos.periodos[]` · `periodo, fechaCargo, cuota, interes, amortizacion, pagado, movimientoTesoreriaId` | `src/types/planPagos.ts:14-28,47-50` | ✓ (`movimientoTesoreriaId` es **string**) · ya lo usa `deterministas/cuotasDePrestamo.ts` |
| `prestamos.destinos[].inmuebleId` | `src/types/prestamos.ts:13-30` (`DestinoCapital` · `importe`, `porcentaje?`) | ✓ (`inmuebleId` string) |
| `properties.cadastralReference` · `address` · `municipality` · `alias` | `src/services/db/types-inmuebles.ts:21,15,18,13` | ✓ |
| `compromisosRecurrentes.conceptoBancario` · `proveedor.nombre` · `proveedor.nif` · `cups` · `numeroContrato` | `src/types/compromisosRecurrentes.ts:139` (nif) · V83 (cups/numeroContrato) | ✓ · `familia/subtipo/ambito/inmuebleId` tras 1c |
| `contracts.inquilino{nombre, apellidos, dni, cotitulares[]}` · `fechaInicio/fechaFin` | `src/services/db/types-contratos.ts:200-218` | ✓ · ya lo usa `deterministas/rentas.ts` |
| `accounts.iban` · titular (`personalData.nombre/apellidos`) | `types-contratos.ts` · `src/types/personal.ts:35-36` | ✓ · ya lo usa `traspasosPropios.ts` |
| `ejerciciosFiscalesCoord` | `src/services/db.ts:329` | ✓ · ya lo usa `deterministas/gastoDeclaradoPorInmueble.ts` |
| `tarjetas` · **número / cuatro últimos** | `src/types/tarjetas.ts:63-90` (`alias, emisora, origen, modalidad, cuentaLiquidacionId, ciclo`) | **✗ no existe** → la regla dura 6 (recarga a tarjeta PROPIA por nº) no tiene contra qué casar. Campo opcional `ultimosCuatro?` · sin índice · sin bump (PARA) |
| `inversiones` · `planesPensiones/aportacionesPlan` · `proveedores` | ya leídos por `rendimientosDeInversion.ts` / `nominas.ts` | ✓ |

### 8 · Snapshot con `movementLearningRules` y `documents` vacíos
`src/services/db/snapshot.ts:18` `Array.from(db.objectStoreNames)` → exporta **todos** los stores (no hay lista blanca); `documents` `:33-50` guarda el blob en la carpeta `documents/` y la meta (con `content: null`) en el JSON. `db/backup.ts:8,187` igual (todos los stores). → **Vacíos = reales.** Causa: la regla nace solo al Guardar con familia (`deriveCategoryFromMovement` devuelve `null` sin familia → no se escribe), y los documentos solo desde Inbox. Con Regla A tras 1c arrancan de cero de todos modos.

---

## 2 · Reglas duras · qué hay hoy (VERIFICADO)

| Regla | Hoy | Dónde tocar |
|---|---|---|
| 1 · `\bX\b` | ✗ `texto.ts:31-36` `includes` por palabra (substring) · heurísticas `movementSuggestionService.ts:404-532` sin `\b` | tokenizar `contieneConcepto`; `\b` en heurísticas · test «ONCE»/«CONCEPTO», «GAS»/«GASTO» |
| 2 · signo > palabra | ✓ `respetandoElSigno` `:170-185` | reutilizar |
| 3 · concepto > nombre propio · nómina yo→yo | parcial: `nominas.ts` / `traspasosPropios.ts` separados | orden en el motor nuevo |
| 4 · método nunca «otro» | ✗ solo `bizum` (`lineaComoMovimiento.ts:83`) | `metodoDelConcepto(texto)` nuevo (recibo/domiciliación · transferencia · tarjeta · cheque · efectivo · cargo/abono) |
| 5 · «préstamo» = 3 cosas | `cuotasDePrestamo.ts` (cuota) · disposición `movimiento_interno·disposicion_prestamo` (1b) · tarjeta ✗ | patrón completo en el motor |
| 6 · Revolut/agregador | extractor saca 4 últimos ✓ · `tarjetas` sin número ✗ | campo `ultimosCuatro?` (PARA) |
| 7 · «Compra Bizum» ≠ «Bizum a favor de» | `contraparteDeBizum` / `pareceBizum` (`lineaComoMovimiento.ts`) · heurística bizum `:475,516` | distinguir comercio vs persona |
| 8 · no inventar | `ambito: 'personal'` por defecto ✓ · familia ausente ✓ | mantener |
| 9 · cruce entre ficheros | `traspasosPropios.ts` espejo ±3 días en otra cuenta ✓ | reutilizar |
| 10 · fiscalidad aparte · cuota entera | ✓ tras 1b/1c | — |

---

## 3 · Lo que se propone AÑADIR (para que Jose lo valide antes de codificar)

1. **Paso 0** · `detectarCuenta` usa `extractoHeaderService.readGrid/parseHeaderGrid` (CSV y Excel) → `DeteccionCuenta` + `ExtractoHeader`; `iban-desconocido` ofrece **crear la cuenta** con banco/IBAN/titular/saldo/fecha (gancho pequeño en `ZonaSoltar` → `CuentaWizard`).
2. **Perfiles** · `bank-profiles.json` gana por banco: `ibanHeader` (etiqueta), `dateHints` con `excelSerial` (Unicaja), `ignoreColumns` (ING, Unicaja), `extraReference` (Sabadell Ref 2, ING Comentario). `parseSpanishDate` entiende serie Excel (base 1899-12-30) **si** el perfil lo dice.
3. **Ref 2 Sabadell** · `columnaDeReferencia` (pasada aditiva ya existente) rescata la segunda columna y `referencia` lleva `ref1 · ref2` → el extractor E2.1 la ve. No se reescribe el parser.
4. **Motor** · `src/services/clasificacion/clasificarLinea.ts` (puro): aprendidas → identificador (recurrente/préstamo/contrato/cuenta, vía `reconocido`) → concepto (`\b`) → recurrencia → defecto; devuelve `{naturaleza, familia?, subtipo?, metodo, ambito, inmuebleId?, origen: Partial<Record<eje, 'aprendida'|'identificador'|'concepto'|'recurrencia'|'defecto'>>}`. `analizarLineas` lo expone como 4º resultado; `matchLineas`/marcador intactos.
5. **Método** · `metodoDelConcepto` · nunca `'otro'` con señal del banco.
6. **`Movement.clasificacionOrigen?`** · opcional, sin índice, sin bump (la UI DT6/DT7 lo leerá cuando exista).
7. **Intra-lote** · `aplicarAprendizajeEnLote` (puro) + gancho en `DrawerExtracto` al clasificar + `analizarLineas` sobre `lotesAMedias()` al Guardar.
8. **Tests** · las 10 reglas duras como casos; «una línea de Víctor → las demás del lote»; «cuota Unicaja con 1 solo préstamo → casa con `planPagos`»; «clasificación parcial se guarda».

## 4 · PARA · decisiones antes de codificar

1. **Ficheros reales.** En el repo solo hay `santander.csv` y las filas de Sabadell de un test. La verificación «los 8 ficheros identifican su cuenta» y los números (68 / 31 / 1 / 33 %) necesitan los ficheros. Propuesta: fixtures anonimizadas (cabecera + 10 líneas por banco) en `src/features/inbox/importers/__fixtures__/`. ¿Los pasas?
2. **Intra-lote: ¿decisión automática o propuesta marcada «aprendida»?** El encargo dice «se resuelven solas»; hoy nada cierra una línea sin gesto salvo lo determinista. Propuesta: aplicar como **decisión** (igual que una regla al importar) pero visible con su origen y reversible.
3. **Ref 2 Sabadell toca el importador** (pasada aditiva `columnaDeReferencia`, no reescritura). ¿OK dentro de E2.4.2?
4. **Fechas en serie Excel (Unicaja)**: si el fichero real trae series sin formato, hoy esas filas se descartan (`sin_fecha`). Es un bug de importación, no de clasificación. ¿Lo incluyo (perfil + `parseSpanishDate`) o va aparte?
5. **`Tarjeta.ultimosCuatro?`** para la regla 6 (Revolut/ING «Pago en Revolut» = recarga propia). Campo opcional nuevo. ¿OK?
6. **`iban-desconocido` → crear cuenta**: es un gancho de UI (`ZonaSoltar` → `CuentaWizard`). ¿Dentro o fuera de «solo el motor»?

## 5 · Fuera de alcance (confirmado)
Proponer crear recurrentes (E2.5) · catálogo nacional de proveedores (E2.6) · capa fiscal · UI de la etiqueta (DT6/DT7) · pesos del marcador (aviso 29/8).
