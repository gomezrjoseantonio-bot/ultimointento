// H-OCR-REFORM: Tests for invoice categorization service
import invoiceCategorizationService from '../invoiceCategorizationService';

describe('Invoice Categorization Service', () => {
  describe('categorizeOCRLineItem', () => {
    test('should categorize mejora items correctly', () => {
      const mejoraDescriptions = [
        'Reforma cocina completa',
        'Instalación ventanas nuevas',
        'Obra de ampliación salón',
        'Eficiencia energética'
      ];

      mejoraDescriptions.forEach(description => {
        const category = invoiceCategorizationService.categorizeOCRLineItem(description);
        expect(category).toBe('mejora');
      });
    });

    test('should categorize mobiliario items correctly', () => {
      const mobiliarioDescriptions = [
        'Sofá cama para salón',
        'Frigorífico nuevo',
        'Mesa y sillas comedor',
        'Lámpara dormitorio'
      ];

      mobiliarioDescriptions.forEach(description => {
        const category = invoiceCategorizationService.categorizeOCRLineItem(description);
        expect(category).toBe('mobiliario');
      });
    });

    test('should categorize reparacion-conservacion items correctly', () => {
      const rcDescriptions = [
        'Reparación avería calefacción',
        'Mantenimiento ascensor',
        'Pintura general',
        'Desatasco tubería'
      ];

      rcDescriptions.forEach(description => {
        const category = invoiceCategorizationService.categorizeOCRLineItem(description);
        expect(category).toBe('reparacion-conservacion');
      });
    });

    test('should default to reparacion-conservacion for unclear items', () => {
      const unclearDescriptions = [
        'Varios',
        'abc',
        '',
        'Item genérico'
      ];

      unclearDescriptions.forEach(description => {
        const category = invoiceCategorizationService.categorizeOCRLineItem(description);
        expect(category).toBe('reparacion-conservacion');
      });
    });
  });

  describe('categorizeWithConfidence', () => {
    test('should return confidence scores', () => {
      const result = invoiceCategorizationService.categorizeWithConfidence('Reforma completa de cocina');
      expect(result.category).toBe('mejora');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.matchedKeywords).toContain('reforma');
      expect(result.matchedKeywords).toContain('cocina');
    });

    test('should return low confidence for empty description', () => {
      const result = invoiceCategorizationService.categorizeWithConfidence('');
      expect(result.category).toBe('reparacion-conservacion');
      expect(result.confidence).toBe(0);
      expect(result.matchedKeywords).toHaveLength(0);
    });
  });

  describe('applyMinorAmountRule', () => {
    test('should convert to reparacion-conservacion when amount <= 300', () => {
      const result = invoiceCategorizationService.applyMinorAmountRule('mejora', 250, true);
      expect(result).toBe('reparacion-conservacion');
    });

    test('should keep original category when amount > 300', () => {
      const result = invoiceCategorizationService.applyMinorAmountRule('mejora', 500, true);
      expect(result).toBe('mejora');
    });

    test('should keep original category when rule disabled', () => {
      const result = invoiceCategorizationService.applyMinorAmountRule('mejora', 250, false);
      expect(result).toBe('mejora');
    });
  });

  describe('suggestDistribution', () => {
    test('should recommend percentage mode for generic items', () => {
      const lineItems = [
        { description: 'Item 1', amount: 100 },
        { description: 'Item 2', amount: 200 }
      ];

      const result = invoiceCategorizationService.suggestDistribution(lineItems);
      expect(result.recommendPercentageMode).toBe(true);
      expect(result.totalAmount).toBe(300);
    });

    test('should recommend line mode for specific items', () => {
      const lineItems = [
        { description: 'Reforma completa de cocina con instalación de ventanas nuevas', amount: 5000 },
        { description: 'Sofá cama de tres plazas para el salón principal', amount: 800 },
        { description: 'Reparación de avería en calefacción central', amount: 300 }
      ];

      const result = invoiceCategorizationService.suggestDistribution(lineItems);
      expect(result.recommendPercentageMode).toBe(false);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].category).toBe('mejora');
      expect(result.suggestions[1].category).toBe('mobiliario');
      expect(result.suggestions[2].category).toBe('reparacion-conservacion');
    });
  });

  describe('getCategorizationExplanation', () => {
    test('should provide explanation for categorization', () => {
      const result = invoiceCategorizationService.categorizeWithConfidence('Reforma cocina');
      const explanation = invoiceCategorizationService.getCategorizationExplanation(result);
      
      expect(explanation).toContain('Mejora');
      expect(explanation).toContain('reforma');
      expect(explanation).toContain('Confianza');
    });

    test('should handle zero confidence case', () => {
      const result = { category: 'reparacion-conservacion' as const, confidence: 0, matchedKeywords: [] };
      const explanation = invoiceCategorizationService.getCategorizationExplanation(result);
      
      expect(explanation).toContain('Sin palabras clave');
      expect(explanation).toContain('R&C por defecto');
    });
  });
});