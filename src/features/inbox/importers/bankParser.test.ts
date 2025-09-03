import { BankParserService } from './bankParser';
import { BankProfile, ParsedMovement } from '../../../types/bankProfiles';

// Mock XLSX for testing
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
    decode_range: jest.fn(() => ({ e: { r: 10 } }))
  }
}));

// Mock services
jest.mock('../../../services/bankProfilesService', () => ({
  bankProfilesService: {
    loadProfiles: jest.fn(),
    detectBank: jest.fn(),
    mapHeaders: jest.fn(),
    getGenericProfile: jest.fn()
  }
}));

jest.mock('../../../services/telemetryService', () => ({
  telemetry: {
    bankParseStart: jest.fn(() => 'test-operation-id'),
    bankParseComplete: jest.fn(),
    manualMappingStart: jest.fn(() => 'test-mapping-id'),
    manualMappingComplete: jest.fn(),
    measurePerformance: jest.fn()
  },
  qaChecklist: {
    bankParsing: {
      fileSupport: jest.fn(),
      headerDetection: jest.fn(),
      spanishNormalization: jest.fn(),
      fallbackMapping: jest.fn()
    }
  }
}));

describe('BankParserService', () => {
  let parser: BankParserService;

  beforeEach(() => {
    parser = new BankParserService();
    jest.clearAllMocks();
  });

  describe('Header Detection', () => {
    test('should detect standard bank headers', () => {
      const testData = [
        ['Extracto bancario', '', ''],
        ['Fecha', 'Concepto', 'Importe', 'Saldo'],
        ['01/01/2024', 'Transferencia', '100,50', '1.500,75']
      ];

      const result = (parser as any).detectHeaders(testData);
      
      expect(result.headerRow).toBe(1);
      expect(result.dataStartRow).toBe(2);
      expect(result.fallbackRequired).toBe(false);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should detect cargo/abono columns', () => {
      const testData = [
        ['', '', '', ''],
        ['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo'],
        ['01/01/2024', 'Transferencia', '', '100,50', '1.500,75']
      ];

      const result = (parser as any).detectHeaders(testData);
      
      expect(result.headerRow).toBe(1);
      expect(result.detectedColumns.cargo).toBe(2);
      expect(result.detectedColumns.abono).toBe(3);
      expect(result.fallbackRequired).toBe(false);
    });

    test('should require fallback when no headers detected', () => {
      const testData = [
        ['Random', 'Data', 'Here'],
        ['More', 'Random', 'Stuff'],
        ['No', 'Bank', 'Headers']
      ];

      const result = (parser as any).detectHeaders(testData);
      
      expect(result.fallbackRequired).toBe(true);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Movement Parsing', () => {
    test('should parse single amount column correctly', () => {
      const rowData = ['01/01/2024', 'Transferencia', '100,50', '1.500,75'];
      const columns = {
        date: 0,
        description: 1,
        amount: 2,
        balance: 3
      };

      const result = (parser as any).parseMovementRow(rowData, columns);

      expect(result).not.toBeNull();
      expect(result!.date).toBeInstanceOf(Date);
      expect(result!.amount).toBe(100.50);
      expect(result!.description).toBe('Transferencia');
      expect(result!.balance).toBe(1500.75);
    });

    test('should parse cargo/abono columns correctly (abono - cargo)', () => {
      const rowData = ['01/01/2024', 'Transferencia', '50,25', '150,75', '1.500,75'];
      const columns = {
        date: 0,
        description: 1,
        cargo: 2,
        abono: 3,
        balance: 4
      };

      const result = (parser as any).parseMovementRow(rowData, columns);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(100.50); // 150.75 - 50.25
      expect(result!.description).toBe('Transferencia');
    });

    test('should handle cargo only (debit transaction)', () => {
      const rowData = ['01/01/2024', 'Pago', '75,25', '', '1.425,50'];
      const columns = {
        date: 0,
        description: 1,
        cargo: 2,
        abono: 3,
        balance: 4
      };

      const result = (parser as any).parseMovementRow(rowData, columns);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(-75.25); // 0 - 75.25
    });

    test('should handle abono only (credit transaction)', () => {
      const rowData = ['01/01/2024', 'Ingreso', '', '200,00', '1.700,00'];
      const columns = {
        date: 0,
        description: 1,
        cargo: 2,
        abono: 3,
        balance: 4
      };

      const result = (parser as any).parseMovementRow(rowData, columns);

      expect(result).not.toBeNull();
      expect(result!.amount).toBe(200.00); // 200 - 0
    });

    test('should return null for invalid date', () => {
      const rowData = ['invalid-date', 'Transferencia', '100,50'];
      const columns = {
        date: 0,
        description: 1,
        amount: 2
      };

      const result = (parser as any).parseMovementRow(rowData, columns);
      expect(result).toBeNull();
    });

    test('should return null for missing amount columns', () => {
      const rowData = ['01/01/2024', 'Transferencia'];
      const columns = {
        date: 0,
        description: 1
        // No amount, cargo, or abono columns
      };

      const result = (parser as any).parseMovementRow(rowData, columns);
      expect(result).toBeNull();
    });
  });

  describe('Spanish Date Parsing', () => {
    test('should parse dd/mm/yyyy format', () => {
      const result = (parser as any).parseSpanishDate('15/03/2024');
      
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Date);
      expect(result!.getDate()).toBe(15);
      expect(result!.getMonth()).toBe(2); // March is month 2 (0-indexed)
      expect(result!.getFullYear()).toBe(2024);
    });

    test('should parse dd-mm-yyyy format', () => {
      const result = (parser as any).parseSpanishDate('25-12-2023');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(25);
      expect(result.getMonth()).toBe(11); // December is month 11
      expect(result.getFullYear()).toBe(2023);
    });

    test('should return null for invalid date format', () => {
      const result = (parser as any).parseSpanishDate('invalid-date');
      expect(result).toBeNull();
    });
  });

  describe('Spanish Amount Parsing', () => {
    test('should parse Spanish number format (1.234,56)', () => {
      const result = (parser as any).parseSpanishAmount('1.234,56');
      expect(result).toBe(1234.56);
    });

    test('should parse negative amounts', () => {
      const result = (parser as any).parseSpanishAmount('-250,75');
      expect(result).toBe(-250.75);
    });

    test('should parse parentheses as negative', () => {
      const result = (parser as any).parseSpanishAmount('(123,45)');
      expect(result).toBe(-123.45);
    });

    test('should handle currency symbols', () => {
      const result = (parser as any).parseSpanishAmount('€150,25');
      expect(result).toBe(150.25);
    });
  });

  describe('Junk Row Detection', () => {
    test('should detect total rows as junk', () => {
      const rowData = ['Total', '', '5.000,00'];
      const result = (parser as any).isJunkRow(rowData);
      expect(result).toBe(true);
    });

    test('should detect saldo rows as junk', () => {
      const rowData = ['Saldo inicial', '', '1.000,00'];
      const result = (parser as any).isJunkRow(rowData);
      expect(result).toBe(true);
    });

    test('should not detect valid movement as junk', () => {
      const rowData = ['01/01/2024', 'Transferencia', '100,50'];
      const result = (parser as any).isJunkRow(rowData);
      expect(result).toBe(false);
    });

    test('should detect empty rows as junk', () => {
      const rowData = ['', '', ''];
      const result = (parser as any).isJunkRow(rowData);
      expect(result).toBe(true);
    });
  });

  describe('File Type Detection', () => {
    test('should detect CSV files', () => {
      const file = new File([''], 'bank-statement.csv', { type: 'text/csv' });
      const result = (parser as any).detectFileType(file);
      expect(result).toBe('csv');
    });

    test('should detect XLSX files', () => {
      const file = new File([''], 'bank-statement.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const result = (parser as any).detectFileType(file);
      expect(result).toBe('xlsx');
    });

    test('should detect XLS files', () => {
      const file = new File([''], 'bank-statement.xls', { 
        type: 'application/vnd.ms-excel' 
      });
      const result = (parser as any).detectFileType(file);
      expect(result).toBe('xls');
    });

    test('should default to xlsx for unknown types', () => {
      const file = new File([''], 'bank-statement.unknown', { type: 'unknown' });
      const result = (parser as any).detectFileType(file);
      expect(result).toBe('xlsx');
    });
  });
});

describe('Bank-Specific QA Tests', () => {
  let parser: BankParserService;

  beforeEach(() => {
    parser = new BankParserService();
  });

  describe('ABANCA Parser QA', () => {
    test('should parse ABANCA CSV format correctly', () => {
      const testData = [
        ['Fecha', 'Concepto', 'Cargo', 'Abono', 'Saldo', 'Divisa'],
        ['15/01/2024', 'Transferencia recibida', '', '500,00', '2.500,00', 'EUR'],
        ['16/01/2024', 'Pago domiciliado', '75,50', '', '2.424,50', 'EUR']
      ];

      const columns = {
        date: 0,
        description: 1,
        cargo: 2,
        abono: 3,
        balance: 4,
        currency: 5
      };

      const movements = (parser as any).parseMovements(testData, 1, columns);
      
      expect(movements).toHaveLength(2);
      expect(movements[0].amount).toBe(500.00);
      expect(movements[1].amount).toBe(-75.50);
      expect(movements[0].description).toBe('Transferencia recibida');
    });
  });

  describe('BBVA Parser QA', () => {
    test('should handle BBVA XLSX with cover page detection', () => {
      const testData = [
        ['BBVA Logo', '', '', ''],
        ['Extracto de cuenta', '', '', ''],
        ['', '', '', ''],
        ['Fecha operación', 'Fecha valor', 'Concepto', 'Importe', 'Saldo'],
        ['20/01/2024', '20/01/2024', 'Nómina', '1.500,00', '3.924,50']
      ];

      const result = (parser as any).detectHeaders(testData);
      expect(result.headerRow).toBe(3); // Should skip logo and title rows
      expect(result.detectedColumns.date).toBeDefined();
      expect(result.detectedColumns.valueDate).toBeDefined(); // "Fecha valor" should be detected
      expect(result.detectedColumns.description).toBeDefined();
      expect(result.detectedColumns.amount).toBeDefined();
    });
  });

  describe('Revolut Parser QA', () => {
    test('should parse Revolut CSV format with English headers', () => {
      const testData = [
        ['Completed Date', 'Description', 'Paid Out', 'Paid In', 'Balance', 'Currency'],
        ['2024-01-15', 'Card Payment', '25.50', '', '974.50', 'EUR'],
        ['2024-01-16', 'Top Up', '', '100.00', '1074.50', 'EUR']
      ];

      const columns = {
        date: 0,
        description: 1,
        cargo: 2,
        abono: 3,
        balance: 4,
        currency: 5
      };

      const movements = (parser as any).parseMovements(testData, 1, columns);
      
      expect(movements).toHaveLength(2);
      expect(movements[0].amount).toBe(-25.50); // Paid out
      expect(movements[1].amount).toBe(100.00); // Paid in
    });
  });

  describe('CaixaBank Parser QA', () => {
    test('should handle CaixaBank cargo/abono format', () => {
      const testData = [
        ['Fecha operación', 'Fecha valor', 'Concepto', 'Cargo', 'Abono', 'Saldo'],
        ['22/01/2024', '22/01/2024', 'Transferencia enviada', '800,00', '', '1.624,50'],
        ['23/01/2024', '23/01/2024', 'Ingreso efectivo', '', '300,00', '1.924,50']
      ];

      const columns = {
        date: 0,
        valueDate: 1,
        description: 2,
        cargo: 3,
        abono: 4,
        balance: 5
      };

      const movements = (parser as any).parseMovements(testData, 1, columns);
      
      expect(movements).toHaveLength(2);
      expect(movements[0].amount).toBe(-800.00); // Cargo (debit)
      expect(movements[1].amount).toBe(300.00); // Abono (credit)
    });
  });
});