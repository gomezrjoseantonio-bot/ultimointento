// ============================================================================
// E3.1 · §7.3 · CARGAR el catálogo nacional de Jose · 308 entidades reales
// ============================================================================
//
// `catalogo-nacional-proveedores.json` NO se reconstruye ni se siembra a mano:
// es el fichero que ya existía, con marca comercial, grupo, CIF (76 de ellas),
// categoría, subcategoría y «ancla de reconocimiento» (de dónde sale el dato:
// registro CNMC, Banco de España, DGSFP, concesión municipal).
//
// Aquí solo se TRADUCE al catálogo único de familias. Y traducir tiene tres
// decisiones que no son mecánicas — las tres van explicadas, porque las tres
// se pueden discutir:
//
//   1 · UN BANCO NO ES UN PRÉSTAMO. En `FINANCIERAS · BANCO` están Santander,
//       Sabadell, Unicaja, BBVA e ING: los bancos del propio usuario. Mapearlos
//       a «crédito al consumo» convertiría cada comisión y cada liquidación de
//       intereses de su cuenta en la cuota de un préstamo. Así que un BANCO
//       entra en el catálogo (su CIF y su marca sirven para reconocerlo) pero
//       NO propone familia. Las excepciones son las MONOLINE de crédito al
//       consumo, que se llaman banco pero solo emiten tarjeta revolving y
//       crédito: van en `MONOLINE_DE_CONSUMO`, una lista corta y auditable.
//   2 · UNA ENTIDAD DE PAGO TAMPOCO. Un cargo de PayPal o de Wise puede ser
//       cualquier cosa: es el tubo, no el destino. Sin familia.
//   3 · UN CIF EN DOS CATEGORÍAS PIERDE EL SUBTIPO. Endesa Energía es el mismo
//       CIF en LUZ y en GAS, y Mapfre el mismo en coche, hogar y decesos. El
//       recibo no dice cuál, así que se conserva la familia (suministro,
//       seguros) y se deja el subtipo VACÍO. ATLAS no inventa.
//
// Las filas cuyo CIF no pasa el dígito de control entran igual, pero SOLO por
// nombre: un CIF mal copiado cruzaría un recibo con quien no es.
// ============================================================================

import type { FamiliaId, Ambito } from '../catalogo/catalogoUnico';
import { esCif, esNifPersona, normalizarIdentificador } from '../identificadoresDelConcepto';
import type { EntidadNacional } from './entidadesNacionales';
import filas from './catalogo-nacional-proveedores.json';

/** Una fila del fichero, tal cual viene. */
export interface FilaCatalogoNacional {
  cif: string | null;
  nombreFiscal: string | null;
  marca: string | null;
  grupo: string | null;
  categoria: string | null;
  subcategoria: string | null;
  ancla: string | null;
}

/** Categoría del fichero → familia · subtipo del catálogo único. */
const POR_CATEGORIA: Record<string, { familia: FamiliaId; subtipo?: string; ambito?: Ambito }> = {
  LUZ: { familia: 'suministro', subtipo: 'luz' },
  GAS: { familia: 'suministro', subtipo: 'gas' },
  AGUA: { familia: 'suministro', subtipo: 'agua' },
  'TELEFONÍA': { familia: 'suministro', subtipo: 'telefonia' },
  'SEGURO COCHE': { familia: 'seguros_alarmas', subtipo: 'vehiculo', ambito: 'personal' },
  'SEGURO HOGAR': { familia: 'seguros_alarmas', subtipo: 'hogar' },
  'SEGURO VIDA': { familia: 'seguros_alarmas', subtipo: 'vida', ambito: 'personal' },
  'SEGURO DECESOS': { familia: 'seguros_alarmas', subtipo: 'decesos', ambito: 'personal' },
};

/** Subcategoría de FINANCIERAS → qué se puede afirmar · lo que no está aquí, nada. */
const POR_SUBCATEGORIA_FINANCIERA: Record<string, { familia: FamiliaId; subtipo?: string; ambito?: Ambito }> = {
  'EFC/FINANCIERA': { familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' },
};

/**
 * Bancos que en la práctica solo dan crédito al consumo y tarjeta revolving.
 * Se llaman «banco» pero un recibo suyo NO es una comisión de tu cuenta
 * corriente: es la cuota de un crédito. Lista corta a propósito — cada nombre
 * que se añada aquí hay que poder defenderlo.
 */
const MONOLINE_DE_CONSUMO = ['WIZINK BANK', 'ONEY'];

/** Sin tildes, en mayúsculas · para comparar nombres del fichero. */
function plano(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

/**
 * LA MARCA CORTA · «Naturgy Iberia» → «Naturgy», «Endesa Energía» → «Endesa».
 *
 * El fichero trae el nombre de la SOCIEDAD y el banco escribe la MARCA. Como
 * los alias se comparan por contención (el texto del banco tiene que CONTENER
 * el alias), un alias largo no casa nunca con un texto corto: «RECIBO NATURGY»
 * no contiene «NATURGYIBERIA». Sin esto, Naturgy, Endesa y Orange —tres de las
 * marcas más comunes de España— no se reconocían.
 *
 * La regla que decide si se puede recortar: solo cuando lo que sobra son
 * SUFIJOS CORPORATIVOS (España, Iberia, Clientes, S.A.), que no cambian de qué
 * es la empresa. Si lo que sobra es una palabra de SECTOR, NO se recorta,
 * porque entonces el nombre entero es la información:
 *
 *   · «Carrefour Telecom» → recortar daría «CARREFOUR», y la compra del
 *     supermercado se iría a telefonía;
 *   · «Acciona Agua» → «ACCIONA» es un grupo que hace de todo;
 *   · «Servicios Financieros Carrefour» → una FINANCIERA no se recorta nunca
 *     (son justo las que comparten marca con un comercio: ahí el nombre largo
 *     ES la señal, y por eso la financiera y el súper se distinguen).
 */
const SUFIJO_CORPORATIVO = new Set([
  'ESPANA', 'ESPAÑA', 'IBERIA', 'CLIENTES', 'GROUP', 'GRUPO', 'SA', 'SAU', 'SL',
  'SLU', 'SAE', 'COMERCIALIZADORA', 'COMERCIALIZACION', 'DISTRIBUCION',
  'SUCURSAL', 'EN', 'DE', 'DEL', 'LA', 'EL', 'Y', 'ENERGIA', 'ENERGY',
]);

/** Palabras que no identifican a nadie por sí solas. */
const PALABRA_GENERICA = new Set([
  'AGUAS', 'AGUA', 'CANAL', 'COMUNIDAD', 'COMUNITAT', 'SERVICIOS', 'FINANCIERA',
  'BANCO', 'BANCA', 'GRUPO', 'SOCIEDAD', 'EMPRESA', 'COMPANIA', 'GENERAL',
  'NUEVA', 'LINEA', 'MUTUA', 'SEGUROS', 'SEGURO', 'PLAN', 'ENERGIA', 'GAS',
  'ELECTRICA', 'ELECTRICIDAD', 'TELECOM', 'MOVIL',
  // REPSOL se queda fuera a propósito: «COMPRA REPSOL» es la gasolinera, no la
  // luz. Ahí manda la regla de transporte y el catálogo no debe pisarla.
  'REPSOL',
]);

function marcaCorta(nombre: string, categoria: string): string | undefined {
  if (plano(categoria) === 'FINANCIERAS') return undefined;
  const palabras = plano(nombre).split(/[^A-ZÑ0-9]+/).filter(Boolean);
  const primera = palabras[0];
  if (!primera || primera.length < 4 || PALABRA_GENERICA.has(primera)) return undefined;
  if (palabras.length < 2) return undefined;
  // Solo se recorta si cada palabra que sobra es un sufijo corporativo.
  if (!palabras.slice(1).every((w) => SUFIJO_CORPORATIVO.has(w))) return undefined;
  return primera;
}

function claseDe(fila: FilaCatalogoNacional): { familia: FamiliaId; subtipo?: string; ambito?: Ambito } | undefined {
  const categoria = plano(fila.categoria ?? '');
  const directa = POR_CATEGORIA[fila.categoria ?? ''] ?? POR_CATEGORIA[categoria];
  if (directa) return directa;
  if (categoria !== 'FINANCIERAS') return undefined;
  const porSub = POR_SUBCATEGORIA_FINANCIERA[fila.subcategoria ?? ''];
  if (porSub) return porSub;
  // Decisión 1 · un banco cualquiera no propone nada; una monoline de consumo sí.
  const nombre = plano(fila.marca ?? '');
  if (MONOLINE_DE_CONSUMO.some((m) => nombre.includes(m))) {
    return { familia: 'prestamo_hipoteca', subtipo: 'credito_consumo', ambito: 'personal' };
  }
  return undefined;
}

/** El CIF normalizado si pasa el dígito de control · `undefined` si no. */
function cifValido(cif: string | null): string | undefined {
  if (!cif) return undefined;
  const v = normalizarIdentificador(cif);
  return esCif(v) || esNifPersona(v) ? v : undefined;
}

/**
 * Las 308 filas traducidas a entidades del catálogo. Las que no se pueden
 * clasificar sin inventar (un banco, una entidad de pago, una gestora) se
 * quedan fuera: estar en el fichero no es lo mismo que saber qué es un cargo
 * suyo.
 */
export function entidadesDelFicheroNacional(
  origen: readonly FilaCatalogoNacional[] = filas as FilaCatalogoNacional[],
): EntidadNacional[] {
  // Decisión 3 · un CIF que aparece con varios subtipos pierde el subtipo.
  const subtiposPorCif = new Map<string, Set<string>>();
  for (const fila of origen) {
    const cif = cifValido(fila.cif);
    const clase = claseDe(fila);
    if (!cif || !clase?.subtipo) continue;
    if (!subtiposPorCif.has(cif)) subtiposPorCif.set(cif, new Set());
    subtiposPorCif.get(cif)!.add(clase.subtipo);
  }

  const porClave = new Map<string, EntidadNacional>();
  for (const fila of origen) {
    const clase = claseDe(fila);
    if (!clase) continue;
    const nombre = (fila.marca ?? fila.nombreFiscal ?? '').trim();
    if (!nombre) continue;
    const cif = cifValido(fila.cif);
    const ambiguo = cif ? (subtiposPorCif.get(cif)?.size ?? 0) > 1 : false;
    const corta = marcaCorta(nombre, fila.categoria ?? '');
    const alias = [nombre, ...(fila.nombreFiscal ? [fila.nombreFiscal] : []), ...(corta ? [corta] : [])];
    // Una entidad por CIF cuando lo hay (Endesa LUZ y Endesa GAS son una), y
    // por nombre cuando no. Las filas que repiten entidad suman sus alias.
    const clave = cif ?? plano(nombre);
    const ya = porClave.get(clave);
    if (ya) {
      porClave.set(clave, { ...ya, alias: Array.from(new Set([...ya.alias, ...alias])) });
      continue;
    }
    porClave.set(clave, {
      nombre,
      ...(cif ? { nif: cif } : {}),
      alias,
      familia: clase.familia,
      ...(clase.subtipo && !ambiguo ? { subtipo: clase.subtipo } : {}),
      ...(clase.ambito ? { ambito: clase.ambito } : {}),
    });
  }
  return Array.from(porClave.values());
}
