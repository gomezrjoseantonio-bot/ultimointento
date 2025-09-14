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
});