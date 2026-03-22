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

export async function parsearDeclaracionAEAT(
  file: File,
  onProgress?: OnProgress,
): Promise<ExtraccionCompleta> {
  const errores: string[] = [];
  const warnings: string[] = [];

  try {
    onProgress?.({ fase: 'preparando', mensaje: 'Preparando PDF completo para análisis...' });
    const totalPaginas = await obtenerNumeroPaginasPDF(file);

    onProgress?.({
      fase: 'enviando',
      mensaje: totalPaginas > 0
        ? `Enviando PDF completo (${totalPaginas} páginas) a Claude...`
        : 'Enviando PDF completo a Claude...',
      totalPaginas: totalPaginas || undefined,
    });

    const casillasRaw = await extraerCasillasConClaude(file, totalPaginas, onProgress);
    if (Object.keys(casillasRaw).length === 0) {
      return resultadoError('Claude no pudo extraer casillas del PDF');
    }

    const ejercicioDetectado = detectarEjercicio(casillasRaw);
    if (ejercicioDetectado < MIN_EJERCICIO) {
      return resultadoError('El histórico de ATLAS empieza en 2020');
    }

    onProgress?.({ fase: 'mapeando', mensaje: 'Organizando datos extraídos...' });
    const { declaracion, inmuebles, arrastres, meta } = mapearCasillasADeclaracion(casillasRaw);

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
    return resultadoError(`Error procesando PDF: ${error instanceof Error ? error.message : 'desconocido'}`);
  }
}

function resultadoError(mensaje: string): ExtraccionCompleta {
  return {
    exito: false,
    errores: [mensaje],
    warnings: [],
    meta: { ejercicio: 0, modelo: '100', nif: '', nombre: '', esRectificativa: false },
    declaracion: declaracionVacia(),
    casillasRaw: {},
    inmueblesDetalle: [],
    arrastres: { gastos0105_0106: [], perdidasAhorro: [], gastosInmuebleDetalle: [] },
    paginasProcesadas: 0,
    totalCasillas: 0,
  };
}

async function obtenerNumeroPaginasPDF(file: File): Promise<number> {
  try {
    const { pdfjs } = await import('react-pdf');
    pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.warn('[AEATParser] No se pudo leer el número de páginas del PDF:', error);
    return 0;
  }
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
    mensaje: totalPaginas > 0
      ? `Analizando declaración completa (${totalPaginas} páginas) con IA...`
      : 'Analizando declaración completa con IA...',
  });

  const prompt = construirPromptAEAT();
  const response = await callClaudeAPI(file, prompt);

  onProgress?.({
    fase: 'procesando',
    pagina: totalPaginas || undefined,
    totalPaginas: totalPaginas || undefined,
    mensaje: 'Procesando respuesta de Claude...',
  });

  return parsearRespuestaClaude(response);
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

    return resultado;
  } catch (error) {
    console.error('[AEATParser] Error parseando JSON de Claude:', error);
    console.error('[AEATParser] Texto recibido:', limpio.slice(0, 500));
    return {};
  }
}

function mapearCasillasADeclaracion(raw: CasillasRaw): {
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
    ejercicio: detectarEjercicio(raw),
    modelo: '100',
    nif: s('0001_nif') || s('nif') || extraerNIF(raw),
    nombre: s('0001') || s('0002') || '',
    fechaPresentacion: s('fecha_presentacion') || undefined,
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
    perdidasPendientes: extraerPerdidasPendientes(raw, n),
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

  const arrastres = extraerArrastres(raw, n, s);

  const declaracion: DeclaracionIRPF = {
    personal: {
      nif: meta.nif,
      nombre: meta.nombre,
      estadoCivil: s('0006_estado') || detectarEstadoCivil(raw),
      comunidadAutonoma: s('0070') || detectarCCAA(raw),
      fechaNacimiento: s('0010') || '',
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
      valorCatastral: n(`0123${suffix}`) || undefined,
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
): ExtraccionCompleta['arrastres'] {
  const gastos: ArrastreExtraido[] = [];
  const perdidas: PerdidaExtraida[] = [];
  const gastosDetalle: GastoInmuebleDetalle[] = [];
  const ejercicio = detectarEjercicio(raw);

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

function extraerPerdidasPendientes(raw: CasillasRaw, n: NumericGetter): PerdidasPendientes[] {
  const perdidas: PerdidasPendientes[] = [];
  const ejercicio = detectarEjercicio(raw);

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

function detectarEjercicio(raw: CasillasRaw): number {
  const yearCandidates = new Set<number>();

  const keyHints = ['ejercicio', 'year'];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;

    const keyLower = key.toLowerCase();
    const matches = value.match(/(20\d{2})/g) ?? [];
    matches.forEach((match) => {
      const year = Number.parseInt(match, 10);
      if (year >= 2010 && year <= 2100) {
        if (keyHints.some((hint) => keyLower.includes(hint)) || /ejercicio/i.test(value)) {
          yearCandidates.add(year);
        }
      }
    });
  }

  const ordered = Array.from(yearCandidates).sort((a, b) => b - a);
  if (ordered[0]) {
    return ordered[0];
  }

  return new Date().getUTCFullYear() - 1;
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
  for (const value of Object.values(raw)) {
    if (typeof value !== 'string') continue;
    if (/soltero/i.test(value)) return 'Soltero/a';
    if (/casado/i.test(value)) return 'Casado/a';
    if (/viudo/i.test(value)) return 'Viudo/a';
    if (/divorciado/i.test(value)) return 'Divorciado/a';
  }
  return '';
}

function detectarCCAA(raw: CasillasRaw): string {
  for (const value of Object.values(raw)) {
    if (typeof value !== 'string') continue;
    if (/MADRID/i.test(value)) return 'MADRID';
    if (/ASTURIAS/i.test(value)) return 'ASTURIAS';
    if (/CATALUÑA|CATALUNYA/i.test(value)) return 'CATALUÑA';
    if (/ANDALUC[IÍ]A/i.test(value)) return 'ANDALUCÍA';
    if (/VALENCIANA/i.test(value)) return 'COMUNITAT VALENCIANA';
  }
  return '';
}

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
