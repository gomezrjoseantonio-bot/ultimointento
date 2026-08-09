// Consolidación Contratos → Alquileres · Fase D · capa de PRESENTACIÓN que
// sintetiza los TRES estados operativos de un contrato SIN mezclarlos en una
// sola etiqueta y SIN modificar el modelo persistente (`Contract`).
//
// Las tres dimensiones son ortogonales (spec § 6):
//   1. estado EFECTIVO   · vigente | proximo | finalizado  · calculado por fechas.
//   2. estado de FIRMA    · firmado | sin_firmar            · soporte documental.
//   3. estado de COBRO    · al_dia | pendiente | impago | sin_datos.
//
// El estado de COBRO NO se calcula aquí a partir del `Contract`: la fuente de
// verdad del dinero cobrado es Tesorería. Este helper solo REFLEJA lo que
// Tesorería le pase por `TreasuryCobroContext`; cuando no hay contexto devuelve
// `sin_datos` en lugar de inventar un cobro (spec § 8 · "no poner una renta
// cobrada dentro de Contract si procede de Tesorería").

import type { Contract } from '../../../services/db';
import { getEstadoEfectivo, type EstadoEfectivo } from './estadoEfectivoService';
import { estaFirmado } from './calcularEstadoChip';

export type EstadoFirma = 'firmado' | 'sin_firmar';
export type EstadoCobro = 'al_dia' | 'pendiente' | 'impago' | 'sin_datos';

export interface ResumenOperativoContrato {
  /** vigente | proximo | finalizado · calculado por fechas (no persistido). */
  estadoEfectivo: EstadoEfectivo;
  /** firmado | sin_firmar · soporte documental / workflow de firma. */
  estadoFirma: EstadoFirma;
  /** al_dia | pendiente | impago | sin_datos · verdad del cobro = Tesorería. */
  estadoCobro: EstadoCobro;
}

/**
 * Contexto de cobro procedente de Tesorería (fuente de verdad del dinero).
 * Se pasa opcionalmente al helper para que refleje el estado real de cobro del
 * contrato. Cuando se omite, el estado de cobro es `sin_datos`.
 */
export interface TreasuryCobroContext {
  estadoCobro?: EstadoCobro;
}

/**
 * Estado DOCUMENTAL (firma) del contrato.
 *
 * · `sin_firmar` explícito para importados Rentila/AEAT (`estadoContrato ===
 *   'sin_firmar'`), aunque tuvieran señales de firma parciales.
 * · en cualquier otro caso, `firmado` si hay firma digital (`firma.estado ===
 *   'firmado'`) o firma manual registrada (`fechaFirmaContrato`); si no,
 *   `sin_firmar`.
 */
export function getEstadoFirma(c: Contract): EstadoFirma {
  if (c.estadoContrato === 'sin_firmar') return 'sin_firmar';
  return estaFirmado(c) ? 'firmado' : 'sin_firmar';
}

/**
 * Estado de COBRO del contrato.
 *
 * La verdad del cobro vive en Tesorería, no en `Contract`. Sin
 * `TreasuryCobroContext` devolvemos `sin_datos` (no inventamos un cobro). Con
 * contexto, reflejamos su `estadoCobro` tal cual.
 */
export function getEstadoCobro(
  _c: Contract,
  treasury?: TreasuryCobroContext,
): EstadoCobro {
  if (!treasury || treasury.estadoCobro == null) return 'sin_datos';
  return treasury.estadoCobro;
}

/**
 * Resumen operativo del contrato · combina estado efectivo, firma y cobro en un
 * único objeto de presentación SIN colapsarlos en una etiqueta y SIN tocar la
 * persistencia.
 *
 * @param c        contrato de dominio.
 * @param treasury contexto de cobro de Tesorería (opcional).
 * @param hoy      fecha de referencia (opcional · tests deterministas).
 */
export function getContratoResumenOperativo(
  c: Contract,
  treasury?: TreasuryCobroContext,
  hoy?: Date,
): ResumenOperativoContrato {
  return {
    estadoEfectivo: getEstadoEfectivo(c, hoy),
    estadoFirma: getEstadoFirma(c),
    estadoCobro: getEstadoCobro(c, treasury),
  };
}

// --- Etiquetas de presentación (es-ES) ------------------------------------

export const LABEL_ESTADO_EFECTIVO: Record<EstadoEfectivo, string> = {
  vigente: 'Vigente',
  proximo: 'Próximo',
  finalizado: 'Finalizado',
};

export const LABEL_ESTADO_FIRMA: Record<EstadoFirma, string> = {
  firmado: 'firmado',
  sin_firmar: 'sin firmar',
};

export const LABEL_ESTADO_COBRO: Record<EstadoCobro, string> = {
  al_dia: 'al día',
  pendiente: 'pendiente',
  impago: 'impago',
  sin_datos: 'sin datos',
};

/**
 * Texto compacto tipo "Vigente · firmado · al día" a partir del resumen.
 *
 * El estado de cobro `sin_datos` se OMITE (no aporta información y ensucia el
 * chip): un contrato sin datos de Tesorería se muestra como "Vigente · firmado".
 */
export function formatResumenOperativo(resumen: ResumenOperativoContrato): string {
  const partes: string[] = [
    LABEL_ESTADO_EFECTIVO[resumen.estadoEfectivo],
    LABEL_ESTADO_FIRMA[resumen.estadoFirma],
  ];
  if (resumen.estadoCobro !== 'sin_datos') {
    partes.push(LABEL_ESTADO_COBRO[resumen.estadoCobro]);
  }
  return partes.join(' · ');
}
