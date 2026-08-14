// Ficha de inmueble · puente con FINANCIACIÓN.
//
// Regla (decisión Jose): la ficha es un LECTOR/lanzador; la verdad del préstamo
// vive en Financiación. Aquí solo:
//   · se PRE-RELLENA un préstamo desde el inmueble (destino ADQUISICIÓN +
//     garantía hipotecaria + importe) para abrir el asistente ya cargado;
//   · se listan los préstamos VINCULABLES (aún no imputados a este inmueble);
//   · se fija/lee la FK `estructuraCompra.prestamoVinculadoId`;
//   · se LEE la financiación vinculada por el servicio canónico.
// Nada de cuadros ni cálculos aquí.

import {
  prestamosService,
  getAllocationFactor,
  prestamoAfectaInmueble,
} from '../../../services/prestamosService';
import { getFinanciacionInmueble } from '../../../services/financiacionInmuebleService';
import type { FinanciacionLineaInmueble } from '../../../modules/inmuebles/adapters/patrimonioInmuebleAdapter';
import type { Prestamo, DestinoCapital, Garantia } from '../../../types/prestamos';

export { fijarPrestamoVinculado } from '../../../services/vinculoPrestamoInmueble';

/** ¿Este préstamo cuenta como vivo (no cancelado ni baja)? */
const esVivo = (p: Prestamo): boolean =>
  p.activo !== false &&
  p.estado !== 'cancelado' &&
  p.estado !== 'pendiente_cancelacion_venta';

/**
 * `initialData` para abrir el asistente de préstamo YA cargado desde el
 * inmueble: el importe financiado como principal, el inmueble como destino de
 * adquisición (100%) y como garantía hipotecaria. Lo demás (plazo, tipo,
 * interés, cuenta de cargo…) lo completa el usuario en el asistente — no se
 * inventa.
 *
 * `inmuebleId` es `undefined` en altas todavía sin guardar: en ese caso el
 * asistente se abre con el importe pero sin inmueble, y el enlace se hará
 * cuando el inmueble ya exista.
 */
export function prefillPrestamoDesdeInmueble(params: {
  alias: string;
  importeFinanciado: number;
  fechaCompra: string;
  inmuebleId?: number;
}): Partial<Prestamo> {
  const { alias, importeFinanciado, fechaCompra, inmuebleId } = params;
  const idStr = inmuebleId != null ? String(inmuebleId) : undefined;

  const destinos: DestinoCapital[] | undefined = idStr
    ? [
        {
          id: `dest-${idStr}`,
          tipo: 'ADQUISICION',
          inmuebleId: idStr,
          importe: importeFinanciado,
          porcentaje: 100,
        },
      ]
    : undefined;

  const garantias: Garantia[] | undefined = idStr
    ? [{ tipo: 'HIPOTECARIA', inmuebleId: idStr }]
    : undefined;

  return {
    nombre: alias ? `Hipoteca ${alias}` : undefined,
    ambito: idStr ? 'INMUEBLE' : 'PERSONAL',
    principalInicial: importeFinanciado || undefined,
    fechaFirma: fechaCompra || undefined,
    ...(destinos ? { destinos } : {}),
    ...(garantias ? { garantias } : {}),
  };
}

/**
 * Préstamos vivos que AÚN NO están imputados a este inmueble · candidatos para
 * "vincular un préstamo existente".
 */
export async function prestamosVinculablesA(inmuebleId: number): Promise<Prestamo[]> {
  const idStr = String(inmuebleId);
  const todos = await prestamosService.getAllPrestamos();
  return todos.filter((p) => esVivo(p) && !prestamoAfectaInmueble(p, idStr));
}

/** Financiación vinculada al inmueble, por el servicio CANÓNICO (no fórmula a mano). */
export async function leerFinanciacionInmueble(
  inmuebleId: number,
): Promise<FinanciacionLineaInmueble[]> {
  return getFinanciacionInmueble(inmuebleId);
}

/** Suma de la deuda pendiente imputada al inmueble (para "importe financiado" leído). */
export function totalDeudaVinculada(lineas: FinanciacionLineaInmueble[]): number {
  return lineas.reduce((s, l) => s + (l.principalInicial || 0), 0);
}

/** ¿Hay algún préstamo imputado a este inmueble ahora mismo? (para modo lectura). */
export async function tienePrestamoVinculado(inmuebleId: number): Promise<boolean> {
  const idStr = String(inmuebleId);
  const todos = await prestamosService.getAllPrestamos();
  return todos.some((p) => esVivo(p) && getAllocationFactor(p, idStr) > 0);
}
