# Auditoría de vocabulario · turístico / vacacional / temporada / corta estancia

**Base:** `main` @ `7619f63` (*feat(fiscal): motor único de reducción y bloque fiscal en el alta · #1803*).
`HEAD == origin/main` verificado tras `git fetch`.
**Alcance:** solo lectura. No se ha modificado ningún fichero de código. Este documento es el único fichero añadido.

---

## 0 · Resumen de una línea

Hay **tres nombres** (`temporada`, `vacacional`, `turistico`) que hoy resuelven al **mismo concepto fiscal**
(`otros_arrendamientos`, 0 % de reducción, mismas casillas). Y falta el **único concepto que sí es distinto**
para la AEAT: `actividad_economica`. No existe en ningún tipo, ningún campo, ninguna rama.

---

## 1 · Inventario de nombres

### 1.1 · Tipos y enums

Nueve enums distintos hablan del mismo eje, con vocabularios que no coinciden entre sí:

| # | Tipo / campo | Fichero:línea | Valores | Persistido |
|---|---|---|---|---|
| A | `Contract.modalidad` | `src/services/db/types-contratos.ts:194` | `habitual` · `temporada` · **`vacacional`** | Sí (IndexedDB) |
| B | `Contract.documentoContrato.plantilla` | `src/services/db/types-contratos.ts:292` | `habitual` · `temporada` · `vacacional` · `habitacion` | Sí |
| C | `Property.usoTipo` | `src/services/db/types-inmuebles.ts:129‑135` | `larga_estancia` · `temporada` · **`turistico`** · `mixto` · `vivienda_habitual` · `disponible` | Sí (legacy read‑only desde v90) |
| D | `ModoExplotacionAlquiler` | `src/services/db/types-inmuebles.ts:226` | `completo` · `habitaciones` · **`turistico`** | Sí (store `explotacionAlquiler`, v90) |
| E | `RegimenAlquiler` | `src/services/reduccionAlquiler.ts:35` | `habitual` · `temporada` · **`turistico`** | No (motor fiscal) |
| F | `CatalogoKind` | `src/modules/inmuebles/wizards/utils/catalogoModalidadInmueble.ts:29` | `viviendaCompleta` · `habitaciones` · **`turistico`** | No (catálogo OPEX) |
| G | `TipoContrato` | `src/modules/inmuebles/utils/mapearTipoContrato.ts:10` | `larga` · `corta` | No (filtro UI) |
| H | `ContractDraft.modalidadAtlas` | `src/services/contractDraftService.ts:34` | `habitual` · **`vacacional`** (solo 2) | No (importador contratos) |
| I | `TipoAlquiler` (wizard onboarding) | `src/components/onboarding/import-declaracion/pasos/PasoInmuebles.tsx:17` | `larga_estancia` · `temporada` · `turistico` · `mixto` | No (form) |

Ejes adyacentes que también participan:

| Tipo | Fichero:línea | Valores |
|---|---|---|
| `ArrendamientoDeclarado.tipoArrendamiento` | `src/types/declaracionCompleta.ts:217` | `vivienda` · `no_vivienda` |
| `tipoArrendamiento` numérico | `src/services/rendimientoActivoService.ts:54, 68, 135‑136, 223` | `1` (vivienda) · `2` (otros) |
| `ModoDeclaracionFiscal` I–V | `src/services/fiscalSummaryService.ts:545‑584` | `I` · `II` · `III` · `IV` · `V` |
| `tipoVivienda` (deducciones autonómicas) | `src/services/fiscal/tipos.ts:92, 139` | `habitual` · `temporada-larga` · `inversion` |
| `EntidadAtribucionRentas.tipoRenta` | `src/types/declaracionCompleta.ts:48` · `src/services/db/types-movimientos.ts:642` | `capital_inmobiliario` · **`actividad_economica`** · `capital_mobiliario` |

> **Dato duro:** `Contract.modalidad` **nunca** toma el valor `turistico` y `Property.usoTipo` **nunca** toma
> `vacacional`. Verificado por grep exhaustivo: la única aparición de `modalidad === 'turistico'` es una rama
> defensiva en `src/services/irpfCalculationService.ts:376` que ningún escritor alimenta.
> Los dos enums son **disjuntos en su tercer valor**, y esa es la raíz del problema de nombres.

### 1.2 · Lógica (motores fiscales, reducción, prorrateo)

| Fichero:línea | Qué hace con el nombre |
|---|---|
| `src/services/reduccionAlquiler.ts:99‑108` | `regimen === 'temporada'` → 0 %, motivo `sin_reduccion` |
| `src/services/reduccionAlquiler.ts:110‑118` | `regimen === 'turistico'` → 0 %, motivo `sin_reduccion` (texto distinto, número idéntico) |
| `src/services/irpfCalculationService.ts:337‑344` | `calcularPorcentajeReduccionContrato` · lo confirmado en `Contract.reduccion` manda |
| `src/services/irpfCalculationService.ts:370‑377` | `regimenDelContrato` · `vacacional` **o** `turistico` → `'turistico'` |
| `src/services/irpfCalculationService.ts:814` | `modalidad === 'habitual'` → marca `esHabitual` (fallback legacy de reducción) |
| `src/services/fiscalSummaryService.ts:567‑583` | `detectarModoDeclaracion` · `vacacional`/`temporada` → `tieneCorta`; `usoTipo` `turistico`/`temporada` → modo `V` |
| `src/services/fiscalSummaryService.ts:586‑598` | `detectarPorcentajeReduccion` · modo `V` → 0; modos `I`/`II`/`III` → **60 hardcodeado** |
| `src/services/fiscalSummaryService.ts:646‑653` | `detectarMetodoProrrateo` · **no mira la modalidad**; ambas ramas devuelven `dias_habitacion` |
| `src/services/fiscalSummaryService.ts:763‑768` | `box0150 = box0149 × %` sobre el **total** del inmueble, sin desglose |
| `src/services/explotacionAlquilerService.ts:69‑87` | `usoTipo` → `ModoExplotacionAlquiler` |
| `src/services/contractService.ts:68‑80` | modalidad → plantilla de documento |
| `src/services/contractService.ts:456‑457` | valida que `modalidad ∈ {habitual, temporada, vacacional}` |
| `src/services/contractService.ts:485‑491` | **tope de 6 meses SOLO para `vacacional`** |
| `src/services/alquileresV3FixService.ts:92` | recálculo de `fechaFin` solo para `habitual`; temporada/vacacional intactos |
| `src/modules/inmuebles/wizards/utils/catalogoModalidadInmueble.ts:98‑124` | `temporada` **o** `vacacional` → catálogo `TURISTICO` (16 conceptos) |
| `src/modules/inmuebles/utils/sembrarOpexInmueble.ts:53‑65` | `modo 'turistico'` → `modalidad 'temporada'` |
| `src/modules/inmuebles/utils/sembrarOpexInmueble.ts:83` | `licencia_turistica` → periodicidad anual |
| `src/modules/inmuebles/utils/mapearTipoContrato.ts:12‑17` | `temporada`/`vacacional` → `'corta'` |
| `src/modules/inmuebles/utils/historico/calculos.ts:229‑252` | agrupa duraciones en `corta`/`larga` |
| `src/modules/shared/components/ListadoGastos/utils/groupingHelpers.ts:102` | `licencia_turistica` en el bloque «propias de la modalidad» |

### 1.3 · UI (labels, chips, cards)

| Fichero:línea | Texto |
|---|---|
| `src/modules/inmuebles/wizards/BloqueFiscalContrato.tsx:68‑72` | selector de régimen: `Vivienda habitual` / `Temporada` / **`Turístico`** |
| `src/modules/inmuebles/wizards/BloqueFiscalContrato.tsx:96‑101` | adaptadores `modalidad ↔ regimen` con el comentario «`vacacional` es como se llama el turístico» |
| `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx:366‑369` | `Habitual · LAU 5 años` / `Temporada` / **`Vacacional`** |
| `src/modules/inmuebles/wizards/NuevoContratoWizard.tsx:570‑572` | plantilla «LAU · Temporada» descrita como «11 meses · **turístico**» |
| `src/modules/inmuebles/wizards/AnexarSubcontratoForm.tsx:246‑249` | `Vivienda habitual` / `Temporada` / **`Vacacional / turístico`** |
| `src/components/onboarding/import-declaracion/pasos/PasoInmuebles.tsx:399‑402` | `Larga estancia` / `Temporada` / **`Turístico / vacacional`** / `Mixto` |
| `src/modules/inmuebles/import/PasoRevision.tsx:58‑59` | solo `Vacacional` / `Habitual` |
| `src/modules/inmuebles/components/contratos/TabDisponibilidad.tsx:60‑64` | `Piso completo` / `Por habitaciones` / **`Turístico`** |
| `src/modules/inmuebles/components/contratos/TabDisponibilidad.tsx:706` | leyenda «Vigente · **corta/vacacional**» |
| `src/modules/ajustes/pages/PlantillasPage.tsx:59‑66` | plantilla `key:'turistico'`, nombre **«Turístico · corta estancia»**, meta «LAU **temporada** · alta **turística** autonómica» |
| `src/modules/fiscal/v2/helpers/inmuebleCasillasService.ts:399‑404` | modo V · tag `Corta estancia`, título **«Turístico o temporada»** |
| `src/modules/fiscal/v2/helpers/inmuebleCasillasService.ts:204‑215` | subtítulo de la 0150 (ver §3.4) |
| `src/modules/fiscal/v2/helpers/inmuebleCasillasService.ts:373‑391` | modo I `Larga estancia`; modo III «combinando **corta y larga** estancia» |
| `src/modules/fiscal/v2/FiscalInmueblePage.tsx:98` | «prorrateo … sobre los gastos comunes a **corta y larga** estancia» |
| `src/modules/inmuebles/components/contratos/historico/DrawerExContrato.tsx:201` | `Corta estancia` / `Larga estancia` |
| `src/modules/inmuebles/components/contratos/historico/TablaExInquilinos.tsx:133` | ídem (aria-label) |
| `src/modules/horizon/herramientas/exporters/atlasExportService.ts:542‑546` | export: «Contrato de temporada» / «Contrato **vacacional**» |
| `src/components/common/Tooltip.tsx:154` | glosario: **`vacacional`** = «alquiler por periodos cortos … para **turismo**» |
| `src/components/common/Glossary.tsx:31` | término indexado: `vacacional` |
| `src/modules/horizon/fiscalidad/historico/ImportarDeclaracionWizard.tsx:86` | `tipoArrendamiento === 'vivienda'` → « · Vivienda» |

### 1.4 · Importación (qué código AEAT mapea a qué)

| Fichero:línea | Origen | Destino |
|---|---|---|
| `src/services/irpfXmlParserService.ts:575‑581` | etiqueta `<TAR1>` presente | `tipoArrendamiento = 'vivienda'` |
| `src/services/irpfXmlParserService.ts:576, 581` | etiqueta `<TAR2>` presente | `tipoArrendamiento = 'no_vivienda'` |
| `src/services/irpfXmlParserService.ts:577, 620` | `<FAR1>` | `esResidenciaHabitual` |
| `src/services/irpfXmlParserService.ts:621` | `<RAR3>` | `regimenReduccion = '3'` |
| `src/services/irpfXmlParserService.ts:624` | `PORCF ≠ 'NO'` | `tieneReduccion` |
| `src/services/irpfXmlParserService.ts:646‑649` | `C_TIPAR1` = `1` / `2` (ruta sin bloques) | `vivienda` / `no_vivienda` |
| `src/services/declaracionDistributorService.ts:147` | comentario: «FA32 2024: **TAR1 LAU + TAR2 turístico**» | `modoExplotacion = 'mixto'` |
| `src/services/declaracionDistributorService.ts:249‑250` | `tipoArrendamiento` | pasa a `crearOActualizarContrato` |
| `src/services/declaracionOnboardingService.ts:1000‑1008, 1031` | `no_vivienda` (camino 1 · con NIF) | **`modalidad: 'temporada'`** + `unidadTipo: 'habitacion'` |
| `src/services/declaracionOnboardingService.ts:1157‑1158, 1203` | `no_vivienda` (camino 2 · sin NIF) | **`modalidad: 'vacacional'`** |
| `src/services/rendimientoActivoService.ts:135‑136` | `tipoArrendamiento === 'vivienda'` | `1`, si no `2` |
| `src/services/contractDraftService.ts:82‑109` | Rentila: `temporada`, `habitacion temporada` | **`vacacional`** |
| `src/services/contractDraftService.ts:112‑116` | plantilla ATLAS: texto con «temporada» o «vacacional» | **`vacacional`** |
| `src/services/inmueblesTemplateParserService.ts:163‑169` | plantilla inmuebles: `larga` / `temporada` / `turist` / `mixto` | `usoTipo` correspondiente |
| `src/services/documentAutoClassifyService.ts:61` | texto «licencia turística» en un PDF | concepto `licencia_turistica` |
| `src/services/migrations/v90-explotacionAlquiler.ts` (vía `explotacionAlquilerService.ts:69‑87`) | `usoTipo` legacy | `ExplotacionAlquiler.modo` |

---

## 2 · ¿Cuántos conceptos hay realmente?

### 2.1 · ¿«Turístico» es turístico en sentido legal, o es un cajón?

**Es un cajón.** No hay ni un campo en todo el modelo que registre licencia, número de registro autonómico,
servicios de hospedaje, ni epígrafe IAE asociado a un alquiler. La única huella de «turístico legal» es un
**concepto de gasto**, `licencia_turistica` (`src/services/conceptos/conceptosBase.ts:63‑69`), y ni siquiera
clasifica nada: se declara como tasa municipal corriente en la casilla 0115, «mismo trato que IBI y basuras»
(`src/services/catalogoPresentacionPersistencia.ts:61‑65`).

El eje `capital_inmobiliario | actividad_economica` **sí existe** en el código
(`src/types/declaracionCompleta.ts:48`) pero pertenece a `EntidadAtribucionRentas` — rentas atribuidas por una
CB/SC — y **nunca** al alquiler propio del usuario. Consumidores:
`src/services/entidadAtribucionService.ts:96‑98`, `src/services/declaracionCompletaToIRPFAdapter.ts:249`.
Ningún `Property` ni `Contract` puede declararse actividad económica.

### 2.2 · ¿Temporada se trata igual o distinto que turístico?

**Igual en todo lo que produce un número.** El motor de reducción devuelve para ambos exactamente
`porcentaje: 0`, `motivo: 'sin_reduccion'`, `avisos: []`
(`src/services/reduccionAlquiler.ts:99‑108` vs `110‑118`). Lo único que difiere entre las dos ramas son las
cadenas `explicacion` y `baseLegal`.

Recorrido completo comprobado:

| Salida | ¿Distingue temporada de turístico? | Evidencia |
|---|---|---|
| % de reducción | **No** — 0 en ambos | `reduccionAlquiler.ts:99‑118` |
| Modo de declaración I–V | **No** — ambos → `V` | `fiscalSummaryService.ts:569, 574, 580` |
| Casillas 0149/0150/0154 | **No** — modo V ⇒ 0 % en los dos | `fiscalSummaryService.ts:591` |
| Método de prorrateo | **No** — no lee la modalidad | `fiscalSummaryService.ts:646‑653` |
| IVA | **No existe** — nada en el repo liga tipo de alquiler a IVA (la única mención es un comentario sobre parkings en `src/types/tipoActivo.ts:7`) | — |
| Actividad económica | **No existe** para el alquiler propio | §2.1 |
| Catálogo de OPEX | **No** — `catalogoKindDeModalidad` colapsa los dos en `turistico` | `catalogoModalidadInmueble.ts:102` |
| Filtro larga/corta | **No** — ambos → `corta` | `mapearTipoContrato.ts:14` |
| **Validación de duración** | **Sí** — tope de 6 meses solo para `vacacional` | `contractService.ts:485‑491` |
| Etiqueta de export | **Sí** — «Contrato de temporada» vs «Contrato vacacional» | `atlasExportService.ts:543‑544` |

Es decir: de todo el recorrido, **una sola regla de negocio** distingue, y distingue entre `vacacional` y
`temporada` (no entre «turístico» y «temporada» como conceptos): el tope de 6 meses. Todo lo demás es texto.

### 2.3 · Dónde se fusionan y dónde se separan

**Se FUSIONAN aquí:**

| Punto | Fichero:línea | Qué se funde |
|---|---|---|
| `TAR2` | `irpfXmlParserService.ts:576, 581` | temporada + turístico + local + garaje + arrendamiento de negocio → `no_vivienda` |
| `CatalogoKind` | `catalogoModalidadInmueble.ts:102` | `temporada` + `vacacional` → `turistico` |
| `TipoContrato` | `mapearTipoContrato.ts:14` | `temporada` + `vacacional` → `corta` |
| Modo `V` | `fiscalSummaryService.ts:569, 574, 580` | `vacacional` + `temporada` + `usoTipo turistico` → `V` |
| `modalidadAtlas` | `contractDraftService.ts:34, 85‑86, 104‑109` | 3 modalidades → 2; **`temporada` desaparece del importador de contratos** |
| `ModoExplotacionAlquiler` | `types-inmuebles.ts:226` | mezcla **forma de la unidad** (`completo`/`habitaciones`) con **tipo de alquiler** (`turistico`) en un solo eje: un turístico por habitaciones no se puede expresar |

**Se SEPARAN aquí:**

| Punto | Fichero:línea | Cómo |
|---|---|---|
| `Contract.modalidad` | `types-contratos.ts:194` | 3 valores, `temporada` distinto de `vacacional` |
| `Property.usoTipo` | `types-inmuebles.ts:129‑135` | 3 valores de alquiler + `mixto` |
| `RegimenAlquiler` | `reduccionAlquiler.ts:35` | 3 valores… que producen 2 resultados |
| `explotacionDesdeLegacy` | `explotacionAlquilerService.ts:69‑74, 83‑87` | `usoTipo 'turistico'` → modo `turistico`, pero **`usoTipo 'temporada'` → modo `completo`** |
| Duración | `contractService.ts:485‑491` | tope 6 meses solo `vacacional` |
| Fecha fin | `declaracionOnboardingService.ts:1003` · `alquileresV3FixService.ts:92` | +5 años LAU solo para `habitual` |

Nótese que `catalogoKindDeModalidad` (temporada → turístico) y `explotacionDesdeLegacy` (temporada → completo)
**colapsan en direcciones opuestas**.

---

## 3 · Divergencias de comportamiento

### 3.1 · ¿«vacacional» ≠ «turístico»?

No: son **el mismo concepto con dos nombres**, repartidos entre dos entidades — `vacacional` vive en el
contrato, `turistico` vive en el inmueble y en el motor fiscal. El propio código lo dice dos veces:

- `src/modules/inmuebles/wizards/BloqueFiscalContrato.tsx:96` — *«`vacacional` es como se llama el turístico en el modelo de contratos»*
- `src/services/irpfCalculationService.ts:375` — *«`vacacional` es como se llamaba el turístico en el modelo viejo»*

Y ambos ficheros llevan el adaptador correspondiente (`BloqueFiscalContrato.tsx:97‑101`,
`irpfCalculationService.ts:376`). La UI usa los dos nombres juntos como si fueran uno solo:
«Vacacional / turístico» (`AnexarSubcontratoForm.tsx:248`), «Turístico / vacacional»
(`PasoInmuebles.tsx:401`), leyenda «corta/vacacional» (`TabDisponibilidad.tsx:706`).

La única divergencia real de comportamiento entre los dos nombres es accidental: el tope de 6 meses de
`contractService.ts:485‑491` se dispara con `vacacional` y no con `temporada`, porque está escrito contra el
literal, no contra el concepto.

### 3.2 · El mismo dato AEAT produce dos nombres distintos

`TAR2` → `tipoArrendamiento = 'no_vivienda'` (`irpfXmlParserService.ts:581`) se convierte, **dentro del mismo
servicio**, en dos modalidades diferentes según por qué rama entre:

- `src/services/declaracionOnboardingService.ts:1008` (camino 1 · arrendamiento con NIF) → **`'temporada'`**
- `src/services/declaracionOnboardingService.ts:1158` (camino 2 · sin NIF) → **`'vacacional'`**

Consecuencias observables aguas abajo, para dos contratos que la AEAT declaró idénticos:
plantilla de documento distinta (`:1031` vs `:1203`), etiqueta de export distinta
(`atlasExportService.ts:543‑544`) y la validación de 6 meses aplicándose a uno y no al otro
(`contractService.ts:485`).

### 3.3 · Adaptadores que pierden información

| Adaptador | Fichero:línea | Pérdida |
|---|---|---|
| `modalidad ↔ regimen` | `BloqueFiscalContrato.tsx:97‑101` | ninguna (3↔3) |
| `modalidad → regimen` | `irpfCalculationService.ts:373‑377` | ninguna; acepta los dos nombres |
| `modo → args de catálogo` | `sembrarOpexInmueble.ts:56‑58` | **de nombre**: `modo 'turistico'` se traduce a `modalidad 'temporada'`. Hoy inocuo porque el catálogo colapsa las dos, pero el tipo miente |
| `usoTipo → modo` | `explotacionAlquilerService.ts:69‑74, 83‑87` | **real**: `usoTipo 'temporada'` → `modo 'completo'`. Tras la migración v90, un inmueble de temporada queda indistinguible de un piso completo de larga estancia y recibe el catálogo `VIVIENDA_COMPLETA` (7 conceptos) en vez del de temporada/turístico (16): sin limpieza por estancia, sin lavandería, sin comisión de plataformas, sin licencia turística |
| Rentila/plantilla → `modalidadAtlas` | `contractDraftService.ts:104‑116` | **real**: 3→2. «Contrato de arrendamiento de temporada» entra como `vacacional`; `temporada` es inalcanzable desde este importador |
| texto → `usoTipo` | `inmueblesTemplateParserService.ts:160‑170` | **real**: no hay rama para «vacacional». Una plantilla que diga *Vacacional* devuelve `null` y el inmueble se queda **sin `usoTipo`** |
| `modalidad → tipo` | `mapearTipoContrato.ts:12‑17` | 3→2, deliberado, solo UI |
| `modalidad → CatalogoKind` | `catalogoModalidadInmueble.ts:98‑105` | 3→3 kinds con colapso temporada+vacacional |
| `TAR2 → modalidad` | `declaracionOnboardingService.ts:1008` / `:1158` | **incoherente**: mismo origen, dos destinos (§3.2) |

### 3.4 · Error fiscal real: la reducción del 60 % se aplica a la parte de temporada

Tres hechos encadenados:

1. `detectarPorcentajeReduccion` (`src/services/fiscalSummaryService.ts:586‑598`) busca un `%` explícito en
   `c.reduccionLeyVivienda`. **Ese campo no existe en `Contract`**: sus dos únicas apariciones en todo el repo
   son las líneas 588 y 593 de esa misma función. `explicit` siempre sale vacío, así que la función cae al
   `return 60` hardcodeado de la línea 596 para los modos `I`, `II` y **`III`**. `Contract.reduccion.porcentaje`
   —lo que el usuario confirmó en el alta— no se lee nunca por esta vía.
2. El modo `III` es precisamente el de inmueble mixto: `if (tieneLarga && tieneCorta) return 'III'`
   (`fiscalSummaryService.ts:573`), donde `tieneCorta` incluye `vacacional` y `temporada` (línea 569).
3. La 0150 se calcula sobre el rendimiento **completo** del inmueble, sin desglose:
   `box0150 = round2(box0149 * (porcentajeReduccion / 100))` (`fiscalSummaryService.ts:763‑764`).

Resultado: en un inmueble con contrato de larga estancia **y** contrato de temporada, el 60 % se aplica también
a la parte de temporada, que según la AEAT es `otros_arrendamientos` y reduce **0 %**.

Y la pantalla afirma lo contrario. `src/modules/fiscal/v2/helpers/inmuebleCasillasService.ts:211‑215` pinta como
subtítulo de la 0150, en modo III, literalmente:

> *«aplicada sólo a la parte de larga estancia · habitaciones de temporada sin reducción»*

El comentario de las líneas 207‑210 del mismo fichero explica que ese texto existe justamente «para evitar la
impresión de que el 60 % se aplicó al total». Se aplica al total.

Nota adicional: esta ruta **no pasa por `reduccionAlquiler.ts`**. La afirmación de fuente única de
`src/services/reduccionAlquiler.ts:10‑13` es cierta para `calcularPorcentajeReduccionContrato`, pero
`fiscalSummaryService` mantiene su propio 60 % en paralelo — vuelve a haber dos motores.

### 3.5 · La advertencia de actividad económica se escribe y no se enseña

`src/services/reduccionAlquiler.ts:110‑118` es el único punto del código que nombra el riesgo:

> *«El alquiler turístico no tiene reducción; con servicios de hospedaje puede ser actividad económica.»*
> `baseLegal: 'Rendimiento de capital o actividad económica'`

Pero devuelve `avisos: []` (línea 117) — la lista vacía, mientras que las ramas de vivienda habitual sí pueblan
`AVISOS_GENERALES` (líneas 78‑82). O sea: la única mención a actividad económica del recorrido está en dos
cadenas de texto informativas y **no genera ningún aviso, ninguna bifurcación y ningún campo**.

---

## 4 · Anexo AEAT · a qué eje corresponde cada nombre

Taxonomía de referencia (Manual Modelo 100 2024): eje 1 `capital_inmobiliario` vs `actividad_economica`
(§7.3.5.3); eje 2, solo dentro de capital inmobiliario, `vivienda_habitual` (único que reduce) vs
`otros_arrendamientos` (término literal, línea 4235; 0 %).

| Nombre en el código | Dónde vive | Eje 1 | Eje 2 | Veredicto |
|---|---|---|---|---|
| `modalidad 'habitual'` | `types-contratos.ts:194` | capital_inmobiliario | `vivienda_habitual` | ✅ correcto |
| `usoTipo 'larga_estancia'` | `types-inmuebles.ts:130` | capital_inmobiliario | `vivienda_habitual` | ✅ |
| `regimen 'habitual'` | `reduccionAlquiler.ts:35` | capital_inmobiliario | `vivienda_habitual` | ✅ único que reduce (50/60/70/90) |
| `modalidad 'temporada'` | `types-contratos.ts:194` | capital_inmobiliario | `otros_arrendamientos` | ✅ en `reduccionAlquiler.ts:99‑108`; ❌ en modo III (§3.4) |
| `usoTipo 'temporada'` | `types-inmuebles.ts:131` | capital_inmobiliario | `otros_arrendamientos` | ✅ fiscalmente; ⚠️ se pierde en la explotación (`explotacionAlquilerService.ts:72`) |
| `modalidad 'vacacional'` | `types-contratos.ts:194` | capital_inmobiliario **por defecto** | `otros_arrendamientos` | ⚠️ sin vía a `actividad_economica` |
| `usoTipo 'turistico'` | `types-inmuebles.ts:132` | ídem | `otros_arrendamientos` | ⚠️ ídem |
| `regimen 'turistico'` | `reduccionAlquiler.ts:35` | ídem | `otros_arrendamientos` | ⚠️ ídem |
| `ModoExplotacionAlquiler 'turistico'` | `types-inmuebles.ts:226` | — | — | ❌ no es un eje fiscal: mezcla tipo de alquiler con forma de la unidad |
| `CatalogoKind 'turistico'` | `catalogoModalidadInmueble.ts:29` | — | — | ✅ es solo catálogo de gasto, no clasifica fiscalmente |
| `TipoContrato 'corta'` | `mapearTipoContrato.ts:10` | — | `otros_arrendamientos` (de facto) | ✅ como filtro de UI |
| `tipoArrendamiento 'vivienda'` (TAR1) | `irpfXmlParserService.ts:580` | capital_inmobiliario | `vivienda_habitual` | ✅ es el eje AEAT real |
| `tipoArrendamiento 'no_vivienda'` (TAR2) | `irpfXmlParserService.ts:581` | capital_inmobiliario | `otros_arrendamientos` | ✅ como eje; ❌ el código le **inventa** un subtipo, distinto según la ruta (§3.2) |
| `usoTipo 'mixto'` | `types-inmuebles.ts:133` | — | — | ⚠️ no es categoría AEAT: es «este inmueble tuvo arrendamientos de los dos tipos» |
| `ModoDeclaracion 'V'` | `fiscalSummaryService.ts:574, 580` | capital_inmobiliario | `otros_arrendamientos` | ✅ el mapeo más limpio del repo |
| `ModoDeclaracion 'III'` | `fiscalSummaryService.ts:572‑573` | capital_inmobiliario | **mezcla los dos del eje 2 sin separarlos** | ❌ error fiscal (§3.4) |
| `tipoRenta 'actividad_economica'` | `declaracionCompleta.ts:48` | eje 1 | — | ⚠️ existe solo para entidades en atribución; inalcanzable desde un alquiler propio |
| `licencia_turistica` | `conceptosBase.ts:63‑69` | gasto → 0115 | — | ✅ como gasto; es la única huella de «turístico legal» y no clasifica nada |
| `tipoVivienda 'temporada-larga'` | `services/fiscal/tipos.ts:92, 139` | — | — | ⚠️ dialecto aparte, de deducciones autonómicas del **inquilino**; no conecta con ninguno de los otros ocho enums |

### 4.1 · Dónde el código funde `actividad_economica` con `otros_arrendamientos`

**En todas partes, por omisión.** No hay un punto concreto que haga la fusión mal: no hay ningún punto que
pueda hacerla bien. Un piso turístico con servicios de hospedaje entra por `modalidad = 'vacacional'`, sale por
`regimenDelContrato` como `'turistico'` (`irpfCalculationService.ts:376`), recibe `porcentaje: 0` de
`reduccionAlquiler.ts:110‑118` y aterriza en las casillas 0102–0154 de capital inmobiliario vía
`fiscalSummaryService.ts:753‑768`. **No existe salida** hacia el apartado de actividades económicas. El eje 1 de
la AEAT no está modelado para el alquiler propio.

### 4.2 · Dónde se trata «vacacional» ≠ «turístico» sin motivo

1. `src/services/contractService.ts:485‑491` — tope de 6 meses que se dispara con `vacacional` y no con
   `temporada`, escrito contra el literal.
2. `src/services/declaracionOnboardingService.ts:1008` vs `:1158` — mismo `TAR2`, dos nombres (§3.2).
3. Estructuralmente: `usoTipo` dice `turistico` y `modalidad` dice `vacacional` para la misma realidad, lo que
   obliga a mantener tres adaptadores vivos (`BloqueFiscalContrato.tsx:97‑101`,
   `irpfCalculationService.ts:376`, `sembrarOpexInmueble.ts:56‑58`).

---

## 5 · Respuesta directa

> **¿Un solo concepto con tres nombres, o dos conceptos (temporada ≠ turístico) mezclados?**

**Un solo concepto fiscal con tres nombres** — y falta un segundo concepto que sí es real y no está.

- `turístico` ≡ `vacacional`: mismo concepto, dos nombres, separados solo por vivir en entidades distintas
  (`Property.usoTipo` vs `Contract.modalidad`). Cero diferencia de comportamiento salvo el tope de 6 meses
  accidental de `contractService.ts:485`.
- `temporada` vs `turístico/vacacional`: **hoy también un solo concepto**. Ambos → `otros_arrendamientos`,
  0 % de reducción, modo V, mismas casillas, mismo catálogo de OPEX, mismo chip «corta». Lo único que cambia
  entre ellos son cadenas de texto. Son **conceptos distintos en Derecho** (temporada = LAU III, capital
  inmobiliario siempre; turístico = puede cruzar a actividad económica) pero el código no explota esa
  diferencia en ningún sitio porque no ha modelado el eje donde se nota.
- `corta estancia`: no es un concepto, es una **etiqueta de presentación** del par
  {temporada, vacacional} (`mapearTipoContrato.ts:10`, `historico/calculos.ts:247`,
  `inmuebleCasillasService.ts:401`). No existe como valor persistido en ningún enum.
- **El concepto que falta:** `actividad_economica`. Es el único eje que la AEAT trata de verdad distinto —otro
  apartado de la declaración— y no tiene campo, ni enum, ni rama, ni aviso. La palabra «turístico» está
  cargando con esa insinuación sin poder cumplirla.

**Qué se funde indebidamente:**

1. `fiscalSummaryService.ts:573 + 596 + 763‑764` — modo III aplica el 60 % al total, incluida la parte de
   temporada/vacacional, que debe reducir 0 %. **Error fiscal real y cuantificable**, y la pantalla afirma lo
   contrario (`inmuebleCasillasService.ts:211‑215`).
2. `fiscalSummaryService.ts:588, 593` — `reduccionLeyVivienda` es un campo inexistente; la reducción confirmada
   por el usuario en `Contract.reduccion` nunca se lee por esta vía y siempre gana el 60 % hardcodeado.
3. `explotacionAlquilerService.ts:72` — `usoTipo 'temporada'` → `modo 'completo'` borra la señal de corta
   estancia en la explotación y con ella el catálogo de gastos correcto.
4. `declaracionOnboardingService.ts:1008` vs `:1158` — un mismo `TAR2` produce `temporada` o `vacacional` según
   la ruta.
5. `contractDraftService.ts:34` — el importador de contratos solo conoce dos modalidades; `temporada` se pierde
   en la puerta.
6. `types-inmuebles.ts:226` — `ModoExplotacionAlquiler` mezcla dos ejes ortogonales (forma de la unidad y tipo
   de alquiler); un turístico por habitaciones es inexpresable.

**Mapa de qué nombre vive dónde:**

```
 CONTRATO ─── Contract.modalidad ········ habitual │ temporada │ vacacional
                    │                                    │          │
                    ├── plantilla doc ···· habitual │ temporada │ vacacional │ habitacion
                    ├── TipoContrato ····· larga    │  corta    │  corta          (UI)
                    ├── CatalogoKind ····· vivComp. │ turistico │ turistico       (OPEX)
                    └── RegimenAlquiler ·· habitual │ temporada │ turistico       (fiscal)
                                                    └────┬─────┘
                                                   ambos → 0 %

 INMUEBLE ─── Property.usoTipo ·········· larga_estancia │ temporada │ turistico │ mixto │ …
                    └── ModoExplotacion · completo       │ completo  │ turistico
                                                          (⚠ pérdida)

 IMPORT ───── XML AEAT TAR1/TAR2 ········ vivienda │ no_vivienda
                    ├── camino 1 (con NIF) ──────→ modalidad 'temporada'
                    └── camino 2 (sin NIF) ──────→ modalidad 'vacacional'   (⚠ incoherente)

 IMPORT ───── Rentila / plantilla ATLAS · modalidadAtlas: habitual │ vacacional   (⚠ 3→2)

 AEAT ─────── eje 1: capital_inmobiliario │ actividad_economica  ← NO MODELADO
              eje 2: vivienda_habitual    │ otros_arrendamientos ← los tres nombres caen aquí
```

Con esto se puede decidir el vocabulario canónico. No se propone aquí.
