// Gestión delegada · renta garantizada (Fase 1b). Construcción del payload del
// CONTRATO DE GESTIÓN (padre) desde el formulario. En `.ts` (sin JSX) para no
// engordar el componente y poder testearlo aislado.
//
// El padre es NO-LAU (ver docs/DISENO-gestion-delegada-agencias-V1.md §4.5):
//   · `fechaFin` = plazo pactado con la agencia, tal cual (SIN cálculo +5 de LAU).
//   · sin fianza LAU ni reducción fiscal.
//   · contraparte = la agencia (se guarda en `inquilino` para que el operativo
//     —ocupación, Tesorería— la reconozca; el enlace canónico es `gestion.agenciaNif`).
//   · lleva el bloque `gestion` que lo marca como contrato de gestión.

import type { Contract } from '../../../services/db';

export interface GestionGarantizadaForm {
  inmuebleId: number | null;
  agenciaNombre: string;
  agenciaNif: string;
  rentaGarantizada: string; // en € · string desde el input
  indexacion: 'none' | 'ipc' | 'irav' | 'otros';
  fechaInicio: string;
  fechaFin: string; // plazo pactado · obligatorio · sin auto +5
  diaPago: string;
  cuentaCobroId: string;
}

export type ContratoPayload = Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>;

export type PayloadResult =
  | { ok: true; payload: ContratoPayload }
  | { ok: false; error: string };

export function construirPayloadGestionGarantizada(form: GestionGarantizadaForm): PayloadResult {
  if (form.inmuebleId == null) return { ok: false, error: 'Debe seleccionar un inmueble' };
  if (!form.agenciaNombre.trim()) return { ok: false, error: 'El nombre de la agencia es obligatorio' };
  if (!form.agenciaNif.trim()) return { ok: false, error: 'El NIF/CIF de la agencia es obligatorio' };

  const rentaGarantizada = Number(form.rentaGarantizada);
  if (!Number.isFinite(rentaGarantizada) || rentaGarantizada <= 0)
    return { ok: false, error: 'La renta garantizada debe ser mayor que 0' };

  const diaPago = Number(form.diaPago);
  if (!Number.isFinite(diaPago) || diaPago < 1 || diaPago > 31)
    return { ok: false, error: 'El día de cobro debe estar entre 1 y 31' };

  if (!form.fechaInicio) return { ok: false, error: 'La fecha de inicio es obligatoria' };
  // NO-LAU · el fin es el plazo pactado, obligatorio y SIN cálculo automático +5.
  if (!form.fechaFin.trim()) return { ok: false, error: 'La fecha de fin (plazo pactado) es obligatoria' };
  if (new Date(form.fechaFin) <= new Date(form.fechaInicio))
    return { ok: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };

  const cuentaCobroId = Number(form.cuentaCobroId);
  if (form.cuentaCobroId === '' || !Number.isFinite(cuentaCobroId))
    return { ok: false, error: 'Debe seleccionar la cuenta bancaria de cobro' };

  const agenciaNif = form.agenciaNif.trim();

  return {
    ok: true,
    payload: {
      inmuebleId: form.inmuebleId,
      unidadTipo: 'vivienda',
      // `modalidad` no aplica LAU aquí; la presencia de `gestion` marca NO-LAU.
      modalidad: 'habitual',
      inquilino: {
        nombre: form.agenciaNombre.trim(),
        apellidos: '',
        dni: agenciaNif,
        telefono: '',
        email: '',
      },
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin.trim(),
      rentaMensual: rentaGarantizada,
      diaPago,
      margenGraciaDias: 5,
      indexacion: form.indexacion,
      historicoIndexaciones: [],
      // Sin fianza LAU en el contrato de gestión.
      fianzaMeses: 0,
      fianzaImporte: 0,
      fianzaEstado: 'retenida',
      cuentaCobroId,
      estadoContrato: 'activo',
      documentoFirmado: true,
      gestion: {
        agenciaNif,
        modeloIngreso: 'garantizada',
        rentaGarantizada,
        honorarios: [],
      },
      documents: [],
    } as ContratoPayload,
  };
}
