// Network-first · red de seguridad del troceo de db.ts (Frente C).
//
// Verifica que initDB abre una base NUEVA a la versión vigente (DB_VERSION) con
// EXACTAMENTE sus stores físicos y, para cada uno, TODOS sus índices. El conteo
// se deriva de EXPECTED_STORES (no se hardcodea). Es el candado que protege la
// extracción de la creación de stores / migraciones fuera de `initDB`: si al
// mover código se pierde un store o un índice, este test falla (la app no
// arrancaría o una query indexada rompería en runtime, y ningún otro indicador
// lo detecta).
//
// El mapa EXPECTED_STORES se deriva de `interface AtlasHorizonDB extends DBSchema`.
// Si se añade/quita un store o índice a propósito, actualiza este mapa en el
// mismo commit — así el test documenta el esquema físico canónico vigente.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// store → índices esperados (orden alfabético). Fuente: AtlasHorizonDB (db.ts).
const EXPECTED_STORES: Record<string, string[]> = {
  accounts: ['bank', 'destination', 'isActive'],
  aeatCarryForwards: ['expirationYear', 'propertyId', 'taxYear'],
  aportacionesPlan: ['ejercicioFiscal', 'ingresoIdNomina', 'origen', 'planId', 'planId+ejercicioFiscal'],
  arrastresIRPF: ['ejercicioCaducidad', 'ejercicioOrigen', 'ejercicioOrigen-tipo', 'estado', 'inmuebleId', 'origen', 'tipo'],
  avisosUsuario: [],
  baseAmortizableEjercicio: ['ejercicio', 'inmueble-ejercicio', 'inmuebleId', 'origen'],
  benchmarksReferencia: ['codigo', 'tipo', 'ultimaActualizacion'],
  botesAnualesSinIdentificar: ['estado', 'inmuebleId', 'inmuebleId-año'],
  compromisosRecurrentes: ['ambito', 'categoria', 'cuentaCargo', 'estado', 'fechaInicio', 'inmuebleId', 'personalDataId', 'tipo'],
  contracts: ['propertyId'],
  deudasFiscales: ['ejercicio', 'estado', 'modelo', 'notificada'],
  documents: ['entityId', 'entityType', 'type'],
  ejerciciosFiscalesCoord: ['estado'],
  entidadesAtribucion: ['nif', 'tipoRenta'],
  escenarios: [],
  // V90 · «poner en alquiler» como entidad propia (db.ts:97 · upgrade-a.ts:169-173).
  // El store existe desde el bump y este mapa se quedó sin actualizar.
  explotacionAlquiler: ['inmuebleId'],
  fondos_ahorro: ['activo', 'tipo'],
  gastosInmueble: ['casillaAEAT', 'ejercicio', 'estado', 'inmueble-ejercicio', 'inmuebleId', 'movimientoId', 'origen', 'origen-origenId', 'treasuryEventId'],
  importBatches: ['accountId', 'createdAt'],
  ingresos: ['fechaActualizacion', 'personalDataId', 'tipo'],
  inversiones: ['activo', 'entidad', 'tipo'],
  keyval: [],
  // V91 · E1.1 · la línea del banco persistida (db.ts · upgrade-a.ts).
  lineasExtracto: ['accountId', 'estado', 'hashLinea', 'importBatchId'],
  mejorasInmueble: ['ejercicio', 'inmueble-ejercicio', 'inmuebleId', 'movimientoId', 'treasuryEventId'],
  movementLearningRules: ['ambito', 'appliedCount', 'categoria', 'createdAt', 'learnKey'],
  // V87 · VOCABULARIO §3 · la tarjeta deja de ser una cuenta.
  tarjetas: ['activa', 'cuentaLiquidacionId', 'origen'],
  // V92 · E1.6 · `duplicate-key` retirado (nunca tuvo lector).
  movements: ['accountId', 'date', 'importBatch', 'status'],
  mueblesInmueble: ['ejercicio', 'inmueble-ejercicio', 'inmuebleId', 'movimientoId', 'treasuryEventId'],
  objetivos: ['estado', 'fondoId', 'prestamoId', 'tipo'],
  objetivosVitales: ['fechaEstimada', 'planFinancieroAsociado', 'tipo'],
  perdidasPatrimonialesAhorro: ['ejercicioCaducidad', 'ejercicioOrigen', 'estado'],
  personalData: ['dni', 'fechaActualizacion'],
  personalModuleConfig: ['fechaActualizacion'],
  planesPensiones: ['estado', 'personalDataId', 'tipoAdministrativo', 'titular'],
  prestamos: ['createdAt', 'inmuebleId', 'tipo'],
  properties: ['address', 'alias'],
  propertyDays: ['property-year', 'propertyId', 'taxYear'],
  property_sales: ['property-status', 'propertyId', 'saleDate', 'status'],
  proveedores: [],
  resultadosEjercicio: ['ejercicio', 'ejercicio-estado', 'estadoEjercicio', 'origen'],
  retos: ['estado', 'mes', 'tipo'],
  snapshotsDeclaracion: ['ejercicio', 'fechaSnapshot', 'origen'],
  traspasosPlanPensiones: ['activoId', 'fechaEjecucion', 'planId'],
  treasuryEvents: ['accountId', 'ambito', 'año', 'certeza', 'generadoPor', 'inmuebleId', 'predictedDate', 'sourceId', 'sourceType', 'status', 'type'],
  valoracionesActivos: ['idx_activo', 'idx_activo_fecha', 'idx_anchor_fiscal', 'idx_fecha', 'idx_tipo', 'idx_tipo_subtipo'],
  vinculosAccesorio: ['inmuebleAccesorioId', 'inmueblePrincipalId', 'principal-accesorio-ejercicio'],
  viviendaHabitual: ['activa', 'personalDataId', 'vigenciaDesde'],
};

describe('db · estructura física v79 (network-first · red de troceo)', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  it('abre una base NUEVA a la versión vigente con exactamente los stores esperados', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.version).toBe(dbModule.DB_VERSION);

    const actual = Array.from(db.objectStoreNames).sort();
    const expected = Object.keys(EXPECTED_STORES).sort();
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(Object.keys(EXPECTED_STORES).length);

    db.close();
  });

  it('cada store tiene TODOS sus índices canónicos (ni de más ni de menos)', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    for (const [storeName, expectedIdx] of Object.entries(EXPECTED_STORES)) {
      const tx = (db as any).transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const actualIdx = Array.from(store.indexNames as DOMStringList).sort();
      expect({ store: storeName, indexes: actualIdx })
        .toEqual({ store: storeName, indexes: [...expectedIdx].sort() });
    }

    db.close();
  });
});
