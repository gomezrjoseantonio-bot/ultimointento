import { initDB } from './db';
import { Prestamo, ConfiguracionPrestamo } from '../types/loans';
import { generarCuadroAmortizacion } from './financialCalculations';

export class LoanService {

  async createLoan(data: Omit<Prestamo, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const db = await initDB();

    // Generate amortization schedule
    const config: ConfiguracionPrestamo = {
      capital: data.capital_inicial,
      tasa_anual: data.tasa_interes_anual,
      plazo_meses: data.plazo_meses,
      fecha_inicio: data.fecha_inicio,
      fecha_primera_cuota: data.fecha_primera_cuota,
      tipo: data.tipo_interes
    };

    const cuadroAmortizacion = generarCuadroAmortizacion(config);

    const prestamo = {
      ...data,
      cuadro_amortizacion: cuadroAmortizacion,
      capital_pendiente: data.capital_inicial,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const id = await db.add('prestamos', prestamo);
    return id as number;
  }

  async getLoan(id: number): Promise<Prestamo | undefined> {
    const db = await initDB();
    return db.get('prestamos', id);
  }

  async getAllLoans(): Promise<Prestamo[]> {
    const db = await initDB();
    return db.getAll('prestamos');
  }

  async updateLoan(id: number, data: Partial<Prestamo>): Promise<void> {
    const db = await initDB();
    const existing = await this.getLoan(id);

    if (!existing) {
      throw new Error('Préstamo no encontrado');
    }

    // If critical parameters are modified, regenerate schedule
    const needsRecalculation =
      data.capital_inicial !== undefined ||
      data.tasa_interes_anual !== undefined ||
      data.plazo_meses !== undefined ||
      data.fecha_inicio !== undefined ||
      data.fecha_primera_cuota !== undefined;

    let cuadroAmortizacion = existing.cuadro_amortizacion;

    if (needsRecalculation) {
      const config: ConfiguracionPrestamo = {
        capital: data.capital_inicial ?? existing.capital_inicial,
        tasa_anual: data.tasa_interes_anual ?? existing.tasa_interes_anual,
        plazo_meses: data.plazo_meses ?? existing.plazo_meses,
        fecha_inicio: data.fecha_inicio ?? existing.fecha_inicio,
        fecha_primera_cuota: data.fecha_primera_cuota ?? existing.fecha_primera_cuota,
        tipo: data.tipo_interes ?? existing.tipo_interes
      };

      cuadroAmortizacion = generarCuadroAmortizacion(config);
    }

    const updated: Prestamo = {
      ...existing,
      ...data,
      cuadro_amortizacion: cuadroAmortizacion,
      updated_at: new Date().toISOString()
    };

    await db.put('prestamos', updated);
  }

  async deleteLoan(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('prestamos', id);
  }

  /**
   * Marks a payment as paid and creates the treasury movement
   */
  async pagarCuota(
    prestamoId: number,
    numeroCuota: number,
    cuentaId: number,
    fechaPago: string
  ): Promise<void> {
    const prestamo = await this.getLoan(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    const cuota = prestamo.cuadro_amortizacion.find(c => c.numero === numeroCuota);
    if (!cuota) throw new Error('Cuota no encontrada');
    if (cuota.pagado) throw new Error('Cuota ya pagada');

    // Create treasury movement
    const db = await initDB();
    const movimientoId = await db.add('movements', {
      accountId: cuentaId,
      date: fechaPago,
      amount: -cuota.cuota_total,
      description: `Cuota ${numeroCuota}/${prestamo.plazo_meses} - ${prestamo.nombre}`,
      category: 'Préstamos',
      subcategory: 'Cuota préstamo',
      type: 'expense',
      reconciled: true,
      prestamo_id: prestamoId,
      cuota_numero: numeroCuota,
      created_at: new Date().toISOString()
    });

    // Mark payment as paid
    cuota.pagado = true;
    cuota.fecha_pago_real = fechaPago;
    cuota.movimiento_id = movimientoId as number;

    // Update outstanding capital
    prestamo.capital_pendiente = cuota.capital_pendiente;

    await this.updateLoan(prestamoId, {
      cuadro_amortizacion: prestamo.cuadro_amortizacion,
      capital_pendiente: prestamo.capital_pendiente
    });
  }
}

export const loanService = new LoanService();
