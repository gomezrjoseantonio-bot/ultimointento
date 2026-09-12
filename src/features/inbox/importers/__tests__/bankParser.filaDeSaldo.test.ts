// «Amortización total de préstamo» · −25.162,54 € que desaparecían del extracto.
//
// El parser descartaba toda fila cuyo texto llevara «total», «suma», «página»,
// «resumen»… buscadas en la fila ENTERA y sin límite de palabra. Servía para
// tirar los pies de página, pero se comía movimientos de verdad: en el extracto
// real de ING, la amortización total de un préstamo de 25.162,54 € se caía por
// llevar la palabra «total» dentro del concepto. Callando, como siempre.
//
// Adivinar por palabras sobraba: una fila sin fecha y sin importe no llega a
// ser un movimiento y se cae sola. Lo único que sí los trae y aun así no es un
// movimiento es la fila donde el banco REPITE el saldo, y esa sigue fuera.

import * as XLSX from 'xlsx';
import { BankParserService } from '../bankParser';

const parser = new BankParserService();

const CABECERA = ['FECHA OPERACIÓN', 'FECHA VALOR', 'CONCEPTO', 'IMPORTE EUR', 'SALDO'];

async function movimientos(filas: unknown[][]) {
  const ws = XLSX.utils.aoa_to_sheet([CABECERA, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  const r = await parser.parseSheet(wb, 'Movimientos', XLSX);
  return r.movements as Array<{ description: string; amount: number }>;
}

describe('una fila con «total» dentro del concepto es un movimiento', () => {
  it('la amortización total de un préstamo entra · antes se perdía entera', async () => {
    const movs = await movimientos([
      ['08/04/2026', '08/04/2026', 'Amortización total de préstamo', -25162.54, 354.21],
      ['08/04/2026', '08/04/2026', 'Transferencia recibida de UN TITULAR', 10000, 25516.75],
    ]);

    expect(movs.map((m) => m.description)).toContain('Amortización total de préstamo');
    expect(movs.find((m) => m.description.includes('Amortización'))?.amount).toBe(-25162.54);
    expect(movs).toHaveLength(2);
  });

  it('las otras palabras de la lista vieja tampoco se llevan un movimiento', async () => {
    const movs = await movimientos([
      ['01/09/2026', '01/09/2026', 'Recibo COMUNIDAD RESUMEN ANUAL', -120.5, 1000],
      ['02/09/2026', '02/09/2026', 'Pago en LA PAGINA WEB SL', -19.99, 980.01],
      ['03/09/2026', '03/09/2026', 'Transferencia De SUMA GESTION TRIBUTARIA', -45, 935.01],
      ['04/09/2026', '04/09/2026', 'Compra en HOJALATERIA GOMEZ', -60, 875.01],
    ]);

    expect(movs).toHaveLength(4);
  });
});

describe('la fila donde el banco repite el saldo sigue fuera', () => {
  it('«Saldo final» y «Saldo anterior» no se cuentan aunque traigan fecha e importe', async () => {
    const movs = await movimientos([
      ['01/09/2026', '01/09/2026', 'Saldo anterior', 1000, 1000],
      ['02/09/2026', '02/09/2026', 'Recibo IBERDROLA', -48, 952],
      ['12/09/2026', '12/09/2026', 'Saldo final', 952, 952],
    ]);

    expect(movs.map((m) => m.description)).toEqual(['Recibo IBERDROLA']);
  });

  it('«Saldo» dentro de un concepto de verdad no lo tira', async () => {
    const movs = await movimientos([
      ['02/09/2026', '02/09/2026', 'Transferencia De SALDOS Y RESTOS SL', 300, 1252],
    ]);

    expect(movs).toHaveLength(1);
  });
});
