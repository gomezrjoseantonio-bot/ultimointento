import { calcularDeclaracionIRPF } from '../irpfCalculationService';
import { initDB } from '../db';
import { personalDataService } from '../personalDataService';
import { nominaService } from '../nominaService';
import { calcularGananciasPerdidasEjercicio, getMinusvaliasPendientes } from '../inversionesFiscalService';
import { getGananciasPatrimonialesInmueblesEjercicio } from '../propertyDisposalTaxService';
import { getRendimientosAtribuidosEjercicio } from '../entidadAtribucionService';

jest.mock('../db', () => ({
  initDB: jest.fn(),
}));

jest.mock('../personalDataService', () => ({
  personalDataService: {
    getPersonalData: jest.fn(),
  },
}));

jest.mock('../nominaService', () => ({
  nominaService: {
    getAllActiveNominas: jest.fn(),
  },
}));

jest.mock('../inversionesFiscalService', () => ({
  calcularGananciasPerdidasEjercicio: jest.fn(),
  getMinusvaliasPendientes: jest.fn(),
}));

jest.mock('../propertyDisposalTaxService', () => ({
  getGananciasPatrimonialesInmueblesEjercicio: jest.fn(),
}));

jest.mock('../entidadAtribucionService', () => ({
  getRendimientosAtribuidosEjercicio: jest.fn(),
}));

jest.mock('../fiscalConciliationService', () => ({
  conciliarEjercicioFiscal: jest.fn(),
}));

describe('irpfCalculationService entidades en atribución', () => {
  beforeEach(() => {
    (initDB as jest.Mock).mockResolvedValue({
      getAll: jest.fn(async () => []),
    });
    (personalDataService.getPersonalData as jest.Mock).mockResolvedValue({
      descendientes: [],
      ascendientes: [],
      discapacidad: 'ninguna',
    });
    (nominaService.getAllActiveNominas as jest.Mock).mockResolvedValue([]);
    (calcularGananciasPerdidasEjercicio as jest.Mock).mockResolvedValue({ plusvalias: 0, minusvalias: 0 });
    (getMinusvaliasPendientes as jest.Mock).mockResolvedValue([]);
    (getGananciasPatrimonialesInmueblesEjercicio as jest.Mock).mockResolvedValue([]);
    (getRendimientosAtribuidosEjercicio as jest.Mock).mockResolvedValue({
      capitalInmobiliario: {
        total: 1682.8,
        retenciones: 136.05,
        detalle: [{ entidad: 'Residencial Smart Santa Catalina CB (10%)', importe: 1682.8, retencion: 136.05 }],
      },
      actividadEconomica: {
        total: 0,
        retenciones: 0,
        detalle: [],
      },
      capitalMobiliario: {
        total: 0,
        retenciones: 0,
        detalle: [],
      },
    });
  });

  it('suma capital inmobiliario atribuido a la base general y sus retenciones al total', async () => {
    const declaracion = await calcularDeclaracionIRPF(2025);

    expect(declaracion.baseGeneral.total).toBe(1682.8);
    expect(declaracion.baseGeneral.rendimientosInmuebles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alias: expect.stringContaining('Entidades en atribución'),
          rendimientoNeto: 1682.8,
        }),
      ]),
    );
    expect(declaracion.retenciones.total).toBe(136.05);
  });
});
