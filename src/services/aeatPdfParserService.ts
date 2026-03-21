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

export async function extraerCasillasDeModeloPDF(pdfFile: File): Promise<CasillaExtraida[]> {
  const text = await extractTextFromPDF(pdfFile);
  return extraerCasillasDesdeTextoModelo100(text);
}

export function mapearCasillasAImportacion(casillas: CasillaExtraida[], ejercicio: number): ImportacionManualData {
  const base = crearImportacionManualVacia(ejercicio);
  const get = (numero: string): number => casillas.find((casilla) => casilla.numero === numero)?.valor ?? 0;

  return {
    ...base,
    baseImponibleGeneral: get('0435'),
    baseImponibleAhorro: get('0460'),
    baseLiquidableGeneral: get('0505') || get('0500'),
    baseLiquidableAhorro: get('0510'),
    cuotaIntegraEstatal: get('0545'),
    cuotaIntegraAutonomica: get('0546'),
    cuotaLiquidaEstatal: get('0570'),
    cuotaLiquidaAutonomica: get('0571'),
    cuotaResultante: get('0595'),
    retencionTrabajo: get('0596'),
    retencionCapitalMobiliario: get('0597'),
    retencionActividadesEcon: get('0599'),
    pagosFraccionados: get('0604'),
    totalRetenciones: get('0609'),
    resultado: get('0670'),
    regularizacion: get('0676') || undefined,
    rendimientosTrabajo: get('0025') || get('0022') || undefined,
    rendimientosInmuebles: get('0156') || undefined,
    rendimientosAutonomo: get('0226') || get('0224') || undefined,
  };
}

async function extractTextFromPDF(file: File): Promise<string> {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let text = '';
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    text += `${pageText}\n`;
  }

  return text;
}
