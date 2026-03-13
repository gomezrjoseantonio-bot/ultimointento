import {
  buildPropertyAnalysisInputs,
  calculateOperationalPerformance,
  calculateFinancialProfitability,
  calculateFiscalROI,
  calculateSaleSimulation,
  getRecommendationText,
  getTrafficLightEmoji,
} from '../propertyAnalysisUtils';
import { DEFAULT_ANALYSIS_CONFIG } from '../../types/propertyAnalysis';
import type { Contract, Ingreso, Property } from '../../services/db';
import type { Prestamo } from '../../types/prestamos';
import type { ValoracionHistorica } from '../../types/valoraciones';

describe('Property Analysis Utils', () => {
  const property: Property = {
    id: 10,
    alias: 'Piso Centro',
    address: 'Calle Mayor 1',
    postalCode: '28001',
    province: 'Madrid',
    municipality: 'Madrid',
    ccaa: 'Madrid',
    purchaseDate: '2022-03-01',
    squareMeters: 80,
    bedrooms: 2,
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: {
      price: 200000,
      itp: 14000,
      notary: 900,
      registry: 600,
      management: 400,
      psi: 300,
      realEstate: 2000,
      other: [{ concept: 'Tasación', amount: 450 }],
    },
    documents: [],
  };

  const contract: Contract = {
    id: 200,
    inmuebleId: 10,
    unidadTipo: 'vivienda',
    modalidad: 'habitual',
    inquilino: {
      nombre: 'Ana',
      apellidos: 'López',
      dni: '11111111A',
      telefono: '600000000',
      email: 'ana@example.com',
    },
    fechaInicio: '2025-01-01',
    fechaFin: '2026-01-01',
    rentaMensual: 1300,
    diaPago: 5,
    margenGraciaDias: 5,
    indexacion: 'none',
    historicoIndexaciones: [],
    fianzaMeses: 1,
    fianzaImporte: 1300,
    fianzaEstado: 'retenida',
    cuentaCobroId: 1,
    estadoContrato: 'activo',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  const ingresos: Ingreso[] = [
    {
      id: 1,
      origen: 'contrato_id',
      origen_id: 200,
      contraparte: 'Ana López',
      fecha_emision: '2025-02-01',
      fecha_prevista_cobro: '2025-02-05',
      importe: 1300,
      moneda: 'EUR',
      destino: 'inmueble_id',
      destino_id: 10,
      estado: 'cobrado',
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    },
  ];

  const prestamo: Prestamo = {
    id: 'loan-1',
    ambito: 'INMUEBLE',
    inmuebleId: '10',
    nombre: 'Hipoteca Piso Centro',
    principalInicial: 170000,
    principalVivo: 155000,
    fechaFirma: '2022-03-01',
    fechaPrimerCargo: '2022-04-01',
    plazoMesesTotal: 300,
    diaCargoMes: 5,
    esquemaPrimerRecibo: 'NORMAL',
    tipo: 'FIJO',
    sistema: 'FRANCES',
    tipoNominalAnualFijo: 2.8,
    carencia: 'NINGUNA',
    cuentaCargoId: 'acc-1',
    cuotasPagadas: 36,
    origenCreacion: 'MANUAL',
    activo: true,
    createdAt: '2022-03-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z',
  };

  const valoraciones: ValoracionHistorica[] = [
    {
      id: 1,
      tipo_activo: 'inmueble',
      activo_id: 10,
      activo_nombre: 'Piso Centro',
      fecha_valoracion: '2025-02',
      valor: 255000,
      origen: 'manual',
      created_at: '2025-02-15T00:00:00.000Z',
      updated_at: '2025-02-15T00:00:00.000Z',
    },
    {
      id: 2,
      tipo_activo: 'inmueble',
      activo_id: 10,
      activo_nombre: 'Piso Centro',
      fecha_valoracion: '2024-02',
      valor: 247000,
      origen: 'manual',
      created_at: '2024-02-15T00:00:00.000Z',
      updated_at: '2024-02-15T00:00:00.000Z',
    },
  ];

  describe('buildPropertyAnalysisInputs', () => {
    it('builds analysis inputs from IndexedDB-like records', () => {
      const result = buildPropertyAnalysisInputs({
        property,
        contracts: [contract],
        ingresos,
        gastosOperativosOverride: 140,
        prestamos: [prestamo],
        valoraciones,
      });

      expect(result.inputs.ingresosMensuales).toBe(1300);
      expect(result.inputs.gastosOperativos).toBe(140);
      expect(result.inputs.valorActualActivo).toBe(255000);
      expect(result.inputs.deudaPendiente).toBe(155000);
      expect(result.inputs.precioTotalCompra).toBe(218650);
      expect(result.inputs.revalorizacionAnual).toBe(8000);
      expect(result.missingFields).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('matches mortgages linked through legacy propertyId and reports incomplete mortgage data', () => {
      const legacyLoan = {
        ...prestamo,
        inmuebleId: undefined,
        propertyId: '10',
        plazoMesesTotal: 0,
      } as Prestamo & { propertyId: string };

      const result = buildPropertyAnalysisInputs({
        property,
        contracts: [contract],
        ingresos,
        gastosOperativosOverride: 140,
        prestamos: [legacyLoan as Prestamo],
        valoraciones,
      });

      expect(result.inputs.deudaPendiente).toBe(155000);
      expect(result.inputs.cuotaHipoteca).toBe(0);
      expect(result.warnings).toContain(
        'No se ha podido calcular la cuota mensual de una o más hipotecas por datos incompletos.'
      );
    });


    it('normalizes variable mortgage rates entered as decimal or percentage', () => {
      const variableLoanDecimal: Prestamo = {
        ...prestamo,
        tipo: 'VARIABLE',
        tipoNominalAnualFijo: undefined,
        valorIndiceActual: 0.025,
        diferencial: 0.01,
      };

      const variableLoanPercentage: Prestamo = {
        ...variableLoanDecimal,
        valorIndiceActual: 2.5,
        diferencial: 1,
      };

      const decimalResult = buildPropertyAnalysisInputs({
        property,
        contracts: [contract],
        ingresos,
        gastosOperativosOverride: 140,
        prestamos: [variableLoanDecimal],
        valoraciones,
      });

      const percentageResult = buildPropertyAnalysisInputs({
        property,
        contracts: [contract],
        ingresos,
        gastosOperativosOverride: 140,
        prestamos: [variableLoanPercentage],
        valoraciones,
      });

      expect(decimalResult.inputs.cuotaHipoteca).toBeCloseTo(percentageResult.inputs.cuotaHipoteca, 2);
      expect(decimalResult.inputs.amortizacionAnual).toBeCloseTo(percentageResult.inputs.amortizacionAnual, 2);
    });


    it('applies proportional mortgage allocation when one loan is linked to multiple properties', () => {
      const sharedLoan: Prestamo = {
        ...prestamo,
        id: 'loan-shared',
        inmuebleId: undefined,
        afectacionesInmueble: [
          { inmuebleId: '10', porcentaje: 40, tipoRelacion: 'MIXTA' },
          { inmuebleId: '11', porcentaje: 60, tipoRelacion: 'MIXTA' },
        ],
      };

      const result = buildPropertyAnalysisInputs({
        property,
        contracts: [contract],
        ingresos,
        gastosOperativosOverride: 140,
        prestamos: [sharedLoan],
        valoraciones,
      });

      expect(result.inputs.deudaPendiente).toBeCloseTo(62000, 2);
      expect(result.inputs.comisionCancelacion).toBeCloseTo(0, 2);
      expect(result.warnings).toEqual([]);
    });

    it('excludes loans marked as PERSONAL purpose from property profitability', () => {
      const personalPurposeLoan: Prestamo = {
        ...prestamo,
        finalidad: 'PERSONAL',
      };

      const result = buildPropertyAnalysisInputs({
        property,
        contracts: [contract],
        ingresos,
        gastosOperativosOverride: 140,
        prestamos: [personalPurposeLoan],
        valoraciones,
      });

      expect(result.inputs.deudaPendiente).toBe(0);
      expect(result.inputs.cuotaHipoteca).toBe(0);
      expect(result.inputs.interesesFuturosEvitados).toBe(0);
    });

    it('reports missing required data when records are incomplete', () => {
      const result = buildPropertyAnalysisInputs({
        property,
        contracts: [],
        ingresos: [],
        gastosOperativosOverride: 0,
        prestamos: [],
        valoraciones: [],
      });

      expect(result.missingFields).toContain('ingresos mensuales');
      expect(result.missingFields).toContain('gastos operativos');
      expect(result.missingFields).toContain('valoración actual del activo');
    });
  });

  describe('calculateOperationalPerformance', () => {
    it('should calculate cashflow correctly', () => {
      const result = calculateOperationalPerformance(1200, 150, 600);

      expect(result.cashflowNetoMensual).toBe(450);
      expect(result.cashflowAnual).toBe(5400);
    });
  });

  describe('calculateFinancialProfitability', () => {
    it('should calculate ROI metrics correctly', () => {
      const result = calculateFinancialProfitability(250000, 180000, 200000, 14400, 12600, 5400, 3000, 5000);

      expect(result.equityActual).toBe(70000);
      expect(result.rentabilidadBruta).toBeCloseTo(7.2, 1);
      expect(result.rentabilidadNeta).toBeCloseTo(6.3, 1);
      expect(result.roiEquityReal).toBeCloseTo(7.71, 1);
      expect(result.roiTotal).toBeCloseTo(19.14, 1);
    });
  });

  describe('calculateFiscalROI', () => {
    it('should calculate fiscal ROI and return VENDER when below opportunity cost', () => {
      const result = calculateFiscalROI(5400, 70000, DEFAULT_ANALYSIS_CONFIG);

      expect(result.roiFiscalNeto).toBeCloseTo(4.09, 1);
      expect(result.conclusion).toBe('VENDER');
    });

    it('should return MANTENER when ROI is above opportunity cost', () => {
      const result = calculateFiscalROI(14000, 70000, DEFAULT_ANALYSIS_CONFIG);

      expect(result.roiFiscalNeto).toBeCloseTo(10.6, 1);
      expect(result.conclusion).toBe('MANTENER');
    });
  });

  describe('calculateSaleSimulation', () => {
    it('should calculate sale proceeds correctly', () => {
      const result = calculateSaleSimulation(260000, 8000, 180000, 1800, 200000, 12000, 5000, 8000, DEFAULT_ANALYSIS_CONFIG);

      expect(result.impuestos3Pct).toBe(7800);
      expect(result.capitalNetoFinal).toBe(53300);
    });
  });

  describe('getRecommendationText', () => {
    it('should return correct text for VENDER', () => {
      const text = getRecommendationText('VENDER', 5.5, 10, 50000);
      expect(text).toContain('5,50%');
      expect(text).toContain('10,00%');
    });
  });

  describe('getTrafficLightEmoji', () => {
    it('should return correct emoji for each status', () => {
      expect(getTrafficLightEmoji('MANTENER')).toBe('🟢');
      expect(getTrafficLightEmoji('REVISAR')).toBe('⚪');
      expect(getTrafficLightEmoji('VENDER')).toBe('🔴');
    });
  });
});
