# Stores activos V60 · arquitectura post-TAREA 7

> DB_VERSION: 64  
> Total stores: 39  
> Última actualización: 2026-04-26

---

## Resumen ejecutivo

ATLAS gestiona 39 stores en IndexedDB tras la limpieza V60 ejecutada en TAREA 7. El modelo se redujo de 59 a 39 stores eliminando duplicados, fósiles y conceptos mal modelados. Esta documentación describe el propósito, escritores, lectores y estado de cada store.

### Estado actual · resumen

- Stores con uso confirmado y propósito correcto: 35
- Stores con problemas conocidos pendientes (TAREAS 13-16): 4
  - `inversiones` · doble escritura planes pensiones (TAREA 13)
  - `planesPensionInversion` · zombie funcional (TAREA 13)
  - `keyval` · saneado post-T15 · catálogo canónico en `docs/AUDIT-T15-keyval.md` + JSDoc `services/db.ts`
  - `movementLearningRules` · verificación uso pendiente (TAREA 16)

### Cambios respecto V59 (TAREA 7 ejecutada)

| Acción | Cantidad |
|---|---:|
| Stores eliminados | 19 |
| Stores renombrados | 1 (`nominas` → `ingresos`) |
| Stores con schema ampliado | 9 |
| Stores con funcionalidad absorbida | 10 |

La tabla detallada de cambios está al final del documento (§C).

---

## Stores ordenados por dominio

Los dominios agrupan los 39 stores activos. El listado alfabético completo está en §A.

### Inmuebles físicos (6)

#### properties
**Propósito:** Entidad central de cada inmueble físico: datos catastrales, fiscales, estado, compra y vinculaciones.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- inmuebleService
- declaracionOnboardingService
- propertySaleService

**Lectores principales:**
- dashboardService
- fiscalSummaryService
- treasuryOverviewService
- múltiples servicios de inmuebles/fiscalidad

**Datos clave en producción:** 8 inmuebles en snapshot Jose.

#### propertyDays
**Propósito:** Días fiscales por inmueble y año: alquilado, vacante, obras y disposición del propietario. Determina prorrateos fiscales de ingresos, gastos y amortización.

**Estado:** ✅ USO CONFIRMADO · vacío en producción (cálculo/registro automático o manual al cierre fiscal)

**Escritores principales:**
- propertyOccupancyService

**Lectores principales:**
- propertyOccupancyService
- irpfCalculationService
- aeatAmortizationService

**Datos clave en producción:** 0 registros; vacío válido si no se han registrado días manuales.

#### mejorasInmueble
**Propósito:** CAPEX amortizable de inmuebles: obras/mejoras que aumentan el valor y se amortizan fiscalmente.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- mejorasInmuebleService
- treasuryConfirmationService

**Lectores principales:**
- mejorasInmuebleService
- treasuryOverviewService
- navigationPerformanceService

**Datos clave en producción:** 4 registros.

#### mueblesInmueble
**Propósito:** Mobiliario amortizable asociado a inmuebles, incluido tratamiento fiscal de casilla AEAT 0117.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- mueblesInmuebleService
- treasuryConfirmationService

**Lectores principales:**
- mueblesInmuebleService
- navigationPerformanceService

**Datos clave en producción:** 5 registros.

#### vinculosAccesorio
**Propósito:** Vínculo temporal año-a-año entre inmueble principal y accesorios con referencia catastral propia (trastero, garaje).

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- vinculacionFiscalService

**Lectores principales:**
- vinculacionFiscalService
- irpfCalculationService

**Datos clave en producción:** 4 vínculos activos detectados.

#### property_sales
**Propósito:** Ventas de inmuebles: plusvalía, gastos de venta, estado de venta y cancelación de financiación asociada.

**Estado:** ✅ USO CONFIRMADO · vacío válido (sin ventas registradas)

**Escritores principales:**
- propertySaleService

**Lectores principales:**
- propertySaleService
- treasuryOverviewService

**Datos clave en producción:** 0 registros; vacío esperado si no hay ventas.

### Cuentas y activos financieros (4)

#### accounts
**Propósito:** Cuentas bancarias: origen/destino de movimientos y saldos. El campo balance funciona como cache derivada.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- cuentasService
- treasuryApiService
- demoDataCleanupService

**Lectores principales:**
- treasuryOverviewService
- treasurySyncService
- accountBalanceService
- dashboardService
- navigationPerformanceService

**Datos clave en producción:** 8 cuentas.

#### inversiones
**Propósito:** Activos financieros NO inmobiliarios: acciones, fondos, crypto, crowdfunding y P2P.

**Estado:** ⚠ PROBLEMA CONOCIDO · pendiente TAREA 13


**Problema:** Contiene también planes de pensiones (`tipo='plan_pensiones'`) escritos manualmente desde UI. Mientras, los planes de pensiones del XML AEAT pueden escribirse en `planesPensionInversion`. Esto produce doble escritura del mismo concepto en 2 stores distintos según vía de entrada.

**Caso real detectado:** Trayectoria de plan de pensiones que cambia de gestora a lo largo del tiempo (ING 2016 → Indexa 2021 → MyInvestor 2025) no encaja como 3 inversiones separadas; es 1 plan con identidad estable y 3 traspasos.

**Solución pendiente:** TAREA 13 diseñará módulo dedicado de planes de pensiones. Hasta entonces, mantener el comportamiento actual.

**Escritores principales:**
- inversionesService
- indexaCapitalImportService
- declaracionDistributorService

**Lectores principales:**
- valoracionesService
- inversionesService
- treasuryOverviewService
- dashboardService

**Datos clave en producción:** 12 registros; incluye 2 con tipo=plan_pensiones según especificación de cierre.

#### planesPensionInversion
**Propósito:** Planes de pensiones como activo financiero: valor liquidativo, aportaciones y revalorización. No es lo mismo que ingresos.tipo=pension, que representa cobro de pensión.

**Estado:** ⚠ ZOMBIE FUNCIONAL · pendiente TAREA 13


**Problema:** Vacío en producción. Los planes de pensiones se escriben de hecho en `inversiones`. Solo se llenaría al importar XML AEAT con planes declarados, pero la UI no consume este store como fuente principal.

**Solución pendiente:** TAREA 13 fusionará/rediseñará el modelo en un módulo dedicado. Hasta entonces, no escribir desde código nuevo y no leer desde UI nueva.

**Escritores principales:**
- planesInversionService
- valoracionesService
- declaracionDistributorService
- migraciones DB

**Lectores principales:**
- planesInversionService
- valoracionesService
- traspasosPlanesService
- inversionesService
- declaracionDistributorService

**Datos clave en producción:** 0 registros; los planes se escriben de hecho en inversiones.

#### traspasosPlanes
**Propósito:** Eventos de traspaso fiscalmente neutro entre planes de pensiones; representan cambios de gestora o vehículo sin romper la identidad económica del plan.

**Estado:** ✅ USO CONFIRMADO · condicionado por TAREA 13

**Escritores principales:**
- traspasosPlanesService

**Lectores principales:**
- traspasosPlanesService

**Datos clave en producción:** 0 registros; vacío válido, pero su referencia dual a inversiones/planesPensionInversion queda pendiente de resolver en TAREA 13.

### Ingresos (1)

#### ingresos
**Propósito:** Todos los ingresos personales del titular o pareja, discriminados por tipo: nomina, autonomo, desempleo, pension u otro.

**Estado:** ✅ USO CONFIRMADO · creado en V61 fusionando nominas + autonomos + pensiones + otrosIngresos

**Escritores principales:**
- treasuryCreationService
- enhancedTreasuryCreationService
- migración V63

**Lectores principales:**
- fiscalSummaryService
- irpfCalculationService
- personalResumenService
- fiscalConciliationService

**Datos clave en producción:** No existe en snapshot v59; datos migrados en DB v64.

### Compromisos salientes (2)

#### prestamos
**Propósito:** Toda la deuda: hipotecas, préstamos personales y pólizas. Incluye campo liquidacion añadido en sub-tarea 1 absorbiendo loan_settlements.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- prestamosService
- loanSettlementService
- propertySaleService

**Lectores principales:**
- prestamosService
- historicalCashflowCalculator
- reconciliacionService
- objetivosService

**Datos clave en producción:** 13 préstamos.

#### compromisosRecurrentes
**Propósito:** Plantillas de gastos recurrentes que generan eventos de tesorería; unifica ámbito inmueble/personal mediante ambito. Absorbió opexRules y patronGastosPersonales.

**Estado:** ✅ USO CONFIRMADO · vacío válido en snapshot

**Escritores principales:**
- compromisosRecurrentesService
- migraciones V5.3/V5.4
- propertySaleService

**Lectores principales:**
- compromisosRecurrentesService
- propertyExpenses
- opexService
- operacionFiscalService

**Datos clave en producción:** 0 registros; puede depender de migraciones/uso posterior.

### Operación presente y pasado (4)

#### treasuryEvents
**Propósito:** Eventos previstos o confirmados de tesorería: fuente de verdad del presente y futuro financiero operativo.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- treasuryEventsService
- treasuryCreationService
- enhancedTreasuryCreationService
- compromisosRecurrentesService

**Lectores principales:**
- treasuryEventsService
- treasuryOverviewService
- historicalTreasuryService
- treasuryForecastService

**Datos clave en producción:** 13 registros.

#### movements
**Propósito:** Movimientos bancarios reales importados de extractos o creados por flujos de cuenta; fuente de verdad transaccional.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- bankStatementImportService
- enhancedBankStatementImportService
- cuentasService
- movementLearningService
- budgetReclassificationService

**Lectores principales:**
- bankStatementImportService
- treasuryEventsService
- movementLearningService
- enhancedDeduplicationService

**Datos clave en producción:** 6 movimientos.

#### gastosInmueble
**Propósito:** Gastos por inmueble con trazabilidad fiscal y operativa: XML AEAT, movimiento, evento de tesorería u origen manual.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- gastosInmuebleService
- treasuryConfirmationService
- aeatParserService

**Lectores principales:**
- gastosInmuebleService
- gananciaPatrimonialService
- historicalTreasuryService
- treasuryOverviewService

**Datos clave en producción:** 109 registros; uso intensivo.

#### contracts
**Propósito:** Contratos de alquiler vinculados a inmuebles. Campo historicoRentas[] añadido en sub-tarea 1 para absorber histórico de renta.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- contractService
- documentIngestionService
- declaracionDistributorService

**Lectores principales:**
- fiscalSummaryService
- irpfCalculationService
- treasuryOverviewService
- propertyOccupancyService
- historicalCashflowCalculator

**Datos clave en producción:** 6 contratos.

### Fiscal (6)

#### ejerciciosFiscalesCoord
**Propósito:** Coordinador del ciclo fiscal por año: estado, workflow, importaciones AEAT y orquestación de cálculos.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- ejercicioResolverService

**Lectores principales:**
- ejercicioResolverService
- accountMigrationService
- backfillImporteBruto0106

**Datos clave en producción:** 5 ejercicios (2020-2024 inferidos por auditoría).

#### snapshotsDeclaracion
**Propósito:** Fotos inmutables del XML AEAT importado por ejercicio y origen.

**Estado:** ✅ USO CONFIRMADO · vacío hoy por bug/flujo pendiente

**Escritores principales:**
- snapshotDeclaracionService

**Lectores principales:**
- fiscalResolverService
- fiscalHistoryService
- snapshotDeclaracionService

**Datos clave en producción:** 0 registros; los datos están embebidos actualmente en ejerciciosFiscalesCoord.aeat. Arreglo previsto post-TAREA 7.

#### resultadosEjercicio
**Propósito:** Resumen mutable calculado del año fiscal tras el ciclo de paralelas/cálculo.

**Estado:** ✅ USO CONFIRMADO · vacío hoy por bug/flujo pendiente

**Escritores principales:**
- fiscalLifecycleService

**Lectores principales:**
- fiscalHistoryService

**Datos clave en producción:** 0 registros; datos equivalentes en ejerciciosFiscalesCoord.aeat.resumen hasta arreglo futuro.

#### arrastresIRPF
**Propósito:** Arrastres IRPF unificados: pérdidas patrimoniales y gastos pendientes con origen manual, AEAT o calculado.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- arrastresFiscalesService
- fiscalLifecycleService
- snapshotDeclaracionService

**Lectores principales:**
- arrastresFiscalesService
- fiscalLifecycleService
- compensacionAhorroService

**Datos clave en producción:** 0 registros; sin arrastres en perfil. Campo origen añadido en sub-tarea 1 absorbiendo arrastresManual.

#### aeatCarryForwards
**Propósito:** Arrastres específicos derivados de casillas AEAT C_ARRn, con granularidad distinta a arrastresIRPF.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- fiscalSummaryService
- carryForwardService

**Lectores principales:**
- fiscalSummaryService
- alertasFiscalesService
- carryForwardService

**Datos clave en producción:** 0 registros; vacío válido si no hay arrastres AEAT.

#### perdidasPatrimonialesAhorro
**Propósito:** Pérdidas patrimoniales de la base del ahorro, compensables y arrastrables cuatro años.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- fiscalLifecycleService
- compensacionAhorroService

**Lectores principales:**
- compensacionAhorroService

**Datos clave en producción:** 0 registros; vacío válido si no hay minusvalías pendientes.

### Personal (4)

#### personalData
**Propósito:** Datos del titular (singleton): identidad, CCAA, régimen fiscal, descendientes, ascendientes, discapacidad y módulos activos de base.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- personalOnboardingService
- personalDataService

**Lectores principales:**
- personalDataService
- personalOnboardingService
- declaracionOnboardingService
- declaracionDistributorService

**Datos clave en producción:** 1 registro. Configuracion_fiscal eliminado en TAREA 7 vive aquí, no en keyval. Pendiente TAREA 14: auditar dispersión fiscal personalData/personalModuleConfig/viviendaHabitual/escenarios.

#### personalModuleConfig
**Propósito:** Configuración de UI del módulo Personal: secciones activas e integración con tesorería vinculadas a personalDataId.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- personalDataService

**Lectores principales:**
- personalDataService

**Datos clave en producción:** 1 registro. Pendiente TAREA 14 revisar límites con configuración fiscal real.

#### presupuestos
**Propósito:** Presupuestos personales por año o periodo: cabecera/estado del plan de gasto.

**Estado:** ✅ USO CONFIRMADO · funcionalidad sin uso en snapshot

**Escritores principales:**
- presupuestoService

**Lectores principales:**
- presupuestoService
- budgetMatchingService

**Datos clave en producción:** 0 registros; vacío válido.

#### presupuestoLineas
**Propósito:** Líneas individuales de presupuesto con categoría, frecuencia, origen y enlaces a cuenta, contrato, préstamo o inmueble.

**Estado:** ✅ USO CONFIRMADO · funcionalidad sin uso en snapshot

**Escritores principales:**
- presupuestoService
- budgetService

**Lectores principales:**
- presupuestoService
- budgetService

**Datos clave en producción:** 0 registros; vacío válido.

### Mi Plan (4)

#### objetivos
**Propósito:** Metas con fecha de Mi Plan: acumular, amortizar, comprar o reducir.

**Estado:** ✅ USO CONFIRMADO · UI Mi Plan v3 sin datos aún

**Escritores principales:**
- objetivosService

**Lectores principales:**
- objetivosService

**Datos clave en producción:** 0 registros; pendiente TAREA 12 mapeo component→data sobre arquitectura limpia.

#### fondos_ahorro
**Propósito:** Etiquetas de propósito sobre euros de tesorería: colchón, compra, reforma, impuestos, capricho o custom.

**Estado:** ✅ USO CONFIRMADO · UI Mi Plan v3 sin datos aún

**Escritores principales:**
- fondosService

**Lectores principales:**
- fondosService
- objetivosService

**Datos clave en producción:** 0 registros; pendiente TAREA 12.

#### retos
**Propósito:** Reto activo mensual de Mi Plan: ahorro, ejecución, disciplina o revisión.

**Estado:** ✅ USO CONFIRMADO · UI Mi Plan v3 sin datos aún

**Escritores principales:**
- retosService

**Lectores principales:**
- retosService

**Datos clave en producción:** 0 registros; pendiente TAREA 12.

#### escenarios
**Propósito:** Singleton id=1 para escenario de libertad financiera: vivienda, gastos de vida, estrategia e hitos.

**Estado:** ✅ USO CONFIRMADO · singleton esperado

**Escritores principales:**
- escenariosService
- migración V55

**Lectores principales:**
- escenariosService

**Datos clave en producción:** 0 registros en snapshot v59; debería contener defaults tras upgrade V55+, por lo que el vacío puede deberse a versión pre-V55.

### Proveedores (2)

#### proveedores
**Propósito:** Catálogo de proveedores con NIF como clave primaria y tipos de servicio. Absorbió operacionesProveedor en sub-tarea 3.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- declaracionDistributorService

**Lectores principales:**
- declaracionDistributorService

**Datos clave en producción:** 11 proveedores.

#### entidadesAtribucion
**Propósito:** Comunidades de bienes, herencias, sociedades civiles y entidades en régimen de atribución de rentas.

**Estado:** ✅ USO CONFIRMADO · vacío válido

**Escritores principales:**
- entidadAtribucionService

**Lectores principales:**
- entidadAtribucionService

**Datos clave en producción:** 0 registros; perfil sin entidades.

### Valoraciones (1)

#### valoraciones_historicas
**Propósito:** Histórico mensual de valoraciones de activos: inmuebles, inversiones, cuentas y planes. Sustituye valoraciones_mensuales y patrimonioSnapshots.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- valoracionesService

**Lectores principales:**
- valoracionesService
- inversionesService
- informesDataService
- dashboardService
- proyeccionMensualService

**Datos clave en producción:** 180 registros; uso intensivo.

### Documental (1)

#### documents
**Propósito:** Documentos adjuntos: escrituras, contratos, facturas, XMLs y documentación bancaria/fiscal. Campo metadata.tipo añadido en sub-tarea 1 absorbiendo documentosFiscales.

**Estado:** ✅ USO CONFIRMADO

**Escritores principales:**
- db.saveDocument
- emailIngestService
- declaracionDistributorService

**Lectores principales:**
- fiscalSummaryService
- fiscalResolverService
- fiscalHistoryService

**Datos clave en producción:** 1 documento.

### Sistema (3)

#### keyval
**Propósito:** Key-value para configuración real (cat. A) y flags de migración recurrentes (cat. D1). Reservado.

**Estado:** ✅ SANEADO POST-T15 · catálogo canónico documentado en `docs/AUDIT-T15-keyval.md` y JSDoc `services/db.ts:keyval`.

**Claves canónicas vivas (post-T15):**
- `'matchingConfig'` (A · KEEP) · destino V63
- `'dashboardConfiguration'` (A · KEEP)
- `'base-assumptions'` (A · KEEP · TODO_PROYECCION T21)
- `'migration_orphaned_inmueble_ids_v1'` (D1 · KEEP)
- `'cleanup_T15_v1'` (D1 · flag idempotencia limpieza T15.2)
- `'migration_keyval_planpagos_to_prestamos_v1'` (D1 · flag idempotencia migración T15.3)

**Claves PROHIBIDAS (movidas/borradas en T15):**
- `'planpagos_${prestamoId}'` → vive en `prestamos[id].planPagos` (T15.3).
- `'base-projection'` → cache recalculable, borrada en T15.2.
- `'kpiConfig_horizon'`, `'kpiConfig_pulse'` → residuales V62, borradas en T15.2.
- `'configFiscal'` → sin escritor activo, queda fuera de scope T15 (decisión T14 · configuración fiscal sitio único).
- `'proveedor-contraparte-migration'` → flag D2 consumida, borrada en T15.2.

**Cómo añadir clave nueva:** ver checklist en JSDoc `services/db.ts:keyval`.

**Escritores principales (post-T15):**
- budgetMatchingService (`matchingConfig`)
- dashboardService (`dashboardConfiguration`)
- proyeccionService (`base-assumptions`)
- migrations runtime (flags D1 idempotentes)

**Lectores principales (post-T15):**
- budgetMatchingService, transferDetectionService (`matchingConfig`)
- dashboardService (`dashboardConfiguration`)
- proyeccionService (`base-assumptions`)

**Saneamiento T15:** Auditoría runtime + clasificación A/B/C/D · limpieza one-shot de B+D2+residuales · migración planpagos_* a `prestamos.planPagos` · ver `docs/AUDIT-T15-keyval.md` y `docs/T15-cierre.md`.

#### importBatches
**Propósito:** Trazabilidad de lotes de importación: XML AEAT, CSB43, manual u otras fuentes.

**Estado:** ✅ USO CONFIRMADO · vacío válido

**Escritores principales:**
- treasuryApiService

**Lectores principales:**
- batchHashUtils

**Datos clave en producción:** 0 registros; sin importaciones bancarias externas en snapshot.

#### movementLearningRules
**Propósito:** Reglas de auto-clasificación de movimientos bancarios; history[] añadido en sub-tarea 1 absorbiendo learningLogs.

**Estado:** ⚠ VERIFICACIÓN PENDIENTE · pendiente TAREA 16


**Problema:** Queda pendiente confirmar en flujo real:
- Cuándo se dispara la escritura efectiva (manual, auto-detección o importación).
- Si `history[]` se alimenta en producción o quedó como residuo tras migrar `learningLogs`.
- Si el schema documentado cubre todos los registros reales futuros.

**Solución pendiente:** TAREA 16 hará análisis profundo de uso y corregirá o eliminará el campo si resultara código muerto.

**Escritores principales:**
- movementLearningService
- migración V64

**Lectores principales:**
- movementLearningService

**Datos clave en producción:** 0 registros. La auditoría recoge implementación, pero queda pendiente validar uso funcional real de history[] en flujos activos.

### Vivienda habitual (1)

#### viviendaHabitual
**Propósito:** Vivienda habitual del titular, con datos fiscales propios y vigencia temporal.

**Estado:** ✅ USO CONFIRMADO · store reciente sin datos

**Escritores principales:**
- viviendaHabitualService
- compromisosRecurrentesService

**Lectores principales:**
- viviendaHabitualService
- compromisosRecurrentesService

**Datos clave en producción:** 0 registros; vacío válido. Pendiente TAREA 14 revisar frontera con perfil fiscal del titular.

---

## §A · Listado alfabético de los 39 stores

- [`accounts`](#accounts) · Cuentas bancarias: origen/destino de movimientos y saldos. El campo balance funciona como cache derivada.
- [`aeatCarryForwards`](#aeatcarryforwards) · Arrastres específicos derivados de casillas AEAT C_ARRn, con granularidad distinta a arrastresIRPF.
- [`arrastresIRPF`](#arrastresirpf) · Arrastres IRPF unificados: pérdidas patrimoniales y gastos pendientes con origen manual, AEAT o calculado.
- [`compromisosRecurrentes`](#compromisosrecurrentes) · Plantillas de gastos recurrentes que generan eventos de tesorería; unifica ámbito inmueble/personal mediante ambito. Absorbió opexRules y patronGastosPersonales.
- [`contracts`](#contracts) · Contratos de alquiler vinculados a inmuebles. Campo historicoRentas[] añadido en sub-tarea 1 para absorber histórico de renta.
- [`documents`](#documents) · Documentos adjuntos: escrituras, contratos, facturas, XMLs y documentación bancaria/fiscal. Campo metadata.tipo añadido en sub-tarea 1 absorbiendo documentosFiscales.
- [`ejerciciosFiscalesCoord`](#ejerciciosfiscalescoord) · Coordinador del ciclo fiscal por año: estado, workflow, importaciones AEAT y orquestación de cálculos.
- [`entidadesAtribucion`](#entidadesatribucion) · Comunidades de bienes, herencias, sociedades civiles y entidades en régimen de atribución de rentas.
- [`escenarios`](#escenarios) · Singleton id=1 para escenario de libertad financiera: vivienda, gastos de vida, estrategia e hitos.
- [`fondos_ahorro`](#fondos-ahorro) · Etiquetas de propósito sobre euros de tesorería: colchón, compra, reforma, impuestos, capricho o custom.
- [`gastosInmueble`](#gastosinmueble) · Gastos por inmueble con trazabilidad fiscal y operativa: XML AEAT, movimiento, evento de tesorería u origen manual.
- [`importBatches`](#importbatches) · Trazabilidad de lotes de importación: XML AEAT, CSB43, manual u otras fuentes.
- [`ingresos`](#ingresos) · Todos los ingresos personales del titular o pareja, discriminados por tipo: nomina, autonomo, desempleo, pension u otro.
- [`inversiones`](#inversiones) · Activos financieros NO inmobiliarios: acciones, fondos, crypto, crowdfunding y P2P.
- [`keyval`](#keyval) · Propósito declarado original: key-value para configuraciones singleton.
- [`mejorasInmueble`](#mejorasinmueble) · CAPEX amortizable de inmuebles: obras/mejoras que aumentan el valor y se amortizan fiscalmente.
- [`movementLearningRules`](#movementlearningrules) · Reglas de auto-clasificación de movimientos bancarios; history[] añadido en sub-tarea 1 absorbiendo learningLogs.
- [`movements`](#movements) · Movimientos bancarios reales importados de extractos o creados por flujos de cuenta; fuente de verdad transaccional.
- [`mueblesInmueble`](#mueblesinmueble) · Mobiliario amortizable asociado a inmuebles, incluido tratamiento fiscal de casilla AEAT 0117.
- [`objetivos`](#objetivos) · Metas con fecha de Mi Plan: acumular, amortizar, comprar o reducir.
- [`perdidasPatrimonialesAhorro`](#perdidaspatrimonialesahorro) · Pérdidas patrimoniales de la base del ahorro, compensables y arrastrables cuatro años.
- [`personalData`](#personaldata) · Datos del titular (singleton): identidad, CCAA, régimen fiscal, descendientes, ascendientes, discapacidad y módulos activos de base.
- [`personalModuleConfig`](#personalmoduleconfig) · Configuración de UI del módulo Personal: secciones activas e integración con tesorería vinculadas a personalDataId.
- [`planesPensionInversion`](#planespensioninversion) · Planes de pensiones como activo financiero: valor liquidativo, aportaciones y revalorización. No es lo mismo que ingresos.tipo=pension, que representa cobro de pensión.
- [`prestamos`](#prestamos) · Toda la deuda: hipotecas, préstamos personales y pólizas. Incluye campo liquidacion añadido en sub-tarea 1 absorbiendo loan_settlements.
- [`presupuestoLineas`](#presupuestolineas) · Líneas individuales de presupuesto con categoría, frecuencia, origen y enlaces a cuenta, contrato, préstamo o inmueble.
- [`presupuestos`](#presupuestos) · Presupuestos personales por año o periodo: cabecera/estado del plan de gasto.
- [`properties`](#properties) · Entidad central de cada inmueble físico: datos catastrales, fiscales, estado, compra y vinculaciones.
- [`property_sales`](#property-sales) · Ventas de inmuebles: plusvalía, gastos de venta, estado de venta y cancelación de financiación asociada.
- [`propertyDays`](#propertydays) · Días fiscales por inmueble y año: alquilado, vacante, obras y disposición del propietario. Determina prorrateos fiscales de ingresos, gastos y amortización.
- [`proveedores`](#proveedores) · Catálogo de proveedores con NIF como clave primaria y tipos de servicio. Absorbió operacionesProveedor en sub-tarea 3.
- [`resultadosEjercicio`](#resultadosejercicio) · Resumen mutable calculado del año fiscal tras el ciclo de paralelas/cálculo.
- [`retos`](#retos) · Reto activo mensual de Mi Plan: ahorro, ejecución, disciplina o revisión.
- [`snapshotsDeclaracion`](#snapshotsdeclaracion) · Fotos inmutables del XML AEAT importado por ejercicio y origen.
- [`traspasosPlanes`](#traspasosplanes) · Eventos de traspaso fiscalmente neutro entre planes de pensiones; representan cambios de gestora o vehículo sin romper la identidad económica del plan.
- [`treasuryEvents`](#treasuryevents) · Eventos previstos o confirmados de tesorería: fuente de verdad del presente y futuro financiero operativo.
- [`valoraciones_historicas`](#valoraciones-historicas) · Histórico mensual de valoraciones de activos: inmuebles, inversiones, cuentas y planes. Sustituye valoraciones_mensuales y patrimonioSnapshots.
- [`vinculosAccesorio`](#vinculosaccesorio) · Vínculo temporal año-a-año entre inmueble principal y accesorios con referencia catastral propia (trastero, garaje).
- [`viviendaHabitual`](#viviendahabitual) · Vivienda habitual del titular, con datos fiscales propios y vigencia temporal.


---

## §B · Diagrama de relaciones FK principales (texto)

```text
properties
  ← contracts.propertyId
  ← gastosInmueble.inmuebleId
  ← mejorasInmueble.inmuebleId
  ← mueblesInmueble.inmuebleId
  ← vinculosAccesorio.inmueblePrincipalId / inmuebleAccesorioId
  ← property_sales.propertyId
  ← prestamos.afectacionesInmueble[] / prestamos.inmuebleId

accounts
  ← movements.accountId
  ← prestamos.cuentaCargoId
  ← contracts.cuentaCobroId
  ← treasuryEvents.accountId

personalData
  ← ingresos.personalDataId
  ← presupuestos.personalDataId
  ← viviendaHabitual.personalDataId
  ← personalModuleConfig.personalDataId

ejerciciosFiscalesCoord
  ← snapshotsDeclaracion.ejercicio
  ← resultadosEjercicio.ejercicio
  ← arrastresIRPF.ejercicioOrigen / ejercicioCaducidad
  ← aeatCarryForwards.taxYear / expirationYear

inversiones
  ← valoraciones_historicas.activo_id cuando tipo_activo es inversión/plan
  ← traspasosPlanes.planOrigenId / planDestinoId (pendiente TAREA 13)

escenarios
  → alimenta Mi Plan como singleton de hipótesis

objetivos
  → fondos_ahorro.fondoId
  → prestamos.prestamoId

movements
  → movementLearningRules por learnKey/categorización
  → treasuryEvents por conciliación o confirmación
```

---

## §C · Tabla detallada de cambios V59 → V60

### Stores eliminados / absorbidos documentados

> Nota: la especificación histórica habla de 19 eliminaciones principales; la tabla de cierre conserva 21 filas porque incluye también las dos eliminaciones de sub-tarea 5 documentadas como parte del barrido final.

| # | Store eliminado | Destino | Sub-tarea |
|---:|---|---|---|
| 1 | configuracion_fiscal | personalData | 3 |
| 2 | ejerciciosFiscales | ejerciciosFiscalesCoord | 3 |
| 3 | gastosPersonalesReal | movements + treasuryEvents | 3 |
| 4 | kpiConfigurations | keyval['kpiConfig_*'] | 3 |
| 5 | operacionesProveedor | proveedores | 3 |
| 6 | opexRules | compromisosRecurrentes | 3 |
| 7 | patrimonioSnapshots | derivado runtime de valoraciones_historicas | 3 |
| 8 | patronGastosPersonales | compromisosRecurrentes | 3 |
| 9 | rentaMensual | contracts.rentaMensual + treasuryEvents | 3 |
| 10 | treasuryRecommendations | derivado runtime | 3 |
| 11 | valoraciones_mensuales | derivado de valoraciones_historicas | 3 |
| 12 | nominas | ingresos | 4 (deuda sub-tarea 2) |
| 13 | autonomos | ingresos.tipo='autonomo' | 4 |
| 14 | pensiones | ingresos.tipo='pension' | 4 |
| 15 | otrosIngresos | ingresos.tipo='otro' | 4 |
| 16 | arrastresManual | arrastresIRPF.origen='manual' | 4 |
| 17 | documentosFiscales | documents.metadata.tipo='fiscal' | 4 |
| 18 | loan_settlements | prestamos.liquidacion | 4 |
| 19 | matchingConfiguration | keyval['matchingConfig'] | 4 |
| 20 | learningLogs | movementLearningRules.history[] | 5 |
| 21 | reconciliationAuditLogs | ELIMINADO sin destino | 5 |

### Stores renombrados (1)

- `nominas` → `ingresos` (sub-tarea 2 · ampliación de schema con discriminador `tipo`).

### Stores con schema ampliado (9)

| Store | Campo añadido | Sub-tarea |
|---|---|---|
| arrastresIRPF | `origen: 'manual'|'aeat'|'calculado'` | 1 |
| documents | `metadata.tipo: 'fiscal'|'contrato'|'bancario'|'otro'` | 1 |
| prestamos | `liquidacion: LoanSettlement | null` | 1 |
| contracts | `historicoRentas: HistoricoRenta[]` | 1 |
| keyval | documentación de claves estándar | 1 |
| accounts | JSDoc de `balance` como cache derivada | 1 |
| movementLearningRules | `history: HistoryEntry[]` (máx. 50 · FIFO) | 1 |
| valoraciones_historicas | consultas mensuales sin store separado | 1 |
| ingresos | nuevo store con 4 tipos + metadata específica | 2 |

---

## §D · Problemas conocidos pendientes (4)

### TAREA 13 · Módulo planes de pensiones

**Stores afectados:** `inversiones`, `planesPensionInversion`, `traspasosPlanes`.

**Problema breve:** Bug de doble escritura: UI/manual escribe planes en `inversiones`, XML AEAT puede escribir en `planesPensionInversion`. Los traspasos son eventos del plan, no entradas paralelas. El caso ING→Indexa→MyInvestor evidencia una trayectoria con identidad estable.

**Acción pendiente:** Diseñar módulo dedicado para plan, trayectoria, aportaciones y traspasos; migrar datos; retirar el modelo duplicado cuando corresponda.

### TAREA 14 · Configuración fiscal · sitio único

**Stores afectados:** `personalData`, `personalModuleConfig`, `viviendaHabitual`, `escenarios`, `ejerciciosFiscalesCoord`.

**Problema breve:** Datos fiscales del titular dispersos en varios sitios.

**Acción pendiente:** Consolidar perfil fiscal en `personalData`, mantener vivienda en `viviendaHabitual` y workflow en `ejerciciosFiscalesCoord`, y documentar fronteras.

### TAREA 15 · Saneamiento `keyval` ✅ CERRADA

**Store afectado:** `keyval`.

**Resumen post-cierre:** Auditoría runtime + clasificación A/B/C/D (sub-tarea 15.1) · limpieza one-shot de cache B y flags D2 consumidas (sub-tarea 15.2) · migración `planpagos_*` a `prestamos.planPagos` (sub-tarea 15.3) · catálogo canónico documentado en JSDoc `services/db.ts:keyval` y este archivo (sub-tarea 15.4).

**Documentos:** `docs/AUDIT-T15-keyval.md` (audit) · `docs/T15-cierre.md` (resumen ejecutivo).

**DB_VERSION sin cambios** (sigue en 65) · solo limpieza/migración runtime.

### TAREA 16 · Verificación `movementLearningRules`

**Store afectado:** `movementLearningRules`.

**Problema breve:** Falta validación funcional completa de escritura y consumo de `history[]` tras la absorción de `learningLogs`.

**Acción pendiente:** Analizar flujos reales, confirmar uso o eliminar/corregir el campo si resultara residuo.

---

## §E · Próximas tareas planificadas (post-TAREA 7)

- TAREA 8 · refactor schemas restantes (cache derivada balance, histórico rentas activado, etc.).
- TAREA 9 · bootstrap `compromisosRecurrentes` desde histórico.
- TAREA 10 · adaptar consumidores legacy pendientes.
- TAREA 11 · UI flujo wipe + reimport.
- TAREA 12 · mapeo component→data sobre arquitectura limpia.
- TAREA 13-16 · ver §D arriba.

---

## §F · Snapshot de referencia

Este documento se basa en `docs/audit-inputs/atlas-snapshot-20260426-10.json` (DB v59, pre-cleanup) y en `docs/AUDIT-39-stores-V60.md`. Tras TAREA 7 ejecutada, la DB queda en v64 con 39 stores activos.

**Counts de registros observados (referencia):**

| Store | Count snapshot | Estado |
|---|---:|---|
| `accounts` | 8 | con datos |
| `aeatCarryForwards` | 0 | vacío válido |
| `arrastresIRPF` | 0 | vacío válido |
| `compromisosRecurrentes` | 0 | vacío válido |
| `contracts` | 6 | con datos |
| `documents` | 1 | con datos |
| `ejerciciosFiscalesCoord` | 5 | con datos |
| `entidadesAtribucion` | 0 | vacío válido |
| `escenarios` | 0 | singleton post-V55 esperado |
| `fondos_ahorro` | 0 | Mi Plan sin datos |
| `gastosInmueble` | 109 | con datos intensivo |
| `importBatches` | 0 | vacío válido |
| `ingresos` | N/A | post-v59 |
| `inversiones` | 12 | con datos · problema T13 |
| `keyval` | 14 | planpagos_* · problema T15 |
| `mejorasInmueble` | 4 | con datos |
| `movementLearningRules` | 0 | verificación T16 |
| `movements` | 6 | con datos |
| `mueblesInmueble` | 5 | con datos |
| `objetivos` | 0 | Mi Plan sin datos |
| `perdidasPatrimonialesAhorro` | 0 | vacío válido |
| `personalData` | 1 | singleton |
| `personalModuleConfig` | 1 | con datos |
| `planesPensionInversion` | 0 | zombie T13 |
| `prestamos` | 13 | con datos |
| `presupuestoLineas` | 0 | vacío válido |
| `presupuestos` | 0 | vacío válido |
| `properties` | 8 | con datos |
| `propertyDays` | 0 | vacío válido |
| `property_sales` | 0 | vacío válido |
| `proveedores` | 11 | con datos |
| `resultadosEjercicio` | 0 | vacío/bug pendiente |
| `retos` | 0 | Mi Plan sin datos |
| `snapshotsDeclaracion` | 0 | vacío/bug pendiente |
| `traspasosPlanes` | 0 | vacío válido condicionado T13 |
| `treasuryEvents` | 13 | con datos |
| `valoraciones_historicas` | 180 | con datos intensivo |
| `vinculosAccesorio` | 4 | con datos |
| `viviendaHabitual` | 0 | vacío válido |
