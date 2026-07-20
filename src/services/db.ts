import { openDB, IDBPDatabase } from 'idb';
import type { DBSchema, IDBPObjectStore, IndexNames, StoreNames } from 'idb';
import { repoblarNifsBotesDesdeArchivo, recalcularFechaFinContratosAEAT, backfillDocumentoFirmado } from './alquileresV3FixService';
// Frente C · troceo: helpers de blob/documento viven en ./db/documents (import
// diferido · initDB se usa dentro de funciones async, sin ciclo en runtime).
import { getDocumentBlob, downloadBlob, saveDocumentWithBlob, deleteDocumentAndBlob } from './db/documents';
import { applyUpgradeA } from './db/upgrade-a';
import { applyUpgradeB } from './db/upgrade-b';
import { runPostOpenMigrations } from './db/post-open';
import type { DeclaracionCompleta } from '../types/declaracionCompleta';
// Fase 0 · los valores del schema son `any`, así que los tipos de dominio que solo
// usaba la interfaz ya no se importan (volverán en Tanda N al endurecer cada store).
import type { Escenario, Objetivo, FondoAhorro, Reto } from '../types/miPlan';
import type { BenchmarkReferencia } from '../types/benchmarksReferencia';
import type { AvisoCerrado } from '../types/avisosUsuario';
import type { ObjetivoVital } from '../types/objetivosVitales';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import type { PosicionInversion } from '../types/inversiones';
import type { PlanPensiones, AportacionPlan, TraspasoPlanPensiones } from '../types/planesPensiones';
import type { ValoracionActivo } from '../types/valoracionActivo';
import type { Prestamo } from '../types/prestamos';
import type { PersonalData, PersonalModuleConfig } from '../types/personal';
import type { ViviendaHabitual } from '../types/viviendaHabitual';
import type {
  ArrastresEjercicio,
  DeclaracionInmueble,
  DeclaracionIRPF,
  OrigenDeclaracion,
} from '../types/fiscal';
import type { TipoActivo } from '../types/tipoActivo';

export const DB_NAME = 'AtlasHorizonDB';
export const DB_VERSION = 79; // V79 (onboarding día 0 · hueco 5.1): campo raíz nuevo `Property.estructuraCompra` (decisión Jose · NO anidado en `aeatAmortization` fiscal del pasado · §1) con 3 opcionales `aportacionPropia` (lo que el usuario puso), `importeFinanciado` (lo financiado) y `prestamoVinculadoId` (FK string a `Prestamo.id` uuid · NO number · decisión Jose D1). Migración no destructiva: campo opcional sin reescritura · properties existentes quedan con `estructuraCompra` undefined (no-op en el upgrade callback). 45 stores físicos en v79 (conteo canónico documentado sobre `interface AtlasHorizonDB`). // V78 (refactor modelo alquileres v3): nuevo store `botesAnualesSinIdentificar` (Camino 2 del wizard XML AEAT) + campo persistido `Property.modoExplotacion` (piso_completo/por_habitaciones/mixto) + campo `Contract.inquilino.cotitulares[]` (N NIFs en piso completo). Migración post-upgrade idempotente: deriva `modoExplotacion` del legacy `alquilerPorHabitaciones.activo`, inicializa `cotitulares=[]`, y elimina Contracts huérfanos `estadoContrato='sin_identificar'` + sus treasuryEvents en cascada (decisión Jose · reimportar limpio).
// V77 (wizard import XML V2 · pilar 1): añade campos opcionales a `properties` para explotación/tipología (subtipoVivienda, anexos.plazasParking, explotacion{estadoOperativo, unidadesArrendables}). Se mapea sobre campos existentes (tipoActivo, anexos, usoTipo, alquilerPorHabitaciones) en lugar de duplicar. Migración suave · sin cambios de stores/índices · inmuebles pre-V77 quedan con los campos undefined. 44 stores totales (sin cambio · los 5 stores fiscales NO se eliminan: tienen lectores/escritores vivos).


// Frente C · troceo: tipos de dominio movidos a ./db/types (mover-no-reescribir).
// db.ts los importa para la interfaz AtlasHorizonDB / initDB y los re-exporta
// (export *) para no tocar a los consumidores.
import type {
  Property,
  PropertySale,
  LoanSettlement,
  PropertyImprovement,
  OperacionFiscal,
  MejoraActivo,
  MobiliarioActivo,
  GastoCategoria,
  GastoOrigen,
  GastoEstadoNuevo,
  GastoInmueble,
  MejoraInmueble,
  MuebleInmueble,
  Proveedor,
  OperacionProveedor,
  OCRField,
  OCRResult,
  OCRHistoryEntry,
  MatchCandidate,
  Document,
  EjercicioFiscalContrato,
  HistoricoRenta,
  MotivoFin,
  VolveriaAAlquilar,
  BoteAnualSinIdentificar,
  BoteContractLink,
  Contract,
  RentaMensual,
  AEATFiscalType,
  AEATBox,
  ProrationMethod,
  ExpenseStatus,
  ExpenseOrigin,
  TipoGasto,
  EstadoConciliacion,
  DestinoGasto,
  AEATCarryForward,
  PropertyDays,
  AccountDestination,
  AccountUsageScope,
  AccountStatus,
  Account,
  MovementStatus,
  TransactionState,
  ReconciliationStatus,
  MovementType,
  MovementOrigin,
  MovementState,
  UnifiedMovementStatus,
  MovementSource,
  Movement,
  MatchingConfiguration,
  MovementRule,
  TransferSuggestion,
  TreasuryEvent,
  MovementLearningRule,
  TreasuryRecommendation,
  EstadoEjercicio,
  OrigenEjercicio,
  EjercicioFiscal,
  ResultadoEjercicio,
  TipoArrastre,
  PerdidaPatrimonialAhorro,
  ArrastreIRPF,
  EntidadEjercicio,
  EntidadAtribucionRentas,
  SnapshotDeclaracion,
  IngresoOrigen,
  IngresoDestino,
  IngresoEstado,
  Ingreso,
  GastoEstado,
  GastoDestino,
  Gasto,
  FiscalSummary,
  ImportBatch,
  Expense,
  FiscalCategory,
  PaymentFrequency,
  UUID,
  FrecuenciaPago,
  TipoLinea,
  CategoriaGasto,
  CategoriaIngreso,
  PlanningLayer,
  EstadoCertidumbre,
  OrigenLinea,
  Presupuesto,
  PresupuestoLinea,
  BudgetLine,
  Budget,
  PatrimonioSnapshot,
  OpexCategory,
  OpexFrequency,
  OpexEstacionalidad,
  ExpenseBusinessType,
  AsymmetricPayment,
  OpexRule,
  ConfiguracionFiscal,
  EjercicioFiscalCoord,
  ResumenFiscal,
  ArrastresEjercicioCoord,
  ArrastresOutEjercicioCoord,
  ArrastreGasto,
  ArrastrePerdida,
  AmortizacionAcumulada,
  DeduccionPendiente,
  VinculoAccesorio,
  DeudaFiscal,
} from './db/types';
export * from './db/types';


/**
 * CONTEO DE STORES (canónico · bloque 2.6 · 2026-07) ─────────────────────────
 *
 * Sobre una base FRESCA en v79 persisten **45 stores físicos**, y desde la Fase 0
 * de DBSchema las **45 están declaradas** en la interfaz: las 42 previas + los 3
 * físicos que antes no se declaraban (gastosInmueble · mejorasInmueble · mueblesInmueble).
 * Todas respaldadas por un `createObjectStore` → 0 fantasma.
 *
 * NO cuentan para el total de v79:
 *   - planesPensionInversion · store legacy retirado en V65 · ya no se crea ni se
 *     declara (lifecycle de upgrade eliminado en Fase 0).
 *   - stores legacy borrados (importLogs · learningLogs · objetivos_financieros ·
 *     reconciliationAuditLogs · …) → su limpieza del upgrade se retiró en Fase 0.
 *
 * Recuento mecánico reproducible:
 *   - claves interfaz:  líneas `^  clave:` entre `interface AtlasHorizonDB {` y su `}`.
 *   - stores físicos:   `createObjectStore('X')` únicos, menos los que también
 *                       tienen `deleteObjectStore('X')` en un camino de upgrade.
 *
 * ✓ FASE 0 (DBSchema) · esta interfaz YA extiende `DBSchema` de idb: cada valor tiene
 * forma `{ key; value; indexes }`, así que `StoreNames<AtlasHorizonDB>` valida los
 * NOMBRES de store e índice en toda la capa de datos (candado en
 * `__typeguards__/dbschema-nombres.ts`). `value` sigue en `any`: el endurecimiento
 * de valores por store llega en las Tandas siguientes. Al declararse ahora los 45
 * stores, el indicador health `stores_no_tipados` baja de 3 a 0.
 */
export interface AtlasHorizonDB extends DBSchema {
  properties: { key: IDBValidKey; value: Property; indexes: { 'address': IDBValidKey; 'alias': IDBValidKey } };
  property_sales: { key: IDBValidKey; value: PropertySale; indexes: { 'property-status': IDBValidKey; 'propertyId': IDBValidKey; 'saleDate': IDBValidKey; 'status': IDBValidKey } };
  // loan_settlements: ELIMINADO en V63 (sub-tarea 4) — destino prestamos.liquidacion · 0 registros en producción
  documents: { key: IDBValidKey; value: Document; indexes: { 'entityId': IDBValidKey; 'entityType': IDBValidKey; 'type': IDBValidKey } };
  contracts: { key: IDBValidKey; value: Contract; indexes: { 'propertyId': IDBValidKey } };
  botesAnualesSinIdentificar: { key: IDBValidKey; value: BoteAnualSinIdentificar; indexes: { 'estado': IDBValidKey; 'inmuebleId': IDBValidKey; 'inmuebleId-año': IDBValidKey } }; // V78: Camino 2 wizard XML AEAT · importes declarados pendientes de vincular
  // NOTE: rentCalendar and rentPayments removed in V4.5 — migrated to rentaMensual
  // rentaMensual: ELIMINADO en V62 (sub-tarea 3) — deprecated V5.6 · 0 registros
  aeatCarryForwards: { key: IDBValidKey; value: AEATCarryForward; indexes: { 'expirationYear': IDBValidKey; 'propertyId': IDBValidKey; 'taxYear': IDBValidKey } }; // H5: Tax carryforwards
  propertyDays: { key: IDBValidKey; value: PropertyDays; indexes: { 'property-year': IDBValidKey; 'propertyId': IDBValidKey; 'taxYear': IDBValidKey } }; // H5: Rental/availability days
  proveedores: { key: IDBValidKey; value: Proveedor; indexes: {} }; // V3.8: entidad única proveedor por NIF
  // operacionesProveedor: ELIMINADO en V62 (sub-tarea 3) — cache desnormalizada de gastosInmueble + proveedores · 15 registros
  // kpiConfigurations: ELIMINADO en V62 (sub-tarea 3) — sustituido por keyval['kpiConfig_*'] · 0 registros
  accounts: { key: IDBValidKey; value: Account; indexes: { 'bank': IDBValidKey; 'destination': IDBValidKey; 'isActive': IDBValidKey } }; // H8: Treasury accounts
  movements: { key: IDBValidKey; value: Movement; indexes: { 'accountId': IDBValidKey; 'date': IDBValidKey; 'duplicate-key': IDBValidKey; 'importBatch': IDBValidKey; 'status': IDBValidKey } }; // H8: Bank movements
  importBatches: { key: IDBValidKey; value: ImportBatch; indexes: { 'accountId': IDBValidKey; 'createdAt': IDBValidKey } }; // H8: CSV import tracking
  treasuryEvents: { key: IDBValidKey; value: TreasuryEvent; indexes: { 'accountId': IDBValidKey; 'ambito': IDBValidKey; 'año': IDBValidKey; 'certeza': IDBValidKey; 'generadoPor': IDBValidKey; 'inmuebleId': IDBValidKey; 'predictedDate': IDBValidKey; 'sourceId': IDBValidKey; 'sourceType': IDBValidKey; 'status': IDBValidKey; 'type': IDBValidKey } }; // H9: Treasury forecasting
  // treasuryRecommendations: ELIMINADO en V62 (sub-tarea 3) — derivable runtime · 0 registros
  presupuestos: { key: IDBValidKey; value: Presupuesto; indexes: { 'estado': IDBValidKey; 'year': IDBValidKey } }; // H9: New budget system per specification
  presupuestoLineas: { key: IDBValidKey; value: PresupuestoLinea; indexes: { 'categoria': IDBValidKey; 'contratoId': IDBValidKey; 'cuentaId': IDBValidKey; 'frecuencia': IDBValidKey; 'inmuebleId': IDBValidKey; 'origen': IDBValidKey; 'prestamoId': IDBValidKey; 'presupuestoId': IDBValidKey; 'tipo': IDBValidKey } }; // H9: New budget lines per specification
  // matchingConfiguration: ELIMINADO en V63 (sub-tarea 4) — destino keyval['matchingConfig'] · 0 registros en producción
  // reconciliationAuditLogs: ELIMINADO en V64 (sub-tarea 5) — deuda técnica · 0 lectores · wipe
  movementLearningRules: { key: IDBValidKey; value: MovementLearningRule; indexes: { 'ambito': IDBValidKey; 'appliedCount': IDBValidKey; 'categoria': IDBValidKey; 'createdAt': IDBValidKey; 'learnKey': IDBValidKey } }; // V1.1: Learning rules for automatic classification
  // learningLogs: ELIMINADO en V64 (sub-tarea 5) — absorbido en movementLearningRules.history[]
  inversiones: { key: IDBValidKey; value: PosicionInversion; indexes: { 'activo': IDBValidKey; 'entidad': IDBValidKey; 'tipo': IDBValidKey } }; // V1.3: Investment positions
  // patrimonioSnapshots: ELIMINADO en V62 (sub-tarea 3) — derivable de valoraciones_historicas · 1 registro
  /**
   * V1.2 · perfil fiscal NÚCLEO del titular (singleton · `id=1`).
   *
   * Fuente única de · DNI · CCAA · tributacion · descendientes · ascendientes
   * · discapacidad · fechaNacimiento · situacionLaboral · etc. Cualquier
   * cálculo IRPF debe leer este store vía el gateway `fiscalContextService`
   * (T14.2) · NO leer campos sueltos directamente · `informesDataService` y
   * un puñado de wizards mantienen lectura directa por necesitar el objeto
   * completo (excepciones documentadas en cada llamada T14.4).
   */
  personalData: { key: IDBValidKey; value: PersonalData; indexes: { 'dni': IDBValidKey; 'fechaActualizacion': IDBValidKey } };
  /**
   * V1.2 · flags UI/integración derivados automáticamente de `personalData`.
   *
   * NO contiene información fiscal · NO migra al gateway `fiscalContextService`
   * (decisión T14 · ratificada en T14.4 · validada retro 2026-05-06). Campos
   * legítimos · `seccionesActivas.{nomina|autonomo|pensionesInversiones|otrosIngresos}`
   * · `integracionTesoreria` · `integracionProyecciones` · `integracionFiscalidad`
   * · todos hardcoded `true` excepto `seccionesActivas.{nomina|autonomo}` que
   * se derivan de `personalData.situacionLaboral`.
   */
  personalModuleConfig: { key: IDBValidKey; value: PersonalModuleConfig; indexes: { 'fechaActualizacion': IDBValidKey } };
  // nominas: ELIMINADO en V63 (sub-tarea 4 · deuda sub-tarea 2) — datos ya copiados a `ingresos` con tipo='nomina' en V61
  /**
   * V61 (TAREA 7 sub-tarea 2): nuevo store unificado de ingresos personales.
   *
   * Unifica `nominas`, `autonomos` y `pensiones` bajo una unión discriminada
   * por `tipo`. La migración V60→V61 copia los registros de `nominas` (con
   * `tipo='nomina'`) preservando id. V63 (sub-tarea 4) absorbe `autonomos`
   * (con `tipo='autonomo'`) y `pensiones` (con `tipo='pension'`)
   * reasignando ids vía autoincrement (los stores legacy se eliminan tras
   * la copia, incluyendo `nominas` cuyo borrado quedó pendiente desde
   * sub-tarea 2).
   *
   * Índices: `personalDataId`, `tipo`, `fechaActualizacion`.
   *
   * Nota TS: en este módulo se importa con alias `IngresoPersonal` para no
   * colisionar con la interfaz local `Ingreso` (H10 · Treasury income).
   */
  ingresos: { key: IDBValidKey; value: unknown; indexes: { 'fechaActualizacion': IDBValidKey; 'personalDataId': IDBValidKey; 'tipo': IDBValidKey } };
  // autonomos: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='autonomo'
  // planesPensionInversion: eliminado en V65 — datos migrados a planesPensiones
  // ─── Módulo planes de pensiones (V65 · TAREA 13) ────────────────────────
  planesPensiones: { key: IDBValidKey; value: PlanPensiones; indexes: { 'estado': IDBValidKey; 'personalDataId': IDBValidKey; 'tipoAdministrativo': IDBValidKey; 'titular': IDBValidKey } };            // V65: entidad estable plan (UUID)
  aportacionesPlan: { key: IDBValidKey; value: AportacionPlan; indexes: { 'ejercicioFiscal': IDBValidKey; 'ingresoIdNomina': IDBValidKey; 'origen': IDBValidKey; 'planId': IDBValidKey; 'planId+ejercicioFiscal': IDBValidKey } };          // V65: eventos aportación (3 roles)
  traspasosPlanPensiones: { key: IDBValidKey; value: TraspasoPlanPensiones; indexes: { 'fechaEjecucion': IDBValidKey; 'planId': IDBValidKey } }; // V65: eventos traspaso fiscal neutro
  // traspasosPlanes: ELIMINADO por completo del código (bloque 2.4 tipo · bloque 3
  //   commit final A lifecycle de upgrade + su test). Store legacy retirado en V65,
  //   nunca creado en DBs frescas; DB única en v79 → la migración no defiende a nadie.
  // otrosIngresos: ELIMINADO en V63 (sub-tarea 4-bis) — destino ingresos.tipo='otro' (+metadata.otro)
  // pensiones: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='pension'
  // patronGastosPersonales: ELIMINADO en V62 (sub-tarea 3) — futuro compromisosRecurrentes · 7 registros
  // gastosPersonalesReal: ELIMINADO en V62 (sub-tarea 3) — futuro movements + treasuryEvents · 0 registros
  prestamos: { key: IDBValidKey; value: Prestamo; indexes: { 'createdAt': IDBValidKey; 'inmuebleId': IDBValidKey; 'tipo': IDBValidKey } }; // Financiacion: Loan records · V63 (sub-tarea 4): campo `liquidacion` absorbe los settlements del store eliminado `loan_settlements`.
  /**
   * V74 (T-VALORACIONES PR1): store polimórfico de valoraciones temporales
   * por activo. Reemplaza al anterior `valoraciones_historicas` (snake_case,
   * YYYY-MM, cardinalidad 3 tipos) preservando datos.
   *
   * Schema:
   * - `activoId` string (UUID o stringify del id numérico)
   * - `tipoActivo`: 'inmueble' | 'inversion' | 'plan_pensiones' | 'deposito' | 'otro'
   * - `subtipoInversion?`: 'fondo' | 'accion' | 'etf' | 'crypto' (solo si inversion)
   * - `fecha` YYYY-MM-DD
   * - `origen`: 'manual' | 'import_csv' | 'import_pdf' | 'api_gestora' | 'seed_migracion_v74' | 'seed_legacy_field_v74' | 'cierre_anual'
   * - `deletedAt?` soft delete · null = activa
   * - resto: ver `src/types/valoracionActivo.ts`
   *
   * Índices: `idx_activo`, `idx_activo_fecha`, `idx_tipo`, `idx_fecha`,
   * `idx_anchor_fiscal`, `idx_tipo_subtipo`.
   */
  valoracionesActivos: { key: IDBValidKey; value: ValoracionActivo; indexes: { 'idx_activo': IDBValidKey; 'idx_activo_fecha': IDBValidKey; 'idx_anchor_fiscal': IDBValidKey; 'idx_fecha': IDBValidKey; 'idx_tipo': IDBValidKey; 'idx_tipo_subtipo': IDBValidKey } };
  // valoraciones_historicas: ELIMINADO del schema (bloque 2.4) — store renombrado a
  //   `valoracionesActivos` en V74; el físico ya no existe tras la migración v73→v74.
  // valoraciones_mensuales: ELIMINADO en V62 (sub-tarea 3) — derivable de valoraciones_historicas · 115 registros
  /**
   * General key-value store for application configuration.
   *
   * ── Catálogo canónico post-T15 (sub-tarea 15.4) ──────────────────────────
   *
   * Tras la auditoría T15 (`docs/AUDIT-T15-keyval.md`) este store queda
   * reservado a configuración real (cat. A) y flags de migración recurrentes
   * (cat. D1). Cache (cat. B), datos del usuario (cat. C) y flags consumidas
   * (cat. D2) NO deben vivir aquí.
   *
   * ── Claves vivas autorizadas ─────────────────────────────────────────────
   *
   *   `'matchingConfig'` (A · KEEP)
   *     → Configuración de matching de presupuesto · destino canónico V63
   *     → Dueño: `budgetMatchingService`
   *     → Lectores: `budgetMatchingService`, `transferDetectionService`
   *     → Formato: objeto `MatchingConfiguration` (ver
   *       `services/budgetMatchingService.ts`)
   *     → Origen: store eliminado `matchingConfiguration` (V63)
   *
   *   `'dashboardConfiguration'` (A · KEEP)
   *     → Configuración del dashboard del usuario
   *     → Dueño: `DashboardService` (`services/dashboardService.ts`)
   *     → Formato: objeto serializado del dashboard
   *
   *   `'base-assumptions'` (A · KEEP · TODO_PROYECCION)
   *     → Configuración de proyección · módulo legacy `horizon/proyeccion/`
   *     → Dueño: `proyeccionService`
   *     → Revisitar cuando proyección migre a v5 (T21)
   *
   *   `'migration_orphaned_inmueble_ids_v1'` (D1 · KEEP)
   *     → Flag idempotencia · puede re-correr si quedan huérfanos en otros
   *       stores. Borrarla forzaría reescaneo completo.
   *     → Dueño: `services/migrations/migrateOrphanedInmuebleIds.ts`
   *
   *   `'cleanup_T15_v1'` (D1 · KEEP)
   *     → Flag idempotencia de la limpieza T15.2.
   *     → Dueño: `services/keyvalCleanupService.ts`
   *
   *   `'migration_keyval_planpagos_to_prestamos_v1'` (D1 · KEEP)
   *     → Flag idempotencia de la migración T15.3.
   *     → Dueño: `services/migrations/migrateKeyvalPlanpagosToPrestamos.ts`
   *
   *   `'cleanup_T14_v1'` (D1 · KEEP)
   *     → Flag idempotencia del cleanup T14.5 · borra `configFiscal` huérfana.
   *     → Dueño: `services/migrations/cleanupConfigFiscalKeyval.ts`
   *
   *   `'cleanup_T34_T35_fix2_categorias'` (D1 · KEEP)
   *     → Flag idempotencia del cleanup T34/T35-fix-2 · corrige los 2 patrones
   *       de categoría aplastada a 'otros.*' (dia_a_dia.otros y
   *       seguros_cuotas.seguro_otros).
   *     → Dueño: `services/migrations/cleanupCategoriasT34T35fix2.ts`
   *
   *   `'migration_b6_aportacionesPlan_v1'` (D1 · KEEP)
   *     → Flag idempotencia del fix FIX-B6 · voltea importeTitular ↔
   *       importeEmpresa en aportacionesPlan con origen='xml_aeat' escritas
   *       antes del fix de irpfXmlParserService.extraerPlanPensiones. Se
   *       escribe en la misma transacción readwrite que los swaps · solo
   *       si todos los put por registro tienen éxito.
   *     → Dueño: `services/migrations/fixAportacionesPlanCruceB6.ts`
   *     → Formato: string literal `'completed'`
   *
   *   `'migration_b6_declaracionCompleta_v1'` (D1 · KEEP)
   *     → Flag idempotencia del fix FIX-B6-bis · voltea aportacionesTrabajador ↔
   *       contribucionesEmpresa en ejerciciosFiscalesCoord[año].aeat
   *       .declaracionCompleta.planPensiones para declaraciones con
   *       fuenteImportacion='xml' escritas por el parser viejo. Cierra el
   *       scope incompleto de B6 (que solo tocó aportacionesPlan).
   *     → Dueño: `services/migrations/fixDeclaracionCompletaCruceB6.ts`
   *     → Formato: string literal `'completed'`
   *
   * ── Claves PROHIBIDAS (NO añadir bajo ningún concepto) ──────────────────
   *
   *   `'planpagos_${prestamoId}'` · datos del usuario · vive en
   *     `prestamos[id].planPagos` · migrado en T15.3.
   *
   *   `'base-projection'` · cache recalculable · borrada en T15.2 · si la
   *     proyección la necesita, regenerar al vuelo desde `base-assumptions`.
   *
   *   `'kpiConfig_horizon'`, `'kpiConfig_pulse'` · residuales V62 · borradas
   *     en T15.2 · `kpiService` es stub no-op · si vuelve la funcionalidad,
   *     diseñar destino dedicado, NO reutilizar keyval.
   *
   *   `'configFiscal'` · borrada en T14.5 · era residuo del store legacy
   *     `configuracion_fiscal` (eliminado V62) · sin escritor ni lector
   *     activos en producción · destino canónico para configuración fiscal
   *     del titular es el gateway `fiscalContextService` (T14.2) sobre
   *     `personalData` + `viviendaHabitual` · NO reintroducir esta clave.
   *
   *   `'proveedor-contraparte-migration'` · flag migración consumida (D2) ·
   *     borrada en T15.2 · NO re-escribir.
   *
   * ── Cómo añadir una clave nueva ──────────────────────────────────────────
   *
   *   1. ¿Es configuración real (no datos del usuario, no cache, no flag
   *      consumida)? Si NO → otro store / store nuevo / campo en registro.
   *   2. ¿Hay alternativa más natural (campo en un registro existente,
   *      store dedicado)? Si SÍ → preferirla.
   *   3. Si la respuesta es keyval, documentar AQUÍ:
   *        - clave literal
   *        - dueño (servicio responsable)
   *        - lectores
   *        - formato del valor
   *        - invariantes
   *   4. Si es flag de migración: definir si es D1 (recurrente, KEEP) o D2
   *      (one-shot, BORRAR cuando se ejecute la limpieza T15-bis futura).
   *
   * ── localStorage (NO en este store) ──────────────────────────────────────
   *
   *   Las siguientes claves se mencionaron en spec T15 §1.2 pero viven en
   *   `localStorage`, NO en este store IndexedDB. Permanecen fuera del
   *   alcance de T15:
   *     - `atlas_account_migration_version`
   *     - `atlas_iban_backfill_version`
   *     - `atlas_migration_gastos_v1`
   *     - `migration_backfill_importeBruto_0106_v1`
   *     - `migration_clean_stale_cp_and_infer_itp_v1`
   *     - `migration_fix_reparaciones_duplicadas_v1`
   *     - `migration_limpiar_gastos_reparacion_0106_v1`
   */
  keyval: { key: IDBValidKey; value: unknown; indexes: {} };
  // objetivos_financieros: ELIMINADO del schema (bloque 2.4) — migrado a 'escenarios'
  //   en V5.4/V5.5; store físico eliminado en V5.9. Creación bajo guard oldVersion<32
  //   y lifecycle de upgrade eliminados.
  // opexRules: ELIMINADO en V62 (sub-tarea 3) — ya migrado a compromisosRecurrentes en TAREA 2 · 0 registros
  // configuracion_fiscal: ELIMINADO en V62 (sub-tarea 3) — sin destino · defaults runtime · 1 registro
  // ejerciciosFiscales: ELIMINADO en V62 (sub-tarea 3) — sustituido por ejerciciosFiscalesCoord · 1 registro
  // documentosFiscales: ELIMINADO en V63 (sub-tarea 4) — destino documents.metadata.tipo='fiscal' · 0 registros en producción
  // arrastresManual: ELIMINADO en V63 (sub-tarea 4) — destino arrastresIRPF.origen='manual' · 0 registros en producción
  resultadosEjercicio: { key: IDBValidKey; value: ResultadoEjercicio; indexes: { 'ejercicio': IDBValidKey; 'ejercicio-estado': IDBValidKey; 'estadoEjercicio': IDBValidKey; 'origen': IDBValidKey } }; // V2.9: Immutable yearly fiscal snapshots
  arrastresIRPF: { key: IDBValidKey; value: ArrastreIRPF; indexes: { 'ejercicioCaducidad': IDBValidKey; 'ejercicioOrigen': IDBValidKey; 'ejercicioOrigen-tipo': IDBValidKey; 'estado': IDBValidKey; 'inmuebleId': IDBValidKey; 'origen': IDBValidKey; 'tipo': IDBValidKey } }; // V2.7: IRPF carry-forwards cross-year · TANDA1-DIFERIDO(§5 upgrade): tipo real=ArrastreIRPF, bloqueado por cursor.update en backfill V60
  perdidasPatrimonialesAhorro: { key: IDBValidKey; value: PerdidaPatrimonialAhorro; indexes: { 'ejercicioCaducidad': IDBValidKey; 'ejercicioOrigen': IDBValidKey; 'estado': IDBValidKey } }; // V3.4: pérdidas ahorro unificadas
  snapshotsDeclaracion: { key: IDBValidKey; value: SnapshotDeclaracion; indexes: { 'ejercicio': IDBValidKey; 'fechaSnapshot': IDBValidKey; 'origen': IDBValidKey } }; // V2.7: Frozen declaration snapshots
  entidadesAtribucion: { key: IDBValidKey; value: EntidadAtribucionRentas; indexes: { 'nif': IDBValidKey; 'tipoRenta': IDBValidKey } }; // V3.4: entidades en atribución de rentas
  ejerciciosFiscalesCoord: { key: IDBValidKey; value: EjercicioFiscalCoord; indexes: { 'estado': IDBValidKey } }; // V3.7: Modelo fiscal coordinador (4 regímenes) · TANDA1-DIFERIDO(Caso 2): tipo real=EjercicioFiscalCoord, discrepancia en declaracionDistributorService.ts:491,500
  vinculosAccesorio: { key: IDBValidKey; value: VinculoAccesorio; indexes: { 'inmuebleAccesorioId': IDBValidKey; 'inmueblePrincipalId': IDBValidKey; 'principal-accesorio-ejercicio': IDBValidKey } }; // V3.9: Vínculos temporales accesorio (parking/trastero) por ejercicio
  // ─── ATLAS Personal v1.1 (V5.3) ────────────────────────────────────────
  compromisosRecurrentes: { key: IDBValidKey; value: CompromisoRecurrente; indexes: { 'ambito': IDBValidKey; 'categoria': IDBValidKey; 'cuentaCargo': IDBValidKey; 'estado': IDBValidKey; 'fechaInicio': IDBValidKey; 'inmuebleId': IDBValidKey; 'personalDataId': IDBValidKey; 'tipo': IDBValidKey } }; // V5.3: catálogo universal de compromisos (unifica opexRules + personal · G-01) · TAREA 9: bootstrap desde histórico vía `compromisoDetectionService` + creación idempotente vía `compromisoCreationService` · activa la vía A del `movementSuggestionService` cuando el store deja de estar vacío. Ver `docs/T9-cierre.md`.
  /**
   * V5.3 · ficha de la vivienda habitual del hogar · genera derivados
   * (sección 6 del modelo Personal v1.1).
   *
   * Subset fiscalmente relevante (catastro · adquisición · IBI · beneficio
   * fiscal hipoteca pre-2013) se expone vía el gateway `fiscalContextService`
   * (T14.2) · `irpfCalculationService` lo usa para excluir la vivienda
   * habitual de la imputación de rentas inmobiliarias (GAP 5.3 · cerrado en
   * T14.3). El servicio dedicado `viviendaHabitualService` sigue siendo el
   * único dueño del store · el gateway solo lee.
   */
  viviendaHabitual: { key: IDBValidKey; value: ViviendaHabitual; indexes: { 'activa': IDBValidKey; 'personalDataId': IDBValidKey; 'vigenciaDesde': IDBValidKey } };
  // ─── Mi Plan v3 (V5.4–V5.7) ─────────────────────────────────────────────
  escenarios: { key: IDBValidKey; value: Escenario; indexes: {} };     // V5.4: singleton escenario libertad activo (renombrado de objetivos_financieros)
  objetivos: { key: IDBValidKey; value: Objetivo; indexes: { 'estado': IDBValidKey; 'fondoId': IDBValidKey; 'prestamoId': IDBValidKey; 'tipo': IDBValidKey } };       // V5.5: lista de objetivos (acumular · amortizar · comprar · reducir)
  fondos_ahorro: { key: IDBValidKey; value: FondoAhorro; indexes: { 'activo': IDBValidKey; 'tipo': IDBValidKey } }; // V5.6: fondos de ahorro con etiquetas de propósito
  retos: { key: IDBValidKey; value: Reto; indexes: { 'estado': IDBValidKey; 'mes': IDBValidKey; 'tipo': IDBValidKey } };               // V5.7: retos mensuales (1 activo por mes)
  deudasFiscales: { key: IDBValidKey; value: DeudaFiscal; indexes: { 'ejercicio': IDBValidKey; 'estado': IDBValidKey; 'modelo': IDBValidKey; 'notificada': IDBValidKey } }; // V71: deudas fiscales con AEAT (modelos 100/303/130/184) · SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 1
  benchmarksReferencia: { key: IDBValidKey; value: BenchmarkReferencia; indexes: { 'codigo': IDBValidKey; 'tipo': IDBValidKey; 'ultimaActualizacion': IDBValidKey } }; // V72: índices de referencia editables (MSCI World · S&P 500 · IPC ES · etc.) · T-INVERSIONES-DETALLE-PP-v1 §4.A
  avisosUsuario: { key: IDBValidKey; value: AvisoCerrado; indexes: {} }; // V73: avisos cerrables (banners X) · T-INVERSIONES-DETALLE-PP-v1 §4.E
  objetivosVitales: { key: IDBValidKey; value: ObjetivoVital; indexes: { 'fechaEstimada': IDBValidKey; 'planFinancieroAsociado': IDBValidKey; 'tipo': IDBValidKey } }; // V73: hitos vitales (jubilación · salida empresa · etc.) · T-INVERSIONES-DETALLE-PP-v1 §4.C Caso B
  // ─── Stores físicos declarados en Fase 0 (antes sin tipar · stores_no_tipados) ───
  gastosInmueble: { key: IDBValidKey; value: GastoInmueble; indexes: { 'casillaAEAT': IDBValidKey; 'ejercicio': IDBValidKey; 'estado': IDBValidKey; 'inmueble-ejercicio': IDBValidKey; 'inmuebleId': IDBValidKey; 'movimientoId': IDBValidKey; 'origen': IDBValidKey; 'origen-origenId': IDBValidKey; 'treasuryEventId': IDBValidKey } };
  mejorasInmueble: { key: IDBValidKey; value: MejoraInmueble; indexes: { 'ejercicio': IDBValidKey; 'inmueble-ejercicio': IDBValidKey; 'inmuebleId': IDBValidKey; 'movimientoId': IDBValidKey; 'treasuryEventId': IDBValidKey } };
  mueblesInmueble: { key: IDBValidKey; value: MuebleInmueble; indexes: { 'ejercicio': IDBValidKey; 'inmueble-ejercicio': IDBValidKey; 'inmuebleId': IDBValidKey; 'movimientoId': IDBValidKey; 'treasuryEventId': IDBValidKey } };
}

/** Nombre de un store válido del schema (Fase 0 DBSchema). Exportado para tipar
 *  utilidades genéricas fuera de db.ts (§3/§4.2 · sin casts). */
export type AtlasStoreName = StoreNames<AtlasHorizonDB>;
let dbPromise: Promise<IDBPDatabase<AtlasHorizonDB>>;

// Stash pre-upgrade de `objetivos_financieros` + merge post-upgrade a `escenarios`:
// ELIMINADOS (bloque 3 · commit final B). Solo actuaban sobre DBs en oldVersion<59
// con el store viejo; la DB única está en v79 y sus KPIs macro ya viven en
// `escenarios`. Retirado para no correr un open/close extra en cada initDB.

export const initDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<AtlasHorizonDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Frente C · troceo: cuerpo del upgrade movido a ./db/upgrade-a y -b
        // (mover-no-reescribir · orden preservado: A luego B).
        applyUpgradeA(db, oldVersion, transaction);
        // return: idb espera la promesa de la migración async dentro de la versionchange tx
        return applyUpgradeB(db, oldVersion, transaction);
      },
      blocked() {
        console.warn('[DB] Upgrade blocked by another connection. Recarga las otras pestañas de ATLAS para completar la migración.');
      },
      blocking() {
        console.warn('This connection is blocking a database upgrade');
      },
      terminated() {
        console.warn('Database connection was terminated');
        dbPromise = null!; // Reset promise to allow reconnection
      }
    }).catch(error => {
      console.error('Database initialization failed:', error);
      dbPromise = null!; // Reset promise to allow retry
      throw error;
    });

    // Merge post-upgrade de KPIs macro de objetivos_financieros → escenarios:
    // ELIMINADO (bloque 3 · commit final B) junto con el stash que lo alimentaba.
    // Solo actuaba sobre DBs oldVersion<59; la DB única en v79 ya tiene sus KPIs
    // macro en `escenarios`.

    // ── V78 · refactor modelo alquileres v3 · migración de datos post-upgrade ──
    // Idempotente vía flag en keyval. Se ejecuta con transacciones readwrite
    // normales (fuera de la versionchange) para evitar el `return` de la rama
    // V75 que cortaría la migración en DBs frescas. Pasos:
    //   B · derivar `Property.modoExplotacion` del legacy `alquilerPorHabitaciones.activo`
    //   C · inicializar `Contract.inquilino.cotitulares = []` en contratos existentes
    //   D · eliminar Contracts huérfanos `estadoContrato='sin_identificar'` + cascada
    //       de `treasuryEvents` (sourceType='contrato', sourceId=contractId)
    // Frente C · troceo: migraciones post-open movidas a ./db/post-open.
    dbPromise = runPostOpenMigrations(dbPromise);
  }
  return dbPromise;
};


// Blob storage and download utilities (H0.4 requirement) · movidas a ./db/documents
// (Frente C · troceo · import arriba con el resto). Re-export para no tocar a los
// consumidores (downloadBlob también se usa internamente en el export de snapshot).
export { getDocumentBlob, downloadBlob, saveDocumentWithBlob, deleteDocumentAndBlob };

// Enhanced Export & Import snapshot functions with ZIP support (H1 requirement)
// Snapshot / export / import / reset · movidas a ./db/snapshot (Frente C · troceo).
// El re-export carga ./db/snapshot y ejecuta su side-effect exposeAtlasDBHandle()
// (expone window.atlasDB), igual que antes. exposeAtlasDBHandle queda interno allí.
export { exportSnapshot, importSnapshot, resetAllData, exportSnapshotJSON, bulkClearStores } from './db/snapshot';

export type {
  PersonalData,
} from '../types/personal';

export type {
  ArrastreAmortizacion,
  ArrastreGastoInmueble,
  ArrastrePerdidasAhorro,
  ArrastresEjercicio,
  ConceptoFiscalVinculable,
  DeclaracionActividad,
  DeclaracionBasesYCuotas,
  DeclaracionCapitalMobiliario,
  DeclaracionGananciasPerdidas,
  DeclaracionIRPF,
  DeclaracionInmueble,
  DeclaracionPlanPensiones,
  DeclaracionTrabajo,
  DocumentoFiscal,
  EjercicioFiscal as FiscalEjercicioDomain,
  EstadoEjercicio as FiscalEstadoEjercicio,
  InformeCoberturaDocumental,
  LineaCoberturaDocumental,
  OrigenDeclaracion,
  PerdidasPendientes,
  TipoDocumentoFiscal,
} from '../types/fiscal';
