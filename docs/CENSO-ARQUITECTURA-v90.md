# CENSO DE ARQUITECTURA · ATLAS v90

> **Solo lectura.** Ningún fichero de producto se ha tocado en esta tarea: el
> cambio en `package.json` solo registra el script del censo, que el detector de
> código muerto exige para no contarlo como muerto (§8).
> **DB_VERSION = 90** · `src/services/db.ts:57` · base `AtlasHorizonDB` · 46 stores.
> Fecha del censo: 30 agosto 2026 · rama `claude/new-session-g5zeh5`.
>
> **Derivado del código, no escrito a mano.** Todo el recuento de esta página lo
> produce `scripts/censo-stores.mjs` (ver §7). El mapa que había en el repo
> (`ATLAS-mapa-stores-VIGENTE.md`, 25 abril, v53, 56 stores) está 37 versiones
> obsoleto y **no se ha usado como fuente**.
>
> Regla aplicada: cada afirmación lleva `fichero:línea`. Donde el código no
> decide, se documenta la ambigüedad en vez de rellenarla.

---

## 0 · RESUMEN · lo que el censo encuentra

Los 46 stores del enunciado son **exactamente** los que define el código. Pero el
principio «cada dato vive en UN store» se incumple en tres sitios, y solo uno de
los tres está bajo control.

| Hallazgo | Estado | Dónde |
|---|---|---|
| 46 físicos = 46 declarados · 0 fantasma | ✅ cuadra | §1 |
| `resultadosEjercicio` · **nadie lo toca en producción** | 🔴 MUERTO | §2, §6 |
| `propertyDays` · se lee en 3 cálculos fiscales, **nadie lo escribe jamás** | 🔴 circuito roto | §4.3 |
| `retos` · leído por Mi Plan, sin escritor, ruta desactivada por flag | 🟡 por construir | §4.4 |
| `viviendaHabitual` · entidad retirada, lectores de compat | 🟢 legacy consciente | §4.4 |
| `deudasFiscales` · se lee en Fiscal, **`crearDeuda` no lo llama nadie en producción** | 🟡 medio construido | §4.5 |
| Un gasto de inmueble vive **a la vez** en `treasuryEvents` y `gastosInmueble` | 🟠 duplicación reconocida | §4.6 |
| El punteo manual **no usa** el módulo de cierre: busca la línea solo por `treasuryEventId` y puede duplicarla | 🔴 mitigación incompleta | §4.6 |
| Al conciliar, la clasificación del evento **se copia** al movimiento | 🟠 denormalización | §4.6 |
| `inmuebleId` es `number` en unos stores y `string` en otros | 🔴 aristas frágiles | §3.3 |
| El prefetch de `/personal` y `/mi-plan` pide 4 stores **que ya no existen** | 🟡 config muerta | §3.4 |
| `opexRules → compromisosRecurrentes` (el dual-write de abril) | ✅ resuelto | §4.6 |

**Titular:** la inconsistencia que se persigue **ya no está donde decía el mapa de
abril**. `opexRules` se unificó y ese dual-write está cerrado. La duplicación viva
hoy es otra: **la línea fiscal y la previsión de tesorería son el mismo hecho
escrito dos veces** (§4.6), y el propio código lo dice con todas las letras.

---

## 1 · LOS 46 STORES · verificación

`scripts/censo-stores.mjs` cuenta los `createObjectStore()` de los upgrades y los
contrasta con las claves de `interface AtlasHorizonDB`:

```
ATLAS · censo de stores · 46 físicos · 46 declarados en AtlasHorizonDB
  ✓ físicos y declarados cuadran · 0 fantasma
```

- **Físicos**: `src/services/db/upgrade-a.ts` (44 creaciones) + `src/services/db/upgrade-b.ts` (`escenarios:11`, `objetivos:44`, `fondos_ahorro:59`, `retos:72`).
- **Declarados**: `src/services/db.ts:88-…`, `interface AtlasHorizonDB extends DBSchema`.
- **Único `deleteObjectStore` vivo**: `src/services/db/upgrade-a.ts:274`, sobre una lista de stores legacy, tipada `as never` porque ya no existen en el schema.

La lista del enunciado coincide **nombre a nombre** con la del código. ✅

**Discrepancia de documentación (no de código):** el bloque de conteo canónico de
`src/services/db.ts:64-88` sigue diciendo «**45 stores físicos**». Es el texto de
v79; V90 añadió `explotacionAlquiler` y el comentario de `DB_VERSION`
(`db.ts:57`) sí dice 46. **El comentario largo de `db.ts:66` está desactualizado
en 1.**

---

## 2 · CENSO POR STORE

Estado según el código, **no según cuántas filas tenga hoy** (los recuentos de
registros se ignoran, como pide el encargo).

Criterio:
- **VIVO** — se escribe y se lee en producción.
- **SOLO-LECTURA** — hay lectores, ningún escritor: o se puebla por fuera, o está roto.
- **MUERTO** — nadie lo toca en producción.
- Los `__typeguards__` **no cuentan** como escritor: escriben para que el compilador falle, no en ejecución (`src/services/__typeguards__/dbschema-valores.ts`).

### 2.1 · Tesorería

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `movements` | `Movement` · `db/types-movimientos.ts:40` | 22 ficheros · `bankStatementOrchestrator.ts:393`, `altaMovimientoService.ts:187`, `treasuryConfirmationService.ts:1046`, `reconciliarConfirmado.ts:58`, `statementSessionService.ts:104` | 37 ficheros · `accountBalanceService.ts:147`, `TesoreriaV6Page.tsx:218`, `movementMatchingService.ts:94` | **VIVO** |
| `treasuryEvents` | `TreasuryEvent` · `db/types-movimientos.ts:254` | 30 ficheros · `treasurySyncService.ts:409`, `treasuryForecastService.ts:46`, `previsionesDelCompromiso.ts`, `previsionesDelPlan.ts` | 40+ ficheros · `punteoAdapter.ts:285`, `cierreDeMes.ts:84` | **VIVO** (el más acoplado de la base) |
| `accounts` | `Account` · `db/types-contratos.ts:544` | `cuentasService.ts:222`, `accountBalanceService.ts:182`, `treasuryApiService.ts:129` | 34 ficheros | **VIVO** |
| `importBatches` | `ImportBatch` · `db/types-fiscal.ts:104` | `bankStatementOrchestrator.ts:485`, `statementSessionService.ts:110` | `batchHashUtils.ts:180`, `statementIgnoredLinesService.ts:42` | **VIVO** |
| `tarjetas` | `Tarjeta` · `types/tarjetas.ts:63` | `tarjetasService.ts` | `conciliarExtractoTarjeta.ts`, `recibosDeTarjetaPrevistos.ts` | **VIVO** (V87) |
| `movementLearningRules` | `MovementLearningRule` · `db/types-movimientos.ts:408` | `movementLearningService.ts:294` | `movementLearningService.ts:195`, `movementSuggestionService.ts:269` | **VIVO** |

### 2.2 · Inmuebles

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `properties` | `Property` · `db/types-inmuebles.ts:10` | 30 sitios | **115 sitios** — el store más leído | **VIVO** (núcleo) |
| `property_sales` | `PropertySale` · `db/types-inmuebles.ts:267` | `propertySaleService.ts` | `gananciaPatrimonialService.ts`, `VentaWizard.tsx` | **VIVO** |
| `gastosInmueble` | `GastoInmueble` · `db/types-inmuebles.ts:482` | `gastosInmuebleService.ts:31`, `altaMovimientoService.ts:506`, `cierreLineaInmueble.ts:218` | `fiscalCacheService.ts:82`, `operacionFiscalService.ts:132` | **VIVO** |
| `mejorasInmueble` | `MejoraInmueble` · `db/types-inmuebles.ts:530` | `mejorasInmuebleService.ts:12`, `altaMovimientoService.ts:250` | `gananciaPatrimonialService.ts:66` | **VIVO** |
| `mueblesInmueble` | `MuebleInmueble` · `db/types-inmuebles.ts:558` | `mueblesInmuebleService.ts` | amortización de mobiliario | **VIVO** |
| `baseAmortizableEjercicio` | `BaseAmortizableEjercicio` · `db/types-inmuebles.ts:459` | `baseAmortizableEjercicioService.ts:108` | `baseAmortizableEjercicioService.ts:59` | **VIVO** (V82) |
| `vinculosAccesorio` | `VinculoAccesorio` · `db/types-fiscal.ts:546` | `vinculoAccesorioService.ts` | cálculo fiscal de accesorios | **VIVO** |
| `documents` | `Document` · `db/types-inmuebles.ts:694` | `documentIngestionService.ts:241`, `db/documents.ts:81`, `InboxPage.tsx:141` | `ArchivoPage.tsx:109`, `fiscalResolverService.ts:358` | **VIVO** |
| `proveedores` | `Proveedor` · `db/types-inmuebles.ts:588` | `proveedorService.ts:93`, `declaracionDistributorService.ts:2097` | `proveedorService.ts:41` | **VIVO** |
| `valoracionesActivos` | `ValoracionActivo` · `types/valoracionActivo.ts:29` | `valoracionesService.ts:190` (vía `const STORE`) | `galeriaHero.ts:332`, `patrimonioInmuebleAdapter.ts` | **VIVO** (polimórfico, V74) |

### 2.3 · Alquileres

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `contracts` | `Contract` · `db/types-contratos.ts:187` | `contractService.ts:142`, `documentIngestionService.ts:334` | 35 sitios · `treasurySyncService.ts`, `irpfCalculationService.ts:659` | **VIVO** |
| `explotacionAlquiler` | `ExplotacionAlquiler` · `db/types-inmuebles.ts:254` | `explotacionAlquilerService.ts:185,198`, `migrations/v90-explotacionAlquiler.ts:52` | `explotacionAlquilerService.ts:115,127`, `TabDisponibilidad.tsx`, `useHabitacionesContrato.ts` | **VIVO** (nace en V90) |
| `botesAnualesSinIdentificar` | `BoteAnualSinIdentificar` · `db/types-contratos.ts:74` | `boteAnualService.ts:117`, `db/post-open.ts:224` | `boteAnualService.ts:144` | **VIVO** |
| `propertyDays` | `PropertyDays` · `db/types-contratos.ts:522` | **NADIE** | `aeatAmortizationService.ts:317`, `imputacionRentaService.ts:130`, `irpfCalculationService.ts:725` | 🔴 **SOLO-LECTURA · roto** (§4.3) |

### 2.4 · Fiscal

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `ejerciciosFiscalesCoord` | `EjercicioFiscalCoord` · `db/types-fiscal.ts:427` | `ejercicioFiscalService.ts:127`, `declaracionDistributorService.ts:501` | 17 sitios | **VIVO** |
| `aeatCarryForwards` | `AEATCarryForward` · `db/types-contratos.ts:501` | `carryForwardService.ts:64`, `fiscalSummaryService.ts:269` | `arrastresVivosService.ts:47`, `alertasFiscalesService.ts:62` | **VIVO** |
| `arrastresIRPF` | `ArrastreIRPF` · `db/types-movimientos.ts:619` | `snapshotDeclaracionService.ts:166`, `migrateOrphanedInmuebleIds.ts:398` | `compensacionAhorroService.ts:140` | **VIVO** |
| `perdidasPatrimonialesAhorro` | `PerdidaPatrimonialAhorro` · `db/types-movimientos.ts:601` | `compensacionAhorroService.ts` | `irpfCalculationService.ts` | **VIVO** |
| `snapshotsDeclaracion` | `SnapshotDeclaracion` · `db/types-movimientos.ts:672` | `snapshotDeclaracionService.ts:230,281` (vía `const STORE_NAME`) | `snapshotDeclaracionService.ts:295,303` | **VIVO** |
| `entidadesAtribucion` | `EntidadAtribucionRentas` · `db/types-movimientos.ts:658` | `entidadAtribucionService.ts:14` | `entidadAtribucionService.ts:20` | **VIVO** |
| `deudasFiscales` | `DeudaFiscal` · `db/types-fiscal.ts:560` | `deudasFiscalesService.ts:71` — **sin caller de producción** | `FiscalDashboardPage.tsx:26`, `HistoricoDeclaracionesSection.tsx:37` | 🟡 **medio construido** (§4.5) |
| `resultadosEjercicio` | `ResultadoEjercicio` · `db/types-movimientos.ts:543` | **NADIE** (solo `__typeguards__/dbschema-valores.ts:31`) | **NADIE** | 🔴 **MUERTO** (§6) |

### 2.5 · Personal

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `personalData` | `PersonalData` · `types/personal.ts:33` | `personalDataService.ts` | `fiscalContextService`, `informesDataService` | **VIVO** (singleton `id=1`) |
| `personalModuleConfig` | `PersonalModuleConfig` · `types/personal.ts:622` | `personalDataService.ts:89` (tx `readwrite` → `store.put`) | `personalDataService.ts:73` (tx `readonly` → `store.get(1)`) | **VIVO** ⚠️ |
| `ingresos` | `unknown` en el schema (`db.ts:151`) | `autonomoService.ts:142`, `pensionService.ts:61`, `otrosIngresosService.ts:79`, `nominaService` | 14 sitios · `irpfCalculationService.ts:504` | **VIVO** |
| `compromisosRecurrentes` | `CompromisoRecurrente` · `types/compromisosRecurrentes.ts:208` | `personal/compromisosRecurrentesService.ts:91` (vía `const STORE_COMPROMISOS`) | 19 sitios | **VIVO** |
| `viviendaHabitual` | `ViviendaHabitual` · `types/viviendaHabitual.ts:134` | **NADIE** | `viviendaHabitualService.ts:35`, `treasuryBootstrapService.ts:200`, `compromisoDetectionService.ts:793` | 🟢 **legacy consciente** (§4.4) |
| `avisosUsuario` | `AvisoCerrado` · `types/avisosUsuario.ts:7` | `avisosUsuarioService.ts:66` | `avisosUsuarioService.ts:65` | **VIVO** |

⚠️ `personalModuleConfig` solo se accede vía `transaction(...).objectStore(...)`.
Un grep ingenuo (`db.put('personalModuleConfig'`) da **cero** y lo declararía
muerto por error. Es el motivo de que el script resuelva variables (§7).

### 2.6 · Inversiones y financiación

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `prestamos` | `Prestamo` · `types/prestamos.ts:47` | `prestamosService`, `loanSettlementService.ts` | 22 sitios | **VIVO** ⚠️ (ver §3.5) |
| `inversiones` | `PosicionInversion` · `types/inversiones.ts:72` | `inversionesService.ts:184`, `indexaCapitalImportService.ts:446` | 16 sitios | **VIVO** |
| `planesPensiones` | `PlanPensiones` · `types/planesPensiones.ts:33` | `planesPensionesService.ts:178` | 26 sitios | **VIVO** |
| `aportacionesPlan` | `AportacionPlan` · `types/planesPensiones.ts:82` | `aportacionesPlanService.ts:24`, `nominaAportacionHook.ts:100` | `limitesFiscalesPlanesService.ts` | **VIVO** |
| `traspasosPlanPensiones` | `TraspasoPlanPensiones` · `types/planesPensiones.ts:109` | `traspasosPlanPensionesService.ts`, `aeatPlanesPensionesImportService.ts` | consultas por `activoId` (V88) | **VIVO** |

### 2.7 · Mi Plan

| Store | Interface | Escriben | Leen | Estado |
|---|---|---|---|---|
| `escenarios` | `Escenario` · `types/miPlan.ts:23` | `escenariosService.ts:72,119` | `PanelPage.tsx:195`, `escenariosService.ts:44` | **VIVO** (singleton `id=1`) |
| `objetivos` | `Objetivo` · `types/miPlan.ts:88` | `objetivosService.ts` | `MiPlanPage.tsx:62`, `WizardNuevoObjetivo.tsx:108` | **VIVO** |
| `fondos_ahorro` | `FondoAhorro` · `types/miPlan.ts:152` | `fondosService.ts:123`, `objetivosService.ts:120` | `MiPlanPage.tsx:63`, `WizardNuevoFondo.tsx:116` | **VIVO** |
| `objetivosVitales` | `ObjetivoVital` · `types/objetivosVitales.ts:20` | `objetivosVitalesService.ts:92,137,143` | `objetivosVitalesService.ts:33,40,111` | **VIVO** |
| `retos` | `Reto` · `types/miPlan.ts:180` | **NADIE** | `MiPlanPage.tsx:64` | 🟡 **por construir** (§4.4) |

### 2.8 · Infra

| Store | Escriben | Leen | Estado |
|---|---|---|---|
| `keyval` | 29 ficheros · `db/post-open.ts:118` (flags de migración), `financialValuesService.ts:39` | 29 ficheros | **VIVO** (config + flags; catálogo en `db.ts:196-…`) |
| `benchmarksReferencia` | `benchmarksReferenciaService.ts:235` | `benchmarksReferenciaService.ts:34` | **VIVO** |

---

## 3 · RELACIONES ENTRE STORES · el mapa que faltaba

### 3.1 · Aristas reales (`storeA.campo → storeB.id`)

**Hacia `properties.id`** (el hub del modelo):

| Arista | Tipo | Definición |
|---|---|---|
| `contracts.inmuebleId` | `number` | `db/types-contratos.ts:191` |
| `explotacionAlquiler.inmuebleId` | `number` · único | `db/types-inmuebles.ts:256` |
| `gastosInmueble.inmuebleId` | `number` | `db/types-inmuebles.ts:484` |
| `mejorasInmueble.inmuebleId` | `number` | `db/types-inmuebles.ts:532` |
| `mueblesInmueble.inmuebleId` | `number` | `db/types-inmuebles.ts:560` |
| `baseAmortizableEjercicio.inmuebleId` | `number` | `db/types-inmuebles.ts:461` |
| `botesAnualesSinIdentificar.inmuebleId` | `number` | `db/types-contratos.ts:76` |
| `property_sales.propertyId` | `number` | `db/types-inmuebles.ts:269` |
| `aeatCarryForwards.propertyId` | `number` | `db/types-contratos.ts:503` |
| `propertyDays.propertyId` | `number` | `db/types-contratos.ts:524` |
| `vinculosAccesorio.inmueblePrincipalId` / `.inmuebleAccesorioId` | `number` | `db/types-fiscal.ts:548-549` |
| `treasuryEvents.inmuebleId` | `number` | `db/types-movimientos.ts:274` |
| `compromisosRecurrentes.inmuebleId` | `number` | `types/compromisosRecurrentes.ts:213` |
| `arrastresIRPF.inmuebleId` | `number` | `db/types-movimientos.ts:626` |
| ⚠️ `movements.inmuebleId` | **`string`** | `db/types-movimientos.ts:142` |
| ⚠️ `movementLearningRules.inmuebleId` | **`string`** | `db/types-movimientos.ts:416` |
| ⚠️ `prestamos.inmuebleId` | **`string`** | `types/prestamos.ts:68` |
| ⚠️ `properties.mainPropertyId` | `number` (auto-referencia) | `db/types-inmuebles.ts:89` |

**Hacia `accounts.id`:** `movements.accountId` (`types-movimientos.ts:42`) · `treasuryEvents.accountId` (`:309`) · `importBatches.accountId` (`types-fiscal.ts:107`) · `contracts.cuentaCobroId` (`types-contratos.ts:269`) · `tarjetas.cuentaLiquidacionId` (`types/tarjetas.ts:85`) · `explotacionAlquiler.cuentaCobroPorDefectoId` (`types-inmuebles.ts:262`) · `objetivos.cuentaId` (`types/miPlan.ts:131`) · ⚠️ `prestamos.cuentaCargoId` **`string`** (`types/prestamos.ts:209`).

**Entre `movements` ↔ `treasuryEvents`** (la pareja más cargada):
- `treasuryEvents.movementId` → `movements.id` — `types-movimientos.ts:330`
- `treasuryEvents.executedMovementId` → `movements.id` — `types-movimientos.ts:392`
- `treasuryEvents.pairEventId` → `treasuryEvents.id` (espejo de traspaso) — `:382`
- `movements.pairMovementId` / `.pairEventId` — `:194`, `:185`
- Se escriben juntos en `treasuryForecastService.ts:342-343` y `bankStatementOrchestrator.ts:375,393`.

**Hacia `documents.id`:** `gastosInmueble.documentId|facturaId|justificanteId` (`types-inmuebles.ts:511,519,521`) · idem `mejorasInmueble` (`:542,548,550`) y `mueblesInmueble` (`:572,578,580`) · `treasuryEvents.facturaId|justificanteId` (`types-movimientos.ts:395,397`) · `movements.documentIds[]` (`:119`) · `valoracionesActivos.archivoOrigenId` (`types/valoracionActivo.ts:40`).

**Resto:** `aportacionesPlan.planId` → `planesPensiones.id` (`types/planesPensiones.ts:84`) · `traspasosPlanPensiones.planId|activoId` (`:111,123`) · `objetivos.fondoId` → `fondos_ahorro.id` (`types/miPlan.ts:93`) · `fondos_ahorro.objetivoVinculadoId` → `objetivos.id` (`:166`, **bidireccional**) · `objetivos.prestamoId` → `prestamos.id` (`:99`) · `personalModuleConfig.personalDataId` → `personalData.id` (`types/personal.ts:623`) · `planesPensiones.personalDataId` (`types/planesPensiones.ts:38`) · `treasuryEvents.contratoId` → `contracts.id` (`:292`) · `treasuryEvents.tarjetaId` → `tarjetas.id` (`:302`).

**La arista polimórfica** (patrón deliberado, V74/V88):
`valoracionesActivos.activoId` + `.tipoActivo` (`types/valoracionActivo.ts:31`) apunta
a `properties` | `inversiones` | `planesPensiones` según el discriminante. **No hay
integridad referencial**: `migrations/auditV74_PR6.ts:19` existe precisamente para
detectar valoraciones huérfanas. Ambigüedad documentada, no resuelta por el tipo.

### 3.2 · La arista genérica `origen` / `origenId`

`gastosInmueble.origen` + `.origenId` (`db/types-inmuebles.ts:504`, índice
`origen-origenId`) es un puntero **destipado**: el destino depende del valor de
`origen` (`'recurrente'` → `compromisosRecurrentes`, ver
`altaMovimientoService.ts:497-500`). Igual `treasuryEvents.sourceType` +
`.sourceId` (`types-movimientos.ts:258-264`), con **25 valores posibles** de
`sourceType` y un `sourceId` que es `number | string` porque algunos flujos
fabrican claves compuestas (`${autonomoId}-cuota`).

**Consecuencia:** ningún tipo garantiza que el destino exista. Es la arista más
usada del sistema y la menos verificable.

### 3.3 · ARISTAS ROTAS · `inmuebleId` no tiene un tipo

El mismo concepto —«de qué inmueble es esto»— está declarado `number` en 14
stores y `string` en 3 (`movements`, `movementLearningRules`, `prestamos`), más
`movements.property_id?: string` (`types-movimientos.ts:89`) como **tercer**
nombre para lo mismo.

Que no es teórico lo demuestra el propio código, que convierte en cada cruce:
- `bankStatementOrchestrator.ts:399` — `inmuebleId: String(event.inmuebleId)` al copiar del evento (`number`) al movimiento (`string`).
- `treasurySyncService.ts` usa un helper `idDeInmueble()` porque «hay flujos que escriben `inmuebleId: 0` como marcador de "aún sin vincular"» y `properties` es autoIncrement desde 1.
- Existe una migración entera dedicada a esto: `src/services/migrations/migrateOrphanedInmuebleIds.ts`.

**Es una raíz real de inconsistencia**: un `String(0)`, un `""` o un `undefined`
rompen el join en silencio y el dato queda huérfano sin que nada falle.

### 3.4 · ARISTAS ROTAS · referencias a stores que ya no existen

`src/services/navigationPerformanceService.ts:176-178` precalienta cachés por ruta
y nombra **4 stores eliminados en V62/V63**:

```js
{ match: href.startsWith('/personal'), stores: ['nominas', 'autonomos', 'otrosIngresos', 'compromisosRecurrentes', 'personalData'] },
{ match: href.startsWith('/mi-plan'),  stores: ['escenarios', 'objetivos', 'fondos_ahorro', 'retos', 'nominas', 'autonomos', ...] },
```

`'nominas'`, `'autonomos'` y `'otrosIngresos'` se unificaron en `ingresos` (V61/V63);
`'expenses'` (línea 171) nunca fue un store de esta base.

**Impacto medido, no supuesto:** `warmCachedStores` → `indexedDbCacheService.ts:35`
hace `db.getAll(storeName as any)`, que lanza `NotFoundError`; pero
`preloadRouteResources` lo envuelve en `Promise.allSettled`
(`navigationPerformanceService.ts:209`), así que **el error se traga en silencio**.
No rompe nada: simplemente el prefetch de `/personal` y `/mi-plan` está
parcialmente muerto y nadie se entera. El `as any` de la línea 35 es lo que
permite que compile.

### 3.5 · ARISTAS ROTAS · FKs a `resultadosEjercicio` (store muerto)

Tres campos apuntan a un store que **nadie escribe ni lee** (§6):

| Campo | Definición |
|---|---|
| `FiscalSummary.resultadoEjercicioId` | `db/types-fiscal.ts:97` — *«FK resultadosEjercicio.id para histórico inmutable»* |
| `PropertyImprovement.sourceResultadoEjercicioId` | `db/types-inmuebles.ts:366` |
| `EjercicioFiscal.resultadoEjercicioId` | `db/types-movimientos.ts:483` |

Son punteros a un cajón vacío que nunca se llena.

### 3.6 · Ambigüedad · dos interfaces `Prestamo`

- `src/types/prestamos.ts:47` — la **canónica**, la que importa `db.ts:19`.
- `src/types/loans.ts:3` — una segunda definición, importada solo por `src/services/financialCalculations.ts`.

No se ha determinado si son estructuralmente compatibles. **Se documenta la
ambigüedad**: un cálculo financiero opera sobre un tipo `Prestamo` que no es el
que persiste la base.

### 3.7 · Tipos huérfanos · interfaces de stores ya borrados

Siguen definidos en `src/services/db/types-*.ts` sin store detrás:
`OpexRule` (`types-fiscal.ts:360`), `Budget`/`BudgetLine` (`:275,306` — stores
borrados en V80), `LoanSettlement` (`types-inmuebles.ts:316` — absorbido en
`prestamos.liquidacion` en V63), `OperacionProveedor` (`:605`),
`TreasuryRecommendation` (`types-movimientos.ts:459`), `Expense`
(`types-fiscal.ts:182`), `FiscalSummary` (`:37`), `ArrastreGasto` (`:518`),
`AmortizacionAcumulada` (`:534`).

⚠️ `OpexRule` **sigue teniendo UI viva**: `components/inmuebles/OpexRuleForm.tsx`
se monta desde `pages/GestionInmuebles/tabs/GastosRecurrentesTab.tsx:326`. No
escribe a un store fantasma — `opexService.ts:8` actúa de **fachada** y persiste en
`compromisosRecurrentes` (`opexService.ts:395`). El tipo sobrevive como forma del
formulario, no como fila. Es correcto, pero el nombre engaña.

### 3.8 · Diagrama

```
                       ┌───────────────┐
                       │  properties   │◄──── el hub · 115 lecturas
                       └───────┬───────┘
      ┌───────────┬────────────┼─────────────┬──────────────┐
      │           │            │             │              │
┌─────▼─────┐ ┌───▼────────┐ ┌─▼──────────┐ ┌▼───────────┐ ┌▼──────────────┐
│ contracts │ │explotacion │ │gastos/     │ │property_   │ │ propertyDays  │
│           │ │ Alquiler   │ │mejoras/    │ │  sales     │ │  ✗ SIN ESCRITOR│
└─────┬─────┘ └────────────┘ │muebles     │ └────────────┘ └───────────────┘
      │                      └─────┬──────┘
      │ sourceType:'contrato'      │ treasuryEventId
      │                            │  ┌──────────────────┐
      └──────────────►┌────────────▼──▼──┐               │
                      │  treasuryEvents  │  la PREVISIÓN │
                      └────────┬─────────┘               │
                               │ movementId              │ mismo hecho,
                               │ executedMovementId      │ dos filas (§4.6)
                      ┌────────▼─────────┐               │
                      │    movements     │  el HECHO     │
                      └────────┬─────────┘               │
                               │ accountId               │
                      ┌────────▼─────────┐               │
                      │    accounts      │◄──────────────┘
                      └──────────────────┘

  resultadosEjercicio  ✗ MUERTO ◄── 3 FKs apuntando al vacío (§3.5)
  retos                ✗ sin escritor · ruta tras flag SHOW_RETOS=false
  viviendaHabitual     ~ legacy · solo lectores de compat
```

---

## 4 · LAS SEIS PREGUNTAS

### 4.1 · `rentaMensual` — ¿dónde viven hoy las previsiones de renta? **(prioridad)**

**El store se eliminó en V62.** `src/services/db.ts:99`:

```ts
// rentaMensual: ELIMINADO en V62 (sub-tarea 3) — deprecated V5.6 · 0 registros
```

No se fusionó en `contracts`: **se eliminó por vacío**, ya estaba deprecado desde
V5.6 y no tenía filas. Hoy el circuito de rentas tiene **tres piezas, ninguna de
ellas un store propio**:

1. **El importe pactado** es un campo del contrato: `Contract.rentaMensual`
   (`db/types-contratos.ts`), leído directamente en
   `treasurySyncService.ts:377` con el comentario que lo certifica:
   > `// rentaMensual store eliminado en V62 — usar contract.rentaMensual directamente.`

2. **La previsión mensual** es un `TreasuryEvent` con `sourceType: 'contrato'`,
   emitido por `treasurySyncService.ts:409`. Un evento por contrato y mes, con
   `sourceId: contract.id`, `inmuebleId`, `unidadInmueble` (la habitación) y
   `counterparty` (el inquilino).

3. **El cobro real** es un `Movement` que se cruza contra ese evento al puntear o
   al importar el extracto.

**Sutilezas del circuito que el censo saca a la luz:**

- Conviven **dos `sourceType` para lo mismo**: `'contrato'` (la previsión) y
  `'contract'` (lo que ya entró por extracto). `treasurySyncService.ts:362-364`
  lo explica: *«Los dos nombres de la renta · si el cobro ya entró por el extracto
  (`'contract'`), no se emite además la previsión (`'contrato'`)»*. Todo consumidor
  debe comprobar **los dos** — y lo hacen: `punteoAdapter.ts:285`,
  `ingresosAnualesService.ts:28`, `db/post-open.ts:590`. **Un lector nuevo que
  compruebe solo uno contará mal.** Es una trampa activa.
- El importe del mes lo decide un único punto, `importeDeLaRentaDelMes()`, que
  prorratea el primer y el último mes por días.
- La renta **no se persiste mensualmente en ningún sitio**: se recalcula del
  contrato cada vez. Es coherente con el principio (un dato, un store), pero
  significa que cambiar `Contract.rentaMensual` reescribe la historia de las
  previsiones aún no ejecutadas.

**Veredicto:** el circuito está **vivo y es coherente**, con la deuda del doble
`sourceType`. No hay store perdido.

### 4.2 · `movements` vs `treasuryEvents` — ¿hecho vs previsión, o mezclados?

**La separación es real y está bien definida**, con una fuga acotada.

| | `movements` | `treasuryEvents` |
|---|---|---|
| Qué es | La línea del banco · **el hecho** | La previsión · **la interpretación** |
| Tipo | `Movement` · `types-movimientos.ts:40` | `TreasuryEvent` · `:254` |
| Estado | `unifiedStatus`: previsto/confirmado/vencido/no_planificado/conciliado | `status`: predicted/confirmed/executed |
| Certeza | — | `certeza`: declarado/calculado/atlas_nativo/estimado/manual |
| Origen | `source`: import/manual/inbox | `sourceType` (25 valores) + `sourceId` |

La regla del texto crudo lo confirma (`types-movimientos.ts:44-56`): en un
movimiento importado `description` **no se toca nunca**, ni al conciliarlo, porque
`hashMovement` deduplica por él; la descripción de la previsión convive aparte en
`descripcionPrevision`. **El hecho es inmutable; la interpretación va al lado.**

**Al importar un fichero** (`bankStatementOrchestrator.ts`): nacen `movements`
(`:683 db.add('movements', candidate)`) y un `importBatches`. Los `treasuryEvents`
**no** nacen del extracto — se emiten aparte desde los generadores
(`treasurySyncService`, `previsionesDelCompromiso`, `previsionesDelPlan`).

**Al conciliar** (`bankStatementOrchestrator.ts:375-400`): el evento pasa a
`executed` con `executedMovementId`, y el movimiento **hereda la clasificación del
evento** (`categoryKey`, `subtypeKey`, `conceptoId`, `ambito`, `inmuebleId`).

**Aquí está la fuga**, y es deliberada (comentario en `:390-395`): sin esa copia,
*«cuadrar un gasto lo dejaba sin familia y no había forma de cruzarlo luego»*. Es
**denormalización consciente**, no mezcla accidental — pero significa que la
categoría de un gasto conciliado existe en dos filas, y si alguien reclasifica el
evento después, el movimiento se queda con la vieja. Ver §4.6.

### 4.3 · `explotacionAlquiler` y `propertyDays`

**`explotacionAlquiler` — VIVO, es lo más nuevo de la base.** Nace en V90
(`db.ts:57`). Convierte «poner en alquiler» en entidad propia: deja de ser un
atributo de `Property` (`modoExplotacion`, `alquilerPorHabitaciones`) y pasa a ser
una fila que referencia al inmueble. Marcar un inmueble como alquilable = crear su
`ExplotacionAlquiler`; desmarcarlo = borrarla; lo no marcado es uso propio.

Circuito completo: servicio (`explotacionAlquilerService.ts`), migración de siembra
(`migrations/v90-explotacionAlquiler.ts:52`), UI (`TabDisponibilidad.tsx`) y
consumidor (`useHabitacionesContrato.ts`). **No se solapa con `contracts`**: la
explotación es la *capacidad* de alquilar (modo, estado, habitaciones); el contrato
es el *acuerdo* con un inquilino. Los campos legacy de `Property` quedan de
solo-lectura «hasta que no queden lectores» (`db.ts:57`) — **deuda declarada y en
curso**, no incoherencia.

**`propertyDays` — 🔴 CIRCUITO ROTO.** Es el hallazgo más claro del censo.

Tres cálculos fiscales lo leen:
- `aeatAmortizationService.ts:317` — *«Manda el dato que haya puesto el usuario a mano (`propertyDays`)»* (`:303`)
- `imputacionRentaService.ts:130`
- `irpfCalculationService.ts:725`

**Y nadie lo escribe. En todo el repositorio, tests incluidos.** Las únicas otras
menciones son la creación del store (`upgrade-a.ts:106`) y el borrado en cascada
al eliminar un inmueble (`inmuebleDeleteService.ts:100,206`) — que borra filas que
nunca pudieron crearse.

El `getRentalDaysForYear` que lo consulta cae siempre al *fallback* de contratos,
porque el override manual **no tiene UI ni servicio que lo escriba**. No es un
store muerto: es **una función a medio construir**. La rama «el usuario corrige los
días a mano» está escrita en el lado que lee y ausente en el lado que escribe.

**No borrarlo sin decisión de producto**: la pregunta no es técnica (¿se quiere el
override manual de días? entonces falta el escritor; ¿no se quiere? entonces
sobran el store, los 3 lectores y la cascada de borrado).

### 4.4 · `retos`, `objetivos`, `objetivosVitales`, `escenarios` — ¿Mi Plan o restos?

**Son Mi Plan v5, un módulo vivo** (`App.tsx:282-289`, rutas en `:1107-1149`), no
restos. Pero no están todos igual de terminados:

| Store | Estado | Evidencia |
|---|---|---|
| `objetivos` | **VIVO** · CRUD + 2 wizards | `objetivosService.ts`, `WizardNuevoObjetivo.tsx:108` |
| `fondos_ahorro` | **VIVO** · CRUD + wizard | `fondosService.ts:123`, `WizardNuevoFondo.tsx:116` |
| `objetivosVitales` | **VIVO** · CRUD completo | `objetivosVitalesService.ts:33,92,137,143` · página `HitosVitalesPage.tsx` |
| `escenarios` | **VIVO** · singleton `id=1` | `escenariosService.ts:44,72,119` · leído por `PanelPage.tsx:195` |
| `retos` | 🟡 **por construir** | ver abajo |

**`retos`** tiene lector (`MiPlanPage.tsx:64`) y **ningún escritor de producción**
(solo `db/__tests__/backup.test.ts`). No es un olvido — está **apagado a propósito**:

- `src/modules/mi-plan/featureFlags.ts:20` → `export const SHOW_RETOS = false;`
- `App.tsx:1147` → la ruta `retos` es un `<Navigate to="/mi-plan/objetivos">`; la lazy import está comentada (`App.tsx:292`).
- El propio flag lleva la receta de 4 pasos para revivirlo, e incluye *«Restaurar el CTA del EmptyState en `RetosPage.tsx` apuntando al wizard T27.x **cuando se construya**»*.

**El wizard que escribiría `retos` no existe todavía.** Store creado, tipo definido
(`types/miPlan.ts:180`), página escrita, escritor pendiente. **`retos` = FALTA POR
CONSTRUIR, no muerto.** No borrarlo.

**`viviendaHabitual`** (aunque no esté en la pregunta, es el caso hermano): entidad
**retirada del producto** y documentada como tal en
`services/personal/viviendaHabitualService.ts:1-22`. El modelo se repartió: recibos
del hogar → `compromisosRecurrentes`; hipoteca → `prestamos`; rol fiscal →
`Property.usoTipo='vivienda_habitual'`. Quedan 2 lectores de compatibilidad
(referencia catastral de fichas antiguas) y un limpiador de eventos. Los datos del
usuario «se conservan dormidos» a propósito. **Legacy consciente, correctamente
gestionado** — no tocar.

### 4.5 · Vacíos: «por diseño» vs «falta por construir»

Los stores que el enunciado sospecha vacíos **no están vacíos ni por la misma
razón**. La distinción que importa no es cuántas filas tienen, sino si su
**escritor existe**:

**A · VACÍO POR DISEÑO** — el dato canónico vive en otro sitio:

| Store | El dato canónico está en |
|---|---|
| `personalModuleConfig` | Derivado 100% de `personalData` (`personalDataService.ts:88-105`); `db.ts:130-140` lo declara: *«NO contiene información fiscal»*, todos los flags hardcoded `true` salvo dos derivados de `situacionLaboral`. Es **caché de flags**, no fuente. |
| `viviendaHabitual` | Repartido en `compromisosRecurrentes` + `prestamos` + `Property.usoTipo` (§4.4). |

**B · VIVOS, no vacíos** (el enunciado los daba por sospechosos y no lo son):
`arrastresIRPF` (escrito por `snapshotDeclaracionService.ts:166`),
`snapshotsDeclaracion` (`:230,281`), `perdidasPatrimonialesAhorro`,
`entidadesAtribucion`. Todos tienen escritor y lector reales.

**C · FALTA POR CONSTRUIR** — hay lector, falta el escritor:

| Store | Qué falta | Evidencia |
|---|---|---|
| `propertyDays` | **Todo el lado escritura.** 3 lectores fiscales, 0 escritores | §4.3 |
| `retos` | El wizard de alta (T27.x) + quitar el flag | §4.4 |
| `deudasFiscales` | **El disparador.** El servicio está completo y probado; nadie lo invoca | abajo |

**`deudasFiscales` — el calendario de apremios está a medias.** Contra lo que
sugería el enunciado, **no falta por construir del todo**: existe el store (V71), el
tipo (`types-fiscal.ts:560`), un servicio completo
(`deudasFiscalesService.ts`: `crearDeuda:61`, `marcarPagada:75`,
`actualizarRecargo:91`, `getDeudasAbiertas:50`) y su test
(`__tests__/deudasFiscalesService.test.ts`). La UI **ya lee**:
`FiscalDashboardPage.tsx:26`, `FiscalDeudasTab.tsx`,
`HistoricoDeclaracionesSection.tsx:37`, `fiscalResolverService.ts:689`.

Lo que falta es **quién llama a `crearDeuda`**: fuera de los tests, ningún módulo de
producción la invoca. La pantalla existe y siempre mostrará cero. Es un
**hueco de un solo punto** (el flujo que detecta la deuda al presentar un modelo),
no un módulo por escribir.

### 4.6 · Duplicación de verdad — ¿queda algún dual-write?

**El de abril (`opexRules → compromisosRecurrentes`) está RESUELTO.** ✅ El store
`opexRules` se eliminó en V62 y todo pasa por `compromisosRecurrentes`
(`propertyExpenses.ts:168`: *«V5.4+: read from compromisosRecurrentes … instead of
opexRules (DEPRECATED)»*; `fiscalCacheService.ts:80`). El formulario `OpexRuleForm`
sobrevive como forma de UI sobre la fachada `opexService` (§3.7), sin store propio.
**No queda dual-write ahí.**

**Pero hay dos duplicaciones vivas.** La primera es estructural y el propio código
la nombra sin rodeos — `src/services/cierreLineaInmueble.ts:5-6`:

> *«Un gasto de inmueble vive **en dos sitios a la vez**: la previsión de tesorería
> (`treasuryEvents`) y la línea que declara (`gastosInmueble`). Cuando el pago
> ocurre de verdad hay que cerrar los dos, y hasta ahora solo uno de los dos
> caminos lo hacía.»*

**Esta es la raíz de inconsistencia que se buscaba.** El histórico del fichero
documenta el fallo exacto que produjo: puntear a mano cerraba la línea, subir el
extracto **no**, y el gasto se quedaba en `previsto` y **fuera de las casillas de la
declaración**. Tesorería se veía bien; la declaración salía mal.

**La mitigación es PARCIAL · lo compartido son los campos, no el cierre.** El
comentario del fichero dice *«para que los dos caminos escriban lo MISMO»*, pero el
código no hace eso: los caminos comparten la **pieza pura que calcula los campos**
(`camposDeCierre`), no la orquestación de buscar-y-escribir. Verificado importador
a importador:

| Camino | Qué importa de `cierreLineaInmueble` | Busca la línea por |
|---|---|---|
| Subir extracto · `bankStatementOrchestrator.ts:22,418` | `cerrarLineaDeGastoDelEvento` — la función completa | `treasuryEventId` **y** `origen`+`origenId` (`cierreLineaInmueble.ts:184,~210`) |
| Anotar a mano · `altaMovimientoService.ts:34,497` | solo `aceptaCierre` + `camposDeCierre` | índice `origen-origenId` (propio) |
| **Puntear una previsión · `treasuryConfirmationService.ts:35,423`** | **solo `camposDeCierre`** | **`findLineByTreasuryEventId` (`:216`) · SOLO por `treasuryEventId`** |

Historia real del módulo — `git log` da **2 commits**, ambos del lado del extracto:
`7eaf6e5` *«fix(fiscal): la importación de extracto cierra la línea de gasto
(#1810)»* (lo crea) y `94d184d` *«fix(fiscal): conciliar escribe el dato del banco,
no la estimación (#1812)»*. Es decir: el módulo nació para arreglar el camino del
extracto, y el punteo manual **no se migró a él** — conserva su propio buscar y su
propio escribir (`treasuryConfirmationService.ts:396` y `:439-447`).

⚠️ **Asimetría con consecuencia, no cosmética.** Una línea nacida de un compromiso
recurrente se escribe *«`origen:'recurrente'`, sin `treasuryEventId`»*
(`altaMovimientoService.ts:425`, la crea `operacionFiscalService.ts:344`). Sobre
ese estado:

- el extracto la encuentra por `origen`+`origenId` y **la cierra**;
- el punteo manual busca solo por `treasuryEventId`, **no la encuentra**, y cae a
  la rama `else` que hace `add` (`treasuryConfirmationService.ts:445-446`) →
  **segunda fila para el mismo gasto**.

Es exactamente el daño que `altaMovimientoService.ts:423-428` describe y evita en
*su* camino: *«su gasto ya tiene fila del mes … Crear otra lo contaría dos veces en
la declaración.»* Dos de los tres caminos se defienden de esto; el punteo manual no.

**Alcance de esta afirmación:** la asimetría de búsqueda está verificada en código
(líneas arriba) y el doble conteo es su consecuencia directa, pero **no se ha
ejecutado** el escenario ni existe test que lo cubra (ver abajo). Antes de tratarlo
como bug confirmado, lo barato es escribirlo como test: puntear a mano un evento de
recurrente cuya línea ya existe sin `treasuryEventId`, y contar filas.

**Cobertura de test · asimétrica igual que el código.** El camino del extracto está
bien probado: `__tests__/importacionCierraLinea.test.ts` ejercita
`cerrarLineaDeGastoDelEvento` contra una base falsa con **11 casos**, incluida la vía
`origenId` que era el fallo original, la idempotencia y el no-tocar-lo-ajeno; más
`conciliacionDatosReales.test.ts` (importe y fecha reales) y
`cierreLineaInmueble.test.ts` (piezas puras). Del punteo manual **no hay test de
cierre**: `treasuryConfirmationService.test.ts:231` comprueba que *crea* la línea al
confirmar, no que *cierre una preexistente*; y `cierreLineaInmueble.test.ts:78`
—`describe('camposDeCierre · lo mismo que escribe el punteo manual')`— es un unit
test del helper aislado, que no prueba nada sobre lo que `treasuryConfirmationService`
hace con él. **El nombre del describe afirma una equivalencia que el test no
comprueba.**

Y sigue habiendo dos filas para un hecho, unidas por
`gastosInmueble.treasuryEventId` (`types-inmuebles.ts:517`) y `.movimientoId`
(`:512` — **`string`**, mientras `movements.id` es `number`: la misma fractura de
§3.3).

La segunda es la **herencia de clasificación** al conciliar
(`bankStatementOrchestrator.ts:391-400`): `categoryKey`, `subtypeKey`, `conceptoId`,
`ambito` e `inmuebleId` se copian del evento al movimiento. Justificada (§4.2),
pero es el mismo hecho en dos filas **sin resincronización**: reclasificar el
evento después no actualiza el movimiento.

---

## 5 · TABLA · dato → store → quién lo lee

| Dato | Store canónico | Módulos que lo leen |
|---|---|---|
| Ficha del inmueble | `properties` | **todos** (115 lecturas) |
| Capacidad de alquiler (modo, estado, habitaciones) | `explotacionAlquiler` | Alquileres, Contratos |
| Acuerdo con inquilino + **importe de renta** | `contracts` | Alquileres, Tesorería, Fiscal, Informes |
| Previsión de cobro/pago | `treasuryEvents` | Tesorería, Panel, Fiscal, Proyección |
| Línea del banco (el hecho) | `movements` | Tesorería, Conciliación, Fiscal, Informes |
| Sesión de importación | `importBatches` | Tesorería |
| Cuenta bancaria | `accounts` | Tesorería, Financiación, Mi Plan, Personal |
| Tarjeta | `tarjetas` | Tesorería (piezas y recibos) |
| Gasto deducible del inmueble | `gastosInmueble` | Fiscal, Inmuebles |
| Mejora capitalizable | `mejorasInmueble` | Fiscal (ganancia patrimonial), Inmuebles |
| Mobiliario amortizable | `mueblesInmueble` | Fiscal |
| Base amortizable por ejercicio | `baseAmortizableEjercicio` | Fiscal |
| Días de alquiler (override manual) | `propertyDays` | Fiscal ×3 — **🔴 nunca poblado** |
| Valor de cualquier activo en el tiempo | `valoracionesActivos` | Inmuebles, Inversiones, Panel |
| Préstamo y su cuadro | `prestamos` | Financiación, Tesorería, Fiscal, Mi Plan |
| Posición de inversión | `inversiones` | Inversiones, Fiscal |
| Plan de pensiones / aportaciones / traspasos | `planesPensiones` · `aportacionesPlan` · `traspasosPlanPensiones` | Inversiones, Fiscal, Personal |
| Perfil fiscal del titular | `personalData` | Fiscal (vía `fiscalContextService`), Informes |
| Ingreso personal (nómina/autónomo/pensión/otros) | `ingresos` | Personal, Fiscal, Mi Plan |
| Gasto recurrente (hogar e inmueble) | `compromisosRecurrentes` | Personal, Tesorería, Inmuebles, Mi Plan |
| Coordinación del ejercicio fiscal | `ejerciciosFiscalesCoord` | Fiscal (17 sitios) |
| Arrastres y pérdidas compensables | `aeatCarryForwards` · `arrastresIRPF` · `perdidasPatrimonialesAhorro` | Fiscal |
| Snapshot de declaración | `snapshotsDeclaracion` | Fiscal |
| Deuda con Hacienda | `deudasFiscales` | Fiscal — **🟡 nunca poblado** |
| Documento / factura | `documents` | Inbox, Archivo, Fiscal, Inmuebles |
| Objetivos, fondos, hitos, escenario | `objetivos` · `fondos_ahorro` · `objetivosVitales` · `escenarios` | Mi Plan, Panel |
| Retos | `retos` | Mi Plan — **🟡 nunca poblado** |
| Config y flags de migración | `keyval` | transversal (29 ficheros) |

---

## 6 · STORES MUERTOS A BORRAR

### `resultadosEjercicio` — el único MUERTO del censo

**Grep de reachability completo** (toda mención en `src/`, sin excepciones):

```
src/services/db.ts:322                          declaración del schema
src/services/db/upgrade-a.ts:415-416            createObjectStore
src/services/__typeguards__/dbschema-valores.ts:28-31   candado de compilación
src/services/__tests__/dbV77Migration.test.ts:109       test de estructura
src/services/__tests__/db.structure.v79.test.ts:61      test de estructura
src/services/db/types-fiscal.ts:97              FK huérfana
src/services/db/types-inmuebles.ts:366          FK huérfana
src/services/db/types-movimientos.ts:483        FK huérfana
```

**Cero lecturas. Cero escrituras. Cero servicios. Cero UI.** La única escritura
(`dbschema-valores.ts:31`) es un `@ts-expect-error` que escribe `{ __basura__: true }`
para que el compilador falle el día que el store reciba tipo real — es un candado,
no un uso.

Estaba pensado como *«V2.9: Immutable yearly fiscal snapshots»* (`db.ts:322`), pero
esa función la cumple hoy `snapshotsDeclaracion`, que **sí** está vivo. Es un
duplicado conceptual que nunca se conectó.

**Recomendación:** borrar el store, el tipo `ResultadoEjercicio`
(`types-movimientos.ts:543`) y las 3 FKs huérfanas de §3.5. Antes de tocar nada,
verificar en una copia real que no tiene filas: fue creado en V2.9 y una base
antigua podría conservar datos que hoy nadie sabe leer.

### Lo que NO hay que borrar

- **`propertyDays`** — no está muerto, está a medio construir (§4.3). Decisión de producto.
- **`retos`** — apagado a propósito por `SHOW_RETOS=false`, con receta de reactivación (§4.4).
- **`viviendaHabitual`** — legacy consciente, con lectores de compat y datos de usuario dormidos a propósito (§4.4).

### Limpieza menor (no son stores)

1. `navigationPerformanceService.ts:171,177,178` — quitar `'nominas'`, `'autonomos'`, `'otrosIngresos'`, `'expenses'` (§3.4). Convendría además que `warmCachedStores` valide contra `db.objectStoreNames` y avise, en vez de que `allSettled` se lo trague.
2. Tipos huérfanos de §3.7 sin store detrás (conservando `OpexRule`, que sostiene un formulario vivo).
3. `db.ts:66` — el bloque de conteo canónico dice 45; son 46 desde V90 (§1).

---

## 7 · LO QUE FALTA · datos sin store

| Dato | Dónde debería vivir | Estado |
|---|---|---|
| Días de alquiler corregidos a mano | `propertyDays` | Store y lectores listos · **falta el escritor y su UI** |
| Retos de ahorro | `retos` | Store, tipo y página listos · **falta el wizard T27.x** (`featureFlags.ts:14`) |
| Alta de deuda con Hacienda | `deudasFiscales` | Store, servicio, tests y UI de lectura listos · **falta quien llame a `crearDeuda`** |
| Renta mensual materializada | — | **Por diseño no existe**: se recalcula del contrato (§4.1) |

---

## 8 · NOTA DE MÉTODO · cómo se regenera este censo

El mapa de abril quedó obsoleto porque se mantenía a mano. Este no debería.

**El censo lo produce un script**, entregado con esta tarea:

```bash
node scripts/censo-stores.mjs              # tabla resumen + cuadre físicos/declarados
node scripts/censo-stores.mjs --anomalias  # solo lo que no es VIVO
node scripts/censo-stores.mjs --json       # censo completo con fichero:línea
```

Salida de hoy:

```
ATLAS · censo de stores · 46 físicos · 46 declarados en AtlasHorizonDB
  ✓ físicos y declarados cuadran · 0 fantasma
42 VIVOS · 4 a revisar
  propertyDays · SOLO-LECTURA          resultadosEjercicio · SIN-ACCESO-PROD
  retos · SOLO-LECTURA                 viviendaHabitual · SOLO-LECTURA
```

**Por qué no basta un grep.** Tres de los cuatro hallazgos se pierden con
`grep "db.put('store'"`, y uno da un falso positivo. El código accede a los stores
de tres formas, y el script resuelve las tres:

| Forma | Ejemplo | Quién la usa |
|---|---|---|
| literal | `db.put('movements', x)` | la mayoría |
| constante | `const STORE = 'valoracionesActivos'; db.add(STORE, x)` | `valoracionesService.ts:190`, `compromisosRecurrentesService.ts`, `snapshotDeclaracionService.ts` |
| objectStore | `const s = tx.objectStore('personalModuleConfig'); s.put(c)` | `personalDataService.ts:73,89` |

Sin resolver la 2ª, `valoracionesActivos` y `snapshotsDeclaracion` aparecen sin
escritor. Sin la 3ª, `personalModuleConfig` **aparece muerto y no lo está**. El
script descuenta además tests y `__typeguards__`, que es lo que deja
`resultadosEjercicio` correctamente aislado como el único muerto real.

**Registrado en `package.json`** como `"censo:stores": "node scripts/censo-stores.mjs"`
(`npm run censo:stores`). No es cosmético: el detector de muerte transitiva
(`scripts/lib/deadcode.mjs`) trata los `scripts/` como vivos **solo** si los
alcanza una raíz, y una de las raíces es justamente el bloque `scripts` de
`package.json`. Sin esa línea el censo se contaba a sí mismo como código muerto y
el trinquete de salud pasaba de `dead 0` a `dead 1`. Es el mismo mecanismo que
mantiene vivo a `scripts/completeDataCleanup.js` vía `cleanup:complete`.

**Pendiente** (no aplicado — excede el encargo de esta tarea):

1. Enganchar el cuadre físicos/declarados a `npm run health` como **aserción
   dura**, para que el CI falle si aparece un fantasma.
2. Que un store nuevo sin lector, o uno que pierda su último escritor, salga en
   `--anomalias` y se revise en el PR que lo provoca, no 37 versiones después.

### Por qué el marcador de salud no veía nada de esto

`npm run health` mide `stores_fantasma`, `lecturas_store_inexistente` y
`servicios_muertos`, y hoy los tres dan **0**. No contradice este censo: mide
otra cosa.

- `lecturas_store_inexistente` (`scripts/health.mjs:291`) usa
  `/\.(get|getAll|getAllFromIndex|getFromIndex|count|objectStore)\((['"])([a-zA-Z0-9_]+)\2/`
  y solo cuenta stores ∈ `stores_fantasma` (declarados y no creados). Las
  referencias muertas de §3.4 son **literales dentro de un array de configuración**
  que otro helper consume, no llamadas directas: la regex no las ve, y como esos
  stores están borrados (no son «fantasma» en su definición), tampoco entrarían.
- El propio `health.mjs:290` reconoce el otro punto ciego, el mismo que obligó a
  resolver constantes en §7: *«(`const S='fiscalSummaries'; db.getAll(S)`) sigue
  sin verse»*.

**Los tres indicadores en 0 no significan que no haya nada roto; significan que lo
roto cae fuera de lo que la regex alcanza.** De ahí el punto 1 de «Pendiente».

**Límites del script**, escritos en su propia cabecera para que quien lo lea no se
fíe de más: es análisis léxico, no del AST (un `db.put(stores[i], x)` no se vería —
hoy no existe ninguno); cuenta ficheros que *tocan* el store, no si el flujo es
*alcanzable* desde la UI. La reachability real —el caso `retos`, el caso
`deudasFiscales`— sigue necesitando leer el código. El script dice **dónde mirar**;
no sustituye al criterio.

### Ficheros obsoletos que este censo reemplaza

- `ATLAS-mapa-stores-VIGENTE.md` — 25 abril 2026, DB v53, 56 stores. **37 versiones atrás.** El nombre («VIGENTE») es hoy activamente engañoso: convendría renombrarlo a `ATLAS-mapa-stores-historico-v53.md`, como ya se hizo con `ATLAS-mapa-54-stores-9abril-historico.md`.
