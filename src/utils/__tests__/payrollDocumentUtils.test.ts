import { detectPayrollMetadata, isPayrollFileName, __internal } from '../payrollDocumentUtils';

describe('payrollDocumentUtils', () => {
  describe('isPayrollFileName', () => {
    it('detects spanish payroll keywords', () => {
      expect(isPayrollFileName('Nomina_Marzo_2024.pdf')).toBe(true);
      expect(isPayrollFileName('recibo_nominal.pdf')).toBe(false);
    });

    it('detects english payroll keywords', () => {
      expect(isPayrollFileName('Acme-Payslip-July.pdf')).toBe(true);
      expect(isPayrollFileName('salary_statement_august.xlsx')).toBe(true);
    });
  });

  describe('detectPayrollMetadata', () => {
    it('returns detailed metadata for spanish month filenames', () => {
      const result = detectPayrollMetadata('Nomina_Marzo_2024.pdf', Date.UTC(2024, 3, 15));
      expect(result).not.toBeNull();
      expect(result?.confidence).toBeGreaterThan(0.9);
      expect(result?.metadata.categoria).toBe('Nómina');
      expect(result?.metadata.tags).toEqual(expect.arrayContaining(['Nómina', 'Marzo', '2024']));
      expect(result?.metadata.financialData?.servicePeriod).toEqual({
        from: '2024-03-01',
        to: '2024-03-31'
      });
      expect(result?.metadata.financialData?.issueDate).toBe('2024-03-31');
    });

    it('falls back to lastModified year when not present in filename', () => {
      const result = detectPayrollMetadata('Acme-Payslip-July.pdf', Date.UTC(2023, 7, 1));
      expect(result).not.toBeNull();
      expect(result?.metadata.tags).toEqual(expect.arrayContaining(['Nómina', 'Julio', '2023']));
      expect(result?.metadata.financialData?.servicePeriod).toEqual({
        from: '2023-07-01',
        to: '2023-07-31'
      });
    });

    it('supports numeric month references', () => {
      const result = detectPayrollMetadata('nomina_11-2022.pdf', Date.UTC(2022, 10, 20));
      expect(result).not.toBeNull();
      const sanitized = __internal.sanitizeFileName('nomina_11-2022.pdf');
      expect(sanitized).toBe('nomina 11 2022');
      expect(__internal.NUMERIC_MONTH_PATTERN.test(sanitized)).toBe(true);
      expect(__internal.findMonthInfo(sanitized)?.label).toBe('Noviembre');
      expect(result?.metadata.tags).toEqual(expect.arrayContaining(['Nómina', 'Noviembre', '2022']));
      expect(result?.metadata.financialData?.servicePeriod).toEqual({
        from: '2022-11-01',
        to: '2022-11-30'
      });
    });

    it('returns base metadata when month cannot be detected', () => {
      const result = detectPayrollMetadata('nomina_empresa.pdf', Date.UTC(2024, 0, 10));
      expect(result).not.toBeNull();
      expect(result?.confidence).toBeCloseTo(0.85);
      expect(result?.metadata.tags).toEqual(['Nómina']);
      expect(result?.metadata.financialData?.servicePeriod).toBeUndefined();
    });
  });
});
