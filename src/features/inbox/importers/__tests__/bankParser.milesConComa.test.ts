// Los importes de 1.000 € o más desaparecían del extracto de Santander.
//
// El xls de Santander viene con configuración en-US: Excel formatea las celdas
// numéricas como "1,000.00", "-1,350.00", "78,500.00". El parser leía la hoja
// con `raw: false` (texto formateado) y el lector de números español tomaba la
// coma por decimal: seis dígitos detrás, "número inválido", y la FILA ENTERA se
// tiraba. Del fichero real de Jose (1.341 movimientos) se perdían 191: todas
// las nóminas, los alquileres, los traspasos de ahorro y la disposición del
// préstamo. Los importes menores de 1.000 no llevan coma y entraban bien, que
// es lo que hizo que pasara desapercibido.
//
// Dos candados: el parser lee el VALOR numérico de la celda cuando lo hay (sin
// pasar por ningún formato), y `parseEsNumber` entiende "1,000.00" para los
// CSV que lo traigan como texto.

import * as XLSX from 'xlsx';
import { BankParserService } from '../bankParser';
import { isoDate } from '../../../../services/bankStatementOrchestrator';

const parser = new BankParserService();
const svc = parser as any;

/** La disposición real del xls de Santander: 8 filas de cabecera y los datos. */
const FILAS_SANTANDER: unknown[][] = [
  ['', '', 'CUENTA SANTANDER', 'FECHA'],
  ['', '', 'ES61XXXX', '04/09/2026 | 23:48:15'],
  ['', '', 'Titular', 'Saldo'],
  ['', '', 'TITULAR', '2.635,40 EUR'],
  [],
  ['Movimientos'],
  [],
  ['FECHA OPERACIÓN', 'FECHA VALOR', 'CONCEPTO', 'IMPORTE EUR', 'SALDO'],
  ['02/09/2026', '02/09/2026', 'Bizum A Favor De Alguien', -10.2, 2635.4],
  ['01/09/2026', '31/08/2026', 'Transferencia Inmediata De Jose', 1000, 3594.12],
  ['01/09/2026', '01/09/2026', 'Liquidacion Periodica Prestamo', -993.43, 2253.67],
  ['31/08/2026', '31/08/2026', 'Transferencia A Favor De Casero Concepto: Alquiler', -1350, 1986.62],
  ['26/08/2026', '26/08/2026', 'Transferencia De Orange Espagne S.a., Concepto Sueldo', 3943.31, 5556.33],
  ['13/05/2026', '13/05/2026', 'Disposición Prestamo', 78500, 80000.5],
];

/** El libro como lo escribe Excel en-US: las celdas numéricas con formato de millar. */
function libroSantander(): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(FILAS_SANTANDER);
  for (let r = 8; r < FILAS_SANTANDER.length; r++) {
    for (const col of ['D', 'E']) {
      const celda = ws[`${col}${r + 1}`];
      if (celda) celda.z = '#,##0.00';
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  return wb;
}

describe('Santander · celdas numéricas formateadas con coma de millar (en-US)', () => {
  it('Excel las presenta como "1,000.00" · es la forma en que las leía el parser', () => {
    const wb = libroSantander();
    const texto = XLSX.utils.sheet_to_json(wb.Sheets.Movimientos, { header: 1, defval: '', raw: false }) as string[][];
    expect(texto[9][3]).toBe('1,000.00');
    expect(texto[11][3]).toBe('-1,350.00');
    expect(texto[13][3]).toBe('78,500.00');
    expect(texto[8][4]).toBe('2,635.40');
  });

  it('entran TODAS las filas · también las de 1.000 € o más', async () => {
    const r = await svc.parseSheet(libroSantander(), 'Movimientos', XLSX);
    expect(r.success).toBe(true);
    expect(r.movements).toHaveLength(6);
    expect(r.movements.map((m: any) => m.amount)).toEqual([-10.2, 1000, -993.43, -1350, 3943.31, 78500]);
    expect(r.movements.map((m: any) => isoDate(m.date))).toEqual([
      '2026-09-02', '2026-09-01', '2026-09-01', '2026-08-31', '2026-08-26', '2026-05-13',
    ]);
  });

  it('la columna SALDO también se lee · es el saldo real del banco tras cada línea', async () => {
    const r = await svc.parseSheet(libroSantander(), 'Movimientos', XLSX);
    expect(r.movements.map((m: any) => m.balance)).toEqual([2635.4, 3594.12, 2253.67, 1986.62, 5556.33, 80000.5]);
  });

  it('la suma de importes es la del fichero · no falta dinero', async () => {
    const r = await svc.parseSheet(libroSantander(), 'Movimientos', XLSX);
    const suma = r.movements.reduce((s: number, m: any) => s + m.amount, 0);
    expect(suma).toBeCloseTo(-10.2 + 1000 - 993.43 - 1350 + 3943.31 + 78500, 2);
  });

  it('el mapeo manual de columnas lee los mismos números', () => {
    const wb = libroSantander();
    const texto = XLSX.utils.sheet_to_json(wb.Sheets.Movimientos, { header: 1, defval: '', raw: false }) as string[][];
    const numeros = XLSX.utils.sheet_to_json(wb.Sheets.Movimientos, { header: 1, defval: '', raw: true }) as unknown[][];
    const movs = svc.parseMovements(texto, 8, { date: 0, valueDate: 1, description: 2, amount: 3, balance: 4 }, numeros);
    expect(movs.map((m: any) => m.amount)).toEqual([-10.2, 1000, -993.43, -1350, 3943.31, 78500]);
  });
});

describe('un CSV que trae el importe como texto en formato inglés', () => {
  it('"1,000.00" y "-1,350.00" son mil y menos mil trescientos cincuenta', () => {
    const rows = [
      ['FECHA OPERACIÓN', 'FECHA VALOR', 'CONCEPTO', 'IMPORTE EUR', 'SALDO'],
      ['01/09/2026', '31/08/2026', 'Transferencia', '1,000.00', '3,594.12'],
      ['31/08/2026', '31/08/2026', 'Alquiler', '-1,350.00', '1,986.62'],
      ['02/09/2026', '02/09/2026', 'Bizum', '-10.20', '2,635.40'],
    ];
    const header = svc.detectHeaders(rows);
    const movs = svc.parseMovements(rows, header.dataStartRow, header.detectedColumns);
    expect(movs.map((m: any) => m.amount)).toEqual([1000, -1350, -10.2]);
    expect(movs.map((m: any) => m.balance)).toEqual([3594.12, 1986.62, 2635.4]);
  });

  it('el formato español de siempre no cambia', () => {
    const rows = [
      ['FECHA OPERACIÓN', 'FECHA VALOR', 'CONCEPTO', 'IMPORTE EUR', 'SALDO'],
      ['02/01/2026', '31/12/2025', 'Prestamo', '-684,36', '52.022,05'],
      ['02/01/2026', '02/01/2026', 'Nomina', '3.943,31', '55.965,36'],
    ];
    const header = svc.detectHeaders(rows);
    const movs = svc.parseMovements(rows, header.dataStartRow, header.detectedColumns);
    expect(movs.map((m: any) => m.amount)).toEqual([-684.36, 3943.31]);
    expect(movs.map((m: any) => m.balance)).toEqual([52022.05, 55965.36]);
  });
});
