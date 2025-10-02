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

  it('prefers higher priority amount alias over later matches', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha', 'Cantidad', 'Importe', 'Concepto'],
      ['01/01/2024', '100,00', '200,00', 'Ingreso']
    ];

    const result = (parser as any).detectHeaders(data);

    expect(result.detectedColumns.amount).toBe(2);
  });

  it('maps movimiento to description and saldo movimiento to balance', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha', 'Movimiento', 'Importe', 'Saldo movimiento'],
      ['01/01/2024', 'Ingreso nómina', '1.000,00', '5.000,00']
    ];

    const result = (parser as any).detectHeaders(data);

    expect(result.detectedColumns.amount).toBe(2);
    expect(result.detectedColumns.balance).toBe(3);
    expect(result.detectedColumns.description).toBe(1);
  });
});
