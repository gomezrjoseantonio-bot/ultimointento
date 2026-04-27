// ============================================================================
// ATLAS Personal v1.1 · Nómina · Aportación al plan de pensiones (G-07)
// ============================================================================
//
// Cuando un evento de cobro de nómina pasa a estado `confirmed` (porque llega
// el extracto bancario y el usuario concilia) · ATLAS genera automáticamente
// una aportación al producto plan de pensiones del trabajador identificado en
// `nomina.planPensiones.productoDestinoId`.
//
// La aportación:
//   - Escribe en `aportacionesPlan` (store V65)
//   - Reduce base IRPF (cálculo realizado por Fiscal)
//   - Aparece en el historial del producto en Inversiones
//
// Las especies (G-03 · seguro vida · médico · ayuda comida · etc.) NO generan
// eventos en Tesorería (no salen del bolsillo) pero sí cuentan en Fiscal.
//
// La cuota solidaridad (G-04) la introduce el usuario al alta de la nómina ·
// no la calcula el motor.
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db';
import type { Nomina } from '../../types/personal';

// V63 (TAREA 7 sub-tarea 4 · deuda sub-tarea 2): el store legacy `nominas`
// se eliminó; los registros viven en `ingresos` con `tipo='nomina'`.
const STORE_INGRESOS = 'ingresos';
const STORE_TREASURY = 'treasuryEvents';

const genUUID = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Hook · cuando un evento de cobro de nómina pasa a `confirmed` ·
 * crea/incrementa la aportación al plan pensiones del trabajador.
 *
 * Idempotente: si la aportación ya existe para el mismo (mes · evento), no
 * la duplica.
 */
export async function onNominaConfirmada(
  evento: TreasuryEvent,
  nomina: Nomina,
): Promise<void> {
  // Solo aplica si la nómina tiene aportación del empleado
  const ap = nomina.planPensiones?.aportacionEmpleado;
  if (!ap || !nomina.planPensiones?.productoDestinoId) return;

  const importeMensual = calcularAportacionMensual(ap, nomina.salarioBrutoAnual / 12);
  if (importeMensual <= 0) return;

  const db = await initDB();
  const fechaEvento = new Date(evento.actualDate || evento.predictedDate);
  const yearMonth = `${fechaEvento.getFullYear()}-${String(fechaEvento.getMonth() + 1).padStart(2, '0')}`;

  // Aportación de la empresa (mismo evento contribuye)
  const apEmpresa = nomina.planPensiones?.aportacionEmpresa;
  const importeEmpresaMensual = apEmpresa
    ? calcularAportacionMensual(apEmpresa, nomina.salarioBrutoAnual / 12)
    : 0;

  // Find plan in planesPensiones by UUID or by legacy numeric link
  const productoId = nomina.planPensiones.productoDestinoId;
  const planesNuevos = (await (db as any).getAll('planesPensiones')) as Array<{
    id: string;
    empresaPagadora?: { ingresoIdVinculado?: string };
    gestoraActual?: string;
  }>;

  let planNuevo = planesNuevos.find((p) => p.id === String(productoId));
  if (!planNuevo) {
    planNuevo = planesNuevos.find(
      (p) => p.empresaPagadora?.ingresoIdVinculado === String(productoId),
    );
  }

  if (!planNuevo) {
    console.warn(
      `[onNominaConfirmada] producto plan pensiones ${productoId} no encontrado en planesPensiones`,
    );
    return;
  }

  // Idempotencia: no duplicar si ya existe una aportación para este evento
  const ingresoIdStr = String(evento.sourceId ?? evento.id ?? '');
  const aportacionesExistentes = (await (db as any).getAll('aportacionesPlan')) as Array<{
    ingresoIdNomina?: string;
    planId: string;
  }>;
  const yaExiste = aportacionesExistentes.some(
    (a) => a.planId === planNuevo!.id && a.ingresoIdNomina === ingresoIdStr,
  );
  if (yaExiste) return;

  const ahora = new Date().toISOString();
  await (db as any).add('aportacionesPlan', {
    id: genUUID(),
    planId: planNuevo.id,
    fecha: yearMonth + '-01',
    ejercicioFiscal: fechaEvento.getFullYear(),
    importeTitular: importeMensual,
    importeEmpresa: importeEmpresaMensual,
    origen: 'nomina_vinculada' as const,
    granularidad: 'mensual' as const,
    ingresoIdNomina: ingresoIdStr,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
  });
}

/**
 * Hook genérico de Tesorería · llama a este desde el reconciliador cuando
 * un evento sourceType='nomina' pasa de 'predicted' a 'confirmed'.
 */
export async function procesarConfirmacionEvento(evento: TreasuryEvent): Promise<void> {
  if (evento.sourceType !== 'nomina') return;
  if (evento.status !== 'confirmed' && evento.status !== 'executed') return;
  if (!evento.sourceId) return;

  const db = await initDB();
  const nomina = await db.get(STORE_INGRESOS, evento.sourceId);
  if (!nomina || (nomina as any).tipo !== 'nomina') return;

  await onNominaConfirmada(evento, nomina as Nomina);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function calcularAportacionMensual(
  ap: { tipo: 'porcentaje' | 'importe'; valor: number; salarioBaseObjetivo?: number },
  salarioBrutoMensual: number,
): number {
  if (ap.tipo === 'importe') return ap.valor;
  // porcentaje · sobre salarioBaseObjetivo si existe · si no, sobre el bruto mensual
  const base = ap.salarioBaseObjetivo ?? salarioBrutoMensual;
  return base * (ap.valor / 100);
}

/**
 * Calcula el total acumulado de aportaciones del trabajador en un ejercicio
 * (consulta `aportacionesPlan` filtrado por planId + ejercicioFiscal).
 * Útil para Fiscal · tope 1.500€ / 8.500€ con empresa.
 */
export async function aportacionesAcumuladasEjercicio(
  productoId: number | string,
  ejercicio: number,
): Promise<{ titular: number; empresa: number; total: number }> {
  const db = await initDB();
  const planesNuevos = (await (db as any).getAll('planesPensiones')) as Array<{
    id: string;
    empresaPagadora?: { ingresoIdVinculado?: string };
  }>;

  let planId: string | undefined = planesNuevos.find((p) => p.id === String(productoId))?.id;
  if (!planId) {
    planId = planesNuevos.find(
      (p) => p.empresaPagadora?.ingresoIdVinculado === String(productoId),
    )?.id;
  }
  if (!planId) return { titular: 0, empresa: 0, total: 0 };

  const aportaciones = (await (db as any).getAll('aportacionesPlan')) as Array<{
    planId: string;
    ejercicioFiscal: number;
    importeTitular: number;
    importeEmpresa: number;
  }>;

  let titular = 0;
  let empresa = 0;
  for (const a of aportaciones) {
    if (a.planId !== planId || a.ejercicioFiscal !== ejercicio) continue;
    titular += a.importeTitular ?? 0;
    empresa += a.importeEmpresa ?? 0;
  }
  return { titular, empresa, total: titular + empresa };
}
