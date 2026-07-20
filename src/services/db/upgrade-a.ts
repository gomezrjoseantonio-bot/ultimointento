// Frente C · troceo de initDB · PRIMERA mitad del callback `upgrade` (creación de
// stores + migraciones tempranas), extraída LITERALMENTE de db.ts. El orden se
// preserva: initDB llama applyUpgradeA y luego applyUpgradeB en el mismo upgrade().
// Import de tipos de db.ts (type-only → sin ciclo en runtime; el valor va one-way
// db.ts → aquí).
import type { OpenDBCallbacks } from 'idb';
import type { AtlasHorizonDB } from '../db';
import { ensureIndex } from './ensure-index';

type UpgradeArgs = Parameters<NonNullable<OpenDBCallbacks<AtlasHorizonDB>['upgrade']>>;
export type UpgradeDB = UpgradeArgs[0];
export type UpgradeTx = UpgradeArgs[3];

export function applyUpgradeA(db: UpgradeDB, oldVersion: number, transaction: UpgradeTx): void {
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

        // nominas: store legacy ya no se crea — las nóminas viven en `ingresos`
        // con tipo='nomina' (nominaService escribe directamente ahí).

        // V61: store unificado `ingresos`. Se crea aquí para cualquier DB. NO se
        // rellena desde `nominas`: la copia para DBs antiguas nunca se implementó
        // (ver upgrade-b, bloque V61). Sin impacto con el flujo actual.
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
}
