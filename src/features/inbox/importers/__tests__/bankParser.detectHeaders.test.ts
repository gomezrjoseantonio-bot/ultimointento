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

  it('uses valueDate column as fallback when date header missing', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha valor', 'Concepto', 'Importe'],
      ['01/02/2024', 'Ingreso transferencia', '123,45']
    ];

    const headerDetection = (parser as any).detectHeaders(data);
    const movements = (parser as any).parseMovements(
      data,
      headerDetection.dataStartRow,
      headerDetection.detectedColumns
    );

    expect(headerDetection.detectedColumns.valueDate).toBe(0);
    expect(headerDetection.detectedColumns.date).toBe(0);
    expect(headerDetection.fallbackRequired).toBe(false);
    expect(movements).toHaveLength(1);
    expect(movements[0].date).toBeInstanceOf(Date);
    expect(movements[0].amount).toBeCloseTo(123.45);
  });
});
