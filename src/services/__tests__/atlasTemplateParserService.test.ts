// Commit 3 · tests del parser de la plantilla ATLAS (11 columnas).
import * as XLSX from 'xlsx';
import {
  parseAtlasTemplateXlsx,
  AtlasTemplateFormatError,
} from '../atlasTemplateParserService';

function makeXlsxFile(name: string, aoa: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return { name, arrayBuffer: async () => out } as unknown as File;
}

const HEADER = [
  'Inmueble (nombre o ref. catastral)', 'Habitación', 'Tipo de contrato',
  'Fecha inicio', 'Fecha fin', 'Inquilino nombre completo', 'DNI/NIF inquilino',
  'Email inquilino', 'Teléfono inquilino', 'Renta mensual €', 'Fianza €',
];

describe('parseAtlasTemplateXlsx', () => {
  it('parsea las 11 columnas a AtlasTemplateRow', async () => {
    const file = makeXlsxFile('plantilla.xlsx', [
      HEADER,
      ['CB Sant Fruitós', 'Hab 2', 'Vivienda LAU', '01/01/2024', '31/12/2028',
        'CONCEPCION RAMIREZ GUERERO', '53639208B', 'contacto@ejemplo.com', '+34 666 555 444', 330, 330],
    ]);

    const rows = await parseAtlasTemplateXlsx(file);

    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.inmuebleNombreOrRC).toBe('CB Sant Fruitós');
    expect(r.habitacion).toBe('Hab 2');
    expect(r.tipoContrato).toBe('Vivienda LAU');
    expect(r.fechaInicio).toBe('2024-01-01');
    expect(r.fechaFin).toBe('2028-12-31');
    expect(r.inquilinoNombre).toBe('CONCEPCION RAMIREZ GUERERO');
    expect(r.dni).toBe('53639208B');
    expect(r.email).toBe('contacto@ejemplo.com');
    expect(r.telefono).toBe('+34 666 555 444');
    expect(r.rentaMensual).toBe(330);
    expect(r.fianza).toBe(330);
    expect(r.filaOriginal).toBe(2);
  });

  it('deja en null los opcionales vacíos (habitación, fecha fin, dni, email, teléfono)', async () => {
    const file = makeXlsxFile('plantilla.xlsx', [
      HEADER,
      ['Piso Centro', '', 'Vivienda LAU', '01/01/2024', '', 'ANA GARCIA', '', '', '', 950, 0],
    ]);

    const rows = await parseAtlasTemplateXlsx(file);
    const r = rows[0];
    expect(r.habitacion).toBeNull();
    expect(r.fechaFin).toBeNull();
    expect(r.dni).toBeNull();
    expect(r.email).toBeNull();
    expect(r.telefono).toBeNull();
    expect(r.fianza).toBe(0);
  });

  it('parsea las 3 filas de ejemplo de la plantilla', async () => {
    const file = makeXlsxFile('plantilla.xlsx', [
      HEADER,
      ['CB Sant Fruitós', 'Hab 1', 'Habitación larga', '01/01/2024', '31/12/2025', 'INQUILINO UNO', '11111111H', '', '', 300, 300],
      ['RC 7949807TP6074N0006YM', '', 'Vivienda LAU', '01/02/2024', '', 'INQUILINO DOS', '', '', '', 600, 600],
      ['Piso Centro', '', 'Vacacional', '01/07/2024', '31/08/2024', 'INQUILINO TRES', '', '', '', 1200, 0],
    ]);

    const rows = await parseAtlasTemplateXlsx(file);
    expect(rows).toHaveLength(3);
  });

  it('lanza AtlasTemplateFormatError si el header no coincide', async () => {
    const file = makeXlsxFile('otro.xlsx', [
      ['Fecha', 'Cliente', 'Importe'],
      ['01/01/2024', 'Juan', 100],
    ]);

    await expect(parseAtlasTemplateXlsx(file)).rejects.toBeInstanceOf(AtlasTemplateFormatError);
  });
});
