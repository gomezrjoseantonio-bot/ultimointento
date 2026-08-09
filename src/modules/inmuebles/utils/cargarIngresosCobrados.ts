// Ingresos de renta COBRADOS de un inmueble en un ejercicio (Fase 7).
//
// Lee `treasuryEvents` por el índice `inmuebleId` y reutiliza `ingresosPorAnio`
// (renta confirmada/ejecutada · no previsiones). Devuelve solo el total del año.
// No muta nada.

import { initDB } from '../../../services/db';
import { ingresosPorAnio } from './ingresosAnualesService';

export async function cargarIngresosCobradosAnual(
  inmuebleId: number,
  ejercicio: number,
): Promise<number> {
  const db = await initDB();
  const events = await db.getAllFromIndex('treasuryEvents', 'inmuebleId', inmuebleId);
  return ingresosPorAnio(events, [ejercicio])[0]?.total ?? 0;
}
