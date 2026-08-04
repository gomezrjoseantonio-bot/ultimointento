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

  // Aquí se vigilaba el recibo de tarjeta y el reparto del periodo entre dos
  // meses. Vivían en la rama de gastos personales de este servicio, retirada el
  // 4 ago 2026 porque desde V62 recorría una lista vacía.
  //
  // La garantía no se pierde, y de hecho el camino vivo la resuelve mejor:
  // `recibosDeTarjetaPrevistos` recibe un RANGO en vez de ir mes a mes, así que
  // un periodo a caballo no puede partirse, y la identidad del recibo sigue
  // siendo (tarjeta · corte) sin el mes en que se calcula. Sus tests están en
  // `compromisosRecurrentesService.idempotencia.test.ts`.

  it('applies reglaPagoDia business-day logic for cuota de autónomos dates', () => {
    expect(serviceSource).toContain("const day = autonomoActivo.reglaPagoDia?.dia ?? 1;");
    expect(serviceSource).toContain("autonomoActivo.reglaPagoDia?.tipo === 'fijo'");
    expect(serviceSource).toContain('getBusinessDayForRule(year, month, autonomoActivo.reglaPagoDia, day)');
    expect(helperSource).toContain('export function getBusinessDayForRule');
    expect(helperSource).toContain("rule.tipo === 'ultimo-habil'");
  });
});
