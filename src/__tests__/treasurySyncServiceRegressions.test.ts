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

  // VOCABULARIO §3.4 · el recibo de tarjeta cambió de sitio: ya no se acumula
  // por mes natural contra una cuenta de tipo tarjeta, sino por PERIODO contra
  // la cuenta donde la tarjeta está domiciliada. Lo que se sigue vigilando es
  // lo mismo: que el cargo caiga en la cuenta bancaria, resuelta y con
  // respaldo numérico.
  it('resolves credit-card receipt bank account through resolveAccountId with numeric fallback', () => {
    expect(serviceSource).toContain(
      'resolveAccountId(recibo.cuentaLiquidacionId) ?? recibo.cuentaLiquidacionId'
    );
    expect(serviceSource).toContain("sourceType: 'tarjeta_recibo' as const");
  });

  // Un periodo no cabe en un mes natural: un corte el 24 recoge lo gastado
  // desde el 25 del mes anterior. El bootstrap sincroniza mes a mes, así que si
  // el recibo se calculara solo con las compras del mes en curso, la segunda
  // pasada pisaría el importe de la primera y se perdería media factura.
  it('computes a card receipt from the two months that feed its period', () => {
    expect(serviceSource).toContain('const mesAnterior = month === 1 ? 12 : month - 1');
    expect(serviceSource).toContain('soloParaElRecibo: true');
    // Cada corte tiene UN mes dueño · sin esto, dos meses emitirían el mismo.
    expect(serviceSource).toContain(
      'recibos.filter((r) => r.fechaCorte.startsWith(monthPrefix))'
    );
    // Recalcular no es volver a nacer.
    expect(serviceSource).toContain('createdAt: yaEsta.createdAt ?? event.createdAt');
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
