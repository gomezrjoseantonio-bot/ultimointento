import {
  calculateOperationalPerformance,
  calculateFinancialProfitability,
  calculateFiscalROI,
  calculateSaleSimulation,
  getRecommendationText,
  getTrafficLightEmoji,
} from '../propertyAnalysisUtils';
import { DEFAULT_ANALYSIS_CONFIG } from '../../types/propertyAnalysis';

describe('Property Analysis Utils', () => {
  describe('calculateOperationalPerformance', () => {
    it('should calculate cashflow correctly', () => {
      const result = calculateOperationalPerformance(1200, 150, 600);
      
      expect(result.ingresosMensuales).toBe(1200);
      expect(result.gastosOperativos).toBe(150);
      expect(result.cuotaHipoteca).toBe(600);
      expect(result.cashflowNetoMensual).toBe(450);
      expect(result.cashflowAnual).toBe(5400);
    });
  });

  describe('calculateFinancialProfitability', () => {
    it('should calculate ROI metrics correctly', () => {
      const result = calculateFinancialProfitability(
        250000, // valorActualActivo
        180000, // deudaPendiente
        200000, // precioTotalCompra
        14400,  // ingresosAnuales
        12600,  // noi
        5400,   // cashflowAnual
        3000,   // amortizacionAnual
        5000    // revalorizacionAnual
      );
      
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
      
      expect(result.impuestoRentas).toBeCloseTo(2538, 0);
      expect(result.cashflowNetoTrasImpuestos).toBeCloseTo(2862, 0);
      expect(result.roiFiscalNeto).toBeCloseTo(4.09, 1);
      expect(result.roiAlternativo).toBe(10);
      expect(result.roiDiferencial).toBeCloseTo(-5.91, 1);
      expect(result.conclusion).toBe('VENDER'); // Below opportunity cost
    });

    it('should return VENDER when ROI is well below opportunity cost', () => {
      const result = calculateFiscalROI(10000, 70000, DEFAULT_ANALYSIS_CONFIG);
      
      expect(result.roiFiscalNeto).toBeCloseTo(7.57, 1);
      expect(result.conclusion).toBe('VENDER'); // Below opportunity cost by more than 1%
    });

    it('should return MANTENER when ROI is above opportunity cost', () => {
      const result = calculateFiscalROI(14000, 70000, DEFAULT_ANALYSIS_CONFIG);
      
      expect(result.roiFiscalNeto).toBeCloseTo(10.6, 1);
      expect(result.conclusion).toBe('MANTENER'); // Above opportunity cost
    });
  });

  describe('calculateSaleSimulation', () => {
    it('should calculate sale proceeds correctly', () => {
      const result = calculateSaleSimulation(
        260000, // precioVenta
        8000,   // comisionVenta
        180000, // deudaPendiente
        1800,   // comisionCancelacion
        200000, // precioCompra
        12000,  // itpOIva
        5000,   // reformaTotal
        8000,   // gastosCompra
        DEFAULT_ANALYSIS_CONFIG
      );
      
      expect(result.impuestos3Pct).toBe(7800);
      expect(result.capitalLiberable).toBe(62400);
      expect(result.plusvaliaEstimada).toBe(35000);
      expect(result.irpf26Pct).toBe(9100);
      expect(result.capitalNetoFinal).toBe(53300);
    });

    it('should handle no capital gains (negative plusvalia)', () => {
      const result = calculateSaleSimulation(
        200000, // precioVenta (lower than total cost)
        8000,   // comisionVenta
        180000, // deudaPendiente
        1800,   // comisionCancelacion
        200000, // precioCompra
        12000,  // itpOIva
        5000,   // reformaTotal
        8000,   // gastosCompra
        DEFAULT_ANALYSIS_CONFIG
      );
      
      expect(result.plusvaliaEstimada).toBe(-25000);
      expect(result.irpf26Pct).toBe(0); // No tax on negative plusvalia
    });
  });

  describe('getRecommendationText', () => {
    it('should return correct text for MANTENER', () => {
      const text = getRecommendationText('MANTENER', 12.5, 10);
      expect(text).toContain('supera el coste de oportunidad');
      expect(text).toContain('12.50%');
      expect(text).toContain('10.00%');
    });

    it('should return correct text for REVISAR', () => {
      const text = getRecommendationText('REVISAR', 10.5, 10);
      expect(text).toContain('está en el umbral');
      expect(text).toContain('mejoras o refinanciación');
    });

    it('should return correct text for VENDER', () => {
      const text = getRecommendationText('VENDER', 5.5, 10, 50000);
      expect(text).toContain('por debajo del coste de oportunidad');
      expect(text).toContain('50');
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
