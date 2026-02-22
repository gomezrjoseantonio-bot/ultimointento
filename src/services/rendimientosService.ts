// src/services/rendimientosService.ts
// ATLAS HORIZON: Service for generating and managing investment returns

import { initDB } from './db';
import { inversionesService } from './inversionesService';
import { 
  PosicionInversionExtendida,
  InversionRendimientoPeriodico,
  PagoRendimiento,
  RendimientoPeriodico,
  esRendimientoPeriodico,
} from '../types/inversiones-extended';
import { PosicionInversion } from '../types/inversiones';
import { IRPF_RATE, MAX_PAGO_ITERATIONS } from '../constants/inversiones';

const DIVISORES: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

export class RendimientosService {
  /**
   * Calculate periodic payment amount
   */
  calcularImporte(capital: number, tasaAnual: number, frecuencia: string): number {
    const divisor = DIVISORES[frecuencia] ?? 12;
    return (capital * (tasaAnual / 100)) / divisor;
  }

  /**
   * Calculate next payment date from a base date and frequency
   */
  calcularProximaFecha(fechaBase: string, frecuencia: string): string {
    const fecha = new Date(fechaBase);
    switch (frecuencia) {
      case 'mensual':
        fecha.setMonth(fecha.getMonth() + 1);
        break;
      case 'trimestral':
        fecha.setMonth(fecha.getMonth() + 3);
        break;
      case 'semestral':
        fecha.setMonth(fecha.getMonth() + 6);
        break;
      case 'anual':
        fecha.setFullYear(fecha.getFullYear() + 1);
        break;
    }
    return fecha.toISOString();
  }

  /**
   * Get the most recent payment from a list
   */
  getUltimoPago(pagos: PagoRendimiento[]): PagoRendimiento | null {
    if (!pagos.length) return null;
    return [...pagos].sort(
      (a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime()
    )[0];
  }

  /**
   * Create a treasury movement for a payment
   */
  private async crearMovimientoTesoreria(
    pago: PagoRendimiento,
    posicion: PosicionInversion
  ): Promise<number> {
    const db = await initDB();
    const movimientoId = await db.add('movements', {
      accountId: pago.cuenta_destino_id!,
      date: pago.fecha_pago,
      amount: pago.importe_neto,
      description: `Rendimiento ${posicion.nombre}`,
      category: 'Rendimientos inversión',
      subcategory: 'Intereses',
      type: 'income',
      reconciled: true,
      origen_inversion_id: posicion.id,
      created_at: new Date().toISOString(),
    } as any);
    return movimientoId as number;
  }

  /**
   * Generate a single payment for a periodic-yield position
   */
  private async generarPago(
    posicion: InversionRendimientoPeriodico,
    fecha: string
  ): Promise<void> {
    const { rendimiento } = posicion;

    const importe_bruto = this.calcularImporte(
      posicion.valor_actual,
      rendimiento.tasa_interes_anual,
      rendimiento.frecuencia_pago
    );
    const retencion_fiscal = importe_bruto * IRPF_RATE;
    const importe_neto = importe_bruto - retencion_fiscal;

    const pago: PagoRendimiento = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha_pago: fecha,
      importe_bruto,
      retencion_fiscal,
      importe_neto,
      cuenta_destino_id: rendimiento.cuenta_destino_id,
      estado: rendimiento.reinvertir ? 'reinvertido' : 'pendiente',
    };

    if (rendimiento.reinvertir) {
      posicion.valor_actual += importe_neto;
    } else if (rendimiento.cuenta_destino_id) {
      try {
        const movimientoId = await this.crearMovimientoTesoreria(pago, posicion as unknown as PosicionInversion);
        pago.movimiento_id = movimientoId;
      } catch (err) {
        console.error('[RENDIMIENTOS] Error creating treasury movement:', err);
      }
      pago.estado = 'pagado';
    }

    rendimiento.pagos_generados.push(pago);

    await inversionesService.updatePosicion(posicion.id, {
      rendimiento,
      valor_actual: posicion.valor_actual,
    } as any);
  }

  /**
   * Process a single periodic-yield position: generate all pending payments
   */
  private async procesarRendimientoPeriodico(
    posicion: InversionRendimientoPeriodico
  ): Promise<void> {
    const { rendimiento } = posicion;
    const hoy = new Date();

    // Check if position has ended
    if (rendimiento.fecha_fin_rendimiento && new Date(rendimiento.fecha_fin_rendimiento) < hoy) {
      return;
    }

    const ultimoPago = this.getUltimoPago(rendimiento.pagos_generados);
    const fechaBase = ultimoPago?.fecha_pago ?? rendimiento.fecha_inicio_rendimiento;
    let proximaFecha = this.calcularProximaFecha(fechaBase, rendimiento.frecuencia_pago);

    // Generate all overdue payments (loop to catch multiple missed periods)
    let iterations = 0;
    while (new Date(proximaFecha) <= hoy && iterations < MAX_PAGO_ITERATIONS) {
      await this.generarPago(posicion, proximaFecha);
      proximaFecha = this.calcularProximaFecha(proximaFecha, rendimiento.frecuencia_pago);
      iterations++;
    }
  }

  /**
   * Generate all pending returns for all positions
   * Called on page load and periodically
   */
  async generarRendimientosPendientes(): Promise<void> {
    try {
      const posiciones = await inversionesService.getPosiciones();
      for (const posicion of posiciones) {
        if (esRendimientoPeriodico(posicion as unknown as PosicionInversionExtendida)) {
          await this.procesarRendimientoPeriodico(posicion as unknown as InversionRendimientoPeriodico);
        }
      }
    } catch (err) {
      console.error('[RENDIMIENTOS] Error generating pending returns:', err);
    }
  }

  /**
   * Get all payments across all positions, enriched with position name
   */
  async getAllRendimientos(): Promise<Array<PagoRendimiento & { posicion_nombre: string; posicion_id: number }>> {
    const posiciones = await inversionesService.getPosiciones();
    const result: Array<PagoRendimiento & { posicion_nombre: string; posicion_id: number }> = [];

    for (const posicion of posiciones) {
      const posAny = posicion as any;
      if (posAny.rendimiento?.pagos_generados?.length) {
        for (const pago of posAny.rendimiento.pagos_generados as PagoRendimiento[]) {
          result.push({
            ...pago,
            posicion_nombre: posicion.nombre,
            posicion_id: posicion.id,
          });
        }
      }
    }

    return result.sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime());
  }
}

export const rendimientosService = new RendimientosService();
