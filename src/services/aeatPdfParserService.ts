/** @deprecated Usa src/services/aeatParserService.ts para nuevas integraciones basadas en Claude Vision. */
import { callScanChat } from './scanChatService';

export interface ArrastreImportadoInput {
  tipo: 'gastos_0105_0106' | 'perdidas_patrimoniales_ahorro';
  ejercicioOrigen: number;
  importe: number;
}

export interface ImportacionManualData {
  ejercicio: number;
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  baseLiquidableGeneral: number;
  baseLiquidableAhorro: number;
  cuotaIntegraEstatal: number;
  cuotaIntegraAutonomica: number;
  cuotaLiquidaEstatal: number;
  cuotaLiquidaAutonomica: number;
  cuotaResultante: number;
  retencionTrabajo: number;
  retencionCapitalMobiliario: number;
  retencionActividadesEcon: number;
  pagosFraccionados: number;
  totalRetenciones: number;
  resultado: number;
  regularizacion?: number;
  rendimientosTrabajo?: number;
  rendimientosInmuebles?: number;
  rendimientosAutonomo?: number;
  arrastres?: ArrastreImportadoInput[];
}

export interface CasillaExtraida {
  numero: string;
  valor: number;
  confianza: 'alta' | 'media' | 'baja';
  lineaOriginal: string;
}

export function crearImportacionManualVacia(ejercicio: number): ImportacionManualData {
  return {
    ejercicio,
    baseImponibleGeneral: 0,
    baseImponibleAhorro: 0,
    baseLiquidableGeneral: 0,
    baseLiquidableAhorro: 0,
    cuotaIntegraEstatal: 0,
    cuotaIntegraAutonomica: 0,
    cuotaLiquidaEstatal: 0,
    cuotaLiquidaAutonomica: 0,
    cuotaResultante: 0,
    retencionTrabajo: 0,
    retencionCapitalMobiliario: 0,
    retencionActividadesEcon: 0,
    pagosFraccionados: 0,
    totalRetenciones: 0,
    resultado: 0,
    regularizacion: undefined,
    rendimientosTrabajo: undefined,
    rendimientosInmuebles: undefined,
    rendimientosAutonomo: undefined,
    arrastres: [],
  };
}

export function extraerCasillasDesdeTextoModelo100(text: string): CasillaExtraida[] {
  const lineas = text
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  const casillas: CasillaExtraida[] = [];
  const regex = /(-?[\d.]+,\d{2})\s+(\d{4})\s*$/;

  for (const linea of lineas) {
    const match = linea.match(regex);
    if (!match) continue;
    const valor = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(valor)) continue;
    casillas.push({
      numero: match[2],
      valor,
      confianza: 'alta',
      lineaOriginal: linea,
    });
  }

  const mapa = new Map<string, CasillaExtraida>();
  casillas.forEach((casilla) => mapa.set(casilla.numero, casilla));
  return Array.from(mapa.values());
}

export async function extraerCasillasDeModeloPDF(
  pdfFile: File,
  onProgress?: (msg: string) => void,
): Promise<CasillaExtraida[]> {
  onProgress?.('Extrayendo texto del PDF...');
  const text = await extraerTextoDeModeloPDF(pdfFile);
  const casillasTexto = extraerCasillasDesdeTextoModelo100(text);

  if (casillasTexto.length >= 5) {
    onProgress?.(`${casillasTexto.length} casillas extraídas por texto`);
    return casillasTexto;
  }

  onProgress?.('PDF sin texto seleccionable. Escaneando con IA...');
  try {
    const casillasOCR = await extractCasillasViaOCR(pdfFile, onProgress);
    if (casillasOCR.length > 0) {
      onProgress?.(`${casillasOCR.length} casillas extraídas por OCR`);
      return casillasOCR;
    }
  } catch (error) {
    console.error('Error en OCR del Modelo 100:', error);
    onProgress?.('Error en el escaneo OCR. Usa el formulario manual.');
  }

  onProgress?.('No se pudieron extraer casillas automáticamente');
  return casillasTexto;
}

export function mapearCasillasAImportacion(casillas: CasillaExtraida[], ejercicio: number): ImportacionManualData {
  const base = crearImportacionManualVacia(ejercicio);
  const map = new Map<string, number>();

  casillas.forEach((casilla) => {
    map.set(casilla.numero, casilla.valor);

    const matchCasillaBase = casilla.numero.match(/^(\d{4})_\d+$/);
    if (matchCasillaBase && !map.has(matchCasillaBase[1])) {
      map.set(matchCasillaBase[1], casilla.valor);
    }
  });

  const get = (...numeros: string[]): number => {
    for (const numero of numeros) {
      const value = map.get(numero);
      if (typeof value === 'number' && value !== 0) {
        return value;
      }
    }

    for (const numero of numeros) {
      const value = map.get(numero);
      if (typeof value === 'number') {
        return value;
      }
    }

    return 0;
  };

  return {
    ...base,
    baseImponibleGeneral: get('0435'),
    baseImponibleAhorro: get('0460'),
    baseLiquidableGeneral: get('0505', '0500'),
    baseLiquidableAhorro: get('0510'),
    cuotaIntegraEstatal: get('0545'),
    cuotaIntegraAutonomica: get('0546'),
    cuotaLiquidaEstatal: get('0570'),
    cuotaLiquidaAutonomica: get('0571'),
    cuotaResultante: get('0595', '0587'),
    retencionTrabajo: get('0596'),
    retencionCapitalMobiliario: get('0597'),
    retencionActividadesEcon: get('0599'),
    pagosFraccionados: get('0604'),
    totalRetenciones: get('0609'),
    resultado: get('0670', '0610'),
    regularizacion: map.has('0676') ? get('0676') : undefined,
    rendimientosTrabajo: map.has('0025') || map.has('0022') ? get('0025', '0022') : undefined,
    rendimientosInmuebles: map.has('0156') ? get('0156') : undefined,
    rendimientosAutonomo: map.has('0226') || map.has('0224') ? get('0226', '0224') : undefined,
  };
}

export interface PDFTextItem {
  str: string;
  transform: number[];
}

export function reconstruirLineasPDF(items: PDFTextItem[]): string[] {
  if (items.length === 0) {
    return [];
  }

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 3) {
      return yDiff;
    }

    return a.transform[4] - b.transform[4];
  });

  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentY = sorted[0]?.transform[5] ?? 0;

  for (const item of sorted) {
    const itemY = item.transform[5];

    if (Math.abs(itemY - currentY) > 3) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
      }

      currentLine = [];
      currentY = itemY;
    }

    if (item.str.trim()) {
      currentLine.push(item.str);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
  }

  return lines;
}

export async function extraerTextoDeModeloPDF(file: File): Promise<string> {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = reconstruirLineasPDF(content.items as PDFTextItem[]);

    if (lines.length > 0) {
      pages.push(lines.join('\n'));
    }
  }

  return pages.join('\n');
}

async function extractCasillasViaOCR(
  pdfFile: File,
  onProgress?: (msg: string) => void,
): Promise<CasillaExtraida[]> {
  onProgress?.('Enviando PDF a Claude para extracción...');

  const result = await callScanChat(pdfFile, 'application/pdf', 'scan_irpf');
  if (!result.extraido) {
    throw new Error(result.error || 'Respuesta vacía del OCR');
  }

  onProgress?.('Procesando casillas extraídas...');

  const data = typeof result.extraido === 'string'
    ? JSON.parse(result.extraido)
    : result.extraido;

  const casillas: CasillaExtraida[] = [];

  for (const [numero, valor] of Object.entries(data as Record<string, unknown>)) {
    if (/^\d{4}$/.test(numero) && typeof valor === 'number' && !Number.isNaN(valor)) {
      casillas.push({
        numero,
        valor,
        confianza: 'media',
        lineaOriginal: `[OCR] casilla ${numero}: ${valor}`,
      });
    }
  }

  return casillas;
}
