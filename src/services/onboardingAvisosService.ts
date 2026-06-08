/**
 * Onboarding día 0 · avisos derivados del semáforo (no son bloques · son
 * pendientes transversales sobre los datos ya creados).
 *
 * Hoy: "compras financiadas sin préstamo vinculado" · Properties con
 * `estructuraCompra.importeFinanciado > 0` y sin `prestamoVinculadoId`.
 *
 * §2.3.bis (corrección Jose) · el aviso es LATENTE y RESUMIDO:
 *  - LATENTE · no aparece mientras no exista ningún préstamo en el sistema y el
 *    bloque préstamos siga `pendiente`/`parcial` (sería absurdo pedir vincular a
 *    algo que aún no existe). Surge SOLO cuando hay ≥1 préstamo en el sistema o
 *    el bloque préstamos está completado.
 *  - RESUMIDO · una ÚNICA línea "N inmuebles financiados pendientes de vincular
 *    préstamo", jamás una fila por inmueble. Deep-link a la vista de vinculación.
 */
import { initDB } from './db';
import { getOnboardingState } from './onboardingProgressService';
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

    const financiadosSinVincular = properties.filter((p) => {
      const ec = p.estructuraCompra;
      return ec && (ec.importeFinanciado ?? 0) > 0 && !ec.prestamoVinculadoId;
    }).length;

    if (financiadosSinVincular === 0) return [];

    // Latencia · solo emerge si ya hay a qué vincular (≥1 préstamo en el sistema)
    // o el bloque préstamos ya quedó resuelto (completado).
    const [prestamos, state] = await Promise.all([
      db.getAll('prestamos').catch(() => [] as unknown[]),
      getOnboardingState(),
    ]);
    const hayPrestamos = prestamos.length > 0;
    const prestamosResuelto = state.bloques.prestamos?.estado === 'completado';
    if (!hayPrestamos && !prestamosResuelto) return [];

    // Resumido · una sola línea con el recuento.
    const plural = financiadosSinVincular > 1;
    return [
      {
        clave: 'inmuebles-financiados-sin-prestamo',
        label: `${financiadosSinVincular} inmueble${plural ? 's' : ''} financiado${plural ? 's' : ''} pendiente${plural ? 's' : ''} de vincular préstamo`,
        deepLink: '/empezar/prestamos',
      },
    ];
  } catch {
    return [];
  }
}
