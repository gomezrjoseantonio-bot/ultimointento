/**
 * Onboarding día 0 · avisos derivados del semáforo (no son bloques · son
 * pendientes transversales sobre los datos ya creados).
 *
 * Hoy: "compra financiada sin préstamo vinculado" · un Property con
 * `estructuraCompra.importeFinanciado > 0` y sin `prestamoVinculadoId`. Deep-link
 * al bloque préstamos para cerrarlo (§2.3).
 */
import { initDB } from './db';
import type { Property } from './db';

export interface AvisoOnboarding {
  clave: string;
  label: string;
  deepLink: string;
}

export async function getAvisosOnboarding(): Promise<AvisoOnboarding[]> {
  try {
    const db = await initDB();
    const properties = (await db.getAll('properties')) as Property[];
    const avisos: AvisoOnboarding[] = [];
    for (const p of properties) {
      const ec = p.estructuraCompra;
      if (ec && (ec.importeFinanciado ?? 0) > 0 && !ec.prestamoVinculadoId) {
        avisos.push({
          clave: `financiado-sin-prestamo:${p.id}`,
          label: `${p.alias || p.address || 'Inmueble'} · compra financiada sin préstamo vinculado`,
          deepLink: '/empezar/prestamos',
        });
      }
    }
    return avisos;
  } catch {
    return [];
  }
}
