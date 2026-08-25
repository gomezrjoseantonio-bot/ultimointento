# FASE 1 #0 · Diagnóstico de los tests rojos preexistentes

> Tarea: `TAREA CC · FASE 1 #0` · Base: `main` = `a8d5857` · **Solo lectura. Cero cambios de código.**
> Método: `react-scripts test --json` sobre la suite completa (546 suites) + arqueología con `git log`/pickaxe.

> **Nota de método:** el clon de la sesión venía *shallow* (54 commits), así que `git log` y `blame` no alcanzaban el origen de nada. Se hizo `git fetch --unshallow` (4.848 commits) antes de fechar un solo hallazgo. Sin eso, las fechas de este informe habrían sido inventadas.

---

## Conclusión primero

**`treasurySyncServiceRegressions` NO es un obstáculo para Fase 1. Es camino libre, y por una razón que conviene saber: no prueba comportamiento.** Lee el fichero fuente con `fs.readFileSync` y comprueba que contiene ciertas cadenas de texto. Nunca llama a `generateMonthlyForecasts` ni a nada de tesorería. No dice absolutamente nada sobre si la generación de previsiones funciona.

Lo que falla es una cadena que dejó de existir **el mismo día en que se escribió el test**, hace casi seis meses, porque el código mejoró justo donde el test decía vigilar.

---

## 1 · El recuento: son 43 SUITES, no 43 tests

`scripts/health.mjs:949` lo dice literalmente: *«INDICADOR 15 · tests_rojos — Suites de test en rojo (Test Suites failed)»*, y `:958-968` cuenta `Test Suites failed`.

| Métrica | Valor |
|---|---|
| Suites totales | 546 |
| **Suites en rojo** | **43** ← el `tests_rojos` de CI |
| Tests totales | 5.661 |
| Tests en rojo | **145** |
| Tests verdes | 5.515 (97,4 %) |

**No, no caen todas en las cuatro suites identificadas.** Esas cuatro son sólo las que aparecieron en el radio de los PR de Fase 0; suman 6 de los 145 tests rojos. Los 43 están repartidos por todo el repo.

### Inventario completo · suite → tests rojos

| Suite | Rojos | Causa (resumen) |
|---|---:|---|
| `functions/__tests__/ocr-fein.test.ts` | 12 | FEIN/OCR · forma de respuesta cambiada |
| `services/__tests__/dashboardServiceFinancialMetrics.test.ts` | 12 | fixture obsoleto + deriva numérica (ver §4) |
| `tests/Badge.test.tsx` | 9 | clases Tailwind pre-v5 (`bg-hz-success-light`) |
| `services/__tests__/feinOcrService.test.ts` | 8 | FEIN/OCR |
| `services/opexService.test.ts` | 8 | `bulkClearStores` no existe · store `opexRules` eliminado en V62 |
| `tests/enhancedFeinOcr.test.ts` | 7 | `service.extractBankEntity is not a function` |
| `tests/fixDocsIntegration.test.ts` | 7 | catálogo de conceptos renombrado |
| `__tests__/treasuryNoMockMovements.test.ts` | 5 | **ENOENT** · lee `UnifiedTreasury.tsx`, borrado en 2025-09 |
| `services/__tests__/db.migration.v59.test.ts` | 5 | `expect(db.version).toBe(65)` |
| `services/__tests__/dbV61Migration.test.ts` | 5 | ídem |
| `services/__tests__/dbV64Migration.test.ts` | 5 | ídem |
| `tests/KpiCard.test.tsx` | 5 | clases Tailwind pre-v5 |
| `functions/__tests__/ocr-fein-behavior.test.ts` | 4 | FEIN/OCR |
| `services/__tests__/dbV62Migration.test.ts` | 4 | `toBe(65)` |
| `services/__tests__/dbV63Migration.test.ts` | 4 | `toBe(65)` |
| `services/__tests__/dbV65Migration.test.ts` | 4 | `toBe(65)` |
| `services/__tests__/keyvalAudit.test.ts` | 4 | catálogo de claves sin actualizar (17 flags nuevas) |
| `__tests__/productionModeIntegration.test.ts` | 3 | `initDB` mockeado devuelve `undefined` |
| `__tests__/productionModeRequirements.test.ts` | 3 | ídem |
| `conciliacion/v2/.../AddMovementModal.test.tsx` | 3 | catálogo de conceptos ("Cuotas") |
| `ListadoGastos/.../RowForm.concepto.test.tsx` | 3 | "Suministros" → "Suministro" |
| `tests/diagnosticChecklist.test.ts` | 3 | checklist de diagnóstico desalineado |
| `onboarding/.../SugerenciasSection.test.tsx` | 2 | ruta esperada cambiada |
| `services/__tests__/dbV60Migration.test.ts` | 2 | `toBe(65)` |
| `services/fiscal/__tests__/deduccionesAutonomicasService.test.ts` | 2 | deducciones CCAA |
| `tests/PageHeader.test.tsx` | 2 | clase `horizon-primary` pre-v5 |
| `tests/enhancedBankIntegration.test.ts` | 2 | logo de banco → genérico |
| **`__tests__/treasurySyncServiceRegressions.test.ts`** | **1** | **grep de código fuente (§3)** |
| `components/common/SubTabs.test.tsx` | 1 | rol accesible no encontrado |
| `fiscal/v2/__tests__/FiscalInmueblePage.test.tsx` | 1 | texto "0132" no está |
| `fiscalidad/historico/ImportarDeclaracionWizard.test.tsx` | 1 | texto "PASO 1 — SUBIR PDF" no está |
| `tesoreria/v6/__tests__/FichaMovimiento.test.tsx` | 1 | catálogo de conceptos ("Cuotas") |
| `services/__tests__/completeDataCleanup.test.ts` | 1 | ya no lanza donde esperaba |
| `services/__tests__/db.structure.v79.test.ts` | 1 | **falta `explotacionAlquiler`** en la lista esperada (§4) |
| `services/__tests__/irpfCalculationService.capitalMobiliarioGeneral.test.ts` | 1 | heurística casillas 0046-0051 |
| `services/aeatAmortizationService.fallback.test.ts` | 1 | prorrateo de mejoras (§4) |
| `services/fiscal/__tests__/ccaaResto.test.ts` | 1 | `listarCcaaImplementadas is not a function` |
| `services/punteo/__tests__/punteoAdapter.test.ts` | 1 | "Limpieza" → "Integral" |
| `tests/DataTable.test.tsx` | 1 | rol `table` no accesible |
| `__tests__/contractsListaEnhanced.test.tsx` | **CRASH** | módulo `ContractsListaEnhanced` borrado el 2026-05-01 |
| `services/aeatAmortizationService.test.ts` | **CRASH** | *«must contain at least one test»* · fichero vaciado |
| `services/conceptos/__tests__/fixtures/baselineInmuebleLegacy.ts` | **CRASH** | es un **fixture**, no un test · `testMatch` lo captura |
| `tests/fixExtractosIntegration.test.ts` | **CRASH** | `Cannot redefine property: crypto` |

Suma: **145 tests** en **43 suites**. Cuadra con el JSON de Jest.

---

## 2 · Los rojos por familia (no son 43 problemas, son 8)

Agrupados por causa raíz, el panorama es mucho más manejable de lo que sugiere el número:

| # | Familia | Suites | Tests | Veredicto |
|---|---|---:|---:|---|
| A | **`expect(db.version).toBe(65)`** hardcodeado | 7 | 29 | Obsoleto |
| B | **FEIN / OCR** · API del servicio cambiada | 4 | 31 | Obsoleto |
| C | **Clases Tailwind pre-v5** (`text-hz-success`, `horizon-primary`) | 4 | 17 | Obsoleto |
| D | **Catálogo de conceptos** renombrado | 5 | 15 | Obsoleto |
| E | **Ficheros/módulos borrados** (grep de fuente, imports rotos) | 3 | 5 + 2 crashes | Obsoleto |
| F | **Arnés de test roto** (`initDB` mock, `crypto`, fixture como test) | 4 | 6 + 2 crashes | Deuda de arnés |
| G | **Catálogos de auditoría desactualizados** (`keyval`, estructura DB) | 2 | 5 | Obsoleto · mantenimiento |
| H | **Sueltos fiscales/numéricos** | 6 | ~18 | **Requieren mirada propia** |

### A · `toBe(65)` — 29 tests, obsoletos desde hace ~4 meses

`dbV60Migration.test.ts:106,292`, `dbV64Migration.test.ts:20,47,54,98,182,274`, y hermanos, afirman `expect(db.version).toBe(65)`. `DB_VERSION` pasó de 65 el **2026-05-02** (`c9fb11321`, V66) y hoy va por 90.

Ironía útil: `dbV60Migration.test.ts:103` lleva un comentario que dice *«No exportamos DB_VERSION directamente · validamos vía la firma»* — y justo debajo hardcodea el número. El patrón correcto ya existe en el repo: `db.structure.v79.test.ts:78` hace `expect(db.version).toBe(dbModule.DB_VERSION)`, que no envejece.

**Recomendación:** arreglo mecánico y de bajo riesgo (sustituir el literal por `DB_VERSION`). Recupera 29 tests y 7 suites de golpe. **No bloquea Fase 1.**

### B · FEIN / OCR — 31 tests

`enhancedFeinOcr.test.ts:21` falla con `service.extractBankEntity is not a function`: el servicio ya no expone ese método. Los otros tres comparan formas de respuesta del OCR que cambiaron.

**Recomendación:** territorio ajeno a contratos. Dejar, etiquetado. **No bloquea Fase 1.**

### C · Clases Tailwind pre-v5 — 17 tests

`Badge`, `KpiCard`, `PageHeader`, `DataTable` esperan `bg-hz-success-light`, `text-hz-success`, `horizon-primary`. El design system v5 usa tokens CSS. El marcador de salud ya cuenta 109 `ficheros_no_v5`: es la misma deuda, vista desde los tests.

**Recomendación:** entra sola cuando se migren esos componentes a v5. **No bloquea Fase 1.**

### D · Catálogo de conceptos — 15 tests

Renombrados: `"Suministros"` → `"Suministro"`, `"Gastos"` → `"Reparación y Conservación"`, `"Limpieza"` → `"Integral"`, `"Cuotas"` desaparecido de las familias personales. Los tests afirman las etiquetas viejas.

**Ojo:** `punteoAdapter` y `FichaMovimiento` — dos de las cuatro suites "conocidas" — son exactamente esto. Nada que ver con tesorería ni con contratos: son etiquetas.

**Recomendación:** dejar; se arreglan al tocar el catálogo. **No bloquea Fase 1.**

### E · Ficheros borrados — el rojo más antiguo del repo

- `treasuryNoMockMovements.test.ts:15` hace `readFileSync` de `src/modules/horizon/tesoreria/UnifiedTreasury.tsx`. Ese fichero se borró en **`c7a866878`, 2025-09-12**. La suite lleva **casi un año** en rojo con un `ENOENT`.
- `contractsListaEnhanced.test.tsx` importa `ContractsListaEnhanced`, borrado en **`60c5681d9`, 2026-05-01**.
- `aeatAmortizationService.test.ts` se quedó sin tests dentro.

**Recomendación:** borrar los tres. Prueban ficheros que no existen. **No bloquea Fase 1.**

### F · Arnés de test roto — no es el producto, es el andamio

- `productionModeIntegration` / `productionModeRequirements`: `TypeError: Cannot read properties of undefined (reading 'add')` en `treasuryApiService.ts:129` — el mock de `initDB` no devuelve un objeto con `add`. El test no llega a probar nada.
- `opexService.test.ts:67`: `bulkClearStores` es `undefined` — el store `opexRules` se eliminó en V62.
- `fixExtractosIntegration`: `Cannot redefine property: crypto` — colisión de jsdom, muere antes de arrancar.
- `conceptos/__tests__/fixtures/baselineInmuebleLegacy.ts`: **es un fixture**, no un test, y el `testMatch` lo recoge por vivir bajo `__tests__/`. Se arregla moviéndolo o renombrándolo.

**Recomendación:** el fixture y el `crypto` son arreglos de minutos. **No bloquean Fase 1.**

### G · Catálogos de auditoría — se rompen por diseño

- `keyvalAudit.test.ts` afirma que no hay claves fuera de catálogo, y encuentra **17**, todas flags de migración legítimas (`migration_v78_*`, `migration_v82_*`, `migration_v87_tarjetas_v1`, `migration_v90_explotacion_alquiler_v1`…). Cada migración nueva rompe este test salvo que se actualice el catálogo a la vez.
- `db.structure.v79.test.ts` espera la lista de stores **sin `explotacionAlquiler`**, el store que añadió V90 (`6ee346064`, 2026-08-20). El test se actualizó por última vez el 2026-08-08 (`c90824af4`), doce días antes.

Estos dos son *test de inventario*: su rojo significa «alguien añadió algo y no actualizó la lista», no «el producto está roto». En ambos casos **lo que hay en el código es lo correcto**.

**Recomendación:** actualizar los dos catálogos. Barato y devuelve señal útil. **No bloquea Fase 1.**

---

## 3 · Foco · `treasurySyncServiceRegressions`

### Qué cubre en realidad

**Nada de comportamiento.** La suite entera son 39 líneas (`src/__tests__/treasurySyncServiceRegressions.test.ts:1-39`) y su mecanismo es:

```ts
const serviceSource = fs.readFileSync(SERVICE_PATH, 'utf8');   // :12
…
expect(serviceSource).toContain("const day = autonomoActivo.reglaPagoDia?.dia ?? 1;");  // :33
```

Es un **grep sobre el texto del fichero**. No importa `treasurySyncService`, no llama a `generateMonthlyForecasts`, no abre una base, no comprueba ni un evento.

### ¿Prueba la generación de previsiones desde contratos?

**No. Ni de lejos.** Sus tres bloques miran: dos `sourceType` de **autónomos** (`:17-19`), y la lógica de **día hábil de la cuota de autónomos** (`:32-38`). La palabra «contrato» no aparece en el fichero. La generación de rentas desde contratos —el bloque `:297-406` de `treasurySyncService`— no está cubierta aquí en absoluto.

### Qué falla exactamente y desde cuándo

Falla una sola aserción, `:33`: la cadena `"const day = autonomoActivo.reglaPagoDia?.dia ?? 1;"` ya no está en el fichero.

La arqueología es concluyente y tiene su gracia:

| Commit | Fecha y hora | Qué hizo |
|---|---|---|
| `d34c1af23` | **2026-03-05 12:12** | Añade este test *(«Reduce merge conflicts by isolating treasury regression tests»)* |
| `9f3355a24` | **2026-03-05 17:34** | Borra la línea que el test acababa de fijar |

**Cinco horas de vida.** El test nació a mediodía y a media tarde ya estaba roto. `9f3355a24` («Ajusta configuración de autónomo y fechas de tesorería») cambió:

```diff
-      const day = autonomoActivo.reglaPagoDia?.dia ?? 1;
+      const cuotaPredictedDate = getBusinessDayForRule(year, month, autonomoActivo.reglaPagoDia, 5);
```

### Veredicto: test obsoleto. El comportamiento que dice proteger está vivo y es MEJOR

El test se titula *«applies reglaPagoDia business-day logic for cuota de autónomos dates»*. Esa lógica **sigue ahí**: `treasurySyncService.ts:650` llama a `getBusinessDayForRule(year, month, autonomoActivo.reglaPagoDia, 5)`, y `treasurySyncHelpers.ts:19` define la función. Lo único que cambió es que el cálculo pasó de hacerse a mano a delegarse en el helper, y el día por defecto pasó de 1 a 5.

Es decir: el refactor **reforzó** justo lo que el test vigilaba, y el test lo marcó como regresión porque miraba la letra en vez del efecto. Las otras dos aserciones del mismo fichero siguen pasando — por casualidad, porque esas cadenas no se han tocado.

### La pregunta que decide Fase 1

> ¿Bloquea construir el alta-que-dispara encima, o es ruido aparcable?

**Es ruido. Camino libre.** Tres razones, en orden de peso:

1. **No toca el código de contratos.** Sus aserciones son de autónomos. El alta-que-dispara vivirá en el bloque de contratos (`:297-406`) y en `regenerateForecastsForward`, territorio que este test no mira.
2. **No prueba comportamiento, así que no puede estar tapando un bug.** Un test que sólo comprueba que cierto texto aparece en un fichero no puede ocultar una regresión funcional: no ejecuta nada. La pregunta *«¿indica que la generación ya está rota hoy?»* no tiene forma de contestarse desde aquí — y eso mismo es la respuesta.
3. **Lo que sí ejercita esa generación está en verde.** `rentaDuplicada.test.ts` y `asignarCobroAContrato.test.ts` (los de #1797) llaman de verdad a `generateMonthlyForecasts` contra una base real, y pasan. Ahí es donde hay red.

**Una advertencia, no obstante:** el hueco real no es este test rojo, sino que **la generación de rentas desde contratos tiene poquísima cobertura de comportamiento** — la que hay la pusimos nosotros en Fase 0. Fase 1 debería añadir la suya, y no dar por cubierto nada por el hecho de que exista un fichero llamado «regressions».

---

## 4 · Los que sí merecen mirada propia (familia H)

Ninguno bloquea Fase 1 —ninguno toca la generación de previsiones desde contratos— pero tres huelen a algo más que a test viejo.

### `aeatAmortizationService.fallback` · el test está anticuado, el código es más correcto

Espera `improvementsAmortization` ≈ **106,36 €** y obtiene **0,2906 €**. El número no es aleatorio:

```
3545,30 € × 3 % = 106,359 €     ← lo que espera el test (año completo)
106,359 / 366   = 0,2906 €      ← lo que da el código (UN día)
```

La mejora del fixture lleva `fecha: '2024-12-31'` (`aeatAmortizationService.fallback.test.ts:77`). El código (`aeatAmortizationService.ts:245-249`) prorratea por los días que la mejora estuvo en servicio, y una reforma terminada el 31 de diciembre son **un día**. El test espera el año entero.

**Veredicto: test obsoleto; el código prorratea, que es lo fiscalmente correcto.** El prorrateo entró en `574e66fd5` (2025-09-03) y el test se actualizó por última vez en 2026-04-03.

**Pero conviene una segunda lectura antes de tocarlo**, porque hay una asimetría en ese mismo bloque: el inmueble prorratea por `daysRented` y la mejora por `improvementDays`, sin tope. No he verificado si eso es intencionado. Tarea propia, con los XML reales delante.

### `dashboardServiceFinancialMetrics` · fixture muerto + 100 € de deriva

12 tests. Espera `comprometido30d` = 615 y obtiene 515: **exactamente los 100 €** del gasto pendiente del fixture (`:43`).

Lo llamativo: el fixture alimenta un store **`rentaMensual`** (`:48-50`), eliminado en **V62**. Es decir, el test se escribió contra un modelo de datos que ya no existe. Último toque: `63ac7ee6d` (2026-08-05, «Las cuentas que eran tarjeta se van»), que borró cuentas y sus movimientos — candidato natural a la deriva de 100 €.

**Veredicto: fixture obsoleto con deriva numérica sin explicar.** No lo cierro: son las cifras de liquidez del panel y merecen que alguien confirme si el 515 es correcto o si se perdió un compromiso por el camino. **Tarea propia.**

### `irpfCalculationService.capitalMobiliarioGeneral` · sin veredicto

Espera 0 y obtiene 464,65 en *«detecta también por heurística casillas 0046-0051 aunque no exista flag explícito»* (`:154`). Es fiscal y es una heurística; decidir si el 464,65 sobra o si el test es el que está mal exige contrastar contra una declaración real. **No lo dictamino desde aquí.** Misma categoría que la guarda de `irpfCalculationService.ts:332` que quedó pendiente en Fase 0: **validar contra los XML de Jose, no contra fixtures.**

### Los tres menores

- `ccaaResto.test.ts:299` · `listarCcaaImplementadas is not a function` — la función se renombró o se retiró. Obsoleto.
- `deduccionesAutonomicasService` · 2 tests de deducciones CCAA. El marcador ya lleva `ccaa_no_verificadas: 18`; es la misma deuda.
- `completeDataCleanup` · esperaba que algo lanzara y ya no lanza.

---

## 5 · Recomendación

**Para Fase 1: adelante, sin tocar nada de esto.** Ninguna de las 43 suites cubre la generación de previsiones desde contratos. La única que suena a que sí —`treasurySyncServiceRegressions`— resulta ser un grep de texto sobre código de autónomos.

**Si en algún momento quieres recuperar el semáforo** (hoy el trinquete sólo detecta que no empeora, no que esté bien), el orden por rentabilidad es:

| Orden | Acción | Devuelve | Riesgo |
|---|---|---:|---|
| 1 | `toBe(65)` → `toBe(DB_VERSION)` | 7 suites · 29 tests | Nulo · patrón ya existe en el repo |
| 2 | Borrar los 3 tests de ficheros inexistentes | 3 suites | Nulo |
| 3 | Sacar el fixture `baselineInmuebleLegacy.ts` de `__tests__/` | 1 suite | Nulo |
| 4 | Actualizar los 2 catálogos de auditoría (`keyval`, estructura DB) | 2 suites · 5 tests | Bajo |
| 5 | Arreglar el mock de `initDB` en los `productionMode*` | 2 suites · 6 tests | Bajo |

Eso son **15 de las 43 suites** con cambios mecánicos y sin tocar producto. Las otras 28 son deuda de dominio (FEIN, v5, catálogo de conceptos) o requieren criterio fiscal, y cada una merece su tarea.

**Lo que NO recomiendo:** arreglarlas antes de Fase 1. Ninguna bloquea, y meter 43 suites en el camino crítico del alta-que-dispara es cambiar un problema conocido y acotado por un frente abierto.

---

## Anexo · lo que este informe no puede afirmar

- **`dashboardServiceFinancialMetrics`**: no he determinado si el 515 es correcto. Digo dónde está la deriva y por qué sospecho del commit de tarjetas; no la cierro.
- **`irpfCalculationService.capitalMobiliarioGeneral`**: sin veredicto a propósito. Necesita datos reales.
- **Fechas de rotura exactas**: doy el commit que cambió el comportamiento, que es lo verificable. Determinar el día exacto en que cada suite se puso roja exigiría un bisect por suite, que no está pedido y costaría más de lo que aporta.
- **`aeatAmortizationService.fallback`**: el veredicto («código correcto, test viejo») se apoya en que la aritmética cuadra al céntimo con el prorrateo de un día. La asimetría `daysRented` vs `improvementDays` queda señalada, no resuelta.
