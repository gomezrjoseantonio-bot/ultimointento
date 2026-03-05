import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.join(
  __dirname,
  '../modules/horizon/tesoreria/services/treasurySyncService.ts',
);
const HELPERS_PATH = path.join(
  __dirname,
  '../modules/horizon/tesoreria/services/treasurySyncHelpers.ts',
);
const serviceSource = fs.readFileSync(SERVICE_PATH, 'utf8');
const helperSource = fs.readFileSync(HELPERS_PATH, 'utf8');

describe('treasurySyncService – treasury detail regressions', () => {
  it('creates autónomo expenses as separated partidas instead of one aggregated event', () => {
    expect(serviceSource).toContain("sourceType: 'autonomo_gasto'");
    expect(serviceSource).toContain("sourceType: 'autonomo_cuota'");
    expect(serviceSource).not.toContain("sourceType: 'autonomo' as const");
  });

  it('resolves credit-card receipt bank account through resolveAccountId with numeric fallback', () => {
    expect(serviceSource).toContain('const resolvedAccountId = resolveAccountId(chargeAccountId) ?? account.id');
    expect(serviceSource).toContain('accountId: resolvedAccountId');
  });

  it('applies reglaPagoDia business-day logic for cuota de autónomos dates', () => {
    expect(serviceSource).toContain("const day = autonomoActivo.reglaPagoDia?.dia ?? 1;");
    expect(serviceSource).toContain("autonomoActivo.reglaPagoDia?.tipo === 'fijo'");
    expect(serviceSource).toContain('getBusinessDayForRule(year, month, autonomoActivo.reglaPagoDia, day)');
    expect(helperSource).toContain('export function getBusinessDayForRule');
    expect(helperSource).toContain("rule.tipo === 'ultimo-habil'");
  });

  it('uses property literal helper prioritizing address street literal over alias', () => {
    expect(serviceSource).toContain('getPropertyLiteral(inm)');
    expect(helperSource).toContain('export function getPropertyLiteral');
    expect(helperSource).toContain('export function getAddressStreetLiteral');
    expect(helperSource).toContain(".split(',')[0]");
    expect(helperSource).toContain(".replace(/^avda\\.?\\s+/i, 'Avenida ')");

    const propertyLiteralStart = helperSource.indexOf('export function getPropertyLiteral');
    const addressCheck = helperSource.indexOf('const address = property.address?.trim();', propertyLiteralStart);
    const aliasCheck = helperSource.indexOf('const alias = property.alias?.trim();', propertyLiteralStart);
    expect(addressCheck).toBeGreaterThan(-1);
    expect(aliasCheck).toBeGreaterThan(-1);
    expect(addressCheck).toBeLessThan(aliasCheck);
  });
});
