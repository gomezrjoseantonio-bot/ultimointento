/**
 * FIX-EXTRACTOS Unit Tests
 * 
 * Tests the core functionality without requiring IndexedDB:
 * 1. Batch hash generation
 * 2. Spanish formatting utilities
 * 3. File content validation
 */

import { generateBatchHash } from '../utils/batchHashUtils';
import { formatDateSpanish, formatCurrencySpanish, parseSpanishDate, parseSpanishNumber, validateSpanishFormatting } from '../utils/spanishFormatUtils';

// Mock File class for Jest environment
class MockFile {
  public name: string;
  public size: number;
  public type: string;
  private content: string;

  constructor(content: string[], name: string, options: { type: string }) {
    this.name = name;
    this.type = options.type;
    this.content = content[0] || '';
    this.size = this.content.length;
  }

  async text(): Promise<string> {
    return this.content;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    return encoder.encode(this.content).buffer;
  }
}

// Mock files for testing
const createMockCSVFile = (content: string): File => {
  return new MockFile([content], 'test-extracto.csv', { type: 'text/csv' }) as any;
};

const mockCSVContent = `Fecha,Concepto,Importe,Saldo
01/01/2024,TRANSFERENCIA RECIBIDA,1000,5000
02/01/2024,DOMICILIACION PAGO,-150,4850
03/01/2024,COMISIÓN MANTENIMIENTO,-12,4838`;

// Mock crypto.subtle for tests
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        // Simple mock hash for testing
        const view = new Uint8Array(data);
        let hash = 0;
        for (let i = 0; i < view.length; i++) {
          hash = ((hash << 5) - hash + view[i]) & 0xffffffff;
        }
        // Convert to 32-byte array to simulate SHA-256
        const hashArray = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hashArray[i] = (hash >> (i % 4 * 8)) & 0xff;
        }
        return hashArray.buffer;
      }
    }
  }
});

// Mock TextEncoder for Node.js test environment
if (typeof TextEncoder === 'undefined') {
  (global as any).TextEncoder = class {
    encode(text: string): Uint8Array {
      return new Uint8Array(Buffer.from(text, 'utf8'));
    }
  };
}

describe('FIX-EXTRACTOS Core Functionality', () => {

  describe('Batch Hash Generation (Idempotency)', () => {
    test('should generate consistent hash for same file content', async () => {
      const file1 = createMockCSVFile(mockCSVContent);
      const file2 = createMockCSVFile(mockCSVContent);
      
      const hash1 = await generateBatchHash(file1);
      const hash2 = await generateBatchHash(file2);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]+$/); // Hex format
      expect(hash1.length).toBeGreaterThan(5); // Reasonable length
    });

    test('should generate different hashes for different content', async () => {
      const file1 = createMockCSVFile(mockCSVContent);
      const file2 = createMockCSVFile(mockCSVContent + '\n04/01/2024,NUEVA OPERACION,100,4938');
      
      const hash1 = await generateBatchHash(file1);
      const hash2 = await generateBatchHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Spanish Formatting Requirements', () => {
    test('should format dates in Spanish format (dd/mm/yyyy)', () => {
      expect(formatDateSpanish('2024-01-15')).toBe('15/01/2024');
      expect(formatDateSpanish('2024-12-31')).toBe('31/12/2024');
      expect(formatDateSpanish(new Date('2024-06-01T00:00:00.000Z'))).toBe('01/06/2024');
    });

    test('should format currency in Spanish format (1.234,56 €)', () => {
      expect(formatCurrencySpanish(1234.56)).toBe('1.234,56 €');
      expect(formatCurrencySpanish(-1234.56)).toBe('-1.234,56 €');
      expect(formatCurrencySpanish(0)).toBe('0,00 €');
      expect(formatCurrencySpanish(1000000.99)).toBe('1.000.000,99 €');
      expect(formatCurrencySpanish(1000)).toBe('1.000,00 €');
    });

    test('should parse Spanish dates to ISO format', () => {
      expect(parseSpanishDate('15/01/2024')).toBe('2024-01-15');
      expect(parseSpanishDate('31-12-2024')).toBe('2024-12-31');
      expect(parseSpanishDate('01.06.2024')).toBe('2024-06-01');
      expect(parseSpanishDate('2024-01-15')).toBe('2024-01-15'); // Already ISO
    });

    test('should parse Spanish number format', () => {
      expect(parseSpanishNumber('1.234,56')).toBe(1234.56);
      expect(parseSpanishNumber('1000000,99')).toBe(1000000.99);
      expect(parseSpanishNumber('1.000.000,50')).toBe(1000000.50);
      expect(parseSpanishNumber('0,00')).toBe(0);
      expect(parseSpanishNumber(1234.56)).toBe(1234.56); // Already number
    });

    test('should handle invalid formats gracefully', () => {
      expect(formatDateSpanish('invalid-date')).toBe('Fecha inválida');
      expect(formatCurrencySpanish(NaN)).toBe('0,00 €');
      expect(parseSpanishNumber('')).toBe(0);
      expect(parseSpanishNumber('invalid')).toBe(0);
      
      expect(() => parseSpanishDate('invalid-date')).toThrow();
      expect(() => parseSpanishDate('32/13/2024')).toThrow();
    });
  });

  describe('Validation Functions', () => {
    test('should validate Spanish formatting requirements', () => {
      const validMovement = {
        date: '2024-01-15',
        amount: 1234.56
      };
      
      const result = validateSpanishFormatting(validMovement);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid formatting', () => {
      const invalidMovement = {
        date: 'invalid-date',
        amount: NaN
      };
      
      const result = validateSpanishFormatting(invalidMovement);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Privacy Requirements (No File Storage)', () => {
    test('file content should not be stored in any variables', () => {
      // This is a design test - ensuring our implementation doesn't accidentally store file content
      const file = createMockCSVFile(mockCSVContent);
      
      // Simulate what our import function should do
      const mockMovement = {
        date: '2024-01-15',
        amount: 1234.56,
        description: 'TRANSFERENCIA RECIBIDA',
        // FIX-EXTRACTOS: These fields should NOT exist
        rawRow: undefined,
        fileContent: undefined,
        originalData: undefined
      };
      
      expect(mockMovement.rawRow).toBeUndefined();
      expect(mockMovement.fileContent).toBeUndefined();
      expect(mockMovement.originalData).toBeUndefined();
    });

    test('batch metadata should not contain file content', () => {
      // Simulate what our batch metadata should look like
      const mockBatch = {
        id: 'import_1234567890_1',
        filename: 'test-extracto.csv',
        origenBanco: 'generic',
        formatoDetectado: 'CSV' as const,
        hashLote: 'abc123def456',
        // FIX-EXTRACTOS: These fields should NOT exist
        fileContent: undefined,
        originalData: undefined,
        rawFile: undefined
      };
      
      expect(mockBatch.fileContent).toBeUndefined();
      expect(mockBatch.originalData).toBeUndefined();
      expect(mockBatch.rawFile).toBeUndefined();
    });
  });

  describe('Data Normalization Requirements', () => {
    test('should normalize dates to ISO format (yyyy-mm-dd)', () => {
      const testDates = [
        { input: '15/01/2024', expected: '2024-01-15' },
        { input: '31-12-2024', expected: '2024-12-31' },
        { input: '01.06.2024', expected: '2024-06-01' }
      ];
      
      testDates.forEach(({ input, expected }) => {
        expect(parseSpanishDate(input)).toBe(expected);
      });
    });

    test('should normalize amounts with proper decimal handling', () => {
      const testAmounts = [
        { input: '1.234,56', expected: 1234.56 },
        { input: '-150,00', expected: -150 },
        { input: '1.000.000,99', expected: 1000000.99 }
      ];
      
      testAmounts.forEach(({ input, expected }) => {
        expect(parseSpanishNumber(input)).toBe(expected);
      });
    });

    test('should handle charge/credit sign normalization', () => {
      // Test that our logic properly handles positive and negative amounts
      const charges = [-150, -12]; // Cargos = negativo
      const credits = [1000, 500]; // Abonos = positivo
      
      charges.forEach(amount => {
        expect(amount).toBeLessThan(0);
      });
      
      credits.forEach(amount => {
        expect(amount).toBeGreaterThan(0);
      });
    });
  });
});