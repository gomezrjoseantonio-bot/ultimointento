// Importar gastos de Excel/CSV · helpers de reconocimiento y parseo.
import {
  autoMapColumns,
  nReconocidas,
  parseImporteEs,
  periodicidadAMeses,
  etiquetaPeriodicidad,
} from '../importarGastos';

describe('autoMapColumns · reconoce columnas por encabezado', () => {
  it('mapea encabezados típicos', () => {
    const m = autoMapColumns(['Concepto', 'Proveedor', 'Importe', 'Periodicidad', 'Cuenta de cargo', 'CUPS']);
    expect(m.concepto).toBe('Concepto');
    expect(m.proveedor).toBe('Proveedor');
    expect(m.importe).toBe('Importe');
    expect(m.periodicidad).toBe('Periodicidad');
    expect(m.cuenta).toBe('Cuenta de cargo');
    expect(m.cups).toBe('CUPS');
    expect(nReconocidas(m)).toBe(6);
  });
  it('tolera acentos y mayúsculas', () => {
    const m = autoMapColumns(['DESCRIPCIÓN', 'compañía', 'cantidad (€)']);
    expect(m.concepto).toBe('DESCRIPCIÓN');
    expect(m.proveedor).toBe('compañía');
    expect(m.importe).toBe('cantidad (€)');
  });
});

describe('parseImporteEs · formato español', () => {
  it('coma decimal', () => expect(parseImporteEs('46,78')).toBeCloseTo(46.78));
  it('miles con punto', () => expect(parseImporteEs('1.234,56 €')).toBeCloseTo(1234.56));
  it('número directo', () => expect(parseImporteEs(47)).toBe(47));
  it('vacío → null', () => expect(parseImporteEs('')).toBeNull());
});

describe('periodicidadAMeses · texto → meses', () => {
  it('mensual = 12 meses', () => expect(periodicidadAMeses('Todos los meses')).toHaveLength(12));
  it('trimestral = 4', () => expect(periodicidadAMeses('Trimestral')).toHaveLength(4));
  it('anual = 1', () => expect(periodicidadAMeses('Una vez al año')).toHaveLength(1));
  it('vacío → mensual (12)', () => expect(periodicidadAMeses(undefined)).toHaveLength(12));
  it('etiqueta legible', () => {
    expect(etiquetaPeriodicidad(periodicidadAMeses('Trimestral'))).toBe('Trimestral');
    expect(etiquetaPeriodicidad(periodicidadAMeses('mensual'))).toBe('Todos los meses');
  });
});
