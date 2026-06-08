// FIX P5 · tests del reconocedor de formato por cabecera.
import * as XLSX from 'xlsx';
import { detectarYParsearContrato } from '../contractImportDetectService';

function makeXlsxFile(name: string, aoa: unknown[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return { name, arrayBuffer: async () => out } as unknown as File;
}

const RENTILA_HEADER = [
  'ID', 'Propiedad', 'Tipo', 'Inicio de alquiler', 'Fin del alquiler',
  'Nombre o compañía', 'Alquiler', 'Alquiler', 'Gastos', 'IVA', 'Fianza', 'Otros gastos',
];
const ATLAS_HEADER = [
  'Inmueble (nombre o ref. catastral)', 'Habitación', 'Tipo de contrato',
  'Fecha inicio', 'Fecha fin', 'Inquilino nombre completo', 'DNI/NIF inquilino',
  'Email inquilino', 'Teléfono inquilino', 'Renta mensual €', 'Fianza €',
];

const rentilaFile = (name = 'rentila.xlsx') =>
  makeXlsxFile(name, [
    RENTILA_HEADER,
    ['', '1-ACEVEDO', 'Contrato de arrendamiento de vivienda', '01/01/2024', '31/12/2028', 'ANA GARCIA', 300, 300, 0, '', 300, 0],
  ]);
const atlasFile = (name = 'atlas.xlsx') =>
  makeXlsxFile(name, [
    ATLAS_HEADER,
    ['Piso Centro', '', 'Vivienda LAU', '01/01/2024', '', 'LUIS PEREZ', '', '', '', 950, 0],
  ]);

describe('detectarYParsearContrato', () => {
  it('reconoce un fichero Rentila por su cabecera y lo parsea', async () => {
    const res = await detectarYParsearContrato(rentilaFile());
    expect(res.formato).toBe('rentila');
    expect(res.contratos).toBe(1);
    expect(res.rentilaRows).toHaveLength(1);
    expect(res.error).toBeUndefined();
  });

  it('reconoce la plantilla ATLAS por su cabecera y la parsea', async () => {
    const res = await detectarYParsearContrato(atlasFile());
    expect(res.formato).toBe('plantilla_atlas');
    expect(res.contratos).toBe(1);
    expect(res.atlasRows).toHaveLength(1);
    expect(res.error).toBeUndefined();
  });

  it('un Excel cualquiera → desconocido con mensaje de incidencia (no lanza)', async () => {
    const otro = makeXlsxFile('otro.xlsx', [['Fecha', 'Cliente', 'Importe'], ['01/01/2024', 'Juan', 100]]);
    const res = await detectarYParsearContrato(otro);
    expect(res.formato).toBe('desconocido');
    expect(res.contratos).toBe(0);
    expect(res.error).toMatch(/no reconocido/i);
  });

  it('extensión no válida → desconocido sin intentar parsear', async () => {
    const pdf = { name: 'contrato.pdf', arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    const res = await detectarYParsearContrato(pdf);
    expect(res.formato).toBe('desconocido');
    expect(res.error).toMatch(/no válido/i);
  });

  it('lote mixto · cada fichero conserva su formato', async () => {
    const resultados = await Promise.all([
      detectarYParsearContrato(rentilaFile('r.xlsx')),
      detectarYParsearContrato(atlasFile('a.xlsx')),
    ]);
    expect(resultados.map((r) => r.formato)).toEqual(['rentila', 'plantilla_atlas']);
  });
});
