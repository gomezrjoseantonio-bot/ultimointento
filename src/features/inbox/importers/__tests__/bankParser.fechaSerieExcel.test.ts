// ING y Unicaja: la mitad de los movimientos desaparecía y la otra mitad
// entraba con el día y el mes cambiados.
//
// Los dos bancos guardan la fecha como SERIE de Excel (46276 = 11 de
// septiembre de 2026) con formato `m/d/yy`. El parser leía la hoja con
// `raw: false` —texto ya formateado— y recibía "9/11/26", que el lector
// español entiende como el 9 de NOVIEMBRE. Y del día 13 en adelante no hay mes
// que valga ("9/25/26"): la fecha no parseaba y la FILA ENTERA se tiraba sin
// avisar. En los ficheros reales de Jose eso se llevaba 362 movimientos de 672
// y dejaba el saldo de esas dos cuentas imposible de cuadrar contra el banco.
//
// El candado: la fecha se lee del VALOR de la celda (la serie, que no es
// ambigua), igual que ya se hacía con los importes; el texto formateado solo se
// usa cuando no hay número (CSV, celdas de texto).

import * as XLSX from 'xlsx';
import { BankParserService } from '../bankParser';
import { isoDate } from '../../../../services/bankStatementOrchestrator';

const parser = new BankParserService();
const svc = parser as any;

/** 1899-12-30 + n días · la serie que escriben ING y Unicaja. */
const SERIE_11_SEP = 46276; // 2026-09-11 · día > 12: la fila se perdía entera
const SERIE_2_SEP = 46267; // 2026-09-02 · día <= 12: entraba como 9 de febrero

/** La disposición real del xls de ING: 3 filas de cabecera y solo fecha valor. */
const FILAS_ING: unknown[][] = [
  ['Movimientos de la Cuenta', '', '  Número de cuenta:', '1465 0100 9917 13720331'],
  ['', '', '  Titular:', 'TITULAR DE PRUEBA'],
  ['', '', '  Fecha exportación:', '12/09/2026 21:34h'],
  ['F. VALOR', 'CATEGORÍA', 'SUBCATEGORÍA', 'DESCRIPCIÓN', 'COMENTARIO', 'IMPORTE (€)', 'SALDO (€)'],
  [SERIE_11_SEP, 'Hogar', 'Hipoteca', 'Cargo cuota de Hipoteca ING Direct', '', -329.97, 115.19],
  [SERIE_2_SEP, 'Hogar', 'Impuestos hogar', 'Recibo AJ. SANT FRUITOS DE BAGES', '', -100.92, 14.27],
];

/** El libro tal cual lo escribe el banco: la serie con formato de fecha en-US. */
function libroING(): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(FILAS_ING);
  for (let r = 4; r < FILAS_ING.length; r++) {
    const celda = ws[`A${r + 1}`];
    if (celda) {
      celda.t = 'n';
      celda.z = 'm/d/yy';
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  return wb;
}

describe('la fecha como serie de Excel · ING y Unicaja', () => {
  it('Excel la presenta como "9/11/26" · es la forma en que la leía el parser', () => {
    const ws = libroING().Sheets.Movimientos;
    const texto = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as string[][];
    // Mes primero: el 11 de septiembre escrito a la americana.
    expect(texto[4][0]).toBe('9/11/26');
    // Y el 2 de septiembre, que sí parseaba... pero como 9 de febrero.
    expect(texto[5][0]).toBe('9/2/26');
  });

  it('el parser la lee del valor de la celda · 11 de septiembre, no 9 de noviembre', async () => {
    const r = await parser.parseSheet(libroING(), 'Movimientos', XLSX);

    // Las DOS filas entran · antes la del día 11 se caía por «no hay mes 25».
    expect(r.movements).toHaveLength(2);
    expect(r.movements.map((m: any) => isoDate(m.date))).toEqual(['2026-09-11', '2026-09-02']);
    expect(r.movements.map((m: any) => m.amount)).toEqual([-329.97, -100.92]);
  });
});

/** Unicaja: DOS columnas de fecha (operación y valor), las dos como serie. */
const FILAS_UNICAJA: unknown[][] = [
  ['Movimientos en cuenta'],
  ['Número de cuenta:', '', 'ES60 2103 7003 5200 3008 4437'],
  [],
  ['Fecha de operación', 'Fecha valor', 'Concepto', 'Importe', 'Divisa', 'Saldo'],
  [SERIE_11_SEP, SERIE_11_SEP, 'Simyo     633782 822070552003', -40.99, 'EUR', 1293.22],
  [SERIE_2_SEP, SERIE_2_SEP, 'AYUNTAMIEN123456 001056800700', -63.4, 'EUR', 1334.21],
];

describe('Unicaja · las dos columnas de fecha son serie', () => {
  it('fecha de operación y fecha valor salen las dos en septiembre', async () => {
    const ws = XLSX.utils.aoa_to_sheet(FILAS_UNICAJA);
    for (let r = 4; r < FILAS_UNICAJA.length; r++) {
      for (const col of ['A', 'B']) {
        const celda = ws[`${col}${r + 1}`];
        if (celda) {
          celda.t = 'n';
          celda.z = 'm/d/yy';
        }
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

    const r = await parser.parseSheet(wb, 'Movimientos', XLSX);
    expect(r.movements).toHaveLength(2);
    expect(r.movements.map((m: any) => isoDate(m.date))).toEqual(['2026-09-11', '2026-09-02']);
    expect(r.movements.map((m: any) => isoDate(m.valueDate))).toEqual(['2026-09-11', '2026-09-02']);
  });
});

describe('lo que NO puede romper este arreglo', () => {
  it('una fecha en TEXTO sigue leyéndose como dd/mm/yyyy · Santander, Sabadell, BBVA', () => {
    // 09/11/2026 en un extracto español es el 9 de NOVIEMBRE, y así se queda:
    // no hay número en la celda, así que no hay serie que interpretar.
    expect(isoDate(svc.parseSpanishDate('09/11/2026'))).toBe('2026-11-09');
    expect(isoDate(svc.parseSpanishDate('25/12/2025'))).toBe('2025-12-25');
  });

  it('un número que no puede ser una fecha no se toma por una', () => {
    // Fuera de 1970-2100 no es una serie · no se inventa una fecha.
    expect(svc.fechaDeSerieExcel(1)).toBeNull();
    expect(svc.fechaDeSerieExcel(99999)).toBeNull();
    expect(isoDate(svc.fechaDeSerieExcel(SERIE_11_SEP))).toBe('2026-09-11');
  });
});
