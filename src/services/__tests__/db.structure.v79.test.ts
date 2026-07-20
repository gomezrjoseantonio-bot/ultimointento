// Network-first · red de seguridad del troceo de db.ts (Frente C).
//
// Verifica que initDB abre una base NUEVA a v79 con EXACTAMENTE los 45 stores
// físicos y, para cada uno, TODOS sus índices. Es el candado que protege la
// extracción de la creación de stores / migraciones fuera de `initDB`: si al
// mover código se pierde un store o un índice, este test falla (la app no
// arrancaría o una query indexada rompería en runtime, y ningún otro indicador
// lo detecta).
//
// El mapa EXPECTED_STORES se deriva de `interface AtlasHorizonDB extends DBSchema`.
// Si se añade/quita un store o índice a propósito, actualiza este mapa en el
// mismo commit — así el test documenta el esquema físico canónico de v79.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// store → índices esperados (orden alfabético). Fuente: AtlasHorizonDB (db.ts).
const EXPECTED_STORES: Record<string, string[]> = {
  accounts: ['bank', 'destination', 'isActive'],
  aeatCarryForwards: ['expirationYear', 'propertyId', 'taxYear'],
  aportacionesPlan: ['ejercicioFiscal', 'ingresoIdNomina', 'origen', 'planId', 'planId+ejercicioFiscal'],
  arrastresIRPF: ['ejercicioCaducidad', 'ejercicioOrigen', 'ejercicioOrigen-tipo', 'estado', 'inmuebleId', 'origen', 'tipo'],
  avisosUsuario: [],
  benchmarksReferencia: ['codigo', 'tipo', 'ultimaActualizacion'],
  botesAnualesSinIdentificar: ['estado', 'inmuebleId', 'inmuebleId-año'],
  compromisosRecurrentes: ['ambito', 'categoria', 'cuentaCargo', 'estado', 'fechaInicio', 'inmuebleId', 'personalDataId', 'tipo'],
  contracts: ['propertyId'],
  deudasFiscales: ['ejercicio', 'estado', 'modelo', 'notificada'],
  documents: ['entityId', 'entityType', 'type'],
  ejerciciosFiscalesCoord: ['estado'],
  entidadesAtribucion: ['nif', 'tipoRenta'],
  escenarios: [],
  fondos_ahorro: ['activo', 'tipo'],
  gastosInmueble: ['casillaAEAT', 'ejercicio', 'estado', 'inmueble-ejercicio', 'inmuebleId', 'movimientoId', 'origen', 'origen-origenId', 'treasuryEventId'],
  importBatches: ['accountId', 'createdAt'],
  ingresos: ['fechaActualizacion', 'personalDataId', 'tipo'],
  inversiones: ['activo', 'entidad', 'tipo'],
  keyval: [],
  mejorasInmueble: ['ejercicio', 'inmueble-ejercicio', 'inmuebleId', 'movimientoId', 'treasuryEventId'],
  movementLearningRules: ['ambito', 'appliedCount', 'categoria', 'createdAt', 'learnKey'],
  movements: ['accountId', 'date', 'duplicate-key', 'importBatch', 'status'],
  mueblesInmueble: ['ejercicio', 'inmueble-ejercicio', 'inmuebleId', 'movimientoId', 'treasuryEventId'],
  objetivos: ['estado', 'fondoId', 'prestamoId', 'tipo'],
  objetivosVitales: ['fechaEstimada', 'planFinancieroAsociado', 'tipo'],
  perdidasPatrimonialesAhorro: ['ejercicioCaducidad', 'ejercicioOrigen', 'estado'],
  personalData: ['dni', 'fechaActualizacion'],
  personalModuleConfig: ['fechaActualizacion'],
  planesPensiones: ['estado', 'personalDataId', 'tipoAdministrativo', 'titular'],
  prestamos: ['createdAt', 'inmuebleId', 'tipo'],
  presupuestoLineas: ['categoria', 'contratoId', 'cuentaId', 'frecuencia', 'inmuebleId', 'origen', 'prestamoId', 'presupuestoId', 'tipo'],
  presupuestos: ['estado', 'year'],
  properties: ['address', 'alias'],
  propertyDays: ['property-year', 'propertyId', 'taxYear'],
  property_sales: ['property-status', 'propertyId', 'saleDate', 'status'],
  proveedores: [],
  resultadosEjercicio: ['ejercicio', 'ejercicio-estado', 'estadoEjercicio', 'origen'],
  retos: ['estado', 'mes', 'tipo'],
  snapshotsDeclaracion: ['ejercicio', 'fechaSnapshot', 'origen'],
  traspasosPlanPensiones: ['fechaEjecucion', 'planId'],
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

  it('abre una base NUEVA a v79 con exactamente los 45 stores esperados', async () => {
    const dbModule = await import('../db');
    const db = await dbModule.initDB();

    expect(db.version).toBe(79);

    const actual = Array.from(db.objectStoreNames).sort();
    const expected = Object.keys(EXPECTED_STORES).sort();
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(45);

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
