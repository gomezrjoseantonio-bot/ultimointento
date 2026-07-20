import { openDB, IDBPDatabase } from 'idb';
import type { DBSchema, IDBPObjectStore, IndexNames, StoreNames } from 'idb';
import { repoblarNifsBotesDesdeArchivo, recalcularFechaFinContratosAEAT, backfillDocumentoFirmado } from './alquileresV3FixService';
// Frente C · troceo: helpers de blob/documento viven en ./db/documents (import
// diferido · initDB se usa dentro de funciones async, sin ciclo en runtime).
import { getDocumentBlob, downloadBlob, saveDocumentWithBlob, deleteDocumentAndBlob } from './db/documents';
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

function ensureIndex<
  DBTypes extends DBSchema | unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>>,
  StoreName extends StoreNames<DBTypes>,
>(
  store: IDBPObjectStore<DBTypes, TxStores, StoreName, 'versionchange'>,
  indexName: string,
  keyPath: string | string[],
  options: IDBIndexParameters = { unique: false },
): void {
  const typedIndexName = indexName as IndexNames<DBTypes, StoreName>;

  if (store.indexNames.contains(typedIndexName)) {
    return;
  }

  try {
    store.createIndex(typedIndexName, keyPath, options);
  } catch (error) {
    if ((error as DOMException)?.name === 'ConstraintError' && options.unique) {
      console.warn(`[DB] Índice único '${indexName}' degradado a no único por datos legacy duplicados.`);
      store.createIndex(typedIndexName, keyPath, { ...options, unique: false });
      return;
    }

    throw error;
  }
}

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
        // Properties store
        if (!db.objectStoreNames.contains('properties')) {
          const propertyStore = db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
          propertyStore.createIndex('alias', 'alias', { unique: false });
          propertyStore.createIndex('address', 'address', { unique: false });
        }

        if (!db.objectStoreNames.contains('property_sales')) {
          const propertySalesStore = db.createObjectStore('property_sales', { keyPath: 'id', autoIncrement: true });
          propertySalesStore.createIndex('propertyId', 'propertyId', { unique: false });
          propertySalesStore.createIndex('saleDate', 'saleDate', { unique: false });
          propertySalesStore.createIndex('status', 'status', { unique: false });
          propertySalesStore.createIndex('property-status', ['propertyId', 'status'], { unique: false });
        }

        // loan_settlements: ELIMINADO en V63 (sub-tarea 4) — destino prestamos.liquidacion · 0 registros

        // objetivos_financieros: creación bajo guard oldVersion<32 ELIMINADA (bloque 2.4).
        //   Store migrado a 'escenarios' (V5.4/V5.5) y físicamente eliminado (V5.9). El
        //   tipo sale del schema. La migración de datos V5.5/V5.9 y su stash pre-upgrade se
        //   conservan intactos: preservan KPIs macro de DBs antiguas hacia 'escenarios' (no
        //   son limpieza sino migración de datos, y tocan el camino caliente de initDB).

        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const documentStore = db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
          documentStore.createIndex('type', 'type', { unique: false });
          documentStore.createIndex('entityType', 'metadata.entityType', { unique: false });
          documentStore.createIndex('entityId', 'metadata.entityId', { unique: false });
        }

        // Contracts store
        if (!db.objectStoreNames.contains('contracts')) {
          const contractStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
          contractStore.createIndex('propertyId', 'propertyId', { unique: false });
        }

        // V76 (T6 histórico): los nuevos campos de `contracts` son opcionales y
        // no requieren cambios de schema · migración suave sin reescritura.
        // Los contratos existentes quedan con los campos undefined y el drawer
        // ex-contrato muestra "—" en su lugar.
        if (oldVersion < 76) {
          // no-op intencionado · sin pérdida de datos · sin seed
        }

        // V78 · refactor modelo alquileres v3 · store del Camino 2 (botes anuales).
        // Guardado con `!contains` para cubrir tanto DBs frescas (oldVersion 0) como
        // upgrades v77→v78. La migración de DATOS (derivar modoExplotacion, init
        // cotitulares, borrar Contracts huérfanos sin_identificar) corre en el hook
        // post-upgrade idempotente más abajo (no aquí, para no chocar con el `return`
        // de la rama V75 que cortaría la ejecución en DBs frescas).
        if (!db.objectStoreNames.contains('botesAnualesSinIdentificar')) {
          const botesStore = db.createObjectStore('botesAnualesSinIdentificar', { keyPath: 'id', autoIncrement: true });
          botesStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          botesStore.createIndex('inmuebleId-año', ['inmuebleId', 'año'], { unique: true });
          botesStore.createIndex('estado', 'estado', { unique: false });
        }

        // V79 · onboarding día 0 · campo raíz nuevo `Property.estructuraCompra`
        // (opcional). IndexedDB es schemaless a nivel de record · NO hay store
        // nuevo ni reescritura. Las properties existentes quedan con
        // `estructuraCompra` undefined (no-op intencionado · no destructivo). El
        // bump 78→79 solo marca la evolución de schema.
        if (oldVersion < 79) {
          // no-op intencionado · campo opcional · sin pérdida de datos · sin seed
        }

        // H5: expensesH5, reforms, reformLineItems — DELETED in V4.2

        // H5: AEAT Carry Forwards store
        if (!db.objectStoreNames.contains('aeatCarryForwards')) {
          const carryForwardStore = db.createObjectStore('aeatCarryForwards', { keyPath: 'id', autoIncrement: true });
          carryForwardStore.createIndex('propertyId', 'propertyId', { unique: false });
          carryForwardStore.createIndex('taxYear', 'taxYear', { unique: false });
          carryForwardStore.createIndex('expirationYear', 'expirationYear', { unique: false });
        }

        // H5: Property Days store
        if (!db.objectStoreNames.contains('propertyDays')) {
          const propertyDaysStore = db.createObjectStore('propertyDays', { keyPath: 'id', autoIncrement: true });
          propertyDaysStore.createIndex('propertyId', 'propertyId', { unique: false });
          propertyDaysStore.createIndex('taxYear', 'taxYear', { unique: false });
          propertyDaysStore.createIndex('property-year', ['propertyId', 'taxYear'], { unique: true });
        }

        // propertyImprovements, operacionesFiscales, mejorasActivo, mobiliarioActivo — DELETED in V4.2

        // V3.8: Proveedores store (unique entity per NIF)
        if (!db.objectStoreNames.contains('proveedores')) {
          db.createObjectStore('proveedores', { keyPath: 'nif' });
        }

        // operacionesProveedor: store removed in V62 (sub-tarea 3)

        // V4.0: gastosInmueble — store unificado de gastos por inmueble
        if (!db.objectStoreNames.contains('gastosInmueble')) {
          const gastosStore = db.createObjectStore('gastosInmueble', { keyPath: 'id', autoIncrement: true });
          gastosStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          gastosStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          gastosStore.createIndex('inmueble-ejercicio', ['inmuebleId', 'ejercicio'], { unique: false });
          gastosStore.createIndex('casillaAEAT', 'casillaAEAT', { unique: false });
          gastosStore.createIndex('origen', 'origen', { unique: false });
          gastosStore.createIndex('estado', 'estado', { unique: false });
          gastosStore.createIndex('origen-origenId', ['origen', 'origenId'], { unique: false });
          // PR3 · índices para revert eficiente (treasuryConfirmationService)
          ensureIndex(gastosStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(gastosStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        } else {
          const gastosStore = transaction.objectStore('gastosInmueble');
          ensureIndex(gastosStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(gastosStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        }

        // V4.0: mejorasInmueble — mejoras/ampliaciones/reparaciones por inmueble
        if (!db.objectStoreNames.contains('mejorasInmueble')) {
          const mejorasStore = db.createObjectStore('mejorasInmueble', { keyPath: 'id', autoIncrement: true });
          mejorasStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          mejorasStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          mejorasStore.createIndex('inmueble-ejercicio', ['inmuebleId', 'ejercicio'], { unique: false });
          ensureIndex(mejorasStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mejorasStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        } else {
          const mejorasStore = transaction.objectStore('mejorasInmueble');
          ensureIndex(mejorasStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mejorasStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        }

        // V4.0: mueblesInmueble — mobiliario amortizable por inmueble
        if (!db.objectStoreNames.contains('mueblesInmueble')) {
          const mueblesStore = db.createObjectStore('mueblesInmueble', { keyPath: 'id', autoIncrement: true });
          mueblesStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          mueblesStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          mueblesStore.createIndex('inmueble-ejercicio', ['inmuebleId', 'ejercicio'], { unique: false });
          ensureIndex(mueblesStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mueblesStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        } else {
          const mueblesStore = transaction.objectStore('mueblesInmueble');
          ensureIndex(mueblesStore, 'movimientoId', 'movimientoId', { unique: false });
          ensureIndex(mueblesStore, 'treasuryEventId', 'treasuryEventId', { unique: false });
        }

        // NOTE: rentCalendar and rentPayments stores removed in V4.5 — migrated to rentaMensual
        // rentaMensual: store removed in V62 (sub-tarea 3)
        // kpiConfigurations: store removed in V62 (sub-tarea 3)

        // H8: Treasury Accounts store
        if (!db.objectStoreNames.contains('accounts')) {
          const accountsStore = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
          accountsStore.createIndex('destination', 'destination', { unique: false });
          accountsStore.createIndex('bank', 'bank', { unique: false });
          accountsStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // H8: Treasury Movements store
        if (!db.objectStoreNames.contains('movements')) {
          const movementsStore = db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
          movementsStore.createIndex('accountId', 'accountId', { unique: false });
          movementsStore.createIndex('date', 'date', { unique: false });
          movementsStore.createIndex('status', 'status', { unique: false });
          movementsStore.createIndex('importBatch', 'importBatch', { unique: false });
          // Duplicate detection index
          movementsStore.createIndex('duplicate-key', ['accountId', 'date', 'amount', 'description'], { unique: false });
        }

        // H8: Import Batches store
        if (!db.objectStoreNames.contains('importBatches')) {
          const importBatchesStore = db.createObjectStore('importBatches', { keyPath: 'id' });
          importBatchesStore.createIndex('accountId', 'accountId', { unique: false });
          importBatchesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // H9: Treasury Events store
        if (!db.objectStoreNames.contains('treasuryEvents')) {
          const treasuryEventsStore = db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
          treasuryEventsStore.createIndex('type', 'type', { unique: false });
          treasuryEventsStore.createIndex('predictedDate', 'predictedDate', { unique: false });
          treasuryEventsStore.createIndex('accountId', 'accountId', { unique: false });
          treasuryEventsStore.createIndex('status', 'status', { unique: false });
          treasuryEventsStore.createIndex('sourceType', 'sourceType', { unique: false });
          treasuryEventsStore.createIndex('sourceId', 'sourceId', { unique: false });
          // GAP-3: Índices para cashflow histórico
          ensureIndex(treasuryEventsStore, 'año', 'año', { unique: false });
          ensureIndex(treasuryEventsStore, 'generadoPor', 'generadoPor', { unique: false });
          ensureIndex(treasuryEventsStore, 'certeza', 'certeza', { unique: false });
          // PR3: índices para ámbito + inmueble (unified treasury architecture)
          ensureIndex(treasuryEventsStore, 'ambito', 'ambito', { unique: false });
          ensureIndex(treasuryEventsStore, 'inmuebleId', 'inmuebleId', { unique: false });
        } else {
          // GAP-3: Añadir índices históricos a bases de datos existentes
          const treasuryEventsStore = transaction.objectStore('treasuryEvents');
          ensureIndex(treasuryEventsStore, 'año', 'año', { unique: false });
          ensureIndex(treasuryEventsStore, 'generadoPor', 'generadoPor', { unique: false });
          ensureIndex(treasuryEventsStore, 'certeza', 'certeza', { unique: false });
          // PR3: índices para ámbito + inmueble
          ensureIndex(treasuryEventsStore, 'ambito', 'ambito', { unique: false });
          ensureIndex(treasuryEventsStore, 'inmuebleId', 'inmuebleId', { unique: false });
        }

        // treasuryRecommendations: store removed in V62 (sub-tarea 3)

        // fiscalSummaries — DELETED in V4.2

        // gastos (treasury) — DELETED in V4.2

        // H9: New Budget System - Presupuestos store (per specification)
        if (!db.objectStoreNames.contains('presupuestos')) {
          const presupuestosStore = db.createObjectStore('presupuestos', { keyPath: 'id' });
          presupuestosStore.createIndex('year', 'year', { unique: false });
          presupuestosStore.createIndex('estado', 'estado', { unique: false });
        }

        // H9: New Budget System - Presupuesto Lineas store (per specification)
        if (!db.objectStoreNames.contains('presupuestoLineas')) {
          const presupuestoLineasStore = db.createObjectStore('presupuestoLineas', { keyPath: 'id' });
          presupuestoLineasStore.createIndex('presupuestoId', 'presupuestoId', { unique: false });
          presupuestoLineasStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          presupuestoLineasStore.createIndex('tipo', 'tipo', { unique: false });
          presupuestoLineasStore.createIndex('categoria', 'categoria', { unique: false });
          presupuestoLineasStore.createIndex('frecuencia', 'frecuencia', { unique: false });
          presupuestoLineasStore.createIndex('origen', 'origen', { unique: false });
          presupuestoLineasStore.createIndex('cuentaId', 'cuentaId', { unique: false });
          presupuestoLineasStore.createIndex('contratoId', 'contratoId', { unique: false });
          presupuestoLineasStore.createIndex('prestamoId', 'prestamoId', { unique: false });
        }

        // matchingConfiguration: ELIMINADO en V63 (sub-tarea 4) — destino keyval['matchingConfig'] · 0 registros

        // reconciliationAuditLogs: ELIMINADO en V64 (sub-tarea 5) — no se crea en DBs frescas

        // V1.1: Movement learning rules store
        if (!db.objectStoreNames.contains('movementLearningRules')) {
          const learningRulesStore = db.createObjectStore('movementLearningRules', { keyPath: 'id', autoIncrement: true });
          learningRulesStore.createIndex('learnKey', 'learnKey', { unique: true });
          learningRulesStore.createIndex('categoria', 'categoria', { unique: false });
          learningRulesStore.createIndex('ambito', 'ambito', { unique: false });
          learningRulesStore.createIndex('createdAt', 'createdAt', { unique: false });
          learningRulesStore.createIndex('appliedCount', 'appliedCount', { unique: false });
        }

        // learningLogs: ELIMINADO en V64 (sub-tarea 5) — no se crea en DBs frescas

        // V1.2: Personal V1 module data stores
        if (!db.objectStoreNames.contains('personalData')) {
          const personalDataStore = db.createObjectStore('personalData', { keyPath: 'id', autoIncrement: true });
          personalDataStore.createIndex('dni', 'dni', { unique: true });
          personalDataStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        if (!db.objectStoreNames.contains('personalModuleConfig')) {
          const configStore = db.createObjectStore('personalModuleConfig', { keyPath: 'personalDataId' });
          configStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        // nominas: ELIMINADO en V63 (sub-tarea 4 · deuda sub-tarea 2) — datos en `ingresos` con tipo='nomina'

        // V61 (TAREA 7 sub-tarea 2): store unificado `ingresos`. Para DBs
        // frescas se crea aquí; para DBs existentes se crea + se rellena en
        // el bloque `if (oldVersion < 61)` más abajo.
        if (!db.objectStoreNames.contains('ingresos')) {
          const ingresosStore = db.createObjectStore('ingresos', { keyPath: 'id', autoIncrement: true });
          ingresosStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          ingresosStore.createIndex('tipo', 'tipo', { unique: false });
          ingresosStore.createIndex('fechaActualizacion', 'fechaActualizacion', { unique: false });
        }

        // autonomos: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='autonomo'

        // V65 (TAREA 13): módulo planes de pensiones · stores nuevos

        if (!db.objectStoreNames.contains('planesPensiones')) {
          const planesStore = db.createObjectStore('planesPensiones', { keyPath: 'id' });
          planesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
          planesStore.createIndex('tipoAdministrativo', 'tipoAdministrativo', { unique: false });
          planesStore.createIndex('estado', 'estado', { unique: false });
          planesStore.createIndex('titular', 'titular', { unique: false });
        }

        if (!db.objectStoreNames.contains('aportacionesPlan')) {
          const aportacionesStore = db.createObjectStore('aportacionesPlan', { keyPath: 'id' });
          aportacionesStore.createIndex('planId', 'planId', { unique: false });
          aportacionesStore.createIndex('ejercicioFiscal', 'ejercicioFiscal', { unique: false });
          aportacionesStore.createIndex('planId+ejercicioFiscal', ['planId', 'ejercicioFiscal'], { unique: false });
          aportacionesStore.createIndex('origen', 'origen', { unique: false });
          aportacionesStore.createIndex('ingresoIdNomina', 'ingresoIdNomina', { unique: false });
        }

        if (!db.objectStoreNames.contains('traspasosPlanPensiones')) {
          const traspasosNuevoStore = db.createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true });
          traspasosNuevoStore.createIndex('planId', 'planId', { unique: false });
          traspasosNuevoStore.createIndex('fechaEjecucion', 'fechaEjecucion', { unique: false });
        }

        // otrosIngresos: ELIMINADO en V63 (sub-tarea 4-bis) — destino ingresos.tipo='otro' + metadata.otro

        // V1.3: Inversiones (Investment positions) store
        if (!db.objectStoreNames.contains('inversiones')) {
          const inversionesStore = db.createObjectStore('inversiones', { keyPath: 'id', autoIncrement: true });
          inversionesStore.createIndex('tipo', 'tipo', { unique: false });
          inversionesStore.createIndex('activo', 'activo', { unique: false });
          inversionesStore.createIndex('entidad', 'entidad', { unique: false });
        }

        // patrimonioSnapshots: store removed in V62 (sub-tarea 3)

        // General key-value store for application configuration
        if (!db.objectStoreNames.contains('keyval')) {
          db.createObjectStore('keyval');
        }

        // Financiacion: Prestamos store for loan persistence
        if (!db.objectStoreNames.contains('prestamos')) {
          const prestamosStore = db.createObjectStore('prestamos', { keyPath: 'id' });
          prestamosStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          prestamosStore.createIndex('tipo', 'tipo', { unique: false });
          prestamosStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // V74 (T-VALORACIONES PR1): store polimórfico `valoracionesActivos`.
        // Sustituye al anterior `valoraciones_historicas` (V2.1 · snake_case ·
        // YYYY-MM). La transformación de datos existente vive en el bloque
        // `if (oldVersion < 74)` más abajo · este bloque solo garantiza que
        // las DBs frescas (oldVersion === 0) reciban el store nuevo
        // directamente sin pasar por el viejo. Schema camelCase, fechas
        // YYYY-MM-DD, activoId siempre string, 5 tipos + subtipo opcional
        // inversion, soft delete · ver `src/types/valoracionActivo.ts`.
        if (!db.objectStoreNames.contains('valoracionesActivos')) {
          const valoracionesActivosStore = db.createObjectStore('valoracionesActivos', {
            keyPath: 'id',
            autoIncrement: true,
          });
          valoracionesActivosStore.createIndex('idx_activo', 'activoId', { unique: false });
          valoracionesActivosStore.createIndex('idx_activo_fecha', ['activoId', 'fecha'], { unique: false });
          valoracionesActivosStore.createIndex('idx_tipo', 'tipoActivo', { unique: false });
          valoracionesActivosStore.createIndex('idx_fecha', 'fecha', { unique: false });
          valoracionesActivosStore.createIndex('idx_anchor_fiscal', ['esAnchorFiscal', 'activoId'], { unique: false });
          valoracionesActivosStore.createIndex('idx_tipo_subtipo', ['tipoActivo', 'subtipoInversion'], { unique: false });
        }

        // valoraciones_mensuales: store removed in V62 (sub-tarea 3)
        // opexRules: store removed in V62 (sub-tarea 3)

        // pensiones: ELIMINADO en V63 (sub-tarea 4) — destino ingresos.tipo='pension'

        // configuracion_fiscal: store removed in V62 (sub-tarea 3)
        // ejerciciosFiscales: store removed in V62 (sub-tarea 3)

        // documentosFiscales: ELIMINADO en V63 (sub-tarea 4) — destino documents.metadata.tipo='fiscal'
        // arrastresManual: ELIMINADO en V63 (sub-tarea 4) — destino arrastresIRPF.origen='manual'

        // V2.9: Resultado de ejercicio store (immutable yearly snapshots)
        if (!db.objectStoreNames.contains('resultadosEjercicio')) {
          const resultadosStore = db.createObjectStore('resultadosEjercicio', { keyPath: 'id', autoIncrement: true });
          resultadosStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          resultadosStore.createIndex('estadoEjercicio', 'estadoEjercicio', { unique: false });
          resultadosStore.createIndex('origen', 'origen', { unique: false });
          resultadosStore.createIndex('ejercicio-estado', ['ejercicio', 'estadoEjercicio'], { unique: false });
        }

        // V2.7: Arrastres IRPF store (carry-forwards between fiscal years)
        if (!db.objectStoreNames.contains('arrastresIRPF')) {
          const arrastresStore = db.createObjectStore('arrastresIRPF', { keyPath: 'id', autoIncrement: true });
          arrastresStore.createIndex('ejercicioOrigen', 'ejercicioOrigen', { unique: false });
          arrastresStore.createIndex('tipo', 'tipo', { unique: false });
          arrastresStore.createIndex('estado', 'estado', { unique: false });
          arrastresStore.createIndex('ejercicioCaducidad', 'ejercicioCaducidad', { unique: false });
          arrastresStore.createIndex('inmuebleId', 'inmuebleId', { unique: false });
          arrastresStore.createIndex('ejercicioOrigen-tipo', ['ejercicioOrigen', 'tipo'], { unique: false });
        }

        if (!db.objectStoreNames.contains('perdidasPatrimonialesAhorro')) {
          const perdidasStore = db.createObjectStore('perdidasPatrimonialesAhorro', { keyPath: 'id', autoIncrement: true });
          perdidasStore.createIndex('ejercicioOrigen', 'ejercicioOrigen', { unique: false });
          perdidasStore.createIndex('estado', 'estado', { unique: false });
          perdidasStore.createIndex('ejercicioCaducidad', 'ejercicioCaducidad', { unique: false });
        }

        // V2.7: Snapshots de Declaración store (frozen IRPF declaration data)
        if (!db.objectStoreNames.contains('snapshotsDeclaracion')) {
          const snapshotsStore = db.createObjectStore('snapshotsDeclaracion', { keyPath: 'id', autoIncrement: true });
          snapshotsStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          snapshotsStore.createIndex('origen', 'origen', { unique: false });
          snapshotsStore.createIndex('fechaSnapshot', 'fechaSnapshot', { unique: false });
        }

        if (!db.objectStoreNames.contains('entidadesAtribucion')) {
          const entidadesStore = db.createObjectStore('entidadesAtribucion', { keyPath: 'id', autoIncrement: true });
          entidadesStore.createIndex('nif', 'nif', { unique: false });
          entidadesStore.createIndex('tipoRenta', 'tipoRenta', { unique: false });
        }


        // V3.7: Ejercicios Fiscales Coordinador store (4 regímenes)
        if (!db.objectStoreNames.contains('ejerciciosFiscalesCoord')) {
          const coordStore = db.createObjectStore('ejerciciosFiscalesCoord', { keyPath: 'año' });
          coordStore.createIndex('estado', 'estado');
        }

        // V3.9: Vínculos accesorio (parking/trastero) por ejercicio
        if (!db.objectStoreNames.contains('vinculosAccesorio')) {
          const vinculosStore = db.createObjectStore('vinculosAccesorio', { keyPath: 'id', autoIncrement: true });
          vinculosStore.createIndex('inmueblePrincipalId', 'inmueblePrincipalId', { unique: false });
          vinculosStore.createIndex('inmuebleAccesorioId', 'inmuebleAccesorioId', { unique: false });
          vinculosStore.createIndex('principal-accesorio-ejercicio', ['inmueblePrincipalId', 'inmuebleAccesorioId', 'ejercicio'], { unique: true });
        }

        // V71: deudas fiscales con AEAT (modelos 100/303/130/184)
        // SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 1 hueco 4
        if (!db.objectStoreNames.contains('deudasFiscales')) {
          const deudasStore = db.createObjectStore('deudasFiscales', {
            keyPath: 'id',
            autoIncrement: true,
          });
          deudasStore.createIndex('modelo', 'modelo', { unique: false });
          deudasStore.createIndex('ejercicio', 'ejercicio', { unique: false });
          deudasStore.createIndex('estado', 'estado', { unique: false });
          deudasStore.createIndex('notificada', 'notificada', { unique: false });
        }

        // V72: benchmarks de referencia editables · datos de mercado
        // T-INVERSIONES-DETALLE-PP-v1 §4.A · usados por `proyeccionActivoService`
        // (PR 1) y la UI Ajustes → Datos de mercado (PR 2).
        // Precarga: 6 benchmarks con metadata + `valoresAnuales: {}` vacío
        // (decisión Q-PRE-H opción B). La precarga la hace el servicio
        // `benchmarksReferenciaService.runMigration_v72()` POST-upgrade,
        // controlada por el flag `migration_v72_benchmarksReferencia_v1`
        // en `keyval` para que sea idempotente.
        if (!db.objectStoreNames.contains('benchmarksReferencia')) {
          const benchmarksStore = db.createObjectStore('benchmarksReferencia', {
            keyPath: 'id',
          });
          benchmarksStore.createIndex('codigo', 'codigo', { unique: true });
          benchmarksStore.createIndex('tipo', 'tipo', { unique: false });
          benchmarksStore.createIndex('ultimaActualizacion', 'ultimaActualizacion', {
            unique: false,
          });
        }

        // V73: avisos cerrables del usuario
        // T-INVERSIONES-DETALLE-PP-v1 §4.E · banners de proyección · benchmark
        // · costes · hitos · histograma · ranking · etc. Cada banner con X y
        // persistencia aquí. Restaurables desde Ajustes → Avisos.
        if (!db.objectStoreNames.contains('avisosUsuario')) {
          db.createObjectStore('avisosUsuario', { keyPath: 'avisoId' });
        }

        // V73: hitos vitales (jubilación · salida empresa · compra vivienda
        // · hijo a uni · herencia). T-INVERSIONES-DETALLE-PP-v1 §4.C Caso B
        // · convive con `objetivos` (operativos) sin tocarlos. Usados por
        // BloqueHitos en la ficha de inversiones (PR 4).
        if (!db.objectStoreNames.contains('objetivosVitales')) {
          const ovStore = db.createObjectStore('objetivosVitales', { keyPath: 'id' });
          ovStore.createIndex('tipo', 'tipo', { unique: false });
          ovStore.createIndex('planFinancieroAsociado', 'planFinancieroAsociado', {
            unique: false,
          });
          ovStore.createIndex('fechaEstimada', 'fechaEstimada', { unique: false });
        }

        // V2.8: Allow multiple snapshots per ejercicio (force snapshots)
        if (db.objectStoreNames.contains('snapshotsDeclaracion')) {
          const snapshotsStore = transaction.objectStore('snapshotsDeclaracion');
          if (snapshotsStore.indexNames.contains('ejercicio')) {
            snapshotsStore.deleteIndex('ejercicio');
          }
          snapshotsStore.createIndex('ejercicio', 'ejercicio', { unique: false });
        }

        // ── V4.3: Personal Module Architecture ─────────────────────────────────
        // patronGastosPersonales: store removed in V62 (sub-tarea 3)
        // gastosPersonalesReal: store removed in V62 (sub-tarea 3)

        // 3. V4.3 migration personalExpenses → patronGastosPersonales — REMOVED in V4.4
        //    personalExpenses store is deleted in LIMPIEZA V44 below.

        // ═══════════════════════════════════════════════════
        // V4.8 — Cuenta remunerada: campos opcionales en accounts
        // Sin cambios estructurales — los campos esRemunerada y
        // remuneracion son opcionales y no requieren migración.
        // ═══════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════
        // V5.3 — ATLAS Personal v1.1 · modelo de datos exhaustivo
        //   1. compromisosRecurrentes (decisión G-01) · catálogo único
        //      con discriminador `ambito` (personal | inmueble).
        //      Migración: copia los registros existentes de `opexRules`
        //      conservando `ambito='inmueble'` y su `inmuebleId`.
        //      `opexRules` se mantiene en lectura por ahora para no romper
        //      la UI legacy de Inmuebles · futuras PRs deprecarán.
        //   2. viviendaHabitual · ficha única que genera eventos derivados
        //      directamente en `treasuryEvents` (no via compromiso).
        // ═══════════════════════════════════════════════════
        if (!db.objectStoreNames.contains('compromisosRecurrentes')) {
          const compromisosStore = db.createObjectStore('compromisosRecurrentes', {
            keyPath: 'id',
            autoIncrement: true,
          });
          ensureIndex(compromisosStore, 'ambito', 'ambito', { unique: false });
          ensureIndex(compromisosStore, 'personalDataId', 'personalDataId', { unique: false });
          ensureIndex(compromisosStore, 'inmuebleId', 'inmuebleId', { unique: false });
          ensureIndex(compromisosStore, 'tipo', 'tipo', { unique: false });
          ensureIndex(compromisosStore, 'categoria', 'categoria', { unique: false });
          ensureIndex(compromisosStore, 'cuentaCargo', 'cuentaCargo', { unique: false });
          ensureIndex(compromisosStore, 'estado', 'estado', { unique: false });
          ensureIndex(compromisosStore, 'fechaInicio', 'fechaInicio', { unique: false });
        }

        if (!db.objectStoreNames.contains('viviendaHabitual')) {
          const viviendaStore = db.createObjectStore('viviendaHabitual', {
            keyPath: 'id',
            autoIncrement: true,
          });
          ensureIndex(viviendaStore, 'personalDataId', 'personalDataId', { unique: false });
          ensureIndex(viviendaStore, 'activa', 'activa', { unique: false });
          ensureIndex(viviendaStore, 'vigenciaDesde', 'vigenciaDesde', { unique: false });
        }

        // ═══════════════════════════════════════════════════
        // V5.5 — Mi Plan v3 · escenarios (singleton)
        //   Crea el store `escenarios` y su singleton con defaults para bases nuevas.
        //   (La copia/borrado desde el legacy `objetivos_financieros` se retiró en el
        //    bloque 3 · commit final B: DB única en v79, datos ya en escenarios.)
        // ═══════════════════════════════════════════════════
        if (oldVersion < 55) {
          if (!db.objectStoreNames.contains('escenarios')) {
            db.createObjectStore('escenarios', { keyPath: 'id' });
          }

          const defaultEscenario = {
            id: 1,
            modoVivienda: 'alquiler',
            gastosVidaLibertadMensual: 2500,
            estrategia: 'hibrido',
            hitos: [],
            rentaPasivaObjetivo: 3000,
            patrimonioNetoObjetivo: 600000,
            cajaMinima: 10000,
            dtiMaximo: 35,
            ltvMaximo: 50,
            yieldMinimaCartera: 8,
            tasaAhorroMinima: 15,
            updatedAt: new Date().toISOString(),
          };

          // Copia de datos objetivos_financieros → escenarios ELIMINADA (bloque 3 ·
          // commit final B). La DB única en v79 ya tiene sus KPIs macro en `escenarios`;
          // una base nueva (oldVersion<55) nunca tuvo `objetivos_financieros`. Se crea el
          // singleton `escenarios` con defaults, que es el único camino que queda.
          transaction.objectStore('escenarios').put(defaultEscenario as unknown as Escenario);
        }

        // ═══════════════════════════════════════════════════
        // V5.6 — Mi Plan v3 · objetivos (lista)
        //   Store nuevo para los 4 tipos de objetivo:
        //   acumular · amortizar · comprar · reducir.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 56) {
          if (!db.objectStoreNames.contains('objetivos')) {
            const objetivosStore = db.createObjectStore('objetivos', { keyPath: 'id' });
            objetivosStore.createIndex('tipo', 'tipo', { unique: false });
            objetivosStore.createIndex('estado', 'estado', { unique: false });
            objetivosStore.createIndex('fondoId', 'fondoId', { unique: false });
            objetivosStore.createIndex('prestamoId', 'prestamoId', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.7 — Mi Plan v3 · fondos_ahorro
        //   Store nuevo para etiquetas de propósito sobre euros de tesorería.
        //   6 tipos: colchon · compra · reforma · impuestos · capricho · custom.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 57) {
          if (!db.objectStoreNames.contains('fondos_ahorro')) {
            const fondosStore = db.createObjectStore('fondos_ahorro', { keyPath: 'id' });
            fondosStore.createIndex('tipo', 'tipo', { unique: false });
            fondosStore.createIndex('activo', 'activo', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.8 — Mi Plan v3 · retos
        //   Store nuevo para retos mensuales.
        //   El índice 'mes' es UNIQUE: fuerza 1 reto por mes.
        // ═══════════════════════════════════════════════════
        if (oldVersion < 58) {
          if (!db.objectStoreNames.contains('retos')) {
            const retosStore = db.createObjectStore('retos', { keyPath: 'id' });
            retosStore.createIndex('mes', 'mes', { unique: true });
            retosStore.createIndex('estado', 'estado', { unique: false });
            retosStore.createIndex('tipo', 'tipo', { unique: false });
          }
        }

        // ═══════════════════════════════════════════════════
        // V5.9 — Cierre forzoso de migración V5.5 (objetivos_financieros → escenarios):
        //   ELIMINADO (bloque 3 · commit final B). Solo borraba `objetivos_financieros`
        //   en DBs oldVersion<59 que aún lo tuvieran; la DB única en v79 no lo tiene.
        // ═══════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════
        // V60 — TAREA 7 sub-tarea 1: Schema extensions on surviving stores
        //   Cambios NO destructivos · sólo añade campos opcionales,
        //   índices y backfill no rompedor sobre stores que SOBREVIVEN
        //   en V60. Las eliminaciones de los 19 stores se hacen en
        //   sub-tareas 3-8. El rename `nominas → ingresos` lo cubre
        //   sub-tarea 2 (bloque V61 más abajo).
        //
        //   Stores afectados:
        //     1. arrastresIRPF       · añadir índice 'origen' + backfill
        //                              de 'aeat' para registros existentes.
        //     2. documents           · sólo TS (unión metadata.tipo
        //                              ampliada) · sin cambio runtime.
        //     3. prestamos           · sólo TS (campo opcional
        //                              `liquidacion`) · sin cambio runtime.
        //     4. contracts           · sólo TS (campo opcional
        //                              `historicoRentas[]`) · sin cambio
        //                              runtime.
        //     5. movementLearningRules · sólo TS (campo opcional
        //                              `history[]`) · sin cambio runtime.
        //     6. accounts            · sólo JSDoc sobre `balance`.
        //     7. keyval              · sólo JSDoc sobre claves estándar.
        //     8. valoraciones_historicas · sólo JSDoc · usa índice
        //                              compuesto existente para queries
        //                              mensuales.
        //
        //   Contrato: cualquier registro pre-V60 sigue siendo legible con
        //   el nuevo schema (todos los campos nuevos son opcionales).
        // ═══════════════════════════════════════════════════
        if (oldVersion < 60) {
          // 1. arrastresIRPF · índice 'origen' + backfill 'aeat'
          if (db.objectStoreNames.contains('arrastresIRPF')) {
            const arrastresStore = transaction.objectStore('arrastresIRPF');
            ensureIndex(arrastresStore, 'origen', 'origen', { unique: false });

            // Backfill: cada registro pre-V60 sin `origen` recibe 'aeat'.
            // El `transaction` que entrega idb es un IDBPTransaction · sus
            // cursores se consumen vía promesas (no IDBRequest.onsuccess).
            // Iteramos con while + await cursor.continue() · mismo patrón
            // que la migración V5.4 (opexRules → compromisosRecurrentes).
            arrastresStore.openCursor().then(async function backfillArrastres(cursor) {
              while (cursor) {
                // cursor.value ya es ArrastreIRPF (store tipado); `origen` es
                // opcional, así que los registros pre-V60 lo traen ausente.
                const value = cursor.value;
                if (!value.origen) {
                  await cursor.update({ ...value, origen: 'aeat' });
                }
                cursor = await cursor.continue();
              }
            }).catch((err) => {
              console.warn('[DB V60] backfill arrastresIRPF.origen falló:', err);
            });
          }

          // 2-8. Resto de stores: cambios sólo en TS · IDB es schema-less
          // por registro y trata los nuevos campos opcionales como
          // `undefined` al leer registros pre-V60. No requieren acción
          // en runtime de migración.
        }

        // ═══════════════════════════════════════════════════
        // V61 — TAREA 7 sub-tarea 2: rename `nominas → ingresos`
        //   Crea el store unificado `ingresos` (unión discriminada
        //   `Ingreso = IngresoNomina | IngresoAutonomo | IngresoPension`)
        //   y copia los registros existentes de `nominas` añadiendo
        //   `tipo='nomina'`. Cambio NO destructivo: el store `nominas`
        //   se mantiene intacto · los consumidores siguen usándolo hasta
        //   sub-tarea 6 (cambio de consumidores). `autonomos` y
        //   `pensiones` se absorberán en sub-tareas posteriores con su
        //   propio mapeo de campos a la unión `Ingreso`.
        //
        //   Idempotencia:
        //   - El bloque de creación de stores ya garantiza que `ingresos`
        //     existe antes de entrar aquí.
        //   - El backfill sólo añade registros si `ingresos` está vacío,
        //     evitando duplicados si la migración se ejecutase dos veces
        //     (p.ej. tras una recuperación de error).
        // ═══════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════════════
        if (oldVersion < 65) {
          // ── V65 (TAREA 13): módulo planes de pensiones ──────────────────────
          // 1. Crear nuevos stores si no existen
          if (!db.objectStoreNames.contains('planesPensiones')) {
            const planesStore = db.createObjectStore('planesPensiones', { keyPath: 'id' });
            planesStore.createIndex('personalDataId', 'personalDataId', { unique: false });
            planesStore.createIndex('tipoAdministrativo', 'tipoAdministrativo', { unique: false });
            planesStore.createIndex('estado', 'estado', { unique: false });
            planesStore.createIndex('titular', 'titular', { unique: false });
          }
          if (!db.objectStoreNames.contains('aportacionesPlan')) {
            const aportacionesStore = db.createObjectStore('aportacionesPlan', { keyPath: 'id' });
            aportacionesStore.createIndex('planId', 'planId', { unique: false });
            aportacionesStore.createIndex('ejercicioFiscal', 'ejercicioFiscal', { unique: false });
            aportacionesStore.createIndex('planId+ejercicioFiscal', ['planId', 'ejercicioFiscal'], { unique: false });
            aportacionesStore.createIndex('origen', 'origen', { unique: false });
            aportacionesStore.createIndex('ingresoIdNomina', 'ingresoIdNomina', { unique: false });
          }
          if (!db.objectStoreNames.contains('traspasosPlanPensiones')) {
            const traspasosNuevoStore = db.createObjectStore('traspasosPlanPensiones', { keyPath: 'id', autoIncrement: true });
            traspasosNuevoStore.createIndex('planId', 'planId', { unique: false });
            traspasosNuevoStore.createIndex('fechaEjecucion', 'fechaEjecucion', { unique: false });
          }

          // 2. Migrar datos (async dentro de la transacción)
          return (async () => {
            const genUUID = (): string =>
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2) + Date.now().toString(36);

            const ahora = new Date().toISOString();

            // 2b. Migrar inversiones con tipo='plan_pensiones' o tipo='plan-pensiones'
            if (db.objectStoreNames.contains('inversiones')) {
              try {
                const invStore = transaction.objectStore('inversiones');
                const dstPlanes = transaction.objectStore('planesPensiones');
                const dstAportaciones = transaction.objectStore('aportacionesPlan');
                // Migración V60: los registros almacenados son la forma PRE-V60
                // (campos snake_case legacy: valor_actual, fecha_compra, empresaNif…),
                // que no coinciden con PosicionInversion. Se leen como registros
                // sueltos vía `unknown` intermedio (no es silenciar una incoherencia:
                // el dato histórico realmente no es del tipo actual).
                const rawInversiones: unknown = await invStore.getAll();
                const inversiones = rawInversiones as Array<Record<string, unknown>>;
                const PLAN_TIPOS = new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);
                for (const inv of inversiones) {
                  if (!PLAN_TIPOS.has(String(inv.tipo ?? ''))) continue;
                  const tipoAdm = (inv.empresaNif || inv.entidad?.toString().toLowerCase().includes('emp')) ? 'PPE' : 'PPI';
                  const newId = genUUID();
                  const nuevoPlan: Record<string, unknown> = {
                    id: newId,
                    nombre: inv.nombre ?? 'Plan de pensiones',
                    titular: 'yo' as const,
                    personalDataId: inv.personalDataId ?? 0,
                    tipoAdministrativo: tipoAdm,
                    gestoraActual: String(inv.entidad ?? ''),
                    valorActual: Number(inv.valor_actual ?? 0),
                    fechaContratacion: String(inv.fecha_compra ?? inv.fecha_valoracion ?? ahora.slice(0, 10)),
                    estado: 'activo' as const,
                    origen: 'migrado_v60' as const,
                    fechaCreacion: String(inv.created_at ?? ahora),
                    fechaActualizacion: ahora,
                  };
                  try { await dstPlanes.add(nuevoPlan as any); } catch { /* skip */ }

                  // Migrar aportaciones
                  for (const ap of (inv.aportaciones as any[] ?? [])) {
                    if (!ap.fecha) continue;
                    const añoNum = parseInt(String(ap.fecha).slice(0, 4), 10);
                    const aportacion: Record<string, unknown> = {
                      id: genUUID(),
                      planId: newId,
                      fecha: ap.fecha,
                      ejercicioFiscal: añoNum,
                      importeTitular: Number(ap.importe ?? 0),
                      importeEmpresa: 0,
                      origen: 'migrado_v60' as const,
                      granularidad: 'puntual' as const,
                      fechaCreacion: ahora,
                      fechaActualizacion: ahora,
                    };
                    try { await dstAportaciones.add(aportacion as any); } catch { /* skip */ }
                  }
                  // Eliminar de inversiones
                  try { await invStore.delete(inv.id as number); } catch { /* skip */ }
                }
              } catch (err) {
                console.warn('[DB V65] migración inversiones plan_pensiones→planesPensiones falló:', err);
              }
            }

          })();
        }

        if (oldVersion < 66) {
          // ── V66 (T27.1): wizard nuevo objetivo ──────────────────────────────
          // Solo añade campos OPCIONALES al shape `Objetivo`:
          //   - tipo='acumular' → unidad?: 'eur' | 'meses'
          //   - tipo='comprar'  → metric?: 'valor' | 'unidades'
          // No requiere migración real · IndexedDB no tiene schema rígido para
          // los valores · los registros existentes simplemente carecen del
          // campo · lo lee el código como `undefined` y aplica default 'eur'
          // / 'valor' al renderizar (compatibilidad retroactiva).
        }

        if (oldVersion < 67) {
          // ── V67 (T27.3): wizard nuevo fondo de ahorro ───────────────────────
          // Solo añade campos OPCIONALES al shape `FondoAhorro`:
          //   - objetivoVinculadoId?: string  (vinculación bidireccional con objetivos)
          //   - prioridad?: 'alta' | 'normal' (cascada en computeAcumuladoFondo · default 'normal')
          //   - fechaObjetivo?: string        (caja ritmo en step 3 · ISO YYYY-MM-DD)
          //   - colchonGastoMensual?: number  (reconstruir cálculo meta = meses × gasto en colchón)
          // El campo existente `metaMeses?` se reutiliza como "colchón meses".
          // Sin migración de datos · campos opcionales · IndexedDB sin schema
          // rígido · registros V66 sin campos siguen válidos (default
          // retroactivo · prioridad 'normal' · sin vinculación).
        }

        if (oldVersion < 68) {
          // ── V68 (T38): campo tipoFamilia en compromisosRecurrentes ──────────
          // Añade campo opcional `tipoFamilia?: string` para identificar la
          // familia real del gasto (vivienda · suministros · dia_a_dia ·
          // suscripciones · seguros_cuotas · otros · tributos · comunidad ·
          // seguros · gestion · reparacion).
          // Sin cambios de schema IndexedDB (campo opcional sin índice nuevo).
          // La migración de datos (inferir tipoFamilia para registros
          // existentes) se ejecuta de forma asíncrona POST-upgrade en
          // App.tsx via `runV68TipoFamiliaMigration` (idempotente · keyval).
        }

        if (oldVersion < 70) {
          // ── V70 (PR-C4 · sistémico patrón vs real) ──
          // Añade `historial?: NominaHistorialEntry[]` al patrón Nomina
          // (registros con `tipo='nomina'` en store `ingresos`).
          //
          // Solo bump de version · sin cambio de schema (el campo es
          // opcional sobre el store `ingresos` existente). El backfill
          // de datos lo hace `runV70NominaHistorialMigration` desde
          // `App.tsx` la primera vez que arranca la app tras el upgrade
          // (idempotente vía keyval flag · ver `migrations/v70-nomina-historial.ts`).
        }

        if (oldVersion < 71) {
          // ── V71 (SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 1 hueco 4) ──
          // Marker para upgrades incrementales V70→V71. La creación real del
          // store `deudasFiscales` está en el bloque unconditional al inicio
          // del callback (junto a `vinculosAccesorio`) para que se ejecute
          // también en migraciones acumulativas que toman el camino IIFE de
          // V65 (donde el `return` del IIFE corta la ejecución de bloques
          // posteriores). El store empieza vacío · sin migración de datos
          // (Jose lo poblará manualmente desde la UI F6).
        }

        if (oldVersion < 75) {
          // ── V75 (T-VALORACIONES PR7b · cierre del refactor) ──
          //
          // 1. Pre-purge sync · para cada activo con un valor legacy > 0
          //    (`valor_actual` en `properties`/`inversiones` o `valorActual`
          //    en `planesPensiones`) que NO tenga aún entrada en
          //    `valoracionesActivos`, crea una valoración con today.
          //    Esto cubre el edge case de activos creados después de los
          //    seeds PR4/PR5 que solo poblaron campo legacy.
          //
          // 2. Purga · elimina los campos legacy de cada record:
          //    - properties · valor_actual, valorActual, valorMercado,
          //      currentValue, marketValue, estimatedValue, valuation,
          //      compra.valor_actual, acquisitionCosts.currentValue
          //    - inversiones · valor_actual, valorActual, cotizacion,
          //      precioUnitario
          //    - planesPensiones · valorActual, valorConsolidado, saldoActual
          //
          // Campos fiscales NO se purgan · valorCatastral, valorAdquisicion,
          // precioCompra, valorCompra, tasacion (puede usarse anchor fiscal),
          // acquisitionCosts.price, compra.precio_compra · son datos
          // históricos de adquisición que viven separados del flujo de
          // valoración temporal.
          //
          // Snapshot pre-purge en localStorage para recuperación manual
          // si algo va mal. La transacción versionchange aborta atómicamente
          // si lanza · DB queda en v74 íntegra.

          return (async () => {
            const NEW_STORE = 'valoracionesActivos';
            const today = new Date().toISOString().split('T')[0];

            // ── Snapshot pre-purge ────────────────────────────────────
            try {
              const propertiesSnap = await (transaction as any).objectStore('properties').getAll();
              const inversionesSnap = await (transaction as any).objectStore('inversiones').getAll();
              const planesSnap = await (transaction as any).objectStore('planesPensiones').getAll();
              localStorage.setItem(
                'atlas_db_snapshot_pre_v75',
                JSON.stringify({
                  version: 74,
                  timestamp: new Date().toISOString(),
                  propertiesCount: propertiesSnap.length,
                  inversionesCount: inversionesSnap.length,
                  planesCount: planesSnap.length,
                }),
              );
            } catch (err) {
              console.warn('[DB V75] Snapshot localStorage falló (cuota?):', err);
            }

            // ── 1. Pre-purge sync · crear valoraciones para activos con
            //       valor legacy sin entrada en valoracionesActivos ─────
            const valStore = (transaction as any).objectStore(NEW_STORE);
            const allValoraciones = (await valStore.getAll()) as Array<{
              activoId: string;
              tipoActivo: string;
              deletedAt?: string | null;
            }>;
            const conValoracion = new Set<string>();
            for (const v of allValoraciones) {
              if (v?.deletedAt) continue;
              if (
                v?.tipoActivo === 'inmueble' ||
                v?.tipoActivo === 'inversion' ||
                v?.tipoActivo === 'plan_pensiones' ||
                v?.tipoActivo === 'deposito' ||
                v?.tipoActivo === 'otro'
              ) {
                conValoracion.add(`${String(v.activoId)}|${v.tipoActivo}`);
              }
            }

            const now = new Date().toISOString();
            let syncCreados = 0;

            // properties
            const propStore = (transaction as any).objectStore('properties');
            const propertiesAll = (await propStore.getAll()) as any[];
            for (const p of propertiesAll) {
              if (p?.id == null || p.state !== 'activo') continue;
              const id = String(p.id);
              if (conValoracion.has(`${id}|inmueble`)) continue;
              const valor =
                (typeof p.valor_actual === 'number' && p.valor_actual > 0 && p.valor_actual) ||
                (typeof p.valorActual === 'number' && p.valorActual > 0 && p.valorActual) ||
                (typeof p.currentValue === 'number' && p.currentValue > 0 && p.currentValue) ||
                (typeof p.marketValue === 'number' && p.marketValue > 0 && p.marketValue) ||
                (typeof p.estimatedValue === 'number' && p.estimatedValue > 0 && p.estimatedValue) ||
                (typeof p.valuation === 'number' && p.valuation > 0 && p.valuation) ||
                (typeof p.compra?.valor_actual === 'number' && p.compra.valor_actual > 0 && p.compra.valor_actual) ||
                (typeof p.acquisitionCosts?.currentValue === 'number' && p.acquisitionCosts.currentValue > 0 && p.acquisitionCosts.currentValue) ||
                null;
              if (valor) {
                await valStore.add({
                  activoId: id,
                  tipoActivo: 'inmueble',
                  fecha: today,
                  valor,
                  origen: 'seed_legacy_field_v74',
                  divisaOriginal: 'EUR',
                  notas: `Sync pre-purge v75 · valor rescatado de properties.${id}`,
                  esAnchorFiscal: false,
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                });
                syncCreados++;
              }
            }

            // inversiones · tipoActivo inferido del campo `tipo`
            const TIPO_PLAN_LEGACY = new Set(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);
            const TIPO_DEPOSITO = new Set(['deposito', 'deposito_plazo']);
            const invStore = (transaction as any).objectStore('inversiones');
            const inversionesAll = (await invStore.getAll()) as any[];
            for (const inv of inversionesAll) {
              if (inv?.id == null || inv?.activo === false) continue;
              const id = String(inv.id);
              const tipoCrudo = String(inv.tipo ?? '');
              const tipoActivo: 'plan_pensiones' | 'inversion' | 'deposito' | 'otro' =
                TIPO_PLAN_LEGACY.has(tipoCrudo)
                  ? 'plan_pensiones'
                  : TIPO_DEPOSITO.has(tipoCrudo)
                    ? 'deposito'
                    : tipoCrudo === 'otro'
                      ? 'otro'
                      : 'inversion';
              if (conValoracion.has(`${id}|${tipoActivo}`)) continue;
              const valor =
                (typeof inv.valor_actual === 'number' && inv.valor_actual > 0 && inv.valor_actual) ||
                (typeof inv.valorActual === 'number' && inv.valorActual > 0 && inv.valorActual) ||
                null;
              if (valor) {
                await valStore.add({
                  activoId: id,
                  tipoActivo,
                  fecha: today,
                  valor,
                  origen: 'seed_legacy_field_v74',
                  divisaOriginal: 'EUR',
                  notas: `Sync pre-purge v75 · valor rescatado de inversiones.${id} (tipo "${tipoCrudo}")`,
                  esAnchorFiscal: false,
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                });
                syncCreados++;
              }
            }

            // planesPensiones
            const planStore = (transaction as any).objectStore('planesPensiones');
            const planesAll = (await planStore.getAll()) as any[];
            for (const plan of planesAll) {
              if (plan?.id == null || plan?.estado === 'rescatado_total') continue;
              const id = String(plan.id);
              if (conValoracion.has(`${id}|plan_pensiones`)) continue;
              const valor =
                (typeof plan.valorActual === 'number' && plan.valorActual > 0 && plan.valorActual) ||
                (typeof plan.valorConsolidado === 'number' && plan.valorConsolidado > 0 && plan.valorConsolidado) ||
                null;
              if (valor) {
                await valStore.add({
                  activoId: id,
                  tipoActivo: 'plan_pensiones',
                  fecha: today,
                  valor,
                  origen: 'seed_legacy_field_v74',
                  divisaOriginal: 'EUR',
                  notas: `Sync pre-purge v75 · valor rescatado de planesPensiones.${id}`,
                  esAnchorFiscal: false,
                  createdAt: now,
                  updatedAt: now,
                  deletedAt: null,
                });
                syncCreados++;
              }
            }

            // ── 2. Purga · borrar campos legacy de cada store ────────
            const purgar = (record: any, fields: string[], nested?: Record<string, string[]>): { changed: boolean; newRecord: any } => {
              let changed = false;
              const newRecord = { ...record };
              for (const f of fields) {
                if (f in newRecord) {
                  delete newRecord[f];
                  changed = true;
                }
              }
              if (nested) {
                for (const [subKey, subFields] of Object.entries(nested)) {
                  if (newRecord[subKey] && typeof newRecord[subKey] === 'object') {
                    const subCopy = { ...newRecord[subKey] };
                    let subChanged = false;
                    for (const f of subFields) {
                      if (f in subCopy) {
                        delete subCopy[f];
                        subChanged = true;
                      }
                    }
                    if (subChanged) {
                      newRecord[subKey] = subCopy;
                      changed = true;
                    }
                  }
                }
              }
              return { changed, newRecord };
            };

            let purgados = 0;

            // properties · purgar valoración (NO valorCatastral · NO compra.precio_compra · NO acquisitionCosts.price · esos son fiscales)
            for (const p of propertiesAll) {
              const { changed, newRecord } = purgar(
                p,
                ['valor_actual', 'valorActual', 'valorMercado', 'currentValue', 'marketValue', 'estimatedValue', 'valuation'],
                { compra: ['valor_actual'], acquisitionCosts: ['currentValue'] },
              );
              if (changed) {
                await propStore.put(newRecord);
                purgados++;
              }
            }
            // inversiones
            for (const inv of inversionesAll) {
              const { changed, newRecord } = purgar(inv, ['valor_actual', 'valorActual', 'cotizacion', 'precioUnitario']);
              if (changed) {
                await invStore.put(newRecord);
                purgados++;
              }
            }
            // planesPensiones · valorActual purgado · valorConsolidado y saldoActual también
            for (const plan of planesAll) {
              const { changed, newRecord } = purgar(plan, ['valorActual', 'valorConsolidado', 'saldoActual']);
              if (changed) {
                await planStore.put(newRecord);
                purgados++;
              }
            }

            console.log(
              `[DB V75] T-VALORACIONES PR7b · ${syncCreados} valoraciones pre-purge sync · ${purgados} records purgados de campos legacy`,
            );
          })();
        }
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
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_alquileres';
        const yaHecha = await db.get('keyval', FLAG);
        if (yaHecha === 'completed') return db;

        // Paso B · Property.modoExplotacion desde el boolean legacy
        try {
          const tx = db.transaction(['properties'], 'readwrite');
          const store = tx.objectStore('properties');
          const props = (await store.getAll()) as Property[];
          for (const p of props) {
            if (p?.id == null) continue;
            if (p.modoExplotacion) continue; // ya poblado · idempotente
            const activo = (p as any).alquilerPorHabitaciones?.activo === true;
            p.modoExplotacion = activo ? 'por_habitaciones' : 'piso_completo';
            await store.put(p);
          }
          await tx.done;
        } catch (err) {
          console.warn('[DB V78] Paso B (modoExplotacion) falló:', err);
        }

        // Paso C · inicializar cotitulares=[] en Contracts existentes
        // Paso D · recolectar y eliminar Contracts huérfanos sin_identificar
        const huerfanosIds: number[] = [];
        try {
          const tx = db.transaction(['contracts'], 'readwrite');
          const store = tx.objectStore('contracts');
          const contracts = (await store.getAll()) as Contract[];
          for (const c of contracts) {
            if (c?.id == null) continue;
            if (c.estadoContrato === 'sin_identificar') {
              huerfanosIds.push(c.id);
              await store.delete(c.id);
              continue;
            }
            if (c.inquilino && c.inquilino.cotitulares === undefined) {
              c.inquilino.cotitulares = [];
              await store.put(c);
            }
          }
          await tx.done;
        } catch (err) {
          console.warn('[DB V78] Pasos C/D (cotitulares + borrado huérfanos) falló:', err);
        }

        // Paso D (cascada) · borrar treasuryEvents de los Contracts eliminados
        if (huerfanosIds.length > 0) {
          try {
            const idSet = new Set(huerfanosIds);
            const tx = db.transaction(['treasuryEvents'], 'readwrite');
            const store = tx.objectStore('treasuryEvents');
            const eventos = (await store.getAll()) as TreasuryEvent[];
            for (const ev of eventos) {
              if (ev?.id == null) continue;
              if ((ev as any).sourceType === 'contrato' && idSet.has(Number((ev as any).sourceId))) {
                await store.delete(ev.id);
              }
            }
            await tx.done;
          } catch (err) {
            console.warn('[DB V78] Paso D cascada treasuryEvents falló:', err);
          }
          console.log(`[DB V78] Migración alquileres v3 · ${huerfanosIds.length} Contracts sin_identificar eliminados + treasuryEvents en cascada`);
        }

        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78 post-upgrade] migración alquileres falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy H1) · self-heal de `modoExplotacion` ──
    // El Paso B original iba en el mismo flag que C/D y con un único try/catch (un put
    // que fallara abortaba el resto · y si el flag ya estaba 'completed' no reintentaba).
    // Este paso, con su PROPIO flag y try/catch POR property, rellena cualquier inmueble
    // que siguiera sin `modoExplotacion` en producción (causa raíz de H1). Idempotente.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_modoExplotacion_selfheal_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        let curados = 0;
        const props = (await db.getAll('properties')) as Property[];
        for (const p of props) {
          if (p?.id == null || p.modoExplotacion) continue;
          try {
            const activo = (p as any).alquilerPorHabitaciones?.activo === true;
            p.modoExplotacion = activo ? 'por_habitaciones' : 'piso_completo';
            await db.put('properties', p);
            curados++;
          } catch (errP) {
            console.warn(`[DB V78.1] self-heal modoExplotacion falló en property ${p.id}:`, errP);
          }
        }
        if (curados > 0) console.log(`[DB V78.1] self-heal · ${curados} properties con modoExplotacion poblado`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 self-heal modoExplotacion] falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy H1.4) · limpieza de Contracts huérfanos mal ruteados ──
    // Un Contract creado desde XML AEAT (algún ejercicioFiscal con fuente='xml_aeat') sobre un
    // inmueble que ahora es `por_habitaciones`/`mixto` está mal ruteado (debió ir al bote · caso
    // "Fuertes Acevedo"/FA32). Se ELIMINA el Contract + sus treasuryEvents y se SALVA su importe
    // y sus NIFs (inquilino.dni + cotitulares) al bote del (inmueble·año), de modo que no se
    // pierde dato si el usuario no re-importa. Un re-import posterior REEMPLAZA el bote limpio.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_huerfanos_modo_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;

        const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
        const estadoBote = (decl: number, asig: number): BoteAnualSinIdentificar['estado'] => {
          const EPS = 0.005;
          if (asig <= EPS) return 'pendiente_total';
          if (asig > decl + EPS) return 'sobre_asignado';
          if (asig >= decl - EPS) return 'cerrado';
          return 'parcial';
        };

        const tx = db.transaction(
          ['properties', 'contracts', 'treasuryEvents', 'botesAnualesSinIdentificar'],
          'readwrite',
        );
        const propsStore = tx.objectStore('properties');
        const contractsStore = tx.objectStore('contracts');
        const eventsStore = tx.objectStore('treasuryEvents');
        const botesStore = tx.objectStore('botesAnualesSinIdentificar');

        const allProps = (await propsStore.getAll()) as Property[];
        const modoById = new Map<number, Property['modoExplotacion']>();
        for (const p of allProps) if (p?.id != null) modoById.set(p.id, p.modoExplotacion);

        const allContracts = (await contractsStore.getAll()) as Contract[];
        const orphanIds: number[] = [];

        for (const c of allContracts) {
          if (c?.id == null || c.inmuebleId == null) continue;
          if (c.estadoContrato === 'sin_identificar') continue; // ya tratados en el flag anterior
          const modo = modoById.get(c.inmuebleId);
          if (modo !== 'por_habitaciones' && modo !== 'mixto') continue;
          const ejercicios = c.ejerciciosFiscales ?? {};
          const esXmlAeat = Object.values(ejercicios).some((e: any) => e?.fuente === 'xml_aeat');
          if (!esXmlAeat) continue;

          // NIFs atrapados en el contrato → al bote (recupera H2 para FA32)
          const nifsContrato = [c.inquilino?.dni, ...((c.inquilino as any)?.cotitulares ?? [])]
            .map((n) => (n ?? '').trim())
            .filter((n) => n.length > 0);

          for (const [añoStr, ef] of Object.entries(ejercicios) as Array<[string, any]>) {
            const año = Number(añoStr);
            const importe = Number(ef?.importeDeclarado) || 0;
            if (!año || importe <= 0) continue;
            const dias = Math.min(366, Number(ef?.dias) || 0);
            const ahora = new Date().toISOString();
            const existente = (await botesStore
              .index('inmuebleId-año')
              .get([c.inmuebleId, año])) as BoteAnualSinIdentificar | undefined;

            if (existente) {
              existente.importeDeclarado = round2(existente.importeDeclarado + importe);
              existente.díasDeclarados = Math.min(366, (existente.díasDeclarados || 0) + dias);
              existente.nifsDetectados = Array.from(
                new Set([...(existente.nifsDetectados ?? []), ...nifsContrato]),
              );
              existente.saldoPendiente = round2(existente.importeDeclarado - (existente.importeAsignado || 0));
              existente.estado = estadoBote(existente.importeDeclarado, existente.importeAsignado || 0);
              existente.fechaUltimaModificación = ahora;
              await botesStore.put(existente);
            } else {
              await botesStore.add({
                inmuebleId: c.inmuebleId,
                año,
                importeDeclarado: round2(importe),
                díasDeclarados: dias,
                nifsDetectados: nifsContrato,
                tiposArrendamientoOriginales: [],
                importeAsignado: 0,
                saldoPendiente: round2(importe),
                estado: 'pendiente_total',
                contractsVinculados: [],
                fuente: 'xml_aeat',
                fechaImportación: ahora,
                fechaUltimaModificación: ahora,
              } as BoteAnualSinIdentificar);
            }
          }

          orphanIds.push(c.id);
          await contractsStore.delete(c.id);
        }

        if (orphanIds.length > 0) {
          const idSet = new Set(orphanIds);
          const eventos = (await eventsStore.getAll()) as TreasuryEvent[];
          for (const ev of eventos) {
            if (ev?.id == null) continue;
            if ((ev as any).sourceType === 'contrato' && idSet.has(Number((ev as any).sourceId))) {
              await eventsStore.delete(ev.id);
            }
          }
        }

        await tx.done;
        if (orphanIds.length > 0) {
          console.log(`[DB V78.1] limpieza huérfanos · ${orphanIds.length} Contracts mal ruteados eliminados · importe+NIFs salvados al bote`);
        }
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 limpieza huérfanos] falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy H2) · repoblar nifsDetectados de botes existentes ──
    // Corre DESPUÉS del self-heal de modoExplotacion (lo necesita para acotar a botes de
    // inmuebles por_habitaciones/mixto). Lee la declaración archivada en
    // `ejerciciosFiscalesCoord[año].aeat.declaracionCompleta` y mergea los NIFs que faltaran
    // (Opción B · sin requerir re-import). Idempotente vía flag.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_bote_nifs_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await repoblarNifsBotesDesdeArchivo(db as unknown as IDBPDatabase<any>);
        if (n > 0) console.log(`[DB V78.1] repoblado nifsDetectados en ${n} botes desde la declaración archivada`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 repoblar nifs botes] falló:', err);
      }
      return db;
    });

    // ── V78.1 (fix post-deploy · Extra 1 LAU 5 años) · recalcular fechaFin de contratos AEAT ──
    // Los contratos habituales importados de AEAT quedaron con fechaFin sentinel (2099). Aplica la
    // prórroga LAU (inicio+5y) SOLO si cae en el futuro y SOLO a contratos con fuente xml_aeat
    // (no toca indefinidos creados a mano). Idempotente vía flag.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_v78_fechafin_lau_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await recalcularFechaFinContratosAEAT(db as unknown as IDBPDatabase<any>);
        if (n > 0) console.log(`[DB V78.1] recalculada fechaFin (LAU +5y) en ${n} contratos AEAT habituales`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB V78.1 recalcular fechaFin LAU] falló:', err);
      }
      return db;
    });

    // ── REORG Contratos · migración suave de `documentoFirmado` (SIN DB bump) ──
    // Deja el flag documental definido en todos los Contracts existentes: `false`
    // para importados sin firma registrada (sin_firmar / rentila / plantilla_atlas /
    // xml_aeat), `true` para el resto. Idempotente (no pisa valores ya definidos) y
    // gated por flag en keyval.
    dbPromise = dbPromise.then(async (db) => {
      try {
        const FLAG = 'migration_documentoFirmado_v1';
        if ((await db.get('keyval', FLAG)) === 'completed') return db;
        const n = await backfillDocumentoFirmado(db as unknown as IDBPDatabase<any>);
        if (n > 0) console.log(`[DB REORG] documentoFirmado backfill · ${n} contratos`);
        await db.put('keyval', 'completed', FLAG);
      } catch (err) {
        console.warn('[DB REORG documentoFirmado backfill] falló:', err);
      }
      return db;
    });
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
