// ============================================================================
// E2.4.1b · Qué clasificación le toca a un previsto por el ORIGEN que lo emite
// ============================================================================
//
// Los eventos que nacen de un módulo (nómina · contrato · préstamo · inversión
// · autónomo · IRPF) no pasan por un selector: su naturaleza y su familia las
// decide el origen, aquí, UNA vez. Antes cada generador escribía a mano un
// `type: 'income' | 'expense' | 'financing'` y la familia no existía.
//
// Decisiones (Jose · 5 sep 2026 · DEFINITIVO):
//   · la CUOTA de un préstamo (y su cancelación o amortización anticipada) es
//     `gasto · prestamo_hipoteca`, cargo entero: interés y capital los da el
//     cuadro, no el catálogo.
//   · la DISPOSICIÓN del préstamo es `movimiento_interno · disposicion_prestamo`
//     (entra). Hoy ningún generador la emite: queda para quien la registre.
//   · una APORTACIÓN (plan · fondo · inversión) es movimiento interno: el dinero
//     cambia de sitio, no de dueño. Sale de la cuenta.
//   · una LIQUIDACIÓN o venta de inversión entra como `ingreso · venta`.
//
// Lo que un origen no sabe clasificar (un gasto de autónomo suelto) se deja
// SIN familia: mejor «sin clasificar» que una familia inventada.
// ============================================================================

import type { TreasuryEvent } from '../db';
import type { FamiliaId, Naturaleza, Sentido } from './catalogoUnico';

export interface ClasificacionDeOrigen {
  naturaleza: Naturaleza;
  sentido?: Sentido;
  familia?: FamiliaId;
  subtipo?: string;
}

type Origen = TreasuryEvent['sourceType'];

const INGRESO = (familia?: FamiliaId, subtipo?: string): ClasificacionDeOrigen => ({
  naturaleza: 'ingreso',
  ...(familia ? { familia } : {}),
  ...(subtipo ? { subtipo } : {}),
});
const GASTO = (familia?: FamiliaId, subtipo?: string): ClasificacionDeOrigen => ({
  naturaleza: 'gasto',
  ...(familia ? { familia } : {}),
  ...(subtipo ? { subtipo } : {}),
});
const INTERNO = (sentido: Sentido, familia: FamiliaId, subtipo?: string): ClasificacionDeOrigen => ({
  naturaleza: 'movimiento_interno',
  sentido,
  familia,
  ...(subtipo ? { subtipo } : {}),
});

const POR_ORIGEN: Readonly<Record<Origen, ClasificacionDeOrigen>> = {
  // ── Ingresos ──
  contrato: INGRESO('alquiler'),
  contract: INGRESO('alquiler'),
  ingreso: INGRESO(),
  nomina: INGRESO('nomina'),
  otros_ingresos: INGRESO('otros_ingresos'),
  autonomo_ingreso: INGRESO('autonomo'),
  inversion_rendimiento: INGRESO('rendimiento', 'rendimiento_inversion'),
  inversion_dividendo: INGRESO('rendimiento', 'dividendo'),
  inversion_liquidacion: INGRESO('venta'),
  // ── Gastos ──
  gasto: GASTO(),
  document: GASTO(),
  manual: GASTO(),
  opex_rule: GASTO(),
  gasto_recurrente: GASTO(),
  personal_expense: GASTO(),
  comision_gestion: GASTO('gestion', 'otros'),
  autonomo: GASTO(),
  autonomo_gasto: GASTO(),
  autonomo_gasto_legacy: GASTO(),
  autonomo_cuota: GASTO('impuestos_tasas', 'otros_tributos'),
  irpf_prevision: GASTO('impuestos_tasas', 'otros_tributos'),
  tarjeta_recibo: GASTO(),
  gasto_tarjeta: GASTO(),
  // ── Préstamos · cargo entero, el cuadro parte interés/capital ──
  prestamo: GASTO('prestamo_hipoteca'),
  hipoteca: GASTO('prestamo_hipoteca'),
  amortizacion_anticipada: GASTO('prestamo_hipoteca'),
  // ── Internos · el dinero cambia de sitio, no de dueño ──
  inversion_compra: INTERNO('sale', 'aportacion', 'inversion'),
  inversion_aportacion: INTERNO('sale', 'aportacion', 'fondo'),
};

/**
 * La clasificación que le toca a un previsto por su origen. Se esparce en el
 * evento al crearlo (`...clasificacionDeOrigen('nomina')`).
 */
export function clasificacionDeOrigen(origen: Origen): ClasificacionDeOrigen {
  return POR_ORIGEN[origen] ?? GASTO();
}
