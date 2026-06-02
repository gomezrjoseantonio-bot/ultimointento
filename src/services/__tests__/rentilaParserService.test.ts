// Commit 3 · tests del parser Rentila (12 columnas reales).
import * as XLSX from 'xlsx';
import {
  parseRentilaXlsx,
  parseRentilaFiles,
  RentilaFormatError,
  toIsoDate,
} from '../rentilaParserService';

function makeXlsxFile(name: string, aoa: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return { name, arrayBuffer: async () => out } as unknown as File;
}

const HEADER_ES = [
  'ID', 'Propiedad', 'Tipo', 'Inicio de alquiler', 'Fin del alquiler',
  'Nombre o compañía', 'Alquiler', 'Alquiler', 'Gastos', 'IVA', 'Fianza', 'Otros gastos',
];

const HEADER_EN = [
  'ID', 'Property', 'Type', 'Start of rental', 'End of rental',
  'Name or company', 'Rent', 'Rent', 'Charges', 'VAT', 'Deposit', 'Other charges',
];

describe('parseRentilaXlsx', () => {
  it('parsea las 12 columnas y usa la col 7 (no la col 8 duplicada)', async () => {
    const file = makeXlsxFile('activos.xlsx', [
      HEADER_ES,
      ['', '5-TENDERINA, 64 4D -001 - 0654104TP7005S0009SS', 'Contrato de arrendamiento de vivienda',
        '01/01/2024', '31/12/2028', 'JORGE ANDERSON RIOS POSADA, SANDRA CHALARCA',
        330, 999, 10, '', 330, 0],
    ]);

    const rows = await parseRentilaXlsx(file);

    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.alquiler).toBe(330);   // col 7 · NO la col 8 (999)
    expect(r.gastos).toBe(10);
    expect(r.fianza).toBe(330);
    expect(r.inicioAlquiler).toBe('2024-01-01');
    expect(r.finAlquiler).toBe('2028-12-31');
    expect(r.inquilino).toBe('JORGE ANDERSON RIOS POSADA, SANDRA CHALARCA');
    expect(r.ficheroOrigen).toBe('activos.xlsx');
    expect(r.filaOriginal).toBe(2);
  });

  it('deja finAlquiler en null cuando la columna está vacía y conserva el IVA crudo', async () => {
    const file = makeXlsxFile('archivados.xlsx', [
      HEADER_ES,
      ['', '2-MANRESA', 'Contrato de arrendamiento de habitación', '15/03/2023', '',
        'IVAN DANIEL GOMEZ RAMIREZ', 430, 430, 0, '21%', 430, 0],
    ]);

    const rows = await parseRentilaXlsx(file);

    expect(rows[0].finAlquiler).toBeNull();
    expect(rows[0].iva).toBe('21%');
    expect(rows[0].inicioAlquiler).toBe('2023-03-15');
  });

  it('acepta el header en inglés', async () => {
    const file = makeXlsxFile('en.xlsx', [
      HEADER_EN,
      ['', 'CB Sant Fruitós', 'Room rental', '01/06/2024', '31/05/2025', 'ANA LOPEZ', 500, 500, 0, '', 500, 0],
    ]);

    const rows = await parseRentilaXlsx(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].propiedad).toBe('CB Sant Fruitós');
    expect(rows[0].alquiler).toBe(500);
  });

  it('salta filas totalmente vacías', async () => {
    const file = makeXlsxFile('huecos.xlsx', [
      HEADER_ES,
      ['', 'Piso A', 'Contrato de arrendamiento de vivienda', '01/01/2024', '31/12/2024', 'JUAN PEREZ', 600, 600, 0, '', 600, 0],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
    ]);

    const rows = await parseRentilaXlsx(file);
    expect(rows).toHaveLength(1);
  });

  it('lanza RentilaFormatError si el header no coincide', async () => {
    const file = makeXlsxFile('otro.xlsx', [
      ['Fecha', 'Cliente', 'Importe', 'Notas'],
      ['01/01/2024', 'Juan', 100, 'x'],
    ]);

    await expect(parseRentilaXlsx(file)).rejects.toBeInstanceOf(RentilaFormatError);
  });

  it('detecta el número correcto de filas en un fichero grande (60 contratos)', async () => {
    const data = Array.from({ length: 60 }, (_, i) => [
      '', `Inmueble ${i}`, 'Contrato de arrendamiento de vivienda',
      '01/01/2024', '31/12/2028', `INQUILINO ${i}`, 300 + i, 300 + i, 0, '', 300 + i, 0,
    ]);
    const file = makeXlsxFile('archivados-60.xlsx', [HEADER_ES, ...data]);

    const rows = await parseRentilaXlsx(file);
    expect(rows).toHaveLength(60);
  });
});

describe('parseRentilaFiles · multi-fichero', () => {
  it('concatena resultados conservando ficheroOrigen', async () => {
    const activos = makeXlsxFile('Rentila-activos.xlsx', [
      HEADER_ES,
      ['', 'Piso 1', 'Contrato de arrendamiento de vivienda', '01/01/2024', '31/12/2028', 'A', 100, 100, 0, '', 100, 0],
    ]);
    const archivados = makeXlsxFile('Rentila-archivados.xlsx', [
      HEADER_ES,
      ['', 'Piso 2', 'Contrato de arrendamiento de vivienda', '01/01/2020', '31/12/2022', 'B', 200, 200, 0, '', 200, 0],
      ['', 'Piso 3', 'Contrato de arrendamiento de vivienda', '01/01/2021', '31/12/2023', 'C', 300, 300, 0, '', 300, 0],
    ]);

    const rows = await parseRentilaFiles([activos, archivados]);

    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.ficheroOrigen === 'Rentila-activos.xlsx')).toHaveLength(1);
    expect(rows.filter((r) => r.ficheroOrigen === 'Rentila-archivados.xlsx')).toHaveLength(2);
  });
});

describe('toIsoDate', () => {
  it('normaliza DD/MM/YYYY', () => {
    expect(toIsoDate('05/09/2024')).toBe('2024-09-05');
  });
  it('acepta separadores . y -', () => {
    expect(toIsoDate('05.09.2024')).toBe('2024-09-05');
    expect(toIsoDate('05-09-2024')).toBe('2024-09-05');
  });
  it('devuelve cadena vacía para entradas vacías o inválidas', () => {
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate('no fecha')).toBe('');
  });
  it('conserva ISO ya normalizado', () => {
    expect(toIsoDate('2024-09-05')).toBe('2024-09-05');
  });
});
