// Migración one-shot: limpia CPs estancados en properties (p.ej. "28001" como
// default residual cuando la CCAA/provincia detectada no es Madrid) y re-infiere
// el ITP en properties importadas desde XML antes del fix #1111, donde los
// gastos de adquisición quedaron acumulados en un único cubo
// `other: [{ concept: 'Gastos adquisición AEAT', amount: X }]`.
//
// Reglas:
//  - CP: si postalCode existe pero pertenece a otra provincia distinta de la
//    de la property, se borra (queda '').
//  - ITP: si transmissionRegime === 'usada', hay precio y ccaa conocida, y el
//    desglose actual es el cubo legacy "Gastos adquisición AEAT" (o está
//    vacío), se re-infiere ITP descontándolo del total. Invariante: el total
//    price + itp + otros se mantiene idéntico.
//
// Idempotente por bandera en localStorage.

import { initDB, Property } from '../db';
import { inferirITP } from '../declaracionDistributorService';

const MIGRATION_KEY = 'migration_clean_stale_cp_and_infer_itp_v1';

// Rango aproximado de CP por provincia según el primer par de dígitos.
// Se usa solo para detectar un CP claramente incompatible con la provincia
// guardada (p. ej. "28001" en una property de Asturias).
const CP_PREFIX_POR_PROVINCIA: Record<string, string[]> = {
  'Álava': ['01'],
  'Albacete': ['02'],
  'Alicante': ['03'],
  'Almería': ['04'],
  'Ávila': ['05'],
  'Badajoz': ['06'],
  'Baleares': ['07'],
  'Barcelona': ['08'],
  'Burgos': ['09'],
  'Cáceres': ['10'],
  'Cádiz': ['11'],
  'Castellón': ['12'],
  'Ciudad Real': ['13'],
  'Córdoba': ['14'],
  'A Coruña': ['15'],
  'Coruña': ['15'],
  'Cuenca': ['16'],
  'Girona': ['17'],
  'Gerona': ['17'],
  'Granada': ['18'],
  'Guadalajara': ['19'],
  'Guipúzcoa': ['20'],
  'Gipuzkoa': ['20'],
  'Huelva': ['21'],
  'Huesca': ['22'],
  'Jaén': ['23'],
  'León': ['24'],
  'Lleida': ['25'],
  'Lérida': ['25'],
  'La Rioja': ['26'],
  'Rioja': ['26'],
  'Lugo': ['27'],
  'Madrid': ['28'],
  'Málaga': ['29'],
  'Murcia': ['30'],
  'Navarra': ['31'],
  'Ourense': ['32'],
  'Orense': ['32'],
  'Asturias': ['33'],
  'Palencia': ['34'],
  'Las Palmas': ['35'],
  'Pontevedra': ['36'],
  'Salamanca': ['37'],
  'Santa Cruz de Tenerife': ['38'],
  'Tenerife': ['38'],
  'Cantabria': ['39'],
  'Segovia': ['40'],
  'Sevilla': ['41'],
  'Soria': ['42'],
  'Tarragona': ['43'],
  'Teruel': ['44'],
  'Toledo': ['45'],
  'Valencia': ['46'],
  'Valladolid': ['47'],
  'Vizcaya': ['48'],
  'Bizkaia': ['48'],
  'Zamora': ['49'],
  'Zaragoza': ['50'],
  'Ceuta': ['51'],
  'Melilla': ['52'],
};

function cpEsIncompatibleConProvincia(cp: string, provincia: string): boolean {
  if (!cp || cp.length !== 5 || !provincia) return false;
  const prefijosEsperados = CP_PREFIX_POR_PROVINCIA[provincia];
  if (!prefijosEsperados) return false;
  return !prefijosEsperados.some(p => cp.startsWith(p));
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort
  }
}

function esCuboLegacyAEAT(property: Property): boolean {
  const ac = property.acquisitionCosts;
  if (!ac) return false;
  // Legacy: todo en `other` con concept 'Gastos adquisición AEAT',
  // sin itp/iva/notary/registry/management concretos.
  const tieneDesgloseReal =
    (ac.itp ?? 0) > 0 ||
    (ac.iva ?? 0) > 0 ||
    (ac.notary ?? 0) > 0 ||
    (ac.registry ?? 0) > 0 ||
    (ac.management ?? 0) > 0;
  if (tieneDesgloseReal) return false;
  const other = ac.other ?? [];
  if (other.length !== 1) return false;
  return other[0].concept === 'Gastos adquisición AEAT' && (other[0].amount ?? 0) > 0;
}

export async function cleanStaleCPAndInferITP(): Promise<{
  cpLimpiados: number;
  itpInferidos: number;
}> {
  const db = await initDB();
  const properties = await db.getAll('properties');

  let cpLimpiados = 0;
  let itpInferidos = 0;

  for (const property of properties) {
    if (!property.id) continue;

    let next: Property = property;
    let modificado = false;

    // 1) CP incompatible con la provincia guardada → limpiar
    if (
      next.postalCode &&
      next.province &&
      cpEsIncompatibleConProvincia(next.postalCode, next.province)
    ) {
      next = { ...next, postalCode: '' };
      cpLimpiados++;
      modificado = true;
    }

    // 2) Cubo legacy "Gastos adquisición AEAT" → re-inferir ITP
    if (esCuboLegacyAEAT(next)) {
      const ac = next.acquisitionCosts!;
      const precio = ac.price || 0;
      const totalAEAT = (ac.other ?? []).reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0,
      );
      const esUsada = next.transmissionRegime === 'usada';

      if (esUsada && precio > 0 && next.ccaa) {
        const itpInferido = inferirITP(precio, next.ccaa);
        const restoOtros = Math.round((totalAEAT - itpInferido) * 100) / 100;

        if (itpInferido > 0 && restoOtros >= 0) {
          next = {
            ...next,
            acquisitionCosts: {
              ...ac,
              itp: itpInferido,
              itpIsManual: false,
              other: restoOtros > 0
                ? [{ concept: 'Notaría + registro + gestoría (inferido)', amount: restoOtros }]
                : [],
            },
          };
          itpInferidos++;
          modificado = true;
        }
      }
    }

    if (modificado) {
      await db.put('properties', next);
    }
  }

  if (cpLimpiados > 0 || itpInferidos > 0) {
    console.info(
      `[Migración] cleanStaleCPAndInferITP: ${cpLimpiados} CP limpiados, ${itpInferidos} ITP inferidos`,
    );
  }
  return { cpLimpiados, itpInferidos };
}

export async function runMigrationIfNeeded(): Promise<void> {
  try {
    if (safeGetItem(MIGRATION_KEY)) return;
    await cleanStaleCPAndInferITP();
    safeSetItem(MIGRATION_KEY, 'done');
  } catch (e) {
    console.error('[Migración] cleanStaleCPAndInferITP falló:', e);
  }
}
