import { PDFDocument } from 'pdf-lib';
import { __private__, detectarEjercicio, dividirPdfEnBloques, dividirTextoPorPaginas } from '../aeatParserService';
import { callScanChat } from '../scanChatService';

jest.mock('../scanChatService', () => ({
  callScanChat: jest.fn(),
  callScanChatText: jest.fn(),
}));

const mockedCallScanChat = callScanChat as jest.MockedFunction<typeof callScanChat>;

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

describe('extracción textual determinista', () => {
  test('extrae casillas numéricas directamente del texto sin depender de IA', () => {
    const casillas = __private__.extraerCasillasDeterministasDesdeTexto([
      'Base imponible general 150.924,07 0435\nCuota resultante 2.899,75 0670',
      '0609 15.136,05 Retenciones',
    ]);

    expect(casillas).toMatchObject({
      '0435': 150924.07,
      '0609': 15136.05,
      '0670': 2899.75,
    });
  });

  test('detecta metadatos e inmuebles repetidos desde el texto estructurado del modelo 100', () => {
    const casillas = __private__.extraerCasillasDeterministasDesdeTexto([
      [
        'Impuesto sobre la Renta de las Personas Físicas',
        'Ejercicio 2024',
        'NIF 53069494F 0001',
        'Apellidos y nombre GOMEZ RAMIREZ JOSE ANTONIO 0002',
        'Estado civil (el 31-12-2024) (1) Soltero/a 0006',
        'Fecha de nacimiento 28/09/1980 0010',
        'Comunidad Autónoma de residencia habitual en 2024 MADRID 0070',
        'Inmueble 1',
        'Referencia catastral 7949807TP6074N0006YM 0066',
        'Dirección del inmueble CL FUERTES ACEVEDO 0032 1 02 DR OVIEDO 0069',
        'Arrendamiento. X 0075',
        'NIF del arrendatario 1 Y5617860D 0091',
        'Fecha del contrato. 01/05/2023 0093',
        'Nº de días que el inmueble ha estado arrendado 366 0101',
        'Ingresos íntegros computables del capital inmobiliario. 19.675,00 0102',
        'Intereses y demás gastos de financiación en 2024. 1.580,34 0105',
        'Amortización de bienes inmuebles 1.699,66 0131',
        'Rendimiento neto reducido. 3.943,75 0154',
      ].join('\n'),
    ]);

    expect(casillas).toMatchObject({
      ejercicio: '2024',
      nif: '53069494F',
      nombre: 'GOMEZ RAMIREZ JOSE ANTONIO',
      estado_civil: 'Soltero/a',
      fecha_nacimiento: '28/09/1980',
      comunidad_autonoma: 'Madrid',
      '0066_1': '7949807TP6074N0006YM',
      '0069_1': 'CL FUERTES ACEVEDO 0032 1 02 DR OVIEDO',
      '0075_1': 'X',
      '0091_1': 'Y5617860D',
      '0093_1': '01/05/2023',
      '0101_1': 366,
      '0102_1': 19675,
      '0105_1': 1580.34,
      '0131_1': 1699.66,
      '0154_1': 3943.75,
    });
  });

  test('lee páginas de presentación, accesorios y bloques "Inmueble" sin numerar en información adicional', () => {
    const casillas = __private__.extraerCasillasDeterministasDesdeTexto([
      [
        'INFORMACIÓN DE LA PRESENTACIÓN DE LA DECLARACIÓN',
        'Modelo 100 Ejercicio 2024',
        'Presentación realizada el: 24-06-2025 a las 19:31:15',
        'Expediente/Referencia (nº registro asignado): 202410069492285M',
        'Código Seguro de Verificación: DDD666NAQ2F9MMKS',
        'Número de justificante: 1005624311754',
        'NIF Presentador: 53069494F',
        'Apellidos y Nombre / Razón social: GOMEZ RAMIREZ JOSE ANTONIO',
      ].join('\n'),
      [
        'Inmueble 7',
        'Referencia catastral 0654104TP7005S0011AA 0066',
        'Dirección del inmueble CL TENDERINA 0064 1 05 01 OVIEDO 0069',
        'Arrendamiento como inmueble accesorio. X 0074',
        'Ref. catastral del inmueble principal al que está vinculado el accesorio 0654104TP7005S0009SS 0090',
      ].join('\n'),
      [
        'INTERESES DE CAPITALES INVERTIDOS EN INMUEBLES, PENDIENTES DE DEDUCIR EN LOS EJERCICIOS SIGUIENTES',
        'Inmueble',
        'Referencia Catastral 0654104TP7005S0009SS 1212',
        'Ejercicio 2023. Pendiente de aplicación al principio del período 2.500,00 1221',
        'Ejercicio 2023. Aplicado en esta declaración 2.500,00 1222',
        'Gastos deducibles de 2024 a deducir en los 4 años siguientes. 28.239,24 1224',
        'Información adicional de gastos de bienes inmuebles arrendados',
        'Inmueble',
        'Referencia Catastral 0654104TP7005S0012TS 1394',
        'NIF de quién realiza la reparación y conservación B44540920 1395',
        'Importe del gasto 32.186,00 1396',
        'Fecha de realización de la mejora 09/01/2024 1421',
        'NIF de quién realizó la obra o servicio de mejora 10521540Y 1422',
        'Importe de la mejora 3.545,30 1423',
      ].join('\n'),
      [
        'Impuesto sobre la Renta de las Personas Físicas',
        'Ejercicio 2024 - Documento de ingreso o devolución',
        'NIF declarante 53069494F',
        'Apellidos y nombre GOMEZ RAMIREZ JOSE ANTONIO',
        'Número de justificante 1005624311754',
      ].join('\n'),
    ]);

    expect(casillas).toMatchObject({
      ejercicio: '2024',
      nif: '53069494F',
      nombre: 'GOMEZ RAMIREZ JOSE ANTONIO',
      fecha_presentacion: '24/06/2025 19:31:15',
      expediente_referencia: '202410069492285M',
      csv: 'DDD666NAQ2F9MMKS',
      numero_justificante: '1005624311754',
      '0066_7': '0654104TP7005S0011AA',
      '0074_7': 'X',
      '0090_7': '0654104TP7005S0009SS',
      '1212_1': '0654104TP7005S0009SS',
      '1221_1': 2500,
      '1222_1': 2500,
      '1224_1': 28239.24,
      '1394_2': '0654104TP7005S0012TS',
      '1395_2': 'B44540920',
      '1396_2': 32186,
      '1421_2': '09/01/2024',
      '1422_2': '10521540Y',
      '1423_2': 3545.3,
    });
  });

  test('detecta cuando hay datos mínimos para continuar aunque falle el refuerzo visual', () => {
    expect(__private__.tieneDatosMinimosParaImportar({
      ejercicio: 2024,
      '0435': 150924.07,
      '0609': 15136.05,
    }, 'declaracion irpf 2024.pdf')).toBe(true);

    expect(__private__.tieneDatosMinimosParaImportar({
      '0435': 150924.07,
    }, 'sin-ejercicio.pdf')).toBe(false);
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

describe('helpers de metadatos AEAT', () => {
  test('detecta estado civil desde la marca X en la casilla 0006', () => {
    expect(__private__.detectarEstadoCivil({ '0006': 'X' })).toBe('Soltero/a');
  });

  test('detecta la CCAA desde la casilla 0010 cuando contiene texto', () => {
    expect(__private__.detectarCCAA({ '0010': 'MADRID' })).toBe('Madrid');
  });

  test('detecta la fecha de nacimiento solo desde metadata y no desde la casilla 0010 textual', () => {
    expect(__private__.detectarFechaNacimiento({ fecha_nacimiento: '28/09/1980', '0010': 'MADRID' })).toBe('28/09/1980');
    expect(__private__.detectarFechaNacimiento({ '0010': 'MADRID' })).toBe('');
  });
});

describe('validación de cabecera PDF', () => {
  test('localiza la cabecera PDF aunque existan bytes basura al inicio', async () => {
    const bytes = new Uint8Array([
      0x20, 0x20, 0x0a,
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);

    expect(__private__.buscarCabeceraPdf(bytes)).toBe(3);

    const file = new File([bytes], 'declaracion.pdf', { type: 'application/pdf' });
    const normalized = await __private__.leerBytesPdfNormalizados(file);

    expect(Array.from(normalized.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  test('rechaza html o contenido no pdf con un error legible', async () => {
    const file = new File(['<!doctype html><html><body>Error</body></html>'], 'declaracion.pdf', { type: 'application/pdf' });

    await expect(__private__.leerBytesPdfNormalizados(file)).rejects.toThrow(/archivo_no_pdf/i);
  });
});

describe('fallback OCR AEAT', () => {
  beforeEach(() => {
    mockedCallScanChat.mockReset();
  });

  test('detecta errores timeout del OCR', () => {
    expect(__private__.esTimeoutOCR(new Error('OCR error 504: Inactivity Timeout'))).toBe(true);
    expect(__private__.esTimeoutOCR(new Error('network error'))).toBe(false);
  });

  test('reintenta un bloque visual dividiéndolo en subbloques más pequeños tras un timeout', async () => {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 4; i += 1) {
      pdf.addPage([595, 842]);
    }

    const bytes = await pdf.save();
    const [bloque] = await dividirPdfEnBloques(new Uint8Array(bytes), 4);
    const file = new File([bytes], 'declaracion.pdf', { type: 'application/pdf' });

    mockedCallScanChat
      .mockRejectedValueOnce(new Error('OCR error 504: Inactivity Timeout'))
      .mockRejectedValueOnce(new Error('OCR error 504: Inactivity Timeout'))
      .mockResolvedValueOnce({ ok: true, extraido: JSON.stringify({ '0003': 10 }) })
      .mockResolvedValueOnce({ ok: true, extraido: JSON.stringify({ '0004': 20 }) });

    const resultado = await __private__.extraerCasillasVisualesConFallback(
      file,
      bloque,
      4,
    );

    expect(resultado).toMatchObject({ '0003': 10, '0004': 20 });
    expect(mockedCallScanChat).toHaveBeenCalledTimes(4);
  });

  test('si pdf-lib no puede dividir un pdf válido para el flujo, hace OCR sobre el fichero original completo', async () => {
    mockedCallScanChat.mockResolvedValueOnce({
      ok: true,
      extraido: JSON.stringify({ '0435': 150924.07, '0670': 2899.75 }),
    });

    const fakePdf = new File(['not-really-a-pdf-but-should-trigger-fallback'], 'declaracion.pdf', { type: 'application/pdf' });

    const resultado = await __private__.extraerCasillasConClaudePorBloques(
      fakePdf,
      11,
    );

    expect(resultado).toMatchObject({ '0435': 150924.07, '0670': 2899.75 });
    expect(mockedCallScanChat).toHaveBeenCalledTimes(1);
    expect(mockedCallScanChat.mock.calls[0]?.[0]).toBe(fakePdf);
  });
});
