// Consolidación Contratos → Alquileres · Fase F · ciclo de vida del contrato.
//
// Finalizar / reactivar / cambiar renta / renovar. Todas las mutaciones pasan
// por `updateContract` (única vía de escritura segura: normaliza firma/documento,
// sella `updatedAt` y regenera previsiones). Ninguna BORRA el contrato ni
// MODIFICA entradas previas de `historicoRentas`: solo APENDAN (spec §7 · "no
// modificar silenciosamente el histórico anterior"). No se toca DB_VERSION ni el
// schema (el store `contracts` es schemaless).

import type { Contract, HistoricoRenta, MotivoFin, VolveriaAAlquilar } from './db';
import {
  getContract,
  updateContract,
  FECHA_FIN_INDEFINIDO,
} from './contractService';

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

export interface FinalizarContratoOptions {
  /** Fecha real de salida (ISO date). Por defecto hoy. */
  fechaCierre?: string;
  motivoFin?: MotivoFin;
  detalleMotivoFin?: string;
  valoracion?: 1 | 2 | 3 | 4 | 5;
  volveriaAAlquilar?: VolveriaAAlquilar;
  notasCasero?: string;
  fianzaDevuelta?: number;
}

/**
 * Finaliza un contrato conservando TODO su histórico (rentas, pagos, fiscal).
 * Libera la unidad por FECHAS: al fijar `fechaFin = fechaCierre`, el estado
 * efectivo pasa a `finalizado` y deja de contar como ocupada. Registra el
 * motivo/valoración de salida en los campos T6 existentes. No borra nada.
 */
export const finalizarContrato = async (
  id: number,
  options: FinalizarContratoOptions = {},
): Promise<void> => {
  const contract = await getContract(id);
  if (!contract) {
    throw new Error('Contract not found');
  }
  const fechaCierre = options.fechaCierre ?? hoyISO();
  const updates: Partial<Contract> = {
    estadoContrato: 'finalizado',
    fechaFin: fechaCierre,
    fechaCierre,
  };
  if (options.motivoFin !== undefined) updates.motivoFin = options.motivoFin;
  if (options.detalleMotivoFin !== undefined) updates.detalleMotivoFin = options.detalleMotivoFin;
  if (options.valoracion !== undefined) updates.valoracion = options.valoracion;
  if (options.volveriaAAlquilar !== undefined) updates.volveriaAAlquilar = options.volveriaAAlquilar;
  if (options.notasCasero !== undefined) updates.notasCasero = options.notasCasero;
  if (options.fianzaDevuelta !== undefined) updates.fianzaDevuelta = options.fianzaDevuelta;
  await updateContract(id, updates);
};

export interface ReactivarContratoOptions {
  /** Nueva fecha fin (ISO date). Por defecto indefinida (2099-12-31). */
  nuevaFechaFin?: string;
}

/**
 * Reactiva un contrato finalizado/rescindido: vuelve a `activo`, restablece la
 * fecha fin (indefinida por defecto) y limpia los datos de salida. El histórico
 * de rentas y pagos se conserva intacto.
 */
export const reactivarContrato = async (
  id: number,
  options: ReactivarContratoOptions = {},
): Promise<void> => {
  const contract = await getContract(id);
  if (!contract) {
    throw new Error('Contract not found');
  }
  await updateContract(id, {
    estadoContrato: 'activo',
    fechaFin: options.nuevaFechaFin ?? FECHA_FIN_INDEFINIDO,
    rescision: undefined,
    motivoFin: undefined,
    detalleMotivoFin: undefined,
    fechaCierre: undefined,
    valoracion: undefined,
    volveriaAAlquilar: undefined,
  });
};

export interface CambiarRentaOptions {
  nuevaRenta: number;
  /** Fecha de efecto (ISO date). Por defecto hoy. */
  fechaDesde?: string;
  /** Origen del cambio en el histórico. Por defecto 'manual'. */
  origen?: HistoricoRenta['origen'];
  nota?: string;
}

/**
 * Cambia la renta pactada del contrato APENDANDO una entrada a `historicoRentas`
 * con el origen indicado y manteniendo `rentaMensual` sincronizado con la última
 * entrada (invariante de `types-contratos`). No modifica entradas anteriores.
 */
export const cambiarRentaContrato = async (
  id: number,
  options: CambiarRentaOptions,
): Promise<void> => {
  const contract = await getContract(id);
  if (!contract) {
    throw new Error('Contract not found');
  }
  const entrada: HistoricoRenta = {
    fechaDesde: options.fechaDesde ?? hoyISO(),
    importe: options.nuevaRenta,
    origen: options.origen ?? 'manual',
  };
  if (options.nota !== undefined) entrada.nota = options.nota;
  const historicoRentas = [...(contract.historicoRentas ?? []), entrada];
  await updateContract(id, {
    rentaMensual: options.nuevaRenta,
    historicoRentas,
  });
};

export interface RenovarContratoOptions {
  /** Nueva fecha fin del contrato (ISO date). */
  nuevaFechaFin: string;
  /** Nueva renta pactada (opcional). Si cambia, se registra como 'renegociacion'. */
  nuevaRenta?: number;
  /** Fecha de efecto de la nueva renta (ISO date). Por defecto hoy. */
  fechaDesdeRenta?: string;
  nota?: string;
}

/**
 * Renueva un contrato: extiende `fechaFin` y, si la renta cambia, APENDA una
 * entrada `origen: 'renegociacion'` (que consumen tablero y timeline para
 * detectar renovaciones) manteniendo `rentaMensual` sincronizado. No modifica
 * entradas anteriores del histórico.
 */
export const renovarContrato = async (
  id: number,
  options: RenovarContratoOptions,
): Promise<void> => {
  const contract = await getContract(id);
  if (!contract) {
    throw new Error('Contract not found');
  }
  const updates: Partial<Contract> = {
    fechaFin: options.nuevaFechaFin,
    estadoContrato: 'activo',
  };
  if (options.nuevaRenta !== undefined && options.nuevaRenta !== contract.rentaMensual) {
    const entrada: HistoricoRenta = {
      fechaDesde: options.fechaDesdeRenta ?? hoyISO(),
      importe: options.nuevaRenta,
      origen: 'renegociacion',
    };
    if (options.nota !== undefined) entrada.nota = options.nota;
    updates.rentaMensual = options.nuevaRenta;
    updates.historicoRentas = [...(contract.historicoRentas ?? []), entrada];
  }
  await updateContract(id, updates);
};
