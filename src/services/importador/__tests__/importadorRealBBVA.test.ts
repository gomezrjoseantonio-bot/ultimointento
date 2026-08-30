// PUNTA A PUNTA sobre el importador que corre en la app.
//
// Entra por `BankParserService.parseSheet`, que es lo que ejecuta `processFile`
// tras leer el fichero, y comprueba a la salida las TRES cosas a la vez sobre la
// misma cuota real: importe, fecha e identificador.
//
// Antes esto se pedía «a mano en el preview». No vuelve a pasar: el preview
// arranca con la base vacía y validar allí obliga a rehacer el alta entera. Lo
// que hay que probar, se prueba en CI contra el módulo real.

import * as XLSX from 'xlsx';
import { BankParserService } from '../../../features/inbox/importers/bankParser';
import { isoDate } from '../../bankStatementOrchestrator';
import { hojaBBVA } from '../fixtures/extractoBBVA';

async function movimientosDelExtracto() {
  const hoja = XLSX.utils.aoa_to_sheet(hojaBBVA() as unknown[][]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Informe BBVA');
  const r = await new BankParserService().parseSheet(libro, 'Informe BBVA', XLSX);
  return r.movements ?? [];
}

describe('el importador real, con las filas reales del extracto de BBVA', () => {
  it('lee las cinco líneas', async () => {
    expect(await movimientosDelExtracto()).toHaveLength(5);
  });

  it('LA CUOTA DEL PRÉSTAMO · importe, fecha e identificador a la vez', async () => {
    const movs = await movimientosDelExtracto();
    const cuota = movs.find((m) => /amortizacion/i.test(m.description ?? ''));
    expect(cuota).toBeDefined();

    // 1 · el importe NO es -2854
    expect(cuota!.amount).toBeCloseTo(-285.4, 2);

    // 2 · la fecha es el 2 de febrero, no el 1
    expect(isoDate(cuota!.date)).toBe('2026-02-02');

    // 3 · el identificador llega
    expect(cuota!.reference).toContain('0182-5322-27-0830842450');
  });

  it('el recibo de Bankinter trae el nombre del prestamista', async () => {
    const movs = await movimientosDelExtracto();
    const b = movs.find((m) => /bankinter/i.test(m.description ?? ''));
    expect(b!.amount).toBeCloseTo(-351.43, 2);
    expect(b!.reference).toContain('BANKINTER CONSUMER FINANCE');
  });

  it('los importes de dos decimales y sin decimales siguen bien', async () => {
    const movs = await movimientosDelExtracto();
    expect(movs.find((m) => /tarjeta/i.test(m.description ?? ''))!.amount).toBeCloseTo(-25.17, 2);
    expect(movs.find((m) => /efectivo/i.test(m.description ?? ''))!.amount).toBeCloseTo(-190, 2);
  });

  it('un importe con separador de miles no se vuelve un decimal', async () => {
    const movs = await movimientosDelExtracto();
    expect(movs.find((m) => /Transferencia/i.test(m.description ?? ''))!.amount).toBeCloseTo(1234, 2);
  });

  it('ninguna fecha se va al día anterior', async () => {
    const movs = await movimientosDelExtracto();
    expect(isoDate(movs.find((m) => /efectivo/i.test(m.description ?? ''))!.date)).toBe('2026-01-30');
  });
});
