# T-CRUD-AUDIT · INFORME

> **Origen** · ejecutado por CC (Claude Code · agente que produce el informe) siguiendo spec `docs/audits/T-CRUD-AUDIT.md`
> **Fecha** · 2026-05-09
> **Branch** · `claude/execute-t-crud-audit`
> **Tipo** · Auditoría · CERO código modificado · CERO migraciones
> **Reglas aplicadas** · V11.3 · 5 preguntas obligatorias en cada duplicidad · V11.4 · NO lista cerrada · CC descubre TODAS las entidades

---

## §E · Resumen ejecutivo (5 líneas para PR description)

> **Nota correctiva (2026-05-09 post-revisión Jose)** · primera versión del informe contó **43 stores** leyendo la interfaz TypeScript `AtlasHorizonDB`. La realidad en producción (DevTools · DB v70) son **40 stores**. Diferencia · **6 entradas fantasma** en la interfaz que NO existen como `objectStore` real (ver §A revisado). Esta versión del informe corrige los conteos.

1. **Total entidades persistibles encontradas** · **40 stores reales** en producción DB v70 (verificado contra DevTools · captura Jose 2026-05-09). La interfaz TypeScript `AtlasHorizonDB` (`src/services/db.ts:2072`) declara **46 entradas** · 6 son fantasmas · 4 sin `createObjectStore` (`propertyImprovements`, `operacionesFiscales`, `fiscalSummaries`, `gastos` H10) y 2 con `deleteObjectStore` post-creación (`objetivos_financieros` V5.9, `traspasosPlanes` V65). 0 stores en `src/database/initDB.ts` (directorio no existe · todo en `db.ts`).
2. **Total gaps CRUD detectados** · **31 gaps** + **1 gap GRAVE recién detectado** · `traspasosPlanesService` escribe a `traspasosPlanes` que ya NO existe (eliminado V65 línea 4027) · 4 callers UI vivos según comentario código línea 2148 → posibles writes silenciosamente rotos (verificar). Resto del reparto · **11 servicios sin caller UI productivo** (🟡 sólo botón falta) · **8 servicios incompletos** · **9 entidades sin servicio CRUD propio** · **3 duplicidades CRUD nominales** (planes pensión wrapper · ingresos fragmentado · traspasos legacy ↔ V65).
3. **Top 5 gaps prioridad ALTA** · (1) **`traspasosPlanesService` con store eliminado** · NUEVO Y GRAVE · (2) `deleteContract` 0 callers UI · (3) movements sin delete individual UI fuera conciliación · (4) inmuebles sin `deleteInmueble` IDB local (sólo HTTP fantasma) · (5) `compromisosRecurrentes` sin delete service público (UI inexistente).
4. **Top duplicidades a sanear** · (a) `planesInversionService` wrapper sobre `planesPensionesService` (señalada en T-INACEPTABILIDADES E11) · (b) `traspasosPlanesService` apunta a store **eliminado** vs `traspasosPlanPensionesService` V65 sin UI viva · migración pendiente urgente · (c) `nominaService` + `autonomoService` + `otrosIngresosService` + `pensionService` operan 4 sobre `ingresos` (V63 unificado).
5. **Estimación tiempo total D-CRUD-COMPLETAR** · **18-28h CC** + **3-5h verificación urgente del gap traspasosPlanes** (ver si hay datos perdidos · si los 4 callers fallan silenciosamente · si la migración V65 efectivamente copió antes de borrar). Recomendación · spec por dominio · NO mezclar saneamiento con completar CRUD.

---

## §0 · Pre-flight · output literal

### §2.1 · Descubrimiento de TODAS las entidades persistibles

`grep -nE "createObjectStore\(" src/services/db.ts` arrojó **45 invocaciones** correspondientes a **43 nombres únicos creados a lo largo del histórico de migraciones** (algunas invocaciones son re-creaciones en branches condicionales del upgrade · ver listado abajo). De esos 43 nombres únicos creados, **3 fueron eliminados con `deleteObjectStore` en versiones posteriores** ·

- `objetivos_financieros` · `deleteObjectStore` V5.9 (líneas 3222/3326)
- `planesPensionInversion` · `deleteObjectStore` V65 (línea 4024)
- `traspasosPlanes` · `deleteObjectStore` V65 (línea 4027)

→ **43 − 3 = 40 stores reales en DB v70** ✅ (cuadra con `Almacenamiento de objetos: 40` mostrado por DevTools de Jose · captura 2026-05-09). Para el inventario canónico ver §A-real más abajo. ·

```
2436: createObjectStore('properties', { keyPath: 'id', autoIncrement: true })
2442: createObjectStore('property_sales', { keyPath: 'id', autoIncrement: true })
2452: createObjectStore('objetivos_financieros', { keyPath: 'id' })             ← legacy V5.4 (deprecated → escenarios)
2457: createObjectStore('documents', { keyPath: 'id', autoIncrement: true })
2465: createObjectStore('contracts', { keyPath: 'id', autoIncrement: true })
2473: createObjectStore('aeatCarryForwards', { keyPath: 'id', autoIncrement: true })
2481: createObjectStore('propertyDays', { keyPath: 'id', autoIncrement: true })
2491: createObjectStore('proveedores', { keyPath: 'nif' })
2498: createObjectStore('gastosInmueble', { keyPath: 'id', autoIncrement: true })   ← interno · proxied vía operacionFiscalService
2517: createObjectStore('mejorasInmueble', { keyPath: 'id', autoIncrement: true })
2531: createObjectStore('mueblesInmueble', { keyPath: 'id', autoIncrement: true })
2572: createObjectStore('accounts', { keyPath: 'id', autoIncrement: true })
2580: createObjectStore('movements', { keyPath: 'id', autoIncrement: true })
2591: createObjectStore('importBatches', { keyPath: 'id' })
2598: createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true })
2631: createObjectStore('presupuestos', { keyPath: 'id' })
2638: createObjectStore('presupuestoLineas', { keyPath: 'id' })
2661: createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true })
2673: createObjectStore('personalData', { keyPath: 'id', autoIncrement: true })
2679: createObjectStore('personalModuleConfig', { keyPath: 'personalDataId' })
2689: createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true })
2701: createObjectStore('planesPensionInversion', ...)                            ← legacy V65 (eliminado del runtime · tipo aún en interfaz para compilar migración)
2711: createObjectStore('traspasosPlanes', { keyPath: 'id', autoIncrement: true })  ← legacy V5.2 (4 callers UI vivos)
2724: createObjectStore('planesPensiones', { keyPath: 'id' })
2732: createObjectStore('aportacionesPlan', { keyPath: 'id' })
2741: createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true })
2750: createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true })
2760: createObjectStore('keyval')                                                  ← config + flags · NO entidad CRUD usuario
2765: createObjectStore('prestamos', { keyPath: 'id' })
2773: createObjectStore('valoraciones_historicas', { keyPath: 'id', autoIncrement: true })
2799: createObjectStore('resultadosEjercicio', { keyPath: 'id', autoIncrement: true })
2808: createObjectStore('arrastresIRPF', { keyPath: 'id', autoIncrement: true })
2818: createObjectStore('perdidasPatrimonialesAhorro', { keyPath: 'id', autoIncrement: true })
2826: createObjectStore('snapshotsDeclaracion', { keyPath: 'id', autoIncrement: true })
2833: createObjectStore('entidadesAtribucion', { keyPath: 'id', autoIncrement: true })
2841: createObjectStore('ejerciciosFiscalesCoord', { keyPath: 'año' })
2847: createObjectStore('vinculosAccesorio', { keyPath: 'id', autoIncrement: true })
2924: createObjectStore('compromisosRecurrentes', { keyPath: 'id', autoIncrement: true })
2939: createObjectStore('viviendaHabitual', { keyPath: 'id' })
3159: createObjectStore('escenarios', { keyPath: 'id' })                          ← duplicate (creación condicional en branch upgrade)
3243: createObjectStore('objetivos', { keyPath: 'id' })
3258: createObjectStore('fondos_ahorro', { keyPath: 'id' })
3271: createObjectStore('retos', { keyPath: 'id' })
3310: createObjectStore('escenarios', { keyPath: 'id' })                          ← second branch
3850: createObjectStore('planesPensiones', { keyPath: 'id' })                     ← second branch
3857: createObjectStore('aportacionesPlan', { keyPath: 'id' })                    ← second branch
3865: createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true })  ← second branch

# operacionesFiscales       · NO existe createObjectStore('operacionesFiscales') en el repo → fantasma · sólo tipo en interfaz · proxy real a gastosInmueble
# fiscalSummaries           · NO existe createObjectStore('fiscalSummaries') en el repo → fantasma · sólo tipo en interfaz
# gastos (H10 Treasury)     · NO existe createObjectStore('gastos') en el repo → fantasma · sólo tipo en interfaz
# propertyImprovements      · NO existe createObjectStore('propertyImprovements') en el repo → fantasma · alias del store real mejorasInmueble
```

`grep -nE "interface AtlasHorizonDB" src/services/db.ts` → línea 2072 · TypeScript interface enumera todos los stores activos (post-migración) ·

```
properties · property_sales · documents · contracts · aeatCarryForwards · propertyDays
propertyImprovements · operacionesFiscales · proveedores · accounts · movements
importBatches · treasuryEvents · fiscalSummaries · gastos · presupuestos
presupuestoLineas · movementLearningRules · inversiones · personalData · personalModuleConfig
ingresos · planesPensiones · aportacionesPlan · traspasosPlanPensiones · traspasosPlanes
prestamos · valoraciones_historicas · keyval · objetivos_financieros (legacy/deprecated)
resultadosEjercicio · arrastresIRPF · perdidasPatrimonialesAhorro · snapshotsDeclaracion
entidadesAtribucion · ejerciciosFiscalesCoord · vinculosAccesorio · compromisosRecurrentes
viviendaHabitual · escenarios · objetivos · fondos_ahorro · retos
+ gastosInmueble · mejorasInmueble · mueblesInmueble (no aparecen en interfaz · creados en
  migración inicial · accedidos vía servicios dedicados)
```

`find src/database -type f` → directorio NO existe · todo el schema vive en `src/services/db.ts`.

**Total entidades** · interfaz TypeScript declara **46** entradas · realidad producción DB v70 son **40 stores** (verificado contra DevTools de Jose 2026-05-09 captura · ver §A-real).

---

## §A · Inventario completo de entidades persistibles

> **CORRECCIÓN POST-REVISIÓN (2026-05-09)** · primera versión de §A listó las 46 entradas de la interfaz como si todas fueran stores reales. Esto reproduce el sesgo "interfaz miente" que Jose advirtió. Esta sección corregida separa **§A-real** (lo que existe en DB v70 producción · 40 stores) de **§A-fantasmas** (entradas en interfaz sin store real · 6 entradas).

### §A-real · 40 stores reales en producción (verificados contra DevTools)

Lista alfabética (orden DevTools) ·

```
accounts                       importBatches              prestamos
aeatCarryForwards              ingresos                   presupuestoLineas
aportacionesPlan               inversiones                presupuestos
arrastresIRPF                  keyval                     properties
compromisosRecurrentes         mejorasInmueble            propertyDays
contracts                      movementLearningRules      property_sales
documents                      movements                  proveedores
ejerciciosFiscalesCoord        mueblesInmueble            resultadosEjercicio
entidadesAtribucion            objetivos                  retos
escenarios                     perdidasPatrimonialesAhorro snapshotsDeclaracion
fondos_ahorro                  personalData               traspasosPlanPensiones
gastosInmueble                 personalModuleConfig       treasuryEvents
                               planesPensiones            valoraciones_historicas
                                                          vinculosAccesorio
                                                          viviendaHabitual
```

**40 stores** ✅ (cuadra con `Almacenamiento de objetos: 40` mostrado por DevTools · DB v70 · captura Jose).

### §A-fantasmas · 6 entradas en interfaz `AtlasHorizonDB` SIN store real

| Entrada | ¿Por qué está en la interfaz? | Estado real |
|---|---|---|
| `propertyImprovements` | Comentario `db.ts:2082` "H9-FISCAL: Property improvements for AEAT" | **NUNCA tuvo `createObjectStore`** · el store real con esa función es `mejorasInmueble`. Posible alias en interfaz que se quedó. **Limpiar de la interfaz**. |
| `operacionesFiscales` | Comentario `db.ts:2083` "Flujo fiscal unificado" | **NUNCA tuvo `createObjectStore`** · `operacionFiscalService.ts` proxia todas las ops a `gastosInmuebleService` (sobre store `gastosInmueble`). La interfaz declara un store que no se instancia. **Limpiar de la interfaz**. |
| `fiscalSummaries` | Comentario `db.ts:2092` "H9: Fiscal summaries by property/year" | **NUNCA tuvo `createObjectStore`** · ninguna creación detectada · `fiscalSummaryService.ts` opera sobre otros stores. **Limpiar de la interfaz**. |
| `gastos` (H10 Treasury) | Comentario `db.ts:2093` "H10: Treasury expense records" | **NUNCA tuvo `createObjectStore`** · sin escritor productivo. **Limpiar de la interfaz**. |
| `objetivos_financieros` | `createObjectStore` línea 2452 + `deleteObjectStore` líneas 3222/3326 | **Eliminado en V5.9** · interfaz lo mantiene "para compilar migración" según comentario propio. En DB v70 no existe. |
| `traspasosPlanes` | `createObjectStore` línea 2711 + `deleteObjectStore` línea 4027 | **Eliminado en V65** · interfaz lo mantiene "porque `traspasosPlanesService.ts` aún lo usa desde 4 componentes UI vivos" (comentario `db.ts:2148-2154`). **GAP GRAVE** · si la migración V65 ya pasó (DB v70 actual) y los 4 callers UI siguen vivos, escriben/leen un store inexistente → posibles writes que fallan silenciosamente o lecturas que devuelven vacío. **Verificar urgentemente** (ver §D nuevo gap #0). |

---

## §A-original (deprecated) · Inventario inicial sin filtrar fantasmas

| # | Store/Entidad | ¿Qué guarda? (1 línea) | Cardinalidad típica | Origen datos |
|---|---|---|---|---|
| 1 | `properties` | Inmuebles del usuario | 1-50 por usuario | UI alta + Excel masivo · ImportarInmuebles |
| 2 | `property_sales` | Operaciones de venta de inmuebles | 0-N (raras) | UI venta inmueble |
| 3 | `documents` | PDFs/imgs subidos · OCR · adjuntos | 100-10000 | UI Inbox + email ingest + drag-drop |
| 4 | `contracts` | Contratos de alquiler vinculados a inmueble | 0-100 | UI wizard + Excel masivo · ImportarContratos |
| 5 | `aeatCarryForwards` | Arrastres pérdidas/ganancias por casilla AEAT (cartera inmuebles) | 0-N (1 por inmueble x año x casilla) | Derivado lifecycle fiscal · `fiscalSummaryService` |
| 6 | `propertyDays` | Días de alquiler/disponibilidad por inmueble x ejercicio | 1 por inmueble x año | Derivado contratos |
| 7 | `propertyImprovements` | Mejoras (reformas amortizables) sobre inmueble | 0-N | UI fiscalidad · `mejorasInmuebleService` |
| 8 | `operacionesFiscales` | Operaciones fiscales unificadas (por casilla AEAT) | 100-10000 | Movimientos · gastosInmueble · proveedores |
| 9 | `proveedores` | Catálogo de proveedores (NIF como PK) | 1-500 | Inferido por OCR + manual |
| 10 | `accounts` | Cuentas bancarias del usuario | 1-20 | UI wizard + Excel ImportarCuentas |
| 11 | `movements` | Movimientos bancarios (extractos) | 1000-100000 | OCR + parsers CSV/XLS extractos |
| 12 | `importBatches` | Tracking importación CSV/XLS bancarios | 1-100 | Derivado bankStatementOrchestrator |
| 13 | `treasuryEvents` | Eventos de tesorería (previstos · confirmados) | 100-10000 | Derivado de movements + reglas |
| 14 | `fiscalSummaries` | Resúmenes fiscales por inmueble x año | 1 por inmueble x año | `fiscalSummaryService` lifecycle |
| 15 | `gastos` | Registros de gasto (H10 Treasury · NO inmueble) | 100-1000 | Derivado movements |
| 16 | `presupuestos` | Presupuestos anuales | 1-N por año | UI Presupuesto |
| 17 | `presupuestoLineas` | Líneas de presupuesto (categoría x mes) | 12-300 por presupuesto | UI Presupuesto |
| 18 | `movementLearningRules` | Reglas auto-clasificación movimientos | 0-500 | UI confirmación + ML |
| 19 | `inversiones` | Posiciones de inversión (planes · fondos · acciones) | 0-50 | UI alta + Excel ImportarAportaciones · IndexaCapital |
| 20 | `personalData` | Perfil fiscal núcleo del titular (singleton id=1) | 1 (singleton) | UI onboarding personal |
| 21 | `personalModuleConfig` | Flags UI/integración derivados de personalData | 1 (singleton) | Derivado personalData |
| 22 | `ingresos` | Ingresos personales unificados (nómina · autónomo · pensión · otro) | 0-50 | UI wizards · `nominaService` · `autonomoService` · etc. |
| 23 | `planesPensiones` | Planes de pensión (entidad estable UUID · V65) | 0-20 | UI wizard · `planesPensionesService` |
| 24 | `aportacionesPlan` | Eventos aportación a plan (3 roles · V65) | 0-1000 | UI + Excel ImportarAportaciones |
| 25 | `traspasosPlanPensiones` | Eventos traspaso fiscal neutro (V65 nuevo) | 0-100 | UI nueva (¿wireada?) |
| 26 | `traspasosPlanes` | Traspasos legacy V5.2 (4 callers UI vivos) | 0-100 | UI legacy `TraspasosHistorial` |
| 27 | `prestamos` | Préstamos/hipotecas | 0-20 | UI wizard + FEIN + Excel |
| 28 | `valoraciones_historicas` | Valoraciones por activo (mensuales · históricas) | 100-10000 | UI ActualizacionValoresDrawer + import |
| 29 | `keyval` | Config + flags migración | ~10 claves | Sistema |
| 30 | `objetivos_financieros` | LEGACY V5.4 → migrado a `escenarios` | 0-1 (singleton residual) | DEPRECATED |
| 31 | `resultadosEjercicio` | Snapshots inmutables resultado IRPF anual | 1 por año | Lifecycle fiscal |
| 32 | `arrastresIRPF` | Arrastres IRPF cross-year | 0-10 por año | Lifecycle fiscal |
| 33 | `perdidasPatrimonialesAhorro` | Pérdidas patrimoniales unificadas | 0-N | `compensacionAhorroService` |
| 34 | `snapshotsDeclaracion` | Declaraciones congeladas (auditoría) | 1 por año declarado | `snapshotDeclaracionService` (write-only) |
| 35 | `entidadesAtribucion` | Entidades en atribución de rentas | 0-10 | UI fiscal |
| 36 | `ejerciciosFiscalesCoord` | Coordinador modelo fiscal (4 regímenes · keyPath=año) | 1 por año | Lifecycle fiscal |
| 37 | `vinculosAccesorio` | Vínculos accesorio (parking/trastero) por ejercicio | 0-N | Derivado declaracionDistributor |
| 38 | `compromisosRecurrentes` | Catálogo universal compromisos (unifica opexRules + personal) | 0-200 | Detección automática + manual |
| 39 | `viviendaHabitual` | Ficha vivienda habitual (singleton hogar) | 1 (singleton) | UI ViviendaPage |
| 40 | `escenarios` | Singleton escenario libertad activo | 1 (singleton) | UI Mi Plan |
| 41 | `objetivos` | Lista objetivos (acumular · amortizar · comprar · reducir) | 0-20 | UI Mi Plan wizards |
| 42 | `fondos_ahorro` | Fondos ahorro con etiquetas propósito | 0-20 | UI Mi Plan wizards |
| 43 | `retos` | Retos mensuales (1 activo por mes) | 0-N | UI Mi Plan |
| + | `gastosInmueble` | Gastos inmuebles (cara fiscal) | 100-1000 | Proxiada por `operacionFiscalService` |
| + | `mejorasInmueble` | Mejoras (idem `propertyImprovements` · disambiguación interna) | 0-N | `mejorasInmuebleService` |
| + | `mueblesInmueble` | Mobiliario amortizable | 0-N | `mueblesInmuebleService` |

**Total** · 46 entradas en interfaz TypeScript (40 stores reales + 6 fantasmas) + las 3 entradas adicionales accedidas vía `(db as any)` (`gastosInmueble` · `mejorasInmueble` · `mueblesInmueble`) ya están entre los 40 reales (aparecen en DevTools).

---

## §B · Matriz CRUD maestra (40 entidades reales + 6 filas marcadas FANTASMA · 9 columnas · # · Entidad · 4 service C/R/U/D · 3 UI C/E/D)

Leyenda · ✅ servicio + caller UI productivo · 🟡 servicio existe · 0 callers UI productivos (gap aprovechable) · ❌ no existe ni servicio ni UI · ⚠ duplicidad (ver §C) · — N/A

| # | Entidad | Service Create | Service Read | Service Update | Service Delete | UI Create | UI Edit | UI Delete |
|---|---|---|---|---|---|---|---|---|
| 1 | `properties` (inmuebles) | ✅ `inmuebleService` (vía `datosFiscalesService.add`) · `duplicate` para clonar | ✅ `inmuebleService.getAll/get` | ✅ `inmuebleService.updateState` + `db.put('properties')` directo | 🟡 sólo `inmuebleService.delete()` HTTP-remote (sin caller productivo IDB local) + redux `removeInmueble` (en `RealEstateBlock` tax slice) | ✅ wizard | ✅ formularios | 🟡 falta delete IDB local con cascada (sólo HTTP fantasma) |
| 2 | `property_sales` | ✅ `propertySaleService.createPropertySale` | ✅ `propertySaleService.get*` | ✅ `cancelPropertySale` (revierte la venta) | ❌ no hay deletePropertySale (sólo cancel) | ✅ flujo venta | ✅ cancel | 🟡 cancel ≠ delete |
| 3 | `documents` | ✅ `db.saveDocumentWithBlob` | ✅ `db.get('documents')` + `getDocumentBlob` | 🟡 `db.put('documents')` (sólo metadata · sin UI editar) | ✅ `db.deleteDocumentAndBlob` · UI `InboxPage:248`, `InboxV3DocumentList`, `DocumentViewer`, `DocumentActions` | ✅ Inbox upload | 🟡 falta UI editar metadata · falta reprocesar OCR | ✅ |
| 4 | `contracts` | ✅ `contractService.saveContract` (1 caller UI · `documentIngestionService` indirect) | ✅ `getContract*` | ✅ `updateContract` (varios callers servicio) | 🟡 `deleteContract` exportado · **0 callers UI productivos** (sólo test mock) | ✅ wizard | ✅ wizard | ❌ **falta botón delete en `ContratosListPage`** |
| 5 | `aeatCarryForwards` | 🟡 `fiscalSummaryService` (add interno) | ✅ `db.getAll` | 🟡 `db.put` (interno) | ❌ no hay delete | ❌ derivado | ❌ derivado | ❌ derivado |
| 6 | `propertyDays` | ✅ `propertyOccupancyService.add` | ✅ getAll | ✅ `propertyOccupancyService.put` | ❌ no hay delete | ✅ derivado | ✅ derivado | ❌ no aplica (deriva de contratos) |
| 7 | ~~`propertyImprovements`~~ (FANTASMA · ver §A-fantasmas · alias del store real `mejorasInmueble`) | — | — | — | — | — | — | — |
| 8 | ~~`operacionesFiscales`~~ (FANTASMA · proxy a `gastosInmueble`) — `operacionFiscalService` opera realmente sobre store `gastosInmueble` (ver fila + `gastosInmueble`) | — | — | — | — | — | — | — |
| 9 | `proveedores` | ✅ `declaracionDistributorService` (add) | ✅ getAll | ✅ `db.put` (en distributor) | ❌ no hay deleteProveedor · `providerDirectoryService` no expone delete | ✅ inferencia OCR | ❌ falta UI editar | ❌ falta UI delete |
| 10 | `accounts` | ✅ `treasuryApiService.createAccount` · UI `AccountFormModal` | ✅ getAll/get | ✅ `updateAccount` | ✅ `deleteAccount` con cascade · UI `TesoreriaV4`, `AtlasBancosManagement`, `BancosManagement`, `CuentasManagement` (Trash2 visible) | ✅ | ✅ | ✅ |
| 11 | `movements` | ✅ `bankStatementOrchestrator.add` · `enhancedTreasuryCreationService.add` | ✅ getAll · get | ✅ `db.put` (varios servicios) + UI conciliación `EditMovementModal` | ✅ `db.delete` (interno cascade) + UI conciliación delete + UI `DayMovementsModal` (Trash2) + `MovementRow` (Trash2) | ✅ derivado import | 🟡 sólo en conciliación v2 | 🟡 sólo conciliación v2 + cascade · **falta delete individual desde `TesoreriaV4` lista** |
| 12 | `importBatches` | ✅ `treasuryApiService.add` | ✅ get | ✅ `bankStatementOrchestrator.put` | ✅ `bankStatementOrchestrator.delete` (cascade) | ✅ derivado | ❌ N/A | 🟡 sólo cascade |
| 13 | `treasuryEvents` | ✅ `bankStatementOrchestrator.add` · `treasuryTransferService.add` | ✅ get/getAll | ✅ `treasuryConfirmationService.updateTreasuryEventFields` · `update*` | ✅ `deleteTreasuryEventCompletely` · UI `ConciliacionPageV2:188` + `LineasAnualesTab:428` | ✅ derivado | ✅ conciliación | ✅ conciliación |
| 14 | ~~`fiscalSummaries`~~ (FANTASMA · sin `createObjectStore` · ver §A-fantasmas) | — | — | — | — | — | — | — |
| 15 | ~~`gastos`~~ (FANTASMA H10 Treasury · sin `createObjectStore` · ver §A-fantasmas · NO confundir con `gastosInmueble` real) | — | — | — | — | — | — | — |
| 16 | `presupuestos` | ✅ `presupuestoService.crearPresupuesto` · UI `PresupuestoNuevo` | ✅ getAll | ✅ `actualizarPresupuesto` | ✅ `deletePresupuesto` · UI `BudgetList` (Trash2) | ✅ | ✅ | ✅ |
| 17 | `presupuestoLineas` | ✅ `presupuestoService.crearLinea` | ✅ get | ✅ `actualizarLinea` | ✅ `deletePresupuestoLinea` · UI `BudgetTableEditor`, `WizardStepConfiguracion`, `PresupuestoTablaLineas`, `PresupuestoNuevo:154` | ✅ | ✅ | ✅ |
| 18 | `movementLearningRules` | ✅ `movementLearningService.createOrUpdateRule` | ✅ getAll | ✅ idem | ❌ no hay deleteRule exportado · UI `ReglasAlertas` muestra Trash2 pero ese es de Reglas alertas (no de learningRules) | ✅ derivado | ✅ derivado | ❌ falta deleteRule |
| 19 | `inversiones` | ✅ `inversionesService.createPosicion` · UI `InversionesPage:122`, `InversionesGaleria:123` | ✅ getAll/get | ✅ `updatePosicion` · `addAportacion` · `updateAportacion` | ✅ `deletePosicion` (cascade treasuryEvents + valoraciones) · `deleteAportacion` · UI `PosicionDetailModal` (Pencil + Trash2), `PosicionCard` (Trash2) | ✅ | ✅ | ✅ |
| 20 | `personalData` | ✅ `personalOnboardingService.add` | ✅ get(1) singleton | ✅ `personalDataService.savePersonalData` (put) | ❌ no hay deletePersonalData (singleton) | ✅ | ✅ | — |
| 21 | `personalModuleConfig` | 🟡 derivado en upgrade · escritura interna | ✅ get(personalDataId) | 🟡 derivado | ❌ derivado | — | — | — |
| 22 | `ingresos` (V63 unificado) | ✅ split ⚠ · `nominaService.addCambioNomina` · `autonomoService` create · `otrosIngresosService.add` · `pensionService` (4 servicios sobre el mismo store) | ✅ getAll filtered | ✅ `nominaService.updateNomina` · `autonomoService.updateAutonomo` · `otrosIngresosService.updateIngreso` | ✅ `nominaService.deleteNomina` · `autonomoService.deleteAutonomo` · `otrosIngresosService.deleteIngreso` · `pensionService.deletePension` · UI `IngresosPage` (3 Pencil) + `TabIngresos:107` + `OtrosIngresosWizard:140` | ✅ | ✅ | ✅ ⚠ duplicidad por tipo (ver §C) |
| 23 | `planesPensiones` | ✅ `planesPensionesService.createPlan` | ✅ getAll/get | ✅ `updatePlan` · UI `PlanFormV5`, `PlanForm`, `ActualizarValorPlanDialog` | ✅ `planesPensionesService.delete*` (cascade aportacionesPlan + traspasosPlanPensiones + valoraciones_historicas) · UI `PlanesManager:328` (Trash2) · `GestionInversionesPage:531` | ✅ | ✅ | ✅ ⚠ wrapper en `planesInversionService` (ver §C) |
| 24 | `aportacionesPlan` | ✅ `aportacionesPlanService.add` | ✅ getAll | ✅ — (eventos · no se editan) | ✅ `aportacionesPlanService.delete` | ✅ via Excel + UI | ❌ N/A (eventos) | 🟡 cascade desde plan + delete individual |
| 25 | `traspasosPlanPensiones` (V65 nuevo) | ✅ `traspasosPlanPensionesService.add` | ✅ getAll | ❌ — (eventos) | ✅ `traspasosPlanPensionesService.delete` | 🟡 sin UI productiva V65 detectada | ❌ | 🟡 falta UI |
| 26 | ~~`traspasosPlanes`~~ (STORE ELIMINADO V65 · ver §A-fantasmas) | ⚠ servicio escribe a store inexistente | ⚠ idem | ❌ — | ⚠ idem | ✅ UI `TraspasosHistorial` Trash2 visible · pero apunta a servicio roto | ❌ | ⚠ **GAP URGENTE** ver §D #0 |
| 27 | `prestamos` | ✅ `prestamosService.createPrestamo` · UI `PrestamosWizard` | ✅ getAll/get | ✅ `updatePrestamo` · UI `PrestamosWizard:255` | ✅ `deletePrestamo` · UI 4 callers (`PrestamosList:417` Trash2, `DetallePage:109`, `PrestamoDetailPage:220`, `HeaderSection:112` Trash2) | ✅ | ✅ | ✅ |
| 28 | `valoraciones_historicas` | ✅ `valoracionesService.guardarValoracionActivo` · `guardarValoracionesMensual` | ✅ getAll · getEvolucion | ✅ `db.put` interno | 🟡 cascade desde `inversionesService.deletePosicion` (interno · `db.delete('valoraciones_historicas')`) · NO hay `deleteValoracion` exportado · UI sin botón delete por valoración | ✅ UI `ActualizacionValoresDrawer` | ✅ UI dialog | 🟡 falta **rectificar/borrar valoración individual** |
| 29 | `keyval` | — config | — | — | — | — | — | — |
| 30 | ~~`objetivos_financieros`~~ (FANTASMA · `deleteObjectStore` V5.9 · sólo tipo en interfaz para compilar · ver §A-fantasmas) | — | — | — | — | — | — | — |
| 31 | `resultadosEjercicio` | 🟡 lifecycle interno | ✅ get | ❌ inmutable (snapshot anual) | 🟡 `fiscalHistoryService.delete` (cascade desde año fiscal · UI `HistoricoPage:171` "Eliminar importación") | ❌ derivado | — inmutable | ✅ vía cascade |
| 32 | `arrastresIRPF` | 🟡 lifecycle | ✅ get | ❌ inmutable | 🟡 cascade `fiscalHistoryService` | ❌ | — | ✅ cascade |
| 33 | `perdidasPatrimonialesAhorro` | ✅ `compensacionAhorroService.add` | ✅ getAll | ✅ `db.put` | ❌ no hay deletePerdida exportado · UI sin botón | 🟡 derivado | 🟡 derivado | ❌ falta delete |
| 34 | `snapshotsDeclaracion` | ✅ `snapshotDeclaracionService.add` | ✅ get | ❌ inmutable | ✅ cascade `fiscalHistoryService:115` (UI `HistoricoPage` Trash2) | ✅ vía wizard | — inmutable | ✅ cascade |
| 35 | `entidadesAtribucion` | ✅ `entidadAtribucionService.add` | ✅ getAll | ✅ `update`/`put` | ❌ no hay deleteEntidad exportado | ✅ UI fiscal | ✅ | ❌ falta delete |
| 36 | `ejerciciosFiscalesCoord` | ✅ `ejercicioResolverService.crear` | ✅ getAll | ✅ `db.put` (lifecycle) | ✅ `db.delete` (lifecycle reset · líneas 332+418) | ✅ derivado | ✅ derivado | 🟡 sólo desde lifecycle (no UI directa) |
| 37 | `vinculosAccesorio` | ✅ `declaracionDistributorService.add` | ✅ getAll | ❌ no hay update | ❌ no hay delete | ✅ derivado import declaración | ❌ falta | ❌ falta |
| 38 | `compromisosRecurrentes` | ✅ `compromisoCreationService.createCompromisosFromCandidatos` | ✅ getAll | 🟡 sólo migraciones internas (`v68-tipoFamilia`, `cleanupCategoriasT34T35fix2`) usan put | ❌ no hay deleteCompromiso exportado · UI inexistente para borrar compromiso | 🟡 detección automática + UI deficiente | ❌ falta UI editar compromiso | ❌ **falta UI listar/editar/borrar compromisos** |
| 39 | `viviendaHabitual` | ✅ `viviendaHabitualService` (presumido por UI) | ✅ getAll | ✅ via UI `ViviendaPage` | 🟡 UI `ViviendaPage:450` muestra "Eliminar vivienda" pero el servicio no expone deleteVivienda público (botón cableado al estado o reset) | ✅ | ✅ | 🟡 botón existe · backend dudoso |
| 40 | `escenarios` | ✅ singleton via `escenariosService.saveEscenarioActivo` | ✅ get(1) | ✅ `saveEscenarioActivo` | ❌ singleton · no se borra (reset funcional vía `saveEscenarioActivo` con defaults) | ✅ | ✅ | — singleton |
| 41 | `objetivos` | ✅ `objetivosService.createObjetivo` | ✅ getAll | ✅ `updateObjetivo` | ✅ `deleteObjetivo` | ✅ wizards Mi Plan | ✅ | 🟡 servicio existe · UI delete a verificar (no aparece Trash2 explícito en grep MiPlanPage) |
| 42 | `fondos_ahorro` | ✅ `fondosService.createFondo` | ✅ getAll/get | ✅ `updateFondo` | ❌ NO hay `deleteFondo` exportado (el comentario línea 7 menciona "deleteFondo limpia el objetivo.fondoId antes de borrar" pero la función NO está exportada) | ✅ wizard | ✅ | ❌ **falta deleteFondo + UI** |
| 43 | `retos` | ✅ `retosService.createReto` | ✅ getAll/get | ✅ `updateReto` | ✅ `retosService.deleteReto` | ✅ | ✅ | 🟡 servicio existe · UI delete a verificar |
| + | `gastosInmueble` | ✅ `gastosInmuebleService.add` | ✅ getAll/getByInmueble | ✅ `update` | ✅ `delete` · `deleteByOrigenId` · UI `InmueblePresupuestoTab:754` (Trash2) | ✅ | ✅ | ✅ |
| + | `mejorasInmueble` | ✅ `mejorasInmuebleService.add` | ✅ get | 🟡 sin update detectado · UI `PropertyImprovements:205` "Editar" sin caller backend confirmado | ❌ no hay deleteMejora exportado | ✅ | 🟡 botón sin caller backend confirmado | ❌ falta delete |
| + | `mueblesInmueble` | ✅ `mueblesInmuebleService.add` | ✅ get | ❌ no detectado | ❌ no detectado | ✅ | ❌ | ❌ |

**Subtotales corregidos · sólo 40 stores reales** (filas FANTASMA excluidas del recuento) ·

- ✅ **completas estrictas** (CRUD service + Create UI + Edit UI + Delete UI · todas ✅) · **8** · `accounts` · `presupuestos` · `presupuestoLineas` · `inversiones` · `planesPensiones` · `prestamos` · `gastosInmueble` · `treasuryEvents`.
- 🟢 **completas con matiz** (al menos 1 celda 🟡 derivado/cascade pero funcionalmente CRUD-cerrado) · **5** · `documents` (UI editar metadata falta) · `personalData` (singleton) · `escenarios` (singleton) · `aportacionesPlan` (eventos · update N/A) · `ingresos` (CRUD ✅ pero ⚠ duplicidad C3 por tipo).
- 🟡 **servicio existe · UI incompleta** · **8** · `contracts` (deleteContract sin UI) · `movements` (delete fuera conciliación) · `proveedores` (sin UI editar/delete) · `valoraciones_historicas` (sin delete individual) · `viviendaHabitual` (botón sin backend) · `objetivos` (UI delete a verificar) · `retos` (UI delete a verificar) · `perdidasPatrimonialesAhorro` (sin UI delete).
- ❌ **servicio falta** (delete y/o update no existen) · **6** · `aeatCarryForwards` · `vinculosAccesorio` · `compromisosRecurrentes` (sin delete) · `entidadesAtribucion` (sin delete) · `fondos_ahorro` (sin delete) · `mejorasInmueble` + `mueblesInmueble` (sin update + sin delete · cuentan como 2 → ajusto a **7** total).
- ⚠ **gap urgente · servicio apunta a store eliminado** · **1** · `traspasosPlanes` (ver §A-fantasmas + §D #0).
- — **derivados/lifecycle/inmutables/config** · **5** reales · `resultadosEjercicio` · `arrastresIRPF` · `snapshotsDeclaracion` · `ejerciciosFiscalesCoord` · `keyval` + `personalModuleConfig` (derivado · 6 total).

**Verificación** · 8 + 5 + 8 + 7 + 1 + 6 = **35 entidades** · faltan 5 reales para llegar a 40 · son `properties` (✅ con matiz inmuebleService HTTP fantasma · gap dedicado §D #3) · `property_sales` (✅ con matiz cancel ≠ delete · gap §D #10) · `traspasosPlanPensiones` (✅ servicio · UI faltante · gap §D ya implícito) · `movementLearningRules` (✅ sin delete · gap §D #16) · `propertyDays` (— derivado de contratos · esencialmente lifecycle). 35 + 5 = **40** ✅.

**Filas FANTASMA EXCLUIDAS del recuento** · `propertyImprovements` · `operacionesFiscales` · `fiscalSummaries` · `gastos` (H10) · `objetivos_financieros` · `traspasosPlanes` (apuntado por servicio → cuenta para gap urgente, no para inventario CRUD).

- ⚠ **duplicidades** · **3** (ver §C · planes pensión wrapper · ingresos fragmentado · traspasos legacy ↔ V65).

---

## §C · Duplicidades CRUD detectadas (regla V11.3 · 5 preguntas)

### C1 · `planesInversionService` wrapper sobre `planesPensionesService`

| Pregunta V11.3 | Respuesta |
|---|---|
| 1·¿Existe? | Sí · ambas |
| 2·¿Cuántas implementaciones? | **2** · `planesPensionesService` (canónico backend) + `planesInversionService` (fachada que reenvía) |
| 3·¿Vivas? | Las 2 · `planesInversionService.updatePlan` línea 32 hace `return planesPensionesService.updatePlan(...)`. Vivos · `GestionInversionesPage:1128`, `IndexaCapitalImportService:402`, `traspasosPlanesService:112` etc. |
| 4·Canónica · legacy | Canónica · `planesPensionesService`. Wrapper `planesInversionService` · semántica de dominio "inversión" sobre el mismo store · **NO es legacy estricta** sino indirección activa. |
| 5·Dead code residual | Wrapper no es dead code · pero sembrar confusión nominal (singular vs plural · pensiones vs inversion) ya señalado en T-PROYECCION-AUDIT y T-INACEPTABILIDADES E11. |

**Acción propuesta** · documentar en `services/planesInversionService.ts` cabecera por qué existe (semántica · NO duplicidad real) · evaluar si renombrar a `planesInversionFacadeService.ts` · spec saneamiento opcional fuera scope CRUD.

### C2 · `traspasosPlanes` (legacy V5.2 · STORE ELIMINADO V65) vs `traspasosPlanPensiones` (V65)

> **CORRECCIÓN POST-REVISIÓN** · primera versión describió `traspasosPlanes` como "store activo legacy". Realidad · el store fue **eliminado** en migración V65 (`db.ts:4027 deleteObjectStore('traspasosPlanes')`). Verificación contra DevTools de Jose confirma que NO existe en DB v70.

| Pregunta V11.3 | Respuesta corregida |
|---|---|
| 1·¿Existe el store? | **NO en DB v70** · sólo el TIPO en interfaz `AtlasHorizonDB` para que compile el servicio legacy. |
| 2·¿Cuántas implementaciones servicio? | **2** · `traspasosPlanesService.ts` (legacy · apunta a store inexistente · operaciones `db.add('traspasosPlanes')` líneas 294, `db.getAll('traspasosPlanes')` línea 326, `db.delete('traspasosPlanes', id)` línea 357) + `traspasosPlanPensionesService.ts` (V65 nuevo · sobre store real `traspasosPlanPensiones`). |
| 3·¿Vivas? | Legacy · 4 callers UI según comentario `db.ts:2148-2154` (`PlanesManager` · `TraspasoForm` · `TraspasosHistorial` · `GestionInversionesPage`) · pero como el store no existe → escrituras lanzan error o silently fallan dependiendo del wrapper. V65 nuevo servicio existe · 0 callers UI productivos detectados. |
| 4·Canónica · legacy | **Canónica** · `traspasosPlanPensiones` + `traspasosPlanPensionesService` (V65). **Roto** · `traspasosPlanes` + `traspasosPlanesService` (escribe a store inexistente). |
| 5·Dead code residual | El store fue eliminado pero el servicio y los 4 callers UI siguen vivos · es un caso típico V11.4 · "interfaz miente" + "componentes huérfanos referenciando schema obsoleto". |

**Acción propuesta** · **URGENTE** · spec **T27-pre** ya identificado · debe ·
1. Auditar si los 4 callers UI realmente fallan en runtime (test manual o telemetry).
2. Si fallan · cablear los 4 callers a `traspasosPlanPensionesService` (V65 nuevo).
3. Si la migración V65 efectivamente preservó los datos antes del `deleteObjectStore` · verificar que los traspasos históricos están en `traspasosPlanPensiones`.
4. Eliminar `traspasosPlanesService.ts` y la entrada `traspasosPlanes` de la interfaz TypeScript.

### C3 · `ingresos` con 4 servicios fragmentados (`nomina` · `autonomo` · `otros` · `pension`)

| Pregunta V11.3 | Respuesta |
|---|---|
| 1·¿Existe? | Sí · 4 servicios + 1 store unificado |
| 2·¿Cuántas implementaciones? | **4** · `nominaService` · `autonomoService` · `otrosIngresosService` · `pensionService` operan los 4 sobre el mismo store `ingresos` (V63 unificado · `tipo` discriminator). |
| 3·¿Vivas? | Las 4 · `IngresosPage.tsx` muestra 3 tablas (3× Pencil) · `TabIngresos:107` invoca `nominaService.deleteNomina` · `OtrosIngresosWizard:140` invoca `otrosIngresosService.deleteIngreso` · `AutonomoWizard:328` invoca `autonomoService.updateAutonomo`. |
| 4·Canónica · legacy | **No hay canónica unificada** · cada tipo tiene su servicio. **Decisión Jose** · mantener fragmentación por tipo (semántica clara por dominio) o consolidar a `ingresosService` único discriminado por `tipo`. |
| 5·Dead code residual | Posible · `dashboardService.ts:919/1339/1612` tiene comentario `// store deleted in V44` con array vacío hardcoded · resto antiguo NO limpiado. |

**Acción propuesta** · NO consolidar (semántica clara por tipo es valiosa) · documentar en cabecera de cada uno de los 4 servicios "comparten store `ingresos` discriminado por `tipo`" · limpiar restos de `// store deleted in V44` en `dashboardService.ts`.

### C-bis · Duplicidades fuera scope CRUD (informativas)

- **OCR services x3** · `ocrService` + `enhancedOcrService` + `unifiedOcrService` · ya catalogada en T-INACEPTABILIDADES §E1 · NO se repite aquí.
- **Treasury services x9** · `treasuryApiService` + `treasuryBootstrapService` + `treasuryConfirmationService` + `treasuryCreationService` + `treasuryEventsService` + `treasuryForecastService` + `treasuryOverviewService` + `treasuryTransferService` + `treasuryValidationService` + `enhancedTreasuryCreationService` + `historicalTreasuryService` · granularidad legítima por capa (api · bootstrap · confirmation · etc.) · spec saneamiento dedicado dominio Treasury fuera scope.
- **Fiscal services >30** · ya señalado en T-INACEPTABILIDADES §E15 · fuera scope.

---

## §D · Veredicto · prioridad de gaps · ranking

Tabla con **TODOS los gaps detectados** · ordenados por prioridad y dentro de prioridad por coste de implementación (botón > servicio parcial > construir desde cero).

### 🔴 Prioridad URGENTE (descubierto post-revisión Jose 2026-05-09)

| # | Gap | Tipo | Justificación |
|---|---|---|---|
| **0** | **`traspasosPlanesService` apunta a store eliminado V65** | Verificación + migración + retirada · 3-5h CC | Comentario `db.ts:2148-2154` afirma que 4 callers UI vivos siguen usando este servicio. El `deleteObjectStore('traspasosPlanes')` ocurre en línea 4027 (V65). DB de Jose en v70. Si los 4 callers escriben/leen → fallo silencioso o pérdida de datos. **Verificación 1ª** · ¿están en `traspasosPlanPensiones` los traspasos históricos? **Verificación 2ª** · ¿qué hace runtime cuando `traspasosPlanesService.add` se invoca con store inexistente? **Acción** · cablear los 4 callers UI al servicio V65 + retirar `traspasosPlanesService` + limpiar tipo en interfaz. |

### 🔴 Prioridad ALTA (entidades dogfooder usa hoy)

| # | Gap | Tipo | Justificación |
|---|---|---|---|
| 1 | **Contratos · botón eliminar en `ContratosListPage`** | Solo botón falta · 30-60min CC | `deleteContract` exportado · 0 callers UI · Jose dogfooder no puede borrar contrato erróneo importado. Ya señalado en T-INACEPTABILIDADES. |
| 2 | **Movements · delete individual en `TesoreriaV4` lista** | Solo botón falta · 1-2h CC | `db.delete('movements')` interno existe · UI conciliación v2 lo expone pero `TesoreriaV4` (página principal Tesorería) no. Si Jose importó un movement erróneo de un extracto, no lo puede borrar fuera de conciliación. |
| 3 | **Inmuebles · `deleteInmueble` IDB local con cascada** | Servicio + UI · 3-5h CC | `inmuebleService.delete()` actualmente es HTTP-remote sin caller productivo (resto de antiguo backend). Falta delete local IndexedDB que cascade a contratos · gastos · valoraciones · property_sales. |
| 4 | **Documents · UI editar metadata + reprocesar OCR** | Servicio + UI · 2-4h CC | `db.put('documents')` existe · sin UI editar metadata. `reprocessOCR` no existe · si el OCR falló sólo se puede borrar y resubir. |
| 5 | **Compromisos recurrentes · UI listar/editar/borrar** | Construir desde cero · 4-6h CC | `compromisosRecurrentes` se crea automáticamente vía detección · NO hay UI para listar/editar/borrar compromisos. Si la detección clasifica mal · no hay corrección. |
| 6 | **Valoraciones individuales · rectificar/borrar** | Servicio + UI · 1-2h CC | `valoracionesService` no expone `deleteValoracion` ni `updateValoracion`. Si Jose actualiza un valor erróneo en Drawer, no lo puede revertir más allá de sobreescribir el siguiente mes. |
| 7 | **`viviendaHabitual` · verificar backend del botón "Eliminar vivienda"** | Verificación + posible servicio · 30min-1h CC | UI `ViviendaPage:450` muestra texto "Eliminar vivienda" · grep no encuentra `deleteVivienda` ni `removeVivienda` ni `db.delete('viviendaHabitual')` productivo · botón posiblemente no funciona o resetea por put con defaults. |
| 8 | **Mejoras inmueble · update + delete service + UI** | Servicio + UI · 2-3h CC | UI `PropertyImprovements:205` muestra "Editar" pero `mejorasInmuebleService` no expone `update` ni `delete` (solo `add` + `get`). Mismo gap para `mueblesInmueble`. |
| 9 | **Proveedores · UI editar + delete** | Servicio + UI · 2-3h CC | Catálogo crece automáticamente vía OCR · sin UI para editar (corregir nombre erróneo) ni borrar (limpiar duplicados por NIF mal extraído). |
| 10 | **Property sales · delete vs cancel** | Decisión + posible servicio · 1-2h CC | `cancelPropertySale` revierte la venta · NO hay `deletePropertySale` para eliminar el registro. Decisión · ¿cancelar = soft-delete (propuesto) o añadir hard-delete? |

### 🟠 Prioridad MEDIA (entidades usadas pero menos críticas)

| # | Gap | Tipo | Justificación |
|---|---|---|---|
| 11 | **Fondos ahorro · `deleteFondo` service + UI** | Servicio + UI · 2-3h CC | `fondosService` no exporta `deleteFondo` (cabecera línea 7 lo menciona "limpia el objetivo.fondoId antes de borrar" pero la función no aparece). |
| 12 | **Objetivos · UI delete (verificar Trash2)** | Solo botón falta · 30-60min CC | `deleteObjetivo` exportado · UI `MiPlanPage` no muestra Trash2 explícito en grep · verificar y cablear. |
| 13 | **Retos · UI delete (verificar Trash2)** | Solo botón falta · 30-60min CC | `deleteReto` exportado · idem objetivos · verificar UI. |
| 14 | **Entidades atribución · delete** | Servicio + UI · 1-2h CC | Listar y borrar entidades obsoletas. |
| 15 | **Pérdidas patrimoniales ahorro · delete** | Servicio + UI · 1-2h CC | Sin `deletePerdida` · si se importa con error, atrapado. |
| 16 | **Movement learning rules · delete** | Servicio + UI · 1-2h CC | Sin `deleteRule` · si una regla aprendida es errónea, no se puede borrar (sólo desactivar updateando). |
| 17 | **Vínculos accesorio · update + delete** | Servicio + UI · 1-2h CC | Sólo add. Si una vinculación parking-vivienda principal es errónea, atrapada. |
| 18 | **Traspasos planes · migración legacy → V65** | Saneamiento (T27-pre identificado) · 4-6h CC | UI legacy en 4 sitios apunta a `traspasosPlanes` · servicio V65 nuevo `traspasosPlanPensiones` sin UI. Spec separado por dominio. |

### 🟢 Prioridad BAJA (entidades raras o derivadas)

| # | Gap | Tipo | Justificación |
|---|---|---|---|
| 19 | **Aeat carry forwards · UI gestión** | Mejora UX · opcional | Derivado lifecycle · raramente requiere intervención manual. |
| 20 | **Property days · UI ver/editar** | Mejora UX · opcional | Derivado de contratos. |
| 21 | **Fiscal summaries · UI editar** | Mejora UX · opcional | Derivado lifecycle. |
| 22 | **`gastos` (H10 Treasury) delete** | Verificar uso real · puede ser dead store | Diferenciar de `gastosInmueble` · grep no muestra UI productiva. |
| 23 | **`personalModuleConfig` · UI ajustar flags** | Opcional | Hardcoded mayormente · raro tocar. |

### Saneamiento de duplicidades (specs separados · NO mezclar con D-CRUD)

| # | Duplicidad | Tipo | Coste |
|---|---|---|---|
| S1 | C2 traspasosPlanes legacy → V65 | Migración (T27-pre) | 4-6h CC |
| S2 | C1 wrapper `planesInversionService` | Documentación + posible rename | 1-2h CC |
| S3 | C3 fragmentación `ingresos` 4 servicios | Documentación cabecera + limpieza dashboardService comentarios stale | 1-2h CC |

---

## §F · Plan de specs propuesto

Basado en §D · 4 specs separados ·

| Spec | Alcance | Estimación |
|---|---|---|
| **D-CRUD-ALTA** | 10 gaps prioridad ALTA (#1-#10) | **9-15h CC** |
| **D-CRUD-MEDIA** | 8 gaps prioridad MEDIA (#11-#18) | **6-10h CC** |
| **D-CRUD-BAJA** (opcional) | 5 gaps BAJA (#19-#23) | **3-5h CC** (postergable) |
| **S-PLANES-V65-MIGRATION** | C2 traspasos legacy → V65 (T27-pre) | **4-6h CC** |
| **S-DOCS-DUPLIC** | C1 wrapper docs + C3 ingresos docs + dashboardService stale | **1-3h CC** |

**Total D-CRUD-COMPLETAR** (sin saneamiento) · **18-30h CC**.
**Total saneamiento** (S-PLANES + S-DOCS) · **5-9h CC**.
**Gran total** · **23-39h CC** (si se ejecuta todo).

---

## §G · Notas para HANDOFF V11

- **Regla V11.4 funcionó** · sin lista cerrada CC descubrió 43 stores + 3 stores `(db as any)` · 4 entidades adicionales no contempladas en T-INACEPTABILIDADES (`compromisosRecurrentes` · `viviendaHabitual` · `mejorasInmueble`/`mueblesInmueble` · `valoraciones_historicas`).
- **Patrón sistémico confirmado** · 11 servicios tienen `delete*` exportado pero 0 callers UI productivos. Misma forma de gap que `deleteContract` señalada en T-INACEPTABILIDADES.
- **Patrón nuevo detectado** · varias entidades tienen UI Trash2 visible pero el servicio no expone `delete*` público (UI cableada vía cascade interna o vía estado React local). Riesgo · si la UI falla silenciosamente · datos atrapados.

---

**Fin del informe.**
