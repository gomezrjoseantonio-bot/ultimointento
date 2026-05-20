// src/components/valoraciones/__tests__/importParsers.test.ts
// T-VALORACIONES PR3 (review Copilot) · cobertura de las funciones puras
// de parsing/normalización del wizard.

import {
  normalizeFecha,
  normalizeValor,
  detectColumns,
  detectDelimiter,
  parseRow,
} from '../importParsers';

describe('normalizeFecha', () => {
  it('YYYY-MM-DD pasa intacto', () => {
    expect(normalizeFecha('2024-06-15')).toBe('2024-06-15');
  });

  it('YYYY-MM completa con día 01', () => {
    expect(normalizeFecha('2024-06')).toBe('2024-06-01');
  });

  it('YYYY/MM completa con día 01', () => {
    expect(normalizeFecha('2024/06')).toBe('2024-06-01');
  });

  it('DD/MM/YYYY se convierte a YYYY-MM-DD', () => {
    expect(normalizeFecha('15/06/2024')).toBe('2024-06-15');
  });

  it('DD-MM-YYYY se convierte a YYYY-MM-DD', () => {
    expect(normalizeFecha('15-06-2024')).toBe('2024-06-15');
  });

  it('D/M/YYYY (1 dígito) se rellena con 0', () => {
    expect(normalizeFecha('5/6/2024')).toBe('2024-06-05');
  });

  it('Date object se convierte', () => {
    expect(normalizeFecha(new Date(2024, 5, 15))).toBe('2024-06-15');
  });

  it('Excel serial number se convierte', () => {
    // 45474 = 2024-07-15 en formato Excel (1900 base · días desde 1900-01-01)
    const result = normalizeFecha(45474);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cadena vacía devuelve ""', () => {
    expect(normalizeFecha('')).toBe('');
    expect(normalizeFecha('   ')).toBe('');
  });

  it('null/undefined devuelve ""', () => {
    expect(normalizeFecha(null)).toBe('');
    expect(normalizeFecha(undefined)).toBe('');
  });

  it('texto que no es fecha devuelve ""', () => {
    expect(normalizeFecha('no-es-fecha')).toBe('');
    expect(normalizeFecha('abc')).toBe('');
  });
});

describe('normalizeValor', () => {
  it('number pasa intacto', () => {
    expect(normalizeValor(1234.56)).toBe(1234.56);
    expect(normalizeValor(0)).toBe(0);
    expect(normalizeValor(-100)).toBe(-100);
  });

  it('cadena con número simple', () => {
    expect(normalizeValor('1234')).toBe(1234);
    expect(normalizeValor('1234.56')).toBe(1234.56);
  });

  it('formato europeo "1.234,56" → 1234.56', () => {
    expect(normalizeValor('1.234,56')).toBe(1234.56);
  });

  it('formato europeo con millones "1.234.567,89" → 1234567.89', () => {
    expect(normalizeValor('1.234.567,89')).toBe(1234567.89);
  });

  it('formato americano "1234.56" se preserva', () => {
    expect(normalizeValor('1234.56')).toBe(1234.56);
  });

  it('símbolo € se elimina', () => {
    expect(normalizeValor('€1234.56')).toBe(1234.56);
    expect(normalizeValor('1.234,56 €')).toBe(1234.56);
  });

  it('símbolos $ y £ se eliminan', () => {
    expect(normalizeValor('$5000')).toBe(5000);
    expect(normalizeValor('£250.50')).toBe(250.5);
  });

  it('espacios y letras se eliminan', () => {
    expect(normalizeValor(' 1234 ')).toBe(1234);
    expect(normalizeValor('1234 EUR')).toBe(1234);
  });

  it('cadena vacía devuelve NaN', () => {
    expect(normalizeValor('')).toBeNaN();
    expect(normalizeValor('   ')).toBeNaN();
  });

  it('null/undefined devuelve NaN', () => {
    expect(normalizeValor(null)).toBeNaN();
    expect(normalizeValor(undefined)).toBeNaN();
  });

  it('Infinity devuelve NaN', () => {
    expect(normalizeValor(Infinity)).toBeNaN();
    expect(normalizeValor(-Infinity)).toBeNaN();
  });
});

describe('detectColumns', () => {
  it('detecta "fecha" y "valor" exactos', () => {
    expect(detectColumns(['fecha', 'valor'])).toEqual({ fechaCol: 'fecha', valorCol: 'valor' });
  });

  it('case-insensitive', () => {
    expect(detectColumns(['Fecha', 'VALOR'])).toEqual({ fechaCol: 'Fecha', valorCol: 'VALOR' });
  });

  it('aliases de fecha · date, mes, periodo', () => {
    expect(detectColumns(['date', 'amount']).fechaCol).toBe('date');
    expect(detectColumns(['mes', 'importe']).fechaCol).toBe('mes');
    expect(detectColumns(['periodo', 'saldo']).fechaCol).toBe('periodo');
  });

  it('aliases de valor · value, importe, saldo, amount, valor_eur', () => {
    expect(detectColumns(['fecha', 'value']).valorCol).toBe('value');
    expect(detectColumns(['fecha', 'importe']).valorCol).toBe('importe');
    expect(detectColumns(['fecha', 'saldo']).valorCol).toBe('saldo');
    expect(detectColumns(['fecha', 'amount']).valorCol).toBe('amount');
    expect(detectColumns(['fecha', 'valor_eur']).valorCol).toBe('valor_eur');
  });

  it('si no encuentra aliases · usa las 2 primeras columnas', () => {
    expect(detectColumns(['col1', 'col2', 'col3'])).toEqual({ fechaCol: 'col1', valorCol: 'col2' });
  });

  it('respeta el orden cuando las columnas vienen mezcladas', () => {
    expect(detectColumns(['valor', 'fecha'])).toEqual({ fechaCol: 'fecha', valorCol: 'valor' });
  });
});

describe('detectDelimiter', () => {
  it('CSV con comas devuelve ","', () => {
    const csv = 'fecha,valor\n2024-01-01,1000\n2024-02-01,2000';
    expect(detectDelimiter(csv)).toBe(',');
  });

  it('CSV europeo con ";" devuelve ";"', () => {
    const csv = 'fecha;valor\n2024-01-01;"1.234,56"\n2024-02-01;"2.345,67"';
    expect(detectDelimiter(csv)).toBe(';');
  });

  it('CSV tabular (TSV) devuelve "\\t"', () => {
    const csv = 'fecha\tvalor\n2024-01-01\t1000';
    expect(detectDelimiter(csv)).toBe('\t');
  });

  it('CSV con pipe devuelve "|"', () => {
    const csv = 'fecha|valor\n2024-01-01|1000';
    expect(detectDelimiter(csv)).toBe('|');
  });

  it('respeta comillas · "1.234,56" no cuenta como múltiples commas', () => {
    // Aquí hay 1 punto y coma (delim real) y 2 comas dentro de quotes.
    // El detector debe elegir ";".
    const csv = 'fecha;valor\n2024-01-01;"1.234,56"\n2024-02-01;"2.345,67"';
    expect(detectDelimiter(csv)).toBe(';');
  });

  it('texto vacío devuelve "," por defecto', () => {
    expect(detectDelimiter('')).toBe(',');
  });

  it('una sola línea sin delimitador devuelve ","', () => {
    expect(detectDelimiter('header_solo')).toBe(',');
  });
});

describe('parseRow', () => {
  it('fila válida con número simple', () => {
    const r = parseRow('2024-06-15', '1000');
    expect(r.fecha).toBe('2024-06-15');
    expect(r.valor).toBe(1000);
    expect(r.invalid).toBeUndefined();
  });

  it('fila válida con valor 0 (activo liquidado) NO se marca como inválida', () => {
    // Review Copilot · permitir valor=0 alineado con validateValoracionInput
    const r = parseRow('2024-06-15', '0');
    expect(r.valor).toBe(0);
    expect(r.invalid).toBeUndefined();
  });

  it('fila con valor negativo se marca inválida', () => {
    const r = parseRow('2024-06-15', '-100');
    expect(r.invalid).toBe('valor');
  });

  it('fila con fecha vacía se marca invalid=fecha', () => {
    const r = parseRow('', '1000');
    expect(r.invalid).toBe('fecha');
  });

  it('fila con valor no parseable se marca invalid=valor', () => {
    const r = parseRow('2024-06-15', 'no-es-numero');
    expect(r.invalid).toBe('valor');
  });

  it('preserva los valores raw para debugging UI', () => {
    const r = parseRow('15/06/2024', '€1.234,56');
    expect(r.raw.fechaRaw).toBe('15/06/2024');
    expect(r.raw.valorRaw).toBe('€1.234,56');
    expect(r.fecha).toBe('2024-06-15');
    expect(r.valor).toBe(1234.56);
  });
});
