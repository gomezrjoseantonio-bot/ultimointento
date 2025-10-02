import { BankParserService } from '../bankParser';

describe('BankParserService detectHeaders', () => {
  it('keeps amount column on "Importe" when "Valor" header present', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha', 'Concepto', 'Importe', 'Valor'],
      ['01/01/2024', 'Pago tarjeta', '100,00', '02/01/2024']
    ];

    const result = (parser as any).detectHeaders(data);

    expect(result.detectedColumns.amount).toBe(2);
    expect(result.detectedColumns.valueDate).toBe(3);
    expect(result.fallbackRequired).toBe(false);
  });
});
