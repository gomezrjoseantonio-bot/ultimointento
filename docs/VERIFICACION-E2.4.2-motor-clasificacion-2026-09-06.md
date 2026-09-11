# VERIFICACIÓN · E2.4.2 · MOTOR DE CLASIFICACIÓN · lo hecho, sobre el preflight

**Fecha:** 2026-09-06 · **Base:** `main` @ `4550e56` (tras #1863) · **Rama:** `claude/audit-categories-types-scopes-p5966s` ·
**Preflight:** `docs/VERIFICACION-E2.4.2-preflight-motor-clasificacion-2026-09-06.md` · **Decisiones de Jose (6 sep 2026):** OK a las seis.
**Estado:** PR en borrador · stop-and-wait · sin mergear.

**Cómo leer las marcas:** VERIFICADO = leído/ejecutado · DEDUCIDO = inferido por grep.

---

## 0 · Lo esencial en diez líneas

1. **Paso 0 · la cuenta se detecta también en Excel.** `detectarCuenta` (`src/modules/tesoreria/v6/detectarCuenta.ts`) deja de leer 64 KB como texto y usa el lector de cabecera P12 (`extractoHeaderService.readGrid` + `parseHeaderGrid`, ahora exportados). Los cinco fixtures identifican su cuenta en CSV y en XLSX (test); Revolut, sin IBAN, pide elegir (la cuenta es la tarjeta). `iban-desconocido` viaja con `cabecera` (banco, titular, saldo, fecha) para que la UI, cuando quiera, ofrezca crear la cuenta. **Regla B:** código que existía y servía, enganchado, no reescrito.
2. **Importador · cuatro arreglos aditivos.** (a) Fechas en **serie Excel** (`46265`) · Unicaja pasaba de 0 filas a las 8. (b) **Fecha-hora** (`2026-08-28 10:15:00`) · Revolut pasaba de 0 a 5. (c) El CSV se lee con `raw: true`: la librería `xlsx` interpretaba «01/09/2026» como 9 de enero y lo reescribía «1/9/26», que salía bien solo por simetría; y convertía la fecha-hora de Revolut en «8/28/26», que el lector rechazaba. (d) **Todas las columnas de referencia** (`columnasDeReferencia` · Sabadell «Referencia 1» + «Referencia 2», ING «Comentario», Revolut «Type») se juntan en `reference` con ` · `, y el extractor E2.1 las ve.
3. **El motor existe:** `src/services/clasificacion/clasificarLinea.ts` (puro). Por línea y en este orden exacto: **aprendida → identificador → concepto → recurrencia → defecto**. Devuelve los 4 ejes (`naturaleza`, `familia?/subtipo?`, `metodo?`, `ambito` + `inmuebleId?`) y **el origen de cada eje** (`OrigenPorEje`) más los motivos. Un eje fijado por una fuente fuerte no lo pisa una débil; lo que ninguna sabe se queda en blanco (clasificación PARCIAL válida). Consume las sugerencias (vías A/B/C) y lo reconocido (deterministas); no los sustituye. El emparejador y el marcador no se tocan.
4. **El signo manda** (`compatibleConSigno`): una fuente que proponga ingreso sobre un cargo, o gasto sobre un abono, no se aplica; una familia cuya naturaleza contradiga el signo tampoco.
5. **Método nunca «otro» con señal** (`metodoDelConcepto`): recibo/adeudo/cuota → domiciliación; cuota de préstamo y liquidación de tarjeta → domiciliación (regla 4); disposición → transferencia; compra/pago móvil/tarj → tarjeta; bizum; cheque; cajero/reintegro → efectivo; comisión/remuneración/intereses → cargo/abono del banco. Revolut lo dice en «Type» (referencia). Sin señal → `undefined`, no se inventa.
6. **Las diez reglas duras** viven en `reglasDuras.ts` con un test cada una (`reglasDuras.test.ts` · 37 casos): `\b` por palabra entera (`palabras.ts` · «once» ya no está en «concepto»), signo > palabra, nómina yo→yo = traspaso, préstamo = 3 cosas, Revolut/agregador opaco (tarjeta propia por `ultimosCuatro`), «Compra Bizum [comercio]» ≠ «Bizum a [persona]», no inventar, fiscalidad fuera. `deterministas/texto.ts` `contieneConcepto` pasa a palabra entera (con tolerancia al recorte del banco a partir de 5 letras) y las heurísticas de `movementSuggestionService` llevan `\b`.
7. **Lo que el motor sabe se guarda:** `lineasExtracto.clasificacion` (al analizar el lote · importar y retomar) y el movimiento **nace con ello** (`movementNuevoDesdeLinea` · `naturaleza`, `familia/subtipo`, `paymentMethod`, `ambito/inmuebleId` + `Movement.clasificacionOrigen`). Un cuadre, un reconocimiento o la ficha pisan después lo que sepan mejor. Opcional, sin índice, **sin bump de DB**.
8. **Paso 2 · aprendizaje intra-lote:** al clasificar una línea con la ficha, las **hermanas** del mismo lote (misma clave `buildLearnKey` v2/v1, mismo signo, aún en «te necesitan» · `aprendizajeEnLote.hermanasDeAprendizaje`) se resuelven AHORA con los mismos valores y su propio importe y fecha (`aprendizajeEnSesion.aplicarAprendizajeALasHermanas` → `gastoDesdeMovimiento`), marcadas `comoSeResolvio: 'motor'` + `match_automatico` (reversibles desde Tesorería). Decisión de Jose: automática, visible, reversible. La cola (otros lotes a medias) se resuelve sola: `reabrirLote` re-analiza y la regla ya está en `movementLearningRules`.
9. **`Tarjeta.ultimosCuatro?`** (opcional · sin índice) para la regla 6: «Compra Revolut**0940*» con una tarjeta propia que acaba en 0940 = traspaso a tarjeta; «Recarga de *4437» (Revolut) con un IBAN propio que acaba en 4437 = traspaso que entra.
10. `tsc` limpio · trinquete `todos_totales` 230 = `main`, `archivos_800` 37 = `main` (el drawer se quedó en 797: lo intra-lote vive en `aprendizajeEnSesion.ts`) · `test:deadcode` OK · suite completa **24 suites / 100 tests en rojo, exactamente los del baseline** · +59 tests nuevos verdes (motor 50, cuenta 8, fixtures 5, parser).

---

## 1 · Paso 0 · detección de cuenta (VERIFICADO)

| Fixture | Formato | Antes | Ahora |
|---|---|---|---|
| Santander | CSV | detectada | detectada |
| Sabadell | XLSX (y CSV) | `sin-iban` → selector | **detectada** |
| Unicaja | XLSX (y CSV) | `sin-iban` → selector | **detectada** |
| ING | XLSX (y CSV) | `sin-iban` → selector | **detectada** |
| Revolut | CSV sin IBAN | `sin-iban` | `sin-iban` → elegir (la cuenta es la tarjeta) · a propósito |
| IBAN que no es de ninguna cuenta | — | «elige» | `iban-desconocido` + `cabecera{banco, titular, saldo, fecha}` |

Test: `src/modules/tesoreria/v6/__tests__/detectarCuenta.test.ts` (el XLSX se genera en el test desde el CSV con `xlsx`). El gancho de UI («crear la cuenta con esto») queda fuera (decisión 6).

## 2 · Importador (VERIFICADO con los fixtures)

| Fixture | Filas antes | Filas ahora | Qué faltaba |
|---|---|---|---|
| Santander | 10 | 10 | — |
| Sabadell | 8 (sin referencias) | 8 · `reference` = `A95554630001 · 246136614000` | Ref 1 + Ref 2 se perdían las dos |
| Unicaja | **0** | 8 | serie Excel (`46265` → 2026-08-31) |
| ING | 5 (sin comentario) | 5 · `reference` = `panelista` | «Comentario» se perdía |
| Revolut | **0** | 5 · `reference` = `TOPUP` / `CARD_PAYMENT` / `TRANSFER` | fecha-hora rechazada; «Type» se perdía |

Ficheros: `src/features/inbox/importers/bankParser.ts` (`parseSpanishDate` serie + fecha-hora · `reference2/3` · `parseCSVEnhanced raw:true`), `src/services/importador/columnaDeReferencia.ts` (`columnasDeReferencia` · alias «referencia 1/2», «comentario», «type/tipo»). `bank-profiles.json` gana pistas por banco (`ibanHeader`, `dateHints: excel-serial`, `ignoreColumns`, `extraReference`); son documentación: el lector y el parser son genéricos.

Los 78 tests del importador siguen verdes (incluido el fichero real de Sabadell del repo).

## 3 · El motor · qué sale de cada fixture (VERIFICADO · `fixturesBancos.e242.test.ts`)

| Fixture | Líneas | Con familia | Interno | Con método | Sin familia (honesto) |
|---|---|---|---|---|---|
| Santander | 10 | 8 | 2 | 10 | 2 (Bizum a persona · cheque) |
| Sabadell | 8 | 6 | 1 | 6 | 2 (transferencia a empresa · abono de persona) |
| Unicaja | 8 | 7 | 1 | 2 | 1 («Ahorros Septiembre» · no se adivina) |
| ING | 5 | 2 | 1 | 5 | 3 (recibo sin decir de qué · dos transferencias) |
| Revolut | 5 | 4 | 2 | 5 | 1 («Apple» · no se inventa la suscripción) |

Casos que fijan los tests: cuota (`prestamo_hipoteca` · domiciliación) · disposición (`movimiento_interno · disposicion_prestamo` · entra) · liquidación de tarjeta ≠ préstamo · «ABONO POR DOMICILIACIÓN» positivo → `otros_ingresos` · nómina yo→yo → `traspaso` · nómina de la empresa → `nomina` · Revolut con tarjeta 0940 → `traspaso · a_tarjeta` · «Recarga de *4437» → `traspaso · entra` · «Compra Bizum Renfe» → `transporte` + bizum · «Bizum a favor de persona» → personal sin familia · fianza → `fianza · devuelve` · honorarios de venta → `gestion` · remuneración → `rendimiento · interes` · «To Binance» → `aportacion · inversion` · cheque → método cheque.

**Lo que NO se hace, a propósito (regla 8):** «Ahorros Septiembre», «Apple», «Transferencia a Smartflip», «Recibo Dirección Ejemplo 15-17» se quedan sin familia. Mejor «personal / sin familia» que un «mueble» inventado.

> **CORREGIDO por E2.4.2-fix** (ver `VERIFICACION-E2.4.2-fix-devoluciones-2026-09-08.md`). Aquí se decía que «TRANSFERENCIA CURENERGÍA positivo» se quedaba en `ingreso · otros_ingresos` porque el catálogo no admitía `familia: suministro` con naturaleza ingreso. **Era una lectura equivocada del catálogo**: `motivosInvalidos` exige que la familia sea de la naturaleza dicha, pero no mira el signo del importe, así que `gasto · suministro · luz` con importe positivo siempre fue una clasificación válida. Lo que lo impedía eran tres filtros de signo del motor, no el catálogo. Hoy Curenergía en positivo sale **`gasto · suministro · luz`**, marcada como devolución por su propio signo, y RESTA de la luz de ese piso. Los dos tests de esta regla se reescribieron con esa verdad.

Con el matiz corregido, la línea de la tabla del Sabadell también cambia: nueve líneas (se añadió la regularización de Curenergía al fixture), seis con familia, tres sin ella — porque «ABONO POR DOMICILIACIÓN» ya no recibe la familia inventada `otros_ingresos`, sino que se queda como devolución sin decir de qué gasto.

## 4 · Orden y origen (VERIFICADO · `clasificarLinea.test.ts`)

- Regla aprendida (vía B) → familia/subtipo/ámbito/piso `aprendida`; el método sigue saliendo del texto (`concepto`).
- Identificador → cuadro del préstamo (familia + piso), recurrente por CUPS/nº contrato/NIF (vía A con `porIdentidad`), traspaso propio con su sentido, tarjeta/cuenta propia por cuatro últimos.
- Concepto → reglas duras; no pisa lo anterior.
- Recurrencia → vía A por texto y la atribución del año pasado **solo rellenan huecos** (el piso, por ejemplo).
- Defecto → naturaleza por signo, `personal`, sin familia; `ambito: inmueble` **nunca sin piso**.

## 5 · Lo que toca y lo que no

**Añadido:** `services/clasificacion/{tipos, palabras, metodoDelConcepto, reglasDuras, clasificarLinea, clasificarLote, aprendizajeEnLote, resueltaPorMotor}.ts` + tests · `modules/tesoreria/v6/aprendizajeEnSesion.ts` · `__fixtures__/*-fixture.csv` (5) · `fixturesBancos.e242.test.ts`.
**Tocado (aditivo):** `detectarCuenta.ts` · `extractoHeaderService.ts` (exporta `readGrid` · `FileReader` de respaldo) · `bankParser.ts` · `columnaDeReferencia.ts` · `bankStatementOrchestrator.analizarLineas` (4º resultado `clasificacion` + escritura en la línea) · `lineaComoMovimiento.movementNuevoDesdeLinea` · `deterministas/texto.ts` · `movementSuggestionService.ts` (`\b`) · `DrawerExtracto.tsx` (12 líneas: el gancho intra-lote) · tipos `LineaExtractoPersistida.clasificacion?`, `Movement.clasificacionOrigen?`, `Tarjeta.ultimosCuatro?`, `BankProfile` pistas · `bank-profiles.json`.
**No tocado:** `matchLineas`, el marcador y sus pesos (aviso 29/8), `confirmDecisions`, las reglas con confianza (E2.2), la UI de la etiqueta (DT6/DT7).

## 6 · Verificación

- `tsc --noEmit`: limpio.
- Trinquete local: `todos_totales` 230 = `main` · `archivos_800` 37 = `main` · `servicios_muertos` 0 · `test:deadcode` OK.
- Suite completa vs baseline de `main` tras #1863 (24 suites / 100 tests en rojo): **24 / 100 · la misma lista exacta**. 6.417 verdes (+59 nuevos).
- Tests nuevos: `clasificacion/__tests__/reglasDuras.test.ts` (37) · `clasificarLinea.test.ts` (10) · `aprendizajeEnLote.test.ts` (3) · `detectarCuenta.test.ts` (+8) · `fixturesBancos.e242.test.ts` (5).

## 7 · Fuera de E2.4.2 · para que nadie lo busque aquí

- Proponer crear recurrentes (E2.5) · catálogo nacional de proveedores (E2.6) · capa fiscal · UI de la etiqueta y del «crear cuenta» (DT6/DT7).
- Los porcentajes del encargo (68 / 31 / 1 / 33 %) son de las 4.000 líneas reales; aquí se miden sobre los fixtures (§3) y los tests fijan que no bajen.
- Un CSV con miles en formato español dentro de un campo («1.500,00») lo sigue leyendo el parser por texto (`parseEsNumber`); la librería `xlsx` con inferencia lo convertía en 1,5 — otro motivo para `raw: true`.
