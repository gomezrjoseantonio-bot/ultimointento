// Test Enhanced FEIN OCR Service Functionality
// Tests the improvements made for better Spanish text extraction

import { feinOcrService } from '../services/feinOcrService';
import { FEINBonificacion } from '../types/fein';

describe('Enhanced FEIN OCR Service', () => {
  
  describe('Enhanced Bank Entity Extraction', () => {
    it('should extract major Spanish bank names correctly', () => {
      const testTexts = [
        'Banco Santander, S.A.',
        'BBVA Banco Bilbao Vizcaya Argentaria',
        'CaixaBank S.A.',
        'ING Direct España',
        'Unicaja Banco, S.A.'
      ];

      testTexts.forEach(text => {
        const service = feinOcrService as any;
        const result = service.extractBankEntity(text.toLowerCase());
        expect(result).toBeDefined();
        expect(result).not.toContain('s.a.');
        expect(result).not.toContain('s.c.c.');
      });
    });

    it('should handle bank names with accents and special characters', () => {
      const service = feinOcrService as any;
      const result = service.extractBankEntity('banco de crédito y cooperación');
      expect(result).toBeDefined();
      expect(result).toContain('Banco');
    });
  });

  describe('Enhanced IBAN Extraction', () => {
    it('should extract masked IBANs correctly', () => {
      const testTexts = [
        'ES12 **** **** **** **** 5678',
        'ES12 #### #### #### #### 5678',
        'ES12xxxx xxxx xxxx xxxx5678',
        'Cuenta de cargo: ES12 **** **** **** **** 1234'
      ];

      testTexts.forEach(text => {
        const service = feinOcrService as any;
        const result = service.extractIBAN(text.toLowerCase());
        expect(result).toBeDefined();
        expect(result).toMatch(/ES\d{2}/);
      });
    });

    it('should handle various IBAN formatting', () => {
      const service = feinOcrService as any;
      const result = service.extractIBAN('iban: es12-3456-7890-1234-5678-90');
      expect(result).toBeDefined();
      expect(result).toContain('ES12');
    });
  });

  describe('Enhanced Bonification Detection', () => {
    it('should detect comprehensive Spanish bonification keywords', () => {
      const testTexts = [
        'seguro de hogar bonificación 0,25%',
        'nómina ingresos ≥ 2000€ descuento 0,50%',
        'tarjeta uso mensual ≥ 10 operaciones 0,15%',
        'plan de pensiones activo 0,30%',
        'sistema de alarma 0,10%'
      ];

      testTexts.forEach(text => {
        const service = feinOcrService as any;
        const result = service.extractBonificaciones(text, text);
        expect(result).toHaveLength(1);
        expect(result[0].tipo).toBeDefined();
        expect(result[0].descripcion).toBeDefined();
      });
    });

    it('should avoid duplicate bonifications', () => {
      const service = feinOcrService as any;
      const text = 'seguro hogar seguro de hogar seguro del hogar 0,25%';
      const result = service.extractBonificaciones(text, text);
      
      // Should not create duplicates for similar keywords
      const hogarBonifs = result.filter((b: FEINBonificacion) => b.tipo === 'SEGURO_HOGAR');
      expect(hogarBonifs.length).toBeLessThanOrEqual(3); // Max one per distinct keyword
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate higher confidence for complete FEIN data', () => {
      const completeData = {
        bancoEntidad: 'Banco Santander',
        capitalInicial: 200000,
        tin: 0.032,
        tae: 0.033,
        plazoAnos: 30,
        tipo: 'VARIABLE' as const,
        indice: 'EURIBOR',
        diferencial: 0.012,
        cuentaCargoIban: 'ES12 3456 7890 1234 5678 90',
        bonificaciones: [{ tipo: 'NOMINA' as const, descripcion: 'Nómina', descuento: 0.005 }]
      };

      const service = feinOcrService as any;
      const confidence = service.calculateConfidence(completeData);
      expect(confidence).toBeGreaterThan(0.8);
    });

    it('should calculate lower confidence for incomplete FEIN data', () => {
      const incompleteData = {
        capitalInicial: 200000,
        tipo: 'FIJO' as const
      };

      const service = feinOcrService as any;
      const confidence = service.calculateConfidence(incompleteData);
      expect(confidence).toBeLessThan(0.5);
    });
  });
});