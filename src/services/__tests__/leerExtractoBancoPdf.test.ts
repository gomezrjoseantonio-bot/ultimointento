// Normalización de lo que devuelve la IA para un extracto de cuenta en PDF.

import { movimientosDeIABanco } from '../leerExtractoBancoPdf';

describe('movimientosDeIABanco', () => {
  it('mapea fecha/concepto/importe respetando el signo del banco', () => {
    const movs = movimientosDeIABanco({
      lineas: [
        { fecha: '2026-08-03', concepto: 'Recibo Comunidad', importe: -98.44 },
        { fecha: '2026-08-01', concepto: 'Transferencia de Adnan Parwez Alquiler', importe: 395 },
      ],
    });
    expect(movs).toHaveLength(2);
    expect(movs[0]).toMatchObject({ amount: -98.44, description: 'Recibo Comunidad' });
    expect(movs[0].date.toISOString().slice(0, 10)).toBe('2026-08-03');
    expect(movs[1].amount).toBe(395);
  });

  it('acepta fechas DD/MM/YYYY y un array pelado', () => {
    const movs = movimientosDeIABanco([{ fecha: '03/08/2026', concepto: 'X', importe: -10 }]);
    expect(movs[0].date.toISOString().slice(0, 10)).toBe('2026-08-03');
  });

  it('descarta líneas sin fecha, sin concepto, importe 0 o no numérico', () => {
    const movs = movimientosDeIABanco({
      lineas: [
        { fecha: '', concepto: 'X', importe: 5 },
        { fecha: '2026-08-03', concepto: '', importe: 5 },
        { fecha: '2026-08-03', concepto: 'X', importe: 0 },
        { fecha: '2026-08-03', concepto: 'Y', importe: 'nan' },
        { fecha: '2026-08-03', concepto: 'BUENA', importe: -12.5 },
      ],
    });
    expect(movs).toHaveLength(1);
    expect(movs[0].description).toBe('BUENA');
  });

  it('sin líneas devuelve vacío', () => {
    expect(movimientosDeIABanco('no json')).toEqual([]);
    expect(movimientosDeIABanco({})).toEqual([]);
  });
});
