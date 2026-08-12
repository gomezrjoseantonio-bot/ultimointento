// Construcción del payload de contrato desde el estado del wizard. En `.ts`
// (sin JSX) para no engordar el componente. Dos modos:
//   · completo  · validación estricta para crear un contrato activo.
//   · borrador  · guarda lo que haya (estadoContrato 'sin_firmar'), sin exigir
//                 todos los campos · para no perder el trabajo a medias.

import type { Contract } from '../../../services/db';
import { calculateHabitualEndDate, FECHA_FIN_INDEFINIDO } from '../../../services/contractService';
import type { FormState } from './contratoWizardHelpers';

export type ContratoPayload = Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>;

export type PayloadResult =
  | { ok: true; payload: ContratoPayload }
  | { ok: false; error: string };

const inquilinoDe = (form: FormState): Contract['inquilino'] => ({
  nombre: form.inquilinoNombre.trim(),
  apellidos: form.inquilinoApellidos.trim(),
  dni: form.inquilinoNif.trim(),
  telefono: form.inquilinoTelefono.trim(),
  email: form.inquilinoEmail.trim(),
});

const unidadTipoDe = (form: FormState): 'vivienda' | 'habitacion' =>
  form.habitacionId ? 'habitacion' : 'vivienda';

/** Validación estricta · contrato activo. Devuelve error legible en vez de lanzar.
 *  `gestionPadreId` opcional · cuando se crea un subcontrato anexado a un
 *  contrato de gestión (gestión delegada · §4.4). */
export function construirPayloadCompleto(form: FormState, gestionPadreId?: number): PayloadResult {
  if (form.inmuebleId == null) return { ok: false, error: 'Debe seleccionar un inmueble' };
  const rentaMensual = Number(form.rentaMensual);
  const diaPago = Number(form.diaPago);
  const fianzaMeses = Number(form.fianzaMensualidades) || 0;
  if (!Number.isFinite(rentaMensual) || rentaMensual <= 0)
    return { ok: false, error: 'La renta mensual debe ser mayor que 0' };
  if (!Number.isFinite(diaPago) || diaPago < 1 || diaPago > 31)
    return { ok: false, error: 'El día de cobro debe estar entre 1 y 31' };
  if (!form.inquilinoTelefono.trim())
    return { ok: false, error: 'El teléfono del inquilino es obligatorio' };
  if (!form.inquilinoEmail.trim())
    return { ok: false, error: 'El email del inquilino es obligatorio' };
  const fechaFin =
    form.fechaFin.trim() ||
    (form.modalidad === 'habitual' ? calculateHabitualEndDate(form.fechaInicio) : '');
  if (!fechaFin) return { ok: false, error: 'La fecha de fin es obligatoria' };
  if (new Date(fechaFin) <= new Date(form.fechaInicio))
    return { ok: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };
  const cuentaCobroId = Number(form.cuentaCobroId);
  if (form.cuentaCobroId === '' || !Number.isFinite(cuentaCobroId))
    return { ok: false, error: 'Debe seleccionar la cuenta bancaria de cobro' };

  return {
    ok: true,
    payload: {
      inmuebleId: form.inmuebleId,
      unidadTipo: unidadTipoDe(form),
      habitacionId: form.habitacionId || undefined,
      modalidad: form.modalidad,
      inquilino: inquilinoDe(form),
      fechaInicio: form.fechaInicio,
      fechaFin,
      rentaMensual,
      diaPago,
      margenGraciaDias: 5,
      indexacion: form.indexacion,
      historicoIndexaciones: [],
      fianzaMeses,
      fianzaImporte: Math.round(rentaMensual * fianzaMeses),
      fianzaEstado: 'retenida',
      cuentaCobroId,
      estadoContrato: 'activo',
      documentoFirmado: true,
      ...(gestionPadreId != null ? { gestionPadreId } : {}),
      documents: [],
    } as ContratoPayload,
  };
}

/**
 * Borrador · guarda con lo que haya (defaults para lo que falte). El único
 * mínimo lo valida el llamante (inmueble + nombre, para que sea localizable en
 * la lista). Se marca `sin_firmar` para poder completarlo luego editándolo.
 */
export function construirPayloadBorrador(form: FormState, gestionPadreId?: number): ContratoPayload {
  const rentaMensual = Number(form.rentaMensual) || 0;
  const diaPago = Number(form.diaPago) || 1;
  const fianzaMeses = Number(form.fianzaMensualidades) || 0;
  const cuentaCobroId = Number(form.cuentaCobroId) || 0;
  const fechaInicio = form.fechaInicio || new Date().toISOString().slice(0, 10);
  const fechaFin = form.fechaFin.trim() || FECHA_FIN_INDEFINIDO;
  return {
    inmuebleId: form.inmuebleId ?? 0,
    unidadTipo: unidadTipoDe(form),
    habitacionId: form.habitacionId || undefined,
    modalidad: form.modalidad,
    inquilino: inquilinoDe(form),
    fechaInicio,
    fechaFin,
    rentaMensual,
    diaPago,
    margenGraciaDias: 5,
    indexacion: form.indexacion,
    historicoIndexaciones: [],
    fianzaMeses,
    fianzaImporte: Math.round(rentaMensual * fianzaMeses),
    fianzaEstado: 'retenida',
    cuentaCobroId,
    estadoContrato: 'sin_firmar',
    documentoFirmado: false,
    ...(gestionPadreId != null ? { gestionPadreId } : {}),
    documents: [],
  } as ContratoPayload;
}
