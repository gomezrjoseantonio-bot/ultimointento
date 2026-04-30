// ============================================================================
// ATLAS · TAREA 14.2 · fiscalContextService · tests
// ============================================================================
//
// 10 tests obligatorios según spec §2.3:
//   1. personalData completo + vivienda activa · context completo · warnings []
//   2. sin comunidadAutonoma · null + warning correspondiente
//   3. sin tributacion · default 'individual' + warning correspondiente
//   4. sin fechaNacimiento · edadActual=null + warning
//   5. sin vivienda habitual · viviendaHabitual=null + warning
//   6. 2 viviendas (1 activa · 1 inactiva) · solo lee la activa
//   7. descendientes con fechaNacimiento · edades calculadas correctamente
//   8. getFiscalContext sin personalData · throws · getFiscalContextSafe → null
//   9. cache · 2ª llamada desde cache · invalidate funciona
//  10. idempotente · llamar N veces · resultado idéntico
// ============================================================================

import type { PersonalData } from '../../types/personal';
import type { ViviendaHabitual } from '../../types/viviendaHabitual';

jest.mock('../personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn(),
  },
}));

jest.mock('../personal/viviendaHabitualService', () => ({
  obtenerViviendaActiva: jest.fn(),
}));

import { personalDataService } from '../personalDataService';
import { obtenerViviendaActiva } from '../personal/viviendaHabitualService';
import {
  getFiscalContext,
  getFiscalContextSafe,
  invalidateFiscalContext,
} from '../fiscalContextService';

const getPersonalDataMock = personalDataService.getPersonalData as jest.Mock;
const obtenerViviendaActivaMock = obtenerViviendaActiva as jest.Mock;

const FAKE_NOW = new Date('2026-04-30T10:00:00.000Z');

function buildPersonalData(overrides: Partial<PersonalData> = {}): PersonalData {
  return {
    id: 1,
    nombre: 'Jose',
    apellidos: 'García',
    dni: '12345678Z',
    direccion: 'Calle Falsa 1',
    situacionPersonal: 'casado',
    situacionLaboral: ['asalariado'],
    comunidadAutonoma: 'Madrid',
    fechaNacimiento: '1980-05-15',
    descendientes: [],
    ascendientes: [],
    discapacidad: 'ninguna',
    tributacion: 'individual',
    fechaCreacion: '2024-01-01T00:00:00.000Z',
    fechaActualizacion: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildViviendaPropietario(
  overrides: Partial<ViviendaHabitual> = {},
): ViviendaHabitual {
  return {
    id: 100,
    personalDataId: 1,
    activa: true,
    vigenciaDesde: '2018-06-01',
    createdAt: '2018-06-01T00:00:00.000Z',
    updatedAt: '2018-06-01T00:00:00.000Z',
    data: {
      tipo: 'propietarioSinHipoteca',
      direccion: {
        calle: 'Calle Falsa',
        numero: '1',
        municipio: 'Madrid',
        cp: '28001',
      },
      catastro: {
        referenciaCatastral: '1234567AB1234S0001AB',
        valorCatastral: 150000,
        porcentajeTitularidad: 100,
        superficie: 90,
      },
      adquisicion: {
        fecha: '2018-06-01',
        precio: 250000,
        gastosAdquisicion: 25000,
        mejorasAcumuladas: [],
      },
      ibi: {
        importeAnual: 600,
        mesesPago: [9],
        diaPago: 15,
      },
      seguros: {},
      cuentaCargo: 1,
    },
    ...overrides,
  };
}

describe('fiscalContextService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FAKE_NOW);
    invalidateFiscalContext();
    getPersonalDataMock.mockReset();
    obtenerViviendaActivaMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    invalidateFiscalContext();
  });

  test('1 · personalData completo + vivienda activa · context completo · warnings vacío', async () => {
    getPersonalDataMock.mockResolvedValue(buildPersonalData());
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    const ctx = await getFiscalContext();

    expect(ctx.personalDataId).toBe(1);
    expect(ctx.nombre).toBe('Jose');
    expect(ctx.apellidos).toBe('García');
    expect(ctx.dni).toBe('12345678Z');
    expect(ctx.tributacion).toBe('individual');
    expect(ctx.comunidadAutonoma).toBe('Madrid');
    expect(ctx.fechaNacimiento).toBe('1980-05-15');
    expect(ctx.edadActual).toBe(45);
    expect(ctx.discapacidadTitular).toBe('ninguna');
    expect(ctx.viviendaHabitual).not.toBeNull();
    expect(ctx.viviendaHabitual?.activa).toBe(true);
    expect(ctx.viviendaHabitual?.referenciaCatastral).toBe('1234567AB1234S0001AB');
    expect(ctx.viviendaHabitual?.valorCatastral).toBe(150000);
    expect(ctx.viviendaHabitual?.porcentajeTitularidad).toBe(100);
    expect(ctx.viviendaHabitual?.fechaAdquisicion).toBe('2018-06-01');
    expect(ctx.viviendaHabitual?.precioAdquisicion).toBe(250000);
    expect(ctx.viviendaHabitual?.gastosAdquisicion).toBe(25000);
    expect(ctx.viviendaHabitual?.ibiAnual).toBe(600);
    expect(ctx.warnings).toEqual([]);
  });

  test('2 · sin comunidadAutonoma · null + warning', async () => {
    getPersonalDataMock.mockResolvedValue(
      buildPersonalData({ comunidadAutonoma: undefined }),
    );
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    const ctx = await getFiscalContext();

    expect(ctx.comunidadAutonoma).toBeNull();
    expect(ctx.warnings).toContain('comunidadAutonoma not informed');
  });

  test('3 · sin tributacion · default individual + warning', async () => {
    getPersonalDataMock.mockResolvedValue(
      buildPersonalData({ tributacion: undefined }),
    );
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    const ctx = await getFiscalContext();

    expect(ctx.tributacion).toBe('individual');
    expect(ctx.warnings).toContain('tributacion no informada · default individual');
  });

  test('4 · sin fechaNacimiento · edadActual=null + warning', async () => {
    getPersonalDataMock.mockResolvedValue(
      buildPersonalData({ fechaNacimiento: undefined }),
    );
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    const ctx = await getFiscalContext();

    expect(ctx.fechaNacimiento).toBeNull();
    expect(ctx.edadActual).toBeNull();
    expect(ctx.warnings).toContain('fechaNacimiento not informed');
  });

  test('5 · sin vivienda habitual · viviendaHabitual=null + warning', async () => {
    getPersonalDataMock.mockResolvedValue(buildPersonalData());
    obtenerViviendaActivaMock.mockResolvedValue(undefined);

    const ctx = await getFiscalContext();

    expect(ctx.viviendaHabitual).toBeNull();
    expect(ctx.warnings).toContain('viviendaHabitual not registered');
  });

  test('6 · 2 viviendas (1 activa · 1 inactiva) · context lee solo la activa', async () => {
    const inactiva = buildViviendaPropietario({
      id: 200,
      activa: false,
      data: {
        ...buildViviendaPropietario().data,
        catastro: {
          referenciaCatastral: 'INACTIVA0000000000',
          valorCatastral: 99999,
          porcentajeTitularidad: 50,
          superficie: 60,
        },
      } as ViviendaHabitual['data'],
    });
    const activa = buildViviendaPropietario({
      id: 300,
      activa: true,
    });

    // El gateway delega en `obtenerViviendaActiva`, que ya filtra la activa.
    // Reproducimos ese contrato con un mock que recibe la lista y devuelve
    // la activa para verificar que el gateway respeta esa selección.
    obtenerViviendaActivaMock.mockImplementation(async () => {
      const lista = [inactiva, activa];
      return lista.find((v) => v.activa);
    });
    getPersonalDataMock.mockResolvedValue(buildPersonalData());

    const ctx = await getFiscalContext();

    expect(ctx.viviendaHabitual).not.toBeNull();
    expect(ctx.viviendaHabitual?.referenciaCatastral).toBe('1234567AB1234S0001AB');
    expect(ctx.viviendaHabitual?.valorCatastral).toBe(150000);
  });

  test('7 · descendientes con fechaNacimiento · edades calculadas correctamente', async () => {
    getPersonalDataMock.mockResolvedValue(
      buildPersonalData({
        descendientes: [
          { id: 'd1', fechaNacimiento: '2010-01-15', discapacidad: 'ninguna' },
          { id: 'd2', fechaNacimiento: '2020-12-31', discapacidad: 'entre33y65' },
        ],
        ascendientes: [
          { id: 'a1', edad: 82, convive: true, discapacidad: 'mas65' },
        ],
      }),
    );
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    const ctx = await getFiscalContext();

    expect(ctx.descendientes).toHaveLength(2);
    // 2010-01-15 → 30/04/2026 = 16 años cumplidos
    expect(ctx.descendientes[0].edadActual).toBe(16);
    expect(ctx.descendientes[0].fechaNacimiento).toBe('2010-01-15');
    expect(ctx.descendientes[0].discapacidad).toBe('ninguna');
    // 2020-12-31 → 30/04/2026 = 5 años cumplidos
    expect(ctx.descendientes[1].edadActual).toBe(5);
    expect(ctx.descendientes[1].discapacidad).toBe('entre33y65');

    expect(ctx.ascendientes).toHaveLength(1);
    expect(ctx.ascendientes[0].edadActual).toBe(82);
    expect(ctx.ascendientes[0].discapacidad).toBe('mas65');
  });

  test('8 · getFiscalContext sin personalData · throws · getFiscalContextSafe → null', async () => {
    getPersonalDataMock.mockResolvedValue(null);
    obtenerViviendaActivaMock.mockResolvedValue(undefined);

    await expect(getFiscalContext()).rejects.toThrow(/personalData/);

    invalidateFiscalContext();
    getPersonalDataMock.mockResolvedValue(null);

    const safe = await getFiscalContextSafe();
    expect(safe).toBeNull();
  });

  test('9 · cache · 2ª llamada desde cache · invalidate fuerza re-lectura', async () => {
    getPersonalDataMock.mockResolvedValue(buildPersonalData());
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    await getFiscalContext();
    await getFiscalContext();

    expect(getPersonalDataMock).toHaveBeenCalledTimes(1);
    expect(obtenerViviendaActivaMock).toHaveBeenCalledTimes(1);

    invalidateFiscalContext();
    await getFiscalContext();

    expect(getPersonalDataMock).toHaveBeenCalledTimes(2);
    expect(obtenerViviendaActivaMock).toHaveBeenCalledTimes(2);

    // TTL · pasados 31s la cache expira
    invalidateFiscalContext();
    await getFiscalContext();
    const callsBefore = getPersonalDataMock.mock.calls.length;

    jest.advanceTimersByTime(31_000);

    await getFiscalContext();
    expect(getPersonalDataMock.mock.calls.length).toBe(callsBefore + 1);
  });

  test('10 · idempotente · llamar N veces · resultado idéntico', async () => {
    getPersonalDataMock.mockResolvedValue(buildPersonalData());
    obtenerViviendaActivaMock.mockResolvedValue(buildViviendaPropietario());

    const a = await getFiscalContext();
    invalidateFiscalContext();
    const b = await getFiscalContext();
    invalidateFiscalContext();
    const c = await getFiscalContext();

    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});
