/**
 * aeatXmlParserService.ts
 *
 * Parser de declaraciones IRPF en formato XML (DeclaVisor de AEAT).
 * Vía preferida de importación — determinista, sin OCR.
 *
 * Estructura: DocumentoElectronicoV2 → Declaracion (CDATA/JSON) → XML interno
 */

// ═══════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════

export interface DeclaracionXmlResult {
  ejercicio: number;
  periodo: string;
  modelo: string;

  declarante: {
    nif: string;
    nombre: string;
    fechaNacimiento: string;
    sexo: string;
    estadoCivil: number;
  };

  ccaa: number;
  tributacion: 'individual' | 'conjunta';

  casillas: Record<string, number>;

  inmuebles: InmuebleXml[];

  fondos: FondoXml[];
  acciones: AccionXml[];
  elementosPatrimoniales: ElementoPatrimonialXml[];

  reduccionesPrevisionSocial: {
    aportacionesIndividuales: number;
    contribucionesEmpresariales: number;
    total: number;
  };

  resultado: number;
  tipoDeclaracion: 'D' | 'I'; // D=devolución, I=ingreso
  importeDevolucionIngreso: number;
  ibanDevolucion?: string;

  metadatos: {
    nroJustificante: string;
    fechaPresentacion: string;
    csv: string;
    referencia: string;
  };
}

export interface InmuebleXml {
  refCatastral: string;
  direccion: string;
  porcentajePropiedad: number;
  urbana: boolean;
  situacion: number;
  valorCatastral: number;
  valorCatastralRevisado: boolean;
  diasDisposicion: number;
  rentaImputada: number;
  usoDisposicion: number; // 1=arrendamiento, 2=disposicion, etc.
}

export interface FondoXml {
  valorTransmision: number;
  valorAdquisicion: number;
  ganancia: number;
  retencion: number;
}

export interface AccionXml {
  entidad: string;
  valorTransmision: number;
  valorAdquisicion: number;
  resultado: number; // positivo=ganancia, negativo=pérdida
}

export interface ElementoPatrimonialXml {
  tipo: number;
  fechaTransmision: string;
  fechaAdquisicion: string;
  valorTransmision: number;
  valorAdquisicion: number;
  ganancia: number;
  perdida: number;
  onerosa: boolean;
}

// ═══════════════════════════════════════════════
// PARSER PRINCIPAL
// ═══════════════════════════════════════════════

export async function parseDeclaracionXml(xmlString: string): Promise<DeclaracionXmlResult> {
  const parser = new DOMParser();

  // Paso 1: parsear el XML exterior (DocumentoElectronicoV2)
  const outerDoc = parser.parseFromString(xmlString, 'text/xml');

  // Extraer metadatos del documento
  const referencia = getText(outerDoc, 'Referencia');
  const nifTitular = getText(outerDoc, 'NifTitular');
  const fechaHora = getText(outerDoc, 'FechaHora');

  // Paso 2: extraer el CDATA de la Declaracion
  const declaracionEl = outerDoc.getElementsByTagName('Declaracion')[0];
  if (!declaracionEl) throw new Error('No se encontró el elemento Declaracion en el XML');

  const csv = declaracionEl.getAttribute('csv') || '';
  const cdataContent = declaracionEl.textContent || '';

  // Paso 3: parsear el JSON wrapper
  let ficheroXml: string;
  try {
    const jsonData = JSON.parse(cdataContent);
    ficheroXml = jsonData.fichero;
  } catch {
    // Si no es JSON, el CDATA es directamente el XML
    ficheroXml = cdataContent;
  }

  // Paso 4: parsear el XML interno de la declaración
  const innerDoc = parser.parseFromString(ficheroXml, 'text/xml');
  const root = innerDoc.documentElement;

  const ejercicio = parseInt(root.getAttribute('ejercicio') || '0');
  const periodo = root.getAttribute('periodo') || '0A';
  const modelo = root.getAttribute('modelo') || '100';

  // ─── Datos identificativos ───
  const declarante = {
    nif: getText(innerDoc, 'DPNIF_D') || nifTitular,
    nombre: getText(innerDoc, 'DP_APENOM_D'),
    fechaNacimiento: getText(innerDoc, 'DPFNAC_D'),
    sexo: getText(innerDoc, 'SEXO_D'),
    estadoCivil: getNum(innerDoc, 'ECIVIL'),
  };

  const datosEcon = innerDoc.getElementsByTagName('DatosEconomicos')[0];
  const ccaa = parseInt(datosEcon?.getAttribute('codigoCADeclaracion') || '0');
  const tributacionRaw = datosEcon?.getAttribute('TIPOTRIBUTACION');
  const tributacion: 'individual' | 'conjunta' = tributacionRaw === '1' ? 'individual' : 'conjunta';

  // ─── Casillas (mapeadas desde campos XML) ───
  const casillas: Record<string, number> = {};

  // Trabajo
  casillas['0001'] = getNum(innerDoc, 'TPDIN'); // Retribuciones dinerarias
  casillas['0003'] = getNum(innerDoc, 'IDII'); // Retribuciones dinerarias (íntegras)
  casillas['0004'] = getNum(innerDoc, 'IEVA'); // Valoración retribución especie
  casillas['0005'] = getNum(innerDoc, 'IEIC'); // Ingresos a cuenta especie
  casillas['0007'] = getNum(innerDoc, 'TPESP'); // Retribuciones en especie
  casillas['0008'] = getNum(innerDoc, 'TPING'); // Total ingresos íntegros
  casillas['0012'] = getNum(innerDoc, 'TPING'); // Total ingresos computables
  casillas['0013'] = getNum(innerDoc, 'TPGSS'); // Cotizaciones SS
  casillas['0017'] = getNum(innerDoc, 'TPRNP'); // Rdto neto previo
  casillas['0018'] = getNum(innerDoc, 'SUMTPRNP') || getNum(innerDoc, 'TPRNP');
  casillas['0019'] = getNum(innerDoc, 'TPOGD'); // Otros gastos deducibles
  casillas['0022'] = getNum(innerDoc, 'TPRDTO') || getNum(innerDoc, 'TPTOTAL');
  casillas['0025'] = getNum(innerDoc, 'TPTOTAL');

  // Capital mobiliario
  casillas['0027'] = getNum(innerDoc, 'B1II'); // Intereses
  casillas['0029'] = getNum(innerDoc, 'B13'); // Dividendos
  casillas['0036'] = getNum(innerDoc, 'B1II'); // Total ingresos íntegros CM
  casillas['0037'] = getNum(innerDoc, 'B1RN'); // Rdto neto
  casillas['0038'] = getNum(innerDoc, 'B1RNR');
  casillas['0040'] = getNum(innerDoc, 'B1RNR');
  casillas['0041'] = getNum(innerDoc, 'B1RNR'); // Suma rdtos CM en BI ahorro

  // Inmuebles
  casillas['0155'] = getNum(innerDoc, 'IRIM'); // Suma imputaciones rentas inmobiliarias

  // Ganancias patrimoniales
  casillas['0298'] = 1; // Declarante obtiene G/P no de transmisión
  casillas['0304'] = getNum(innerDoc, 'SUM1G1') || getNum(innerDoc, 'G13'); // Otras ganancias
  casillas['0306'] = getNum(innerDoc, 'SUM1G1') || getNum(innerDoc, 'G13');

  // Fondos
  casillas['0312'] = getNum(innerDoc, 'G2VTTF'); // Valor transmisión fondos
  casillas['0315'] = getNum(innerDoc, 'G2VATF'); // Valor adquisición fondos
  casillas['0316'] = getNum(innerDoc, 'G2GANF'); // Ganancia fondos

  // Base imponible
  casillas['0420'] = getNum(innerDoc, 'GPGRALH');
  casillas['0432'] = getNum(innerDoc, 'SUMARDTO');
  casillas['0435'] = getNum(innerDoc, 'BIGRALH'); // BI general
  casillas['0460'] = getNum(innerDoc, 'BIAHOH'); // BI ahorro

  // Reducciones
  casillas['0465'] = getNum(innerDoc, 'V01PP2ORGEA'); // Aportaciones PP
  casillas['0467'] = getNum(innerDoc, 'RSUMAD');
  casillas['0468'] = getNum(innerDoc, 'RSUMAD');
  casillas['0492'] = getNum(innerDoc, 'RGTOT') || getNum(innerDoc, 'RSUMAD');

  // Base liquidable
  casillas['0500'] = getNum(innerDoc, 'BLGRAL'); // BL general
  casillas['0505'] = getNum(innerDoc, 'BLGGRAV'); // BL general sometida a gravamen
  casillas['0510'] = getNum(innerDoc, 'BLAHOJ'); // BL ahorro

  // Mínimo personal
  casillas['0511'] = getNum(innerDoc, 'MPER');
  casillas['0512'] = getNum(innerDoc, 'MPERAU');

  // Cuotas
  casillas['0528'] = getNum(innerDoc, 'CEXGE1'); // Cuota estatal BL general
  casillas['0529'] = getNum(innerDoc, 'CEXGA1'); // Cuota autonómica BL general
  casillas['0532'] = getNum(innerDoc, 'CIGEST');
  casillas['0533'] = getNum(innerDoc, 'CIGAUT');
  casillas['0534'] = getNum(innerDoc, 'TME'); // Tipo medio estatal
  casillas['0535'] = getNum(innerDoc, 'TMA'); // Tipo medio autonómico
  casillas['0540'] = getNum(innerDoc, 'CIEEST'); // Cuota estatal ahorro
  casillas['0541'] = getNum(innerDoc, 'CIEAUT'); // Cuota autonómica ahorro
  casillas['0545'] = getNum(innerDoc, 'CINTEST'); // Cuota íntegra estatal
  casillas['0546'] = getNum(innerDoc, 'CINTAUT'); // Cuota íntegra autonómica
  casillas['0570'] = getNum(innerDoc, 'CLIQEST'); // Cuota líquida estatal
  casillas['0571'] = getNum(innerDoc, 'CLIQAUT'); // Cuota líquida autonómica
  casillas['0585'] = getNum(innerDoc, 'CLEIN'); // Cuota líquida estatal incrementada
  casillas['0586'] = getNum(innerDoc, 'CLAIN'); // Cuota líquida autonómica incrementada
  casillas['0587'] = getNum(innerDoc, 'CLIQT'); // Cuota líquida total
  casillas['0595'] = getNum(innerDoc, 'CAUTLIQ'); // Cuota autoliquidación

  // Retenciones
  casillas['0596'] = getNum(innerDoc, 'RET1'); // Retenciones trabajo
  casillas['0597'] = getNum(innerDoc, 'RET2'); // Retenciones capital mobiliario
  casillas['0603'] = getNum(innerDoc, 'RET8'); // Retenciones ganancias patrimoniales
  casillas['0609'] = getNum(innerDoc, 'PAGOS'); // Total pagos a cuenta

  // Resultado
  casillas['0610'] = getNum(innerDoc, 'CDIF'); // Cuota diferencial
  casillas['0670'] = getNum(innerDoc, 'RESULTADO');
  casillas['0695'] = getNum(innerDoc, 'RESINGDEV');

  // CCAA
  casillas['0671'] = getNum(innerDoc, 'CLAINO');
  casillas['0675'] = getNum(innerDoc, 'IRPFCCAA');

  // Limpiar casillas con valor 0 o NaN
  for (const key of Object.keys(casillas)) {
    if (!casillas[key] || !Number.isFinite(casillas[key])) {
      delete casillas[key];
    }
  }

  // ─── Inmuebles ───
  const inmuebles: InmuebleXml[] = [];
  const inmuebleEls = innerDoc.getElementsByTagName('Inmueble');
  for (let i = 0; i < inmuebleEls.length; i++) {
    const el = inmuebleEls[i];
    inmuebles.push({
      refCatastral: getTextEl(el, 'RC'),
      direccion: getTextEl(el, 'CDIRECCION'),
      porcentajePropiedad: getNumEl(el, 'PC'),
      urbana: getTextEl(el, 'CURBA') === '1',
      situacion: getNumEl(el, 'CL'),
      valorCatastral: getNumEl(el, 'C_VC'),
      valorCatastralRevisado: getTextEl(el, 'C_REV') === 'SI',
      diasDisposicion: getNumEl(el, 'C_DIAS'),
      rentaImputada: getNumEl(el, 'C_RII'),
      usoDisposicion: getNumEl(el, 'USODISP'),
    });
  }

  // ─── Fondos ───
  const fondos: FondoXml[] = [];
  const fondoEls = innerDoc.getElementsByTagName('Fondo');
  for (let i = 0; i < fondoEls.length; i++) {
    const el = fondoEls[i];
    fondos.push({
      valorTransmision: getNumEl(el, 'G2VTTF') || getNumEl(el, 'VT1'),
      valorAdquisicion: getNumEl(el, 'G2VATF') || getNumEl(el, 'VAD1'),
      ganancia: getNumEl(el, 'G2GANF'),
      retencion: getNumEl(el, 'RET'),
    });
  }

  // ─── Acciones ───
  const acciones: AccionXml[] = [];
  const accionEls = innerDoc.getElementsByTagName('EntidadAccion');
  for (let i = 0; i < accionEls.length; i++) {
    const el = accionEls[i];
    const venta =
      getNumEl(el, 'G2B_A') ||
      parseFloat(el.getElementsByTagName('G2B_A')[0]?.getAttribute('valor') || '0');
    acciones.push({
      entidad: getTextEl(el, 'G2B_DE'),
      valorTransmision: venta,
      valorAdquisicion: getNumEl(el, 'G2B_B'),
      resultado:
        getNumEl(el, 'G2B_E') > 0
          ? -getNumEl(el, 'G2B_E')
          : getNumEl(el, 'G2B_F') || 0,
    });
  }

  // ─── Elementos patrimoniales ───
  const elementosPatrimoniales: ElementoPatrimonialXml[] = [];
  const epEls = innerDoc.getElementsByTagName('ElementoPatrimonial');
  for (let i = 0; i < epEls.length; i++) {
    const el = epEls[i];
    elementosPatrimoniales.push({
      tipo: getNumEl(el, 'G2DB'),
      fechaTransmision: getTextEl(el, 'G2DC') || getTextEl(el, 'FECHA1NA'),
      fechaAdquisicion: getTextEl(el, 'G2DD') || getTextEl(el, 'FECHA2NA'),
      valorTransmision: getNumEl(el, 'IMP1VTNA'),
      valorAdquisicion: getNumEl(el, 'IMP1VANA'),
      ganancia: getNumEl(el, 'G2DE') || getNumEl(el, 'G2DI'),
      perdida: getNumEl(el, 'G2DF') || getNumEl(el, 'G2DG'),
      onerosa: getTextEl(el, 'F2ONEROSA') === '1',
    });
  }

  // ─── Reducciones previsión social ───
  const reduccionesPrevisionSocial = {
    aportacionesIndividuales: getNum(innerDoc, 'RGAP') || getNum(innerDoc, 'V01PP2ORGEA'),
    contribucionesEmpresariales: getNum(innerDoc, 'RGCONT'),
    total: getNum(innerDoc, 'RSUMAD'),
  };

  // ─── Resultado ───
  const resultado = getNum(innerDoc, 'RESULTADO') || getNum(innerDoc, 'RESINGDEV');
  const tipoDecl = getText(innerDoc, 'TIPODECLARACION');
  const devImporte = getNum(innerDoc, 'DEV_IMPORTE');
  const iban = getText(innerDoc, 'DEV_CUENTACORRIENTE');

  return {
    ejercicio,
    periodo,
    modelo,
    declarante,
    ccaa,
    tributacion,
    casillas,
    inmuebles,
    fondos,
    acciones,
    elementosPatrimoniales,
    reduccionesPrevisionSocial,
    resultado,
    tipoDeclaracion: (tipoDecl === 'I' ? 'I' : 'D') as 'D' | 'I',
    importeDevolucionIngreso: devImporte || Math.abs(resultado),
    ibanDevolucion: iban || undefined,
    metadatos: {
      nroJustificante: '',
      fechaPresentacion: fechaHora,
      csv,
      referencia,
    },
  };
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function getText(doc: Document, tagName: string): string {
  const el = doc.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

function getNum(doc: Document, tagName: string): number {
  const text = getText(doc, tagName);
  if (!text) return 0;
  const num = parseFloat(text);
  return Number.isFinite(num) ? num : 0;
}

function getTextEl(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

function getNumEl(parent: Element, tagName: string): number {
  const text = getTextEl(parent, tagName);
  if (!text) return 0;
  const num = parseFloat(text);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Detecta si un archivo es un XML de DeclaVisor AEAT.
 */
export function isAeatXml(content: string): boolean {
  return (
    content.includes('DocumentoElectronicoV2') ||
    (content.includes('modelo="100"') && content.includes('ejercicio='))
  );
}

/**
 * Convierte el resultado XML al formato que espera el wizard de importación
 * (compatible con lo que devuelve el parser PDF).
 */
export function xmlResultToCasillasMap(result: DeclaracionXmlResult): Record<string, number> {
  return { ...result.casillas };
}
