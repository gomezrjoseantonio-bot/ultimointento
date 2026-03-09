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

  it('does not downgrade importe amount mapping when movimiento column is present', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha', 'Movimiento', 'Cantidad', 'Importe'],
      ['01/01/2024', 'Ingreso nómina', '1.000,00', '2.000,00']
    ];

    const result = (parser as any).detectHeaders(data);

    expect(result.detectedColumns.amount).toBe(3);
  });

  it('falls back to valueDate when only "Fecha valor" is present', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha valor', 'Concepto', 'Importe'],
      ['02/01/2024', 'Transferencia recibida', '150,50']
    ];

    const headerResult = (parser as any).detectHeaders(data);

    expect(headerResult.detectedColumns.valueDate).toBe(0);
    expect(headerResult.detectedColumns.date).toBe(0);
    expect(headerResult.fallbackRequired).toBe(false);

    const movement = (parser as any).parseMovementRow(data[1], headerResult.detectedColumns);

    expect(movement).not.toBeNull();
    expect(movement?.date.toISOString()).toBe(new Date(2024, 0, 2).toISOString());
    expect(movement?.amount).toBe(150.5);
  });

  it('prefers explicit "Amount" header over currency codes', () => {
    const parser = new BankParserService();

    const data = [
      ['Fecha', 'EUR', 'Amount', 'Descripción'],
      ['03/02/2024', 'EUR', '123,45', 'Pago factura']
    ];

    const headerResult = (parser as any).detectHeaders(data);

    expect(headerResult.detectedColumns.amount).toBe(2);
    expect(headerResult.fallbackRequired).toBe(false);

    const movement = (parser as any).parseMovementRow(data[1], headerResult.detectedColumns);

    expect(movement).not.toBeNull();
    expect(movement?.amount).toBe(123.45);
    expect(movement?.description).toBe('Pago factura');
  });
});
