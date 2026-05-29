// Wizard import XML V2 · paso 5 · fusión de planes de pensiones duplicados.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

describe('fusión de planes duplicados por NIF empleador', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
    jest.resetModules();
  });

  async function seedPlan(db: any, id: string, cif: string, fechaContratacion: string) {
    await db.add('planesPensiones', {
      id,
      nombre: `Plan ${id}`,
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPE',
      gestoraActual: 'Gestora',
      fechaContratacion,
      empresaPagadora: { cif, nombre: 'Orange' },
      estado: 'activo',
      fechaCreacion: fechaContratacion,
      fechaActualizacion: fechaContratacion,
      origen: 'xml_aeat',
    });
  }

  async function seedPlanSinCif(db: any, id: string, fechaContratacion: string) {
    await db.add('planesPensiones', {
      id,
      nombre: `Plan ${id}`,
      titular: 'yo',
      personalDataId: 1,
      tipoAdministrativo: 'PPE',
      gestoraActual: '—',
      fechaContratacion,
      estado: 'activo',
      fechaCreacion: fechaContratacion,
      fechaActualizacion: fechaContratacion,
      origen: 'xml_aeat',
    });
  }

  async function seedAportacion(db: any, id: string, planId: string, ejercicio: number, t: number, e: number) {
    await db.add('aportacionesPlan', {
      id,
      planId,
      fecha: `${ejercicio}-12-31`,
      ejercicioFiscal: ejercicio,
      importeTitular: t,
      importeEmpresa: e,
      origen: 'xml_aeat',
      granularidad: 'anual',
      fechaCreacion: '2025-01-01',
      fechaActualizacion: '2025-01-01',
    });
  }

  it('detecta grupos con mismo CIF y los fusiona en el plan más antiguo', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    await seedPlan(db, 'p-old', 'A82009812', '2023-01-01');
    await seedPlan(db, 'p-new', 'A82009812', '2024-01-01');
    await seedAportacion(db, 'a1', 'p-old', 2023, 1420, 2180);
    await seedAportacion(db, 'a2', 'p-new', 2024, 1396.68, 1862.16);

    const svc = await import('../aeatPlanesPensionesImportService');

    const grupos = await svc.detectarDuplicadosPorEmpleador();
    expect(grupos).toHaveLength(1);
    expect(grupos[0].cif).toBe('A82009812');
    expect(grupos[0].total).toBe(2);

    const r = await svc.fusionarDuplicados('A82009812');
    expect(r.fusionados).toBe(1);
    expect(r.planCanonicoId).toBe('p-old');

    const planes = (await db.getAll('planesPensiones')) as any[];
    expect(planes).toHaveLength(1);
    expect(planes[0].id).toBe('p-old');

    const aportaciones = (await db.getAll('aportacionesPlan')) as any[];
    expect(aportaciones).toHaveLength(2);
    expect(aportaciones.every((a) => a.planId === 'p-old')).toBe(true);
    db.close();
  });

  it('aportación idéntica en ambos planes no se duplica al fusionar', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    await seedPlan(db, 'p-old', 'B12345678', '2023-01-01');
    await seedPlan(db, 'p-new', 'B12345678', '2024-01-01');
    await seedAportacion(db, 'a1', 'p-old', 2023, 1000, 500);
    await seedAportacion(db, 'a2', 'p-new', 2023, 1000, 500); // idéntica (mismo año/origen/importes)

    const svc = await import('../aeatPlanesPensionesImportService');
    await svc.fusionarDuplicados('B12345678');

    const aportaciones = (await db.getAll('aportacionesPlan')) as any[];
    expect(aportaciones).toHaveLength(1);
    expect(aportaciones[0].planId).toBe('p-old');
    db.close();
  });

  it('H1 · fusiona PPE sin cif (2020-22) con el PPE con cif (2023-24) y backfillea el cif', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    await seedPlanSinCif(db, 'p-old', '2020-01-01'); // años sin NIF empleador
    await seedPlan(db, 'p-new', 'A82009812', '2023-01-01'); // años con NIF
    await seedAportacion(db, 'a1', 'p-old', 2020, 1203.36, 1604.52);
    await seedAportacion(db, 'a2', 'p-new', 2024, 1396.68, 1862.16);

    const svc = await import('../aeatPlanesPensionesImportService');

    // Detección: el PPE sin cif se considera duplicado del PPE con cif.
    const grupos = await svc.detectarDuplicadosPorEmpleador();
    expect(grupos).toHaveLength(1);
    expect(grupos[0].total).toBe(2);

    const r = await svc.fusionarDuplicados('A82009812');
    expect(r.fusionados).toBe(1);
    expect(r.planCanonicoId).toBe('p-old'); // el más antiguo

    const planes = (await db.getAll('planesPensiones')) as any[];
    expect(planes).toHaveLength(1);
    expect(planes[0].id).toBe('p-old');
    expect(planes[0].empresaPagadora?.cif).toBe('A82009812'); // backfill del cif

    const aportaciones = (await db.getAll('aportacionesPlan')) as any[];
    expect(aportaciones).toHaveLength(2);
    expect(aportaciones.every((a) => a.planId === 'p-old')).toBe(true);
    db.close();
  });

  it('sin duplicados · no hace nada', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    await seedPlan(db, 'solo', 'C99999999', '2023-01-01');
    const svc = await import('../aeatPlanesPensionesImportService');
    expect(await svc.detectarDuplicadosPorEmpleador()).toHaveLength(0);
    const r = await svc.fusionarDuplicados('C99999999');
    expect(r.fusionados).toBe(0);
    db.close();
  });
});
