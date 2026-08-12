// Gestión delegada · Fase 2 · construir el payload de un SUBCONTRATO de inquilino
// anexado a un contrato de gestión (padre). Es un registro mínimo de lo que la
// agencia reporta —NO un contrato LAU del propietario—: solo nombre, fechas y
// renta. Sin DNI/teléfono/email, sin fianza, sin cuenta de cobro (al inquilino
// le cobra la agencia, no el propietario), sin firma.

import type { Contract } from '../../../services/db';

export interface AnexarSubcontratoForm {
  nombre: string;
  apellidos: string;
  dni: string; // opcional · se permite pero no se exige
  habitacionId: string; // '' si el piso es completo
  fechaInicio: string;
  fechaFin: string;
  rentaMensual: string;
}

export type ContratoPayload = Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>;

export type PayloadResult =
  | { ok: true; payload: ContratoPayload }
  | { ok: false; error: string };

export function construirPayloadSubcontrato(
  form: AnexarSubcontratoForm,
  padre: Contract & { id: number },
): PayloadResult {
  if (!form.nombre.trim()) return { ok: false, error: 'El nombre del inquilino es obligatorio' };

  const rentaMensual = Number(form.rentaMensual);
  if (!Number.isFinite(rentaMensual) || rentaMensual <= 0)
    return { ok: false, error: 'La renta debe ser mayor que 0' };

  if (!form.fechaInicio) return { ok: false, error: 'La fecha de inicio es obligatoria' };
  if (!form.fechaFin) return { ok: false, error: 'La fecha de fin es obligatoria' };
  if (new Date(form.fechaFin) <= new Date(form.fechaInicio))
    return { ok: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };

  const habitacionId = form.habitacionId.trim();

  return {
    ok: true,
    payload: {
      inmuebleId: padre.inmuebleId,
      unidadTipo: habitacionId ? 'habitacion' : 'vivienda',
      habitacionId: habitacionId || undefined,
      modalidad: 'habitual',
      inquilino: {
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        dni: form.dni.trim(),
        telefono: '',
        email: '',
      },
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      rentaMensual,
      diaPago: padre.diaPago ?? 1,
      margenGraciaDias: 5,
      indexacion: 'none',
      historicoIndexaciones: [],
      // Sin fianza · el inquilino no deja fianza al propietario.
      fianzaMeses: 0,
      fianzaImporte: 0,
      fianzaEstado: 'retenida',
      // Al inquilino le cobra la agencia · no hay cuenta de cobro del propietario.
      cuentaCobroId: 0,
      estadoContrato: 'activo',
      // Sin workflow de firma · lo firma la agencia en nombre del propietario.
      documentoFirmado: true,
      gestionPadreId: padre.id,
      documents: [],
    } as ContratoPayload,
  };
}
