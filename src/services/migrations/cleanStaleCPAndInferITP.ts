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
//    desglose actual es el cubo legacy "Gastos adquisición AEAT", se
//    re-infiere ITP descontándolo del total. Invariante: el total
//    price + itp + otros se mantiene idéntico.
//
// Idempotente por bandera en localStorage.

import { initDB, Property } from '../db';
import { inferirITP } from '../declaracionDistributorService';
import { getProvinceFromPostalCode } from '../../utils/locationUtils';

const MIGRATION_KEY = 'migration_clean_stale_cp_and_infer_itp_v1';

// Normaliza un nombre de provincia ignorando acentos, case y variantes
// (p. ej. "Orense"/"Ourense", "Tenerife"/"Santa Cruz de Tenerife").
function normalizarProvincia(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const ALIAS_PROVINCIA: Record<string, string> = {
  coruna: 'acoruna',
  acoruna: 'acoruna',
  gerona: 'girona',
  girona: 'girona',
  guipuzcoa: 'guipuzcoa',
  gipuzkoa: 'guipuzcoa',
  lerida: 'lleida',
  lleida: 'lleida',
  rioja: 'larioja',
  larioja: 'larioja',
  orense: 'ourense',
  ourense: 'ourense',
  tenerife: 'santacruzdetenerife',
  santacruzdetenerife: 'santacruzdetenerife',
  vizcaya: 'vizcaya',
  bizkaia: 'vizcaya',
};

function canonicalizarProvincia(nombre: string): string {
  const n = normalizarProvincia(nombre);
  return ALIAS_PROVINCIA[n] ?? n;
}

function cpEsIncompatibleConProvincia(cp: string, provincia: string): boolean {
  if (!cp || cp.length !== 5 || !provincia) return false;
  const provDelCP = getProvinceFromPostalCode(cp);
  // Si el CP no está en el mapa canónico 01–52, no asumimos nada (no limpiar).
  if (!provDelCP) return false;
  return canonicalizarProvincia(provDelCP) !== canonicalizarProvincia(provincia);
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
