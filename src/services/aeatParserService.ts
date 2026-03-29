import { callScanChat } from './scanChatService';
import type {
  DeclaracionActividad,
  DeclaracionBasesYCuotas,
  DeclaracionCapitalMobiliario,
  DeclaracionGananciasPerdidas,
  DeclaracionIRPF,
  DeclaracionInmueble,
  DeclaracionPlanPensiones,
  DeclaracionTrabajo,
  PerdidasPendientes,
} from '../types/fiscal';

export interface ExtraccionCompleta {
  exito: boolean;
  errores: string[];
  warnings: string[];
  meta: {
    ejercicio: number;
    modelo: string;
    nif: string;
    nombre: string;
    fechaPresentacion?: string;
    numeroJustificante?: string;
    codigoVerificacion?: string;
    esRectificativa: boolean;
  };
  declaracion: DeclaracionIRPF;
  casillasRaw: Record<string, number | string>;
  inmueblesDetalle: InmuebleExtraidoCompleto[];
  arrastres: {
    gastos0105_0106: ArrastreExtraido[];
    perdidasAhorro: PerdidaExtraida[];
    gastosInmuebleDetalle: GastoInmuebleDetalle[];
  };
  paginasProcesadas: number;
  totalCasillas: number;
}

export interface InmuebleExtraidoCompleto {
  datos: DeclaracionInmueble;
  extras: {
    situacion?: string;
    urbana?: boolean;
    tipoContribucion?: string;
  };
}

export interface ArrastreExtraido {
  referenciaCatastral: string;
  ejercicioOrigen: number;
  pendienteInicio: number;
  aplicadoEstaDeclaracion: number;
  pendienteFuturo: number;
  generadoEsteEjercicio: number;
}

export interface PerdidaExtraida {
  tipo: 'ahorro' | 'general';
  ejercicioOrigen: number;
  pendienteInicio: number;
  aplicado: number;
  pendienteFuturo: number;
}

export interface GastoInmuebleDetalle {
  referenciaCatastral: string;
  nifProveedor?: string;
  importeGasto?: number;
  nifServiciosPersonales?: string;
  importeServiciosPersonales?: number;
  fechaMejora?: string;
  nifMejora?: string;
  importeMejora?: number;
}

export interface ProgresoParseo {
  fase: 'preparando' | 'enviando' | 'procesando' | 'mapeando' | 'validando';
  pagina?: number;
  totalPaginas?: number;
  mensaje: string;
}

type OnProgress = (progreso: ProgresoParseo) => void;

type CasillasRaw = Record<string, number | string>;

type NumericGetter = (casilla: string) => number;
type StringGetter = (casilla: string) => string;
type BooleanGetter = (casilla: string) => boolean;

const MIN_EJERCICIO = 2020;
const MAX_EJERCICIO = 2100;

const CASILLAS_INMUEBLE_REPETIBLES = [
  '0062', '0063', '0065', '0066', '0067', '0069', '0073', '0074', '0075',
  '0085', '0089', '0090', '0091', '0093', '0094', '0100', '0101', '0102',
  '0103', '0104', '0105', '0106', '0107', '0108', '0109', '0112', '0113',
  '0114', '0115', '0117', '0118', '0120', '0123', '0124', '0125', '0126',
  '0127', '0129', '0130', '0131', '0133', '0135', '0137', '0138', '0139',
  '0140', '0141', '0142', '0145', '0146', '0149', '0150', '0154', '1212',
  '1221', '1222', '1224', '1394', '1395', '1396', '1416', '1417', '1421',
  '1422', '1423',
] as const;

const CCAA_CODES: Record<number, string> = {
  1: 'Andalucía',
  2: 'Aragón',
  3: 'Asturias',
  4: 'Baleares',
  5: 'Canarias',
  6: 'Cantabria',
  7: 'Castilla-La Mancha',
  8: 'Castilla y León',
  9: 'Cataluña',
  10: 'Extremadura',
  11: 'Galicia',
  12: 'Madrid',
  13: 'Murcia',
  14: 'La Rioja',
  15: 'Comunidad Valenciana',
  16: 'Ceuta',
  17: 'Melilla',
} as const;

export async function parsearDeclaracionAEAT(
  file: File,
  onProgress?: OnProgress,
  ejercicioFallback?: number,
): Promise<ExtraccionCompleta> {
  const errores: string[] = [];
  const warnings: string[] = [];

  try {
    onProgress?.({ fase: 'preparando', mensaje: 'Preparando PDF para análisis...' });
    const { totalPaginas, paginasTexto } = await prepararPdfParaAnalisis(file);

    let casillasRaw = extraerCasillasDeterministasDesdeTexto(paginasTexto);

    const necesitaFallbackVision =
      Object.keys(casillasRaw).length < MIN_CASILLAS_PARSING_OK ||
      detectarEjercicio(casillasRaw, file.name, ejercicioFallback) < MIN_EJERCICIO;

    if (necesitaFallbackVision) {
      warnings.push(
        Object.keys(casillasRaw).length > 0
          ? 'Extracción textual incompleta; se intentará reforzar con análisis OCR del PDF completo.'
          : 'El PDF no expone texto suficiente; se intentará analizar el documento completo con IA.',
      );

      try {
        const casillasOcr = await extraerCasillasConClaude(
          file,
          totalPaginas,
          onProgress,
        );
        casillasRaw = mergeCasillasRaw(casillasRaw, casillasOcr);
      } catch (error) {
        console.warn('[AEATParser] Refuerzo visual no disponible; se conserva la extracción textual parcial.', error);

        if (esTimeoutOCR(error) && !tieneDatosMinimosParaImportar(casillasRaw, file.name, ejercicioFallback)) {
          return resultadoError(
            'La extracción automática no pudo completarse. Usa el formulario manual para introducir los datos.',
            ['El PDF requiere más tiempo del disponible para análisis automático.'],
          );
        }

        if (!tieneDatosMinimosParaImportar(casillasRaw, file.name, ejercicioFallback)) {
          return resultadoError(
            'La extracción automática no pudo completarse. Usa el formulario manual para introducir los datos.',
            ['No se han podido leer suficientes casillas del PDF para importar con fiabilidad.'],
          );
        }

        warnings.push('El refuerzo OCR no respondió a tiempo, pero se mantiene una extracción textual parcial para que puedas revisarla y completarla si hace falta.');
      }
    }

    if (Object.keys(casillasRaw).length === 0) {
      return resultadoError('No se pudieron extraer casillas del PDF. Usa el formulario manual para continuar.');
    }

    const ejercicioDetectado = detectarEjercicio(casillasRaw, file.name, ejercicioFallback);
    if (ejercicioDetectado < MIN_EJERCICIO) {
      return resultadoError('El histórico de ATLAS empieza en 2020');
    }

    onProgress?.({ fase: 'mapeando', mensaje: 'Organizando datos extraídos...' });
    const { declaracion, inmuebles, arrastres, meta } = mapearCasillasADeclaracion(
      casillasRaw,
      file.name,
      ejercicioFallback,
    );

    if (meta.ejercicio < MIN_EJERCICIO) {
      return resultadoError('El histórico de ATLAS empieza en 2020');
    }

    onProgress?.({ fase: 'validando', mensaje: 'Verificando coherencia...' });
    const validacion = validarCoherencia(declaracion);
    warnings.push(...validacion.warnings);

    return {
      exito: true,
      errores,
      warnings,
      meta,
      declaracion,
      casillasRaw,
      inmueblesDetalle: inmuebles,
      arrastres,
      paginasProcesadas: totalPaginas,
      totalCasillas: Object.keys(casillasRaw).length,
    };
  } catch (error) {
    console.error('[AEATParser] Error:', error);
    const rawMessage = error instanceof Error ? error.message : 'desconocido';
    const mensajePdfInvalido = /no pdf header found|archivo_no_pdf|invalid pdf|missing pdf/i.test(rawMessage);
    const friendlyMessage = /timeout|504|inactivity/i.test(rawMessage)
      ? 'La extracción automática no pudo completarse a tiempo. Usa el formulario manual para introducir los datos.'
      : mensajePdfInvalido
        ? 'El archivo seleccionado no parece ser un PDF válido de la AEAT. Vuelve a descargarlo y asegúrate de subir el documento original en PDF.'
        : `Error procesando PDF: ${rawMessage}`;
    return resultadoError(friendlyMessage);
  }
}

function resultadoError(mensaje: string, warnings: string[] = []): ExtraccionCompleta {
  return {
    exito: false,
    errores: [mensaje],
    warnings,
    meta: { ejercicio: 0, modelo: '100', nif: '', nombre: '', esRectificativa: false },
    declaracion: declaracionVacia(),
    casillasRaw: {},
    inmueblesDetalle: [],
    arrastres: { gastos0105_0106: [], perdidasAhorro: [], gastosInmuebleDetalle: [] },
    paginasProcesadas: 0,
    totalCasillas: 0,
  };
}

interface PdfPreparado {
  totalPaginas: number;
  textoExtraido: string;
  paginasTexto: string[];
}

const MIN_CASILLAS_PARSING_OK = 5;
const OCR_TIMEOUT_MS = 90_000;

async function prepararPdfParaAnalisis(file: File): Promise<PdfPreparado> {
  try {
    const { pdfjs } = await import('react-pdf');
    pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

    const bytesPdf = await leerBytesPdfNormalizados(file);
    const pdf = await pdfjs.getDocument({ data: bytesPdf }).promise;
    const paginasTexto: string[] = [];

    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const items = content.items
        .map((item) => {
          if (!('str' in item)) return null;
          const str = String(item.str ?? '').trim();
          if (!str) return null;
          const transform = Array.isArray(item.transform) ? item.transform : [];
          const x = typeof transform[4] === 'number' ? transform[4] : 0;
          const y = typeof transform[5] === 'number' ? transform[5] : 0;
          return { str, x, y };
        })
        .filter((item): item is { str: string; x: number; y: number } => Boolean(item));

      if (items.length === 0) continue;

      const sorted = [...items].sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 3) return yDiff;
        return a.x - b.x;
      });

      const lines: string[] = [];
      let currentLine: string[] = [];
      let currentY = sorted[0]?.y ?? 0;

      for (const item of sorted) {
        if (Math.abs(item.y - currentY) > 3) {
          if (currentLine.length > 0) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
          currentLine = [];
          currentY = item.y;
        }
        currentLine.push(item.str);
      }

      if (currentLine.length > 0) {
        lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
      }

      const textoPagina = lines.join('\n');

      if (textoPagina) {
        paginasTexto.push(textoPagina);
      }
    }

    return {
      totalPaginas: pdf.numPages,
      textoExtraido: paginasTexto.join('\n\n'),
      paginasTexto,
    };
  } catch (error) {
    console.warn('[AEATParser] No se pudo preparar el PDF para análisis:', error);
    throw error;
  }
}

async function leerBytesPdfNormalizados(file: File): Promise<Uint8Array> {
  const arrayBuffer = await leerArrayBufferDesdeBlob(file);
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.length === 0) {
    throw new Error('archivo_no_pdf: archivo vacío');
  }

  const headerIndex = buscarCabeceraPdf(bytes);
  if (headerIndex === -1) {
    const textoInicial = bytesAAscii(bytes.slice(0, Math.min(bytes.length, 256)))
      .trim()
      .toLowerCase();

    if (textoInicial.startsWith('<!doctype html') || textoInicial.startsWith('<html')) {
      throw new Error('archivo_no_pdf: se recibió HTML en lugar de PDF');
    }

    throw new Error('archivo_no_pdf: no se encontró una cabecera PDF válida');
  }

  return headerIndex === 0 ? bytes : bytes.slice(headerIndex);
}

async function leerArrayBufferDesdeBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  const response = new Response(blob);
  return response.arrayBuffer();
}

function bytesAAscii(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => (value >= 32 && value <= 126 ? String.fromCharCode(value) : ' '))
    .join('');
}

function buscarCabeceraPdf(bytes: Uint8Array): number {
  const limite = Math.max(0, Math.min(bytes.length - 4, 2048));

  for (let index = 0; index <= limite; index += 1) {
    if (
      bytes[index] === 0x25
      && bytes[index + 1] === 0x50
      && bytes[index + 2] === 0x44
      && bytes[index + 3] === 0x46
      && bytes[index + 4] === 0x2D
    ) {
      return index;
    }
  }

  return -1;
}

function extraerCasillasDeterministasDesdeTexto(paginasTexto: string[]): CasillasRaw {
  const resultado: CasillasRaw = {};
  const patrones = obtenerPatronesCasillasNumericas();

  for (const pagina of paginasTexto) {
    const lineas = pagina
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter(Boolean);

    for (const linea of lineas) {
      for (const patron of patrones) {
        patron.lastIndex = 0;

        let match: RegExpExecArray | null = patron.exec(linea);
        while (match) {
          const casilla = patron === patrones[0] ? match[3] : match[2];
          const valorRaw = patron === patrones[0] ? match[2] : match[3];
          const valor = Number.parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));

          if (!Number.isNaN(valor)) {
            const knownKeys = new Set([...Object.keys(resultado), casilla]);
            resultado[casilla] = seleccionarMejorValorCasilla(casilla, resultado[casilla], valor, knownKeys);
          }

          match = patron.exec(linea);
        }
      }
    }
  }

  return mergeCasillasRaw(
    resultado,
    extraerCasillasDeterministasDesdeTextoPlano(paginasTexto),
    extraerMetadatosDesdeTexto(paginasTexto),
    extraerCasillasRepetiblesDesdeTexto(paginasTexto),
  );
}

function obtenerPatronesCasillasNumericas(): [RegExp, RegExp] {
  return [
    /(^|\s)(-?[\d.]+,\d{2}|-?\d+)\s+(\d{4})(?!\d)/g,
    /(^|\s)(\d{4})\s+(-?[\d.]+,\d{2}|-?\d+)(?!\d)/g,
  ];
}

function extraerCasillasDeterministasDesdeTextoPlano(paginasTexto: string[]): CasillasRaw {
  const resultado: CasillasRaw = {};
  const patrones = obtenerPatronesCasillasNumericas();

  for (const pagina of paginasTexto) {
    const textoPlano = pagina.replace(/\s+/g, ' ').trim();
    if (!textoPlano) continue;

    for (const patron of patrones) {
      patron.lastIndex = 0;

      let match: RegExpExecArray | null = patron.exec(textoPlano);
      while (match) {
        const casilla = patron === patrones[0] ? match[3] : match[2];
        const valorRaw = patron === patrones[0] ? match[2] : match[3];
        const valor = Number.parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));

        if (!Number.isNaN(valor)) {
          const knownKeys = new Set([...Object.keys(resultado), casilla]);
          resultado[casilla] = seleccionarMejorValorCasilla(casilla, resultado[casilla], valor, knownKeys);
        }

        match = patron.exec(textoPlano);
      }
    }
  }

  return resultado;
}

function extraerMetadatosDesdeTexto(paginasTexto: string[]): CasillasRaw {
  const texto = paginasTexto.join('\n').replace(/\u00a0/g, ' ');
  const resultado: CasillasRaw = {};

  const ejercicio = texto.match(/Ejercicio\s+(20\d{2}|\d{2})/i)?.[1];
  if (ejercicio) resultado.ejercicio = ejercicio;

  const nif = texto.match(/NIF\s+([A-Z0-9]{8,12})\s+0001\b/i)?.[1]
    ?? texto.match(/NIF declarante\s+([A-Z0-9]{8,12})/i)?.[1]
    ?? texto.match(/NIF Presentador:\s*([A-Z0-9]{8,12})/i)?.[1];
  if (nif) resultado.nif = nif.trim().toUpperCase();

  const nombre = texto.match(/Apellidos y nombre\s+(.+?)\s+0002\b/i)?.[1]
    ?? texto.match(/Apellidos y nombre(?:\s*\/\s*Raz[oó]n social)?:\s*(.+)/i)?.[1];
  if (nombre) resultado.nombre = limpiarTextoExtraido(nombre);

  const estadoCivil = texto.match(/Estado civil \(el 31-12-\d{4}\)\s+(.+?)\s+0006\b/i)?.[1];
  if (estadoCivil) {
    resultado.estado_civil = limpiarEstadoCivil(estadoCivil);
  }

  const fechaNacimiento = texto.match(/Fecha de nacimiento\s+(\d{2}\/\d{2}\/\d{4})\s+0010\b/i)?.[1];
  if (fechaNacimiento) resultado.fecha_nacimiento = fechaNacimiento;

  const comunidad = texto.match(/Comunidad Autónoma.*?\n.*?\s([A-ZÁÉÍÓÚÜÑ ]{3,})\s+0070\b/i)?.[1]
    ?? texto.match(/Comunidad Autónoma.*?residencia habitual.*?\s([A-ZÁÉÍÓÚÜÑ ]{3,})\s+0070\b/i)?.[1];
  if (comunidad) resultado.comunidad_autonoma = toTitleCase(limpiarTextoExtraido(comunidad));

  const numeroJustificante = texto.match(/Número de justificante.*?\s(\d{10,})\s+0104\b/i)?.[1]
    ?? texto.match(/Número de justificante:\s*(\d{10,})/i)?.[1]
    ?? texto.match(/Número de justificante\s+(\d{10,})/i)?.[1];
  if (numeroJustificante) resultado.numero_justificante = numeroJustificante;

  const fechaPresentacion = texto.match(/Presentaci[oó]n realizada el:\s*(\d{2}[-/]\d{2}[-/]\d{4})\s*a las\s*(\d{2}:\d{2}:\d{2})/i);
  if (fechaPresentacion) {
    resultado.fecha_presentacion = `${fechaPresentacion[1].replace(/-/g, '/')} ${fechaPresentacion[2]}`;
  }

  const expedienteReferencia = texto.match(/Expediente\/Referencia .*?:\s*([A-Z0-9]+)/i)?.[1];
  if (expedienteReferencia) resultado.expediente_referencia = expedienteReferencia;

  const csv = texto.match(/C[oó]digo Seguro de Verificaci[oó]n:\s*([A-Z0-9]+)/i)?.[1];
  if (csv) resultado.csv = csv;

  const presentadorNombre = texto.match(/Apellidos y Nombre(?:\/ Raz[oó]n social)?:\s*(.+)/i)?.[1];
  if (presentadorNombre && !resultado.nombre) {
    resultado.nombre = limpiarTextoExtraido(presentadorNombre);
  }

  return resultado;
}

function extraerCasillasRepetiblesDesdeTexto(paginasTexto: string[]): CasillasRaw {
  const resultado: CasillasRaw = {};
  const casillasRepetibles = new Set<string>(CASILLAS_INMUEBLE_REPETIBLES);
  const refToPropertyIndex = new Map<string, number>();
  const directTextExtractors: Array<[RegExp, string]> = [
    [/Referencia catastral\.?\s+([A-Z0-9]{8,20})\s+0066\b/i, '0066'],
    [/Direcci[oó]n del inmueble\s+(.+?)\s+0069\b/i, '0069'],
    [/Ref\. catastral del inmueble principal al que est[aá] vinculado el accesorio\s+([A-Z0-9]{8,20})\s+0090\b/i, '0090'],
    [/NIF del arrendatario 1\.?\s+([A-Z0-9]{8,12})\s+0091\b/i, '0091'],
    [/NIF del arrendatario 2\.?\s+([A-Z0-9]{8,12})\s+0094\b/i, '0094'],
    [/Fecha del contrato\.?\s+(\d{2}\/\d{2}\/\d{4})\s+0093\b/i, '0093'],
    [/Fecha de adquisici[oó]n del inmueble.*?\s+(\d{2}\/\d{2}\/\d{4})\s+0120\b/i, '0120'],
    [/Fecha de adquisici[oó]n del inmueble accesorio.*?\s+(\d{2}\/\d{2}\/\d{4})\s+0135\b/i, '0135'],
    [/Referencia Catastral\s+([A-Z0-9]{8,20})\s+1212\b/i, '1212'],
    [/Referencia Catastral\s+([A-Z0-9]{8,20})\s+1394\b/i, '1394'],
    [/NIF de qui[eé]n realiza la reparaci[oó]n y conservaci[oó]n\s+([A-Z0-9]{8,12})\s+1395\b/i, '1395'],
    [/NIF de qui[eé]n presta los servicios personales\s+([A-Z0-9]{8,12})\s+1416\b/i, '1416'],
    [/Fecha de realizaci[oó]n de la mejora\s+(\d{2}\/\d{2}\/\d{4})\s+1421\b/i, '1421'],
    [/NIF de qui[eé]n realiz[oó] la obra o servicio de mejora\s+([A-Z0-9]{8,12})\s+1422\b/i, '1422'],
  ];

  let indiceInmuebleActual: number | null = null;
  let contadorBloquesSinNumero = 0;

  const setSufijo = (casilla: string, valor: number | string) => {
    if (!indiceInmuebleActual || !casillasRepetibles.has(casilla)) return;
    resultado[`${casilla}_${indiceInmuebleActual}`] = valor;
  };

  const normalizarRef = (value: string) => value.replace(/\s+/g, '').trim().toUpperCase();

  for (const pagina of paginasTexto) {
    const lineas = pagina
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter(Boolean);

    for (const linea of lineas) {
      const encabezadoInmueble = linea.match(/^Inmueble\s+(\d+)\b/i);
      if (encabezadoInmueble) {
        indiceInmuebleActual = Number.parseInt(encabezadoInmueble[1], 10);
        continue;
      }

      if (/^Inmueble\b\.?$/i.test(linea)) {
        contadorBloquesSinNumero += 1;
        indiceInmuebleActual = contadorBloquesSinNumero;
        continue;
      }

      if (!indiceInmuebleActual) {
        continue;
      }

      const booleanMatches = Array.from(linea.matchAll(/\bX\s+(0067|0073|0074|0075|0100|0118|0133)\b/g));
      for (const match of booleanMatches) {
        setSufijo(match[1], 'X');
      }

      const numericMatches = Array.from(linea.matchAll(/(^|\s)(-?[\d.]+,\d{2}|-?\d+)\s+(\d{4})(?!\d)/g));
      for (const match of numericMatches) {
        const casilla = match[3];
        if (!casillasRepetibles.has(casilla)) continue;
        const valor = Number.parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
        if (!Number.isNaN(valor)) {
          const sufijo = `${casilla}_${indiceInmuebleActual}`;
          const knownKeys = new Set([...Object.keys(resultado), sufijo, casilla]);
          resultado[sufijo] = seleccionarMejorValorCasilla(sufijo, resultado[sufijo], valor, knownKeys);
        }
      }

      for (const [pattern, casilla] of directTextExtractors) {
        const value = linea.match(pattern)?.[1];
        if (!value) continue;
        const limpio = limpiarTextoExtraido(value);

        if (casilla === '0066') {
          refToPropertyIndex.set(normalizarRef(limpio), indiceInmuebleActual!);
        }

        if (casilla === '1212' || casilla === '1394') {
          const knownIndex = refToPropertyIndex.get(normalizarRef(limpio));
          if (knownIndex) {
            indiceInmuebleActual = knownIndex;
          } else {
            refToPropertyIndex.set(normalizarRef(limpio), indiceInmuebleActual!);
          }
        }

        setSufijo(casilla, limpio);
      }
    }
  }

  return resultado;
}

function limpiarTextoExtraido(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function limpiarEstadoCivil(value: string): string {
  return limpiarTextoExtraido(value).replace(/^\(\d+\)\s*/, '');
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}

function tieneDatosMinimosParaImportar(
  casillasRaw: CasillasRaw,
  fileName?: string,
  ejercicioFallback?: number,
): boolean {
  const ejercicio = detectarEjercicio(casillasRaw, fileName, ejercicioFallback);
  if (ejercicio < MIN_EJERCICIO) return false;

  const casillasClave = ['0435', '0460', '0505', '0500', '0595', '0609', '0610', '0670', '0025', '0224', '0154'];
  const presentes = casillasClave.filter((casilla) => typeof casillasRaw[casilla] === 'number').length;

  return presentes >= 2 || Object.keys(casillasRaw).length >= 8;
}

function mergeCasillasRaw(...sources: CasillasRaw[]): CasillasRaw {
  const merged: CasillasRaw = {};
  const knownKeys = new Set(
    sources.flatMap((source) => Object.keys(source)),
  );

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      merged[key] = seleccionarMejorValorCasilla(key, merged[key], value, knownKeys);
    }
  }

  return merged;
}

function seleccionarMejorValorCasilla(
  key: string,
  actual: number | string | undefined,
  candidato: number | string,
  knownKeys: Set<string>,
): number | string {
  if (actual === undefined) {
    return candidato;
  }

  if (actual === candidato) {
    return actual;
  }

  if (typeof actual === 'number' && typeof candidato === 'number') {
    const scoreActual = puntuarValorNumericoCasilla(key, actual, knownKeys);
    const scoreCandidato = puntuarValorNumericoCasilla(key, candidato, knownKeys);

    if (scoreCandidato > scoreActual) {
      return candidato;
    }

    if (scoreActual > scoreCandidato) {
      return actual;
    }

    return candidato;
  }

  if (typeof actual === 'string' && typeof candidato === 'string') {
    const actualTieneMasInfo = actual.length >= candidato.length;
    return actualTieneMasInfo ? actual : candidato;
  }

  return candidato;
}

function puntuarValorNumericoCasilla(
  key: string,
  value: number,
  knownKeys: Set<string>,
): number {
  let score = 0;
  const abs = Math.abs(value);

  if (!Number.isFinite(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (!Number.isInteger(value)) {
    score += 3;
  }

  if (abs >= 1000) {
    score += 2;
  }

  if (abs === 0) {
    score += 1;
  }

  if (Number.isInteger(value) && abs >= 1 && abs <= 9999) {
    const padded = String(abs).padStart(4, '0');
    if (padded === key) {
      score -= 6;
    } else if (knownKeys.has(padded)) {
      score -= 4;
    }
  }

  return score;
}

async function extraerCasillasConClaude(
  file: File,
  totalPaginas: number,
  onProgress?: OnProgress,
): Promise<CasillasRaw> {
  onProgress?.({
    fase: 'procesando',
    pagina: totalPaginas || undefined,
    totalPaginas: totalPaginas || undefined,
    mensaje: 'PDF sin texto seleccionable. Escaneando con IA...',
  });

  const response = await promiseWithTimeout(
    callClaudeAPI(file, construirPromptAEAT()),
    OCR_TIMEOUT_MS,
    new Error('OCR_TIMEOUT'),
  );

  return parsearRespuestaClaude(response);
}

function esTimeoutOCR(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /timeout|504|inactivity/i.test(message);
}

function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutError: Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(timeoutError), ms);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function callClaudeAPI(file: File, prompt: string): Promise<string> {
  const response = await callScanChat(file, 'application/pdf', 'scan_irpf', { prompt });

  if (typeof response.extraido === 'string') {
    return response.extraido;
  }

  return JSON.stringify(response.extraido ?? {});
}

function construirPromptAEAT(): string {
  return `Estás analizando una declaración completa de la Renta española (Modelo 100 — IRPF) en PDF.

TAREA: Extrae TODAS las casillas con su número y valor. Cada casilla tiene un número de 4 dígitos (como 0003, 0435, 0670, 1224) seguido de un valor numérico o de texto.

FORMATO DE RESPUESTA: Devuelve SOLO un JSON válido, sin markdown, sin explicación, sin preámbulo. El JSON debe ser un objeto donde:
- La clave es el número de casilla (string de 4 dígitos, ej: "0003")
- El valor es el número (como number, sin puntos de miles — usa punto decimal) o texto (string)

REGLAS:
1. Extrae ABSOLUTAMENTE TODAS las casillas que veas, sin excepción.
2. Recorre todas las páginas del PDF antes de responder.
3. Los importes en euros: quita los puntos de miles y usa punto como decimal (ej: "133.350,85" → 133350.85).
4. Las fechas déjalas como string: "28/09/1980".
5. Los NIF/NIE déjalos como string: "53069494F".
6. Los porcentajes como número: "100,00" → 100.
7. Si una casilla tiene "X" o una marca de selección, usa true.
8. Si una casilla está vacía o con "—", no la incluyas.
9. Las casillas de texto libre (direcciones, nombres, encabezados identificativos) como string.
10. Para casillas repetidas (varios inmuebles, varios titulares o bloques repetidos), usa sufijo: "0102_1", "0102_2", etc.
11. Para la sección "Información adicional" incluye también las casillas 1211-1423 si aparecen.
12. Incluye metadatos identificativos si los ves: ejercicio, nif, nombre, fecha_presentacion, numero_justificante, csv.
13. Las referencias catastrales son strings de ~20 caracteres y nunca deben convertirse a número.

Ejemplo de respuesta:
{
  "0001": "GOMEZ RAMIREZ JOSE ANTONIO",
  "0003": 133350.85,
  "0005": 907.51,
  "0012": 138670.33,
  "0066_1": "7949807TP6074N0006YM",
  "0069_1": "CL FUERTES ACEVEDO 0032 1 02 DR OVIEDO",
  "0075_1": true,
  "0101_1": 366,
  "0102_1": 19675,
  "0435": 150924.07,
  "0670": 2899.75,
  "1221_1": 6157.99,
  "1222_1": 6157.99
}

Analiza el PDF completo y extrae todo.`;
}

function normalizarClavesCasillas(raw: CasillasRaw): CasillasRaw {
  const normalizado: CasillasRaw = {};

  for (const [clave, valor] of Object.entries(raw)) {
    if (/^\d+$/.test(clave)) {
      normalizado[clave.padStart(4, '0')] = valor;
      continue;
    }

    normalizado[clave] = valor;
  }

  return normalizado;
}

function normalizarSufijosInmuebles(raw: CasillasRaw): CasillasRaw {
  const resultado: CasillasRaw = { ...raw };

  for (const casilla of CASILLAS_INMUEBLE_REPETIBLES) {
    if (casilla in resultado && !(`${casilla}_1` in resultado)) {
      resultado[`${casilla}_1`] = resultado[casilla];
      delete resultado[casilla];
    }
  }

  return resultado;
}

function parsearRespuestaClaude(textoRespuesta: string): CasillasRaw {
  let limpio = textoRespuesta.trim();
  if (limpio.startsWith('```json')) limpio = limpio.slice(7);
  if (limpio.startsWith('```')) limpio = limpio.slice(3);
  if (limpio.endsWith('```')) limpio = limpio.slice(0, -3);
  limpio = limpio.trim();

  try {
    const parsed = JSON.parse(limpio);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('[AEATParser] Respuesta no es un objeto:', typeof parsed);
      return {};
    }

    const resultado: CasillasRaw = {};
    for (const [casilla, valor] of Object.entries(parsed)) {
      if (valor === null || valor === undefined) continue;
      if (valor === true || valor === 'X' || valor === 'x') {
        resultado[casilla] = 'X';
        continue;
      }
      if (typeof valor === 'number') {
        resultado[casilla] = valor;
        continue;
      }
      if (typeof valor === 'string') {
        const trimmed = valor.trim();
        const normalizado = trimmed.replace(/\./g, '').replace(',', '.');
        const asNumber = Number.parseFloat(normalizado);
        if (!Number.isNaN(asNumber) && /^-?[\d.,]+$/.test(trimmed)) {
          resultado[casilla] = asNumber;
        } else {
          resultado[casilla] = trimmed;
        }
        continue;
      }
      resultado[casilla] = String(valor);
    }

    return normalizarSufijosInmuebles(normalizarClavesCasillas(resultado));
  } catch (error) {
    console.error('[AEATParser] Error parseando JSON de Claude:', error);
    console.error('[AEATParser] Texto recibido:', limpio.slice(0, 500));
    return {};
  }
}

function mapearCasillasADeclaracion(
  raw: CasillasRaw,
  fileName?: string,
  ejercicioFallback?: number,
): {
  declaracion: DeclaracionIRPF;
  inmuebles: InmuebleExtraidoCompleto[];
  arrastres: ExtraccionCompleta['arrastres'];
  meta: ExtraccionCompleta['meta'];
} {
  const n: NumericGetter = (casilla) => {
    const value = raw[casilla];
    return typeof value === 'number' ? value : 0;
  };
  const s: StringGetter = (casilla) => {
    const value = raw[casilla];
    return typeof value === 'string' ? value : '';
  };
  const b: BooleanGetter = (casilla) => {
    const value = raw[casilla];
    return value === 'X' || value === 'x';
  };

  const meta: ExtraccionCompleta['meta'] = {
    ejercicio: detectarEjercicio(raw, fileName, ejercicioFallback),
    modelo: '100',
    nif: s('0001_nif') || s('nif') || extraerNIF(raw),
    nombre: (() => {
      const candidatos = [s('nombre'), s('0002'), s('02'), s('0001_nombre')];
      const invalidos = ['DECLARANTE', 'CONYUGE', 'declarante', 'conyuge', ''];
      for (const candidato of candidatos) {
        if (candidato && !invalidos.includes(candidato.trim())) return candidato.trim();
      }
      return s('0001') || '';
    })(),
    fechaPresentacion: (() => {
      const fechaPresentacion = s('fecha_presentacion');
      if (fechaPresentacion && /\d{2}[/-]\d{2}[/-]\d{4}/.test(fechaPresentacion)) return fechaPresentacion;
      return undefined;
    })(),
    numeroJustificante: s('numero_justificante') || undefined,
    codigoVerificacion: s('csv') || undefined,
    esRectificativa: b('0103_rect') || b('0107_rect'),
  };

  const trabajo: DeclaracionTrabajo = {
    retribucionesDinerarias: n('0003'),
    retribucionEspecie: n('0007'),
    ingresosACuenta: n('0005'),
    contribucionesPPEmpresa: n('0008'),
    totalIngresosIntegros: n('0012'),
    cotizacionSS: n('0013'),
    rendimientoNetoPrevio: n('0018'),
    otrosGastosDeducibles: n('0019'),
    rendimientoNeto: n('0022'),
    rendimientoNetoReducido: n('0025') || n('0022'),
    retencionesTrabajoTotal: n('0596'),
  };

  const ejercicioDetectado = meta.ejercicio;
  const inmuebles = extraerInmuebles(raw, n, s, b);
  const actividades = extraerActividades(raw, n, s);

  const capitalMobiliario: DeclaracionCapitalMobiliario = {
    interesesCuentas: n('0027'),
    otrosRendimientos: n('0028') + n('0029') + n('0030') + n('0031') + n('0032') + n('0033') + n('0034') + n('0035'),
    totalIngresosIntegros: n('0036'),
    rendimientoNeto: n('0038'),
    rendimientoNetoReducido: n('0040') || n('0038'),
    retencionesCapital: n('0597'),
  };

  const gananciasPerdidas: DeclaracionGananciasPerdidas = {
    gananciasNoTransmision: n('0306'),
    perdidasNoTransmision: 0,
    saldoNetoGeneral: n('0420'),
    gananciasTransmision: n('0418') || n('0422'),
    perdidasTransmision: n('0423'),
    saldoNetoAhorro: n('0425') || n('0420'),
    compensacionPerdidasAnteriores: 0,
    perdidasPendientes: extraerPerdidasPendientes(raw, n, ejercicioDetectado),
  };

  const planPensiones: DeclaracionPlanPensiones = {
    aportacionesTrabajador: n('0426'),
    contribucionesEmpresariales: n('0427'),
    totalConDerecho: n('0467') || n('0468'),
    reduccionAplicada: n('0492'),
  };

  const basesYCuotas: DeclaracionBasesYCuotas = {
    baseImponibleGeneral: n('0435'),
    baseImponibleAhorro: n('0460'),
    baseLiquidableGeneral: n('0500') || n('0505'),
    baseLiquidableAhorro: n('0510'),
    cuotaIntegraEstatal: n('0545'),
    cuotaIntegraAutonomica: n('0546'),
    cuotaIntegra: n('0545') + n('0546'),
    cuotaLiquidaEstatal: n('0570'),
    cuotaLiquidaAutonomica: n('0571'),
    cuotaLiquida: n('0570') + n('0571'),
    cuotaResultante: n('0595'),
    retencionesTotal: n('0609'),
    cuotaDiferencial: n('0610'),
    resultadoDeclaracion: n('0670'),
  };

  const arrastres = extraerArrastres(raw, n, s, ejercicioDetectado);

  const declaracion: DeclaracionIRPF = {
    personal: {
      nif: meta.nif,
      nombre: meta.nombre,
      estadoCivil: s('estado_civil') || s('estadoCivil') || s('0006_estado') || detectarEstadoCivil(raw),
      comunidadAutonoma: detectarCCAA(raw),
      fechaNacimiento: s('fecha_nacimiento') || s('fechaNacimiento') || detectarFechaNacimiento(raw),
    },
    trabajo,
    inmuebles: inmuebles.map((inmueble) => inmueble.datos),
    actividades,
    capitalMobiliario,
    gananciasPerdidas,
    planPensiones,
    basesYCuotas,
    rentasImputadas: n('0155') > 0 ? { sumaImputaciones: n('0155') } : undefined,
  };

  return { declaracion, inmuebles, arrastres, meta };
}

function extraerInmuebles(
  raw: CasillasRaw,
  n: NumericGetter,
  s: StringGetter,
  b: BooleanGetter,
): InmuebleExtraidoCompleto[] {
  const inmuebles: InmuebleExtraidoCompleto[] = [];

  for (let i = 1; i <= 20; i += 1) {
    const suffix = `_${i}`;
    const refCatastral = s(`0066${suffix}`);
    const ingresos = n(`0102${suffix}`);
    const direccion = s(`0069${suffix}`);

    if (!refCatastral && !ingresos && !direccion) {
      continue;
    }

    const esArrendamiento = b(`0075${suffix}`);
    const esDisposicion = b(`0073${suffix}`);
    const esAccesorio = b(`0074${suffix}`);
    let uso: DeclaracionInmueble['uso'] = 'arrendamiento';
    if (esAccesorio) uso = 'accesorio';
    else if (esDisposicion && esArrendamiento) uso = 'mixto';
    else if (esDisposicion) uso = 'disposicion';

    const datos: DeclaracionInmueble = {
      orden: i,
      referenciaCatastral: refCatastral,
      direccion,
      porcentajePropiedad: n(`0063${suffix}`) || 100,
      uso,
      esAccesorio,
      refCatastralPrincipal: s(`0090${suffix}`) || undefined,
      derechoReduccion: b(`0100${suffix}`),
      nifArrendatario1: s(`0091${suffix}`) || undefined,
      nifArrendatario2: s(`0094${suffix}`) || undefined,
      fechaContrato: s(`0093${suffix}`) || undefined,
      diasArrendado: n(`0101${suffix}`),
      diasDisposicion: n(`0085${suffix}`),
      rentaImputada: n(`0089${suffix}`),
      ingresosIntegros: ingresos,
      arrastresRecibidos: n(`0103${suffix}`),
      arrastresAplicados: n(`0104${suffix}`),
      interesesFinanciacion: n(`0105${suffix}`),
      gastosReparacion: n(`0106${suffix}`),
      gastos0105_0106Aplicados: n(`0107${suffix}`),
      arrastresGenerados: n(`0108${suffix}`),
      gastosComunidad: n(`0109${suffix}`),
      gastosServicios: n(`0112${suffix}`),
      gastosSuministros: n(`0113${suffix}`),
      gastosSeguros: n(`0114${suffix}`),
      gastosTributos: n(`0115${suffix}`),
      amortizacionMuebles: n(`0117${suffix}`),
      tipoAdquisicion: b(`0118${suffix}`) ? 'onerosa' : undefined,
      fechaAdquisicion: s(`0120${suffix}`) || undefined,
      valorCatastral: n(`0123${suffix}`) || n(`0083${suffix}`) || undefined,
      valorCatastralConstruccion: n(`0124${suffix}`) || undefined,
      porcentajeConstruccion: n(`0125${suffix}`) || undefined,
      importeAdquisicion: n(`0126${suffix}`) || undefined,
      gastosAdquisicion: n(`0127${suffix}`) || undefined,
      mejoras: n(`0129${suffix}`) || undefined,
      baseAmortizacion: n(`0130${suffix}`) || undefined,
      amortizacionInmueble: n(`0131${suffix}`),
      accesorio: extraerAccesorio(n, s, b, suffix),
      rendimientoNeto: n(`0149${suffix}`),
      reduccion: n(`0150${suffix}`),
      rendimientoNetoReducido: n(`0154${suffix}`),
    };

    inmuebles.push({
      datos,
      extras: {
        situacion: s(`0065${suffix}`) || undefined,
        urbana: b(`0067${suffix}`) || undefined,
        tipoContribucion: s(`0062${suffix}`) || undefined,
      },
    });
  }

  return inmuebles.sort((a, bItem) => a.datos.orden - bItem.datos.orden);
}

function extraerAccesorio(
  n: NumericGetter,
  s: StringGetter,
  b: BooleanGetter,
  suffix: string,
): DeclaracionInmueble['accesorio'] | undefined {
  const tieneAccesorio = n(`0146${suffix}`) > 0 || n(`0138${suffix}`) > 0 || Boolean(s(`0135${suffix}`));
  if (!tieneAccesorio) {
    return undefined;
  }

  return {
    tipoAdquisicion: b(`0133${suffix}`) ? 'onerosa' : undefined,
    fechaAdquisicion: s(`0135${suffix}`) || undefined,
    diasArrendado: n(`0137${suffix}`) || undefined,
    valorCatastral: n(`0138${suffix}`) || undefined,
    valorCatastralConstruccion: n(`0139${suffix}`) || undefined,
    porcentajeConstruccion: n(`0140${suffix}`) || undefined,
    importeAdquisicion: n(`0141${suffix}`) || undefined,
    gastosAdquisicion: n(`0142${suffix}`) || undefined,
    baseAmortizacion: n(`0145${suffix}`) || undefined,
    amortizacion: n(`0146${suffix}`) || undefined,
  };
}

function extraerActividades(
  raw: CasillasRaw,
  n: NumericGetter,
  s: StringGetter,
): DeclaracionActividad[] {
  const actividades: DeclaracionActividad[] = [];

  for (let i = 1; i <= 5; i += 1) {
    const suffix = i === 1 ? '' : `_${i}`;
    const ingresos = n(`0180${suffix}`) || n(`0171${suffix}`);
    const epigrafe = s(`0167${suffix}`);

    if (!ingresos && !epigrafe) {
      continue;
    }

    actividades.push({
      contribuyente: 'declarante',
      tipoActividad: s(`0166${suffix}`) || 'A05',
      epigrafeIAE: epigrafe,
      modalidad: s(`0168${suffix}`).toLowerCase().includes('simplificada') ? 'simplificada' : 'normal',
      ingresos,
      gastos: n(`0218${suffix}`) || n(`0223${suffix}`),
      provisionDificilJustificacion: n(`0222${suffix}`) || undefined,
      rendimientoNeto: n(`0224${suffix}`),
      rendimientoNetoReducido: n(`0226${suffix}`) || n(`0231${suffix}`) || n(`0224${suffix}`),
      retencionesActividad: n('0599'),
    });
  }

  return actividades;
}

function extraerArrastres(
  raw: CasillasRaw,
  n: NumericGetter,
  s: StringGetter,
  ejercicio: number,
): ExtraccionCompleta['arrastres'] {
  const gastos: ArrastreExtraido[] = [];
  const perdidas: PerdidaExtraida[] = [];
  const gastosDetalle: GastoInmuebleDetalle[] = [];

  for (let i = 1; i <= 10; i += 1) {
    const suffix = `_${i}`;
    const ref = s(`1212${suffix}`);
    if (!ref) continue;

    const pendienteInicio = n(`1221${suffix}`);
    const aplicado = n(`1222${suffix}`);
    const generado = n(`1224${suffix}`);

    gastos.push({
      referenciaCatastral: ref,
      ejercicioOrigen: ejercicio,
      pendienteInicio,
      aplicadoEstaDeclaracion: aplicado,
      pendienteFuturo: Math.max(0, pendienteInicio - aplicado + generado),
      generadoEsteEjercicio: generado,
    });
  }

  if (n('1264') > 0 || n('1266') > 0) {
    perdidas.push({
      tipo: 'ahorro',
      ejercicioOrigen: ejercicio - 2,
      pendienteInicio: n('1264'),
      aplicado: n('1265'),
      pendienteFuturo: n('1266'),
    });
  }

  if (n('1267') > 0 || n('1269') > 0) {
    perdidas.push({
      tipo: 'ahorro',
      ejercicioOrigen: ejercicio - 1,
      pendienteInicio: n('1267'),
      aplicado: n('1268'),
      pendienteFuturo: n('1269'),
    });
  }

  for (let i = 1; i <= 10; i += 1) {
    const suffix = `_${i}`;
    const ref = s(`1394${suffix}`);
    if (!ref) continue;

    gastosDetalle.push({
      referenciaCatastral: ref,
      nifProveedor: s(`1395${suffix}`) || undefined,
      importeGasto: n(`1396${suffix}`) || undefined,
      nifServiciosPersonales: s(`1416${suffix}`) || undefined,
      importeServiciosPersonales: n(`1417${suffix}`) || undefined,
      fechaMejora: s(`1421${suffix}`) || undefined,
      nifMejora: s(`1422${suffix}`) || undefined,
      importeMejora: n(`1423${suffix}`) || undefined,
    });
  }

  return { gastos0105_0106: gastos, perdidasAhorro: perdidas, gastosInmuebleDetalle: gastosDetalle };
}

function extraerPerdidasPendientes(
  _raw: CasillasRaw,
  n: NumericGetter,
  ejercicio: number,
): PerdidasPendientes[] {
  const perdidas: PerdidasPendientes[] = [];

  if (n('1266') > 0) {
    perdidas.push({
      ejercicioOrigen: ejercicio - 2,
      importeOriginal: n('1264'),
      importeAplicado: n('1265'),
      importePendiente: n('1266'),
      caducaEjercicio: ejercicio + 2,
      origen: `ahorro_${ejercicio - 2}`,
    });
  }

  if (n('1269') > 0) {
    perdidas.push({
      ejercicioOrigen: ejercicio - 1,
      importeOriginal: n('1267'),
      importeAplicado: n('1268'),
      importePendiente: n('1269'),
      caducaEjercicio: ejercicio + 3,
      origen: `ahorro_${ejercicio - 1}`,
    });
  }

  return perdidas;
}

function validarCoherencia(declaracion: DeclaracionIRPF): { warnings: string[] } {
  const warnings: string[] = [];
  const resultado = declaracion.basesYCuotas.resultadoDeclaracion;
  const cuota = declaracion.basesYCuotas.cuotaResultante;
  const retenciones = declaracion.basesYCuotas.retencionesTotal;

  if (cuota > 0 && retenciones > 0) {
    const esperado = cuota - retenciones;
    if (Math.abs(resultado - esperado) > 5) {
      warnings.push(`El resultado (${resultado}) no cuadra con cuota (${cuota}) - retenciones (${retenciones}) = ${esperado}`);
    }
  }

  const sumaRetenciones =
    declaracion.trabajo.retencionesTrabajoTotal +
    declaracion.capitalMobiliario.retencionesCapital +
    declaracion.actividades.reduce((sum, actividad) => sum + (actividad.retencionesActividad || 0), 0);
  if (retenciones > 0 && Math.abs(retenciones - sumaRetenciones) > 10) {
    warnings.push(`La suma de retenciones parciales (${sumaRetenciones}) difiere del total (${retenciones})`);
  }

  if (declaracion.trabajo.rendimientoNetoReducido > 0 && declaracion.basesYCuotas.baseImponibleGeneral === 0) {
    warnings.push('Hay rendimientos del trabajo pero la base imponible general es 0');
  }

  return { warnings };
}

function normalizarEjercicio(valor: unknown): number | null {
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    return null;
  }

  const texto = typeof valor === 'number'
    ? String(Math.trunc(valor))
    : valor.trim();

  if (!texto) return null;

  const numero = Number.parseInt(texto, 10);
  if (!Number.isInteger(numero)) {
    return null;
  }

  if (numero >= MIN_EJERCICIO && numero <= MAX_EJERCICIO) {
    return numero;
  }

  if (numero >= 20 && numero <= 99) {
    return 2000 + numero;
  }

  return null;
}

function detectarEjercicioDesdeTexto(value: string): number | null {
  const matchEtiquetado = value.match(/Ejercicio(?:\s+fiscal)?\s*:?\s*(20\d{2}|\d{2})/i);
  if (matchEtiquetado) {
    return normalizarEjercicio(matchEtiquetado[1]);
  }

  const years = value.match(/\b(?:20\d{2}|\d{2})\b/g) ?? [];
  for (const candidate of years) {
    const normalizado = normalizarEjercicio(candidate);
    if (normalizado && normalizado >= MIN_EJERCICIO && normalizado <= MAX_EJERCICIO) {
      return normalizado;
    }
  }

  return null;
}

export function detectarEjercicio(
  raw: CasillasRaw,
  fileName?: string,
  ejercicioFallback?: number,
): number {
  const candidatosDirectos = [raw.ejercicio, raw.anio, raw.year];
  for (const candidato of candidatosDirectos) {
    const anio = normalizarEjercicio(candidato);
    if (anio && anio >= MIN_EJERCICIO) {
      return anio;
    }
  }

  const expediente = raw.expediente_referencia;
  if (typeof expediente === 'string') {
    const match = expediente.match(/^(\d{4}|\d{2})/);
    if (match) {
      const anio = normalizarEjercicio(match[1]);
      if (anio && anio >= MIN_EJERCICIO) {
        return anio;
      }
    }
  }

  const yearCandidates = new Set<number>();
  const keyHints = ['ejercicio', 'year', 'anio', 'año'];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;

    const keyLower = key.toLowerCase();
    const detectado = detectarEjercicioDesdeTexto(value);
    if (detectado && (keyHints.some((hint) => keyLower.includes(hint)) || /ejercicio|año|anio/i.test(value))) {
      yearCandidates.add(detectado);
    }
  }

  const ejercicioDesdeNombre = fileName ? detectarEjercicioDesdeTexto(fileName) : null;
  if (ejercicioDesdeNombre) {
    yearCandidates.add(ejercicioDesdeNombre);
  }

  const ejercicioManual = normalizarEjercicio(ejercicioFallback);
  if (ejercicioManual && ejercicioManual >= MIN_EJERCICIO) {
    yearCandidates.add(ejercicioManual);
  }

  const ordered = Array.from(yearCandidates)
    .filter((year) => year >= MIN_EJERCICIO && year <= MAX_EJERCICIO)
    .sort((a, b) => b - a);

  return ordered[0] ?? 0;
}

function extraerNIF(raw: CasillasRaw): string {
  for (const value of Object.values(raw)) {
    if (typeof value !== 'string') continue;
    if (/^\d{8}[A-Z]$/.test(value)) return value;
    if (/^[XYZ]\d{7}[A-Z]$/.test(value)) return value;
  }
  return '';
}

function detectarEstadoCivil(raw: CasillasRaw): string {
  const directo = raw['estado_civil'] || raw['estadoCivil'];
  if (typeof directo === 'string' && directo.trim()) return directo.trim();

  const val0006 = raw['0006'];
  if (val0006 === 'X' || val0006 === 'x') return 'Soltero/a';
  if (typeof val0006 === 'string' && /soltero/i.test(val0006)) return 'Soltero/a';
  if (typeof val0006 === 'string' && /casado/i.test(val0006)) return 'Casado/a';

  for (const value of Object.values(raw)) {
    if (typeof value !== 'string') continue;
    if (/\(1\)\s*soltero/i.test(value)) return 'Soltero/a';
    if (/\(2\)\s*casado/i.test(value)) return 'Casado/a';
    if (/\(3\)\s*viudo/i.test(value)) return 'Viudo/a';
    if (/\(4\)\s*divorciado/i.test(value)) return 'Divorciado/a';
    if (/\(4\)\s*separado/i.test(value)) return 'Separado/a';
    if (/soltero/i.test(value) && value.length < 30) return 'Soltero/a';
    if (/casado/i.test(value) && value.length < 30) return 'Casado/a';
    if (/viudo/i.test(value) && value.length < 30) return 'Viudo/a';
    if (/divorciado/i.test(value) && value.length < 30) return 'Divorciado/a';
    if (/separado/i.test(value) && value.length < 30) return 'Separado/a';
  }

  return '';
}

function detectarFechaNacimiento(raw: CasillasRaw): string {
  const directo = raw['fecha_nacimiento'];
  if (typeof directo === 'string' && /\d{2}\/\d{2}\/\d{4}/.test(directo)) return directo;

  const val0010 = raw['0010'];
  if (typeof val0010 === 'string' && /\d{2}\/\d{2}\/\d{4}/.test(val0010)) return val0010;

  for (const value of Object.values(raw)) {
    if (typeof value !== 'string') continue;
    const match = value.match(/(\d{2}\/\d{2}\/19[5-9]\d)/);
    if (match) return match[1];
  }

  return '';
}

function detectarCCAA(raw: CasillasRaw): string {
  const directo = raw['comunidad_autonoma'];
  if (typeof directo === 'string' && directo.trim()) return directo.trim();

  const codigo = raw['0070'];
  if (typeof codigo === 'number' && CCAA_CODES[codigo]) return CCAA_CODES[codigo];
  if (typeof codigo === 'string') {
    const num = Number.parseInt(codigo, 10);
    if (!Number.isNaN(num) && CCAA_CODES[num]) return CCAA_CODES[num];
  }

  const casilla0010 = raw['0010'];
  if (typeof casilla0010 === 'string' && casilla0010.trim().length > 3) {
    for (const [, nombre] of Object.entries(CCAA_CODES)) {
      if (casilla0010.toUpperCase().includes(nombre.toUpperCase())) return nombre;
    }
    return casilla0010.trim();
  }
  if (typeof casilla0010 === 'number' && CCAA_CODES[casilla0010]) {
    return CCAA_CODES[casilla0010];
  }

  for (const value of Object.values(raw)) {
    if (typeof value !== 'string') continue;
    for (const [, nombre] of Object.entries(CCAA_CODES)) {
      if (value.toUpperCase().includes(nombre.toUpperCase())) return nombre;
    }
  }

  for (const value of Object.values(raw)) {
    if (typeof value === 'string' && /MADRID/i.test(value)) return 'Madrid';
  }

  return '';
}

export const __private__ = {
  buscarCabeceraPdf,
  detectarEstadoCivil,
  detectarCCAA,
  detectarFechaNacimiento,
  esTimeoutOCR,
  extraerCasillasDeterministasDesdeTexto,
  leerBytesPdfNormalizados,
  tieneDatosMinimosParaImportar,
};

function declaracionVacia(): DeclaracionIRPF {
  return {
    personal: {
      nif: '',
      nombre: '',
      estadoCivil: '',
      comunidadAutonoma: '',
      fechaNacimiento: '',
    },
    trabajo: {
      retribucionesDinerarias: 0,
      retribucionEspecie: 0,
      ingresosACuenta: 0,
      contribucionesPPEmpresa: 0,
      totalIngresosIntegros: 0,
      cotizacionSS: 0,
      rendimientoNetoPrevio: 0,
      otrosGastosDeducibles: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesTrabajoTotal: 0,
    },
    inmuebles: [],
    actividades: [],
    capitalMobiliario: {
      interesesCuentas: 0,
      otrosRendimientos: 0,
      totalIngresosIntegros: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesCapital: 0,
    },
    gananciasPerdidas: {
      gananciasNoTransmision: 0,
      perdidasNoTransmision: 0,
      saldoNetoGeneral: 0,
      gananciasTransmision: 0,
      perdidasTransmision: 0,
      saldoNetoAhorro: 0,
      compensacionPerdidasAnteriores: 0,
      perdidasPendientes: [],
    },
    planPensiones: {
      aportacionesTrabajador: 0,
      contribucionesEmpresariales: 0,
      totalConDerecho: 0,
      reduccionAplicada: 0,
    },
    basesYCuotas: {
      baseImponibleGeneral: 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0,
      baseLiquidableAhorro: 0,
      cuotaIntegraEstatal: 0,
      cuotaIntegraAutonomica: 0,
      cuotaIntegra: 0,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      cuotaLiquida: 0,
      cuotaResultante: 0,
      retencionesTotal: 0,
      cuotaDiferencial: 0,
      resultadoDeclaracion: 0,
    },
  };
}
