// Conciliation Service - reconciles bank movements with loan installments

import { Prestamo } from '../types/prestamos';
import { prestamosService } from './prestamosService';

export interface CandidatoConciliacion {
  prestamoId: string;
  prestamoNombre: string;
  numeroCuota: number;
  importeCuota: number;
  fechaCuota: string;
  confianza: 'alta' | 'media' | 'baja';
  puntuacion: number;
}

export interface MovimientoTesoreria {
  id: string;
  importe: number;
  fecha: string;
  concepto: string;
  cuentaId: string;
}

const KEYWORDS = ['hipoteca', 'préstamo', 'prestamo', 'recibo', 'loan'];

function scoreAmount(movImporte: number, cuotaImporte: number): number {
  const absMovimiento = Math.abs(movImporte);
  const diff = Math.abs(absMovimiento - cuotaImporte);
  const pct = cuotaImporte > 0 ? diff / cuotaImporte : 1;

  if (diff === 0) return 40;
  if (pct < 0.01) return 35;
  if (pct < 0.05) return 20;
  return -1; // discard
}

function scoreFecha(movFecha: string, cuotaFecha: string): number {
  const diffMs = Math.abs(new Date(movFecha).getTime() - new Date(cuotaFecha).getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays === 0) return 40;
  if (diffDays <= 2) return 35;
  if (diffDays <= 5) return 20;
  if (diffDays <= 10) return 10;
  return -1; // discard
}

function scoreConcepto(concepto: string, prestamoNombre: string): number {
  const lower = concepto.toLowerCase();
  const hasKeyword = KEYWORDS.some(kw => lower.includes(kw));
  const hasName = lower.includes(prestamoNombre.toLowerCase());
  return hasKeyword || hasName ? 20 : 0;
}

export async function buscarCandidatosConciliacion(
  movimiento: MovimientoTesoreria,
  prestamos: Prestamo[]
): Promise<CandidatoConciliacion[]> {
  const candidatos: CandidatoConciliacion[] = [];

  // Only consider loans whose cuentaCargoId matches movement's cuentaId
  const prestamosRelevantes = prestamos.filter(
    p => p.cuentaCargoId === movimiento.cuentaId && p.activo
  );

  for (const prestamo of prestamosRelevantes) {
    const plan = await prestamosService.getPaymentPlan(prestamo.id);
    if (!plan) continue;

    for (const periodo of plan.periodos) {
      if (periodo.pagado) continue;

      const sAmount = scoreAmount(movimiento.importe, periodo.cuota);
      if (sAmount < 0) continue;

      const sFecha = scoreFecha(movimiento.fecha, periodo.fechaCargo);
      if (sFecha < 0) continue;

      const sConcepto = scoreConcepto(movimiento.concepto, prestamo.nombre);

      const puntuacion = sAmount + sFecha + sConcepto;
      if (puntuacion < 50) continue;

      const confianza: 'alta' | 'media' | 'baja' =
        puntuacion >= 80 ? 'alta' : puntuacion >= 50 ? 'media' : 'baja';

      candidatos.push({
        prestamoId: prestamo.id,
        prestamoNombre: prestamo.nombre,
        numeroCuota: periodo.periodo,
        importeCuota: periodo.cuota,
        fechaCuota: periodo.fechaCargo,
        confianza,
        puntuacion,
      });
    }
  }

  // Sort by score descending
  return candidatos.sort((a, b) => b.puntuacion - a.puntuacion);
}

export async function confirmarConciliacion(
  candidato: CandidatoConciliacion,
  movimientoId: string
): Promise<void> {
  await prestamosService.marcarCuotaManual(candidato.prestamoId, candidato.numeroCuota, {
    pagado: true,
    movimientoTesoreriaId: movimientoId,
  });
}

export const conciliacionService = {
  buscarCandidatosConciliacion,
  confirmarConciliacion,
};
