// src/services/__tests__/declaracionDistributorFaseB.test.ts
// Wizard import XML V2 · § 3 · refactor del distribuidor en fase A / fase B opt-in.
// Tests unitarios de los helpers de orquestación (sin fixture completo de
// DeclaracionCompleta): IBAN, prefill de inmuebles y handlers de fase B.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { OPCIONES_DEFAULT, type OpcionesDistribucion, type ResultadoFaseB } from '../../types/opcionesDistribucion';

// Mocks de los servicios destino (top-level y dynamic import).
jest.mock('../cuentasService', () => ({
  cuentasService: { create: jest.fn(), get: jest.fn(), update: jest.fn(), list: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../nominaService', () => ({
  nominaService: { saveNomina: jest.fn() },
}));
jest.mock('../autonomoService', () => ({
  autonomoService: { saveAutonomo: jest.fn() },
}));
jest.mock('../propertySaleService', () => ({
  confirmPropertySale: jest.fn(),
}));

import { __testing } from '../declaracionDistributorService';
import { cuentasService } from '../cuentasService';
import { nominaService } from '../nominaService';
import { autonomoService } from '../autonomoService';
import { confirmPropertySale } from '../propertySaleService';

function nuevoResultado(): ResultadoFaseB {
  return {
    nominaCreada: false,
    actividadAutonomaCreada: false,
    ventasRegistradas: 0,
    cuentasCreadas: 0,
    cuentasVinculadas: 0,
    cuentasIgnoradas: 0,
    conyugeAnadido: false,
    errores: [],
  };
}

function opciones(parcial: Partial<OpcionesDistribucion>): OpcionesDistribucion {
  return { ...OPCIONES_DEFAULT, ...parcial };
}

beforeEach(() => {
  jest.clearAllMocks();
  // El pre-check de IBAN duplicado (H3) llama a cuentasService.list(); por
  // defecto no hay cuentas (cada test que necesite duplicados lo sobreescribe).
  (cuentasService.list as jest.Mock).mockResolvedValue([]);
});

describe('faseBTuvoOpciones', () => {
  it('default → false', () => {
    expect(__testing.faseBTuvoOpciones(OPCIONES_DEFAULT)).toBe(false);
  });

  it('cada opt-in activa el flag', () => {
    expect(__testing.faseBTuvoOpciones(opciones({ crearNominaActiva: true }))).toBe(true);
    expect(__testing.faseBTuvoOpciones(opciones({ crearActividadAutonoma: true }))).toBe(true);
    expect(__testing.faseBTuvoOpciones(opciones({ registrarVentasInmueble: true }))).toBe(true);
    expect(__testing.faseBTuvoOpciones(opciones({ conyugeAnadirPersonal: true }))).toBe(true);
    expect(__testing.faseBTuvoOpciones(opciones({ ibanAcciones: [{ iban: 'ES1', accion: 'crear' }] }))).toBe(true);
    expect(__testing.faseBTuvoOpciones(opciones({ inmueblesPrefill: [{ refCatastral: 'X' }] }))).toBe(true);
  });
});

describe('aplicarIbanAcciones', () => {
  const declConIban: any = { cuentaDevolucion: { iban: 'ES7621000000000000000000' }, cuentaIngreso: undefined };

  it('legacy (sin acciones) · crea el IBAN detectado del XML', async () => {
    const r = nuevoResultado();
    await __testing.aplicarIbanAcciones(declConIban, OPCIONES_DEFAULT, r);
    expect(cuentasService.create).toHaveBeenCalledWith({ iban: 'ES7621000000000000000000' });
    expect(r.cuentasCreadas).toBe(1);
  });

  it('acción ignorar · NO crea cuenta', async () => {
    const r = nuevoResultado();
    await __testing.aplicarIbanAcciones(
      declConIban,
      opciones({ ibanAcciones: [{ iban: 'ES76', accion: 'ignorar' }] }),
      r,
    );
    expect(cuentasService.create).not.toHaveBeenCalled();
    expect(r.cuentasIgnoradas).toBe(1);
  });

  it('acción crear · crea la cuenta del IBAN indicado', async () => {
    const r = nuevoResultado();
    await __testing.aplicarIbanAcciones(
      declConIban,
      opciones({ ibanAcciones: [{ iban: 'ES99', accion: 'crear' }] }),
      r,
    );
    expect(cuentasService.create).toHaveBeenCalledWith({ iban: 'ES99' });
    expect(r.cuentasCreadas).toBe(1);
  });

  it('acción vincular · verifica la cuenta existente y la cuenta como vinculada', async () => {
    (cuentasService.get as jest.Mock).mockResolvedValue({ id: 5 });
    const r = nuevoResultado();
    await __testing.aplicarIbanAcciones(
      declConIban,
      opciones({ ibanAcciones: [{ iban: 'ES88', accion: 'vincular', cuentaIdVinculada: 5 }] }),
      r,
    );
    expect(cuentasService.get).toHaveBeenCalledWith(5);
    expect(cuentasService.create).not.toHaveBeenCalled();
    expect(r.cuentasVinculadas).toBe(1);
  });

  it('errores esperados de duplicado se absorben sin propagarse', async () => {
    (cuentasService.create as jest.Mock).mockRejectedValueOnce(new Error('IBAN already exists'));
    const r = nuevoResultado();
    await __testing.aplicarIbanAcciones(declConIban, OPCIONES_DEFAULT, r);
    expect(r.cuentasCreadas).toBe(0);
    expect(r.errores).toHaveLength(0);
  });
});

describe('aplicarFaseBNomina', () => {
  it('opt-in OFF · no llama al servicio', async () => {
    const r = nuevoResultado();
    await __testing.aplicarFaseBNomina(OPCIONES_DEFAULT, r);
    expect(nominaService.saveNomina).not.toHaveBeenCalled();
    expect(r.nominaCreada).toBe(false);
  });

  it('opt-in ON + prefill · guarda la nómina', async () => {
    const r = nuevoResultado();
    const nominaPrefill: any = { personalDataId: 1, nombre: 'X' };
    await __testing.aplicarFaseBNomina(
      opciones({ crearNominaActiva: true, nominaPrefill }),
      r,
    );
    expect(nominaService.saveNomina).toHaveBeenCalledWith(nominaPrefill);
    expect(r.nominaCreada).toBe(true);
  });
});

describe('aplicarFaseBAutonomo', () => {
  it('opt-in ON + prefill · guarda la actividad', async () => {
    const r = nuevoResultado();
    const autonomoPrefill: any = { personalDataId: 1, nombre: 'Act' };
    await __testing.aplicarFaseBAutonomo(
      opciones({ crearActividadAutonoma: true, autonomoPrefill }),
      r,
    );
    expect(autonomoService.saveAutonomo).toHaveBeenCalledWith(autonomoPrefill);
    expect(r.actividadAutonomaCreada).toBe(true);
  });
});

describe('aplicarFaseBVentas', () => {
  it('registra cada venta confirmada', async () => {
    const r = nuevoResultado();
    const ventas: any[] = [
      { propertyId: 1, saleDate: '2024-06-01', source: 'wizard', salePrice: 200000 },
      { propertyId: 2, saleDate: '2024-07-01', source: 'wizard', salePrice: 150000 },
    ];
    await __testing.aplicarFaseBVentas(
      opciones({ registrarVentasInmueble: true, ventasConfirmadas: ventas }),
      r,
    );
    expect(confirmPropertySale).toHaveBeenCalledTimes(2);
    expect(r.ventasRegistradas).toBe(2);
  });

  it('un error en una venta no aborta el resto', async () => {
    (confirmPropertySale as jest.Mock)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});
    const r = nuevoResultado();
    const ventas: any[] = [
      { propertyId: 1, saleDate: '2024-06-01', source: 'wizard', salePrice: 1 },
      { propertyId: 2, saleDate: '2024-07-01', source: 'wizard', salePrice: 2 },
    ];
    await __testing.aplicarFaseBVentas(
      opciones({ registrarVentasInmueble: true, ventasConfirmadas: ventas }),
      r,
    );
    expect(r.ventasRegistradas).toBe(1);
    expect(r.errores).toHaveLength(1);
  });
});

describe('aplicarFaseBConyuge', () => {
  it('individual + opt-in · registra error, no materializa', async () => {
    const r = nuevoResultado();
    await __testing.aplicarFaseBConyuge(
      { declarante: { tributacion: 'individual' } } as any,
      opciones({ conyugeAnadirPersonal: true }),
      r,
    );
    expect(r.conyugeAnadido).toBe(false);
    expect(r.errores).toHaveLength(1);
  });

  it('conjunta + opt-in · no error (materialización pendiente)', async () => {
    const r = nuevoResultado();
    await __testing.aplicarFaseBConyuge(
      { declarante: { tributacion: 'conjunta' } } as any,
      opciones({ conyugeAnadirPersonal: true }),
      r,
    );
    expect(r.errores).toHaveLength(0);
  });
});

describe('aplicarInmueblesPrefill', () => {
  beforeEach(() => {
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('vuelca subtipoVivienda y explotacion sobre el inmueble casado por RC', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    const RC = '1234567890ABCD0001XY';
    const id = await (db as any).add('properties', {
      alias: 'Piso', state: 'activo', tipoActivo: 'piso', cadastralReference: RC,
      anexos: { tieneParking: true, tieneTrastero: false },
    });
    const property = (await (db as any).get('properties', id)) as any;

    const porRefCatastral = new Map<string, any>([[RC, property]]);
    await __testing.aplicarInmueblesPrefill(
      db as any,
      [{
        refCatastral: RC,
        subtipoVivienda: 'chalet',
        anexos: { tieneParking: true, tieneTrastero: false, plazasParking: 2 },
        explotacion: { estadoOperativo: 'operativo', unidadesArrendables: 3 },
      }],
      porRefCatastral as any,
    );

    const saved = (await (db as any).get('properties', id)) as any;
    expect(saved.subtipoVivienda).toBe('chalet');
    expect(saved.anexos.plazasParking).toBe(2);
    expect(saved.explotacion.estadoOperativo).toBe('operativo');
    expect(saved.explotacion.unidadesArrendables).toBe(3);
    // Campos no incluidos en el prefill · intactos
    expect(saved.tipoActivo).toBe('piso');
    db.close();
  });

  it('sin prefill · no toca nada', async () => {
    const { initDB } = await import('../db');
    const db = await initDB();
    await __testing.aplicarInmueblesPrefill(db as any, undefined, new Map() as any);
    db.close();
    // no lanza
    expect(true).toBe(true);
  });
});

describe('aplicarIbanAcciones · H3 · skip silencioso de IBAN duplicado', () => {
  const declConIban: any = { cuentaDevolucion: { iban: 'ES7621000000000000000000' }, cuentaIngreso: undefined };

  it('si el IBAN ya existe · NO crea cuenta ni añade incidencia', async () => {
    (cuentasService.list as jest.Mock).mockResolvedValueOnce([{ iban: 'ES76 2100 0000 0000 0000 0000' }]);
    const r = nuevoResultado();
    await __testing.aplicarIbanAcciones(declConIban, OPCIONES_DEFAULT, r);
    expect(cuentasService.create).not.toHaveBeenCalled();
    expect(r.cuentasCreadas).toBe(0);
    expect(r.errores).toHaveLength(0); // sin ruido
  });

  it('acción crear repetida (multi-año) · solo crea una vez, sin incidencias', async () => {
    // 1er año: no existe → crea. 2º año: ya existe → skip silencioso.
    (cuentasService.list as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ iban: 'ES99' }]);
    const r = nuevoResultado();
    const opc = opciones({ ibanAcciones: [{ iban: 'ES99', accion: 'crear' }] });
    await __testing.aplicarIbanAcciones(declConIban, opc, r); // año 1
    await __testing.aplicarIbanAcciones(declConIban, opc, r); // año 2
    expect(cuentasService.create).toHaveBeenCalledTimes(1);
    expect(r.cuentasCreadas).toBe(1);
    expect(r.errores).toHaveLength(0);
  });
});
