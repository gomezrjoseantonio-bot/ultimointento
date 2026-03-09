import { 
  generateMovementHash, 
  detectDuplicates, 
  removeDuplicates, 
  getDuplicateStats 
} from './duplicateDetection';
import { ParsedMovement } from '../types/bankProfiles';

describe('Duplicate Detection Utilities', () => {
  
  describe('generateMovementHash', () => {
    test('should generate consistent hashes for identical movements', () => {
      const movement1: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'Transferencia bancaria'
      };
      
      const movement2: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'Transferencia bancaria'
      };
      
      const hash1 = generateMovementHash(movement1);
      const hash2 = generateMovementHash(movement2);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(hash1.length).toBe(16);
    });
    
    test('should generate different hashes for different movements', () => {
      const movement1: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'Transferencia bancaria'
      };
      
      const movement2: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 200.50, // Different amount
        description: 'Transferencia bancaria'
      };
      
      const hash1 = generateMovementHash(movement1);
      const hash2 = generateMovementHash(movement2);
      
      expect(hash1).not.toBe(hash2);
    });
    
    test('should normalize descriptions for consistent hashing', () => {
      const movement1: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'Transferencia Bancária'
      };
      
      const movement2: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'transferencia bancaria' // Different case, no accent
      };
      
      const hash1 = generateMovementHash(movement1);
      const hash2 = generateMovementHash(movement2);
      
      expect(hash1).toBe(hash2); // Should be the same after normalization
    });
    
    test('should handle punctuation normalization', () => {
      const movement1: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'Pago: Supermercado, S.L.'
      };
      
      const movement2: ParsedMovement = {
        date: new Date('2024-01-15'),
        amount: 100.50,
        description: 'Pago Supermercado S L' // No punctuation
      };
      
      const hash1 = generateMovementHash(movement1);
      const hash2 = generateMovementHash(movement2);
      
      expect(hash1).toBe(hash2); // Should be the same after normalization
    });
  });
  
  describe('detectDuplicates', () => {
    test('should detect duplicate movements', () => {
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria'
        },
        {
          date: new Date('2024-01-16'),
          amount: 200.00,
          description: 'Pago nómina'
        },
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria' // Duplicate
        }
      ];
      
      const result = detectDuplicates(movements);
      
      expect(result[0].isDuplicate).toBe(true);
      expect(result[1].isDuplicate).toBe(false);
      expect(result[2].isDuplicate).toBe(true);
      
      // Should have duplicate hashes
      expect(result[0].duplicateHash).toBe(result[2].duplicateHash);
      expect(result[1].duplicateHash).not.toBe(result[0].duplicateHash);
    });
    
    test('should handle no duplicates', () => {
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria'
        },
        {
          date: new Date('2024-01-16'),
          amount: 200.00,
          description: 'Pago nómina'
        }
      ];
      
      const result = detectDuplicates(movements);
      
      expect(result[0].isDuplicate).toBe(false);
      expect(result[1].isDuplicate).toBe(false);
    });
  });
  
  describe('removeDuplicates', () => {
    test('should remove duplicate movements keeping first occurrence', () => {
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria',
          originalRow: 1
        },
        {
          date: new Date('2024-01-16'),
          amount: 200.00,
          description: 'Pago nómina',
          originalRow: 2
        },
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria', // Duplicate
          originalRow: 3
        }
      ];
      
      const result = removeDuplicates(movements);
      
      expect(result).toHaveLength(2);
      expect(result[0].originalRow).toBe(1); // First occurrence kept
      expect(result[1].originalRow).toBe(2);
      // Third movement (duplicate) should be removed
    });
    
    test('should handle no duplicates', () => {
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria'
        },
        {
          date: new Date('2024-01-16'),
          amount: 200.00,
          description: 'Pago nómina'
        }
      ];
      
      const result = removeDuplicates(movements);
      
      expect(result).toHaveLength(2);
    });
  });
  
  describe('getDuplicateStats', () => {
    test('should provide accurate duplicate statistics', () => {
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria',
          isDuplicate: true,
          duplicateHash: 'hash1'
        },
        {
          date: new Date('2024-01-16'),
          amount: 200.00,
          description: 'Pago nómina',
          isDuplicate: false,
          duplicateHash: 'hash2'
        },
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria',
          isDuplicate: true,
          duplicateHash: 'hash1' // Same hash as first
        },
        {
          date: new Date('2024-01-17'),
          amount: 300.00,
          description: 'Otro pago',
          isDuplicate: true,
          duplicateHash: 'hash3'
        },
        {
          date: new Date('2024-01-17'),
          amount: 300.00,
          description: 'Otro pago',
          isDuplicate: true,
          duplicateHash: 'hash3' // Same hash as previous
        }
      ];
      
      const stats = getDuplicateStats(movements);
      
      expect(stats.total).toBe(5);
      expect(stats.duplicates).toBe(4); // 4 movements marked as duplicates
      expect(stats.unique).toBe(1); // 1 unique movement
      expect(stats.duplicateGroups).toBe(2); // 2 groups of duplicates
    });
    
    test('should handle no duplicates', () => {
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 100.50,
          description: 'Transferencia bancaria'
        },
        {
          date: new Date('2024-01-16'),
          amount: 200.00,
          description: 'Pago nómina'
        }
      ];
      
      const stats = getDuplicateStats(movements);
      
      expect(stats.total).toBe(2);
      expect(stats.duplicates).toBe(0);
      expect(stats.unique).toBe(2);
      expect(stats.duplicateGroups).toBe(0);
    });
  });
  
  describe('QA Tests - Requirements Compliance', () => {
    test('QA: Should detect duplicates according to requirements (date + amount + description)', () => {
      // Test case from requirements: duplicate detection by hash
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-01-15'),
          amount: 1234.56,
          description: 'Transferencia SEPA: BANCO SANTANDER, S.A.'
        },
        {
          date: new Date('2024-01-16'),
          amount: 500.00,
          description: 'Pago tarjeta 1234'
        },
        {
          date: new Date('2024-01-15'),
          amount: 1234.56,
          description: 'Transferencia SEPA: BANCO SANTANDER, S A' // Same semantically
        }
      ];
      
      const withDuplicates = detectDuplicates(movements);
      const withoutDuplicates = removeDuplicates(movements);
      
      expect(withDuplicates[0].isDuplicate).toBe(true);
      expect(withDuplicates[2].isDuplicate).toBe(true);
      expect(withoutDuplicates).toHaveLength(2); // Duplicates removed
    });
    
    test('QA: Should handle Spanish bank statement variations', () => {
      // Real-world variations that should be considered duplicates
      const movements: ParsedMovement[] = [
        {
          date: new Date('2024-03-15'),
          amount: 1500.00,
          description: 'NÓMINA EMPRESA, S.L. - MARZO 2024'
        },
        {
          date: new Date('2024-03-15'),
          amount: 1500.00,
          description: 'Nómina Empresa, S L - Marzo 2024' // Same content, different format
        }
      ];
      
      const hash1 = generateMovementHash(movements[0]);
      const hash2 = generateMovementHash(movements[1]);
      
      expect(hash1).toBe(hash2); // Should be detected as duplicates
      
      const withDuplicates = detectDuplicates(movements);
      expect(withDuplicates[0].isDuplicate).toBe(true);
      expect(withDuplicates[1].isDuplicate).toBe(true);
    });
  });
});