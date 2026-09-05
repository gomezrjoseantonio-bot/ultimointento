# VERIFICACIÓN · E2.4.1-preflight · CATÁLOGO ÚNICO DE CLASIFICACIÓN

**Fecha:** 2026-09-05 · **Base:** `main` @ `77c340f` (tras #1860) · **DB_VERSION:** 92 (sin bump en esta tarea) ·
**Rama:** `claude/audit-categories-types-scopes-p5966s` · **Stop-and-wait: PR sin mergear.**

Objetivo del encargo: reemplazar los 5 árboles de categoría, los 2 vocabularios de método, los 2 `MovementType`,
el casing del ámbito y los 3 mecanismos de neutralidad por UN catálogo de 4 ejes, y eliminar los antiguos.
Este documento es el preflight (Regla B: grep antes de borrar) y el parte de lo hecho / lo parado.

**Cómo leer las marcas:** VERIFICADO = leído en las líneas citadas · DEDUCIDO = inferido de greps o comentarios.

---

## 0 · Lo esencial en diez líneas

1. **Hecho y verde (3 commits):** el catálogo único (4 ejes · 32 familias · sin casilla AEAT · 11 tests), UN método
   de pago (`MetodoDePago` y `MetodoPagoCompromiso` eliminados con su traductor `metodoDePago.ts`), y ámbito en
   minúsculas en `Movement`/`TreasuryEvent`/`MovementLearningRule` (≈35 ficheros prod · ≈45 tests). `tsc` limpio;
   suite sin rojas nuevas respecto a `main`.
2. **Hallazgo inesperado #1:** `ATLAS-CATALOGO-clasificacion-DEFINITIVO.md` y el MODELO §32.29-32.40 **no están en
   el repo** (grep a cero en `docs/`, `design-bible/`, raíz). El árbol se ha construido del enunciado, que lo trae
   entero. Si el DEFINITIVO difiere en algo, manda el DEFINITIVO.
3. **Hallazgo inesperado #2:** hay un **tercer** vocabulario de naturaleza que la auditoría no listó:
   `TreasuryEvent.type: 'income' | 'expense' | 'financing'` (`types-movimientos.ts:249`) · **45 ficheros prod · 75
   tests**. Es la clave del nudo de naturaleza/neutralidad (§3.1).
4. **Nudo B · presupuesto 50/30/20:** `BolsaPresupuesto` (necesidades/deseos/ahorro/obligaciones) se DERIVA de
   `CategoriaGastoCompromiso` y alimenta `presupuestoAnualService` (901 líneas) y `PresupuestoPage`. **El catálogo
   de 4 ejes no tiene bolsa.** Eliminar el árbol B deja al presupuesto sin entrada. Decisión de producto pendiente (§3.2).
5. **Nudo fiscal:** `GastoInmueble.casillaAEAT` es campo **obligatorio e indexado** (`db.ts:355`) y lo escriben
   `categoryCatalog.casillaAEAT` + `CATEGORIA_A_CASILLA` al confirmar. Quitar el enganche sin la lente fiscal deja cada
   gasto de inmueble nuevo **sin casilla** → la declaración lo ignora en silencio (§3.3).
6. **No exige bump de DB_VERSION** cambiar el valor de `gastosInmueble.categoria`: no tiene índice (§4).
7. El resto de árboles (A · C · D · E) y sus traductores están grepeados uno a uno con sus lectores (§2). Ninguno se
   ha borrado todavía: todos cuelgan de uno de los tres nudos.
8. `Prestamo.ambito` / FEIN siguen en mayúsculas (fuera de alcance); la única traducción hacia lo que un préstamo
   engendra es `prestamos/ambitoDelPrestamo.ts`, con TODO.
9. `Movement` lleva HOY **seis** campos de clasificación (`category{tipo,subtipo}` obligatorio · `categoria` ·
   `categoryKey` · `subtypeKey` · `conceptoId` · `categoryLabel` en el evento) más `type` y `is_transfer`/
   `transfer_group_id`. El «de golpe» real son ~120 ficheros prod y ~130 tests (§5).
10. **Propuesta de corte:** E2.4.1 = cimiento (este PR) · E2.4.1b = naturaleza+neutralidad · E2.4.1c = árboles A/C/D/E
    con la decisión de bolsa y de casilla tomadas. Ver §6.

---

## 1 · Lo hecho en este PR (VERIFICADO · commit + uso + test)

| Commit | Qué | Prueba |
|---|---|---|
| `58ce956` | `src/services/catalogo/catalogoUnico.ts` · Naturaleza, MetodoPago, Ambito, FamiliaId, `FAMILIAS` (7+21+4), `Clasificacion`, `motivosInvalidos`, `reclasificar`, `esMovimientoInterno`, `familiasSugeridas` | `catalogo/__tests__/catalogoUnico.test.ts` · 11 verdes: árbol exacto, ids únicos, subtipo opcional, **sin casilla**, etiquetar/re-etiquetar, ámbito no valida familia |
| `c632f90` | Un solo método: `Movement.paymentMethod` · `TreasuryEvent.paymentMethod` · `CompromisoRecurrente.metodoPago` · `Document.financialData.paymentMethod` → `MetodoPago`. Borrados `metodoDePago.ts` + test. Repuntados 9 prod (`lineaComoMovimiento`, `treasuryForecastService`, `recibosDeTarjetaPrevistos`, `compromisosRecurrentesService`, `recibosDomiciliados`, `cuentasPorMetodoPago`, `RowForm`, `ExpenseRow`, `FichaMovimiento`) | grep `MetodoPagoCompromiso\|MetodoDePago` en `src/` = 0 (queda el changelog histórico de `db.ts:58`) · 49 suites afectadas verdes |
| `27e0ba6` | Ámbito minúsculas: `types-movimientos.ts:134,331,408` → `Ambito` del catálogo · 33 prod · 45 tests · `prestamos/ambitoDelPrestamo.ts` como única traducción desde `Prestamo.ambito` | `tsc` limpio · suite completa vs baseline (§7) |

`docs/VOCABULARIO-dinero.md §2` actualizado: «dos vocabularios» → uno (el doc manda sobre el código; se corrige primero).

---

## 2 · Preflight · lectores de cada cosa a ELIMINAR (grep real · prod / test · ficheros)

### 2.1 · Árboles de categoría

| Árbol | Símbolo | Prod | Test | Dónde viven los lectores prod | ¿Reconectable en esta tarea? |
|---|---|---|---|---|---|
| **A** `categoryCatalog.ts` | módulo | 19 | 3 | tesorería v6 (`FichaMovimiento`, `punteoAdapter`, `tesoreriaV6Metrics`), conciliación (`AddMovementModal`, `conciliacionConfirmados`), traspasos (`traspasoInterno`, `traspasoDesdeMovimiento`, `treasuryTransferService`, `deterministas/traspasosPropios`), confirmación (`treasuryConfirmationService` · **casilla + store destino**), `documentRequirementsService`, `OpexRuleForm`, `ConceptosPage`, `types-fiscal`, `types-movimientos` | **NO sin la lente fiscal** (casilla + `storeName` deciden a qué store va la línea) |
| A | `categoryKey` (campo persistido) | **47** | 30 | toda tesorería/conciliación/punteo/fiscal | idem |
| A | `subtypeKey` | 22 | 10 | idem | idem |
| A | `TRANSFER_KEYS` / `isTransferKey` | 6 / 9 | 1 | traspasos · métricas · punteo · confirmación | Sólo con naturaleza en **TreasuryEvent** (§3.1) |
| **B** `compromisosRecurrentes.ts:84-163` | `TipoCompromiso` | 11 | 0 | recurrentes (`compromisosRecurrentesService`, `RowForm`, `Listado`), `opexService`, `compromisoDetectionService`, `bonificaciones/gastosDomiciliados`, `clasificacionGastoVisual`, `familyMapping` | Sí, si existe decisión sobre §3.2 |
| B | `CategoriaGastoCompromiso` | 7 | 0 | `catalogoConceptos` (proyección), `tiposDeGastoPersonal`, `fiscalidadConcepto`, `RowForm` | idem |
| B | `BolsaPresupuesto` / `bolsaPresupuesto` | 5 / 14 | 33 | `presupuestoAnualService`, `PresupuestoPage`, `opexService`, `compromisoDetectionService`, `onboardingDetectionService`, `TreasuryEvent.bolsaPresupuesto` (`types-movimientos.ts:326`) | **NO · nudo §3.2** |
| B | `FamiliaFiscal` / `familiaFiscalManual` | 5 / 3 | 0 | `fiscalidadConcepto`, `RowForm` (derrama conservación/mejora) | Lente fiscal · fuera de alcance |
| B | `tipoFamilia` (campo) | 21 | 9 | recurrentes, `AddMovementModal`, `treasurySyncService`, migraciones v68/v70/T34-T35 | Sí (es el par viejo que C ya sustituye) |
| **C** `catalogoConceptos.ts` + `conceptosBase.ts` | módulo / `FamiliaId` / `conceptoPorId` / `proyectar` | 20 / 11 / 16 / 9 | 3 | **catálogo VIVO de la UI**: `RowForm`, `Listado`, `ImportarGastosModal`, `groupingHelpers`, `catalogoTipoGasto`, `FichaMovimiento`, `fichaDesdeItem`, `propuestaDeLinea`, `AddMovementModal`, `ConceptosPage` (conceptos propios en `keyval['conceptosUsuario']`), `InboxV3ExtractedPanel`, `documentAutoClassifyService`, `sembrarOpexInmueble`, `catalogoModalidadInmueble`, `punteoAdapter`, `migrarConceptoUnificado` | Sí · es el más cercano al objetivo (familia+concepto, proyección por ámbito) · **pero** su proyección es quien da `categoryKey` (A) → cae con A |
| C | `conceptoId` (campo) | 18 | 4 | idem | idem |
| **D** `tiposDeGastoPersonal.ts` + fixture `baselineInmuebleLegacy.ts` (`TIPOS_GASTO_INMUEBLE_V2`) | | 1 / 4 | 3 | sólo `catalogoPresentacionPersistencia.ts` (traductor) + tests de equivalencia de C | Sí · cae con el traductor |
| **E** `GastoCategoria` (`types-inmuebles.ts:436`) | | 8 | 0 | `gastosInmuebleService` (`CATEGORIA_A_CASILLA`), `treasuryConfirmationService.resolveGastoCategoria`, `altaMovimientoService`, `EditarRegistroInmuebleModal`, `documentAutoClassifyService`, **fiscal:** `declaracionDistributorService`, `operacionFiscalService`, `rendimientoActivoService` | **NO sin la lente fiscal** (§3.3) |

`tiposDeGastoInmueble.ts` (citado en `categoryCatalog.ts:6`) **no existe** como fichero: sobrevive como fixture
`services/conceptos/__fixtures__/baselineInmuebleLegacy.ts:27` (DEDUCIDO: renombrado al unificar en C).

### 2.2 · Traductores

| Traductor | Prod | Test | Estado |
|---|---|---|---|
| `metodoDePago.ts` | 5 | 1 | **ELIMINADO** (`c632f90`) |
| `treasuryConfirmationService.resolveGastoCategoria` (A→E, lossy) | 2 | 0 | Cae con E |
| `gastosInmuebleService.CATEGORIA_A_CASILLA` (E→casilla) | 5 | 1 | Cae con la lente fiscal |
| `conceptos/mapaLegacy.ts` (tipoFamilia:subtipo → concepto) | 8 | 2 | Cae con C (`migrarConceptoUnificado` lo usa) |
| `catalogoPresentacionPersistencia.ts` (presentación ↔ `categoryKey`) | 4 | 2 | Cae con A+C |

### 2.3 · Método · tipo · ámbito · neutralidad

| Eje | Antes | Ahora | Pendiente |
|---|---|---|---|
| Método | `MetodoDePago` + `MetodoPagoCompromiso` + traductor | **UN `MetodoPago`** | — |
| Ámbito | `'PERSONAL'\|'INMUEBLE'` en 3 tipos · 33 prod · 37 test | **`Ambito` minúsculas** | `Prestamo.ambito`/FEIN (fuera de alcance · traductor único con TODO) |
| Tipo / naturaleza | `MovementType` ×2 (`categoryCatalog.ts:56` · `types-movimientos.ts:18`) **+ `TreasuryEvent.type`** (`:249`) | sin cambio | **Nudo §3.1** |
| Neutralidad | `categoryKey` traspaso · `is_transfer`+`transfer_group_id` · `transferMetadata` | `is_transfer`/`transfer_group_id` retirados (0 escritores · 1 lector que ya miraba `transferMetadata`) | Colapso final = naturaleza en el evento · **§3.1** |

---

## 3 · Nudos · PARA y reporta

### 3.1 · Naturaleza y neutralidad · `TreasuryEvent.type` (VERIFICADO)

- `Movement.type` (`Ingreso\|Gasto\|Transferencia\|Ajuste`): 10 escritores prod, 3 lectores (`punteoAdapter.ts:85,90,506`), 22 tests. **Barato.**
- `TreasuryEvent.type` (`income\|expense\|financing`): **45 ficheros prod · 75 tests** · ~100 líneas prod · ~300 líneas test. `financing`
  gobierna trato especial de préstamos en `dashboardService.ts:1332,1462,1564,1606`, `movementMatchingService.ts:260`,
  `propertySaleService.ts:1411` (y hoy **cuenta como gasto**: `esGasto = expense || financing`).
- La neutralidad se decide sobre **eventos y movimientos a la vez** (`tesoreriaV6Metrics.esTraspasoInterno`,
  `traspasoInterno.parDeTraspaso` distingue salida/entrada por `categoryKey`, `punteoAdapter` ×3,
  `documentRequirementsService`). Poner `naturaleza` sólo en `Movement` dejaría dos vocabularios en el punteo, que
  mezcla ambos: **peor que ninguno**.
- Conclusión: naturaleza + neutralidad es un bloque de ~55 prod / ~100 tests con cambio semántico (`financing` →
  `gasto` + familia `prestamo_hipoteca`). Es una tarea, no un paso. **Propuesta:** E2.4.1b.

### 3.2 · Presupuesto 50/30/20 · `BolsaPresupuesto` (VERIFICADO)

- `catalogoConceptos.proyectar(concepto,'personal')` devuelve `{categoria, bolsa}`; `compromisosRecurrentesService.ts:646`
  copia `bolsaPresupuesto` al evento; `presupuestoAnualService.ts` (901 líneas) y `PresupuestoPage.tsx` agrupan por ella.
- El catálogo de 4 ejes **no tiene bolsa** y el encargo prohíbe un quinto eje. Opciones que sólo Jose puede decidir:
  (a) bolsa = lente derivada de la familia (mapa `FamiliaId → Bolsa` fuera del catálogo, como la fiscal);
  (b) retirar el 50/30/20; (c) bolsa como atributo del recurrente, elegido a mano.
- Hasta esa decisión, el árbol B no se puede borrar sin dejar el presupuesto sin datos.

### 3.3 · Casilla AEAT · el enganche que el encargo pide quitar (VERIFICADO)

- `GastoInmueble.casillaAEAT: AEATBox` es **obligatorio** (`types-inmuebles.ts:500`) e **indexado**
  (`db.ts:355` índice `casillaAEAT`). Lo fija `treasuryConfirmationService.resolveCasillaAEAT` desde
  `categoryCatalog.casillaAEAT` (A) y `CATEGORIA_A_CASILLA` (E).
- Lo leen `declaracionDistributorService`, `operacionFiscalService`, `rendimientoActivoService`, `gastoDeducible`,
  `estimacionFiscalEnCursoService`, `fiscalSummaryService` (capa fiscal · **fuera de alcance**).
- Quitar el enganche y dejar un TODO deja cada gasto de inmueble nuevo **sin casilla** hasta que exista la lente.
  Con Regla A (datos de usar y tirar) es asumible, pero es una regresión funcional de la declaración que hay que
  aceptar explícitamente, y el tipo obligatorio hay que relajarlo (`casillaAEAT?`) para que compile.
- `basuras`/`tributo` ya colapsan a `'otro'` en E (`treasuryConfirmationService.ts:189-194`): el árbol nuevo los
  distingue como subtipos de `impuestos_tasas`; la lente fiscal tendrá que leer familia+subtipo, no sólo familia.

### 3.4 · Conceptos propios del usuario (DEDUCIDO)

`keyval['conceptosUsuario']` guarda conceptos/familias propias referenciando `FamiliaId` de C
(`conceptosUsuarioService.ts:46-56`). Regla A: no se migran; al eliminar C hay que decidir si Ajustes → Conceptos
sigue existiendo sobre el catálogo único (familias propias con proyección heredada) o se retira.

---

## 4 · DB_VERSION

- Actual: **92** (`db.ts:58`). Esta tarea: **sin bump** (campos nuevos ninguno; tipos y valores, sí).
- `gastosInmueble.categoria` **no tiene índice** (índices: `casillaAEAT`, `ejercicio`, `estado`, `inmueble-ejercicio`,
  `inmuebleId`, `movimientoId`, `origen`, `origen-origenId`, `treasuryEventId` · `db.ts:355`): cambiar su dominio de
  valores de `GastoCategoria` a `FamiliaId` **no exige bump**. Sí lo exigiría retirar el índice `casillaAEAT` si la
  casilla deja de ser obligatoria (§3.3), o añadir índice por familia.
- Regla A: ningún dato se migra; los `paymentMethod`/`ambito` guardados con vocabulario viejo se recargan de cero.

---

## 5 · El tamaño real del «de golpe» (VERIFICADO por grep)

| Bloque | Prod | Test |
|---|---|---|
| Método (hecho) | 9 | 8 |
| Ámbito (hecho) | 33 | 45 |
| Naturaleza + neutralidad (`Movement.type` + `TreasuryEvent.type` + marcadores) | ~55 | ~100 |
| Árbol A (`categoryKey`/`subtypeKey`/`TRANSFER_KEYS`/casilla/storeName) | ~50 | ~35 |
| Árbol C (+`conceptoId`, conceptos propios) | ~25 | ~10 |
| Árbol B (+`bolsaPresupuesto`, `tipoFamilia`, `TipoCompromiso`) | ~30 | ~40 |
| Árbol E + traductores fiscales | ~12 | ~5 |
| **Total (con solapes)** | **~120-150** | **~130-180** |

---

## 6 · Propuesta de corte (para decidir · no ejecutada)

1. **E2.4.1 (este PR)** · cimiento: catálogo + método + ámbito. Verde, sin nudos.
2. **E2.4.1b** · naturaleza en `Movement` **y** `TreasuryEvent` (retira `MovementType` ×2 y `income/expense/financing`),
   colapso de neutralidad en `movimiento_interno` + familia `traspaso`, test «interno no cuenta en gasto/ingreso pero sí en saldo».
3. **E2.4.1c** · árboles A/C/D/E + traductores, con dos decisiones tomadas antes: bolsa 50/30/20 (§3.2) y casilla
   (§3.3 · `casillaAEAT?` opcional + TODO de la lente). Incluye `gastosInmueble.categoria: FamiliaId` (sin bump) y
   los 4 ejes en `CompromisoRecurrente` y `GastoInmueble`.

---

## 7 · Verificación de este PR

- `tsc --noEmit`: **limpio** en los tres commits.
- Suite completa (`react-scripts test`, CI): baseline `main` = 28 suites / 108 tests en rojo (pre-existentes, lista en
  el PR). Tras los tres commits: **sin rojas nuevas** (misma lista; el detalle exacto va en el comentario del PR).
- Greps a cero en `src/`: `MetodoPagoCompromiso` · `MetodoDePago` · `metodoDePago.ts` · `'PERSONAL'`/`'INMUEBLE'` en
  `Movement`/`TreasuryEvent`/`MovementLearningRule` (quedan los de `Prestamo`/FEIN y el changelog de `db.ts:58`).
- Criterios del encargo: build pasa ✔ · etiquetar/re-etiquetar 4 ejes ✔ (test del catálogo) · `movimiento_interno`
  fuera de agregados ✗ (nudo §3.1) · `gastosInmueble.categoria` con familia nueva ✗ (nudo §3.3) · greps a cero de
  `CategoriaGastoCompromiso`/`GastoCategoria`/`resolveGastoCategoria`/`CATEGORIA_A_CASILLA`/`MovementType` ✗ (nudos).
