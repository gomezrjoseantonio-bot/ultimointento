import { initDB } from '../db';
import { generarCuadroAmortizacion } from '../financialCalculations';

export async function migrarPrestamosExistentes(): Promise<void> {
  const db = await initDB();
  const prestamos = await db.getAll('prestamos');

  let migrated = 0;

  for (const prestamo of prestamos) {
    let needsUpdate = false;
    const updates: Record<string, unknown> = {};

    // Legacy schedule migration (original logic)
    if (!prestamo.fecha_inicio) {
      const fechaPrimeraCuota = new Date(prestamo.fecha_primera_cuota || new Date());
      const fechaInicio = new Date(fechaPrimeraCuota);
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);

      const config = {
        capital: prestamo.capital_inicial,
        tasa_anual: prestamo.tasa_interes_anual,
        plazo_meses: prestamo.plazo_meses,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_primera_cuota: prestamo.fecha_primera_cuota || new Date().toISOString().split('T')[0],
        tipo: (prestamo.tipo_interes || 'FIJO') as 'FIJO' | 'VARIABLE'
      };

      const cuadroAmortizacion = generarCuadroAmortizacion(config);
      updates.fecha_inicio = config.fecha_inicio;
      updates.fecha_primera_cuota = config.fecha_primera_cuota;
      updates.cuadro_amortizacion = cuadroAmortizacion;
      needsUpdate = true;
    }

    // New unified Prestamo fields
    if (!prestamo.ambito) {
      updates.ambito = prestamo.inmuebleId && typeof prestamo.inmuebleId === 'string' && prestamo.inmuebleId.trim() !== ''
        ? 'INMUEBLE'
        : 'PERSONAL';
      needsUpdate = true;
    }

    if (!prestamo.carencia) {
      updates.carencia = 'NINGUNA';
      needsUpdate = true;
    }

    if (!prestamo.sistema) {
      updates.sistema = 'FRANCES';
      needsUpdate = true;
    }

    if (prestamo.cuotasPagadas === undefined || prestamo.cuotasPagadas === null) {
      updates.cuotasPagadas = 0;
      needsUpdate = true;
    }

    if (!prestamo.origenCreacion) {
      updates.origenCreacion = 'MANUAL';
      needsUpdate = true;
    }

    if (!Array.isArray(prestamo.bonificaciones)) {
      updates.bonificaciones = [];
      needsUpdate = true;
    }

    if (prestamo.activo === undefined || prestamo.activo === null) {
      updates.activo = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.put('prestamos', { ...prestamo, ...updates });
      migrated++;
    }
  }

  console.log(`✅ Migrados ${migrated} préstamos (de ${prestamos.length} totales)`);
}
