import { initDB } from '../db';
import { generarCuadroAmortizacion } from '../financialCalculations';

export async function migrarPrestamosExistentes(): Promise<void> {
  const db = await initDB();
  const prestamos = await db.getAll('prestamos');

  for (const prestamo of prestamos) {
    // If it already has fecha_inicio, it was already migrated
    if (prestamo.fecha_inicio) continue;

    // Estimate fecha_inicio as 1 month before the first payment
    const fechaPrimeraCuota = new Date(prestamo.fecha_primera_cuota || new Date());
    const fechaInicio = new Date(fechaPrimeraCuota);
    fechaInicio.setMonth(fechaInicio.getMonth() - 1);

    // Regenerate schedule with new logic
    const config = {
      capital: prestamo.capital_inicial,
      tasa_anual: prestamo.tasa_interes_anual,
      plazo_meses: prestamo.plazo_meses,
      fecha_inicio: fechaInicio.toISOString().split('T')[0],
      fecha_primera_cuota: prestamo.fecha_primera_cuota || new Date().toISOString().split('T')[0],
      tipo: (prestamo.tipo_interes || 'FIJO') as 'FIJO' | 'VARIABLE'
    };

    const cuadroAmortizacion = generarCuadroAmortizacion(config);

    await db.put('prestamos', {
      ...prestamo,
      fecha_inicio: config.fecha_inicio,
      fecha_primera_cuota: config.fecha_primera_cuota,
      cuadro_amortizacion: cuadroAmortizacion
    });
  }

  console.log(`✅ Migrados ${prestamos.length} préstamos`);
}
