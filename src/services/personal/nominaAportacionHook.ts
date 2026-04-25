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
//   - Suma a `historialAportaciones[YYYY-MM]` del producto en `planesPensionInversion`
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

const STORE_PLANES = 'planesPensionInversion';
const STORE_NOMINAS = 'nominas';
const STORE_TREASURY = 'treasuryEvents';

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
  const plan = await db.get(STORE_PLANES, nomina.planPensiones.productoDestinoId);
  if (!plan) {
    console.warn(
      `[onNominaConfirmada] producto plan pensiones ${nomina.planPensiones.productoDestinoId} no encontrado`,
    );
    return;
  }

  const fechaEvento = new Date(evento.actualDate || evento.predictedDate);
  const yearMonth = `${fechaEvento.getFullYear()}-${String(fechaEvento.getMonth() + 1).padStart(2, '0')}`;

  // Aportación de la empresa (mismo evento contribuye)
  const apEmpresa = nomina.planPensiones?.aportacionEmpresa;
  const importeEmpresaMensual = apEmpresa
    ? calcularAportacionMensual(apEmpresa, nomina.salarioBrutoAnual / 12)
    : 0;

  // Idempotencia: si ya hay una entrada para este mes · sumamos solo si no
  // está el evento actual ya registrado (clave del evento como referencia)
  if (!plan.historialAportaciones) plan.historialAportaciones = {};

  const claveEvento = `evento_${evento.id}`;
  const yaRegistrado = (plan.historialAportaciones as any)[claveEvento];
  if (yaRegistrado) return;

  const previa = plan.historialAportaciones[yearMonth] ?? {
    titular: 0,
    empresa: 0,
    total: 0,
    fuente: 'atlas_nativo' as const,
  };

  plan.historialAportaciones[yearMonth] = {
    titular: previa.titular + importeMensual,
    empresa: previa.empresa + importeEmpresaMensual,
    total: previa.total + importeMensual + importeEmpresaMensual,
    fuente: 'atlas_nativo',
  };

  // Marca de idempotencia · no es una aportación real, evita doble-conteo
  (plan.historialAportaciones as any)[claveEvento] = {
    titular: importeMensual,
    empresa: importeEmpresaMensual,
    total: importeMensual + importeEmpresaMensual,
    fuente: 'atlas_nativo',
  };

  // Recalcula acumulado · NO suma las claves "evento_*"
  const sumaTotales = Object.entries(plan.historialAportaciones)
    .filter(([k]) => !k.startsWith('evento_'))
    .reduce((acc, [, e]) => acc + (e as { total: number }).total, 0);
  plan.aportacionesRealizadas = sumaTotales;
  plan.fechaActualizacion = new Date().toISOString();

  await db.put(STORE_PLANES, plan);
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
  const nomina = await db.get(STORE_NOMINAS, evento.sourceId);
  if (!nomina) return;

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
 * (suma `historialAportaciones[YYYY-*]`). Útil para Fiscal · tope 1.500€ /
 * 8.500€ con empresa.
 *
 * NO incluye las claves de idempotencia `evento_*`.
 */
export async function aportacionesAcumuladasEjercicio(
  productoId: number,
  ejercicio: number,
): Promise<{ titular: number; empresa: number; total: number }> {
  const db = await initDB();
  const plan = await db.get(STORE_PLANES, productoId);
  if (!plan?.historialAportaciones) {
    return { titular: 0, empresa: 0, total: 0 };
  }
  const prefijo = `${ejercicio}-`;
  let titular = 0;
  let empresa = 0;
  type EntradaHistorial = {
    titular: number;
    empresa: number;
    total: number;
    fuente: string;
  };
  for (const [k, v] of Object.entries(plan.historialAportaciones)) {
    if (k.startsWith('evento_')) continue;
    if (!k.startsWith(prefijo)) continue;
    const e = v as EntradaHistorial;
    titular += e.titular ?? 0;
    empresa += e.empresa ?? 0;
  }
  return { titular, empresa, total: titular + empresa };
}
