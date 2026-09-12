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
    const alias = [nombre, ...(fila.nombreFiscal ? [fila.nombreFiscal] : [])];
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
