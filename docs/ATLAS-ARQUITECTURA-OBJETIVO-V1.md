# ATLAS · Arquitectura objetivo de stores · V1

> Auditoría de solo lectura basada en `docs/audit-inputs/README.md`, `TAREA-CC-6-ARQUITECTURA-OBJETIVO.md`, snapshot DB_VERSION 59 y código actual. No modifica código.

## 1. Resumen ejecutivo

- **Diagnóstico general**: la DB tiene **59 stores**; 25 contienen datos y 34 están vacíos. La deuda real no es el volumen sino el solapamiento entre stores legacy, stores de roadmap aún sin UI y datos derivados persistidos.

- **Diseño objetivo recomendado**: **48 stores**. Reducción propuesta **59 → 48** (**19%**), sin crear stores nuevos en esta fase.

- **Decisión central**: separar catálogo, evento y hecho real. Catálogos (`contracts`, `nominas`, `compromisosRecurrentes`, `prestamos`) generan `treasuryEvents`; el banco confirma en `movements`; fiscal declarado queda en `gastosInmueble`/stores fiscales.

- **Migración recomendada**: wipe + reimport XMLs, porque los datos actuales son validación y no productivos. Evitar migraciones campo a campo salvo para confirmar reglas de importación.

- **Stores a eliminar**: legacy/derivados (`opexRules`, `rentaMensual`, `ejerciciosFiscales`, `kpiConfigurations`, `gastosPersonalesReal`, `patronGastosPersonales`, `operacionesProveedor`, `patrimonioSnapshots`, `treasuryRecommendations`, `valoraciones_mensuales`, `configuracion_fiscal`).


### Tabla resumen del diagnóstico

| # | Store | Registros | Veredicto | Motivo · 1 línea | Acción propuesta |
|---:|---|---:|---|---|---|
| 1 | `accounts` | 8 | VIVO | tesorería, cuentas bancarias y saldos base | mantener |
| 2 | `aeatCarryForwards` | 0 | VIVO | arrastres fiscales AEAT usados por fiscalSummary/carryForward | mantener |
| 3 | `arrastresIRPF` | 0 | VIVO | carry-forwards IRPF usados por ciclo fiscal | mantener |
| 4 | `arrastresManual` | 0 | HUÉRFANO | entrada manual fiscal prevista pero sin datos actuales | mantener roadmap |
| 5 | `autonomos` | 0 | HUÉRFANO | catálogo laboral Personal previsto; 0 datos Jose | mantener roadmap |
| 6 | `compromisosRecurrentes` | 0 | HUÉRFANO | catálogo objetivo G-01; vacío por falta de carga inicial | mantener roadmap |
| 7 | `configuracion_fiscal` | 1 | DUPLICADO | singleton de configuración cabe en keyval | eliminar/refactorizar hacia `keyval/configFiscal` |
| 8 | `contracts` | 6 | VIVO | fuente de contratos y renta vigente | mantener |
| 9 | `documentosFiscales` | 0 | HUÉRFANO | documental fiscal previsto; hoy vacío | mantener roadmap |
| 10 | `documents` | 1 | VIVO | archivo documental general | mantener |
| 11 | `ejerciciosFiscales` | 1 | DUPLICADO | store legacy sustituido por coordinador | eliminar/refactorizar hacia `ejerciciosFiscalesCoord` |
| 12 | `ejerciciosFiscalesCoord` | 5 | VIVO | coordinador fiscal 2020-2024 | mantener |
| 13 | `entidadesAtribucion` | 0 | HUÉRFANO | fiscal atribución de rentas previsto | mantener roadmap |
| 14 | `escenarios` | 0 | HUÉRFANO | Mi Plan v3; store nuevo sin UI aún | mantener roadmap |
| 15 | `fondos_ahorro` | 0 | HUÉRFANO | Mi Plan v3; etiquetas de propósito | mantener roadmap |
| 16 | `gastosInmueble` | 109 | VIVO | histórico fiscal declarado por inmueble | mantener |
| 17 | `gastosPersonalesReal` | 0 | DUPLICADO | hechos reales deben vivir en movements/TE confirmado | eliminar/refactorizar hacia `movements + treasuryEvents` |
| 18 | `importBatches` | 0 | VIVO | trazabilidad de importación bancaria | mantener |
| 19 | `inversiones` | 12 | VIVO | posiciones financieras visibles | mantener |
| 20 | `keyval` | 14 | VIVO | configuración y datos auxiliares | mantener |
| 21 | `kpiConfigurations` | 0 | FÓSIL | sin datos ni mockup objetivo específico | eliminar/refactorizar hacia `keyval` |
| 22 | `learningLogs` | 0 | VIVO | auditoría de reglas aprendidas | mantener |
| 23 | `loan_settlements` | 0 | HUÉRFANO | cancelaciones de préstamos planificadas | mantener roadmap |
| 24 | `matchingConfiguration` | 0 | HUÉRFANO | reglas de matching presupuestario/transferencias | mantener roadmap |
| 25 | `mejorasInmueble` | 4 | VIVO | mejoras y reparaciones capitalizables | mantener |
| 26 | `movementLearningRules` | 0 | VIVO | reglas de clasificación aprendidas | mantener |
| 27 | `movements` | 6 | VIVO | movimientos bancarios reales | mantener |
| 28 | `mueblesInmueble` | 5 | VIVO | mobiliario amortizable | mantener |
| 29 | `nominas` | 1 | VIVO | ingresos laborales Personal | mantener |
| 30 | `objetivos` | 0 | HUÉRFANO | Mi Plan v3; metas explícitas | mantener roadmap |
| 31 | `operacionesProveedor` | 15 | DUPLICADO | duplica proveedor+gasto anual; puede normalizarse | eliminar/refactorizar hacia `proveedores.operaciones[] o gasto declarado` |
| 32 | `opexRules` | 0 | DUPLICADO | deprecated; migrado a compromisos | eliminar/refactorizar hacia `compromisosRecurrentes` |
| 33 | `otrosIngresos` | 0 | HUÉRFANO | ingresos personales no laborales previsto | mantener roadmap |
| 34 | `patrimonioSnapshots` | 1 | DUPLICADO | snapshot agregado duplicado con valoración mensual | eliminar/refactorizar hacia `valoraciones_mensuales` |
| 35 | `patronGastosPersonales` | 7 | DUPLICADO | sustituido por compromisos recurrentes | eliminar/refactorizar hacia `compromisosRecurrentes` |
| 36 | `pensiones` | 0 | HUÉRFANO | ingresos de pensión previstos | mantener roadmap |
| 37 | `perdidasPatrimonialesAhorro` | 0 | VIVO | arrastres fiscal ahorro | mantener |
| 38 | `personalData` | 1 | VIVO | perfil fiscal/personal base | mantener |
| 39 | `personalModuleConfig` | 1 | VIVO | config módulo Personal | mantener |
| 40 | `planesPensionInversion` | 0 | VIVO | planes de pensiones separados de inversión operativa | mantener |
| 41 | `prestamos` | 13 | VIVO | deuda y financiación | mantener |
| 42 | `presupuestoLineas` | 0 | HUÉRFANO | roadmap presupuesto y matching | mantener roadmap |
| 43 | `presupuestos` | 0 | HUÉRFANO | roadmap presupuesto anual | mantener roadmap |
| 44 | `properties` | 8 | VIVO | activos inmobiliarios | mantener |
| 45 | `propertyDays` | 0 | VIVO | días fiscales manuales/ocupación | mantener |
| 46 | `property_sales` | 0 | HUÉRFANO | ventas inmobiliarias previstas | mantener roadmap |
| 47 | `proveedores` | 11 | VIVO | entidades fiscales detectadas por XML | mantener |
| 48 | `reconciliationAuditLogs` | 0 | VIVO | auditabilidad de conciliación | mantener |
| 49 | `rentaMensual` | 0 | DUPLICADO | deprecated; contrato escalar + eventos | eliminar/refactorizar hacia `contracts + treasuryEvents` |
| 50 | `resultadosEjercicio` | 0 | VIVO | resultado fiscal anual inmutable | mantener |
| 51 | `retos` | 0 | HUÉRFANO | Mi Plan v3; reto mensual | mantener roadmap |
| 52 | `snapshotsDeclaracion` | 0 | VIVO | foto declaración importada | mantener |
| 53 | `traspasosPlanes` | 0 | VIVO | eventos de traspaso entre planes | mantener |
| 54 | `treasuryEvents` | 13 | VIVO | previsión presente/futuro | mantener |
| 55 | `treasuryRecommendations` | 0 | FÓSIL | recomendaciones recalculables desde TE/movements | eliminar/refactorizar hacia `derivado en runtime` |
| 56 | `valoraciones_historicas` | 180 | VIVO | histórico de valoración por activo | mantener |
| 57 | `valoraciones_mensuales` | 115 | DUPLICADO | snapshot mensual duplicable desde histórico | eliminar/refactorizar hacia `valoraciones_historicas + vista mensual` |
| 58 | `vinculosAccesorio` | 4 | VIVO | relación parking/trastero fiscal | mantener |
| 59 | `viviendaHabitual` | 0 | HUÉRFANO | ficha hogar/vivienda Personal prevista | mantener roadmap |

## 2. SUB-TAREA A · Diagnóstico

### 2.1 Fichas detalladas de los 59 stores

#### `accounts`
- **Schema actual**: `Account` en `src/services/db.ts:865`.
- **KeyPath e índices**: `src/services/db.ts:2318` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 8.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/__tests__/cuentasServiceOpeningBalance.test.ts:47`, `src/services/bankStatementImportService.ts:233`, `src/services/enhancedTreasuryCreationService.ts:138`, `src/services/enhancedTreasuryCreationService.ts:151`, `src/services/enhancedTreasuryCreationService.ts:366`, `src/services/treasuryOverviewService.ts:176`.
- **Quién escribe**: `src/__tests__/cuentasServiceOpeningBalance.test.ts:86`, `src/__tests__/productionModeIntegration.test.ts:60`, `src/__tests__/productionModeRequirements.test.ts:56`, `src/__tests__/accountValidationService.test.ts:186`, `src/services/cuentasService.ts:131`, `src/services/cuentasService.ts:142`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: tesorería, cuentas bancarias y saldos base.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=8; `src/App.tsx:752` {/* Bank accounts are managed exclusively in Tesorería */}; `src/examples/enhancedFunctionalityDemo.ts:110` accountsProcessed: 147,; `src/utils/accountUtils.ts:9` * Sort accounts according to FIX PACK v1.0 requirements:; `src/utils/accountUtils.ts:13` export function sortAccountsByTypeAndAlias(accounts: Account[]): Account[] {. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `aeatCarryForwards`
- **Schema actual**: `AEATCarryForward` en `src/services/db.ts:828`.
- **KeyPath e índices**: `src/services/db.ts:2201` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/fiscalSummaryService.ts:158`, `src/services/alertasFiscalesService.ts:62`.
- **Quién escribe**: `src/services/fiscalSummaryService.ts:161`, `src/services/fiscalSummaryService.ts:163`, `src/services/carryForwardService.ts:64`, `src/services/carryForwardService.ts:75`, `src/services/carryForwardService.ts:110`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: arrastres fiscales AEAT usados por fiscalSummary/carryForward.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/fiscalSummaryService.ts:144` // Persist carryforward records (these go to aeatCarryForwards, not fiscalSummar; `src/services/fiscalSummaryService.ts:158` const allCfs = await db.getAllFromIndex('aeatCarryForwards', 'propertyId', prope; `src/services/fiscalSummaryService.ts:161` await db.put('aeatCarryForwards', { ...cfRecord, id: existingCf.id, createdAt: e; `src/services/fiscalSummaryService.ts:163` await db.add('aeatCarryForwards', cfRecord);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `arrastresIRPF`
- **Schema actual**: `ArrastreIRPF` en `src/services/db.ts:1374`.
- **KeyPath e índices**: `src/services/db.ts:2612` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/fiscalLifecycleService.ts:172`, `src/services/compensacionAhorroService.ts:140`, `src/services/compensacionAhorroService.ts:376`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:424`, `src/services/__tests__/arrastresFiscalesService.test.ts:32`, `src/services/__tests__/snapshotDeclaracionService.test.ts:167`.
- **Quién escribe**: `src/services/fiscalHistoryService.ts:126`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:431`, `src/services/__tests__/arrastresFiscalesService.test.ts:9`, `src/services/__tests__/fiscalLifecycleService.test.ts:39`, `src/services/__tests__/snapshotDeclaracionService.test.ts:42`, `src/services/__tests__/snapshotDeclaracionService.test.ts:49`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: carry-forwards IRPF usados por ciclo fiscal.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/arrastresFiscalesService.ts:3` const STORE_NAME = 'arrastresIRPF';; `src/services/snapshotDeclaracionService.ts:28` const ARRASTRES_STORE_NAME = 'arrastresIRPF';; `src/services/fiscalLifecycleService.ts:20` const ARRASTRES_STORE = 'arrastresIRPF';; `src/services/fiscalLifecycleService.ts:172` const candidatos = (await db.getAllFromIndex('arrastresIRPF', 'ejercicioOrigen',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `arrastresManual`
- **Schema actual**: `ArrastreManualRecord`.
- **KeyPath e índices**: ver definición de upgrade en src/services/db.ts.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: no halladas.
- **Quién escribe**: `src/services/__tests__/ejercicioFiscalService.test.ts:117`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: entrada manual fiscal prevista pero sin datos actuales.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/ejercicioFiscalService.ts:18` const ARRASTRES_MANUAL_STORE = 'arrastresManual';; `src/services/__tests__/ejercicioFiscalService.test.ts:117` db.clear('arrastresManual'),. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `autonomos`
- **Schema actual**: `Autonomo`.
- **KeyPath e índices**: `src/services/db.ts:2464` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/irpfCalculationService.ts:420`, `src/services/fiscalConciliationService.ts:385`, `src/services/declaracionOnboardingService.ts:1370`, `src/services/ejercicioFiscalMigration.ts:380`, `src/services/autonomoService.ts:28`, `src/services/autonomoService.ts:29`.
- **Quién escribe**: `src/services/autonomoService.ts:29`, `src/services/autonomoService.ts:76`, `src/services/autonomoService.ts:120`, `src/services/autonomoService.ts:168`, `src/services/autonomoService.ts:236`, `src/services/autonomoService.ts:267`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: catálogo laboral Personal previsto; 0 datos Jose.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/tests/irpfAccesorios.test.ts:37` if (store === 'autonomos') return Promise.resolve([]);; `src/services/irpfCalculationService.ts:420` const allAutonomos = await db.getAll('autonomos');; `src/services/informesDataService.ts:52` autonomos: number;; `src/services/informesDataService.ts:199` autonomos: 0,. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `compromisosRecurrentes`
- **Schema actual**: `CompromisoRecurrente`.
- **KeyPath e índices**: ver definición de upgrade en src/services/db.ts.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/propertyExpenses.ts:184`, `src/services/operacionFiscalService.ts:180`, `src/services/opexService.ts:199`, `src/services/opexService.ts:279`, `src/services/opexService.ts:291`.
- **Quién escribe**: `src/services/opexService.ts:206`, `src/services/opexService.ts:300`, `src/services/opexService.ts:318`, `src/services/opexService.ts:321`, `src/services/__tests__/propertyExpenses.test.ts:18`, `src/services/__tests__/propertyExpenses.test.ts:68`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: catálogo objetivo G-01; vacío por falta de carga inicial.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/types/personal.ts:6` //   - `compromisosRecurrentes` → src/types/compromisosRecurrentes.ts; `src/types/personal.ts:11` export * from './compromisosRecurrentes';; `src/services/propertyExpenses.ts:3` import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';; `src/services/propertyExpenses.ts:182` // V5.4+: read from compromisosRecurrentes (ambito='inmueble') instead of opexRu. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `configuracion_fiscal`
- **Schema actual**: `any` en AtlasHorizonDB; schema real en servicios/tipos externos.
- **KeyPath e índices**: `src/services/db.ts:2554` · keyPath: 'id'.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/ejercicioFiscalMigration.ts:411`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:1007`.
- **Quién escribe**: no halladas.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: singleton de configuración cabe en keyval.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=1; `src/services/ejercicioFiscalMigration.ts:410` if (db.objectStoreNames.contains('configuracion_fiscal')) {; `src/services/ejercicioFiscalMigration.ts:411` const config = await db.get('configuracion_fiscal', 'default') as Record<string,; `src/services/fiscalPaymentsService.ts:22` const CONFIG_STORE = 'configuracion_fiscal';; `src/modules/horizon/tesoreria/services/treasurySyncService.ts:1007` const configFiscalRecord = await db.get('configuracion_fiscal', 'default');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `contracts`
- **Schema actual**: `Contract` en `src/services/db.ts:594`.
- **KeyPath e índices**: `src/services/db.ts:2193` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 6.
- **Servicio dedicado**: `src/services/contractsImportService.ts`.
- **Quién lee**: `src/services/fiscalSummaryService.ts:119`, `src/services/irpfCalculationService.ts:548`, `src/services/informesDataService.ts:495`, `src/services/treasuryOverviewService.ts:169`, `src/services/fiscalConciliationService.ts:444`, `src/services/historicalCashflowCalculator.ts:121`.
- **Quién escribe**: `src/services/documentIngestionService.ts:334`, `src/services/propertySaleService.ts:753`, `src/services/propertySaleService.ts:1176`, `src/services/vinculacionFiscalService.ts:188`, `src/services/contractService.ts:100`, `src/services/contractService.ts:140`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: fuente de contratos y renta vigente.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=6; `src/tests/documentTypeDetection.test.ts:146` it('should enable auto-OCR for contracts', () => {; `src/tests/irpfAccesorios.test.ts:31` function buildMockDB(properties: any[], contracts: any[] = [], propertyDays: any; `src/tests/irpfAccesorios.test.ts:35` if (store === 'contracts') return Promise.resolve(contracts);; `src/tests/irpfAccesorios.test.ts:103` const contracts = [{ fechaInicio: '2025-01-01', fechaFin: '2025-12-31' }];. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `documentosFiscales`
- **Schema actual**: `DocumentoFiscalRecord`.
- **KeyPath e índices**: ver definición de upgrade en src/services/db.ts.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/migrations/migrateOrphanedInmuebleIds.ts:402`.
- **Quién escribe**: `src/services/migrations/migrateOrphanedInmuebleIds.ts:411`, `src/services/__tests__/ejercicioFiscalService.test.ts:116`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: documental fiscal previsto; hoy vacío.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/ejercicioFiscalService.ts:17` const DOCUMENTOS_STORE = 'documentosFiscales';; `src/services/migrations/migrateOrphanedInmuebleIds.ts:400` // documentosFiscales (inmuebleId may be string or number depending on version); `src/services/migrations/migrateOrphanedInmuebleIds.ts:402` const all = await db.getAll('documentosFiscales');; `src/services/migrations/migrateOrphanedInmuebleIds.ts:411` await db.put('documentosFiscales', { ...rec, inmuebleId: newId, updatedAt: new D. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `documents`
- **Schema actual**: `Document` en `src/services/db.ts:494`.
- **KeyPath e índices**: `src/services/db.ts:2185` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/pages/InboxPage.tsx:131`, `src/services/fiscalSummaryService.ts:222`, `src/services/emailIngestService.ts:449`, `src/services/declaracionDistributorService.ts:428`, `src/services/documentIngestionService.ts:234`, `src/services/unifiedDocumentProcessor.ts:308`.
- **Quién escribe**: `src/services/emailIngestService.ts:243`, `src/services/declaracionDistributorService.ts:444`, `src/services/documentIngestionService.ts:241`, `src/services/unifiedDocumentProcessor.ts:403`, `src/services/fiscalHistoryService.ts:142`, `src/services/migrationService.ts:83`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: archivo documental general.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=1; `src/tests/documentTypeDetection.test.ts:106` it('should route unknown documents to manual processing', () => {; `src/tests/fixDocsIntegration.test.ts:201` // When Autoguardado is ON, all documents should be processed and removed from i; `src/tests/diagnosticChecklist.test.ts:142` // Verify both documents were parsed with correct types; `src/utils/propertyMapper.ts:68` documents: [],. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `ejerciciosFiscales`
- **Schema actual**: `EjercicioFiscal` en `src/services/db.ts:1231`.
- **KeyPath e índices**: `src/services/db.ts:2559` · keyPath: 'ejercicio'.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/accountMigrationService.ts:90`, `src/services/ejercicioResolverService.ts:52`, `src/services/ejercicioResolverService.ts:91`, `src/services/ejercicioResolverService.ts:321`, `src/services/ejercicioResolverService.ts:328`, `src/services/ejercicioResolverService.ts:337`.
- **Quién escribe**: `src/services/ejercicioResolverService.ts:82`, `src/services/ejercicioResolverService.ts:323`, `src/services/ejercicioResolverService.ts:332`, `src/services/ejercicioResolverService.ts:384`, `src/services/ejercicioResolverService.ts:394`, `src/services/ejercicioResolverService.ts:429`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: store legacy sustituido por coordinador.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=1; `src/services/accountMigrationService.ts:72` // Backfill IBANs from ejerciciosFiscalesCoord for users who imported XMLs befor; `src/services/accountMigrationService.ts:78` * ejerciciosFiscalesCoord and write them to accounts if missing.; `src/services/accountMigrationService.ts:90` const ejercicios = await db.getAll('ejerciciosFiscalesCoord');; `src/services/ejercicioResolverService.ts:52` const existing = await db.get('ejerciciosFiscalesCoord', año);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `ejerciciosFiscalesCoord`
- **Schema actual**: `EjercicioFiscalCoord` en `src/services/db.ts:1860`.
- **KeyPath e índices**: `src/services/db.ts:2645` · keyPath: 'año'.
- **Registros en snapshot**: 5.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/accountMigrationService.ts:90`, `src/services/ejercicioResolverService.ts:52`, `src/services/ejercicioResolverService.ts:91`, `src/services/ejercicioResolverService.ts:321`, `src/services/ejercicioResolverService.ts:328`, `src/services/ejercicioResolverService.ts:337`.
- **Quién escribe**: `src/services/ejercicioResolverService.ts:82`, `src/services/ejercicioResolverService.ts:323`, `src/services/ejercicioResolverService.ts:332`, `src/services/ejercicioResolverService.ts:384`, `src/services/ejercicioResolverService.ts:429`, `src/services/ejercicioResolverService.ts:540`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: coordinador fiscal 2020-2024.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=5; `src/services/accountMigrationService.ts:72` // Backfill IBANs from ejerciciosFiscalesCoord for users who imported XMLs befor; `src/services/accountMigrationService.ts:78` * ejerciciosFiscalesCoord and write them to accounts if missing.; `src/services/accountMigrationService.ts:90` const ejercicios = await db.getAll('ejerciciosFiscalesCoord');; `src/services/ejercicioResolverService.ts:52` const existing = await db.get('ejerciciosFiscalesCoord', año);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `entidadesAtribucion`
- **Schema actual**: `EntidadAtribucionRentas` en `src/services/db.ts:1401`.
- **KeyPath e índices**: `src/services/db.ts:2637` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/entidadAtribucionService.ts:20`, `src/services/entidadAtribucionService.ts:26`, `src/services/entidadAtribucionService.ts:35`, `src/services/entidadAtribucionService.ts:54`.
- **Quién escribe**: `src/services/entidadAtribucionService.ts:14`, `src/services/entidadAtribucionService.ts:42`, `src/services/entidadAtribucionService.ts:62`, `src/services/__tests__/entidadAtribucionService.test.ts:12`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: fiscal atribución de rentas previsto.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/entidadAtribucionService.ts:14` const id = await db.add('entidadesAtribucion', entidad);; `src/services/entidadAtribucionService.ts:20` const entidades = await db.getAll('entidadesAtribucion') as EntidadAtribucionRen; `src/services/entidadAtribucionService.ts:26` const entidades = await db.getAllFromIndex('entidadesAtribucion', 'nif', nif) as; `src/services/entidadAtribucionService.ts:35` const entidad = await db.get('entidadesAtribucion', entidadId) as EntidadAtribuc. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `escenarios`
- **Schema actual**: `Escenario`.
- **KeyPath e índices**: `src/services/db.ts:2975` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: `src/services/escenariosService.ts`.
- **Quién lee**: `src/services/escenariosService.ts:40`, `src/services/__tests__/db.migration.v59.test.ts:78`, `src/services/__tests__/db.migration.v59.test.ts:128`.
- **Quién escribe**: `src/__tests__/escenariosService.test.ts:111`, `src/__tests__/escenariosService.test.ts:156`, `src/__tests__/escenariosService.test.ts:195`, `src/services/escenariosService.ts:68`, `src/services/escenariosService.ts:81`, `src/services/__tests__/db.migration.v59.test.ts:57`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: Mi Plan v3; store nuevo sin UI aún.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/App.tsx:90` const ProyeccionEscenarios = lazyWithPreload(() => import('./modules/horizon/pro; `src/App.tsx:527` <Route path="escenarios" element={; `src/App.tsx:539` <Route path="base" element={<Navigate to="/proyeccion/escenarios" replace />} />; `src/App.tsx:540` <Route path="simulaciones" element={<Navigate to="/proyeccion/escenarios" replac. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `fondos_ahorro`
- **Schema actual**: `FondoAhorro`.
- **KeyPath e índices**: `src/services/db.ts:3074` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/objetivosService.ts:27`, `src/services/fondosService.ts:39`, `src/services/fondosService.ts:105`, `src/services/fondosService.ts:115`, `src/services/fondosService.ts:132`.
- **Quién escribe**: `src/__tests__/fondosService.test.ts:54`, `src/__tests__/fondosService.test.ts:190`, `src/__tests__/fondosService.test.ts:198`, `src/services/fondosService.ts:97`, `src/services/fondosService.ts:146`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: Mi Plan v3; etiquetas de propósito.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/__tests__/fondosService.test.ts:1` // Tests para fondosService (Mi Plan v3) — store 'fondos_ahorro'; `src/__tests__/fondosService.test.ts:54` expect(mockDB.put).toHaveBeenCalledWith('fondos_ahorro', expect.objectContaining; `src/__tests__/fondosService.test.ts:140` if (store === 'fondos_ahorro' && id === 'f1') return Promise.resolve(fondo);; `src/__tests__/fondosService.test.ts:156` if (store === 'fondos_ahorro' && id === 'f2') return Promise.resolve(fondo);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `gastosInmueble`
- **Schema actual**: `?`.
- **KeyPath e índices**: `src/services/db.ts:2233` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 109.
- **Servicio dedicado**: `src/services/gastosInmuebleService.ts`.
- **Quién lee**: `src/services/treasuryOverviewService.ts:170`, `src/services/fiscalConciliationService.ts:446`, `src/services/gastosInmuebleService.ts:25`, `src/services/gastosInmuebleService.ts:54`, `src/services/gastosInmuebleService.ts:59`, `src/services/gastosInmuebleService.ts:64`.
- **Quién escribe**: `src/services/enhancedTreasuryCreationService.ts:317`, `src/services/gastosInmuebleService.ts:28`, `src/services/gastosInmuebleService.ts:38`, `src/services/declaracionDistributorService.ts:1347`, `src/services/declaracionDistributorService.ts:1373`, `src/services/declaracionDistributorService.ts:1410`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: histórico fiscal declarado por inmueble.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=109; `src/types/compromisosRecurrentes.ts:198` redirigirA?: 'viviendaHabitual' | 'gastosInmueble';; `src/types/personal.ts:651` // Mirror pattern of gastosInmueble (Inmuebles module).; `src/services/fiscalSummaryService.ts:1` // fiscalSummaryService — operates on gastosInmueble (unified store); `src/services/fiscalSummaryService.ts:13` import { gastosInmuebleService } from './gastosInmuebleService';. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `gastosPersonalesReal`
- **Schema actual**: `GastoPersonalReal`.
- **KeyPath e índices**: `src/services/db.ts:2677` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: `src/services/gastosPersonalesRealService.ts`.
- **Quién lee**: `src/services/gastosPersonalesRealService.ts:68`, `src/services/treasuryOverviewService.ts:177`, `src/components/treasury/TesoreriaV4.tsx:545`.
- **Quién escribe**: `src/services/gastosPersonalesRealService.ts:54`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: hechos reales deben vivir en movements/TE confirmado.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=0; `src/services/patronGastosPersonalesService.ts:4` // Real confirmed expenses are managed by gastosPersonalesRealService.; `src/services/gastosPersonalesRealService.ts:1` // src/services/gastosPersonalesRealService.ts; `src/services/gastosPersonalesRealService.ts:54` const id = await db.add('gastosPersonalesReal', gasto);; `src/services/gastosPersonalesRealService.ts:68` const tx = db.transaction('gastosPersonalesReal', 'readonly');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `importBatches`
- **Schema actual**: `ImportBatch` en `src/services/db.ts:1553`.
- **KeyPath e índices**: `src/services/db.ts:2337` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/utils/batchHashUtils.ts:56`.
- **Quién escribe**: `src/services/treasuryApiService.ts:753`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: trazabilidad de importación bancaria.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/utils/batchHashUtils.ts:56` const allBatches = await db.getAll('importBatches');; `src/services/treasuryApiService.ts:753` await db.add('importBatches', importBatch);; `src/services/__tests__/completeDataCleanup.test.ts:80` 'rentaMensual', 'accounts', 'movements', 'importBatches',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `inversiones`
- **Schema actual**: `PosicionInversion`.
- **KeyPath e índices**: `src/services/db.ts:2498` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 12.
- **Servicio dedicado**: `src/services/inversionesService.ts`, `src/services/inversionesFiscalService.ts`, `src/services/inversionesAportacionesImportService.ts`.
- **Quién lee**: `src/services/irpfCalculationService.ts:863`, `src/services/inversionesService.ts:52`, `src/services/inversionesService.ts:64`, `src/services/inversionesService.ts:74`, `src/services/inversionesService.ts:129`, `src/services/inversionesService.ts:144`.
- **Quién escribe**: `src/services/inversionesService.ts:122`, `src/services/inversionesService.ts:137`, `src/services/inversionesService.ts:250`, `src/services/declaracionDistributorService.ts:1115`, `src/services/declaracionDistributorService.ts:1142`, `src/services/indexaCapitalImportService.ts:428`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: posiciones financieras visibles.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=12; `src/App.tsx:78` const InversionesPage = lazyWithPreload(() => import('./modules/horizon/inversio; `src/App.tsx:437` <Route path="inversiones">; `src/App.tsx:445` <AnalisisCartera scope="inversiones" />; `src/App.tsx:586` <Route path="inversiones" element={. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `keyval`
- **Schema actual**: `any` en AtlasHorizonDB; schema real en servicios/tipos externos.
- **KeyPath e índices**: `src/services/db.ts:2513` · object store sin `keyPath` explícito por diseño; usa claves externas (`db.put('keyval', value, key)`) para registros singleton y auxiliares.
- **Registros en snapshot**: 14.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/historicalCashflowCalculator.ts:66`, `src/services/prestamosService.ts:507`, `src/services/loanSettlementService.ts:544`, `src/services/propertySaleService.ts:390`, `src/services/propertySaleService.ts:626`, `src/services/propertySaleService.ts:891`.
- **Quién escribe**: `src/services/prestamosService.ts:631`, `src/services/loanSettlementService.ts:611`, `src/services/loanSettlementService.ts:636`, `src/services/propertySaleService.ts:1208`, `src/services/propertySaleService.ts:1302`, `src/services/migrationService.ts:92`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: configuración y datos auxiliares.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=14; `src/services/historicalCashflowCalculator.ts:53` //   - Nuevo (PrestamosWizard): keyval/"planpagos_${id}" → PlanPagos.periodos[] ; `src/services/historicalCashflowCalculator.ts:65` // Nuevo formato: plan guardado en keyval; `src/services/historicalCashflowCalculator.ts:66` const plan = await (db as any).get('keyval', `planpagos_${prestamo.id}`);; `src/services/historicalCashflowCalculator.ts:132` // - Formato nuevo (PrestamosWizard): keyval/planpagos_${id} → PlanPagos.periodo. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `kpiConfigurations`
- **Schema actual**: `any` en AtlasHorizonDB; schema real en servicios/tipos externos.
- **KeyPath e índices**: `src/services/db.ts:2303` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/kpiService.ts:271`.
- **Quién escribe**: `src/services/kpiService.ts:256`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: sin datos ni mockup objetivo específico.
- **Veredicto**: **FÓSIL**.
- **Justificación**: snapshot=0; `src/services/kpiService.ts:256` await db.put('kpiConfigurations', {; `src/services/kpiService.ts:271` const config = await db.get('kpiConfigurations', module);; `src/services/__tests__/completeDataCleanup.test.ts:85` 'kpiConfigurations', 'keyval',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `learningLogs`
- **Schema actual**: `LearningLog` en `src/services/db.ts:1196`.
- **KeyPath e índices**: `src/services/db.ts:2435` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/movementLearningService.ts:613`.
- **Quién escribe**: `src/services/movementLearningService.ts:162`, `src/services/movementLearningService.ts:197`, `src/services/movementLearningService.ts:339`, `src/services/movementLearningService.ts:434`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: auditoría de reglas aprendidas.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/movementLearningService.ts:162` await db.add('learningLogs', learningLog);; `src/services/movementLearningService.ts:197` await db.add('learningLogs', learningLog);; `src/services/movementLearningService.ts:339` await db.add('learningLogs', learningLog);; `src/services/movementLearningService.ts:434` await db.add('learningLogs', learningLog);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `loan_settlements`
- **Schema actual**: `LoanSettlement` en `src/services/db.ts:207`.
- **KeyPath e índices**: `src/services/db.ts:2172` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/treasuryOverviewService.ts:175`, `src/services/loanSettlementService.ts:544`, `src/services/loanSettlementService.ts:662`.
- **Quién escribe**: `src/services/loanSettlementService.ts:592`, `src/services/__tests__/loanSettlementService.test.ts:54`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: cancelaciones de préstamos planificadas.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/treasuryOverviewService.ts:40` cancelacionesHipotecas: number;        // salida:  loan_settlements de hipotecas; `src/services/treasuryOverviewService.ts:175` db.getAll('loan_settlements'),; `src/services/loanSettlementService.ts:544` const tx = db.transaction(['prestamos', 'keyval', 'loan_settlements', 'movements; `src/services/loanSettlementService.ts:592` const settlementId = Number(await tx.objectStore('loan_settlements').add(settlem. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `matchingConfiguration`
- **Schema actual**: `MatchingConfiguration` en `src/services/db.ts:1046`.
- **KeyPath e índices**: `src/services/db.ts:2410` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/budgetMatchingService.ts:56`, `src/services/transferDetectionService.ts:147`, `src/services/transferDetectionService.ts:342`.
- **Quién escribe**: `src/services/budgetMatchingService.ts:69`, `src/services/budgetMatchingService.ts:91`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: reglas de matching presupuestario/transferencias.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/budgetMatchingService.ts:56` const configs = await db.getAll('matchingConfiguration');; `src/services/budgetMatchingService.ts:69` const id = await db.add('matchingConfiguration', config);; `src/services/budgetMatchingService.ts:91` await db.put('matchingConfiguration', updatedConfig);; `src/services/transferDetectionService.ts:147` const configs = await db.getAll('matchingConfiguration');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `mejorasInmueble`
- **Schema actual**: `?`.
- **KeyPath e índices**: `src/services/db.ts:2252` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 4.
- **Servicio dedicado**: `src/services/mejorasInmuebleService.ts`.
- **Quién lee**: `src/services/mejorasInmuebleService.ts:27`, `src/services/mejorasInmuebleService.ts:33`, `src/services/treasuryOverviewService.ts:173`, `src/services/propertySaleService.ts:1086`, `src/services/migracionGastosService.ts:77`, `src/services/documentMatchingService.ts:96`.
- **Quién escribe**: `src/services/mejorasInmuebleService.ts:12`, `src/services/migracionGastosService.ts:81`, `src/services/migrations/fixReparacionesDuplicadas.ts:15`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:295`, `src/services/__tests__/treasuryConfirmationService.test.ts:35`, `src/services/__tests__/propertyDisposalTaxService.test.ts:49`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: mejoras y reparaciones capitalizables.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=4; `src/services/aeatAmortizationService.fallback.test.ts:75` if (store === 'mejorasInmueble') {; `src/services/propertyDisposalTaxService.ts:4` import { mejorasInmuebleService } from './mejorasInmuebleService';; `src/services/propertyDisposalTaxService.ts:127` // Fallback: read from mejorasInmueble (unified store); `src/services/propertyDisposalTaxService.ts:129` const mejoras = await mejorasInmuebleService.getHastaEjercicio(propertyId, ejerc. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `movementLearningRules`
- **Schema actual**: `MovementLearningRule` en `src/services/db.ts:1179`.
- **KeyPath e índices**: `src/services/db.ts:2425` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/movementLearningService.ts:137`, `src/services/movementLearningService.ts:222`, `src/services/movementLearningService.ts:277`, `src/services/movementLearningService.ts:374`, `src/services/movementLearningService.ts:585`, `src/services/__tests__/movementLearningService.test.ts:214`.
- **Quién escribe**: `src/services/movementLearningService.ts:149`, `src/services/movementLearningService.ts:183`, `src/services/movementLearningService.ts:232`, `src/services/movementLearningService.ts:251`, `src/services/movementLearningService.ts:353`, `src/services/movementLearningService.ts:422`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: reglas de clasificación aprendidas.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/movementLearningService.ts:137` const existingRules = await db.getAllFromIndex('movementLearningRules', 'learnKe; `src/services/movementLearningService.ts:149` await db.put('movementLearningRules', rule);; `src/services/movementLearningService.ts:183` const ruleId = await db.add('movementLearningRules', newRule);; `src/services/movementLearningService.ts:222` const existingRules = await db.getAllFromIndex('movementLearningRules', 'learnKe. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `movements`
- **Schema actual**: `Movement` en `src/services/db.ts:943`.
- **KeyPath e índices**: `src/services/db.ts:2326` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 6.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/utils/duplicateDetection.ts:52`, `src/__tests__/treasuryNoMockMovements.test.ts:39`, `src/__tests__/noDefaultMovements.test.ts:29`, `src/__tests__/noDefaultMovements.test.ts:125`, `src/__tests__/productionModeIntegration.test.ts:67`, `src/__tests__/productionModeRequirements.test.ts:130`.
- **Quién escribe**: `src/__tests__/cuentasServiceOpeningBalance.test.ts:87`, `src/__tests__/cuentasServiceOpeningBalance.test.ts:97`, `src/__tests__/productionModeRequirements.test.ts:68`, `src/services/bankStatementImportService.ts:311`, `src/services/budgetReclassificationService.ts:192`, `src/services/budgetMatchingService.ts:353`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: movimientos bancarios reales.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=6; `src/tests/documentTypeDetection.test.ts:24` const file = new File(['fake excel content'], 'movements-392025.xlsx', {; `src/tests/actualSyncService.test.ts:47` it('ignores forecast-only movements', () => {; `src/tests/qaIntegration.test.ts:17` ...Array(43).fill(['03/01/2024', 'Compra', '-25,00']) // 43 more rows = 50 total; `src/tests/diagnosticEvents.test.ts:61` it('should emit MOVEMENT_CREATED event when bank statement creates movements', (. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `mueblesInmueble`
- **Schema actual**: `?`.
- **KeyPath e índices**: `src/services/db.ts:2266` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 5.
- **Servicio dedicado**: `src/services/mueblesInmuebleService.ts`.
- **Quién lee**: `src/services/mueblesInmuebleService.ts:29`, `src/services/mueblesInmuebleService.ts:35`, `src/services/propertySaleService.ts:1086`, `src/services/migracionGastosService.ts:111`, `src/services/documentMatchingService.ts:97`, `src/services/documentMatchingService.ts:225`.
- **Quién escribe**: `src/services/mueblesInmuebleService.ts:14`, `src/services/migracionGastosService.ts:115`, `src/services/lineasInmuebleService.ts:8`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:311`, `src/services/__tests__/treasuryConfirmationService.test.ts:36`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: mobiliario amortizable.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=5; `src/services/mueblesInmuebleService.ts:9` export const mueblesInmuebleService = {; `src/services/mueblesInmuebleService.ts:14` const id = await db.add('mueblesInmueble', mueble);; `src/services/mueblesInmuebleService.ts:20` const updated = (await updateLineaInmueble('mueblesInmueble', id, updates as Rec; `src/services/mueblesInmuebleService.ts:29` const items = await db.getAllFromIndex('mueblesInmueble', 'inmuebleId', inmueble. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `nominas`
- **Schema actual**: `Nomina`.
- **KeyPath e índices**: `src/services/db.ts:2457` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/nominaService.ts:91`, `src/services/nominaService.ts:92`, `src/services/nominaService.ts:94`, `src/services/nominaService.ts:108`, `src/services/nominaService.ts:109`, `src/services/nominaService.ts:139`.
- **Quién escribe**: `src/services/nominaService.ts:92`, `src/services/nominaService.ts:109`, `src/services/nominaService.ts:140`, `src/services/nominaService.ts:156`, `src/services/nominaService.ts:187`, `src/services/nominaService.ts:222`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: ingresos laborales Personal.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=1; `src/tests/irpfAccesorios.test.ts:36` if (store === 'nominas') return Promise.resolve([]);; `src/services/informesDataService.ts:51` nominas: number;; `src/services/informesDataService.ts:198` nominas: 0,; `src/services/informesDataService.ts:430` const nominas = projection.months.reduce((sum, month) => sum + toNumber(month.in. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `objetivos`
- **Schema actual**: `Objetivo`.
- **KeyPath e índices**: `src/services/db.ts:3059` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: `src/services/objetivosService.ts`.
- **Quién lee**: `src/App.tsx:508`, `src/services/objetivosService.ts:110`, `src/services/objetivosService.ts:120`, `src/services/objetivosService.ts:137`, `src/services/objetivosService.ts:177`, `src/services/objetivosService.ts:180`.
- **Quién escribe**: `src/__tests__/objetivosService.test.ts:68`, `src/__tests__/objetivosService.test.ts:277`, `src/__tests__/objetivosService.test.ts:294`, `src/services/objetivosService.ts:102`, `src/services/objetivosService.ts:148`, `src/services/objetivosService.ts:169`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: Mi Plan v3; metas explícitas.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/App.tsx:141` const MiPlanObjetivos = lazyWithPreload(() => import('./modules/horizon/mi-plan/; `src/App.tsx:498` <Route path="objetivos" element={; `src/App.tsx:508` <Route index element={<Navigate to="/mi-plan/objetivos" replace />} />; `src/__tests__/objetivosService.test.ts:1` // Tests para objetivosService (Mi Plan v3) — store 'objetivos' (lista). La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `operacionesProveedor`
- **Schema actual**: `OperacionProveedor` en `src/services/db.ts:430`.
- **KeyPath e índices**: `src/services/db.ts:2224` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 15.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/migrations/migrateOrphanedInmuebleIds.ts:322`.
- **Quién escribe**: `src/services/declaracionDistributorService.ts:1557`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:328`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: duplica proveedor+gasto anual; puede normalizarse.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=15; `src/services/declaracionDistributorService.ts:1557` await db.add('operacionesProveedor', {; `src/services/declaracionDistributorService.ts:1570` invalidateCachedStores(['proveedores', 'operacionesProveedor']);; `src/services/migrations/migrateOrphanedInmuebleIds.ts:320` // operacionesProveedor; `src/services/migrations/migrateOrphanedInmuebleIds.ts:322` const all = await db.getAll('operacionesProveedor');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `opexRules`
- **Schema actual**: `OpexRule` en `src/services/db.ts:1811`.
- **KeyPath e índices**: `src/services/db.ts:2541` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/propertySaleService.ts:634`, `src/services/propertySaleService.ts:1086`, `src/services/treasuryForecastService.ts:599`, `src/services/__tests__/propertySaleService.test.ts:423`, `src/services/__tests__/propertySaleService.test.ts:436`, `src/modules/horizon/tesoreria/services/treasurySyncService.ts:235`.
- **Quién escribe**: `src/services/propertySaleService.ts:918`, `src/services/propertySaleService.ts:1214`, `src/services/__tests__/propertySaleService.test.ts:48`, `src/services/__tests__/propertySaleService.test.ts:367`, `src/services/__tests__/recurringExpensesFiscalService.test.ts:22`, `src/services/__tests__/recurringExpensesFiscalService.test.ts:32`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: deprecated; migrado a compromisos.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=0; `src/types/compromisosRecurrentes.ts:8` // `opexRules` + `patronGastosPersonales`).; `src/services/propertyExpenses.ts:182` // V5.4+: read from compromisosRecurrentes (ambito='inmueble') instead of opexRu; `src/services/navigationPerformanceService.ts:47` { match: (href) => href === '/inmuebles' || href.startsWith('/inmuebles/analisis; `src/services/operacionFiscalService.ts:179` // V5.4+: read from compromisosRecurrentes (ambito='inmueble') instead of opexRu. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `otrosIngresos`
- **Schema actual**: `OtrosIngresos`.
- **KeyPath e índices**: `src/services/db.ts:2489` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: `src/services/otrosIngresosService.ts`.
- **Quién lee**: `src/services/otrosIngresosService.ts:22`, `src/services/otrosIngresosService.ts:23`, `src/services/otrosIngresosService.ts:52`, `src/services/otrosIngresosService.ts:53`, `src/services/otrosIngresosService.ts:80`, `src/services/otrosIngresosService.ts:81`.
- **Quién escribe**: `src/services/otrosIngresosService.ts:23`, `src/services/otrosIngresosService.ts:53`, `src/services/otrosIngresosService.ts:81`, `src/services/otrosIngresosService.ts:111`, `src/services/personalResumenService.ts:24`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: ingresos personales no laborales previsto.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/types/personal.ts:502` otrosIngresos: boolean;; `src/services/otrosIngresosService.ts:22` const transaction = db.transaction(['otrosIngresos'], 'readonly');; `src/services/otrosIngresosService.ts:23` const store = transaction.objectStore('otrosIngresos');; `src/services/otrosIngresosService.ts:52` const transaction = db.transaction(['otrosIngresos'], 'readwrite');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `patrimonioSnapshots`
- **Schema actual**: `PatrimonioSnapshot` en `src/services/db.ts:1790`.
- **KeyPath e índices**: `src/services/db.ts:2506` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/dashboardService.ts:625`, `src/services/dashboardService.ts:695`.
- **Quién escribe**: `src/services/dashboardService.ts:699`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: snapshot agregado duplicado con valoración mensual.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=1; `src/services/dashboardService.ts:625` const snapshots = await db.getAllFromIndex('patrimonioSnapshots', 'fecha');; `src/services/dashboardService.ts:695` const existing = await db.getAllFromIndex('patrimonioSnapshots', 'fecha');; `src/services/dashboardService.ts:699` await db.add('patrimonioSnapshots', snapshot);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `patronGastosPersonales`
- **Schema actual**: `PatronGastoPersonal`.
- **KeyPath e índices**: `src/services/db.ts:2669` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 7.
- **Servicio dedicado**: `src/services/patronGastosPersonalesService.ts`.
- **Quién lee**: `src/services/patronGastosPersonalesService.ts:13`, `src/services/patronGastosPersonalesService.ts:33`.
- **Quién escribe**: `src/services/patronGastosPersonalesService.ts:27`, `src/services/patronGastosPersonalesService.ts:36`, `src/services/patronGastosPersonalesService.ts:42`, `src/services/patronGastosPersonalesService.ts:142`, `src/services/patronGastosPersonalesService.ts:158`, `src/services/patronGastosPersonalesService.ts:201`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: sustituido por compromisos recurrentes.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=7; `src/types/compromisosRecurrentes.ts:8` // `opexRules` + `patronGastosPersonales`).; `src/types/personal.ts:657` patronId?: number;                  // FK to patronGastosPersonales (null if one; `src/services/patronGastosPersonalesService.ts:1` // src/services/patronGastosPersonalesService.ts; `src/services/patronGastosPersonalesService.ts:13` const tx = db.transaction('patronGastosPersonales', 'readonly');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `pensiones`
- **Schema actual**: `PensionIngreso`.
- **KeyPath e índices**: `src/services/db.ts:2547` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/pensionService.ts:20`, `src/services/pensionService.ts:21`, `src/services/pensionService.ts:23`, `src/services/pensionService.ts:37`, `src/services/pensionService.ts:65`, `src/services/pensionService.ts:95`.
- **Quién escribe**: `src/services/pensionService.ts:21`, `src/services/pensionService.ts:38`, `src/services/pensionService.ts:66`, `src/services/pensionService.ts:96`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: ingresos de pensión previstos.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/tests/enhancedFeinOcr.test.ts:67` 'plan de pensiones activo 0,30%',; `src/types/inversiones.ts:15` | 'plan_pensiones'; `src/types/inversiones-extended.ts:112` tipo: 'fondo_inversion' | 'plan_pensiones' | 'plan_empleo' | 'crypto' | 'otro';; `src/types/inversiones-extended.ts:140` return ['fondo_inversion', 'plan_pensiones', 'plan_empleo', 'crypto', 'otro'].in. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `perdidasPatrimonialesAhorro`
- **Schema actual**: `PerdidaPatrimonialAhorro` en `src/services/db.ts:1356`.
- **KeyPath e índices**: `src/services/db.ts:2622` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/compensacionAhorroService.ts:97`, `src/services/compensacionAhorroService.ts:341`.
- **Quién escribe**: `src/services/fiscalLifecycleService.ts:204`, `src/services/compensacionAhorroService.ts:268`, `src/services/compensacionAhorroService.ts:278`, `src/services/compensacionAhorroService.ts:291`, `src/services/compensacionAhorroService.ts:356`, `src/services/compensacionAhorroService.ts:382`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: arrastres fiscal ahorro.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/types/fiscal.ts:217` perdidasPatrimonialesAhorro: ArrastrePerdidasAhorro[];; `src/types/fiscal.ts:313` perdidasPatrimonialesAhorro: [],; `src/services/ejercicioFiscalService.ts:44` const perdidasPatrimonialesAhorro = arrastres?.perdidasPatrimonialesAhorro ?? ar; `src/services/ejercicioFiscalService.ts:49` perdidasPatrimonialesAhorro: clone(perdidasPatrimonialesAhorro),. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `personalData`
- **Schema actual**: `PersonalData`.
- **KeyPath e índices**: `src/services/db.ts:2446` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: `src/services/personalDataService.ts`.
- **Quién lee**: `src/services/patronGastosPersonalesService.ts:14`, `src/services/patronGastosPersonalesService.ts:15`, `src/services/otrosIngresosService.ts:24`, `src/services/otrosIngresosService.ts:25`, `src/services/gastosPersonalesRealService.ts:69`, `src/services/gastosPersonalesRealService.ts:70`.
- **Quién escribe**: `src/services/personalOnboardingService.ts:209`, `src/services/personalOnboardingService.ts:244`, `src/services/personalDataService.ts:26`, `src/services/personalDataService.ts:42`, `src/services/personalDataService.ts:54`, `src/services/__tests__/declaracionOnboardingService.test.ts:159`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: perfil fiscal/personal base.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=1; `src/tests/irpfAccesorios.test.ts:17` jest.mock('../services/personalDataService', () => ({; `src/tests/irpfAccesorios.test.ts:18` personalDataService: {; `src/__tests__/situacionLaboralMultiSelect.test.ts:7` import { personalDataService } from '../services/personalDataService';; `src/__tests__/situacionLaboralMultiSelect.test.ts:27` const result = personalDataService.validateSituacionLaboral([]);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `personalModuleConfig`
- **Schema actual**: `PersonalModuleConfig`.
- **KeyPath e índices**: `src/services/db.ts:2452` · keyPath: 'personalDataId'.
- **Registros en snapshot**: 1.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/personalDataService.ts:73`, `src/services/personalDataService.ts:74`, `src/services/personalDataService.ts:89`, `src/services/personalDataService.ts:90`.
- **Quién escribe**: `src/services/personalDataService.ts:74`, `src/services/personalDataService.ts:90`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: config módulo Personal.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=1; `src/services/personalDataService.ts:73` const transaction = db.transaction(['personalModuleConfig'], 'readonly');; `src/services/personalDataService.ts:74` const store = transaction.objectStore('personalModuleConfig');; `src/services/personalDataService.ts:89` const transaction = db.transaction(['personalModuleConfig'], 'readwrite');; `src/services/personalDataService.ts:90` const store = transaction.objectStore('personalModuleConfig');. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `planesPensionInversion`
- **Schema actual**: `PlanPensionInversion`.
- **KeyPath e índices**: `src/services/db.ts:2471` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/inversionesService.ts:266`, `src/services/traspasosPlanesService.ts:87`, `src/services/traspasosPlanesService.ts:132`, `src/services/traspasosPlanesService.ts:164`, `src/services/traspasosPlanesService.ts:196`, `src/services/traspasosPlanesService.ts:231`.
- **Quién escribe**: `src/services/declaracionDistributorService.ts:1060`, `src/services/declaracionDistributorService.ts:1064`, `src/services/valoracionesService.ts:223`, `src/services/planesInversionService.ts:36`, `src/services/planesInversionService.ts:53`, `src/services/planesInversionService.ts:81`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: planes de pensiones separados de inversión operativa.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/types/personal.ts:387` //   - `planesPensionInversion` (store dedicado en Personal → Planes); `src/types/personal.ts:389` export type PlanStore = 'planesPensionInversion' | 'inversiones';; `src/services/inversionesService.ts:266` const planes = await db.getAll('planesPensionInversion');; `src/services/traspasosPlanesService.ts:11` //   - Soporta planes en ambos stores: `planesPensionInversion` (store. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `prestamos`
- **Schema actual**: `any` en AtlasHorizonDB; schema real en servicios/tipos externos.
- **KeyPath e índices**: `src/services/db.ts:2518` · keyPath: 'id'.
- **Registros en snapshot**: 13.
- **Servicio dedicado**: `src/services/prestamosService.ts`, `src/services/prestamosCalculationService.ts`.
- **Quién lee**: `src/services/objetivosService.ts:41`, `src/services/reconciliacionService.ts:643`, `src/services/historicalCashflowCalculator.ts:133`, `src/services/loanService.ts:37`, `src/services/loanService.ts:42`, `src/services/prestamosService.ts:193`.
- **Quién escribe**: `src/services/loanService.ts:31`, `src/services/loanService.ts:83`, `src/services/loanService.ts:88`, `src/services/prestamosService.ts:207`, `src/services/prestamosService.ts:219`, `src/services/loanSettlementService.ts:614`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: deuda y financiación.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=13; `src/tests/enhancedAmortization.test.ts:4` import { prestamosService } from '../services/prestamosService';; `src/tests/enhancedAmortization.test.ts:5` import { Prestamo } from '../types/prestamos';; `src/tests/enhancedAmortization.test.ts:32` prestamosService.clearCache();; `src/tests/enhancedAmortization.test.ts:38` const loan = await prestamosService.createPrestamo(mockLoanData);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `presupuestoLineas`
- **Schema actual**: `PresupuestoLinea` en `src/services/db.ts:1681`.
- **KeyPath e índices**: `src/services/db.ts:2391` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/budgetReclassificationService.ts:156`, `src/services/budgetReclassificationService.ts:157`, `src/services/budgetMatchingService.ts:120`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:73`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:76`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:89`.
- **Quién escribe**: `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:76`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:79`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:105`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:132`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:149`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:394`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: roadmap presupuesto y matching.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/budgetReclassificationService.ts:99` async function findBudgetMatch(movement: Movement, presupuestoLineas: Presupuest; `src/services/budgetReclassificationService.ts:107` for (const linea of presupuestoLineas) {; `src/services/budgetReclassificationService.ts:156` // Use presupuestoId index to avoid full scan of presupuestoLineas; `src/services/budgetReclassificationService.ts:157` const periodLineas = await db.getAllFromIndex('presupuestoLineas', 'presupuestoI. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `presupuestos`
- **Schema actual**: `Presupuesto` en `src/services/db.ts:1668`.
- **KeyPath e índices**: `src/services/db.ts:2384` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/budgetMatchingService.ts:111`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:16`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:18`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:25`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:50`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:73`.
- **Quién escribe**: `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:43`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:59`, `src/modules/horizon/proyeccion/presupuesto/services/presupuestoService.ts:83`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: roadmap presupuesto anual.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/budgetMatchingService.ts:111` const presupuestos = await db.getAll('presupuestos');; `src/services/budgetMatchingService.ts:112` const activeBudget = presupuestos.find(p => p.year === year && p.estado === 'Act; `src/pages/account/DatosTab.tsx:317` <li>Movimientos bancarios, presupuestos, conciliación</li>; `src/services/__tests__/completeDataCleanup.test.ts:83` 'presupuestos', 'presupuestoLineas', 'matchingConfiguration',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `properties`
- **Schema actual**: `Property` en `src/services/db.ts:61`.
- **KeyPath e índices**: `src/services/db.ts:2158` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 8.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/fiscalSummaryService.ts:106`, `src/services/fiscalSummaryService.ts:199`, `src/services/fiscalSummaryService.ts:324`, `src/services/irpfCalculationService.ts:547`, `src/services/informesDataService.ts:493`, `src/services/propertyDisposalTaxService.ts:241`.
- **Quién escribe**: `src/services/inmuebleService.ts:277`, `src/services/declaracionDistributorService.ts:202`, `src/services/declaracionDistributorService.ts:500`, `src/services/declaracionDistributorService.ts:502`, `src/services/declaracionDistributorService.ts:503`, `src/services/declaracionDistributorService.ts:507`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: activos inmobiliarios.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=8; `src/tests/dashboardTests.ts:5` * Test Case 1: Preset A (≤3 properties); `src/tests/dashboardTests.ts:18` console.assert(config.preset === 'preset-a', 'Should use preset A for ≤3 propert; `src/tests/dashboardTests.ts:42` * Test Case 2: Preset B (>3 properties); `src/tests/dashboardTests.ts:55` console.assert(config.preset === 'preset-b', 'Should use preset B for >3 propert. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `propertyDays`
- **Schema actual**: `PropertyDays` en `src/services/db.ts:843`.
- **KeyPath e índices**: `src/services/db.ts:2209` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/irpfCalculationService.ts:600`, `src/services/propertyOccupancyService.ts:10`, `src/services/aeatAmortizationService.ts:298`.
- **Quién escribe**: `src/services/propertyOccupancyService.ts:34`, `src/services/propertyOccupancyService.ts:64`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: días fiscales manuales/ocupación.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/tests/irpfAccesorios.test.ts:31` function buildMockDB(properties: any[], contracts: any[] = [], propertyDays: any; `src/tests/irpfAccesorios.test.ts:42` if (store === 'propertyDays') return Promise.resolve(propertyDays);; `src/tests/irpfAccesorios.test.ts:334` describe('Prioridad contratos vs propertyDays auto', () => {; `src/tests/irpfAccesorios.test.ts:335` it('usa contratos cuando propertyDays no es manual (evita 0€ por datos auto desf. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `property_sales`
- **Schema actual**: `PropertySale` en `src/services/db.ts:160`.
- **KeyPath e índices**: `src/services/db.ts:2164` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/treasuryOverviewService.ts:172`, `src/services/propertySaleService.ts:1062`, `src/services/propertySaleService.ts:1086`, `src/services/propertySaleService.ts:1279`, `src/services/propertySaleService.ts:1286`, `src/pages/GestionInmuebles/GestionInmueblesList.tsx:64`.
- **Quién escribe**: `src/services/propertySaleService.ts:841`, `src/services/propertySaleService.ts:1034`, `src/services/propertySaleService.ts:1088`, `src/services/propertySaleService.ts:1330`, `src/services/__tests__/propertyDisposalTaxService.test.ts:48`, `src/services/__tests__/propertyDisposalTaxService.test.ts:56`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: ventas inmobiliarias previstas.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/services/treasuryOverviewService.ts:172` db.getAll('property_sales'),; `src/services/historicalCashflowCalculator.ts:35` ventasNetas: number;              // de property_sales; `src/services/propertySaleService.ts:695` 'properties', 'contracts', 'property_sales', 'accounts', 'movements',; `src/services/propertySaleService.ts:841` const rawSaleId = await tx.objectStore('property_sales').add(sale);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `proveedores`
- **Schema actual**: `Proveedor` en `src/services/db.ts:422`.
- **KeyPath e índices**: `src/services/db.ts:2219` · keyPath: 'nif'.
- **Registros en snapshot**: 11.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/declaracionDistributorService.ts:1539`.
- **Quién escribe**: `src/services/declaracionDistributorService.ts:1544`, `src/services/declaracionDistributorService.ts:1547`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: entidades fiscales detectadas por XML.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=11; `src/types/declaracionCompleta.ts:189` proveedores: ProveedorDetectado[];; `src/types/declaracionCompleta.ts:216` proveedores: ProveedorDetectado[];; `src/types/informeDistribucion.ts:35` proveedores: ProveedorDistribuido[];; `src/types/informeDistribucion.ts:71` proveedoresNuevos: number;. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `reconciliationAuditLogs`
- **Schema actual**: `ReconciliationAuditLog` en `src/services/db.ts:1166`.
- **KeyPath e índices**: `src/services/db.ts:2416` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: no halladas.
- **Quién escribe**: `src/services/budgetReclassificationService.ts:203`, `src/services/movementLearningService.ts:544`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: auditabilidad de conciliación.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/budgetReclassificationService.ts:203` await db.add('reconciliationAuditLogs', auditLog);; `src/services/movementLearningService.ts:544` await db.add('reconciliationAuditLogs', auditLog);; `src/services/__tests__/movementLearningService.test.ts:152` const stores = ['movements', 'movementLearningRules', 'learningLogs', 'reconcili. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `rentaMensual`
- **Schema actual**: `RentaMensual` en `src/services/db.ts:758`.
- **KeyPath e índices**: `src/services/db.ts:2310` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/informesDataService.ts:557`, `src/services/informesDataService.ts:611`, `src/services/rendimientoActivoService.ts:133`, `src/services/propertySaleService.ts:635`, `src/services/vinculacionFiscalService.ts:104`, `src/services/contractService.ts:184`.
- **Quién escribe**: `src/services/contractService.ts:193`, `src/services/contractService.ts:266`, `src/services/contractService.ts:281`, `src/services/__tests__/declaracionOnboardingService.test.ts:161`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: deprecated; contrato escalar + eventos.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=0; `src/tests/irpfAccesorios.test.ts:80` rentaMensual: 1000,; `src/tests/irpfAccesorios.test.ts:271` rentaMensual: 1000,; `src/utils/propertyAnalysisUtils.ts:204` const ingresosFromContracts = activeContracts.reduce((sum, contract) => sum + (c; `src/__tests__/contractsListaEnhanced.test.tsx:69` rentaMensual: 1000,. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `resultadosEjercicio`
- **Schema actual**: `ResultadoEjercicio` en `src/services/db.ts:1298`.
- **KeyPath e índices**: `src/services/db.ts:2603` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/fiscalHistoryService.ts:119`.
- **Quién escribe**: `src/services/fiscalHistoryService.ts:129`, `src/services/__tests__/fiscalLifecycleService.test.ts:38`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: resultado fiscal anual inmutable.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/fiscalLifecycleService.ts:19` const RESULTADOS_STORE = 'resultadosEjercicio';; `src/services/fiscalHistoryService.ts:119` const resultado = await db.get('resultadosEjercicio', ejercicioFiscal.resultadoE; `src/services/fiscalHistoryService.ts:129` await db.delete('resultadosEjercicio', ejercicioFiscal.resultadoEjercicioId);; `src/services/ejercicioFiscalMigration.ts:271` 'resultadosEjercicio',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `retos`
- **Schema actual**: `Reto`.
- **KeyPath e índices**: `src/services/db.ts:3087` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: `src/services/retosService.ts`.
- **Quién lee**: `src/__tests__/retosService.test.ts:210`, `src/services/retosService.ts:89`, `src/services/retosService.ts:102`, `src/services/retosService.ts:116`, `src/services/retosService.ts:139`, `src/services/retosService.ts:174`.
- **Quién escribe**: `src/__tests__/retosService.test.ts:59`, `src/__tests__/retosService.test.ts:246`, `src/services/retosService.ts:68`, `src/services/retosService.ts:154`, `src/services/retosService.ts:178`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: Mi Plan v3; reto mensual.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/__tests__/patronCalendario.test.ts:68` describe('anualMesesConcretos', () => {; `src/__tests__/patronCalendario.test.ts:71` { tipo: 'anualMesesConcretos', mesesPago: [6, 11], diaPago: 5 },; `src/__tests__/retosService.test.ts:1` // Tests para retosService (Mi Plan v3) — store 'retos'; `src/__tests__/retosService.test.ts:26` } from '../services/retosService';. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

#### `snapshotsDeclaracion`
- **Schema actual**: `SnapshotDeclaracion` en `src/services/db.ts:1415`.
- **KeyPath e índices**: `src/services/db.ts:2630` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/fiscalResolverService.ts:327`, `src/services/fiscalResolverService.ts:342`, `src/services/declaracionResolverService.ts:19`, `src/services/__tests__/fiscalLifecycleService.test.ts:82`, `src/services/__tests__/snapshotDeclaracionService.test.ts:141`.
- **Quién escribe**: `src/services/fiscalHistoryService.ts:115`, `src/services/__tests__/declaracionResolverService.test.ts:25`, `src/services/__tests__/declaracionResolverService.test.ts:30`, `src/services/__tests__/fiscalYearLifecycleService.test.ts:20`, `src/services/__tests__/fiscalLifecycleService.test.ts:40`, `src/services/__tests__/snapshotDeclaracionService.test.ts:41`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: foto declaración importada.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/snapshotDeclaracionService.ts:27` const STORE_NAME = 'snapshotsDeclaracion';; `src/services/fiscalResolverService.ts:327` // Try to also get declaracionCompleta from snapshotsDeclaracion store; `src/services/fiscalResolverService.ts:339` // Fallback: try snapshotsDeclaracion store; `src/services/fiscalResolverService.ts:342` const snapshots = (await db.getAllFromIndex('snapshotsDeclaracion', 'ejercicio',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `traspasosPlanes`
- **Schema actual**: `TraspasoPlan`.
- **KeyPath e índices**: `src/services/db.ts:2481` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: `src/services/traspasosPlanesService.ts`.
- **Quién lee**: `src/services/traspasosPlanesService.ts:374`, `src/services/traspasosPlanesService.ts:388`, `src/services/traspasosPlanesService.ts:405`.
- **Quién escribe**: `src/services/traspasosPlanesService.ts:356`, `src/services/traspasosPlanesService.ts:419`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: eventos de traspaso entre planes.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=0; `src/services/traspasosPlanesService.ts:1` // src/services/traspasosPlanesService.ts; `src/services/traspasosPlanesService.ts:5` //   - El traspaso es un evento propio; se persiste en `traspasosPlanes` para; `src/services/traspasosPlanesService.ts:264` export const traspasosPlanesService = {; `src/services/traspasosPlanesService.ts:356` const id = await db.add('traspasosPlanes', record);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `treasuryEvents`
- **Schema actual**: `TreasuryEvent` en `src/services/db.ts:1097`.
- **KeyPath e índices**: `src/services/db.ts:2344` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 13.
- **Servicio dedicado**: `src/services/treasuryEventsService.ts`.
- **Quién lee**: `src/__tests__/treasurySyncServiceInversiones.test.ts:81`, `src/__tests__/treasurySyncServiceInversiones.test.ts:100`, `src/__tests__/treasurySyncServiceInversiones.test.ts:146`, `src/services/inversionesService.ts:234`, `src/services/treasuryTransferService.ts:93`, `src/services/fiscalConciliationService.ts:447`.
- **Quién escribe**: `src/services/inversionesService.ts:237`, `src/services/treasuryTransferService.ts:69`, `src/services/treasuryTransferService.ts:90`, `src/services/treasuryTransferService.ts:95`, `src/services/loanSettlementService.ts:555`, `src/services/loanSettlementService.ts:594`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: previsión presente/futuro.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=13; `src/__tests__/accountBalanceService.test.ts:36` treasuryEvents: [; `src/__tests__/accountBalanceService.test.ts:64` treasuryEvents: [; `src/__tests__/accountBalanceService.test.ts:87` treasuryEvents: [],; `src/__tests__/accountBalanceService.test.ts:119` treasuryEvents: [. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `treasuryRecommendations`
- **Schema actual**: `TreasuryRecommendation` en `src/services/db.ts:1209`.
- **KeyPath e índices**: `src/services/db.ts:2371` · keyPath: 'id'.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/treasuryForecastService.ts:253`, `src/modules/horizon/tesoreria/components/RadarPanel.tsx:133`.
- **Quién escribe**: `src/services/treasuryForecastService.ts:256`, `src/services/treasuryForecastService.ts:307`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: recomendaciones recalculables desde TE/movements.
- **Veredicto**: **FÓSIL**.
- **Justificación**: snapshot=0; `src/services/treasuryForecastService.ts:253` const existingRecs = await db.getAll('treasuryRecommendations');; `src/services/treasuryForecastService.ts:256` await db.delete('treasuryRecommendations', rec.id!);; `src/services/treasuryForecastService.ts:307` await db.add('treasuryRecommendations', recommendation);; `src/services/__tests__/completeDataCleanup.test.ts:81` 'treasuryEvents', 'treasuryRecommendations',. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `valoraciones_historicas`
- **Schema actual**: `any` en AtlasHorizonDB; schema real en servicios/tipos externos.
- **KeyPath e índices**: `src/services/db.ts:2526` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 180.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/informesDataService.ts:494`, `src/services/inversionesService.ts:242`, `src/services/valoracionesService.ts:94`, `src/services/valoracionesService.ts:108`, `src/services/valoracionesService.ts:120`, `src/services/valoracionesService.ts:141`.
- **Quién escribe**: `src/services/inversionesService.ts:245`, `src/services/valoracionesService.ts:211`, `src/services/valoracionesService.ts:213`, `src/services/valoracionesService.ts:394`, `src/services/valoracionesService.ts:396`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: histórico de valoración por activo.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=180; `src/types/personal.ts:395` // ligado al plan donde ocurrió (activo_id en valoraciones_historicas).; `src/services/informesDataService.ts:494` safe(db.getAll('valoraciones_historicas'), [] as ValoracionHistorica[]),; `src/services/inversionesService.ts:242` const allValoraciones: any[] = await db.getAll('valoraciones_historicas');; `src/services/inversionesService.ts:245` await db.delete('valoraciones_historicas', v.id);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `valoraciones_mensuales`
- **Schema actual**: `any` en AtlasHorizonDB; schema real en servicios/tipos externos.
- **KeyPath e índices**: `src/services/db.ts:2535` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 115.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/valoracionesService.ts:257`, `src/services/valoracionesService.ts:286`, `src/services/valoracionesService.ts:293`.
- **Quién escribe**: `src/services/valoracionesService.ts:274`, `src/services/valoracionesService.ts:276`.
- **Mockups que lo necesitan**: ningún mockup objetivo debe leerlo directamente.
- **Propósito declarado**: snapshot mensual duplicable desde histórico.
- **Veredicto**: **DUPLICADO**.
- **Justificación**: snapshot=115; `src/services/valoracionesService.ts:172` * 4. Guarda snapshot en valoraciones_mensuales; `src/services/valoracionesService.ts:257` const snapshots: ValoracionesMensuales[] = await db.getAll('valoraciones_mensual; `src/services/valoracionesService.ts:274` await db.put('valoraciones_mensuales', { ...snapshot, id: prevSnapshot.id });; `src/services/valoracionesService.ts:276` await db.add('valoraciones_mensuales', snapshot);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: bajo/medio: requiere cambiar consumidores legacy hacia el destino indicado.

#### `vinculosAccesorio`
- **Schema actual**: `VinculoAccesorio` en `src/services/db.ts:1957`.
- **KeyPath e índices**: `src/services/db.ts:2651` · keyPath: 'id', autoIncrement: true.
- **Registros en snapshot**: 4.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: `src/services/migrations/migrateOrphanedInmuebleIds.ts:376`.
- **Quién escribe**: `src/services/declaracionDistributorService.ts:983`, `src/services/migrations/migrateOrphanedInmuebleIds.ts:383`.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: relación parking/trastero fiscal.
- **Veredicto**: **VIVO**.
- **Justificación**: snapshot=4; `src/types/informeDistribucion.ts:37` vinculosAccesorio: VinculoAccesorio[];; `src/services/declaracionDistributorService.ts:266` // Persistir vínculos accesorio (parking/trastero) al store vinculosAccesorio; `src/services/declaracionDistributorService.ts:963` 'vinculosAccesorio',; `src/services/declaracionDistributorService.ts:983` await db.add('vinculosAccesorio', vinculo);. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: alto: rompería pantallas o servicios activos.

#### `viviendaHabitual`
- **Schema actual**: `ViviendaHabitual`.
- **KeyPath e índices**: ver definición de upgrade en src/services/db.ts.
- **Registros en snapshot**: 0.
- **Servicio dedicado**: no evidente por nombre; ver referencias.
- **Quién lee**: no halladas.
- **Quién escribe**: no halladas.
- **Mockups que lo necesitan**: Mi Plan / Tesorería / Fiscal / módulo propio según dominio.
- **Propósito declarado**: ficha hogar/vivienda Personal prevista.
- **Veredicto**: **HUÉRFANO**.
- **Justificación**: snapshot=0; `src/types/compromisosRecurrentes.ts:56` // Esos compromisos se derivan automáticamente de `viviendaHabitual` (sección; `src/types/compromisosRecurrentes.ts:132` fuente: 'viviendaHabitual' | 'manual' | 'importeCSV' | 'opexRule';; `src/types/compromisosRecurrentes.ts:198` redirigirA?: 'viviendaHabitual' | 'gastosInmueble';; `src/types/personal.ts:7` //   - `viviendaHabitual`       → src/types/viviendaHabitual.ts. La acción se define considerando que el plan aceptado es wipe + reimport y no preservación campo a campo.
- **Riesgos al eliminar**: medio: falta cerrar flujo/UI antes de limpiar.

### 2.2 Respuestas arquitectónicas críticas

#### P1 · Treasury vs `gastosInmueble`
El código ya declara `treasuryEvents = lo previsto/pendiente` y `movements = lo confirmado` en `src/services/treasuryConfirmationService.ts:5-20`; al confirmar eventos de inmueble crea líneas en `gastosInmueble`/`mejorasInmueble`/`mueblesInmueble`. Recomendación: `treasuryEvents` manda en presente/futuro operativo; `gastosInmueble` queda como histórico fiscal declarado y evidencia anual. La conexión correcta es confirmación/reconciliación: evento ejecutado + movimiento bancario + línea fiscal cuando la categoría sea deducible. No debe generarse forecast futuro directamente desde `gastosInmueble`, salvo bootstrap sugerido para compromisos iniciales.

#### P2 · `compromisosRecurrentes`
`opexService.ts:189-323` ya escribe y lee `compromisosRecurrentes` y marca `opexRules` como deprecated. Recomendación: híbrido controlado: primer arranque propone compromisos desde patrones repetidos de `gastosInmueble` histórico, pero los crea como borradores/confirmados por usuario; después la fuente viva es manual/UI o importes CSV, no `gastosInmueble`. Así se evita duplicar histórico fiscal con catálogo futuro y se aprovechan XMLs para acelerar onboarding.

#### P3 · `accounts.balance`
`accountBalanceService.ts:21-75` calcula saldo como `openingBalance + treasuryEvents comprometidos + movements`, y `rollForwardAccountBalancesToMonth` persiste `accounts.balance` como cache (`src/services/accountBalanceService.ts:97-123`). Recomendación: `openingBalance` y `openingBalanceDate` son persistidos; `balance` debe tratarse como cache derivada recalculable, nunca como fuente de verdad. Las pantallas pueden leerlo por rendimiento, pero cualquier discrepancia se resuelve recalculando desde movimientos/eventos. La invalidación debe dispararse tras importar o borrar `movements`, confirmar/revertir `treasuryEvents`, editar `openingBalance/openingBalanceDate` o cambiar el estado activo de una cuenta; si falla el recalculo, la UI debe mostrar el saldo calculado on-demand y marcar la cache como pendiente de sincronización.

#### P4 · Renta mensual
El mapeo Mi Plan definitivo indica que `contracts.rentaMensual` es el dato vigente y `rentaMensual` store está deprecated/0 registros. `contractService.ts:72-150` aún genera/regenera `rentaMensual`, pero `fiscalSummaryService.ts:118-138` calcula ingresos desde `contracts.rentaMensual`. Recomendación: mantener renta actual y términos vigentes en `contracts`; añadir histórico embebido `historicoRentas[]` dentro del contrato para revisiones/IPC/IRAV; eliminar store `rentaMensual` y generar `treasuryEvents` mensuales desde contrato + histórico.

### 2.3 Hallazgos transversales

- Hay stores con datos altos que son derivados (`valoraciones_mensuales`, `patrimonioSnapshots`); deben recalcularse o consolidarse para reducir drift.
- Hay stores vacíos pero legítimos por roadmap (`escenarios`, `objetivos`, `fondos_ahorro`, `retos`, `viviendaHabitual`). No eliminarlos por estar vacíos.
- Los stores deprecated (`opexRules`, `rentaMensual`, `ejerciciosFiscales`) deben desaparecer antes de reanudar el mapeo de componentes.
- Mi Plan lee de todo pero solo escribe sus 4 entidades propias, según `HANDOFF-V4-atlas.md:51-58`.

## 3. SUB-TAREA B · Diseño objetivo

### 3.1 Tabla resumen stores objetivo

| Dominio | Stores objetivo | Justificación |
|---|---|---|
| Activos físicos | `properties`, `property_sales`, `mejorasInmueble`, `mueblesInmueble`, `vinculosAccesorio`, `propertyDays` | Separación por fuente de verdad y ciclo de vida propio. |
| Activos financieros | `inversiones`, `planesPensionInversion`, `valoraciones_historicas`, `traspasosPlanes` | Separación por fuente de verdad y ciclo de vida propio. |
| Financiación | `prestamos`, `loan_settlements` | Separación por fuente de verdad y ciclo de vida propio. |
| Contratos e ingresos | `contracts`, `nominas`, `autonomos`, `otrosIngresos`, `pensiones` | Separación por fuente de verdad y ciclo de vida propio. |
| Tesorería presente/futuro | `accounts`, `movements`, `treasuryEvents`, `importBatches`, `matchingConfiguration`, `movementLearningRules`, `learningLogs`, `reconciliationAuditLogs` | Separación por fuente de verdad y ciclo de vida propio. |
| Operación fiscal inmueble | `gastosInmueble`, `aeatCarryForwards`, `proveedores` | Separación por fuente de verdad y ciclo de vida propio. |
| Fiscal coordinado | `ejerciciosFiscalesCoord`, `resultadosEjercicio`, `arrastresIRPF`, `arrastresManual`, `perdidasPatrimonialesAhorro`, `snapshotsDeclaracion`, `entidadesAtribucion`, `documentosFiscales` | Separación por fuente de verdad y ciclo de vida propio. |
| Personal | `personalData`, `personalModuleConfig`, `compromisosRecurrentes`, `viviendaHabitual` | Separación por fuente de verdad y ciclo de vida propio. |
| Plan y presupuesto | `escenarios`, `objetivos`, `fondos_ahorro`, `retos`, `presupuestos`, `presupuestoLineas` | Separación por fuente de verdad y ciclo de vida propio. |
| Documental y sistema | `documents`, `keyval` | Separación por fuente de verdad y ciclo de vida propio. |

### 3.2 Fichas por dominio

#### Activos físicos
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`properties`** · Propósito: activos inmobiliarios. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`property_sales`** · Propósito: ventas inmobiliarias previstas. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`mejorasInmueble`** · Propósito: mejoras y reparaciones capitalizables. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`mueblesInmueble`** · Propósito: mobiliario amortizable. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`vinculosAccesorio`** · Propósito: relación parking/trastero fiscal. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador XML AEAT. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`propertyDays`** · Propósito: días fiscales manuales/ocupación. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Activos financieros
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`inversiones`** · Propósito: posiciones financieras visibles. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`planesPensionInversion`** · Propósito: planes de pensiones separados de inversión operativa. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`valoraciones_historicas`** · Propósito: histórico de valoración por activo. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`traspasosPlanes`** · Propósito: eventos de traspaso entre planes. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Financiación
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`prestamos`** · Propósito: deuda y financiación. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`loan_settlements`** · Propósito: cancelaciones de préstamos planificadas. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Contratos e ingresos
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`contracts`** · Propósito: fuente de contratos y renta vigente. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`nominas`** · Propósito: ingresos laborales Personal. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`autonomos`** · Propósito: catálogo laboral Personal previsto; 0 datos Jose. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`otrosIngresos`** · Propósito: ingresos personales no laborales previsto. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`pensiones`** · Propósito: ingresos de pensión previstos. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Tesorería presente/futuro
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`accounts`** · Propósito: tesorería, cuentas bancarias y saldos base. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: Tesorería/cuentas. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`movements`** · Propósito: movimientos bancarios reales. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador bancario / punteo tesorería. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`treasuryEvents`** · Propósito: previsión presente/futuro. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: generadores de catálogos y previsiones. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`importBatches`** · Propósito: trazabilidad de importación bancaria. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador bancario / punteo tesorería. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`matchingConfiguration`** · Propósito: reglas de matching presupuestario/transferencias. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`movementLearningRules`** · Propósito: reglas de clasificación aprendidas. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`learningLogs`** · Propósito: auditoría de reglas aprendidas. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`reconciliationAuditLogs`** · Propósito: auditabilidad de conciliación. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Operación fiscal inmueble
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`gastosInmueble`** · Propósito: histórico fiscal declarado por inmueble. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador XML AEAT. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`aeatCarryForwards`** · Propósito: arrastres fiscales AEAT usados por fiscalSummary/carryForward. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`proveedores`** · Propósito: entidades fiscales detectadas por XML. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador XML AEAT. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Fiscal coordinado
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`ejerciciosFiscalesCoord`** · Propósito: coordinador fiscal 2020-2024. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador XML AEAT. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`resultadosEjercicio`** · Propósito: resultado fiscal anual inmutable. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador XML AEAT. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`arrastresIRPF`** · Propósito: carry-forwards IRPF usados por ciclo fiscal. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`arrastresManual`** · Propósito: entrada manual fiscal prevista pero sin datos actuales. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`perdidasPatrimonialesAhorro`** · Propósito: arrastres fiscal ahorro. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`snapshotsDeclaracion`** · Propósito: foto declaración importada. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: importador XML AEAT. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`entidadesAtribucion`** · Propósito: fiscal atribución de rentas previsto. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`documentosFiscales`** · Propósito: documental fiscal previsto; hoy vacío. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Personal
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`personalData`** · Propósito: perfil fiscal/personal base. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`personalModuleConfig`** · Propósito: config módulo Personal. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`compromisosRecurrentes`** · Propósito: catálogo objetivo G-01; vacío por falta de carga inicial. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`viviendaHabitual`** · Propósito: ficha hogar/vivienda Personal prevista. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Plan y presupuesto
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`escenarios`** · Propósito: Mi Plan v3; store nuevo sin UI aún. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: Mi Plan. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`objetivos`** · Propósito: Mi Plan v3; metas explícitas. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: Mi Plan. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`fondos_ahorro`** · Propósito: Mi Plan v3; etiquetas de propósito. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: Mi Plan. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`retos`** · Propósito: Mi Plan v3; reto mensual. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: Mi Plan. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`presupuestos`** · Propósito: roadmap presupuesto anual. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`presupuestoLineas`** · Propósito: roadmap presupuesto y matching. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
#### Documental y sistema
Estos stores no se fusionan porque tienen escritores, cardinalidad o reglas fiscales distintas.
- **`documents`** · Propósito: archivo documental general. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.
- **`keyval`** · Propósito: configuración y datos auxiliares. **Schema propuesto**: mantener schema actual con saneos indicados en transición. **KeyPath/índices**: mantener los actuales salvo campos deprecated. **Único escritor**: UI/servicio de dominio. **Lectores**: módulo propio, Panel, Mi Plan y Fiscal cuando aplique. **FK principales**: `inmuebleId`, `accountId`, `contractId`, `prestamoId`, `personalDataId` según store. **Invariantes**: un solo escritor; IDs numéricos en inmuebles y UUID en préstamos; datos derivados recalculables no mandan. **Origen inicial**: wipe + XML/onboarding/UI. **Volumen normal**: bajo/medio salvo movimientos y valoraciones históricas.

### 3.3 Comparación de tamaños

| Métrica | Valor |
|---|---:|
| Stores actuales | 59 |
| Stores objetivo | 48 |
| Reducción | 11 stores (19%) |

### 3.4 Decisiones cerradas

- `treasuryEvents` gobierna presente/futuro; `gastosInmueble` gobierna histórico fiscal.
- `compromisosRecurrentes` se inicializa híbrido: sugerido desde histórico, confirmado por usuario.
- `accounts.balance` es cache derivada; `openingBalance`/`openingBalanceDate` son persistidos.
- Renta mensual vigente vive en `contracts`; histórico de revisiones embebido; eventos mensuales se generan en `treasuryEvents`.

## 4. SUB-TAREA C · Plan de transición

### 4.1 Mapeo actual → objetivo

| Store actual | Veredicto | Store objetivo destino | Acción |
|---|---|---|---|
| `accounts` | VIVO | `accounts` | mantener |
| `aeatCarryForwards` | VIVO | `aeatCarryForwards` | mantener |
| `arrastresIRPF` | VIVO | `arrastresIRPF` | mantener |
| `arrastresManual` | HUÉRFANO | `arrastresManual` | mantener vacío hasta UI/flujo |
| `autonomos` | HUÉRFANO | `autonomos` | mantener vacío hasta UI/flujo |
| `compromisosRecurrentes` | HUÉRFANO | `compromisosRecurrentes` | mantener vacío hasta UI/flujo |
| `configuracion_fiscal` | DUPLICADO | `keyval/configFiscal` | eliminar tras adaptar consumidores |
| `contracts` | VIVO | `contracts` | mantener |
| `documentosFiscales` | HUÉRFANO | `documentosFiscales` | mantener vacío hasta UI/flujo |
| `documents` | VIVO | `documents` | mantener |
| `ejerciciosFiscales` | DUPLICADO | `ejerciciosFiscalesCoord` | eliminar tras adaptar consumidores |
| `ejerciciosFiscalesCoord` | VIVO | `ejerciciosFiscalesCoord` | mantener |
| `entidadesAtribucion` | HUÉRFANO | `entidadesAtribucion` | mantener vacío hasta UI/flujo |
| `escenarios` | HUÉRFANO | `escenarios` | mantener vacío hasta UI/flujo |
| `fondos_ahorro` | HUÉRFANO | `fondos_ahorro` | mantener vacío hasta UI/flujo |
| `gastosInmueble` | VIVO | `gastosInmueble` | mantener |
| `gastosPersonalesReal` | DUPLICADO | `movements + treasuryEvents` | eliminar tras adaptar consumidores |
| `importBatches` | VIVO | `importBatches` | mantener |
| `inversiones` | VIVO | `inversiones` | mantener |
| `keyval` | VIVO | `keyval` | mantener |
| `kpiConfigurations` | FÓSIL | `keyval` | eliminar tras adaptar consumidores |
| `learningLogs` | VIVO | `learningLogs` | mantener |
| `loan_settlements` | HUÉRFANO | `loan_settlements` | mantener vacío hasta UI/flujo |
| `matchingConfiguration` | HUÉRFANO | `matchingConfiguration` | mantener vacío hasta UI/flujo |
| `mejorasInmueble` | VIVO | `mejorasInmueble` | mantener |
| `movementLearningRules` | VIVO | `movementLearningRules` | mantener |
| `movements` | VIVO | `movements` | mantener |
| `mueblesInmueble` | VIVO | `mueblesInmueble` | mantener |
| `nominas` | VIVO | `nominas` | mantener |
| `objetivos` | HUÉRFANO | `objetivos` | mantener vacío hasta UI/flujo |
| `operacionesProveedor` | DUPLICADO | `proveedores.operaciones[] o gasto declarado` | eliminar tras adaptar consumidores |
| `opexRules` | DUPLICADO | `compromisosRecurrentes` | eliminar tras adaptar consumidores |
| `otrosIngresos` | HUÉRFANO | `otrosIngresos` | mantener vacío hasta UI/flujo |
| `patrimonioSnapshots` | DUPLICADO | `valoraciones_mensuales` | eliminar tras adaptar consumidores |
| `patronGastosPersonales` | DUPLICADO | `compromisosRecurrentes` | eliminar tras adaptar consumidores |
| `pensiones` | HUÉRFANO | `pensiones` | mantener vacío hasta UI/flujo |
| `perdidasPatrimonialesAhorro` | VIVO | `perdidasPatrimonialesAhorro` | mantener |
| `personalData` | VIVO | `personalData` | mantener |
| `personalModuleConfig` | VIVO | `personalModuleConfig` | mantener |
| `planesPensionInversion` | VIVO | `planesPensionInversion` | mantener |
| `prestamos` | VIVO | `prestamos` | mantener |
| `presupuestoLineas` | HUÉRFANO | `presupuestoLineas` | mantener vacío hasta UI/flujo |
| `presupuestos` | HUÉRFANO | `presupuestos` | mantener vacío hasta UI/flujo |
| `properties` | VIVO | `properties` | mantener |
| `propertyDays` | VIVO | `propertyDays` | mantener |
| `property_sales` | HUÉRFANO | `property_sales` | mantener vacío hasta UI/flujo |
| `proveedores` | VIVO | `proveedores` | mantener |
| `reconciliationAuditLogs` | VIVO | `reconciliationAuditLogs` | mantener |
| `rentaMensual` | DUPLICADO | `contracts + treasuryEvents` | eliminar tras adaptar consumidores |
| `resultadosEjercicio` | VIVO | `resultadosEjercicio` | mantener |
| `retos` | HUÉRFANO | `retos` | mantener vacío hasta UI/flujo |
| `snapshotsDeclaracion` | VIVO | `snapshotsDeclaracion` | mantener |
| `traspasosPlanes` | VIVO | `traspasosPlanes` | mantener |
| `treasuryEvents` | VIVO | `treasuryEvents` | mantener |
| `treasuryRecommendations` | FÓSIL | `derivado en runtime` | eliminar tras adaptar consumidores |
| `valoraciones_historicas` | VIVO | `valoraciones_historicas` | mantener |
| `valoraciones_mensuales` | DUPLICADO | `valoraciones_historicas + vista mensual` | eliminar tras adaptar consumidores |
| `vinculosAccesorio` | VIVO | `vinculosAccesorio` | mantener |
| `viviendaHabitual` | HUÉRFANO | `viviendaHabitual` | mantener vacío hasta UI/flujo |

### 4.2 Stores a ELIMINAR

- `configuracion_fiscal` → keyval/configFiscal: singleton de configuración cabe en keyval.
- `ejerciciosFiscales` → ejerciciosFiscalesCoord: store legacy sustituido por coordinador.
- `gastosPersonalesReal` → movements + treasuryEvents: hechos reales deben vivir en movements/TE confirmado.
- `kpiConfigurations` → keyval: sin datos ni mockup objetivo específico.
- `operacionesProveedor` → proveedores.operaciones[] o gasto declarado: duplica proveedor+gasto anual; puede normalizarse.
- `opexRules` → compromisosRecurrentes: deprecated; migrado a compromisos.
- `patrimonioSnapshots` → valoraciones_mensuales: snapshot agregado duplicado con valoración mensual.
- `patronGastosPersonales` → compromisosRecurrentes: sustituido por compromisos recurrentes.
- `rentaMensual` → contracts + treasuryEvents: deprecated; contrato escalar + eventos.
- `treasuryRecommendations` → derivado en runtime: recomendaciones recalculables desde TE/movements.
- `valoraciones_mensuales` → valoraciones_historicas + vista mensual: snapshot mensual duplicable desde histórico.

### 4.3 Stores a CREAR
No se recomienda crear stores nuevos en V60. La arquitectura objetivo se alcanza eliminando duplicados y refactorizando schemas existentes.

### 4.4 Stores a REFACTORIZAR
- `accounts`: declarar `balance` como cache derivada y documentar recálculo.
- `contracts`: añadir/normalizar `historicoRentas[]` y detener generación del store `rentaMensual`.
- `compromisosRecurrentes`: soportar bootstrap desde histórico `gastosInmueble` con estado sugerido/confirmado.
- `keyval`: absorber configuración fiscal/KPI singleton.
- `proveedores`: si Jose aprueba, absorber lo útil de `operacionesProveedor` o derivarlo desde gastos/importación.
- `valoraciones_historicas`: debe permitir consultas mensuales sin store de snapshot separado.

### 4.5 Wipe + re-importación paso a paso
1. Publicar DB_VERSION 60 con stores objetivo y eliminaciones aprobadas, todos vacíos.
2. Antes del wipe, exportar snapshot ZIP/JSON y registrar versión de app, fecha y lista de XML/CSV originales que se usarán para reconstruir.
3. Onboarding mínimo: `personalData`, cuentas (`accounts.openingBalance`), inmuebles si no vienen completos del XML y preferencias en `keyval`.
4. Importar XML 2020-2024 en orden cronológico: `ejerciciosFiscalesCoord`, `properties`, `contracts`, `gastosInmueble`, `proveedores`, `vinculosAccesorio`, arrastres y snapshots fiscales.
5. Importar CSV bancario: `importBatches`, `movements`; conciliar contra `treasuryEvents`.
6. Generar catálogos futuros: contratos → rentas previstas; préstamos → cuotas; compromisos sugeridos desde histórico; nóminas/personal desde UI.
7. Reconciliación manual: validar contratos vivos, préstamos liquidados, saldos iniciales, fondos/objetivos de Mi Plan.
8. Recuperación ante fallo: cada ejercicio XML debe importarse dentro de un batch lógico idempotente; si falla un ejercicio, se revierte ese batch, se conserva el snapshot pre-wipe y no se avanza al ejercicio siguiente. Si falla la importación bancaria, se borra el `importBatch` parcial y sus `movements` asociados antes de reintentar. Si falla una fase posterior, se puede repetir desde DB vacía usando los mismos XML/CSV o restaurar el snapshot pre-wipe.
9. Estado esperado: stores fiscal/históricos poblados por XML, tesorería real por CSV, Mi Plan y Personal gradual por UI.

### 4.6 Tareas posteriores
- **TAREA 7** · limpieza V60: eliminar fósiles/duplicados aprobados.
- **TAREA 8** · schema refactor: accounts cache, contracts histórico rentas, keyval config.
- **TAREA 9** · bootstrap compromisos desde histórico + UI de confirmación.
- **TAREA 10** · adaptar consumidores legacy (`rentaMensual`, `opexRules`, `ejerciciosFiscales`).
- **TAREA 11** · flujo wipe + reimport XML/CSV con validaciones.
- **TAREA 12** · retomar mapeo component→data sobre arquitectura limpia.


## 5. Próximos pasos · qué decide Jose

- Confirmar eliminación de los 11 stores marcados como DUPLICADO/FÓSIL.
- Validar si `operacionesProveedor` se absorbe en proveedor/gasto o se mantiene por trazabilidad fiscal.
- Validar histórico de rentas embebido en `contracts` frente a store separado.
- Aprobar que `accounts.balance` sea cache derivada.
- Aprobar bootstrap híbrido de `compromisosRecurrentes` desde `gastosInmueble` histórico.
