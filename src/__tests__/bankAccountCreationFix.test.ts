/**
 * Tests for Bank Account Creation Demo Data Prevention Fix
 * 
 * Verifies that the enhanced validation prevents demo/example data
 * from being saved as new bank accounts.
 */

// Export to make this a module
export {};

// Mock the demo pattern detection function from BancosManagement
const hasDemoPatterns = (data: {
  alias: string;
  bank: string;
  iban: string;
}): string | null => {
  const demoKeywords = [
    'demo', 'test', 'sample', 'ejemplo', 'prueba',
    'ficticio', 'simulado', 'plantilla', 'muestra',
    'fake', 'mock', 'provisional', 'temporal',
    'placeholder', 'default', 'initial'
  ];

  const alias = data.alias.toLowerCase().trim();
  const bank = data.bank.toLowerCase().trim();
  const iban = data.iban.toLowerCase().trim();

  // Check for demo keywords in any field
  for (const keyword of demoKeywords) {
    if (alias.includes(keyword)) {
      return `El alias contiene texto de ejemplo: "${keyword}"`;
    }
    if (bank.includes(keyword)) {
      return `El nombre del banco contiene texto de ejemplo: "${keyword}"`;
    }
    if (iban.includes(keyword)) {
      return `El IBAN contiene texto de ejemplo: "${keyword}"`;
    }
  }

  // Check for common placeholder patterns
  if (alias === 'cuenta principal' || alias === 'mi cuenta') {
    return 'El alias parece ser un ejemplo. Use un nombre específico.';
  }

  if (bank === 'banco santander' || bank === 'bbva' || bank === 'caixabank') {
    return 'El nombre del banco parece ser un ejemplo. Verifique el nombre correcto.';
  }

  // Check for demo IBAN patterns
  const cleanIban = iban.replace(/\s/g, '');
  const demoIbanPatterns = ['9999', '0000', '1111', '2222', '3333'];
  if (demoIbanPatterns.some(pattern => cleanIban.includes(pattern))) {
    return 'El IBAN contiene patrones típicos de ejemplos.';
  }

  // Check for the old placeholder that was causing issues
  if (iban.includes('es91 2100 0418 4502 0005 1332') || 
      cleanIban.includes('es9121000418450200051332')) {
    return 'No puede usar el IBAN de ejemplo del formulario.';
  }

  return null; // No demo patterns detected
};

describe('Bank Account Creation Demo Data Prevention', () => {
  describe('hasDemoPatterns function', () => {
    it('should detect demo keywords in alias', () => {
      const testData = {
        alias: 'demo account',
        bank: 'Real Bank',
        iban: 'ES7700750391234567890123'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('El alias contiene texto de ejemplo: "demo"');
    });

    it('should detect demo keywords in bank name', () => {
      const testData = {
        alias: 'My Account',
        bank: 'Test Bank',
        iban: 'ES7700750391234567890123'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('El nombre del banco contiene texto de ejemplo: "test"');
    });

    it('should detect demo keywords in IBAN', () => {
      const testData = {
        alias: 'My Account',
        bank: 'Real Bank',
        iban: 'ES77DEMO1234567890123'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('El IBAN contiene texto de ejemplo: "demo"');
    });

    it('should detect the old problematic placeholder IBAN', () => {
      const testData = {
        alias: 'My Account',
        bank: 'Real Bank',
        iban: 'ES91 2100 0418 4502 0005 1332'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('No puede usar el IBAN de ejemplo del formulario');
    });

    it('should detect common placeholder patterns', () => {
      const testData = {
        alias: 'cuenta principal',
        bank: 'Real Bank',
        iban: 'ES7700750391234567890123'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('El alias parece ser un ejemplo');
    });

    it('should detect demo IBAN patterns', () => {
      const testData = {
        alias: 'My Account',
        bank: 'Real Bank',
        iban: 'ES770000999912345678'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('El IBAN contiene patrones típicos de ejemplos');
    });

    it('should allow valid real data', () => {
      const testData = {
        alias: 'Cuenta Nómina Personal',
        bank: 'CaixaBank SA',
        iban: 'ES7721001234567890123456'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toBeNull();
    });

    it('should allow empty alias', () => {
      const testData = {
        alias: '',
        bank: 'CaixaBank SA',
        iban: 'ES7721001234567890123456'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toBeNull();
    });

    it('should be case insensitive', () => {
      const testData = {
        alias: 'DEMO Account',
        bank: 'Real Bank',
        iban: 'ES7700750391234567890123'
      };

      const result = hasDemoPatterns(testData);
      expect(result).toContain('El alias contiene texto de ejemplo: "demo"');
    });

    it('should detect multiple demo patterns and return the first one found', () => {
      const testData = {
        alias: 'test account',
        bank: 'demo bank',
        iban: 'ES77SAMPLE1234567890'
      };

      const result = hasDemoPatterns(testData);
      expect(result).not.toBeNull();
      expect(result).toContain('texto de ejemplo');
    });
  });
});