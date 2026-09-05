# VERIFICACIÓN · E2-preflight · ESTADO REAL del motor de reconocimiento

**Fecha:** 2026-09-05 · **Base:** `claude/new-session-5yoewv` @ `d774b90` (= `main` tras #1854) · **DB_VERSION:** 91 · **Solo lectura, sin cambios de código.**

Objetivo: foto de qué del MOTOR (modelo §21-23) ya existe en código, qué está roto y qué falta de cero,
para partir E2 en tareas reales. Cada afirmación lleva `fichero:línea`.

**Cómo leer las marcas:**
- **VERIFICADO** · he leído las líneas citadas.
- **DEDUCIDO** · inferido de comentarios, nombres o ausencia de resultados en un `grep`.
- El documento del modelo (§6, §13, §21-23, §29) **no está en el repo**: cada § se interpreta según el enunciado
  del encargo. Cuando digo «el modelo pide X» estoy citando el encargo, no un fichero.

---

## 0 · Lo esencial en diez líneas

1. **El motor no es uno: son tres motores en fila** sobre la misma línea, y un cuarto detrás:
   emparejador contra previsiones (`movementMatchingService`), reconocedor determinista contra libros
   (`deterministas/`), sugeridor de tres vías (`movementSuggestionService`), y conciliación contra confirmados
   (`conciliacionConfirmados`). Todos hablan ya en `lineaId` (E1.4b/E1.5).
2. **Cruza contra 11 stores**, no 7: `treasuryEvents`, `movements` (confirmados), `prestamos`, `property_sales`,
   `inversiones`, `ingresos` (nómina), `ejerciciosFiscalesCoord` + `properties` (atribución), `compromisosRecurrentes`,
   `contracts`, `movementLearningRules`. Faltan por leer `proveedores`, `accounts` (IBAN destino), `gastosInmueble`, `tarjetas`, `documents`.
3. **El ancla de tres patas NO existe.** Se ancla por fecha+importe (exactas) o por texto crudo (`includes`,
   regex, n-grams). Nadie extrae CUPS / nº contrato / IBAN del concepto para el matcheo de movimientos; sí lo hace
   el clasificador de FACTURAS (`documentAutoClassifyService.ts:330-342`), que es el precedente a copiar.
4. **Certeza:** los tres niveles existen en el emparejador (`matches` / `multiMatches` / `sinMatch`), pero la
   sesión los aplana a dos: `cuadra` / `resolver` (`extractoSesion.ts:243-247`). Un `multiMatch` llega a la
   pantalla como «te necesitan» con candidatos; una sugerencia por regla aprendida **nunca resuelve**: pinta el
   montón «personal» y al Guardar no nace nada (`extractoSesion.ts:389-394`).
5. **Aprendizaje: roto en tres sitios.** (a) el patrón borra todo número de ≥4 dígitos y toda cadena de ≥8
   alfanuméricos → nº contrato y CUPS fuera (`movementLearningService.ts:58-60`); (b) solo se aprende de un cuadre
   con previsto, **no** de clasificar a mano por ficha (`confirmarDecisiones.ts:110` es el único llamante);
   (c) no es retroactivo: nada reprocesa pendientes al llegar un dato nuevo.
6. **Tipo de operación:** no existe. El único eje es el signo (`amount >= 0 ? 'Ingreso' : 'Gasto'`,
   `lineaComoMovimiento.ts:88`) más un `paymentMethod: 'Bizum'` por regex. Ver §2 (Nivel 0).
7. **Catálogo nacional:** existe cinco veces como constantes hardcodeadas y desconectadas (la mayor, ~90 marcas,
   solo sirve al inbox de facturas). No hay store ni fichero de datos. `proveedores` (del usuario, por NIF) nunca se lee desde el matcheo.
8. **IA:** el matcheo es 100 % determinista. La única llamada a Claude en el import es **una por fichero PDF**
   (`bankStatementOrchestrator.ts:237`), cero para CSV/XLS.
9. **Reconocer ≠ crear:** el detector de recurrentes existe, es read-only y está en producción en
   `/personal/gastos/detectar-compromisos` y en `/empezar`, pero **no está enganchado al drawer del extracto**.
   Proponer contrato desde movimientos no existe.
10. **Lo que E1 dejó del motor** (no reconstruir): las puertas por línea de los cuatro motores, el adaptador
    `lineaComoMovimiento`, la sesión y sus decisiones persistidas, los tests de caracterización (686 líneas) y
    de equivalencia (454), el silenciado §29 en la línea, el cuadre con el saldo del banco y la apertura derivada.

---

## 1 · NIVEL −1 · identificar el fichero (modelo §21.1-21.2)

### 1.1 · Identificación de banco/cuenta desde la cabecera

**Existe, por IBAN, y solo pregunta; nunca crea.** VERIFICADO.

| qué | dónde | detalle |
|---|---|---|
| Cuenta por IBAN | `modules/tesoreria/v6/detectarCuenta.ts:20-23, :47-85` | regex `ES + 22 dígitos` sobre los **primeros 64 KB en texto plano**, cruzado contra `accounts` con `iban` y no borradas; salidas `detectada / sin-iban / iban-desconocido / ambigua` (`:35-39`) |
| Quién la llama | `DrawerExtracto.tsx:353-362` | si `detectada` procesa directo; si no, guarda el fichero y espera al `<select>` de `ZonaSoltar.tsx:117-157` |
| Banco (perfil) por contenido | `features/inbox/importers/bankProfileMatcher.ts:37-86` | 0-100 = cabeceras 40 + nombre 20 + contenido 15 + entidad del IBAN 25 |
| Pista de banco desde la cuenta elegida | `bankStatementOrchestrator.ts:334-368` `deriveBankHintFromAccount` | IBAN → `banco.name` → `banco.code`; **manda sobre el fichero** (`:177-180`) |
| Umbral para contradecir al usuario | `deteccionDeBanco.ts:27, :42-49` | solo avisa si confianza ≥ 60 |
| §31 apertura derivada (#1854) | `aperturaDerivada.ts:29-31, :81` · `montarSesion.ts:17` · `DrawerExtracto.tsx:52` | apertura = saldo de la línea más antigua − su importe; modos `retroceso`/`ajuste`; solo se escribe si el usuario marca la casilla |

**ROTO / parcial:**
- **XLSX es opaco** a `detectarCuenta`: el fichero va comprimido y el IBAN nunca aparece; el propio código lo reconoce (`detectarCuenta.ts:73-75`). Consecuencia: en el formato más habitual la puerta cae siempre en «elige la cuenta». DEDUCIDO que sea «siempre»; VERIFICADO el mecanismo.
- **PDF se salta la detección** por diseño (`DrawerExtracto.tsx:346-350`, fuerza `sin-iban`).
- `Movement.iban_detected` existe en el tipo (`db/types-movimientos.ts:83`) y nadie lo escribe. El IBAN detectado se pierde.

**FALTA:** crear cuenta desde el fichero (ni botón ni servicio); escribir el IBAN en la cuenta destino cuando
no lo tenía; leer del cabecero algo más que el IBAN (titular, divisa, periodo, nombre del banco); IBAN no
español (`ES` fijo en `:20`; Revolut LT/IE nunca se detecta).

### 1.2 · Perfiles de banco / normalización

**Existen 10 perfiles y no normalizan nada: solo puntúan la detección y etiquetan el lote.** VERIFICADO.

- `public/assets/bank-profiles.json` (cargado en `bankProfilesService.ts:30`): ABANCA, BBVA, Santander,
  Unicaja, Sabadell, Bankinter, ING, Openbank, CaixaBank, Revolut; mapa de entidad ES en `bankProfilesService.ts:9-20`.
- **El parseo real ignora el perfil**: `bankParser.ts` usa `COLUMN_ALIASES` global (`:11-53`), detecta cabecera
  en las 20 primeras filas (`:445`), salta logos (`:585-625`), acepta con `score ≥ 3 && fecha && importe` (`:534`),
  y `detectBank` se llama **después** de `parseMovements` (`:306` → `:315`) solo para `metadata.bankKey`.
  `headerAliases`, `noisePatterns`, `numberFormat`, `dateHints` y `useCargoAbono` (9 perfiles a `true` en el JSON;
  el parser decide por presencia de columnas, `:697`) **no se aplican jamás**.
- Fix del parser (#1851, `91d0989`): lee la hoja dos veces (`raw:false` texto + `raw:true` números,
  `bankParser.ts:834-850`) y `numberUtils.ts` acepta la coma de millar inglesa. Antes, `"1,000.00"` tiraba la fila entera.
- Caso ING sin fecha de cargo (`:541-549`, warning al usuario `:319-325`); rescate de referencia BBVA
  (`importador/columnaDeReferencia.ts`); filas basura (`:742-757`); fechas `dd/mm/yyyy`, `dd/mm/yy`, `yyyy/mm/dd` (`:762-810`).

**ROTO / muerto:**
- **Todo `src/services/universalBankImporter/`** (columnRoleDetector, dateFormatDetector, localeDetector,
  signDerivationService, localeAmount, ledgerValidationService · ~2.000 líneas) **no tiene ningún importador**
  fuera de `src/tests/treasuryV12Enhanced.test.ts`. VERIFICADO por grep.
- `metadata.bankName`/`confidence` del perfil nunca se rellenan (`bankProfilesService.ts:68-73`).
- Sin cabecera reconocible el parser devuelve `success:true, movements:[]` con `needsManualMapping` (`:290-302`)
  y el drawer procesa un lote de **0 líneas** sin decir por qué (`bankStatementOrchestrator.ts:198-200` no lo captura). DEDUCIDO por traza.
- `getGenericProfile` (`bankProfilesService.ts:248-274`) y otros helpers solo los usan tests.

**FALTA:** bancos sin perfil (Kutxabank, Ibercaja, Cajamar/Caja Rural, Laboral Kutxa, EVO, N26, MyInvestor,
Wise…); **Norma 43 / CSB43 no tiene parser** aunque la UI lo anuncie (`ZonaSoltar.tsx:196, :202` acepta `.n43,.csb`;
`bankParser.detectFileType :346-354` solo conoce csv/xlsx/xls y devuelve `xlsx` por defecto); OFX/QIF: cero.

### 1.3 · Solape / rango de fechas

**Dos huellas activas, ninguna por rango.** VERIFICADO.

| mecanismo | dónde | qué hace |
|---|---|---|
| `hashLote` (SHA-256 del fichero) | `utils/batchHashUtils.ts` · `bankStatementOrchestrator.ts:121-131, :154-159, :224-229` | bloquea el mismo fichero dos veces (`StatementAlreadyImportedError`), anulable con `allowReimport` (`ZonaSoltar.tsx:159-172`) |
| `hashMovement` por línea | `bankStatementOrchestrator.ts:630-636` = `cuenta\|fecha\|céntimos\|concepto.trim()` | `huellasExistentes` (`:610-620`) une **movimientos** y **líneas ya guardadas** (mina M4 de E1.5); la repetida se persiste con `descarte:'duplicada'` (`:596-600`); dentro del mismo fichero dos cargos idénticos entran los dos (`:601`) |
| `hashLinea` (`v1:fecha\|céntimos\|concepto normalizado`) | `lineasExtractoService.ts:69` · `statementIgnoredLinesService.ts:56-110` | identidad de la línea para el ignorado entre importaciones |
| `reconciliarDuplicadosExistentes.ts:33-37` | — | reparación a posteriori import↔confirmado |

**ROTO:** `ImportBatch.rangoFechas` se escribe siempre vacío (`bankStatementOrchestrator.ts:493` con
`periodStart/End` que el drawer nunca pasa, `DrawerExtracto.tsx:291`) y nadie lo lee; `filterByPeriod` (`:424-437`)
siempre devuelve todo. `utils/duplicateDetection.ts` está semi-muerto: `detectDuplicates` marca `isDuplicate` en
memoria (`bankParser.ts:660`) y solo lo lee un contador de metadata (`:231`), no el orquestador ni la línea; `removeDuplicates`/`getDuplicateStats` sin llamadores; tests `.disabled`.

**FALTA:** min/max de fechas del lote; aviso de solape («ya tienes datos del 15/03 en adelante») y de hueco
entre lotes; dedupe difusa (`hashMovement` solo hace `trim`: una tilde o un espacio interno distinto entre dos exports duplica la línea).

## 2 · NIVEL 0 · tipo de operación + signo (modelo §6.3)

**No existe un Nivel 0. Solo signo, más Bizum por regex.** VERIFICADO.

- Lo único que se escribe al importar: `type: amount >= 0 ? 'Ingreso' : 'Gasto'` (`lineaComoMovimiento.ts:88`),
  `category.tipo` igual (`:93`), y `paymentMethod: 'Bizum'` si el texto dice «bizum» (`:82`, `bizum.ts:26-67`).
- `MovementType = 'Ingreso'|'Gasto'|'Transferencia'|'Ajuste'` (`db/types-movimientos.ts:16`) y
  `MetodoDePago = 'Domiciliado'|'Transferencia'|'TPV'|'Efectivo'|'Bizum'` (`:38`): el importador solo produce
  dos del primero y uno del segundo. `grep tipoOperacion` en `src` → 0.
- Retirada de cajero: existe como **propuesta** «es efectivo» (`retiradaCajero.ts:31-61`), no como tipo.
- Traspaso entre propias: decisión manual del usuario («y las N iguales»), sin detección.
- Heurísticas por texto (`movementSuggestionService.ts:397-538`): suministros/telco, hipoteca, IBI, comunidad,
  Bizum/transferencia recibida, Bizum saliente, Amazon. Son **sugerencias** globales por regex, no un tipo persistido,
  y solo corren sobre lo `sinMatch` y si las vías A/B no cortocircuitan.

| tipo pedido | estado |
|---|---|
| abono / cargo | solo signo |
| domiciliación / recibo / adeudo SEPA | falta (solo existe como `metodoPago` de recurrentes creados a mano) |
| Bizum | existe |
| transferencia | solo regex «TRANSFERENCIA RECIBIDA» en positivo, como sugerencia |
| traspaso propio | manual |
| retirada cajero | propuesta, no tipo |
| tarjeta / TPV | falta (ningún regex `COMPRA TARJETA|TARJ|TPV`) |
| comisión · intereses · devolución · nómina | faltan (la `nomina` que hay es de FEIN/OCR; la devolución solo se cita en un comentario `:400-402`) |

**Por banco:** nada. `BankProfile` no tiene reglas de tipo (`types/bankProfiles.ts:1-24`); el módulo que sí
derivaba el signo por estructura de columnas (`universalBankImporter/signDerivationService.ts:10-18`) está desconectado.

---

## 3 · EL ANCLA de tres patas (modelo §6.2) · concepto + piso + inquilino

### 3.1 · ¿Se ancla por CONCEPTO?

**Parcialmente, y por texto crudo · nunca por identificador.** VERIFICADO.

| motor | qué mira del concepto | cómo | fichero:línea |
|---|---|---|---|
| Emparejador (previstos) | `providerName`/`counterparty` del previsto dentro de la descripción | `description.includes(provider)` (+25) | `movementMatchingService.ts:309-313` |
| Emparejador (previstos) | alias aprendido banco→persona | `claveDeNombre` + Set | `:329-347` |
| Emparejador (previstos) | Bizum · comparación por palabras | `nivelDeCoincidencia` fuerte/parcial | `:363-383` |
| Emparejador (previstos) | palabra «alquiler/renta/…» en ingresos | regex | `:277-289` |
| Determinista · nómina | `ingresos.cuentaCobro.conceptoBancario` · todas sus palabras contenidas | `contieneConcepto` | `deterministas/nominas.ts:55-58`, `texto.ts:29-35` |
| Determinista · atribución | pistas por cubo (IBI, COMUNIDAD, IBERDROLA…) | `includes` sobre texto normalizado | `gastoDeclaradoPorInmueble.ts:29-44` |
| Sugeridor · vía A | `compromiso.proveedor.nombre` en descripción (+10 sobre 70) | `includes` | `movementSuggestionService.ts:228-230` |
| Sugeridor · vía B | n-grams (2-3 palabras) del concepto **sin números** | hash `v1|signo|ngramA|B|C` | `movementLearningService.ts:105-127` |
| Sugeridor · vía C | regex de marcas (IBERDROLA…, CUOTA PRESTAMO, IBI, COMUNIDAD, BIZUM, AMAZON) | regex | `movementSuggestionService.ts:397-538` |

Lo que el modelo llama «anclar por concepto» —extraer del literal un **identificador** (CUPS, nº contrato,
IBAN, NIF) y buscarlo en la fuente— **no existe en ningún motor de movimientos**. VERIFICADO:
`grep cups|numeroContrato` en `src/services` solo devuelve `documentAutoClassifyService.ts:330-342`
(facturas OCR → compromiso por `cups` / `numeroContrato` / `nif`) y `compromisosRecurrentesService.ts:170-171`
(los campos existen en el compromiso desde V83). El precedente está hecho; hay que copiarlo al lado de los movimientos.

Peor: el aprendizaje **borra** esos identificadores antes de hashear (§6.1).

### 3.2 · ¿Tres patas (quién + qué piso + qué inquilino) o menos?

**Una pata y media.** VERIFICADO.

- **Quién**: sí, por texto (tabla de arriba).
- **Qué piso**: nunca entra en la puntuación. El `inmuebleId` viaja **desde** el previsto/compromiso/préstamo
  hacia el movimiento (`confirmarDecisiones.ts:98`, `cuotasDePrestamo.ts:81`), pero ningún motor usa el piso
  como criterio para elegir entre candidatos. La única atribución de piso «desde el concepto» es la declaración
  del año pasado, y solo si **un único** inmueble declaró ese cubo (`gastoDeclaradoPorInmueble.ts:118`).
- **Qué inquilino**: solo en ingresos, por nombre (alias aprendido / Bizum / `contratoDeLaContraparte`,
  `movementSuggestionService.ts:380-395`), y exige coincidencia `fuerte` y contrato único.

El desempate entre «seis habitaciones del mismo importe» se resuelve hoy por margen de nombre
(`MARGEN_GANADOR_CLARO = 20`, `movementMatchingService.ts:53, :473`), no por piso.

---

## 4 · CRUCE contra las fuentes (modelo §6.1, tres clases)

### 4.1 · Qué stores lee HOY cada motor (por línea, tras E1.5)

Orden real de ejecución en `bankStatementOrchestrator.analizarLineas` (`:290-307`), VERIFICADO:

1. `matchLineas` → **`treasuryEvents`** de la cuenta, solo `predicted` y no descartados
   (`movementMatchingService.ts:145-175`, `descarteDePrevision.ts:31-33`) + **`movementLearningRules`** (alias).
2. Sobre lo que quedó `sinMatch`: `suggestForLineas` → **`compromisosRecurrentes`** (activos, solo gasto),
   **`movementLearningRules`** (por `learnKey`), **`contracts`** (activos, solo para Bizum/transferencia recibida)
   (`movementSuggestionService.ts:120-156`).
3. Sobre lo mismo: `reconocerDeterministasDeLineas` → **`prestamos`**, **`property_sales`**, **`inversiones`**,
   **`ingresos`**, **`ejerciciosFiscalesCoord`**, **`properties`** (`matcheoDeterminista.ts:58-65`).
4. En la sesión (no en el orquestador): `confirmadosPorLinea` → **`movements`** anotados a mano
   (`source:'manual'`, `conciliacionConfirmados.ts:52-70`; lo monta `montarSesion.ts`).

**11 stores.** La auditoría del 30/8 contaba 7; E1 y las fases 1-2 del determinista sumaron cuatro.

Nota de diseño que condiciona E2 (`deterministas/tipos.ts:9-25`, VERIFICADO): las previsiones solo existen del
mes en curso hacia delante (`regenerateForecastsForward`), así que para un extracto del pasado el emparejador
no tiene contra qué casar. Por eso existe el reconocedor determinista y por eso **no** se generan previsiones
hacia atrás (retirado en #1821/#1824).

### 4.2 · Las tres clases del modelo · cuáles lee ya

| clase | fuente del modelo | ¿se lee? | dónde | cómo | falta |
|---|---|---|---|---|---|
| **Exacta** | préstamos (cuadro) | ✅ | `cuotasDePrestamo.ts:46-91` | mismo día + mismo importe, empate = no elige | cuota con 1-2 días de desfase no casa (`mismoDia` estricto, `igualdad.ts:19-22`) |
| Exacta | contratos (renta) | ⚠️ indirecto | vía `treasuryEvents` generados del contrato + `contracts` para Bizum | solo si hay previsión (futuro) o Bizum con nombre | renta del pasado sin previsión → «te necesitan» |
| Exacta | ventas | ✅ | `ventasDeInmueble.ts:49-86` | `saleDate` + `netProceeds` / `loanSettlement.total`, solo `confirmed` | — |
| Exacta | inversión (rendimientos) | ✅ | `rendimientosDeInversion.ts:42-83` | `pagos_generados[]` fecha + neto | vencimiento / `plan_liquidacion` no |
| Exacta | aportaciones (planes/fondos) | ❌ | — | — | `aportacionesPlan`, `traspasosPlanPensiones` no se leen |
| **Aproximada** | declaración (gastos por piso) | ✅ atribuye, no cierra | `gastoDeclaradoPorInmueble.ts:95-128` | cubo único declarado → piso | — (por diseño) |
| Aproximada | gastos históricos (`gastosInmueble`) | ❌ | — | — | 3.504 filas `[dato de Jose]` sin leer; tampoco para no duplicar |
| Aproximada | proveedores (del usuario) | ❌ | — | — | `proveedores` por NIF nunca leído (`AUDIT-stores…:849`) |
| Aproximada | recurrentes (`compromisosRecurrentes`) | ✅ | `movementSuggestionService.ts:202-256` | misma cuenta + importe ±5 % + nombre | **no usa** `conceptoBancario`, `cups`, `numeroContrato`, `reparto[]`, calendario del patrón; solo gasto |
| **Identidad** | nómina | ✅ | `nominas.ts:40-73` | `conceptoBancario` contenido, sin importe | sin `conceptoBancario` guardado no reconoce nada (por diseño) |
| Identidad | `accounts` (traspaso entre propias) | ❌ en el motor | el traspaso es decisión del usuario (`decisionesDeSesion.ts:227-245`, «y las N iguales») | — | no se busca el IBAN destino en el concepto |
| Identidad | aprendido (`movementLearningRules`) | ✅ | `movementSuggestionService.ts:316-358` + alias `:329-347` | hash exacto de n-grams | ver §6 |
| Identidad | facturas (`documents`) | ❌ | — | — | no hay puente documento↔movimiento (hueco 5 del AUDIT-stores, sigue abierto) |

---

## 5 · CERTEZA (modelo §13) · único→AUTO / varios→PROPONE / nada→PREGUNTA

### 5.1 · ¿Distingue tres niveles?

**En el emparejador sí; en el determinista sí-o-nada; en la sesión se pierde un nivel.** VERIFICADO.

| motor | único | varios | nada |
|---|---|---|---|
| `movementMatchingService.classify` `:434-484` | `matches` (score ≥ 70 y, si hay más de uno, margen ≥ 20) | `multiMatches` con candidatos | `sinMatch` |
| `deterministas/*` (`cuotasQueCuadran :87`, `ventas :82`, `rendimientos :79`, `nominas :69`) | origen · cierra la línea | **no elige** (empate = nada) | nada |
| `movementSuggestionService` | confianza 30-90 por vía, una sugerencia | — (cortocircuito en la primera ≥ 60, `:78, :134-147`) | `noSeQueEs` a 30 (`:547-555`) |
| Sesión `extractoSesion.ts:243-247` | `cuadra` | **`resolver`** (los candidatos van en `candidatosIds`, `:197`) | `resolver` |

Es decir: AUTO existe (cuadre con previsto, reconocimiento determinista, confirmado); PROPONE existe en el motor
pero llega a la pantalla como «te necesitan con desplegable» (`conciliacionCandidatos.ts:81-126` recorta a 6
series, `hayCuadreClaro :133-136`); PREGUNTA es el resto. Lo que **no** existe es un estado intermedio persistido
«propuesto, pendiente de un sí» distinto de «te necesitan»: `AtencionLineaExtracto` solo tiene
`recordar | silenciada` (`types-lineasExtracto.ts:25`).

### 5.2 · ¿Matcheo en LOTE (clasificar uno → aplicar a N iguales)?

**Solo para traspasos.** VERIFICADO.
- «y las N iguales» agrupa por texto exacto del banco + signo (`extractoSesion.ts:453-500`,
  `claveDeLineaIgual`), y solo lo aplica `marcarTraspasoLote` (`decisionesDeSesion.ts:227-245`).
- Clasificar varias por ficha exige **selección manual** y solo comparte el concepto, no el importe ni la fecha
  (`clasificarEnBloque.ts:32-42`). No hay «clasifiqué una → se proponen las 11 iguales».
- Nada de esto alimenta el aprendizaje (§6.2).

### 5.3 · ¿Desempata por calendario del recurrente, importe fijo/variable, descarte, expectativa (§22.2-22.3)?

| criterio | ¿existe? | dónde | VERIFICADO |
|---|---|---|---|
| Calendario del recurrente | ⚠️ indirecto | el previsto mensual lleva `predictedDate`; la serie se colapsa a la instancia más cercana (`dedupePorSerie`, `movementMatchingService.ts:491-500`) · el sugeridor vía A **ignora** `patron`/día | sí |
| Importe fijo vs variable | ⚠️ parcial | emparejador: importe exacto abre ventana de 35 días (`:71, :190-194`) y suma +25/+10 según tipo (`:260-306`); vía A usa `importe.modo` solo para calcular una media (`:258-277`), no para tolerancia distinta | sí |
| Descarte | ✅ | un previsto descartado no es candidato (`descarteDePrevision.ts:31-33`, `movementMatchingService.ts:170`) | sí |
| Expectativa («esperaba este cargo y no llegó») | ❌ | no hay concepto; `grep noOcurrio|expectativa` en `src/services` → nada | deducido |

---

## 6 · APRENDIZAJE (modelo §22) · lo que está roto

### 6.1 · `movementLearningService.ts:54-65` · confirmado: borra el nº de contrato

VERIFICADO, líneas exactas de `removeVolatileTokens`:

```ts
.replace(/\b\d{4,}\b/g, '')          // :58 · todo número de 4+ dígitos → nº contrato, CUPS numérico, nº póliza
.replace(/\bref\w*\s*\d+/g, '')      // :59
.replace(/\b[a-z0-9]{8,}\b/g, '')    // :60 · toda cadena alfanumérica de 8+ → CUPS (ES00…), nº factura, matrícula
.replace(/\bES\d{2}\s?\d{4}…/gi, '') // :61 · IBAN
```

**Lo que se guarda como patrón hoy** (`createOrUpdateRule :250-258, :299-314`):
`learnKey` = hash de `v1|signo|3 n-grams más frecuentes` (`buildLearnKey :105-127`), más `counterpartyPattern`
(contraparte normalizada), `descriptionPattern` (descripción sin volátiles), `amountSign`, `categoria`, `ambito`,
`inmuebleId`, `appliedCount`, y desde V85 `aliasContraparte`/`contraparteCanonica`.

Consecuencias verificadas:
- Dos recibos de Iberdrola de **dos pisos distintos** (mismo texto, distinto nº contrato) producen el **mismo**
  `learnKey` y, por tanto, una sola regla con un solo `inmuebleId`: la segunda confirmación **pisa** a la
  primera (`:270-272`). El test `movementLearningService.test.ts:161` lo consagra como comportamiento deseado
  («misma clave con tokens volátiles distintos»).
- La regla no guarda importe: ni fijo ni variable entra en el patrón (§22.2 no está).

### 6.2 · ¿De qué aprende y de qué no?

VERIFICADO (`grep feedLearningRule(|createOrUpdateRule(`):

| gesto del usuario | ¿aprende? | dónde |
|---|---|---|
| Aceptar/asignar un cuadre con previsto | ✅ categoría + ámbito + piso + alias | `confirmarDecisiones.ts:110-114` → `aplicarSugerencia.ts:43-66` |
| Aceptar un reconocimiento determinista | ❌ | `confirmarDecisiones.ts:119-135` no llama a `feedLearningRule` |
| Clasificar a mano por ficha (`creados`) | ❌ | la ficha va por `crearDesdeFicha`; sin llamada al aprendizaje |
| Marcar traspaso / efectivo | ❌ | — |
| Ignorar (§29) | ❌ como regla · ✅ como hecho de la línea (`atencion: 'silenciada'`, `:157-163`) y del lote (`importBatches.lineasIgnoradas[]`, V84) | — |
| Onboarding día 0 | ✅ | `onboardingDetectionService.ts:327` |

Y lo aprendido **no cierra nada**: vía B produce una sugerencia (`movementSuggestionService.ts:316-358`) que en
la pantalla solo decide el montón «personal» (`DrawerExtracto.tsx:203-213`, `conciliarBuckets.ts:88-92`) y al
Guardar no viaja (`extractoSesion.ts:389-394`: «Ya no hay `approvedSuggestions`»). El bucle aprende→aplica está
abierto por la mitad.

### 6.3 · ¿Retroactivo (§22.5)?

**No.** DEDUCIDO por ausencia: `grep -i retroactiv|reprocesa|rematch` en `src/services` solo devuelve migraciones
y el bootstrap («NO genera eventos retroactivos», `treasuryBootstrapService.ts:7`). Lo más cercano es
`reabrirLote` (`reabrirLote.ts:28-59`), que **recalcula** las tres lecturas al retomar un lote a medias: es el
gancho natural para un «reprocesar pendientes», pero solo se dispara al abrir el drawer y solo sobre ese lote.

### 6.4 · ¿Preferencias de atención (§29)?

**Por línea sí, como preferencia aprendida no.** VERIFICADO: `atencion: 'recordar' | 'silenciada'`
(`types-lineasExtracto.ts:25`), escrito en `confirmarDecisiones.ts:162`, y `recuperada` para deshacer
(`:49-50`). El silencio se recuerda entre importaciones por `hashLinea` (`extractoSesion.ts:243-244`), es decir,
por **esa** línea concreta, no por «este concepto siempre». El store `avisosUsuario` es de banners, no de líneas.

---

## 7 · CATÁLOGO NACIONAL de proveedores (modelo §22.4)

**Existe cinco veces como código, cero veces como dato.** VERIFICADO por el explorador y contrastado.

| # | dónde | forma | marcas | lo usa | estado |
|---|---|---|---|---|---|
| 1 | `compromisoDetectionService.ts:42-80` `PROVEEDORES_RECONOCIDOS` | const | 38 | detector de recurrentes (+5 score, tipo/subtipo `:593-594`) | vivo |
| 2 | `documentAutoClassifyService.ts:60-89` `KEYWORD_A_CONCEPTO` | regex[] | ~90 | **solo inbox de facturas** | vivo |
| 3 | `aeatClassificationService.ts:30-56` `PROVIDER_CLASSIFICATION_HINTS` | const | 18 | nadie fuera del fichero | **muerto** |
| 4 | `documentTypeDetectionService.ts:144-147` | string[] | 13 | tipo de documento por nombre | vivo, mínimo |
| 5 | `movementSuggestionService.ts:405-409` regex de suministros/telco | regex | 13 | vía C del sugeridor | vivo |
| 6 | `gastoDeclaradoPorInmueble.ts:29-35` `CUBOS.pistas` | const | ~20 | atribución por declaración | vivo |

- **Separado de `proveedores`**: sí, del todo. `proveedores` (keyPath `nif`, `db.ts:103`,
  `types-inmuebles.ts:588-600`) lo alimentan las declaraciones AEAT y el OCR (`proveedorService.ts:3-6`) y **no lo lee ningún motor**.
- **El fichero nacional de Jose**: no está en el repo. Inventario de datos: `public/assets/banks.catalog.json`
  (bancos), `bank-profiles.json`, índices macro en `public/data/indices/`, `cpMunicipios.json`. Ningún
  CSV/JSON/XLSX de proveedores.
- La deuda ya estaba anotada: `docs/T9-cierre.md:205` («ampliar con marcas locales»).

---

## 8 · IA de caída (modelo §6.4)

**El matcheo de movimientos es determinista; no se cuela coste por línea.** VERIFICADO.

- Los ocho ficheros del camino (`movementMatchingService`, `deterministas/*`, `movementLearningService`,
  `movementSuggestionService`, `lineasExtractoService`, `conciliacionConfirmados`, `conciliacionCandidatos`,
  `clasificarEnBloque`) no importan nada de red ni de IA; `grep fetch(` sobre ellos → cero.
- Toda la UI `src/modules/tesoreria/**` → cero referencias a `scanChat|anthropic|claude|netlify/functions`.
- **Único punto de IA en el import:** `processPdf` → `leerExtractoBancoPdf(file)`
  (`bankStatementOrchestrator.ts:219-247`, una llamada por fichero PDF, aviso «Extracto leído con IA» `:240`),
  bifurcado en `DrawerExtracto.tsx:292`. Después converge en `procesarLoteParseado` y los tres motores deterministas.
  Igual patrón para el extracto de tarjeta en PDF (`personal/extractoTarjeta.ts:109`).
- La función `functions/chat.js` (Anthropic, `:7-9`) sirve además a facturas, FEIN, IRPF y copiloto; nada de eso
  toca movimientos.

Coste real: **0 llamadas** para CSV/XLS; **1 llamada por PDF** (no por línea).

---

## 9 · RECONOCER ≠ CREAR entidad (modelo §22.7)

### 9.1 · Recurrentes desde movimientos

**Existe, es read-only por diseño, está en producción… y no está enganchado al extracto.** VERIFICADO.

| pieza | fichero:línea | qué hace |
|---|---|---|
| Detector | `compromisoDetectionService.ts:249` lee `movements` (no `lineasExtracto`); `:162-173` normaliza (3 primeras palabras ≥3 letras, sin dígitos); `:280-292` agrupa por concepto+cuenta; `:302-372` periodicidad; `:448-488` fijo/variable/porMes; `:635-670` score (umbral 60, `:39`) | devuelve `CandidatoCompromiso[]` con `propuesta` completa (`:690-726`); **cero escrituras** en 935 líneas |
| Creador | `compromisoCreationService.ts:142` `createCompromisosFromCandidatos` → dedupe `:183` → `crearCompromiso` `:191` | persiste y regenera previsiones |
| Pantalla producción | `DetectarCompromisosPage.tsx` · ruta `App.tsx:1207` · botón «Detectar» en `ListadoGastosRecurrentes.tsx:403` | fuera de tesorería |
| Onboarding | `onboardingDetectionService.ts:269-404` (+ préstamos `:160` y nóminas `:197` por regex) | `/empezar` |
| Dev | `pages/dev/CompromisoDetection.tsx` (`App.tsx:690-699`, solo con `isDevPagesEnabled`) | showcase |
| **Desde el drawer del extracto** | `grep compromisoDetection|compromisoCreation` en `src/modules/tesoreria/**` y `horizon/conciliacion/**` → **0** | el drawer crea gasto (`DrawerExtracto.tsx:522`), mejora (`:502`) y traspaso (`:51`), **no recurrente** |

Dos consecuencias para E2: (1) el detector lee `movements`, que tras E1.5 **ya no nacen al importar**: sobre
un extracto recién subido no ve nada hasta que el usuario resuelve; habrá que darle la puerta por línea como
a los otros tres motores. (2) La vía A del sugeridor se activa sola en cuanto existan compromisos
(`compromisoCreationViaA.e2e.test.ts`), así que crear recurrentes mejora el matcheo sin tocar el matcher.

### 9.2 · Contrato desde movimientos

**No existe.** `grep proponerContrato|sugerirContrato|detectarContrato` → 0. `contractImportDetectService.ts:1`
es un reconocedor de cabecera XLSX (Rentila / plantilla ATLAS), sin relación con movimientos. El único puente
movimiento↔contrato va al revés (estado de cobro, `estadoCobroContratoService.ts:25`).

---

## 10 · Lo que E1 YA dejó construido del motor (no reconstruir)

VERIFICADO contra `git show --stat` de #1841-#1854:

| pieza | commit | fichero | qué aporta al motor |
|---|---|---|---|
| Store `lineasExtracto` con `hashLinea`, `hashMovement`, `descarte`, `estado`, `atencion`, `decision`, `movementIds[]` | E1.1 #1842, E1.3 #1845 | `db/types-lineasExtracto.ts:60-111`, `lineasExtractoService.ts:54-81` | la línea del banco sobrevive; el motor tiene sobre qué reprocesar |
| Sesión en `lineaId` + decisiones persistidas + retomar lote | E1.2a/b #1843-44, E1.3 #1845 | `extractoSesion.ts`, `decisionesDeSesion.ts`, `decisionesPersistidas.ts`, `montarSesion.ts`, `reabrirLote.ts` | el «reprocesar» ya tiene un punto de entrada (`analizarLineas`) |
| Tests de caracterización del matcheo (lote de agosto/septiembre, salida completa) | E1.4a #1846 | `__tests__/caracterizacionMatcheo.test.ts` (686) | red de seguridad para tocar el marcador |
| Adaptador línea→movimiento en memoria + puertas por línea de los cuatro motores + tests de equivalencia | E1.4b #1847 | `lineaComoMovimiento.ts`, `matchLineas`, `suggestForLineas`, `reconocerDeterministasDeLineas`, `confirmadosPorLinea`, `matcheoPorLinea.equivalencia.test.ts` (454) | cualquier motor nuevo se enchufa igual: `movimientosDesdeLineas` + `…PorLinea` |
| El corte: importar no crea movimientos; `confirmarDecisiones` por línea (cuatro bloques); `materializarLinea` | E1.5 #1850 | `confirmarDecisiones.ts:58-164`, `materializarLinea.ts` | punto único donde enganchar el aprendizaje de **todo** gesto |
| Ignorar = `atencion: 'silenciada'` (§29), reversible | E1.5 | `confirmarDecisiones.ts:157-163` | la pata «preferencia de atención» está a medio hacer |
| Parser: miles con coma inglesa | E1.5-fix #1851 | `bankParser.ts`, `numberUtils.ts` | — |
| Cuadre con el saldo del banco + apertura derivada (§31) | #1852, #1854 | `anclajeSaldoExtracto.ts`, `aperturaDerivada.ts`, `CuadreConElBanco.tsx` | el Nivel −1 sabe si el fichero «cuadra» con la cuenta |
| Limpieza de fichas huérfanas al cancelar lote | #1849 | `fichasDelLote.ts` | — |
| Umbral para contradecir la cuenta elegida | (pre-E1, #18xx) | `deteccionDeBanco.ts:27, :42-49` | Nivel −1 |
| Reconocedor determinista (5 fuentes) + cierre | fases 1-2 (pre-E1) | `deterministas/*`, `cierreDeterminista.ts` | la clase «exacta» del modelo, ya hecha |

---

## 11 · Tabla resumen por pieza

| # | pieza | EXISTE | ROTO / parcial | FALTA de cero |
|---|---|---|---|---|
| 1 | Identificar fichero | cuenta por IBAN (CSV), banco por perfil (10), pista desde la cuenta elegida, umbral 60, `hashLote` + `hashMovement`, apertura derivada §31 | IBAN invisible en XLSX/PDF; perfiles no normalizan; `universalBankImporter` muerto; `rangoFechas` vacío; N43 anunciado sin parser | crear cuenta desde fichero; leer cabecera completa; solape/hueco por rango; dedupe difusa; CSB43/OFX; bancos sin perfil |
| 2 | Tipo de operación | signo → Ingreso/Gasto; Bizum; cajero como propuesta | heurísticas globales solo como sugerencia sobre `sinMatch` | Nivel 0 real: enum de tipo persistido en la línea (domiciliación, tarjeta, transferencia, traspaso, comisión, intereses, devolución, nómina) + normalización por banco |
| 3 | Ancla 3 patas | `includes`/regex/n-grams sobre texto; nómina por `conceptoBancario`; Bizum por nombre | piso nunca puntúa; inquilino solo en ingresos | extractor de identificadores (CUPS/nº contrato/IBAN/NIF) del concepto para movimientos (copiar `documentAutoClassifyService.ts:330-342`) |
| 4 | Cruce fuentes | 11 stores (§4.1) | recurrentes sin `conceptoBancario`/`cups`/calendario; contratos solo vía previsión o Bizum | `proveedores`, `accounts` (IBAN destino), `gastosInmueble` (histórico + no duplicar), `documents`, aportaciones/traspasos de planes |
| 5 | Certeza | 3 niveles en emparejador; determinista sí/nada; descarte respetado | sesión aplana a 2; sugerencias no resuelven; vía A ignora patrón | estado «propuesto» persistido; lote «una → las N iguales» para clasificar; expectativa |
| 6 | Aprendizaje | reglas por n-gram + alias de contraparte; silenciado por línea | `:58-60` borra identificadores; solo aprende del cuadre con previsto; no cierra líneas; no retroactivo | patrón con identificador + importe fijo; aprender de ficha/determinista/traspaso; reprocesar pendientes desde `analizarLineas` |
| 7 | Catálogo nacional | 5-6 listas hardcodeadas | duplicadas; una muerta (`aeatClassificationService.ts:30`) | store/fichero único de referencia + lectura desde el matcheo; `proveedores` (NIF) conectado |
| 8 | IA | determinista | — | — (solo vigilar que el PDF siga siendo 1 llamada/fichero) |
| 9 | Reconocer ≠ crear | detector + creador de recurrentes, 2 UIs de producción | lee `movements`, no líneas; no enganchado al drawer | proponer contrato desde movimientos |

---

## 12 · Valoración de CC · por dónde partir E2 (propone, no decide)

**Primera tarea recomendada: E2.1 · el ancla por identificador + arreglar el patrón aprendido.**
Es la pieza con más valor por menos riesgo:
- Toca dos ficheros pequeños y puros (`movementLearningService.ts:54-65` y un extractor nuevo tipo
  `deterministas/texto.ts`), con precedente hecho (`documentAutoClassifyService.ts:330-342`) y con la red de
  tests de E1.4a/E1.4b ya montada.
- Resuelve el bug conocido (dos Iberdrola de dos pisos = una regla) y da al resto de E2 la llave que
  necesitan: un `cups`/`numeroContrato` extraído del concepto es lo que permite cruzar contra
  `compromisosRecurrentes.cups` (V83) sin heurística.
- Riesgo: cambiar `buildLearnKey` invalida las reglas existentes (hash `v1`). Hay que versionar la clave
  (`v2|…`) y dejar `v1` como respaldo de lectura, no migrar.

**Después, en este orden:**
1. **E2.2 · cerrar el bucle del aprendizaje** en `confirmarDecisiones.ts`: aprender de los cuatro bloques (no solo
   del 1) y de la ficha; y que una regla con `appliedCount ≥ N` **resuelva** (nuevo canal en el payload,
   el que se retiró en 2.0.2 pero esta vez creando la fila fiscal vía `crearDesdeFicha`).
2. **E2.3 · recurrentes de verdad en vía A**: `conceptoBancario` + `cups`/`numeroContrato` + calendario del
   `patron` + tolerancia por `importe.modo` (fijo exacto / variable ±) + `reparto[]`. Sin tocar el emparejador.
3. **E2.4 · reprocesar pendientes** (§22.5): un `reanalizarPendientes()` que llame a `analizarLineas` sobre
   `lineasExtracto` con `estado:'pendiente'` de todas las cuentas cuando se crea/edita un contrato, préstamo,
   recurrente o regla. La función ya existe (`bankStatementOrchestrator.ts:290-307`); falta el disparador.
4. **E2.5 · enganchar el detector de recurrentes al drawer** por línea (`movimientosDesdeLineas` como entrada,
   como hicieron los otros tres motores en E1.4b) y ofrecer «crear recurrente» junto a gasto/mejora/traspaso.
   Es lo que más se ve, pero propone basura si 1-3 no están (mismo aviso que el AUDIT-stores, entregable 4).
5. **E2.6 · catálogo nacional**: un módulo único `proveedoresConocidos.ts` que absorba las 5 listas, y **después**
   un store si Jose aporta el fichero. Leer también `proveedores` por NIF desde el extractor de E2.1.
6. **E2.7 · Nivel 0**: un `tipoOperacion` en `LineaExtractoPersistida` calculado al importar por regex
   (domiciliación/adeudo, tarjeta/TPV, transferencia, Bizum, cajero, comisión, intereses, devolución, nómina),
   global primero y con override por perfil de banco después. Es independiente del marcador y le da a todos los
   motores un filtro barato (una cuota nunca es una compra con tarjeta). Reutilizar `retiradaCajero.ts` y `bizum.ts`.
7. **Nivel −1**: IBAN en XLSX (leer la primera hoja con SheetJS en vez de texto plano), `rangoFechas` real y
   aviso de solape/hueco. Bajo riesgo, poco valor para el matcheo: al final.

**Aviso sobre lo muerto:** `universalBankImporter/` (~2.000 líneas) y `utils/duplicateDetection.ts` no se
tocan ni se reviven en E2; cuando haga falta un Nivel 0 por banco, se decide entonces si se rescata `signDerivationService`.

**Lo que CC no haría en E2:** tocar los pesos del marcador (`scorePair`) antes de tener el ancla por
identificador. La auditoría del 29/8 ya avisó de que el techo del marcador para recibos variables es 55-60
sobre 70; subir pesos sin identidad sube también los falsos positivos.
