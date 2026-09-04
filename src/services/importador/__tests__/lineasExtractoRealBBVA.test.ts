// E1.1 · la línea de extracto persistida, sobre las filas REALES de BBVA.
//
// Lo que se prueba: que `conceptoLiteral` es el texto del fichero CARÁCTER A
// CARÁCTER. No «parecido», no «normalizado»: igual. El dedupe entre
// importaciones (`hashMovement`) depende de ese texto, y el hash de la línea de
// la sesión (`hashLinea`) también. Un `trim` de más aquí duplicaría cargos al
// reimportar un extracto solapado.
//
// Entra por el parser real (SheetJS + `BankParserService.parseSheet`, lo mismo
// que ejecuta `processFile`) y sale por `lineaDesdeFila`, que es lo que el
// orquestador persiste. Sin base de datos: la función es pura.

import * as XLSX from 'xlsx';
import { BankParserService } from '../../../features/inbox/importers/bankParser';
import { hashMovement, isoDate } from '../../bankStatementOrchestrator';
import { lineaDesdeFila } from '../../lineasExtractoService';
import { generateLineHash } from '../../../utils/batchHashUtils';
import { FILAS_BBVA, CABECERAS_BBVA, hojaBBVA } from '../fixtures/extractoBBVA';
import type { Movement } from '../../db';

const COL_CONCEPTO = CABECERAS_BBVA.indexOf('Concepto');

async function movimientosDelExtracto() {
  const hoja = XLSX.utils.aoa_to_sheet(hojaBBVA() as unknown[][]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Informe BBVA');
  const r = await new BankParserService().parseSheet(libro, 'Informe BBVA', XLSX);
  return r.movements ?? [];
}

function lineaDe(row: Awaited<ReturnType<typeof movimientosDelExtracto>>[number], movementId: number) {
  const fecha = isoDate(row.date) ?? '';
  const importe = typeof row.amount === 'number' ? row.amount : Number(row.amount);
  return lineaDesdeFila(row, {
    accountId: 7,
    importBatchId: 'import_test',
    fechaOperacion: fecha,
    fechaValor: isoDate(row.valueDate) ?? fecha,
    importe,
    hashMovement: hashMovement({ accountId: 7, date: fecha, amount: importe, description: row.description ?? '' } as Movement),
    movementIds: [movementId],
    ahora: '2026-09-04T00:00:00.000Z',
  });
}

describe('E1.1 · lineasExtracto · sobre el extracto real de BBVA', () => {
  it('conceptoLiteral es la celda «Concepto» del fichero, carácter a carácter', async () => {
    const movs = await movimientosDelExtracto();
    expect(movs).toHaveLength(FILAS_BBVA.length);

    // El parser conserva el orden del fichero; se casa cada línea con su fila
    // por el importe, que en esta fixture es único por fila.
    for (const fila of FILAS_BBVA) {
      const importeFila = fila[CABECERAS_BBVA.indexOf('Importe')] as number;
      const row = movs.find((m) => Math.abs(m.amount - importeFila) < 0.005);
      expect(row).toBeDefined();
      const linea = lineaDe(row!, 1);
      const concepto = String(fila[COL_CONCEPTO]);
      expect(linea.conceptoLiteral).toBe(concepto);
      expect(Array.from(linea.conceptoLiteral)).toEqual(Array.from(concepto));
    }
  });

  it('las huellas son las del orquestador y las de la sesión, no otras', async () => {
    const movs = await movimientosDelExtracto();
    const cuota = movs.find((m) => /amortizacion/i.test(m.description ?? ''))!;
    const linea = lineaDe(cuota, 11);

    expect(linea.fechaOperacion).toBe('2026-02-02');
    expect(linea.importe).toBeCloseTo(-285.4, 2);
    expect(linea.referencia).toContain('0182-5322-27-0830842450');
    expect(linea.movementIds).toEqual([11]);
    expect(linea.estado).toBe('resuelta');

    // hashLinea · los MISMOS tres datos que `extractoSesion.construirLineas`.
    expect(linea.hashLinea).toBe(
      generateLineHash({ date: '2026-02-02', amount: cuota.amount, description: cuota.description })
    );
    // hashMovement · la que deduplica entre importaciones.
    expect(linea.hashMovement).toBe(
      hashMovement({ accountId: 7, date: '2026-02-02', amount: cuota.amount, description: cuota.description } as Movement)
    );
  });

  it('no recorta ni normaliza: los espacios de los extremos sobreviven', () => {
    const row = {
      date: new Date(2026, 1, 2),
      amount: -1,
      description: '  Cargo   con  espacios  ',
    };
    const linea = lineaDesdeFila(row, {
      accountId: 7,
      importBatchId: 'import_test',
      fechaOperacion: '2026-02-02',
      fechaValor: '2026-02-02',
      importe: -1,
      hashMovement: 'x',
      movementIds: [],
      descarte: 'duplicada',
      ahora: '2026-09-04T00:00:00.000Z',
    });
    expect(linea.conceptoLiteral).toBe('  Cargo   con  espacios  ');
    expect(linea.estado).toBe('sin_procesar');
    expect(linea.descarte).toBe('duplicada');
    expect(linea.movementIds).toEqual([]);
  });
});
