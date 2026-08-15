/**
 * justificantePdfImportService.ts
 *
 * Import del RESUMEN de una declaración IRPF (Modelo 100) desde el PDF del
 * justificante de la AEAT, de forma DETERMINISTA y sin conversores externos.
 *
 * La lectura del PDF (pdfjs) y la extracción de casillas por texto ya existían
 * en `aeatParserService` (`prepararPdfParaAnalisis`, `extraerCasillasDeterministasDesdeTexto`),
 * pero producían un tipo divergente (`ExtraccionCompleta`) que NO fluía por el
 * pipeline unificado `distribuirDeclaracion`, y caían a un modelo de visión por
 * red cuando el texto rendía pocas casillas. Aquí se cierra ese hueco:
 *
 *   texto del justificante → casillas deterministas → DeclaracionCompleta ('pdf')
 *   → distribuirDeclaracion (el MISMO pipeline que el XML)
 *
 * Sin red: si el justificante no expone texto suficiente, se lanza un error para
 * que el usuario complete a mano, en vez de delegar en un conversor externo.
 */
import {
  detectarEjercicio,
  extraerCasillasDeterministasDesdeTexto,
  prepararPdfParaAnalisis,
} from './aeatParserService';
import type {
  DeclaracionCompleta,
  Declarante,
  IntegracionFiscal,
  MetaDeclaracion,
  ResultadoDeclaracion,
} from '../types/declaracionCompleta';

type CasillasRaw = Record<string, number | string>;

/** Casillas mínimas para considerar el resumen fiable sin refuerzo externo. */
const MIN_CASILLAS_RESUMEN = 5;
/** Histórico de ATLAS (coincide con MIN_EJERCICIO del parser AEAT). */
const MIN_EJERCICIO = 2020;

/**
 * Mapea las casillas ya extraídas (deterministas) del justificante a una
 * `DeclaracionCompleta` con `fuenteImportacion: 'pdf'`. Función PURA: no lee el
 * PDF ni la red, así que es directamente testeable desde el texto extraído.
 *
 * Sólo puebla el RESUMEN (bases, cuotas, retenciones, resultado) y los
 * metadatos (ejercicio, nº justificante, CSV). Los inmuebles quedan vacíos: el
 * desglose por inmueble sigue siendo terreno del XML, más rico. El distribuidor
 * acepta `inmuebles: []` sin problema (guarda el ejercicio y su resultado).
 */
export function construirDeclaracionCompletaDesdeCasillas(
  raw: CasillasRaw,
  opts: { ejercicioFallback?: number; fileName?: string } = {},
): DeclaracionCompleta {
  const num = (casilla: string): number => {
    const v = raw[casilla];
    return typeof v === 'number' ? v : 0;
  };
  const str = (clave: string): string => {
    const v = raw[clave];
    return typeof v === 'string' ? v : '';
  };

  const ejercicio = detectarEjercicio(raw, opts.fileName, opts.ejercicioFallback);

  // Sólo las casillas numéricas del Modelo 100 (0435, 0670, 0109_1, ...), no los
  // metadatos textuales (ejercicio, nif, csv...) que comparten el mismo mapa.
  const casillas: Record<string, number> = {};
  for (const [clave, valor] of Object.entries(raw)) {
    if (typeof valor === 'number' && /^\d{4}(_\d+)?$/.test(clave)) {
      casillas[clave] = valor;
    }
  }

  // Mapeo casilla→campo idéntico al del parser AEAT (mapearCasillasADeclaracion):
  // 0435/0460 bases imponibles, 0545/0546 cuotas íntegras, 0570/0571 líquidas,
  // 0609 retenciones, 0610 cuota diferencial, 0670 resultado de la declaración.
  const resultado: ResultadoDeclaracion = {
    cuotaIntegraEstatal: num('0545'),
    cuotaIntegraAutonomica: num('0546'),
    cuotaLiquidaEstatal: num('0570'),
    cuotaLiquidaAutonomica: num('0571'),
    deduccionesAutonomicas: 0,
    deduccionesEstatales: 0,
    cuotaAutoliquidacion: num('0595'),
    totalRetencionesPagos: num('0609'),
    cuotaDiferencial: num('0610'),
    resultadoDeclaracion: num('0670') || num('0610'),
  };

  const integracion: IntegracionFiscal = {
    baseImponibleGeneral: num('0435'),
    baseImponibleAhorro: num('0460'),
    reduccionPP: num('0492'),
    baseLiquidableGeneral: num('0500') || num('0505'),
    baseLiquidableAhorro: num('0510'),
    minimoPersonalEstatal: 0,
    minimoPersonalAutonomico: 0,
  };

  const meta: MetaDeclaracion = {
    ejercicio,
    modelo: '100',
    fechaPresentacion: str('fecha_presentacion'),
    numeroJustificante: str('numero_justificante'),
    csv: str('csv'),
    referencia: str('expediente_referencia'),
    fuenteImportacion: 'pdf',
    // Extracción textual determinista: alta, pero no total como el XML (que trae
    // el desglose completo). Deja constancia de que el resumen viene del PDF.
    confianza: 'alta',
    esComplementaria: false,
    esRectificativa: false,
    tipoDeclaracion: 'I',
  };

  const declarante: Declarante = {
    nif: str('nif'),
    nombreCompleto: str('nombre'),
    nombreCCAA: str('comunidad_autonoma') || undefined,
    tributacion: 'individual',
    asignacionSocial: false,
    asignacionIglesia: false,
  };

  return {
    meta,
    declarante,
    inmuebles: [],
    integracion,
    resultado,
    arrastres: { gastosPendientes: [], perdidasPatrimoniales: [] },
    casillas,
    camposExtra: {},
  };
}

/** Nº de casillas numéricas del Modelo 100 presentes en el mapa extraído. */
function contarCasillasNumericas(raw: CasillasRaw): number {
  return Object.entries(raw).filter(
    ([clave, valor]) => typeof valor === 'number' && /^\d{4}(_\d+)?$/.test(clave),
  ).length;
}

/**
 * Lee el PDF del justificante y devuelve una `DeclaracionCompleta` lista para
 * `distribuirDeclaracion`, 100% determinista (pdfjs + regex), sin red.
 *
 * Lanza si el PDF no expone texto suficiente (justificante escaneado como
 * imagen, o documento que no es un Modelo 100): el llamador debe ofrecer el
 * alta manual, nunca un conversor externo — de ahí el nombre del hueco cerrado.
 */
export async function importarJustificantePdf(
  file: File,
  ejercicioFallback?: number,
): Promise<DeclaracionCompleta> {
  const { paginasTexto } = await prepararPdfParaAnalisis(file);
  const raw = extraerCasillasDeterministasDesdeTexto(paginasTexto);

  if (contarCasillasNumericas(raw) < MIN_CASILLAS_RESUMEN) {
    throw new Error(
      'El PDF no expone texto suficiente para leer el resumen de forma fiable. ' +
        'Sube el justificante original de la AEAT (no una impresión escaneada) o introduce los datos a mano.',
    );
  }

  const ejercicio = detectarEjercicio(raw, file.name, ejercicioFallback);
  if (ejercicio < MIN_EJERCICIO) {
    throw new Error(`No se pudo determinar el ejercicio del justificante (el histórico de ATLAS empieza en ${MIN_EJERCICIO}).`);
  }

  return construirDeclaracionCompletaDesdeCasillas(raw, { ejercicioFallback, fileName: file.name });
}
