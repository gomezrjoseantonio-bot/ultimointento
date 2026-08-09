// Financiación imputada a un inmueble · Fase 9/8 (Patrimonio · deuda pendiente).
//
// Resuelve los préstamos vinculados a un inmueble y devuelve, por cada uno, la
// deuda pendiente, el principal inicial y la cuota mensual YA imputados al
// inmueble (multiplicados por el factor de afectación del préstamo). Reutiliza
// los helpers canónicos `getOutstandingPrincipal` / `getLoanMonthlyInstallment`
// (mismos que usa `informesDataService`) y `getAllocationFactor`.

import { prestamosService, getAllocationFactor } from './prestamosService';
import {
  getOutstandingPrincipal,
  getLoanMonthlyInstallment,
} from '../modules/horizon/herramientas/exporters/mappers';
import type { FinanciacionLineaInmueble } from '../modules/inmuebles/adapters/patrimonioInmuebleAdapter';

/**
 * Líneas de financiación vinculadas a un inmueble, imputadas por afectación.
 * Excluye préstamos cancelados o pendientes de cancelación por venta.
 */
export async function getFinanciacionInmueble(
  inmuebleId: number,
): Promise<FinanciacionLineaInmueble[]> {
  const idStr = String(inmuebleId);
  const prestamos = await prestamosService.getAllPrestamos();
  const vinculados = prestamos.filter(
    (p) =>
      getAllocationFactor(p, idStr) > 0 &&
      p.activo !== false &&
      p.estado !== 'cancelado' &&
      p.estado !== 'pendiente_cancelacion_venta',
  );
  return Promise.all(
    vinculados.map(async (p) => {
      const plan = await prestamosService.getPaymentPlan(p.id).catch(() => null);
      const factor = getAllocationFactor(p, idStr);
      return {
        id: p.id,
        nombre: p.nombre,
        deudaPendiente: getOutstandingPrincipal(p, plan) * factor,
        principalInicial: (p.principalInicial ?? 0) * factor,
        cuotaMensual: getLoanMonthlyInstallment(p, plan) * factor,
        porcentajeAfectacion: factor * 100,
      };
    }),
  );
}
