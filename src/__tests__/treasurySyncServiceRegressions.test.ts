import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.join(
  __dirname,
  '../modules/horizon/tesoreria/services/treasurySyncService.ts',
);
const source = fs.readFileSync(SERVICE_PATH, 'utf8');

describe('treasurySyncService – treasury detail regressions', () => {
  it('creates autónomo expenses as separated partidas instead of one aggregated event', () => {
    expect(source).toContain("sourceType: 'autonomo_gasto'");
    expect(source).toContain("sourceType: 'autonomo_cuota'");
    expect(source).not.toContain("sourceType: 'autonomo' as const");
  });

  it('resolves credit-card receipt bank account through resolveAccountId with numeric fallback', () => {
    expect(source).toContain('const resolvedAccountId = resolveAccountId(chargeAccountId) ?? account.id');
    expect(source).toContain('accountId: resolvedAccountId');
  });

  it('applies reglaPagoDia business-day logic for cuota de autónomos dates', () => {
    expect(source).toContain('function getBusinessDayForRule');
    expect(source).toContain("rule.tipo === 'ultimo-habil'");
    expect(source).toContain('getBusinessDayForRule(year, month, autonomoActivo.reglaPagoDia, 1)');
  });

  it('uses property literal helper prioritizing address street literal over alias', () => {
    expect(source).toContain('function getPropertyLiteral');
    expect(source).toContain('function getAddressStreetLiteral');
    expect(source).toContain(".split(',')[0]");
    expect(source).toContain(".replace(/^avda\\.?\\s+/i, 'Avenida ')");

    const propertyLiteralStart = source.indexOf('function getPropertyLiteral');
    const addressCheck = source.indexOf('const address = property.address?.trim();', propertyLiteralStart);
    const aliasCheck = source.indexOf('const alias = property.alias?.trim();', propertyLiteralStart);
    expect(addressCheck).toBeGreaterThan(-1);
    expect(aliasCheck).toBeGreaterThan(-1);
    expect(addressCheck).toBeLessThan(aliasCheck);
  });
});
