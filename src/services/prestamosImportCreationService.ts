// Onboarding día 0 · C6 · creación de préstamos desde la plantilla.
//
// Resuelve la cuenta de cargo (IBAN o alias) y el inmueble vinculado (alias o
// RC). Crea el préstamo vía `prestamosService.createPrestamo` (genera su cuadro
// de amortización) y, si trae inmueble, fija `estructuraCompra.prestamoVinculadoId`
// en la Property → CIERRA el pendiente "compra financiada sin préstamo" (§2.5).
import { initDB } from './db';
import type { Account, Property } from './db';
import { prestamosService } from './prestamosService';
import type { Prestamo } from '../types/prestamos';
import type { PrestamoTemplateRow } from './prestamosTemplateParserService';

export interface ResultadoPrestamos {
  creados: number;
  vinculados: number; // préstamos con inmueble vinculado (cierran pendiente)
  errores: Array<{ fila: number; nombre: string; motivo: string }>;
  idsCreados: string[];
}

export const resultadoPrestamosVacio = (): ResultadoPrestamos => ({
  creados: 0,
  vinculados: 0,
  errores: [],
  idsCreados: [],
});

export interface PrestamoRevision {
  row: PrestamoTemplateRow;
  valido: boolean;
  motivo?: string;
}

const normIban = (s: string): string => s.replace(/\s+/g, '').toUpperCase();
const ci = (s: string): string => s.trim().toLowerCase();

function resolverCuenta(ref: string | null, accounts: Account[]): Account | undefined {
  if (!ref) return undefined;
  const refIban = normIban(ref);
  const refCi = ci(ref);
  return accounts.find(
    (a) => (a.iban && normIban(a.iban) === refIban) || (a.alias && ci(a.alias) === refCi),
  );
}

function resolverInmueble(ref: string | null, properties: Property[]): Property | undefined {
  if (!ref) return undefined;
  const refCi = ci(ref);
  return properties.find(
    (p) => (p.alias && ci(p.alias) === refCi) || (p.cadastralReference && ci(p.cadastralReference) === refCi),
  );
}

export function revisarRow(row: PrestamoTemplateRow, accounts: Account[]): PrestamoRevision {
  if (!row.nombre) return { row, valido: false, motivo: 'Falta el nombre' };
  if (row.principalInicial <= 0) return { row, valido: false, motivo: 'El principal inicial debe ser mayor que 0' };
  if (!resolverCuenta(row.cuentaRef, accounts)) {
    return { row, valido: false, motivo: 'Cuenta de cargo no encontrada (IBAN o alias)' };
  }
  return { row, valido: true };
}

export async function revisarRows(rows: PrestamoTemplateRow[]): Promise<PrestamoRevision[]> {
  const db = await initDB();
  const accounts = (await db.getAll('accounts')) as Account[];
  return rows.map((r) => revisarRow(r, accounts));
}

function rowToPrestamo(row: PrestamoTemplateRow, account: Account, property?: Property): Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> {
  const fecha = row.fechaPrimerCargo ?? new Date().toISOString().split('T')[0];
  const completo = row.tipo === 'FIJO' && row.tin > 0 && row.plazoMeses > 0;
  return {
    ambito: property ? 'INMUEBLE' : 'PERSONAL',
    nombre: row.nombre,
    principalInicial: row.principalInicial,
    principalVivo: row.principalVivo,
    fechaFirma: fecha,
    fechaPrimerCargo: fecha,
    plazoMesesTotal: row.plazoMeses,
    diaCargoMes: row.diaCargo,
    esquemaPrimerRecibo: 'NORMAL',
    tipo: row.tipo,
    sistema: 'FRANCES',
    carencia: 'NINGUNA',
    cuentaCargoId: String(account.id),
    activo: true,
    cuotasPagadas: 0,
    origenCreacion: 'IMPORTACION',
    ...(row.tipo === 'FIJO' ? { tipoNominalAnualFijo: row.tin } : {}),
    ...(property
      ? {
          destinos: [
            {
              id: `dest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              tipo: 'ADQUISICION' as const,
              inmuebleId: String(property.id),
              importe: row.principalInicial,
            },
          ],
        }
      : {}),
    // Si no es FIJO o falta TIN/plazo · queda pendiente de completar (sin cuadro).
    estado: completo ? 'vivo' : 'pendiente_completar',
  };
}

/**
 * Crea los préstamos válidos. Para los que traen inmueble (resuelto por alias o
 * RC) fija `Property.estructuraCompra.prestamoVinculadoId` y cuenta el vínculo.
 */
export async function crearPrestamosDesdeRows(rows: PrestamoTemplateRow[]): Promise<ResultadoPrestamos> {
  const r = resultadoPrestamosVacio();
  const db = await initDB();
  const accounts = (await db.getAll('accounts')) as Account[];
  const properties = (await db.getAll('properties')) as Property[];

  for (const row of rows) {
    const revision = revisarRow(row, accounts);
    if (!revision.valido) {
      r.errores.push({ fila: row.filaOriginal, nombre: row.nombre, motivo: revision.motivo ?? 'Fila inválida' });
      continue;
    }
    const account = resolverCuenta(row.cuentaRef, accounts)!;
    const property = resolverInmueble(row.inmuebleRef, properties);

    const creado = await prestamosService.createPrestamo(rowToPrestamo(row, account, property));
    r.creados += 1;
    r.idsCreados.push(creado.id);

    if (property?.id != null) {
      const actualizada: Property = {
        ...property,
        estructuraCompra: { ...(property.estructuraCompra ?? {}), prestamoVinculadoId: creado.id },
      };
      await db.put('properties', actualizada);
      r.vinculados += 1;
    }
  }
  return r;
}
