// ============================================================================
// E2.4.2 · Las REGLAS DURAS · destiladas de 4.000 movimientos reales
// ============================================================================
//
// No se redescubren en frío. Cada una viene de un bug real o de una decisión
// de Jose, y cada una tiene su test. Todas leen el texto con límite de palabra
// (`palabras.ts` · regla 1) y todas miran el SIGNO antes que la palabra
// (regla 2): una regla que propone algo incompatible con el signo no se emite.
//
//   2 · el signo manda: «ABONO POR DOMICILIACIÓN» en positivo es una
//       bonificación (ingreso), no un recibo; «TRANSFERENCIA CURENERGÍA» en
//       positivo es la devolución de la comercializadora, no un suministro.
//       Las dos son «Otros ingresos» (§32.32 · bonificación, devolución).
//   3 · concepto explícito gana sobre nombre propio, CON excepción: «nómina»
//       + la parte es el propio titular = reparto yo→yo (movimiento interno).
//   4 · el método nunca es «otro» si el banco da señal (`metodoDelConcepto`).
//   5 · «préstamo» en el texto es TRES cosas: la cuota (gasto·prestamo), la
//       liquidación de la tarjeta (NO es préstamo) y la disposición (capital
//       que entra · movimiento interno). Se distingue por el patrón completo.
//   6 · un agregador es OPACO: la recarga de una tarjeta PROPIA (Revolut) es
//       un traspaso, lo decide el nº de tarjeta (eso va en el identificador);
//       el bazar (Amazon/Shein) es «compra online» sin saber qué se compró.
//   7 · «Compra Bizum [comercio]» trae comercio y se clasifica por él;
//       «Bizum a favor de [persona]» no dice nada → personal por defecto.
//   8 · ATLAS no inventa: mejor «personal / sin familia» que un «mueble»
//       adivinado. Por eso la tabla de comercios es corta y solo lleva nombres
//       que no admiten dos lecturas.
//  10 · la cuota del préstamo es UN cargo (no se parte) · sin casilla aquí.
// ============================================================================

import type { FamiliaId } from '../catalogo/catalogoUnico';
import { laParteEsElTitular } from '../deterministas/traspasosPropios';
import { cualCasa, tieneAlguna, tienePalabra } from './palabras';
import type { Parcial } from './tipos';

/** Lo mínimo del movimiento que miran las reglas. */
export interface LineaParaReglas {
  description: string;
  reference?: string;
  amount: number;
}

interface Contexto {
  /** Los nombres con los que el usuario aparece en un extracto (`nombresDelTitular`). */
  nombresTitular: readonly string[];
}

// ─── Vocabulario ────────────────────────────────────────────────────────────

const LIQUIDACION_TARJETA = ['LIQUIDACION DE LAS TARJETAS', 'LIQUIDACION TARJETA', 'LIQUIDACION DE TARJETA', 'LIQUIDACION TARJETAS', 'RECIBO TARJETA'];
const DISPOSICION = ['ABONO DISPOSICION', 'DISPOSICION PRESTAMO', 'DISPOSICION DE PRESTAMO', 'PRESTAMOS ABONO DISPOSICION'];
const CUOTA_PRESTAMO = ['LIQUIDACION PERIODICA PRESTAMO', 'PRESTAMOS ADEUDO CUOTA', 'ADEUDO CUOTA', 'CUOTA PRESTAMO', 'CUOTA DE PRESTAMO', 'CUOTA HIPOTECA', 'CUOTA DE HIPOTECA', 'HIPOTECA', 'PRESTAMO', 'PRESTAMOS'];
const ABONO_DOMICILIACION = ['ABONO POR DOMICILIACION', 'ABONO DOMICILIACION', 'DEVOLUCION RECIBO', 'DEVOLUCION DE RECIBO', 'BONIFICACION'];
const NOMINA = ['NOMINA', 'NOMINAS', 'SALARIO', 'HABERES'];
const PENSION = ['PENSION', 'INSS', 'SEGURIDAD SOCIAL'];
const FIANZA = ['FIANZA'];
const EFECTIVO_SALE = ['CAJERO', 'REINTEGRO', 'RETIRADA EFECTIVO', 'DISPOSICION EFECTIVO', 'RETIRADA'];
const EFECTIVO_ENTRA = ['INGRESO EFECTIVO', 'INGRESO EN EFECTIVO'];
const COMISIONES = ['COMISION', 'COMISIONES', 'MANTENIMIENTO CUENTA', 'CUOTA MANTENIMIENTO'];
const RENDIMIENTO_INTERES = ['REMUN', 'REMUNERACION', 'INTERESES', 'LIQUIDACION INTERESES', 'ABONO INTERESES'];
const RENDIMIENTO_DIVIDENDO = ['DIVIDENDO', 'DIVIDENDOS'];
const RECARGA_TARJETA = ['RECARGA', 'TOPUP', 'TOP UP'];
const APORTACION_INVERSION = ['BINANCE', 'COINBASE', 'KRAKEN', 'BIT2ME', 'DEGIRO', 'TRADE REPUBLIC', 'INDEXA', 'MYINVESTOR', 'XTB', 'ETORO', 'INTERACTIVE BROKERS'];
const APORTACION_PLAN = ['PLAN DE PENSIONES', 'PLAN PENSIONES', 'APORTACION PLAN'];

const COMUNIDAD = ['COMUNIDAD', 'COMUNIDAD PROPIETARIOS', 'COMUNIDAD DE PROPIETARIOS', 'CCPP', 'ADMIN FINCAS', 'ADMINISTRACION FINCAS', 'FINCAS'];
const SUMINISTRO_LUZ = ['IBERDROLA', 'ENDESA', 'CURENERGIA', 'ELECTRICIDAD', 'HOLALUZ', 'OCTOPUS ENERGY', 'LUZ'];
const SUMINISTRO_GAS = ['GAS NATURAL', 'VISALIA', 'NEDGIA', 'GAS'];
const SUMINISTRO_AGUA = ['AQUALIA', 'CANAL ISABEL', 'CANAL DE ISABEL', 'EMASESA', 'AGUAS DE', 'AGUA'];
const SUMINISTRO_TELEFONIA = ['SIMYO', 'PEPEPHONE', 'LOWI', 'DIGI', 'FINETWORK', 'O2'];
const SUMINISTRO_SIN_SUBTIPO = ['NATURGY', 'REPSOL LUZ', 'TOTAL ENERGIES', 'TOTALENERGIES', 'MOVISTAR', 'VODAFONE', 'ORANGE', 'YOIGO', 'MASMOVIL', 'JAZZTEL', 'EUSKALTEL'];
const SEGUROS = ['SEGURO', 'SEGUROS', 'SEGUR', 'SEGURCAIXA', 'MAPFRE', 'ALLIANZ', 'AXA', 'GENERALI', 'ZURICH', 'REALE', 'PELAYO', 'MUTUA MADRILENA'];
const SEGUROS_SALUD = ['ADESLAS', 'SANITAS', 'DKV', 'ASISA'];
const SEGUROS_DECESOS = ['OCASO', 'SANTALUCIA', 'SANTA LUCIA', 'DECESOS'];
const SEGUROS_VEHICULO = ['LINEA DIRECTA', 'GENESIS SEGUROS', 'VERTI'];
const IBI = ['IBI'];
const IMPUESTOS = ['AYUNTAMIENTO', 'AYTO', 'TASA', 'TASAS', 'TRIBUTOS', 'RECAUDACION', 'AEAT', 'AGENCIA TRIBUTARIA', 'HACIENDA', 'SUMA GESTION', 'DIPUTACION', 'CONTRIBUCION URBANA', 'BASURAS'];
const MULTAS = ['MULTA', 'MULTAS', 'SANCION', 'DGT'];
const TRANSPORTE_PUBLICO = ['RENFE', 'IRYO', 'OUIGO', 'ALSA', 'EMT', 'METRO', 'AVANZA', 'CERCANIAS', 'TMB'];
const TRANSPORTE_PARKING = ['TELPARK', 'PARKING', 'APARCAMIENTO', 'EASYPARK', 'PARQUIMETRO'];
const TRANSPORTE_PEAJES = ['PEAJE', 'AUTOPISTA', 'AUTOPISTAS', 'AUSOL', 'BIDEGI'];
const TRANSPORTE_COMBUSTIBLE = ['REPSOL', 'CEPSA', 'GALP', 'SHELL', 'BP', 'PETRONOR', 'BALLENOIL', 'PLENOIL', 'GASOLINERA', 'ESTACION SERVICIO'];
const TRANSPORTE_TAXI = ['CABIFY', 'UBER', 'BOLT', 'TAXI', 'FREE NOW', 'FREENOW'];
const SUPERMERCADO = ['MERCADONA', 'CARREFOUR', 'LIDL', 'ALDI', 'ALCAMPO', 'EROSKI', 'AHORRAMAS', 'HIPERCOR', 'CONSUM', 'MASYMAS', 'SUPERMERCADO', 'SUPERCOR', 'BONPREU', 'CAPRABO', 'GADIS', 'FROIZ'];
const COMPRA_ONLINE = ['AMAZON', 'AMZN', 'ALIEXPRESS', 'ALI EXPRESS', 'SHEIN', 'TEMU', 'EBAY', 'WISH'];
const REPARACION = ['LEROY MERLIN', 'LEROY', 'BRICOMART', 'BRICODEPOT', 'BAUHAUS', 'FERRETERIA', 'BRICOLAJE', 'REPARACION', 'FONTANERO', 'FONTANERIA', 'ELECTRICISTA', 'CERRAJERO'];
const OCIO_APUESTAS = ['BOTEMANIA', 'LOTERIA', 'LOTERIAS', 'APUESTAS', 'CODERE', 'BET365', 'SPORTIUM', 'ONCE'];
const OCIO_CINE = ['CINE', 'CINES', 'YELMO', 'KINEPOLIS', 'CINESA'];
const SUSCRIPCION_STREAMING = ['NETFLIX', 'HBO', 'DISNEY', 'PRIME VIDEO', 'DAZN', 'FILMIN', 'MOVISTAR PLUS'];
const SUSCRIPCION_MUSICA = ['SPOTIFY', 'APPLE MUSIC', 'DEEZER', 'TIDAL'];
const SUSCRIPCION_CLOUD = ['ICLOUD', 'GOOGLE ONE', 'GOOGLE STORAGE', 'DROPBOX', 'ONEDRIVE'];
const SUSCRIPCION_SOFTWARE = ['MICROSOFT 365', 'OFFICE 365', 'ADOBE', 'CHATGPT', 'OPENAI', 'CLAUDE AI', 'GITHUB', 'NOTION'];
const SUSCRIPCION_GIMNASIO = ['GIMNASIO', 'GYM', 'BASIC FIT', 'BASIC-FIT', 'FITNESS'];
const GESTION_GESTORIA = ['GESTORIA'];
const GESTION_ASESORIA = ['ASESORIA', 'ASESORES'];
const GESTION_ABOGADO = ['ABOGADO', 'ABOGADOS', 'DESPACHO ABOGADOS', 'PROCURADOR'];
const GESTION_OTROS = ['HONORARIOS', 'NOTARIA', 'NOTARIO', 'REGISTRO PROPIEDAD', 'INTERMEDIACION', 'INMOBILIARIA', 'ADMINISTRADOR'];
const CUIDADO_FARMACIA = ['FARMACIA', 'PARAFARMACIA'];
const CUIDADO_PELUQUERIA = ['PELUQUERIA', 'BARBERIA', 'ESTETICA'];
const CUIDADO_MEDICO = ['CLINICA', 'DENTAL', 'DENTISTA', 'MEDICO', 'HOSPITAL', 'FISIOTERAPIA', 'OPTICA'];
const EDUCACION = ['COLEGIO', 'UNIVERSIDAD', 'ACADEMIA', 'CURSO', 'CURSOS', 'UDEMY', 'COURSERA', 'ESCUELA', 'FORMACION'];
const ALQUILER = ['ALQUILER', 'ARRENDAMIENTO', 'RENTA', 'RENTING'];
const LIMPIEZA = ['LIMPIEZA', 'LAVANDERIA'];

// ─── Reglas ─────────────────────────────────────────────────────────────────

type Regla = (m: LineaParaReglas, ctx: Contexto) => Parcial | undefined;

const entra = (m: LineaParaReglas) => m.amount > 0;
const sale = (m: LineaParaReglas) => m.amount < 0;
const texto = (m: LineaParaReglas) => `${m.description} ${m.reference ?? ''}`;

const gasto = (familia: FamiliaId, motivo: string, subtipo?: string): Parcial =>
  ({ naturaleza: 'gasto', familia, ...(subtipo ? { subtipo } : {}), motivo });

/** Familia + subtipo por una lista de comercios · solo cuando el dinero SALE. */
function porComercio(m: LineaParaReglas, lista: readonly string[], familia: FamiliaId, subtipo?: string): Parcial | undefined {
  if (!sale(m)) return undefined;
  const cual = cualCasa(texto(m), lista);
  return cual ? gasto(familia, `«${cual}» en el concepto`, subtipo) : undefined;
}

const REGLAS: Regla[] = [
  // ── 5 · «préstamo» son tres cosas · el patrón completo, no la palabra ──
  (m) => (sale(m) && tieneAlguna(texto(m), LIQUIDACION_TARJETA)
    ? { naturaleza: 'gasto', metodo: 'domiciliacion', motivo: 'liquidación de la tarjeta · no es un préstamo' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), DISPOSICION)
    ? { naturaleza: 'movimiento_interno', familia: 'disposicion_prestamo', sentido: 'entra', metodo: 'transferencia', motivo: 'disposición del préstamo · capital que entra contra deuda' }
    : undefined),
  (m) => (sale(m) && tieneAlguna(texto(m), CUOTA_PRESTAMO)
    ? { ...gasto('prestamo_hipoteca', 'cuota del préstamo · cargo entero, el cuadro lo desglosa'), metodo: 'domiciliacion' }
    : undefined),

  // ── 2 · el signo manda sobre la palabra ──
  (m) => (entra(m) && tieneAlguna(texto(m), ABONO_DOMICILIACION)
    ? { naturaleza: 'ingreso', familia: 'otros_ingresos', motivo: 'abono en positivo · bonificación o devolución, no un recibo' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), [...SUMINISTRO_LUZ, ...SUMINISTRO_GAS, ...SUMINISTRO_AGUA, ...SUMINISTRO_SIN_SUBTIPO].filter((p) => p.length > 3))
    ? { naturaleza: 'ingreso', familia: 'otros_ingresos', motivo: 'abono de la comercializadora · devolución de un suministro' }
    : undefined),

  // ── 3 · nómina yo→yo · la parte es el propio titular ──
  (m, ctx) => (tieneAlguna(texto(m), NOMINA) && laParteEsElTitular(m.description, [...ctx.nombresTitular])
    ? { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_otra_cuenta', sentido: entra(m) ? 'entra' : 'sale', metodo: 'transferencia', motivo: 'reparto de la nómina entre cuentas propias · el otro lado eres tú' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), NOMINA)
    ? { naturaleza: 'ingreso', familia: 'nomina', metodo: 'transferencia', motivo: '«nómina» en el concepto' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), ['AEAT', 'AGENCIA TRIBUTARIA', 'HACIENDA', 'DEVOLUCION RENTA', 'TESORO PUBLICO'])
    ? { naturaleza: 'ingreso', familia: 'otros_ingresos', motivo: 'devolución de Hacienda' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), PENSION)
    ? { naturaleza: 'ingreso', familia: 'pension', motivo: '«pensión» en el concepto' }
    : undefined),

  // ── interno · fianza, efectivo, recarga, aportación ──
  (m) => (tieneAlguna(texto(m), FIANZA)
    ? { naturaleza: 'movimiento_interno', familia: 'fianza', subtipo: entra(m) ? 'entra' : 'devuelve', sentido: entra(m) ? 'entra' : 'sale', motivo: 'fianza · dinero del inquilino que se custodia, no es tuyo' }
    : undefined),
  (m) => (sale(m) && tieneAlguna(texto(m), EFECTIVO_SALE)
    ? { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_efectivo', sentido: 'sale', metodo: 'efectivo', motivo: 'retirada en cajero · el dinero pasa a efectivo' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), EFECTIVO_ENTRA)
    ? { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_efectivo', sentido: 'entra', metodo: 'efectivo', motivo: 'ingreso de efectivo · viene de tu efectivo' }
    : undefined),
  // 6 · la recarga que RECIBE la tarjeta (Revolut «Recarga de *4437» · TOPUP) ·
  // el dinero viene de una cuenta propia por definición de recarga.
  (m) => (entra(m) && tieneAlguna(texto(m), RECARGA_TARJETA)
    ? { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_tarjeta', sentido: 'entra', metodo: 'transferencia', motivo: 'recarga de la tarjeta · dinero que llega de una cuenta propia' }
    : undefined),
  (m) => (sale(m) && tieneAlguna(texto(m), APORTACION_INVERSION)
    ? { naturaleza: 'movimiento_interno', familia: 'aportacion', subtipo: 'inversion', sentido: 'sale', motivo: 'transferencia a una plataforma de inversión · aportación, el dinero sigue tuyo' }
    : undefined),
  (m) => (sale(m) && tieneAlguna(texto(m), APORTACION_PLAN)
    ? { naturaleza: 'movimiento_interno', familia: 'aportacion', subtipo: 'plan_pensiones', sentido: 'sale', motivo: 'aportación al plan de pensiones' }
    : undefined),

  // ── ingresos del propio banco ──
  (m) => (entra(m) && tieneAlguna(texto(m), RENDIMIENTO_DIVIDENDO)
    ? { naturaleza: 'ingreso', familia: 'rendimiento', subtipo: 'dividendo', motivo: '«dividendo» en el concepto' }
    : undefined),
  (m) => (entra(m) && tieneAlguna(texto(m), RENDIMIENTO_INTERES)
    ? { naturaleza: 'ingreso', familia: 'rendimiento', subtipo: 'interes', metodo: 'cargo_abono_banco', motivo: 'remuneración o intereses de la cuenta' }
    : undefined),
  (m) => (sale(m) && tieneAlguna(texto(m), COMISIONES)
    ? { ...gasto('comisiones_bancarias', 'comisión del banco'), metodo: 'cargo_abono_banco' }
    : undefined),

  // ── 7 · Compra Bizum [comercio] · el comercio manda · Bizum a persona no dice nada ──
  (m) => {
    if (!sale(m) || !tienePalabra(m.description, 'COMPRA BIZUM')) return undefined;
    // Se clasifica por el comercio con las reglas de abajo; si ninguna casa, es
    // un gasto por bizum sin familia (no se inventa el comercio).
    return { naturaleza: 'gasto', metodo: 'bizum', motivo: 'compra por Bizum en un comercio' };
  },

  // ── techo · comunidad, suministros, seguros, impuestos ──
  (m) => (sale(m) && tieneAlguna(texto(m), IBI) ? gasto('impuestos_tasas', '«IBI» en el concepto', 'ibi') : undefined),
  (m) => (sale(m) && tienePalabra(texto(m), 'BASURAS') ? gasto('impuestos_tasas', '«basuras» en el concepto', 'basuras') : undefined),
  (m) => porComercio(m, MULTAS, 'multas'),
  (m) => porComercio(m, IMPUESTOS, 'impuestos_tasas'),
  (m) => porComercio(m, COMUNIDAD, 'comunidad'),
  (m) => porComercio(m, SUMINISTRO_AGUA, 'suministro', 'agua'),
  (m) => porComercio(m, SUMINISTRO_GAS, 'suministro', 'gas'),
  (m) => porComercio(m, SUMINISTRO_LUZ, 'suministro', 'luz'),
  (m) => porComercio(m, SUMINISTRO_TELEFONIA, 'suministro', 'telefonia'),
  (m) => porComercio(m, SUMINISTRO_SIN_SUBTIPO, 'suministro'),
  (m) => porComercio(m, SEGUROS_SALUD, 'seguros_alarmas', 'salud'),
  (m) => porComercio(m, SEGUROS_DECESOS, 'seguros_alarmas', 'decesos'),
  (m) => porComercio(m, SEGUROS_VEHICULO, 'seguros_alarmas', 'vehiculo'),
  (m) => porComercio(m, SEGUROS, 'seguros_alarmas'),
  (m) => porComercio(m, ALQUILER, 'alquiler_renting'),
  (m) => (entra(m) && tieneAlguna(texto(m), ALQUILER)
    ? { naturaleza: 'ingreso', familia: 'alquiler', motivo: '«alquiler» en el concepto · el piso lo dice el contrato' }
    : undefined),
  (m) => porComercio(m, LIMPIEZA, 'limpieza'),
  (m) => porComercio(m, REPARACION, 'reparacion_mantenimiento'),
  (m) => porComercio(m, GESTION_GESTORIA, 'gestion', 'gestoria'),
  (m) => porComercio(m, GESTION_ASESORIA, 'gestion', 'asesoria'),
  (m) => porComercio(m, GESTION_ABOGADO, 'gestion', 'abogado'),
  (m) => porComercio(m, GESTION_OTROS, 'gestion', 'otros'),

  // ── día a día ──
  (m) => porComercio(m, TRANSPORTE_PARKING, 'transporte', 'parking'),
  (m) => porComercio(m, TRANSPORTE_PEAJES, 'transporte', 'peajes'),
  (m) => porComercio(m, TRANSPORTE_TAXI, 'transporte', 'taxi_vtc'),
  (m) => porComercio(m, TRANSPORTE_PUBLICO, 'transporte', 'transporte_publico'),
  (m) => porComercio(m, TRANSPORTE_COMBUSTIBLE, 'transporte', 'combustible'),
  (m) => porComercio(m, SUPERMERCADO, 'supermercado'),
  (m) => porComercio(m, COMPRA_ONLINE, 'compra_online'),
  (m) => porComercio(m, OCIO_CINE, 'ocio', 'cine_planes'),
  (m) => porComercio(m, OCIO_APUESTAS, 'ocio', 'otros'),
  (m) => porComercio(m, SUSCRIPCION_STREAMING, 'suscripciones', 'streaming'),
  (m) => porComercio(m, SUSCRIPCION_MUSICA, 'suscripciones', 'musica'),
  (m) => porComercio(m, SUSCRIPCION_CLOUD, 'suscripciones', 'cloud'),
  (m) => porComercio(m, SUSCRIPCION_SOFTWARE, 'suscripciones', 'software'),
  (m) => porComercio(m, SUSCRIPCION_GIMNASIO, 'suscripciones', 'gimnasio'),
  (m) => porComercio(m, CUIDADO_FARMACIA, 'cuidado_personal', 'farmacia'),
  (m) => porComercio(m, CUIDADO_PELUQUERIA, 'cuidado_personal', 'peluqueria'),
  (m) => porComercio(m, CUIDADO_MEDICO, 'cuidado_personal', 'medico'),
  (m) => porComercio(m, EDUCACION, 'educacion_formacion'),
];

/**
 * Lo que las reglas duras dicen del texto · fundido en orden: la primera regla
 * que fija un eje se lo queda, las siguientes solo rellenan huecos. Así «Compra
 * Bizum Renfe» sale con método bizum (regla 7) Y familia transporte (comercio).
 */
export function porConcepto(m: LineaParaReglas, ctx: Contexto): Parcial | undefined {
  let acumulado: Parcial | undefined;
  for (const regla of REGLAS) {
    const r = regla(m, ctx);
    if (!r) continue;
    if (!acumulado) {
      acumulado = { ...r };
      continue;
    }
    // Un eje ya fijado no se pisa · un movimiento interno tampoco se convierte en gasto.
    if (acumulado.naturaleza === 'movimiento_interno' && r.naturaleza !== 'movimiento_interno') continue;
    if (acumulado.familia === undefined && r.familia !== undefined && (acumulado.naturaleza === undefined || acumulado.naturaleza === r.naturaleza)) {
      acumulado.familia = r.familia;
      acumulado.subtipo = r.subtipo;
      acumulado.motivo = `${acumulado.motivo} · ${r.motivo}`;
    }
    if (acumulado.metodo === undefined && r.metodo !== undefined) acumulado.metodo = r.metodo;
    if (acumulado.naturaleza === undefined && r.naturaleza !== undefined) acumulado.naturaleza = r.naturaleza;
  }
  return acumulado;
}

/** ¿Es un bazar opaco? (regla 6 · no se sabe qué se compró). */
export function esBazarOpaco(texto: string): boolean {
  return tieneAlguna(texto, COMPRA_ONLINE);
}
