// El CSV de Revolut entraba con CERO movimientos.
//
// Revolut no escribe «Fecha» en ninguna cabecera: da DOS fechas, «Fecha de
// inicio» (cuando se hizo la compra) y «Fecha de finalización» (cuando la
// operación queda hecha y el saldo se mueve). Ningún alias casaba con ninguna
// de las dos, así que el detector no encontraba columna de fecha, daba el
// fichero por no reconocido y lo mandaba entero a mapeo manual. Del export real
// de Jose: 1.224 movimientos leídos, 0 importados. Entre ellos las 548 recargas
// de tarjeta, que son la otra pata de los cargos «Compra Revolut**0940*» de sus
// otros bancos.
//
// La fecha de cargo es la de FINALIZACIÓN: es la que mueve el saldo (la columna
// «Saldo» va en ese orden) y la que usa el propio Revolut para decidir qué
// entra en el extracto del periodo. La de inicio queda como fecha valor.

import * as XLSX from 'xlsx';
import { BankParserService } from '../bankParser';
import { isoDate } from '../../../../services/bankStatementOrchestrator';

const parser = new BankParserService();
const svc = parser as any;

/** El export real de Revolut en español, cabecera incluida. */
const CSV_REVOLUT = [
  'Tipo,Producto,Fecha de inicio,Fecha de finalización,Descripción,Importe,Comisión,Divisa,State,Saldo',
  'Pago con tarjeta,Actual,2024-12-30 23:57:25,2025-01-01 03:43:07,Botemania,-30.00,0.00,EUR,COMPLETADO,233.61',
  'Recargas,Actual,2025-01-04 09:12:00,2025-01-04 09:12:03,Recarga de *9623,35.00,0.00,EUR,COMPLETADO,268.61',
  'Transferir,Actual,2025-01-05 18:00:00,2025-01-05 18:00:04,To Jose Antonio Gomez Ramirez,-100.00,0.00,EUR,COMPLETADO,168.61',
].join('\n');

async function movimientos(csv: string) {
  const wb = svc.parseCSVEnhanced(csv, XLSX);
  const info = svc.getSheetInfo(wb, XLSX);
  const hoja = info.find((s: any) => s.hasData) ?? info[0];
  return parser.parseSheet(wb, hoja.name, XLSX);
}

describe('el CSV de Revolut', () => {
  it('se reconoce solo · ya no pide mapeo manual', async () => {
    const r = await movimientos(CSV_REVOLUT);

    expect(r.needsManualMapping).toBeFalsy();
    expect(r.movements).toHaveLength(3);
  });

  it('la fecha de cargo es la de FINALIZACIÓN, no la de inicio', async () => {
    const r = await movimientos(CSV_REVOLUT);

    // La compra se hizo el 30 de diciembre y quedó hecha el 1 de enero: es un
    // movimiento de 2025, que es como lo cuenta el propio Revolut.
    const [compra] = r.movements as any[];
    expect(isoDate(compra.date)).toBe('2025-01-01');
    expect(isoDate(compra.valueDate)).toBe('2024-12-30');
  });

  it('trae importe, saldo, descripción y el tipo como identificador', async () => {
    const r = await movimientos(CSV_REVOLUT);
    const [compra, recarga, transferencia] = r.movements as any[];

    expect(compra.amount).toBe(-30);
    expect(compra.description).toBe('Botemania');
    expect(compra.balance).toBe(233.61);
    // «Tipo» dice si fue recarga, pago con tarjeta o transferencia · es la
    // señal de método y de traspaso, y por eso va a la referencia.
    expect(compra.reference).toBe('Pago con tarjeta');

    // La recarga lleva los CUATRO ÚLTIMOS de la tarjeta con la que se recargó:
    // el mismo número que escribe el otro banco en su cargo.
    expect(recarga.amount).toBe(35);
    expect(recarga.description).toBe('Recarga de *9623');
    expect(recarga.reference).toBe('Recargas');

    expect(transferencia.amount).toBe(-100);
    expect(transferencia.reference).toBe('Transferir');
  });

  it('el export en inglés también · «Started Date» y «Completed Date»', async () => {
    const r = await movimientos(
      [
        'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
        'TOPUP,Current,2025-01-04 09:12:00,2025-01-04 09:12:03,Top-Up by *9623,35.00,0.00,EUR,COMPLETED,268.61',
      ].join('\n')
    );

    expect(r.movements).toHaveLength(1);
    expect(isoDate((r.movements as any[])[0].date)).toBe('2025-01-04');
  });
});
