// Tests for FEIN Normalizer Service
// Validates field extraction and Spanish number/percentage parsing

import { FeinNormalizer } from '../feinNormalizer';
import { ChunkProcessingResult } from '../../../types/fein';

describe('FeinNormalizer', () => {
  describe('extractFromChunk', () => {
    it('should extract bank name correctly', () => {
      const ocrText = `
        FICHA EUROPEA DE INFORMACIÓN NORMALIZADA
        Banco Santander S.A.
        Préstamo hipotecario
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.banco).toBe('Banco Santander');
    });

    it('should extract capital amount from Spanish format', () => {
      const ocrText = `
        Capital inicial: 250.000,00 €
        Plazo: 25 años
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.capitalInicial).toBe(250000);
    });

    it('should extract loan type correctly', () => {
      const ocrText = `
        Tipo de interés: VARIABLE
        Índice de referencia: EURIBOR
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.tipo).toBe('VARIABLE');
    });

    it('should extract TIN percentage correctly', () => {
      const ocrText = `
        TIN: 3,45% anual
        TAE: 3,68% anual
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.tinFijo).toBe(3.45);
    });

    it('should extract diferencial correctly', () => {
      const ocrText = `
        EURIBOR 12 meses + 1,50%
        Diferencial aplicable: 1,50%
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.diferencial).toBe(1.5);
    });

    it('should extract plazo in months from years', () => {
      const ocrText = `
        Plazo del préstamo: 25 años
        Sistema de amortización: Francés
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.plazoMeses).toBe(300); // 25 years * 12 months
    });

    it('should extract bonifications', () => {
      const ocrText = `
        BONIFICACIONES DISPONIBLES:
        - Domiciliación nómina: -0,10 puntos
        - Seguro hogar: -0,15 puntos
        - Tarjeta débito: -0,05 puntos
      `;
      
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 4 });
      expect(result.bonificaciones).toBeDefined();
      expect(result.bonificaciones!.length).toBeGreaterThan(0);
      
      const nomiaBonif = result.bonificaciones!.find(b => b.id === 'nomina');
      expect(nomiaBonif).toBeDefined();
      expect(nomiaBonif?.descuentoPuntos).toBe(0.1);
    });
  });

  describe('aggregateChunks', () => {
    it('should aggregate multiple chunks correctly', () => {
      const chunks: ChunkProcessingResult[] = [
        {
          chunkIndex: 0,
          pageRange: { from: 1, to: 4 },
          extractedData: {
            banco: 'Banco Santander',
            tipo: 'VARIABLE'
          },
          bonificaciones: [
            { id: 'nomina', etiqueta: 'Nómina', descuentoPuntos: 0.1 }
          ],
          confidence: 0.9,
          processingTimeMs: 1500,
          retryCount: 0
        },
        {
          chunkIndex: 1,
          pageRange: { from: 5, to: 8 },
          extractedData: {
            capitalInicial: 250000,
            tinFijo: 3.45,
            plazoMeses: 300
          },
          bonificaciones: [
            { id: 'hogar', etiqueta: 'Seguro hogar', descuentoPuntos: 0.15 }
          ],
          confidence: 0.85,
          processingTimeMs: 1200,
          retryCount: 0
        }
      ];

      const result = FeinNormalizer.aggregateChunks(chunks, 'test_fein.pdf', 8, 'google');

      expect(result.metadata.sourceFileName).toBe('test_fein.pdf');
      expect(result.metadata.pagesTotal).toBe(8);
      expect(result.metadata.pagesProcessed).toBe(8);
      expect(result.metadata.ocrProvider).toBe('google');

      // Should merge data from both chunks
      expect(result.prestamo.banco).toBe('Banco Santander');
      expect(result.prestamo.tipo).toBe('VARIABLE');
      expect(result.prestamo.capitalInicial).toBe(250000);
      expect(result.prestamo.tinFijo).toBe(3.45);
      expect(result.prestamo.plazoMeses).toBe(300);

      // Should merge bonifications
      expect(result.bonificaciones).toHaveLength(2);
      expect(result.bonificaciones!.find(b => b.id === 'nomina')).toBeDefined();
      expect(result.bonificaciones!.find(b => b.id === 'hogar')).toBeDefined();
    });

    it('should prioritize later chunks for conflicting data', () => {
      const chunks: ChunkProcessingResult[] = [
        {
          chunkIndex: 0,
          pageRange: { from: 1, to: 4 },
          extractedData: {
            banco: 'Banco Santander',
            tinFijo: 3.0  // This should be overridden
          },
          bonificaciones: [],
          confidence: 0.8,
          processingTimeMs: 1000,
          retryCount: 0
        },
        {
          chunkIndex: 1,
          pageRange: { from: 5, to: 8 },
          extractedData: {
            tinFijo: 3.45  // This should win (later chunk)
          },
          bonificaciones: [],
          confidence: 0.9,
          processingTimeMs: 1000,
          retryCount: 0
        }
      ];

      const result = FeinNormalizer.aggregateChunks(chunks, 'test.pdf', 8);

      expect(result.prestamo.banco).toBe('Banco Santander'); // From first chunk
      expect(result.prestamo.tinFijo).toBe(3.45); // From second chunk (later)
    });
  });

  describe('compactResponse', () => {
    it('should not modify response under size limit', () => {
      const smallDraft = {
        metadata: {
          sourceFileName: 'test.pdf',
          pagesTotal: 5,
          pagesProcessed: 5,
          ocrProvider: 'google' as const,
          processedAt: '2024-01-01T00:00:00Z'
        },
        prestamo: {
          tipo: 'FIJO' as const,
          capitalInicial: 100000,
          banco: 'Test Bank'
        }
      };

      const result = FeinNormalizer.compactResponse(smallDraft);
      expect(result).toEqual(smallDraft);
    });

    it('should limit warnings to 3', () => {
      const draftWithManyWarnings = {
        metadata: {
          sourceFileName: 'test.pdf',
          pagesTotal: 5,
          pagesProcessed: 5,
          ocrProvider: 'google' as const,
          processedAt: '2024-01-01T00:00:00Z',
          warnings: ['Warning 1', 'Warning 2', 'Warning 3', 'Warning 4', 'Warning 5']
        },
        prestamo: {
          tipo: 'FIJO' as const
        }
      };

      const result = FeinNormalizer.compactResponse(draftWithManyWarnings);
      expect(result.metadata.warnings).toHaveLength(3);
    });
  });

  describe('Spanish number parsing', () => {
    it('should parse Spanish amounts correctly', () => {
      // These are private methods, testing via extractFromChunk
      const ocrText = 'Capital: 1.234.567,89 €';
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 1 });
      expect(result.capitalInicial).toBe(1234568); // Rounded
    });

    it('should parse Spanish percentages correctly', () => {
      const ocrText = 'TIN: 2,95% anual';
      const result = FeinNormalizer.extractFromChunk(ocrText, 0, { from: 1, to: 1 });
      expect(result.tinFijo).toBe(2.95);
    });
  });
});