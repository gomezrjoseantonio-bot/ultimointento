import { buildGastosVentaIndent } from '../ventaCalculoService';
import type { PropertySale } from '../../../../services/db';

const saleWith = (over: Partial<PropertySale> = {}): PropertySale =>
  ({
    id: 1,
    propertyId: 1,
    saleDate: '2026-03-15',
    salePrice: 130000,
    saleCosts: {
      agencyCommission: 7200,
      municipalTax: 1050,
      saleNotaryCosts: 0,
      otherCosts: 0,
    },
    loanSettlement: { payoffAmount: 84000, cancellationFee: 1303.97, total: 85303.97 },
    grossProceeds: 130000,
    netProceeds: 0,
    status: 'confirmed',
    ...over,
  }) as PropertySale;

const amount = (line: { amount: number | 'pendiente' }): number =>
  typeof line.amount === 'number' ? line.amount : 0;

describe('buildGastosVentaIndent · solo gastos inherentes a la transmisión', () => {
  it('NO incluye la cancelación de hipoteca (gasto financiero, no inherente a la transmisión)', () => {
    const lineas = buildGastosVentaIndent(saleWith(), true);
    expect(lineas.map((l) => l.text)).not.toContain('▸ Cancelación hipoteca');
    expect(lineas.some((l) => /cancelaci/i.test(l.text))).toBe(false);
    // Los 4 conceptos deducibles: notaría, plusvalía, agencia, otros.
    expect(lineas).toHaveLength(4);
  });

  it('el desglose cuadra con el subtotal deducible (agencia + plusvalía + notaría + otros)', () => {
    const sale = saleWith();
    const lineas = buildGastosVentaIndent(sale, true);
    const sumaDesglose = lineas.reduce((s, l) => s + amount(l), 0);
    const sc = sale.saleCosts;
    const subtotalDeducible =
      sc.agencyCommission + sc.municipalTax + sc.saleNotaryCosts + sc.otherCosts;
    expect(sumaDesglose).toBeCloseTo(subtotalDeducible, 2);
    // Y la comisión de cancelación NO se cuela en ese total.
    expect(sumaDesglose).toBeCloseTo(8250, 2);
    expect(sale.loanSettlement.cancellationFee).toBeGreaterThan(0);
  });

  it('sin gastos confirmados · todas las líneas quedan «pendiente»', () => {
    const lineas = buildGastosVentaIndent(saleWith(), false);
    expect(lineas.every((l) => l.amount === 'pendiente')).toBe(true);
  });
});
