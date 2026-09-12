// ============================================================================
// E3.1 · §7.3 · CATÁLOGO NACIONAL · la semilla
// ============================================================================
//
// Una tabla COMPARTIDA por todos los clientes: NIF (o alias de nombre) →
// proveedor → familia · subtipo · ámbito sugerido. No es de nadie: Iberdrola
// cobra igual en Cádiz que en Bilbao, así que reconocerla no puede depender de
// que este cliente la haya dado de alta.
//
// Esto es la SEMILLA que viaja en el código. Lo que un cliente enseñe encima
// vive en el store `proveedores` —el mismo donde están sus propios proveedores
// del IRPF, porque «quién cobra» se pregunta en UN solo sitio (E3.1b)— y se
// suma a esto; la semilla nunca se reescribe.
//
// Reglas de la tabla:
//   · El NIF es la clave fuerte. Un NIF con su letra de control bien no admite
//     dos lecturas y no cambia de dueño.
//   · Los ALIAS son lo que el BANCO escribe, no lo que pone en el BOE. Unicaja
//     recorta el emisor a 16 caracteres («FCC AQUALI447497») y BBVA escribe
//     «BIP   DRIVE, S.A.»: los dos entran como alias, porque el alias existe
//     para casar con el extracto, no para quedar bonito.
//   · Un alias se compara SIN espacios, puntos ni guiones («BIPDRIVE») y por
//     CONTENCIÓN, así que basta con la raíz que no admite dos lecturas
//     («AQUALI» casa «FCC AQUALI447497» y «AQUALIA»). Mínimo 4 caracteres:
//     por debajo se cuela cualquier cosa.
//   · Si una entidad no dice su familia sin dudar, NO entra. ATLAS no inventa.
//
// EL GRUESO NO ESTÁ AQUÍ. Las 308 entidades reales de España viven en
// `catalogo-nacional-proveedores.json` y las carga `desdeCatalogoNacional.ts`.
// Este fichero es el COMPLEMENTO: lo que el fichero de 308 no trae y el corpus
// real sí necesita —
//
//   · las marcas que faltan (Wekiwi y Visalia, con su CIF sacado del propio
//     extracto; Tuio, MetLife, Planeta, Ayvens, Finutive…);
//   · los ALIAS RECORTADOS que escribe cada banco, que ningún registro
//     oficial recoge: Unicaja corta el emisor a 16 caracteres
//     («FCC AQUALI447497», «DIGI SPAIN400245») y BBVA escribe «BIP   DRIVE, S.A.»;
//   · los PATRONES que no son una empresa pero sí una forma nacional de
//     escribir a un acreedor («Comunitat de Propietaris», «Ajuntament de…»),
//     que absorben las listas de `reglasDuras`.
//
// Sobre el NIF de Iberdrola · hay DOS y los dos son válidos, porque son dos
// sociedades distintas: `A95758389` (Iberdrola Clientes, el del fichero de las
// 308) y `A95554630` (Iberdrola Comercialización de Último Recurso, el que
// aparece de verdad en la «Referencia 1» de los recibos de Sabadell y cuyo
// concepto dice «IBERDROLA COMERCIALIZACION DE U»). El que `providerDirectory`
// traía, `A95075578`, no es ninguno de los dos. Están los dos.
// ============================================================================

import type { FamiliaId } from '../catalogo/catalogoUnico';
import type { Ambito } from '../catalogo/catalogoUnico';
import { entidadesDelFicheroNacional } from './desdeCatalogoNacional';

/** Una entidad del catálogo · lo mismo que aprende un cliente y lo que viene de fábrica. */
export interface EntidadNacional {
  /** Nombre canónico · el que se enseña. */
  nombre: string;
  /** CIF/NIF con la letra bien · clave fuerte. Sin él solo casa por alias. */
  nif?: string;
  /** Lo que escribe el BANCO · se comparan sin espacios ni puntos, por contención. */
  alias: readonly string[];
  familia: FamiliaId;
  subtipo?: string;
  /** Sugerido · nunca fija el piso, solo dice dónde suele caer. */
  ambito?: Ambito;
  /** Veces que el cliente lo ha confirmado · solo lo suyo lo trae; la semilla no. */
  confirmaciones?: number;
}

/** Sin espacios, puntos, guiones ni tildes · la forma en que se comparan los alias. */
export function claveDeNombreCatalogo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Lo mínimo de un alias para que no se cuele cualquier cosa. */
export const MINIMO_ALIAS = 4;

// ─── Financieras · lo que NUNCA puede ir a Supermercado ─────────────────────
//
// «Financiera El Corte Inglés» lleva CORTE INGLES dentro y «Financiera
// Carrefour» lleva CARREFOUR: por texto caen en el supermercado y el recibo de
// un crédito al consumo se cuenta como la compra de la semana. El catálogo los
// saca de ahí ANTES de que ninguna regla de texto los vea.

const FINANCIERAS: readonly EntidadNacional[] = [
  { nombre: 'WiZink Bank', alias: ['WIZINK', 'WIZINKBANK'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
  { nombre: 'Cetelem', alias: ['CETELEM', 'BANCOCETELEM'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
  { nombre: 'Bankinter Consumer Finance', alias: ['BANKINTERCONSUMER', 'BANKINTERCONSUMERFINANCE'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
  { nombre: 'Servicios Financieros Carrefour', alias: ['FINANCIERACARREFOUR', 'SERVICIOSFINANCIEROSCARREFOUR', 'CARREFOURPASS'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
  { nombre: 'Financiera El Corte Inglés', alias: ['FINANCIERAELCORTEINGLES', 'FINANCIERACORTEINGLES'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
  { nombre: 'Sabadell Consumer Finance', alias: ['SABADELLCONSUMER'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
  { nombre: 'Smartflip', alias: ['SMARTFLIP'], familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
];

// ─── Suministros ────────────────────────────────────────────────────────────

const SUMINISTROS: readonly EntidadNacional[] = [
  // Luz · el NIF de Iberdrola CORREGIDO (A95554630 · Ref 1 del fixture Sabadell).
  // El CUR es el que firma los recibos del corpus real («Referencia 1»
  // A95554630001 · concepto «IBERDROLA COMERCIALIZACION DE U»). Sin él, el
  // catálogo de las 308 —que trae el CIF de Iberdrola Clientes— no casaría
  // ninguno de los recibos de Jose.
  { nombre: 'Iberdrola Comercialización de Último Recurso', nif: 'A95554630', alias: ['IBERDROLA'], familia: 'suministro', subtipo: 'luz' },
  { nombre: 'Wekiwi', nif: 'B67686782', alias: ['WEKIWI'], familia: 'suministro', subtipo: 'luz' },
  { nombre: 'Curenergía', alias: ['CURENERGIA'], familia: 'suministro', subtipo: 'luz' },
  // Gas
  { nombre: 'Visalia Energía', nif: 'B99340564', alias: ['VISALIA'], familia: 'suministro', subtipo: 'gas' },
  // Agua · Unicaja escribe «FCC AQUALI447497»: el alias es lo que cabe.
  { nombre: 'Aqualia', alias: ['AQUALI', 'FCCAQUALI'], familia: 'suministro', subtipo: 'agua' },
  { nombre: 'Canal de Isabel II', alias: ['CANALDEISABEL', 'CANALISABEL'], familia: 'suministro', subtipo: 'agua' },
  // Telefonía · Unicaja escribe «DIGI SPAIN400245» y «Simyo     633782».
  { nombre: 'Digi', alias: ['DIGISPAIN', 'DIGIMOBIL'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Simyo', alias: ['SIMYO'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Orange España', alias: ['ORANGEESPAGNE', 'ORANGEESPANA', 'ORANGEFRANCETELECOM'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Movistar', alias: ['MOVISTAR', 'TELEFONICADEESPANA'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Vodafone', alias: ['VODAFONE'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Yoigo', alias: ['YOIGO'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'MásMóvil', alias: ['MASMOVIL'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Jazztel', alias: ['JAZZTEL'], familia: 'suministro', subtipo: 'telefonia' },
  { nombre: 'Euskaltel', alias: ['EUSKALTEL'], familia: 'suministro', subtipo: 'telefonia' },
  // Sin subtipo · la comercializadora vende luz Y gas y el recibo no lo dice.
  { nombre: 'Repsol', nif: 'A28129274', alias: ['REPSOLCOMERCIALIZADORA', 'REPSOLLUZ', 'REPSOLGAS'], familia: 'suministro' },
];

// ─── Seguros ────────────────────────────────────────────────────────────────

const SEGUROS: readonly EntidadNacional[] = [
  { nombre: 'Tuio Seguros', alias: ['TUIO', 'GCRETUIO'], familia: 'seguros_alarmas', subtipo: 'hogar' },
  // Las dos llegan como RECIBO domiciliado en el corpus real.
  { nombre: 'MetLife Europe', alias: ['METLIFE'], familia: 'seguros_alarmas', subtipo: 'vida' },
  { nombre: 'Planeta Seguros', alias: ['PLANETASEGUROS'], familia: 'seguros_alarmas' },
  { nombre: 'Unicaja Plan Seguro', alias: ['PLANUNISEGUR', 'UNICAJAPLANSEGURO'], familia: 'seguros_alarmas' },
  { nombre: 'Mapfre', alias: ['MAPFRE'], familia: 'seguros_alarmas' },
  { nombre: 'Nationale-Nederlanden', alias: ['NATIONALENEDERLANDEN'], familia: 'seguros_alarmas', subtipo: 'vida' },
  { nombre: 'Allianz', alias: ['ALLIANZ'], familia: 'seguros_alarmas' },
  { nombre: 'AXA', alias: ['AXASEGUROS'], familia: 'seguros_alarmas' },
  { nombre: 'Generali', alias: ['GENERALI'], familia: 'seguros_alarmas' },
  { nombre: 'Zurich', alias: ['ZURICH'], familia: 'seguros_alarmas' },
  { nombre: 'Reale', alias: ['REALESEGUROS'], familia: 'seguros_alarmas' },
  { nombre: 'Pelayo', alias: ['PELAYO'], familia: 'seguros_alarmas' },
  { nombre: 'Mutua Madrileña', alias: ['MUTUAMADRILENA'], familia: 'seguros_alarmas' },
  { nombre: 'SegurCaixa Adeslas', alias: ['SEGURCAIXA'], familia: 'seguros_alarmas' },
  { nombre: 'Adeslas', alias: ['ADESLAS'], familia: 'seguros_alarmas', subtipo: 'salud' },
  { nombre: 'Sanitas', alias: ['SANITAS'], familia: 'seguros_alarmas', subtipo: 'salud' },
  { nombre: 'DKV', alias: ['DKVSEGUROS'], familia: 'seguros_alarmas', subtipo: 'salud' },
  { nombre: 'Asisa', alias: ['ASISA'], familia: 'seguros_alarmas', subtipo: 'salud' },
  { nombre: 'Ocaso', alias: ['OCASO'], familia: 'seguros_alarmas', subtipo: 'decesos' },
  { nombre: 'Santalucía', alias: ['SANTALUCIA'], familia: 'seguros_alarmas', subtipo: 'decesos' },
  { nombre: 'Línea Directa', alias: ['LINEADIRECTA'], familia: 'seguros_alarmas', subtipo: 'vehiculo' },
  { nombre: 'Génesis Seguros', alias: ['GENESISSEGUROS'], familia: 'seguros_alarmas', subtipo: 'vehiculo' },
  { nombre: 'Verti', alias: ['VERTI'], familia: 'seguros_alarmas', subtipo: 'vehiculo' },
];



// ─── Gestión, ocio, comercio · lo que no admite dos lecturas ────────────────


const OTROS: readonly EntidadNacional[] = [
  // Renting de vehículo · ALD/LeasePlan pasaron a llamarse Ayvens en 2024.
  // Llega como recibo domiciliado (12 en el corpus real).
  { nombre: 'Ayvens', alias: ['AYVENS', 'ALDAUTOMOTIVE', 'LEASEPLAN'], familia: 'alquiler_renting', ambito: 'personal' },
  { nombre: 'Finutive', alias: ['FINUTIVE'], familia: 'gestion', subtipo: 'gestoria' },
];


/**
 * El COMPLEMENTO · lo que el fichero de 308 no trae. Se usa junto a él, no en
 * su lugar: `semillaDelCatalogo()` los junta y es lo que consume el motor.
 */
export const COMPLEMENTO_DEL_CATALOGO: readonly EntidadNacional[] = [
  ...FINANCIERAS,
  ...SUMINISTROS,
  ...SEGUROS,
  ...OTROS,
];

/**
 * La semilla ENTERA que viaja en el código: las 308 entidades reales del
 * fichero de Jose más el complemento de arriba.
 *
 * El COMPLEMENTO va DELANTE a propósito: cuando las dos capas conocen a la
 * misma entidad, manda la de aquí, porque es la que se ha comprobado contra un
 * extracto de verdad (el CIF del CUR de Iberdrola, el alias recortado que
 * escribe Unicaja). El fichero de 308 aporta la cobertura; esto, la precisión
 * sobre lo que el banco escribe de verdad.
 */
export function semillaDelCatalogo(): EntidadNacional[] {
  return [...COMPLEMENTO_DEL_CATALOGO, ...entidadesDelFicheroNacional()];
}
