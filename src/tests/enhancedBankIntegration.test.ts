// Test Enhanced Bank Integration and IBAN Display
// Tests the improved bank logo integration and IBAN formatting

import { bankProfilesService } from '../services/bankProfilesService';

describe('Enhanced Bank Integration', () => {
  
  beforeAll(async () => {
    // Ensure bank profiles are loaded
    await bankProfilesService.loadProfiles();
  });

  describe('Bank Logo Integration', () => {
    it('should return bank logos for known banks', () => {
      const testBanks = [
        'CaixaBank',
        'Santander', 
        'BBVA',
        'Sabadell',
        'ING'
      ];

      testBanks.forEach(bankKey => {
        const logoUrl = bankProfilesService.getBankLogo(bankKey);
        expect(logoUrl).toBeDefined();
        expect(logoUrl).toContain(bankKey.toLowerCase());
        expect(logoUrl).toMatch(/\.(svg|png|jpg)$/);
      });
    });

    it('should return generic icon for unknown banks', () => {
      const logoUrl = bankProfilesService.getBankLogo('UnknownBank');
      expect(logoUrl).toBe('/assets/icons/bank-generic.svg');
    });

    it('should handle case-insensitive bank matching', () => {
      const logoUrl1 = bankProfilesService.getBankLogo('caixabank');
      const logoUrl2 = bankProfilesService.getBankLogo('CAIXABANK');
      const logoUrl3 = bankProfilesService.getBankLogo('CaixaBank');
      
      expect(logoUrl1).toBe(logoUrl2);
      expect(logoUrl2).toBe(logoUrl3);
    });
  });

  describe('Enhanced IBAN Formatting', () => {
    it('should format complete IBANs with bank information', () => {
      const testIban = 'ES1234567890123456789012';
      const result = bankProfilesService.formatIBANWithBankInfo(testIban);
      
      expect(result.iban).toBe('ES12 3456 7890 1234 5678 9012');
      expect(result.maskedIban).toBe('ES12 **** **** **** **** 9012');
      expect(result.logoUrl).toBeDefined();
      expect(result.logoUrl).toContain('.svg');
    });

    it('should handle IBANs from known Spanish banks', () => {
      // CaixaBank IBAN (bank code 2100)
      const caixaIban = 'ES1221001234567890123456';
      const result = bankProfilesService.formatIBANWithBankInfo(caixaIban);
      
      expect(result.bankKey).toBe('CaixaBank');
      expect(result.logoUrl).toContain('caixabank');
    });

    it('should provide bank information from IBAN', () => {
      const santanderIban = 'ES1200491234567890123456'; // Santander bank code 0049
      const bankInfo = bankProfilesService.getBankInfoFromIBAN(santanderIban);
      
      expect(bankInfo).toBeDefined();
      expect(bankInfo!.bankCode).toBe('0049');
      expect(bankInfo!.bankKey).toBe('Santander');
      expect(bankInfo!.logoUrl).toContain('santander');
    });

    it('should handle invalid or incomplete IBANs gracefully', () => {
      const invalidIbans = [
        '',
        'ES12',
        'FR1234567890123456789012', // Non-Spanish
        'INVALID'
      ];

      invalidIbans.forEach(iban => {
        const result = bankProfilesService.formatIBANWithBankInfo(iban);
        expect(result.iban).toBe(iban);
        expect(result.maskedIban).toBe(iban);
      });
    });
  });

  describe('Bank Display Names', () => {
    it('should return proper display names for banks', () => {
      const displayName = bankProfilesService.getBankDisplayName('CaixaBank');
      expect(displayName).toBeDefined();
      expect(displayName).toBe('CaixaBank');
    });

    it('should fallback to bank key for unknown banks', () => {
      const displayName = bankProfilesService.getBankDisplayName('UnknownBank');
      expect(displayName).toBe('UnknownBank');
    });
  });

  describe('Bank Code Mapping', () => {
    it('should correctly map Spanish bank codes to bank keys', () => {
      const bankCodes = {
        '2100': 'CaixaBank',
        '0049': 'Santander',
        '0182': 'BBVA',
        '0081': 'Sabadell',
        '1465': 'ING'
      };

      Object.entries(bankCodes).forEach(([code, expectedBank]) => {
        const testIban = `ES12${code}567890123456789012`;
        const bankInfo = bankProfilesService.getBankInfoFromIBAN(testIban);
        
        expect(bankInfo?.bankCode).toBe(code);
        expect(bankInfo?.bankKey).toBe(expectedBank);
      });
    });

    it('should handle unknown bank codes', () => {
      const unknownIban = 'ES1299991234567890123456'; // Unknown bank code 9999
      const bankInfo = bankProfilesService.getBankInfoFromIBAN(unknownIban);
      
      expect(bankInfo?.bankCode).toBe('9999');
      expect(bankInfo?.bankKey).toBeUndefined();
      expect(bankInfo?.logoUrl).toBe('/assets/icons/bank-generic.svg');
    });
  });
});