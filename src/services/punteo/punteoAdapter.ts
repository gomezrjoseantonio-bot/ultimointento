// ============================================================================
// Punteo unificado · adaptador de datos (Bloque 3 · P1)
// ============================================================================
//
// Convierte los registros existentes (TreasuryEvent · Movement) en ItemPunteo
// para PunteoList. Derivación pura · sin tocar los stores.
// ============================================================================

import type { TreasuryEvent, Movement } from '../db';
import {
  estadoDeEvento,
  estadoDeMovimiento,
  type ItemPunteo,
} from './punteoModel';

// ─── Etiqueta de origen (qué es la cosa) ────────────────────────────────────

export function origenDeEvento(e: Pick<TreasuryEvent, 'sourceType' | 'type' | 'categoryKey'>): string {
  switch (e.sourceType) {
    case 'prestamo':
    case 'hipoteca':
      return 'Financiación';
    case 'nomina':
    case 'otros_ingresos':
      return 'Ingreso';
    case 'contrato':
    case 'contract':
      return 'Contrato';
    case 'gasto_recurrente':
    case 'personal_expense':
    case 'opex_rule':
      return e.categoryKey?.startsWith('suministros') || e.categoryKey === 'vivienda.suministros'
        ? 'Suministro'
        : 'Recurrente';
    case 'autonomo':
    case 'autonomo_ingreso':
    case 'autonomo_gasto':
    case 'autonomo_cuota':
      return 'Autónomo';
    case 'inversion_compra':
    case 'inversion_aportacion':
    case 'inversion_rendimiento':
    case 'inversion_dividendo':
    case 'inversion_liquidacion':
      return 'Inversión';
    default:
      return e.type === 'income' ? 'Ingreso' : 'Gasto';
  }
}

// ─── Eventos (previsiones) ──────────────────────────────────────────────────

export function eventoAItem(
  e: TreasuryEvent & { id: number },
  aliasInmueble?: (id: number | string) => string | undefined,
): ItemPunteo {
  const mag = Math.abs(e.actualAmount ?? e.amount);
  const importe = e.type === 'income' ? mag : -mag;
  const activo =
    e.inmuebleId != null
      ? {
          inmuebleId: e.inmuebleId,
          alias: e.inmuebleAlias ?? aliasInmueble?.(e.inmuebleId) ?? `Inmueble ${e.inmuebleId}`,
        }
      : null;
  return {
    key: `evt-${e.id}`,
    kind: 'evento',
    refId: e.id,
    estado: estadoDeEvento(e),
    fecha: (e.predictedDate ?? '').slice(0, 10),
    concepto: e.description,
    activo,
    origen: origenDeEvento(e),
    cuentaId: e.accountId ?? null,
    importe,
    // Alquiler por habitaciones · varias rentas del mismo contrato el mismo
    // día forman grupo madre/hijas (agruparHijas exige >1 para formar madre).
    grupoId:
      e.sourceType === 'contrato' && e.contratoId != null
        ? `contrato-${e.contratoId}`
        : undefined,
    categoryKey: e.categoryKey,
    subtypeKey: e.subtypeKey,
  };
}

// ─── Movimientos (realidad) ─────────────────────────────────────────────────

export function movimientoAItem(
  m: Movement & { id: number },
  aliasInmueble?: (id: number | string) => string | undefined,
): ItemPunteo {
  const activo =
    m.inmuebleId != null && m.inmuebleId !== ''
      ? {
          inmuebleId: m.inmuebleId,
          alias: aliasInmueble?.(m.inmuebleId) ?? `Inmueble ${m.inmuebleId}`,
        }
      : null;
  return {
    key: `mov-${m.id}`,
    kind: 'movimiento',
    refId: m.id,
    estado: estadoDeMovimiento(m),
    fecha: (m.date ?? '').slice(0, 10),
    concepto: m.description,
    activo,
    origen: m.type === 'Ingreso' ? 'Ingreso' : m.type === 'Transferencia' ? 'Transferencia' : 'Gasto',
    cuentaId: m.accountId ?? null,
    importe: m.amount,
    categoryKey: m.categoryKey,
    subtypeKey: m.subtypeKey,
  };
}
