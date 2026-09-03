// E0 · la fecha de CARGO manda sobre la fecha valor al importar un extracto.
//
// Regla de la app: cuando el banco trae dos fechas, `Movement.date` es la de
// operación/cargo (la que fija el ejercicio, criterio de caja) y `valueDate` la
// fecha valor, que se conserva aparte. Un recibo con operación 02/01/2026 y
// valor 31/12/2025 es gasto de 2026.
//
// El bug: la cabecera real de Sabadell («F. Operativa») no casaba con ningún
// alias de `date`, el parser caía en `date := valueDate` sin avisar, y el
// mismo recibo iba a 2025. Estos tests fijan la regla con el fichero real de
// Sabadell del repo y con las cabeceras reales de Santander, Unicaja e ING.

import * as fs from 'fs';
import * as path from 'path';
import { BankParserService } from '../bankParser';
import { isoDate } from '../../../../services/bankStatementOrchestrator';
import { camposDeCierre } from '../../../../services/cierreLineaInmueble';

const parser = new BankParserService();
const svc = parser as any;

/** El día ISO de un `Date` local, como lo escribe el orchestrator en la base. */
const dia = (d: Date | undefined): string | null => (d ? isoDate(d) : null);

function detectarYParsear(rows: string[][]) {
  const header = svc.detectHeaders(rows);
  const movements = svc.parseMovements(rows, header.dataStartRow, header.detectedColumns);
  return { header, movements };
}

const FICHERO_SABADELL = path.resolve(__dirname, '../../../../../03092025_2706_0003239635 (1).xlsx');

describe('E0 · fecha de cargo en el importador', () => {
  describe('Sabadell · cabecera real «F. Operativa / F. Valor»', () => {
    it('mapea F. Operativa a date y F. Valor a valueDate (fichero real del repo)', async () => {
      const buffer = fs.readFileSync(FICHERO_SABADELL);
      const file = new File([buffer], path.basename(FICHERO_SABADELL), {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const result = await parser.parseFile(file);

      expect(result.success).toBe(true);
      expect(result.headerDetection?.detectedColumns.date).toBe(0);
      expect(result.headerDetection?.detectedColumns.valueDate).toBe(2);
      expect(result.headerDetection?.sinFechaDeCargo).toBeFalsy();
      expect(result.warnings ?? []).toEqual([]);

      // La cuota de préstamo real: operativa 29/08/2025 · valor 31/08/2025.
      const cuota = result.movements.find((m) => /PRESTAMOS ADEUDO CUOTA/.test(m.description));
      expect(cuota).toBeDefined();
      expect(dia(cuota!.date as Date)).toBe('2025-08-29');
      expect(dia(cuota!.valueDate as Date)).toBe('2025-08-31');
    });

    it('un recibo con operativa 02/01/2026 y valor 31/12/2025 cae en el ejercicio 2026', () => {
      // Misma disposición que el fichero real (metadatos antes de la cabecera).
      const rows = [
        ['Consulta de movimientos', '', '', '', '', '', ''],
        ['03/09/2025 0:45:21', '', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['Cuenta: ', 'ES47 0081 2706 1500 0323 9635', '', '', '', '', ''],
        ['Divisa: ', 'EUR', '', '', '', '', ''],
        ['', '', '', '', '', '', ''],
        ['F. Operativa', 'Concepto', 'F. Valor', 'Importe', 'Saldo', 'Referencia 1', 'Referencia 2'],
        ['02/01/2026', 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/12/25', '31/12/2025', '-304,26', '22618,25', '', ''],
      ];

      const { header, movements } = detectarYParsear(rows);

      expect(header.detectedColumns.date).toBe(0);
      expect(header.detectedColumns.valueDate).toBe(2);
      expect(movements).toHaveLength(1);

      const fecha = isoDate(movements[0].date)!;
      const fechaValor = isoDate(movements[0].valueDate)!;
      expect(fecha).toBe('2026-01-02');
      expect(fechaValor).toBe('2025-12-31');

      // Y el cierre de la línea de gasto fija el ejercicio por la fecha de cargo.
      const cierre = camposDeCierre({ id: 1, amount: -304.26, date: fecha, valueDate: fechaValor, accountId: 1 });
      expect(cierre.ejercicio).toBe(2026);
      expect(cierre.fecha).toBe('2026-01-02');
      expect(cierre.fechaValor).toBe('2025-12-31');
    });
  });

  describe('regresión · los bancos que ya funcionaban siguen usando la fecha de operación', () => {
    it('Santander · «FECHA OPERACIÓN / FECHA VALOR»', () => {
      const rows = [
        ['Movimientos', '', '', '', ''],
        ['', '', '', '', ''],
        ['FECHA OPERACIÓN', 'FECHA VALOR', 'CONCEPTO', 'IMPORTE EUR', 'SALDO'],
        ['02/01/2026', '31/12/2025', 'Liquidacion Periodica Prestamo 0049 0052 143 0004926', '-684,36', '52022,05'],
      ];
      const { header, movements } = detectarYParsear(rows);

      expect(header.detectedColumns.date).toBe(0);
      expect(header.detectedColumns.valueDate).toBe(1);
      expect(header.sinFechaDeCargo).toBeFalsy();
      expect(isoDate(movements[0].date)).toBe('2026-01-02');
      expect(isoDate(movements[0].valueDate)).toBe('2025-12-31');
      expect(camposDeCierre({ id: 1, amount: -684.36, date: '2026-01-02', valueDate: '2025-12-31' }).ejercicio).toBe(2026);
    });

    it('Unicaja · «Fecha de operación / Fecha valor»', () => {
      const rows = [
        ['Movimientos en cuenta', '', '', '', '', ''],
        ['Fecha de operación', 'Fecha valor', 'Concepto', 'Importe', 'Divisa', 'Saldo'],
        ['02/01/2026', '31/12/2025', 'FCC AQUALI447497 874010012213', '-58,61', 'EUR', '876,17'],
      ];
      const { header, movements } = detectarYParsear(rows);

      expect(header.detectedColumns.date).toBe(0);
      expect(header.detectedColumns.valueDate).toBe(1);
      expect(header.sinFechaDeCargo).toBeFalsy();
      expect(isoDate(movements[0].date)).toBe('2026-01-02');
      expect(isoDate(movements[0].valueDate)).toBe('2025-12-31');
    });
  });

  describe('ING · solo trae fecha valor', () => {
    const rows = [
      ['Movimientos de la Cuenta', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['F. VALOR', 'CATEGORÍA', 'SUBCATEGORÍA', 'DESCRIPCIÓN', 'COMENTARIO', 'IMAGEN', 'IMPORTE (€)', 'SALDO (€)'],
      ['31/12/2025', 'Hogar', 'Impuestos hogar', 'Recibo AJ. SANT FRUITOS DE BAGES', '', 'No', '-98,46', '803,46'],
    ];

    it('usa la fecha valor como fecha del movimiento, pero lo deja marcado', () => {
      const { header, movements } = detectarYParsear(rows);

      expect(header.detectedColumns.valueDate).toBe(0);
      expect(header.detectedColumns.date).toBe(0);
      expect(header.sinFechaDeCargo).toBe(true);
      expect(isoDate(movements[0].date)).toBe('2025-12-31');
      expect(isoDate(movements[0].valueDate)).toBe('2025-12-31');
    });

    it('parseFile avisa de que el extracto no trae fecha de cargo', async () => {
      const csv = rows.map((r) => r.join(';')).join('\n');
      const file = new File([csv], 'movements-ing.csv', { type: 'text/csv' });

      const result = await parser.parseFile(file);

      expect(result.success).toBe(true);
      expect(result.headerDetection?.sinFechaDeCargo).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings?.[0]).toMatch(/fecha valor/i);
      expect(result.warnings?.[0]).toMatch(/fecha de cargo|fecha de operaci/i);
    });
  });
});
