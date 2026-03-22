import { PDFDocument } from 'pdf-lib';
import { detectarEjercicio, dividirPdfEnBloques, dividirTextoPorPaginas } from '../aeatParserService';

describe('detectarEjercicio', () => {
  test('acepta ejercicios abreviados en el payload extraído', () => {
    expect(detectarEjercicio({ ejercicio: '24' })).toBe(2024);
    expect(detectarEjercicio({ ejercicio: 24 })).toBe(2024);
  });

  test('usa el nombre del PDF como fallback cuando el parser no devuelve el año completo', () => {
    expect(detectarEjercicio({}, 'declaracion irpf 2024.pdf')).toBe(2024);
  });

  test('usa el ejercicio seleccionado manualmente como último fallback', () => {
    expect(detectarEjercicio({}, undefined, 2024)).toBe(2024);
  });
});

describe('dividirTextoPorPaginas', () => {
  test('parte declaraciones largas en bloques conservando el rango de páginas', () => {
    const bloques = dividirTextoPorPaginas(
      [
        'Página 1 '.repeat(80),
        'Página 2 '.repeat(80),
        'Página 3 '.repeat(80),
        'Página 4 '.repeat(80),
      ],
      2000,
      2,
    );

    expect(bloques).toHaveLength(2);
    expect(bloques[0]).toMatchObject({ desde: 1, hasta: 2 });
    expect(bloques[1]).toMatchObject({ desde: 3, hasta: 4 });
    expect(bloques[0].texto).toContain('[PÁGINA 1]');
    expect(bloques[1].texto).toContain('[PÁGINA 4]');
  });
});

describe('dividirPdfEnBloques', () => {
  test('divide PDFs extensos en subdocumentos pequeños para evitar timeouts', async () => {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 7; i += 1) {
      pdf.addPage([595, 842]);
    }

    const bytes = await pdf.save();
    const bloques = await dividirPdfEnBloques(new Uint8Array(bytes), 3);

    expect(bloques).toHaveLength(3);
    expect(bloques.map((bloque) => [bloque.desde, bloque.hasta])).toEqual([
      [1, 3],
      [4, 6],
      [7, 7],
    ]);
    expect(bloques.every((bloque) => bloque.blob.size > 0)).toBe(true);
  });
});
