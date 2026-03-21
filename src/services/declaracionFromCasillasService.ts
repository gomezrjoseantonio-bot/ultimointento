import type { CasillaExtraida } from './aeatPdfParserService';
import type {
  BaseAhorro,
  BaseGeneral,
  DeclaracionIRPF,
  Liquidacion,
  RendimientoInmueble,
  RendimientosAutonomo,
  Retenciones,
} from './irpfCalculationService';
import { CONSTANTES_IRPF, round2 } from './irpfCalculationService';

export interface InmuebleParsedFromPDF {
  refCatastral?: string;
  direccion?: string;
  porcentajePropiedad?: number;
  diasArrendado?: number;
  diasDisposicion?: number;
  ingresosIntegros?: number;
  box0103?: number;
  box0104?: number;
  box0105?: number;
  box0106?: number;
  box0107?: number;
  box0108?: number;
  box0109?: number;
  box0112?: number;
  box0113?: number;
  box0114?: number;
  box0115?: number;
  box0117?: number;
  box0123?: number;
  box0124?: number;
  box0125?: number;
  box0126?: number;
  box0127?: number;
  box0129?: number;
  box0130?: number;
  box0131?: number;
  box0146?: number;
  box0089?: number;
  box0149?: number;
  box0150?: number;
  box0154?: number;
}

export interface DatosActivosExtraidos {
  arrastresGastos: Array<{
    inmuebleRefCatastral: string;
    importeArrastrable: number;
    ejercicioOrigen: number;
  }>;
  perdidasPendientes: Array<{
    ejercicioOrigen: number;
    importePendiente: number;
    tipo: 'ahorro';
  }>;
  amortizacionesPorInmueble: Array<{
    refCatastral: string;
    baseAmortizacion: number;
    amortizacionEjercicio: number;
    amortizacionMuebles: number;
    amortizacionAccesorio: number;
  }>;
  inmueblesDatos: Array<{
    refCatastral: string;
    valorCatastral: number;
    valorCatastralConstruccion: number;
    porcentajeConstruccion: number;
    importeAdquisicion: number;
    gastosAdquisicion: number;
    mejoras: number;
  }>;
}

function normalizeRefCatastral(value?: string): string | undefined {
  return value?.replace(/\s+/g, '').trim() || undefined;
}

function getCasillaValue(casillas: CasillaExtraida[], numero: string): number {
  return casillas.find((casilla) => casilla.numero === numero)?.valor ?? 0;
}

export function reconstruirDeclaracionDesdeCasillas(
  ejercicio: number,
  casillas: CasillaExtraida[],
  inmueblesParsed: InmuebleParsedFromPDF[] = [],
): DeclaracionIRPF {
  const get = (numero: string): number => getCasillaValue(casillas, numero);

  const rendimientosTrabajo = (get('0003') || get('0007') || get('0012') || get('0013') || get('0022') || get('0025'))
    ? {
        salarioBrutoAnual: get('0003'),
        especieAnual: get('0007'),
        cotizacionSS: get('0013'),
        irpfRetenido: get('0596'),
        rendimientoNeto: get('0022') || get('0025'),
        ppEmpleado: get('0426'),
        ppEmpresa: get('0427'),
        ppTotalReduccion: get('0467') || get('0468') || round2(get('0426') + get('0427')),
      }
    : null;

  const rendimientosInmuebles: RendimientoInmueble[] = inmueblesParsed.map((inmueble, index) => {
    const rendimientoNetoAlquiler = inmueble.box0149 || 0;
    const reduccionHabitual = inmueble.box0150 || 0;
    const rendimientoNetoReducido = inmueble.box0154 ?? round2(rendimientoNetoAlquiler - reduccionHabitual);
    const porcentajeReduccionHabitual = rendimientoNetoAlquiler > 0 && reduccionHabitual > 0
      ? round2(reduccionHabitual / rendimientoNetoAlquiler)
      : 0;

    return {
      inmuebleId: index + 1,
      alias: inmueble.direccion || `Inmueble ${index + 1}`,
      diasAlquilado: inmueble.diasArrendado || 0,
      diasVacio: inmueble.diasDisposicion || 0,
      diasEnObras: 0,
      diasTotal: 365,
      ingresosIntegros: inmueble.ingresosIntegros || 0,
      gastosDeducibles: round2(
        (inmueble.box0105 || 0)
        + (inmueble.box0106 || 0)
        + (inmueble.box0107 || 0)
        + (inmueble.box0109 || 0)
        + (inmueble.box0112 || 0)
        + (inmueble.box0113 || 0)
        + (inmueble.box0114 || 0)
        + (inmueble.box0115 || 0)
      ),
      amortizacion: round2((inmueble.box0131 || 0) + (inmueble.box0117 || 0) + (inmueble.box0146 || 0)),
      reduccionHabitual,
      rendimientoNetoAlquiler,
      rendimientoNetoReducido,
      porcentajeReduccionHabitual,
      esHabitual: reduccionHabitual > 0,
      imputacionRenta: inmueble.box0089 || 0,
      rendimientoNeto: round2(rendimientoNetoReducido + (inmueble.box0089 || 0)),
      gastosFinanciacionYReparacion: round2((inmueble.box0105 || 0) + (inmueble.box0106 || 0)),
      limiteAplicado: inmueble.box0107 || 0,
      excesoArrastrable: inmueble.box0108 || 0,
      arrastresAplicados: inmueble.box0104 || 0,
      conciliacion: undefined,
      refCatastral: normalizeRefCatastral(inmueble.refCatastral),
      datosAmortizacion: {
        valorCatastral: inmueble.box0123,
        valorCatastralConstruccion: inmueble.box0124,
        porcentajeConstruccion: inmueble.box0125,
        importeAdquisicion: inmueble.box0126,
        gastosAdquisicion: inmueble.box0127,
        mejoras: inmueble.box0129,
        baseAmortizacion: inmueble.box0130,
        amortizacionInmueble: inmueble.box0131,
        amortizacionMuebles: inmueble.box0117,
        amortizacionAccesorio: inmueble.box0146,
      },
    } as RendimientoInmueble & {
      refCatastral?: string;
      datosAmortizacion?: Record<string, number | undefined>;
    };
  });

  const rendimientosAutonomo: RendimientosAutonomo | null = (get('0224') || get('0226') || get('0180') || get('0171'))
    ? {
        ingresos: get('0180') || get('0171'),
        gastos: get('0218') || get('0223'),
        cuotaSS: get('0186'),
        gastoDificilJustificacion: get('0222'),
        rendimientoNeto: get('0224') || get('0226'),
        pagosFraccionadosM130: get('0604'),
      }
    : null;

  const baseGeneral: BaseGeneral = {
    rendimientosTrabajo,
    rendimientosAutonomo,
    rendimientosInmuebles,
    imputacionRentas: rendimientosInmuebles
      .filter((inmueble) => (inmueble.imputacionRenta || 0) > 0)
      .map((inmueble) => ({
        inmuebleId: inmueble.inmuebleId,
        alias: inmueble.alias,
        valorCatastral: 0,
        porcentajeImputacion: 0,
        diasVacio: inmueble.diasVacio,
        imputacion: inmueble.imputacionRenta,
      })),
    total: get('0435'),
  };

  const baseAhorro: BaseAhorro = {
    capitalMobiliario: {
      intereses: get('0027'),
      dividendos: get('0029'),
      retenciones: get('0597'),
      total: get('0040') || get('0041'),
    },
    gananciasYPerdidas: {
      plusvalias: get('0422'),
      minusvalias: get('0423'),
      minusvaliasPendientes: 0,
      compensado: Math.max(0, round2(get('0422') - get('0423'))),
    },
    total: get('0460'),
  };

  const ppEmpleado = get('0426');
  const ppEmpresa = get('0427');
  const totalPP = get('0467') || get('0468') || round2(ppEmpleado + ppEmpresa);

  const liquidacion: Liquidacion = {
    baseImponibleGeneral: get('0435'),
    baseImponibleAhorro: get('0460'),
    cuotaBaseGeneral: get('0545'),
    cuotaBaseAhorro: get('0546'),
    cuotaMinimosBaseGeneral: 0,
    cuotaIntegra: round2(get('0545') + get('0546')),
    deduccionesDobleImposicion: 0,
    cuotaLiquida: round2(get('0570') + get('0571')),
  };

  const retenciones: Retenciones = {
    trabajo: get('0596'),
    autonomoM130: get('0604'),
    capitalMobiliario: get('0597'),
    total: get('0609'),
  };

  const baseLiquidableTotal = (get('0505') || get('0500')) + get('0510');

  return {
    ejercicio,
    baseGeneral,
    baseAhorro,
    reducciones: {
      ppEmpleado,
      ppEmpresa,
      ppIndividual: 0,
      planPensiones: totalPP,
      total: totalPP,
    },
    minimoPersonal: {
      contribuyente: get('0511') || CONSTANTES_IRPF.minimoContribuyente,
      descendientes: 0,
      ascendientes: 0,
      discapacidad: 0,
      total: get('0519') || CONSTANTES_IRPF.minimoContribuyente,
    },
    liquidacion,
    retenciones,
    resultado: get('0670'),
    tipoEfectivo: baseLiquidableTotal > 0
      ? round2((liquidacion.cuotaLiquida / baseLiquidableTotal) * 100)
      : 0,
  };
}

export function parsearInmueblesDesdeTexto(text: string): InmuebleParsedFromPDF[] {
  const normalizedText = text.replace(/\u00a0/g, ' ');
  const bloques = normalizedText.split(/(?=Inmueble\s+\d+)/i);

  const parseNumber = (raw?: string): number | undefined => {
    if (!raw) return undefined;
    const normalized = raw.replace(/\./g, '').replace(',', '.').trim();
    const value = Number(normalized);
    return Number.isFinite(value) ? value : undefined;
  };

  const extractNumber = (bloque: string, casilla: string): number | undefined => {
    const patterns = [
      new RegExp(`${casilla}\\s+(-?[\\d.]+,\\d{2})\\b`),
      new RegExp(`(-?[\\d.]+,\\d{2})\\s+${casilla}\\b`),
    ];

    for (const pattern of patterns) {
      const match = bloque.match(pattern);
      const value = parseNumber(match?.[1]);
      if (typeof value === 'number') {
        return value;
      }
    }

    return undefined;
  };

  const extractString = (bloque: string, patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const match = bloque.match(pattern);
      const value = match?.[1]?.trim();
      if (value) {
        return value;
      }
    }
    return undefined;
  };

  const inmuebles: InmuebleParsedFromPDF[] = [];

  for (const bloque of bloques) {
    if (!/Inmueble\s+\d+/i.test(bloque)) {
      continue;
    }

    const inmueble: InmuebleParsedFromPDF = {
      refCatastral: normalizeRefCatastral(extractString(bloque, [
        /Referencia\s+catastral[\s.:_-]*([A-Z0-9]{8,20})/i,
        /Ref(?:erencia)?\.?\s*catastral[\s.:_-]*([A-Z0-9]{8,20})/i,
      ])),
      direccion: extractString(bloque, [
        /Direcci[oó]n del inmueble\s+(.+?)\s+0069/i,
        /Situaci[oó]n del inmueble\s+(.+?)\s+(?:0069|0070)/i,
      ]),
      porcentajePropiedad: extractNumber(bloque, '0063'),
      diasArrendado: extractNumber(bloque, '0101'),
      diasDisposicion: extractNumber(bloque, '0085'),
      ingresosIntegros: extractNumber(bloque, '0102'),
      box0103: extractNumber(bloque, '0103'),
      box0104: extractNumber(bloque, '0104'),
      box0105: extractNumber(bloque, '0105'),
      box0106: extractNumber(bloque, '0106'),
      box0107: extractNumber(bloque, '0107'),
      box0108: extractNumber(bloque, '0108'),
      box0109: extractNumber(bloque, '0109'),
      box0112: extractNumber(bloque, '0112'),
      box0113: extractNumber(bloque, '0113'),
      box0114: extractNumber(bloque, '0114'),
      box0115: extractNumber(bloque, '0115'),
      box0117: extractNumber(bloque, '0117'),
      box0123: extractNumber(bloque, '0123'),
      box0124: extractNumber(bloque, '0124'),
      box0125: extractNumber(bloque, '0125'),
      box0126: extractNumber(bloque, '0126'),
      box0127: extractNumber(bloque, '0127'),
      box0129: extractNumber(bloque, '0129'),
      box0130: extractNumber(bloque, '0130'),
      box0131: extractNumber(bloque, '0131'),
      box0146: extractNumber(bloque, '0146'),
      box0089: extractNumber(bloque, '0089'),
      box0149: extractNumber(bloque, '0149'),
      box0150: extractNumber(bloque, '0150'),
      box0154: extractNumber(bloque, '0154'),
    };

    if (
      inmueble.ingresosIntegros
      || inmueble.box0089
      || inmueble.box0149 !== undefined
      || inmueble.refCatastral
    ) {
      inmuebles.push(inmueble);
    }
  }

  return inmuebles;
}

export function extraerDatosActivos(
  ejercicio: number,
  inmueblesParsed: InmuebleParsedFromPDF[],
  casillas: CasillaExtraida[],
): DatosActivosExtraidos {
  const get = (numero: string): number => getCasillaValue(casillas, numero);

  const arrastresGastos = inmueblesParsed
    .filter((inmueble) => (inmueble.box0108 || 0) > 0 && inmueble.refCatastral)
    .map((inmueble) => ({
      inmuebleRefCatastral: normalizeRefCatastral(inmueble.refCatastral)!,
      importeArrastrable: inmueble.box0108 || 0,
      ejercicioOrigen: ejercicio,
    }));

  const perdidasPendientes: DatosActivosExtraidos['perdidasPendientes'] = [];
  const mapping = [
    { casilla: '1266', ejercicioOrigen: ejercicio - 2 },
    { casilla: '1269', ejercicioOrigen: ejercicio - 1 },
  ];

  mapping.forEach(({ casilla, ejercicioOrigen }) => {
    const importePendiente = get(casilla);
    if (importePendiente > 0) {
      perdidasPendientes.push({
        ejercicioOrigen,
        importePendiente,
        tipo: 'ahorro',
      });
    }
  });

  const amortizacionesPorInmueble = inmueblesParsed
    .filter((inmueble) => inmueble.refCatastral && (inmueble.box0130 || inmueble.box0131 || inmueble.box0117 || inmueble.box0146))
    .map((inmueble) => ({
      refCatastral: normalizeRefCatastral(inmueble.refCatastral)!,
      baseAmortizacion: inmueble.box0130 || 0,
      amortizacionEjercicio: inmueble.box0131 || 0,
      amortizacionMuebles: inmueble.box0117 || 0,
      amortizacionAccesorio: inmueble.box0146 || 0,
    }));

  const inmueblesDatos = inmueblesParsed
    .filter((inmueble) => inmueble.refCatastral)
    .map((inmueble) => ({
      refCatastral: normalizeRefCatastral(inmueble.refCatastral)!,
      valorCatastral: inmueble.box0123 || 0,
      valorCatastralConstruccion: inmueble.box0124 || 0,
      porcentajeConstruccion: inmueble.box0125 || 0,
      importeAdquisicion: inmueble.box0126 || 0,
      gastosAdquisicion: inmueble.box0127 || 0,
      mejoras: inmueble.box0129 || 0,
    }));

  return {
    arrastresGastos,
    perdidasPendientes,
    amortizacionesPorInmueble,
    inmueblesDatos,
  };
}
