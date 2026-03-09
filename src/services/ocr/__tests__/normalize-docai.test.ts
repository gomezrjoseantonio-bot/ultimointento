// Tests for normalize-docai.ts module
// Validates DocAI entity mapping to Spanish format fields

import { normalizeFeinFromDocAI } from '../normalize-docai';

describe('normalizeFeinFromDocAI', () => {
  describe('Entity mapping', () => {
    it('should map loan amount to capital_inicial with Spanish formatting', () => {
      const mockEntities = [
        {
          type: 'loan_amount',
          mentionText: '250000.00',
          normalizedValue: {
            moneyValue: {
              currencyCode: 'EUR',
              units: '250000',
              nanos: '0'
            }
          },
          confidence: 0.85
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.capital_inicial).toBe('250.000,00 €');
      expect(result.byField.capital_inicial).toEqual({
        confidence: 0.85,
        source: 'docai:loan_amount'
      });
    });

    it('should map term_months to plazoMeses', () => {
      const mockEntities = [
        {
          type: 'term_months',
          mentionText: '300 months',
          normalizedValue: { text: '300' },
          confidence: 0.90
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.plazoMeses).toBe(300);
      expect(result.byField.plazoMeses).toEqual({
        confidence: 0.90,
        source: 'docai:term_months'
      });
    });

    it('should convert years to months for term', () => {
      const mockEntities = [
        {
          type: 'term',
          mentionText: '25 años',
          normalizedValue: { text: '25' },
          confidence: 0.80
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.plazoMeses).toBe(300); // 25 * 12
    });

    it('should map interest_rate to tin with Spanish percentage format', () => {
      const mockEntities = [
        {
          type: 'interest_rate',
          mentionText: '3.25%',
          normalizedValue: { text: '3.25' },
          confidence: 0.88
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.tin).toBe('3,25 %');
      expect(result.byField.tin).toEqual({
        confidence: 0.88,
        source: 'docai:interest_rate'
      });
    });

    it('should map apr to tae with Spanish percentage format', () => {
      const mockEntities = [
        {
          type: 'apr',
          mentionText: '3.41%',
          normalizedValue: { text: '3.41' },
          confidence: 0.85
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.tae).toBe('3,41 %');
      expect(result.byField.tae).toEqual({
        confidence: 0.85,
        source: 'docai:apr'
      });
    });

    it('should map monthly_payment to cuota', () => {
      const mockEntities = [
        {
          type: 'monthly_payment',
          mentionText: '1263.45 €',
          normalizedValue: {
            moneyValue: {
              currencyCode: 'EUR',
              units: '1263',
              nanos: '450000000'
            }
          },
          confidence: 0.82
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.cuota).toBe('1263,45 €');
    });

    it('should map amortization_type to sistemaAmortizacion', () => {
      const mockEntities = [
        {
          type: 'amortization_type',
          mentionText: 'Sistema francés',
          normalizedValue: { text: 'francés' },
          confidence: 0.75
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.sistemaAmortizacion).toBe('Francés');
    });

    it('should map index to indice with normalization', () => {
      const mockEntities = [
        {
          type: 'index',
          mentionText: 'EURIBOR 12 meses',
          normalizedValue: { text: 'euribor' },
          confidence: 0.90
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.indice).toBe('Euríbor 12M');
    });

    it('should map margin to diferencial with + sign', () => {
      const mockEntities = [
        {
          type: 'margin',
          mentionText: '1.50%',
          normalizedValue: { text: '1.50' },
          confidence: 0.87
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.diferencial).toBe('+1,50 %');
    });

    it('should map fees to comisiones object', () => {
      const mockEntities = [
        {
          type: 'fees.apertura',
          mentionText: '0.50%',
          normalizedValue: { text: '0.50' },
          confidence: 0.80
        },
        {
          type: 'fees.mantenimiento',
          mentionText: '0.00%',
          normalizedValue: { text: '0.00' },
          confidence: 0.85
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.comisiones).toEqual({
        apertura: '0,50 %',
        mantenimiento: '0,00 %'
      });
    });

    it('should map expenses to gastos object', () => {
      const mockEntities = [
        {
          type: 'expenses.tasacion',
          mentionText: '400.00 €',
          normalizedValue: {
            moneyValue: {
              currencyCode: 'EUR',
              units: '400',
              nanos: '0'
            }
          },
          confidence: 0.75
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.gastos).toEqual({
        tasacion: '400,00 €'
      });
    });

    it('should map dates to Spanish format DD/MM/YYYY', () => {
      const mockEntities = [
        {
          type: 'offer_date',
          mentionText: '2024-02-01',
          normalizedValue: {
            dateValue: {
              year: 2024,
              month: 2,
              day: 1
            }
          },
          confidence: 0.85
        },
        {
          type: 'valid_until',
          mentionText: '15/02/2024',
          normalizedValue: {
            dateValue: {
              year: 2024,
              month: 2,
              day: 15
            }
          },
          confidence: 0.80
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.fechaOferta).toBe('01/02/2024');
      expect(result.fields.validez).toBe('15/02/2024');
    });

    it('should map IBAN to cuentaCargo', () => {
      const mockEntities = [
        {
          type: 'iban',
          mentionText: 'ES12 0049 **** **** 1234',
          normalizedValue: { text: 'ES12 0049 **** **** 1234' },
          confidence: 0.70
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.cuentaCargo).toBe('ES120049********1234');
    });

    it('should map bonifications to vinculaciones array', () => {
      const mockEntities = [
        {
          type: 'bonifications',
          mentionText: 'Domiciliación de nómina',
          normalizedValue: { text: 'nomina' },
          confidence: 0.85
        },
        {
          type: 'discounts',
          mentionText: 'Seguro de hogar',
          normalizedValue: { text: 'seguro_hogar' },
          confidence: 0.80
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.vinculaciones).toEqual(['Nómina', 'Seguro hogar']);
    });
  });

  describe('Confidence calculation', () => {
    it('should calculate global confidence based on critical fields', () => {
      const mockEntities = [
        { type: 'loan_amount', mentionText: '250000', normalizedValue: { moneyValue: { units: '250000', nanos: '0' } }, confidence: 0.90 },
        { type: 'term_months', mentionText: '300', normalizedValue: { text: '300' }, confidence: 0.85 },
        { type: 'interest_rate', mentionText: '3.25%', normalizedValue: { text: '3.25' }, confidence: 0.88 },
        { type: 'apr', mentionText: '3.41%', normalizedValue: { text: '3.41' }, confidence: 0.85 },
        { type: 'monthly_payment', mentionText: '1263.45', normalizedValue: { moneyValue: { units: '1263', nanos: '450000000' } }, confidence: 0.82 }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      // Weighted average: capital(0.3)*0.90 + plazo(0.2)*0.85 + tin(0.25)*0.88 + tae(0.15)*0.85 + cuota(0.1)*0.82
      // = 0.27 + 0.17 + 0.22 + 0.1275 + 0.082 = 0.8695
      expect(result.confidenceGlobal).toBeCloseTo(0.87, 2);
    });

    it('should identify pending fields with low confidence', () => {
      const mockEntities = [
        { type: 'loan_amount', mentionText: '250000', normalizedValue: { moneyValue: { units: '250000', nanos: '0' } }, confidence: 0.90 },
        { type: 'term_months', mentionText: '300', normalizedValue: { text: '300' }, confidence: 0.45 }, // Low confidence
        { type: 'interest_rate', mentionText: '3.25%', normalizedValue: { text: '3.25' }, confidence: 0.88 }
        // Missing TAE and cuota
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.pending).toContain('Plazo'); // Low confidence
      expect(result.pending).toContain('TAE'); // Missing
      expect(result.pending).toContain('Cuota'); // Missing
      expect(result.pending).not.toContain('Importe'); // Good confidence
      expect(result.pending).not.toContain('TIN'); // Good confidence
    });
  });

  describe('Field validation', () => {
    it('should validate TAE >= TIN relationship', () => {
      const mockEntities = [
        { type: 'interest_rate', mentionText: '3.50%', normalizedValue: { text: '3.50' }, confidence: 0.88 },
        { type: 'apr', mentionText: '3.25%', normalizedValue: { text: '3.25' }, confidence: 0.85 } // TAE < TIN (invalid)
      ];

      // Capture console.warn calls
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.tin).toBe('3,50 %');
      expect(result.fields.tae).toBe('3,25 %');
      expect(warnSpy).toHaveBeenCalledWith(
        'TAE validation warning: TAE should be >= TIN',
        { tae: 3.25, tin: 3.5 }
      );

      warnSpy.mockRestore();
    });
  });

  describe('Text fallback parsing', () => {
    it('should parse amounts from text when no normalized value', () => {
      const mockEntities = [
        {
          type: 'loan_amount',
          mentionText: 'Capital: 250.000,50 €',
          confidence: 0.75
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.capital_inicial).toBe('250.000,50 €');
    });

    it('should parse percentages from text when no normalized value', () => {
      const mockEntities = [
        {
          type: 'interest_rate',
          mentionText: 'TIN: 2,95% anual',
          confidence: 0.80
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.tin).toBe('2,95 %');
    });

    it('should parse dates from text in various formats', () => {
      const mockEntities = [
        {
          type: 'offer_date',
          mentionText: 'Fecha oferta: 01/02/2024',
          confidence: 0.75
        },
        {
          type: 'valid_until',
          mentionText: 'Valid until: 2024-02-15',
          confidence: 0.70
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.fechaOferta).toBe('01/02/2024');
      expect(result.fields.validez).toBe('15/02/2024');
    });
  });

  describe('Spanish number format handling', () => {
    it('should handle Spanish thousand separators and decimal comma', () => {
      const mockEntities = [
        {
          type: 'loan_amount',
          mentionText: '1.234.567,89 €',
          confidence: 0.85
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.capital_inicial).toBe('1.234.567,89 €');
    });

    it('should handle percentage with comma decimal', () => {
      const mockEntities = [
        {
          type: 'interest_rate',
          mentionText: '2,95%',
          confidence: 0.85
        }
      ];

      const result = normalizeFeinFromDocAI({ entities: mockEntities });

      expect(result.fields.tin).toBe('2,95 %');
    });
  });

  describe('Precision booster (regex extraction)', () => {
    it('should extract capital_inicial from Spanish text when missing from DocAI', () => {
      const mockText = `
        Solicitud de préstamo hipotecario
        Capital solicitado: 250.000,00 €
        Plazo: 25 años
        TIN: 3,25 %
        TAE: 3,41 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], // No DocAI entities
        text: mockText 
      });

      expect(result.fields.capital_inicial).toBe('250.000,00 €');
      expect(result.byField.capital_inicial?.source).toBe('regex:capital');
      expect(result.byField.capital_inicial?.confidence).toBe(0.70);
    });

    it('should extract plazo in years and convert to months', () => {
      const mockText = `
        Préstamo hipotecario
        Plazo: 25 años
        TIN: 3,25 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.plazoMeses).toBe(300); // 25 * 12
      expect(result.byField.plazoMeses?.source).toBe('regex:plazo_anos');
      expect(result.byField.plazoMeses?.confidence).toBe(0.75);
    });

    it('should extract plazo in months directly', () => {
      const mockText = `
        Préstamo hipotecario
        Plazo: 300 meses
        TIN: 3,25 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.plazoMeses).toBe(300);
      expect(result.byField.plazoMeses?.source).toBe('regex:plazo_meses');
    });

    it('should prioritize years over months in plazo extraction', () => {
      const mockText = `
        Préstamo hipotecario
        Plazo: 25 años (300 meses)
        TIN: 3,25 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.plazoMeses).toBe(300); // 25 * 12
      expect(result.byField.plazoMeses?.source).toBe('regex:plazo_anos');
    });

    it('should extract TIN and TAE percentages', () => {
      const mockText = `
        Condiciones del préstamo
        TIN: 3,25 %
        TAE: 3,41 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.tin).toBe('3,25 %');
      expect(result.byField.tin?.source).toBe('regex:tin');
      expect(result.fields.tae).toBe('3,41 %');
      expect(result.byField.tae?.source).toBe('regex:tae');
    });

    it('should extract cuota mensual', () => {
      const mockText = `
        Información del préstamo
        Cuota mensual aproximada: 1.263,45 €
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      // The formatter produces 1263,45 € for amounts < 10000 (no thousand separator)
      expect(result.fields.cuota).toBe('1263,45 €');
      expect(result.byField.cuota?.source).toBe('regex:cuota');
    });

    it('should extract and normalize EURIBOR index', () => {
      const mockText = `
        Índice de referencia
        EURIBOR 12 meses
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.indice).toBe('EURIBOR_12M');
      expect(result.byField.indice?.source).toBe('regex:indice');
    });

    it('should extract EURIBOR 6M variant', () => {
      const mockText = `
        Índice de referencia
        EURIBOR 6 meses
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.indice).toBe('EURIBOR_6M');
    });

    it('should default to EURIBOR_12M when no period specified', () => {
      const mockText = `
        Índice de referencia
        EURIBOR
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.indice).toBe('EURIBOR_12M');
    });

    it('should extract diferencial with + sign', () => {
      const mockText = `
        Condiciones del préstamo
        Diferencial: +1,50 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.diferencial).toBe('+1,50 %');
      expect(result.byField.diferencial?.source).toBe('regex:diferencial');
    });

    it('should extract diferencial without + sign', () => {
      const mockText = `
        Condiciones del préstamo
        Diferencial: 1,50 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.diferencial).toBe('+1,50 %');
    });

    it('should extract sistema de amortización Francés', () => {
      const mockText = `
        Condiciones del préstamo
        Sistema de amortización: Francés
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.sistemaAmortizacion).toBe('FRANCES');
      expect(result.byField.sistemaAmortizacion?.source).toBe('regex:sistema');
    });

    it('should extract sistema de amortización Alemán', () => {
      const mockText = `
        Condiciones del préstamo
        Amortización: Alemán
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.sistemaAmortizacion).toBe('ALEMAN');
    });

    it('should extract and format IBAN correctly', () => {
      const mockText = `
        Cuenta de cargo
        ES1200491234123412345678
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.cuentaCargo).toBe('ES12 0049 1234 1234 1234 5678');
      expect(result.byField.cuentaCargo?.source).toBe('regex:iban');
    });

    it('should extract IBAN with existing spaces', () => {
      const mockText = `
        Cuenta de cargo
        ES12 0049 1234 1234 1234 5678
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(result.fields.cuentaCargo).toBe('ES12 0049 1234 1234 1234 5678');
    });

    it('should not overwrite existing DocAI fields', () => {
      const mockEntities = [
        {
          type: 'loan_amount',
          mentionText: '300.000,00 €',
          normalizedValue: {
            moneyValue: {
              currencyCode: 'EUR',
              units: '300000',
              nanos: '0'
            }
          },
          confidence: 0.85
        }
      ];

      const mockText = `
        Capital solicitado: 250.000,00 €
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: mockEntities, 
        text: mockText 
      });

      // Should keep DocAI value, not regex value
      expect(result.fields.capital_inicial).toBe('300.000,00 €');
      expect(result.byField.capital_inicial?.source).toBe('docai:loan_amount');
    });

    it('should calculate confidence correctly for regex-only extraction', () => {
      const mockText = `
        Capital inicial: 250.000,00 €
        Plazo: 25 años
        TIN: 3,25 %
        TAE: 3,41 %
        Cuota mensual: 1.263,45 €
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      // All fields extracted by regex, should be capped between 0.65-0.75
      expect(result.confidenceGlobal).toBeGreaterThanOrEqual(0.65);
      expect(result.confidenceGlobal).toBeLessThanOrEqual(0.75);
    });

    it('should calculate mixed confidence for DocAI + regex extraction', () => {
      const mockEntities = [
        {
          type: 'loan_amount',
          mentionText: '250.000,00 €',
          normalizedValue: {
            moneyValue: {
              currencyCode: 'EUR',
              units: '250000',
              nanos: '0'
            }
          },
          confidence: 0.90
        }
      ];

      const mockText = `
        TIN: 3,25 %
        TAE: 3,41 %
      `;

      const result = normalizeFeinFromDocAI({ 
        entities: mockEntities, 
        text: mockText 
      });

      // Mixed DocAI + regex, should not be capped
      expect(result.confidenceGlobal).toBeGreaterThan(0.75);
    });

    it('should log filled fields safely', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const mockText = `
        Capital inicial: 250.000,00 €
        TIN: 3,25 %
      `;

      normalizeFeinFromDocAI({ 
        entities: [], 
        text: mockText 
      });

      expect(consoleSpy).toHaveBeenCalledWith('[FEIN] booster', { 
        filled: expect.arrayContaining(['capital_inicial', 'tin'])
      });

      consoleSpy.mockRestore();
    });
  });
});