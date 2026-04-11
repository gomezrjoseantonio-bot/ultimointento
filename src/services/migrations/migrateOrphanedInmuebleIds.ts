/**
 * One-shot migration: remap orphaned inmuebleIds in all stores.
 *
 * When the user created properties manually (without cadastralReference) and then
 * imported XML declarations, the parser couldn't match existing properties → created
 * duplicates with auto-incremented IDs. Gastos, mejoras, muebles, etc. were linked
 * to the duplicate IDs. After the user deleted the duplicates, those records became
 * orphaned (inmuebleId points to a non-existent property).
 *
 * This migration:
 * 1. Detects orphaned inmuebleIds across all stores
 * 2. Uses stored XML data (ejerciciosFiscalesCoord) to match orphaned records
 *    to real properties by gastos-amount comparison + address/cadastral matching
 * 3. Remaps all orphaned references to correct property IDs
 * 4. Enriches properties with missing cadastral references from the XML
 */

import { initDB } from '../db';
import type { Property, GastoInmueble, EjercicioFiscalCoord } from '../db';
import type { InmuebleDeclarado } from '../../types/declaracionCompleta';
import { normalizeDireccion } from '../declaracionDistributorService';

const MIGRATION_KEY = 'migration_orphaned_inmueble_ids_v1';

/** Map casilla AEAT → field name in InmuebleDeclarado.gastos */
const CASILLA_A_CAMPO: Record<string, keyof InmuebleDeclarado['gastos']> = {
  '0105': 'interesesFinanciacion',
  '0106': 'reparacionConservacion',
  '0109': 'comunidad',
  '0112': 'serviciosTerceros',
  '0113': 'suministros',
  '0114': 'seguros',
  '0115': 'ibiTasas',
  '0117': 'amortizacionMobiliario',
};

function normalizeRef(value?: string | null): string {
  return (value ?? '').replace(/[\s.-]/g, '').trim().toUpperCase();
}

function acortarDireccion(dir: string): string {
  return dir
    .replace(/^(CL|CR|AV|PZ|PS|CM)\s+/i, '')
    .replace(/\b0+(\d+)/g, '$1')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export interface MigrationReport {
  orphanedIds: number[];
  idMap: Record<number, number>;
  storeUpdates: Record<string, number>;
  propertiesEnriched: number;
  skipped: boolean;
}

export async function migrateOrphanedInmuebleIds(): Promise<MigrationReport> {
  const report: MigrationReport = {
    orphanedIds: [],
    idMap: {},
    storeUpdates: {},
    propertiesEnriched: 0,
    skipped: false,
  };

  try {
    const db = await initDB();

    // Check if already completed
    const status = await db.get('keyval', MIGRATION_KEY);
    if (status === 'completed') {
      report.skipped = true;
      return report;
    }

    // 1. Get all existing property IDs
    const properties = await db.getAll('properties');
    const propertyIds = new Set(properties.map((p) => p.id).filter((id): id is number => id != null));

    // 2. Find orphaned gastos (primary source of truth for building the ID map)
    const allGastos: GastoInmueble[] = await db.getAll('gastosInmueble');
    const orphanedGastos = allGastos.filter((g) => !propertyIds.has(g.inmuebleId));

    if (orphanedGastos.length === 0) {
      // No orphaned gastos — check if other stores have orphans before marking done
      const hasOtherOrphans = await detectOrphansInOtherStores(db, propertyIds);
      if (!hasOtherOrphans) {
        await db.put('keyval', 'completed', MIGRATION_KEY);
        console.log('[Migración] migrateOrphanedInmuebleIds: no orphaned records found in any store');
      } else {
        console.warn('[Migración] migrateOrphanedInmuebleIds: no orphaned gastos but other stores have orphans; will retry');
      }
      return report;
    }

    // 3. Collect unique orphaned IDs
    const orphanedIdSet = new Set(orphanedGastos.map((g) => g.inmuebleId));
    report.orphanedIds = [...orphanedIdSet];

    // 4. Build ID map: orphanedId → realPropertyId
    const idMap = await buildIdMap(db, properties, orphanedGastos, orphanedIdSet);
    report.idMap = Object.fromEntries(idMap);

    if (idMap.size === 0) {
      console.warn(
        '[Migración] migrateOrphanedInmuebleIds: could not build ID map for orphaned IDs; migration will be retried on next startup:',
        [...orphanedIdSet],
      );
      return report;
    }

    console.log('[Migración] ID map built:', Object.fromEntries(idMap));

    // 5. Migrate gastosInmueble
    let gastosUpdated = 0;
    for (const gasto of orphanedGastos) {
      const newId = idMap.get(gasto.inmuebleId);
      if (newId == null || gasto.id == null) continue;
      const oldOrigenIdPrefix = `${gasto.inmuebleId}-`;
      const newOrigenId = gasto.origenId
        ? gasto.origenId.startsWith(oldOrigenIdPrefix)
          ? `${newId}-${gasto.origenId.slice(oldOrigenIdPrefix.length)}`
          : gasto.origenId
        : undefined;
      await db.put('gastosInmueble', {
        ...gasto,
        inmuebleId: newId,
        ...(newOrigenId ? { origenId: newOrigenId } : {}),
        updatedAt: new Date().toISOString(),
      });
      gastosUpdated++;
    }
    report.storeUpdates.gastosInmueble = gastosUpdated;

    // 6. Migrate all other stores
    await migrateOtherStores(db, propertyIds, idMap, report);

    // 7. Enrich properties with missing cadastral references from XML
    report.propertiesEnriched = await enrichPropertiesFromXml(db, properties);

    // 8. Mark as completed
    await db.put('keyval', 'completed', MIGRATION_KEY);

    console.log('[Migración] migrateOrphanedInmuebleIds completed:', report);
  } catch (error) {
    console.error('[Migración] migrateOrphanedInmuebleIds failed:', error);
  }

  return report;
}

/**
 * Build mapping: orphanedId → realPropertyId
 *
 * Strategy: For each orphaned ID, find its gastos in a specific exercise,
 * then compare amounts against each XML inmueble from that exercise.
 * Once matched, use the XML inmueble's refCatastral/address to find the real property.
 */
async function buildIdMap(
  db: Awaited<ReturnType<typeof initDB>>,
  properties: Property[],
  orphanedGastos: GastoInmueble[],
  orphanedIds: Set<number>,
): Promise<Map<number, number>> {
  const idMap = new Map<number, number>();

  // Build lookup maps for real properties
  const realByRef = new Map<string, Property>();
  const realByAddr = new Map<string, Property>();
  for (const p of properties) {
    const ref = normalizeRef(p.cadastralReference);
    if (ref) realByRef.set(ref, p);
    const addr = normalizeDireccion(p.address);
    if (addr) realByAddr.set(addr, p);
    const alias = normalizeDireccion(p.alias);
    if (alias && alias !== addr) realByAddr.set(alias, p);
  }

  // Get all fiscal exercises with stored XML
  const ejercicios: EjercicioFiscalCoord[] = await db.getAll('ejerciciosFiscalesCoord');

  // Group orphaned gastos by inmuebleId
  const gastosByOrphanId = new Map<number, GastoInmueble[]>();
  for (const g of orphanedGastos) {
    if (!gastosByOrphanId.has(g.inmuebleId)) gastosByOrphanId.set(g.inmuebleId, []);
    gastosByOrphanId.get(g.inmuebleId)!.push(g);
  }

  // Track which real properties have already been matched to avoid double-mapping
  const matchedRealIds = new Set<number>();

  for (const orphanId of orphanedIds) {
    if (idMap.has(orphanId)) continue;

    const gastos = gastosByOrphanId.get(orphanId) ?? [];
    if (gastos.length === 0) continue;

    // Try all available exercises for this orphanId until a consistent match is found
    const ejerciciosCandidatos = [...new Set(gastos.map((g) => g.ejercicio))];

    for (const ejercicio of ejerciciosCandidatos) {
      const gastosInYear = gastos.filter((g) => g.ejercicio === ejercicio);

      const ej = ejercicios.find((e) => e.año === ejercicio);
      const xmlInmuebles = ej?.aeat?.declaracionCompleta?.inmuebles;
      if (!xmlInmuebles) continue;

      for (const xmlInm of xmlInmuebles) {
        if (xmlInm.esAccesorioDe) continue;

        // Compare gastos amounts: every orphaned gasto for this year must match
        let allMatch = true;
        let matchCount = 0;
        for (const gasto of gastosInYear) {
          const campo = CASILLA_A_CAMPO[gasto.casillaAEAT];
          if (!campo) continue;
          const xmlAmount = xmlInm.gastos[campo] || 0;
          if (Math.abs(xmlAmount - gasto.importe) < 0.01) {
            matchCount++;
          } else {
            allMatch = false;
            break;
          }
        }

        if (!allMatch || matchCount === 0) continue;

        // Found matching XML inmueble — resolve to real property
        const rc = normalizeRef(xmlInm.refCatastral);
        let realProp = realByRef.get(rc);
        if (!realProp) {
          const addr = normalizeDireccion(xmlInm.direccion);
          realProp = realByAddr.get(addr);
          if (!realProp) {
            const alias = normalizeDireccion(acortarDireccion(xmlInm.direccion));
            realProp = realByAddr.get(alias);
          }
        }

        if (realProp?.id != null && !matchedRealIds.has(realProp.id)) {
          idMap.set(orphanId, realProp.id);
          matchedRealIds.add(realProp.id);
          break;
        }
      }

      if (idMap.has(orphanId)) break;
    }
  }

  return idMap;
}

/**
 * Quick check: do any non-gastos stores have orphaned inmuebleIds?
 */
async function detectOrphansInOtherStores(
  db: Awaited<ReturnType<typeof initDB>>,
  propertyIds: Set<number>,
): Promise<boolean> {
  const stores = ['mejorasInmueble', 'mueblesInmueble', 'contracts'] as const;
  for (const store of stores) {
    try {
      const all = await db.getAll(store);
      const hasOrphan = all.some((rec: any) => {
        const id = rec.inmuebleId ?? rec.propertyId;
        return id != null && !propertyIds.has(Number(id));
      });
      if (hasOrphan) return true;
    } catch (_e) { /* store might not exist */ }
  }
  return false;
}

/**
 * Migrate orphaned inmuebleIds in all stores other than gastosInmueble.
 */
async function migrateOtherStores(
  db: Awaited<ReturnType<typeof initDB>>,
  propertyIds: Set<number>,
  idMap: Map<number, number>,
  report: MigrationReport,
): Promise<void> {
  if (idMap.size === 0) return;

  // mejorasInmueble
  try {
    const all = await db.getAll('mejorasInmueble');
    let count = 0;
    for (const rec of all) {
      const newId = idMap.get(rec.inmuebleId);
      if (newId != null && !propertyIds.has(rec.inmuebleId) && rec.id != null) {
        await db.put('mejorasInmueble', { ...rec, inmuebleId: newId, updatedAt: new Date().toISOString() });
        count++;
      }
    }
    if (count > 0) report.storeUpdates.mejorasInmueble = count;
  } catch (e) {
    console.warn('[Migración] Error migrating mejorasInmueble:', e);
  }

  // mueblesInmueble
  try {
    const all = await db.getAll('mueblesInmueble');
    let count = 0;
    for (const rec of all) {
      const newId = idMap.get(rec.inmuebleId);
      if (newId != null && !propertyIds.has(rec.inmuebleId) && rec.id != null) {
        await db.put('mueblesInmueble', { ...rec, inmuebleId: newId, updatedAt: new Date().toISOString() });
        count++;
      }
    }
    if (count > 0) report.storeUpdates.mueblesInmueble = count;
  } catch (e) {
    console.warn('[Migración] Error migrating mueblesInmueble:', e);
  }

  // operacionesProveedor
  try {
    const all = await db.getAll('operacionesProveedor');
    let count = 0;
    for (const rec of all) {
      const newId = idMap.get(rec.inmuebleId);
      if (newId != null && !propertyIds.has(rec.inmuebleId) && rec.id != null) {
        try {
          await db.put('operacionesProveedor', { ...rec, inmuebleId: newId });
          count++;
        } catch (_e) {
          // Unique index constraint — might already exist with the new inmuebleId
        }
      }
    }
    if (count > 0) report.storeUpdates.operacionesProveedor = count;
  } catch (e) {
    console.warn('[Migración] Error migrating operacionesProveedor:', e);
  }

  // contracts (both inmuebleId and propertyId fields)
  try {
    const all = await db.getAll('contracts');
    let count = 0;
    for (const rec of all) {
      const inmId = rec.inmuebleId ?? (rec as any).propertyId;
      const newId = idMap.get(inmId);
      if (newId != null && !propertyIds.has(inmId) && rec.id != null) {
        await db.put('contracts', { ...rec, inmuebleId: newId, propertyId: newId, updatedAt: new Date().toISOString() });
        count++;
      }
    }
    if (count > 0) report.storeUpdates.contracts = count;
  } catch (e) {
    console.warn('[Migración] Error migrating contracts:', e);
  }

  // prestamos (inmuebleId is a string in this store)
  try {
    const all = await db.getAll('prestamos');
    let count = 0;
    for (const rec of all) {
      const inmId = Number(rec.inmuebleId);
      const newId = idMap.get(inmId);
      if (newId != null && !propertyIds.has(inmId) && rec.id) {
        await db.put('prestamos', { ...rec, inmuebleId: String(newId) });
        count++;
      }
    }
    if (count > 0) report.storeUpdates.prestamos = count;
  } catch (e) {
    console.warn('[Migración] Error migrating prestamos:', e);
  }

  // vinculosAccesorio (inmueblePrincipalId and inmuebleAccesorioId)
  try {
    const all = await db.getAll('vinculosAccesorio');
    let count = 0;
    for (const rec of all) {
      const newPrincipal = idMap.get(rec.inmueblePrincipalId) ?? (propertyIds.has(rec.inmueblePrincipalId) ? null : undefined);
      const newAccesorio = idMap.get(rec.inmuebleAccesorioId) ?? (propertyIds.has(rec.inmuebleAccesorioId) ? null : undefined);
      if ((newPrincipal != null || newAccesorio != null) && rec.id != null) {
        try {
          await db.put('vinculosAccesorio', {
            ...rec,
            ...(newPrincipal != null ? { inmueblePrincipalId: newPrincipal } : {}),
            ...(newAccesorio != null ? { inmuebleAccesorioId: newAccesorio } : {}),
            updatedAt: new Date().toISOString(),
          });
          count++;
        } catch (_e) {
          // Unique index constraint
        }
      }
    }
    if (count > 0) report.storeUpdates.vinculosAccesorio = count;
  } catch (e) {
    console.warn('[Migración] Error migrating vinculosAccesorio:', e);
  }

  // documentosFiscales (inmuebleId may be string or number depending on version)
  try {
    const all = await db.getAll('documentosFiscales');
    let count = 0;
    for (const rec of all) {
      const rawInmuebleId = (rec as any).inmuebleId as string | number | undefined;
      if (rawInmuebleId != null) {
        const inmId = Number(rawInmuebleId);
        if (!Number.isNaN(inmId)) {
          const newId = idMap.get(inmId);
          if (newId != null && !propertyIds.has(inmId) && rec.id != null) {
            await db.put('documentosFiscales', { ...rec, inmuebleId: newId, updatedAt: new Date().toISOString() });
            count++;
          }
        }
      }
    }
    if (count > 0) report.storeUpdates.documentosFiscales = count;
  } catch (e) {
    console.warn('[Migración] Error migrating documentosFiscales:', e);
  }

  // arrastresIRPF
  try {
    const all = await db.getAll('arrastresIRPF');
    let count = 0;
    for (const rec of all) {
      const inmId = (rec as any).inmuebleId as number | undefined;
      if (inmId != null) {
        const newId = idMap.get(inmId);
        if (newId != null && !propertyIds.has(inmId) && rec.id != null) {
          await db.put('arrastresIRPF', { ...rec, inmuebleId: newId, updatedAt: new Date().toISOString() });
          count++;
        }
      }
    }
    if (count > 0) report.storeUpdates.arrastresIRPF = count;
  } catch (e) {
    console.warn('[Migración] Error migrating arrastresIRPF:', e);
  }
}

/**
 * Enrich existing properties with cadastral references and other fields
 * from the stored XML declarations.
 */
async function enrichPropertiesFromXml(
  db: Awaited<ReturnType<typeof initDB>>,
  properties: Property[],
): Promise<number> {
  const ejercicios: EjercicioFiscalCoord[] = await db.getAll('ejerciciosFiscalesCoord');
  let enriched = 0;

  for (const ej of ejercicios) {
    const xmlInmuebles = ej.aeat?.declaracionCompleta?.inmuebles;
    if (!xmlInmuebles) continue;

    for (const xmlInm of xmlInmuebles) {
      if (xmlInm.esAccesorioDe) continue;
      const rc = normalizeRef(xmlInm.refCatastral);
      if (!rc) continue;

      // Find the real property: first by ref catastral, then by address
      let prop = properties.find((p) => normalizeRef(p.cadastralReference) === rc);
      if (!prop) {
        const dirXml = normalizeDireccion(xmlInm.direccion);
        const aliasXml = normalizeDireccion(acortarDireccion(xmlInm.direccion));
        prop = properties.find((p) => {
          const pAddr = normalizeDireccion(p.address);
          const pAlias = normalizeDireccion(p.alias);
          return pAddr === dirXml || pAlias === dirXml || pAddr === aliasXml || pAlias === aliasXml;
        });
      }
      if (!prop || prop.id == null) continue;

      // Only update fields that are empty/undefined — never overwrite user data
      const updates: Partial<Property> = {};
      if (!prop.cadastralReference && rc) {
        updates.cadastralReference = rc;
      }
      if (!prop.fiscalData?.cadastralValue && xmlInm.valorCatastral) {
        updates.fiscalData = {
          ...(prop.fiscalData || {}),
          cadastralValue: xmlInm.valorCatastral,
        };
      }
      if (!prop.fiscalData?.constructionCadastralValue && xmlInm.valorCatastralConstruccion) {
        updates.fiscalData = {
          ...(updates.fiscalData || prop.fiscalData || {}),
          constructionCadastralValue: xmlInm.valorCatastralConstruccion,
        };
      }
      if (!prop.fiscalData?.constructionPercentage && xmlInm.porcentajeConstruccion) {
        updates.fiscalData = {
          ...(updates.fiscalData || prop.fiscalData || {}),
          constructionPercentage: xmlInm.porcentajeConstruccion,
        };
      }
      if (!prop.purchaseDate && xmlInm.fechaAdquisicion) {
        const parts = xmlInm.fechaAdquisicion.split('/');
        if (parts.length === 3) {
          updates.purchaseDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      if (Object.keys(updates).length > 0) {
        const merged = { ...prop, ...updates };
        if (updates.fiscalData) {
          merged.fiscalData = { ...(prop.fiscalData || {}), ...updates.fiscalData };
        }
        await db.put('properties', merged);
        enriched++;
        // Update in-memory reference so subsequent iterations see the changes
        Object.assign(prop, merged);
      }
    }
  }

  return enriched;
}
