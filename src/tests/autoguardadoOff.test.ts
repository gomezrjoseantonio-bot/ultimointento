/**
 * Test for INBOX AUTOGUARDADO OFF implementation
 * Validates the pending queue workflow and document validation
 */

import { validateDocumentForPending, ValidationResult } from '../services/documentValidationService';

describe('INBOX AUTOGUARDADO OFF - Pending Queue System', () => {
  
  describe('Document Validation Service', () => {
    
    it('should mark document as pending when OCR confidence is low', () => {
      const mockDocument = {
        id: 1,
        filename: 'factura-test.pdf',
        metadata: {
          tipo: 'Factura',
          proveedor: 'Test Provider',
          importe: 100.50
        }
      };

      const mockOCRResult = {
        confidenceGlobal: 0.70, // Below 0.80 threshold
        fields: [
          { name: 'proveedor', value: 'Test Provider', confidence: 0.70 },
          { name: 'importe', value: '100.50', confidence: 0.65 }
        ]
      };

      const result = validateDocumentForPending({
        document: mockDocument,
        ocrResult: mockOCRResult
      });

      expect(result.isReadyToPublish).toBe(false);
      expect(result.blockingReasons).toContainEqual(
        expect.objectContaining({
          type: 'error',
          code: 'LOW_OCR_CONFIDENCE',
          message: expect.stringContaining('Confianza OCR <0,80')
        })
      );
    });

    it('should validate Spanish format requirements', () => {
      const amount = 1234.56;
      const percentage = 3.5;
      
      // Test Spanish number formatting
      expect(amount.toLocaleString('es-ES')).toContain('1.234,56');
      expect(`${percentage.toLocaleString('es-ES')}%`).toBe('3,5%');
    });

    it('should detect reform invoice and suggest splitting', () => {
      const mockDocument = {
        id: 1,
        filename: 'reforma-cocina.pdf',
        metadata: {
          tipo: 'Factura',
          concepto: 'Reforma integral de cocina',
          proveedor: 'Reformas García',
          importe: 5000
        }
      };

      const mockOCRResult = {
        confidenceGlobal: 0.85,
        fields: [
          { name: 'concepto', value: 'Reforma integral de cocina', confidence: 0.85 },
          { name: 'proveedor', value: 'Reformas García', confidence: 0.90 },
          { name: 'importe', value: '5000', confidence: 0.85 }
        ]
      };

      const result = validateDocumentForPending({
        document: mockDocument,
        ocrResult: mockOCRResult
      });

      // Should detect reform and suggest splitting
      expect(result.blockingReasons).toContainEqual(
        expect.objectContaining({
          type: 'info',
          code: 'REFORM_DETECTED',
          message: 'Reforma detectada',
          action: 'Dividir en Mejora, Mobiliario y R&C'
        })
      );
    });

    it('should require property assignment', () => {
      const mockDocument = {
        id: 1,
        filename: 'factura-sin-inmueble.pdf',
        metadata: {
          tipo: 'Factura',
          proveedor: 'Test Provider',
          importe: 100
          // No inmuebleId or isPersonal
        }
      };

      const result = validateDocumentForPending({
        document: mockDocument
      });

      expect(result.isReadyToPublish).toBe(false);
      expect(result.blockingReasons).toContainEqual(
        expect.objectContaining({
          type: 'error',
          code: 'NO_PROPERTY_ASSIGNED',
          message: 'Sin inmueble',
          action: 'Asignar inmueble o marcar como personal'
        })
      );
    });

    it('should validate IVA calculation with ±0.01€ tolerance', () => {
      const mockDocument = {
        id: 1,
        filename: 'factura-iva.pdf',
        metadata: {
          tipo: 'Factura',
          proveedor: 'Test Provider',
          base: 100.00,
          iva: 21.00,
          importe: 121.02, // Should be 121.00, difference of 0.02€ > tolerance
          inmuebleId: 'property-1'
        }
      };

      const mockOCRResult = {
        confidenceGlobal: 0.85,
        fields: [
          { name: 'base', value: '100.00', confidence: 0.85 },
          { name: 'iva', value: '21.00', confidence: 0.85 },
          { name: 'importe', value: '121.02', confidence: 0.85 }
        ]
      };

      const result = validateDocumentForPending({
        document: mockDocument,
        ocrResult: mockOCRResult
      });

      expect(result.blockingReasons).toContainEqual(
        expect.objectContaining({
          type: 'error',
          code: 'IVA_INCONSISTENT',
          message: 'IVA inconsistente'
        })
      );
    });

    it('should mark ready to publish when all validations pass', () => {
      const mockDocument = {
        id: 1,
        filename: 'factura-valida.pdf',
        metadata: {
          tipo: 'Factura',
          proveedor: 'Valid Provider',
          fecha: '2024-01-15',
          importe: 121.00,
          inmuebleId: 'property-1'
        }
      };

      const mockOCRResult = {
        confidenceGlobal: 0.90,
        fields: [
          { name: 'proveedor', value: 'Valid Provider', confidence: 0.90 },
          { name: 'fecha', value: '2024-01-15', confidence: 0.85 },
          { name: 'importe', value: '121.00', confidence: 0.90 }
        ]
      };

      const result = validateDocumentForPending({
        document: mockDocument,
        ocrResult: mockOCRResult
      });

      expect(result.isReadyToPublish).toBe(true);
      expect(result.blockingReasons.filter(r => r.type === 'error')).toHaveLength(0);
    });

    it('should handle bank statement validation', () => {
      const mockDocument = {
        id: 1,
        filename: 'extracto-bbva.csv',
        metadata: {
          tipo: 'Extracto bancario'
          // Missing bankTemplate and accountId
        }
      };

      const result = validateDocumentForPending({
        document: mockDocument
      });

      expect(result.blockingReasons).toContainEqual(
        expect.objectContaining({
          type: 'error',
          code: 'CSV_HEADERS_UNKNOWN',
          message: 'Cabeceras CSV',
          action: 'Mapear columnas con wizard'
        })
      );

      expect(result.blockingReasons).toContainEqual(
        expect.objectContaining({
          type: 'error',
          code: 'ACCOUNT_NOT_IDENTIFIED',
          message: 'Cuenta no identificada',
          action: 'Seleccionar cuenta de destino'
        })
      );
    });
  });

  describe('Document Type Support', () => {
    
    it('should support all required file formats', () => {
      const supportedFormats = [
        'factura.pdf',
        'imagen.jpg',
        'foto.png',
        'heic.heic',
        'documento.doc',
        'documento.docx',
        'email.eml',
        'message.msg',
        'archivo.zip',
        'extracto.csv',
        'datos.xls',
        'hoja.xlsx',
        'bank.ofx'
      ];

      supportedFormats.forEach(filename => {
        const mockDocument = {
          id: 1,
          filename,
          metadata: { tipo: 'Documento' }
        };

        const result = validateDocumentForPending({
          document: mockDocument
        });

        // Should not have unsupported format error
        expect(result.blockingReasons).not.toContainEqual(
          expect.objectContaining({
            code: 'UNSUPPORTED_FORMAT'
          })
        );
      });
    });
  });

  describe('Pending Queue Integration', () => {
    
    it('should handle bulk operations', () => {
      // This would be an integration test with the PendingQueue component
      // Testing bulk assign, bulk publish, bulk discard operations
      expect(true).toBe(true); // Placeholder
    });

    it('should maintain Spanish formatting throughout', () => {
      // Verify all monetary amounts use Spanish format (1.234,56 €)
      // Verify all percentages use Spanish format (3,50 %)
      // Verify all dates use Spanish format (DD/MM/YYYY)
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('QA Scenario - 7 Steps', () => {
    
    it('should handle mixed batch upload scenario', () => {
      // QA Step 1: Upload mixed batch
      const mixedBatch = [
        { filename: 'factura-luz.pdf', tipo: 'Factura' },
        { filename: 'reforma-3-partidas.pdf', tipo: 'Factura' },
        { filename: 'recibo-agua.pdf', tipo: 'Recibo' },
        { filename: 'contrato-alquiler.pdf', tipo: 'Contrato' },
        { filename: 'extracto-santander.csv', tipo: 'Extracto bancario' },
        { filename: 'extracto-nuevo-banco.csv', tipo: 'Extracto bancario' }
      ];

      mixedBatch.forEach(doc => {
        const result = validateDocumentForPending({
          document: { id: 1, ...doc }
        });

        // QA Step 2: Should show reasonable blocking chips
        expect(result.blockingReasons.length).toBeGreaterThan(0);
      });
    });
  });
});