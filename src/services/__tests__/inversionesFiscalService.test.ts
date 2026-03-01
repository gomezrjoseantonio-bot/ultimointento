import type { PosicionInversion, Aportacion } from '../../types/inversiones';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../fiscalPaymentsService', () => ({
  getConfiguracionFiscal: jest.fn(),
  saveConfiguracionFiscal: jest.fn(),
}));

import { initDB } from '../db';
import { getConfiguracionFiscal, saveConfiguracionFiscal } from '../fiscalPaymentsService';
import {
  calcularGananciaPerdidaFIFO,
  calcularGananciasPerdidasEjercicio,
  gestionarArrastresMinusvalias,
  getMinusvaliasPendientes,
} from '../inversionesFiscalService';

const mockInitDB = initDB as jest.Mock;
const mockGetConfig = getConfiguracionFiscal as jest.Mock;
const mockSaveConfig = saveConfiguracionFiscal as jest.Mock;

function basePosicion(overrides: Partial<PosicionInversion> = {}): PosicionInversion {
  return {
    id: 1,
    nombre: 'Posición test',
    tipo: 'accion',
    entidad: 'Broker',
    valor_actual: 1000,
    fecha_valoracion: '2025-01-01',
    aportaciones: [],
    total_aportado: 0,
    rentabilidad_euros: 0,
    rentabilidad_porcentaje: 0,
    activo: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('inversionesFiscalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('FIFO básico por unidades: 100@10, 50@12, 50@15; venta 120 unidades => 1.240€', () => {
    const posicion = basePosicion({
      aportaciones: [
        { id: 1, fecha: '2024-01-01', tipo: 'aportacion', importe: 1000, unidades: 100 } as any,
        { id: 2, fecha: '2024-02-01', tipo: 'aportacion', importe: 600, unidades: 50 } as any,
        { id: 3, fecha: '2024-03-01', tipo: 'aportacion', importe: 750, unidades: 50 } as any,
      ],
      total_aportado: 2350,
    });

    const reembolso: Aportacion = {
      id: 10,
      fecha: '2025-01-10',
      tipo: 'reembolso',
      importe: 1500,
      unidades_vendidas: 120,
    };

    const res = calcularGananciaPerdidaFIFO(posicion, reembolso);
    expect(res.costeAdquisicion).toBe(1240);
    expect(res.gananciaOPerdida).toBe(260);
  });

  test('Sin unidades: prorrateo proporcional por importe', () => {
    const posicion = basePosicion({
      aportaciones: [
        { id: 1, fecha: '2024-01-01', tipo: 'aportacion', importe: 1000 },
        { id: 2, fecha: '2024-02-01', tipo: 'aportacion', importe: 500 },
      ],
      total_aportado: 1500,
    });

    const reembolso: Aportacion = {
      id: 3,
      fecha: '2025-03-01',
      tipo: 'reembolso',
      importe: 1200,
    };

    const res = calcularGananciaPerdidaFIFO(posicion, reembolso);
    expect(res.costeAdquisicion).toBe(1200);
    expect(res.gananciaOPerdida).toBe(0);
  });

  test('Minusvalía: compra 100@20, venta 100@15 => -500€', () => {
    const posicion = basePosicion({
      aportaciones: [{ id: 1, fecha: '2024-01-01', tipo: 'aportacion', importe: 2000, unidades: 100 } as any],
      total_aportado: 2000,
    });

    const reembolso: Aportacion = {
      id: 3,
      fecha: '2025-03-01',
      tipo: 'reembolso',
      importe: 1500,
      unidades_vendidas: 100,
    };

    const res = calcularGananciaPerdidaFIFO(posicion, reembolso);
    expect(res.costeAdquisicion).toBe(2000);
    expect(res.gananciaOPerdida).toBe(-500);
  });

  test('Arrastre 4 años: 2022 compensa en 2025; 2020 caduca en 2025', async () => {
    mockInitDB.mockResolvedValue({ getAll: jest.fn().mockResolvedValue([]) });
    mockGetConfig.mockResolvedValue({
      minusvalias_pendientes: [
        { anio: 2020, importe: 250 },
        { anio: 2022, importe: 400 },
      ],
    });

    const pendientes = await getMinusvaliasPendientes(2025);
    expect(pendientes).toEqual([{ anio: 2022, importe: 400 }]);
  });

  test('Compensación parcial: plusvalía 1000, pendiente 600 => compensado 400, pendiente 0', async () => {
    const posiciones = [
      basePosicion({
        id: 1,
        aportaciones: [
          { id: 1, fecha: '2024-01-01', tipo: 'aportacion', importe: 1000, unidades: 100 } as any,
          { id: 2, fecha: '2025-01-01', tipo: 'reembolso', importe: 2000, unidades_vendidas: 100 },
        ],
      }),
    ];

    mockInitDB.mockResolvedValue({ getAll: jest.fn().mockResolvedValue(posiciones) });
    mockGetConfig.mockResolvedValue({
      minusvalias_pendientes: [{ anio: 2024, importe: 600 }],
    });

    await gestionarArrastresMinusvalias(2025);

    expect(mockSaveConfig).toHaveBeenCalledWith({ minusvalias_pendientes: [] });
  });

  test('Múltiples posiciones en un ejercicio: neto correcto', async () => {
    const posiciones = [
      basePosicion({
        id: 1,
        nombre: 'A',
        aportaciones: [
          { id: 1, fecha: '2024-01-01', tipo: 'aportacion', importe: 1000, unidades: 100 } as any,
          { id: 2, fecha: '2025-04-01', tipo: 'reembolso', importe: 1200, unidades_vendidas: 100 },
        ],
      }),
      basePosicion({
        id: 2,
        nombre: 'B',
        aportaciones: [
          { id: 3, fecha: '2024-01-01', tipo: 'aportacion', importe: 2000, unidades: 100 } as any,
          { id: 4, fecha: '2025-05-01', tipo: 'reembolso', importe: 1500, unidades_vendidas: 100 },
        ],
      }),
    ];

    mockInitDB.mockResolvedValue({ getAll: jest.fn().mockResolvedValue(posiciones) });
    const res = await calcularGananciasPerdidasEjercicio(2025);

    expect(res.plusvalias).toBe(200);
    expect(res.minusvalias).toBe(500);
    expect(res.operaciones).toHaveLength(2);
  });
});
