/**
 * justificantePdfImportService.ts
 *
 * Import COMPLETO de una declaración IRPF (Modelo 100) desde el PDF del
 * justificante de la AEAT, de forma DETERMINISTA y sin conversores externos.
 * Produce la MISMA `DeclaracionCompleta` que el import por XML (inmuebles,
 * arrastres, Comunidad de Bienes / atribución de rentas, resumen), de modo que
 * el PDF fluye por el mismo `distribuirDeclaracion` y propaga a todo el modelo.
 *
 * La lectura del PDF (pdfjs) y la extracción de casillas por texto ya existían
 * en `aeatParserService` (`prepararPdfParaAnalisis`,
 * `extraerCasillasDeterministasDesdeTexto`, `mapearCasillasADeclaracion` con sus
 * `inmueblesDetalle`/`arrastres`). Aquí sólo se PROYECTA esa extracción al
 * contrato unificado `DeclaracionCompleta`, sin duplicar el parseo.
 *
 * Sin red: si el justificante no expone texto suficiente, se lanza para que el
 * usuario complete a mano, en vez de delegar en un conversor externo. El XML de
 * Renta Web sigue siendo la vía canónica (más rica, y sin campos ausentes en el
 * PDF como `catastralRevisado`); esto es la paridad de "mejor esfuerzo" cuando
 * el cliente sólo tiene el PDF.
 */
import {
  detectarEjercicio,
  extraerCasillasDeterministasDesdeTexto,
  mapearCasillasADeclaracion,
  prepararPdfParaAnalisis,
} from './aeatParserService';
import type { DeclaracionInmueble } from '../types/fiscal';
import type {
  DeclaracionCompleta,
  Declarante,
  EntidadAtribucionDeclarada,
  GastosInmueble,
  InmuebleAccesorioDeclarado,
  InmuebleDeclarado,
  IntegracionFiscal,
  MetaDeclaracion,
  ResultadoDeclaracion,
  UsoInmueble,
} from '../types/declaracionCompleta';

type CasillasRaw = Record<string, number | string>;

/** Casillas mínimas para considerar el resumen fiable sin refuerzo externo. */
const MIN_CASILLAS_RESUMEN = 5;
/** Histórico de ATLAS (coincide con MIN_EJERCICIO del parser AEAT). */
const MIN_EJERCICIO = 2020;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Proyecta un inmueble extraído del PDF (`DeclaracionInmueble`, forma plana con
 * casillas) al `InmuebleDeclarado` que consume el distribuidor. Reconstruye
 * `usos[]`, `gastos{}` y `arrendamientos[]` a partir de las casillas del Modelo
 * 100. Los campos que el justificante NO expone (`catastralRevisado`,
 * `valorCatastralTotal`) quedan undefined — el XML sí los trae.
 */
export function mapearInmuebleDeclarado(det: DeclaracionInmueble, esUrbana?: boolean): InmuebleDeclarado {
  const usos: UsoInmueble[] = [];
  if (det.diasArrendado > 0 || det.uso === 'arrendamiento' || det.uso === 'mixto') {
    usos.push({ tipo: 'arrendado', dias: det.diasArrendado });
  }
  if (det.diasDisposicion > 0 || det.rentaImputada > 0) {
    usos.push({ tipo: 'disposicion', dias: det.diasDisposicion, rentaImputada: det.rentaImputada || undefined });
  }
  if (det.esAccesorio) {
    usos.push({ tipo: 'accesorio', dias: det.diasArrendado });
  }

  const gastos: GastosInmueble = {
    interesesFinanciacion: det.interesesFinanciacion || 0,
    reparacionConservacion: det.gastosReparacion || 0,
    gastosAplicados: det.gastos0105_0106Aplicados || 0,
    comunidad: det.gastosComunidad || 0,
    suministros: det.gastosSuministros || 0,
    seguros: det.gastosSeguros || 0,
    ibiTasas: det.gastosTributos || 0,
    serviciosTerceros: det.gastosServicios || 0,
    amortizacionMobiliario: det.amortizacionMuebles || 0,
  };

  // El justificante no desglosa gastos por arrendamiento (van agregados al
  // inmueble), así que se modela un único arrendamiento con los íntegros/días.
  const arrendamientos = det.ingresosIntegros > 0 || det.diasArrendado > 0
    ? [{
        nifArrendatarios: [det.nifArrendatario1, det.nifArrendatario2].filter(Boolean) as string[],
        fechaContrato: det.fechaContrato,
        tieneReduccion: det.derechoReduccion || (det.reduccion ?? 0) > 0,
        ingresos: det.ingresosIntegros || 0,
        diasArrendado: det.diasArrendado || 0,
        proveedores: [],
      }]
    : [];

  const accesorio: InmuebleAccesorioDeclarado | undefined = det.accesorio && det.refCatastralPrincipal
    ? {
        refCatastral: det.referenciaCatastral,
        refCatastralPrincipal: det.refCatastralPrincipal,
        fechaAdquisicion: det.accesorio.fechaAdquisicion,
        precioAdquisicion: det.accesorio.importeAdquisicion,
        gastosAdquisicion: det.accesorio.gastosAdquisicion,
        valorCatastral: det.accesorio.valorCatastral,
        valorCatastralConstruccion: det.accesorio.valorCatastralConstruccion,
        porcentajeConstruccion: det.accesorio.porcentajeConstruccion,
        baseAmortizacion: det.accesorio.baseAmortizacion,
        amortizacionAnual: det.accesorio.amortizacion,
        diasArrendado: det.accesorio.diasArrendado,
      }
    : undefined;

  return {
    refCatastral: det.referenciaCatastral,
    direccion: det.direccion,
    porcentajePropiedad: det.porcentajePropiedad || 100,
    esUrbana: esUrbana ?? true,
    valorCatastral: det.valorCatastral,
    valorCatastralConstruccion: det.valorCatastralConstruccion,
    porcentajeConstruccion: det.porcentajeConstruccion,
    tipoAdquisicion: det.tipoAdquisicion === 'onerosa' ? 'onerosa' : undefined,
    fechaAdquisicion: det.fechaAdquisicion,
    precioAdquisicion: det.importeAdquisicion,
    gastosAdquisicion: det.gastosAdquisicion,
    mejorasAnteriores: det.mejoras,
    mejorasEjercicio: [],
    baseAmortizacion: det.baseAmortizacion,
    amortizacionAnualInmueble: det.amortizacionInmueble || undefined,
    amortizacionMobiliario: det.amortizacionMuebles || undefined,
    usos,
    arrendamientos,
    gastos,
    gastosPendientesPrevios: det.arrastresRecibidos || 0,
    gastosPendientesPreviosAplicados: det.arrastresAplicados || 0,
    arrastresRecibidos: det.arrastresRecibidos || undefined,
    rendimientoNeto: det.rendimientoNeto || 0,
    reduccionVivienda: det.reduccion || 0,
    rendimientoNetoReducido: det.rendimientoNetoReducido || 0,
    gastosPendientesGenerados: det.arrastresGenerados || 0,
    accesorio,
    esAccesorioDe: det.esAccesorio ? det.refCatastralPrincipal : undefined,
    proveedores: [],
  };
}

/**
 * Extrae las entidades en régimen de atribución de rentas (Comunidad de Bienes)
 * del justificante. El NIF (1562) llega en `raw` como string (lo pone el
 * extractor de metadatos); los importes por casilla: 1564 %, 1571/1604
 * rendimiento de capital inmobiliario, 1598 retención. Punto ciego previo: el
 * parser de PDF no leía nada de atribución.
 */
export function extraerEntidadesAtribucionDesdeCasillas(raw: CasillasRaw): EntidadAtribucionDeclarada[] {
  const nif = typeof raw['1562'] === 'string' ? (raw['1562'] as string).toUpperCase() : '';
  if (!nif) return [];
  const num = (c: string): number => {
    const v = raw[c];
    return typeof v === 'number' ? v : 0;
  };
  const rendInmob = num('1604') || num('1571');
  const retInmob = num('1598');
  if (rendInmob === 0 && retInmob === 0) return [];
  const letra = nif.charAt(0);
  const tipoEntidad: EntidadAtribucionDeclarada['tipoEntidad'] =
    letra === 'E' ? 'CB' : letra === 'J' ? 'SC' : letra === 'H' ? 'HY' : 'otra';
  return [{
    nif,
    tipoEntidad,
    porcentajeParticipacion: num('1564'),
    tipoRenta: 'capital_inmobiliario',
    rendimientoAtribuido: round2(rendInmob),
    retencionAtribuida: round2(retInmob),
  }];
}

/**
 * Mapea las casillas ya extraídas (deterministas) del justificante a una
 * `DeclaracionCompleta` COMPLETA con `fuenteImportacion: 'pdf'`: resumen,
 * inmuebles, arrastres y entidades de atribución. Función PURA (no lee el PDF ni
 * la red), directamente testeable desde el texto extraído.
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

  // Reutiliza el parseo de inmuebles/arrastres del parser AEAT (sufijos `_n`).
  const { inmuebles: inmueblesDetalle, arrastres } = mapearCasillasADeclaracion(raw, opts.fileName, opts.ejercicioFallback);
  const inmuebles: InmuebleDeclarado[] = inmueblesDetalle.map((d) => mapearInmuebleDeclarado(d.datos, d.extras.urbana));

  // Un inmueble accesorio aparece en el justificante como inmueble propio
  // (ref + dirección + casilla 0074/0090), pero su valor catastral vive en el
  // sub-bloque "accesorio" del inmueble PRINCIPAL (casillas 0138/0139). Se
  // propaga por referencia para que la property del accesorio tenga su VC, igual
  // que en el XML.
  const normRef = (r: string) => (r || '').replace(/[\s.-]/g, '').toUpperCase();
  const detallePorRef = new Map(inmueblesDetalle.map((d) => [normRef(d.datos.referenciaCatastral), d.datos]));
  for (const inm of inmuebles) {
    if (inm.esAccesorioDe && !inm.valorCatastral) {
      const principal = detallePorRef.get(normRef(inm.esAccesorioDe));
      if (principal?.accesorio?.valorCatastral) {
        inm.valorCatastral = principal.accesorio.valorCatastral;
        inm.valorCatastralConstruccion = principal.accesorio.valorCatastralConstruccion;
        inm.porcentajeConstruccion = principal.accesorio.porcentajeConstruccion;
      }
    }
  }

  // Sólo las casillas numéricas del Modelo 100 (0435, 0670, 0109_1, ...), no los
  // metadatos textuales (ejercicio, nif, csv, 1562...) que comparten el mapa.
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
    // el desglose completo y campos como catastralRevisado que el PDF no expone).
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

  const gastosPendientes = arrastres.gastos0105_0106.map((g) => ({
    refCatastral: g.referenciaCatastral,
    importePendiente: g.pendienteFuturo,
    añoOrigen: g.ejercicioOrigen,
    importeAplicado: g.aplicadoEstaDeclaracion,
  }));
  const perdidasPatrimoniales = arrastres.perdidasAhorro.map((p) => ({
    tipo: p.tipo,
    añoOrigen: p.ejercicioOrigen,
    importeInicial: p.pendienteInicio,
    importeAplicado: p.aplicado,
    importePendiente: p.pendienteFuturo,
  }));

  const entidadesAtribucion = extraerEntidadesAtribucionDesdeCasillas(raw);

  return {
    meta,
    declarante,
    inmuebles,
    integracion,
    resultado,
    arrastres: { gastosPendientes, perdidasPatrimoniales },
    entidadesAtribucion: entidadesAtribucion.length > 0 ? entidadesAtribucion : undefined,
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
 * Lee el PDF del justificante y devuelve una `DeclaracionCompleta` COMPLETA lista
 * para `distribuirDeclaracion`, 100% determinista (pdfjs + regex), sin red.
 *
 * Lanza si el PDF no expone texto suficiente (justificante escaneado como
 * imagen, o documento que no es un Modelo 100): el llamador debe ofrecer el
 * alta manual, nunca un conversor externo.
 */
export async function importarJustificantePdf(
  file: File,
  ejercicioFallback?: number,
): Promise<DeclaracionCompleta> {
  const { paginasTexto } = await prepararPdfParaAnalisis(file);
  const raw = extraerCasillasDeterministasDesdeTexto(paginasTexto);

  if (contarCasillasNumericas(raw) < MIN_CASILLAS_RESUMEN) {
    throw new Error(
      'El PDF no expone texto suficiente para leer la declaración de forma fiable. ' +
        'Sube el justificante original de la AEAT (no una impresión escaneada) o el XML de Renta Web.',
    );
  }

  const ejercicio = detectarEjercicio(raw, file.name, ejercicioFallback);
  if (ejercicio < MIN_EJERCICIO) {
    throw new Error(`No se pudo determinar el ejercicio del justificante (el histórico de ATLAS empieza en ${MIN_EJERCICIO}).`);
  }

  return construirDeclaracionCompletaDesdeCasillas(raw, { ejercicioFallback, fileName: file.name });
}
