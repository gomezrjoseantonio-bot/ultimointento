// Gestión delegada · renta garantizada. Construcción del payload del CONTRATO
// DE GESTIÓN (padre) desde el formulario. En `.ts` (sin JSX) para testearlo
// aislado. Ver docs/DISENO-gestion-delegada-agencias-V1.md.
//
// El padre es NO-LAU (§4.5):
//   · `fechaFin` = plazo pactado con la agencia, tal cual (SIN cálculo +5 de LAU).
//   · sin fianza LAU ni reducción fiscal.
//   · contraparte = la agencia (se guarda en `inquilino` para que el operativo
//     —ocupación, Tesorería— la reconozca; el enlace canónico es `gestion.agenciaNif`).
//   · indexación mercantil: IPC · Otros (fórmula libre) · sin indexación. NUNCA IRAV.

import type { Contract } from '../../../services/db';

/** Indexaciones válidas para un contrato mercantil de gestión (sin IRAV). */
export type IndexacionGestion = 'none' | 'ipc' | 'otros';

export interface GestionGarantizadaForm {
  inmuebleId: number | null;
  agenciaNombre: string;
  agenciaNif: string;
  rentaGarantizada: string; // en € · string desde el input
  fianza: string; // opcional · importe de fianza que deja la agencia (€)
  indexacion: IndexacionGestion;
  indexacionFormula: string; // solo si indexacion === 'otros'
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

  if (form.indexacion === 'otros' && !form.indexacionFormula.trim())
    return { ok: false, error: 'Indica la fórmula o referencia de la indexación' };

  // Fianza opcional (algunas agencias la dejan, otras no).
  const fianzaImporte = form.fianza.trim() === '' ? 0 : Number(form.fianza);
  if (!Number.isFinite(fianzaImporte) || fianzaImporte < 0)
    return { ok: false, error: 'La fianza no puede ser negativa' };

  const cuentaCobroId = Number(form.cuentaCobroId);
  if (form.cuentaCobroId === '' || !Number.isFinite(cuentaCobroId))
    return { ok: false, error: 'Debe seleccionar la cuenta bancaria de cobro' };

  const agenciaNif = form.agenciaNif.trim();

  const payload: ContratoPayload = {
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
    fianzaMeses: 0,
    fianzaImporte,
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
  } as ContratoPayload;

  if (form.indexacion === 'otros') {
    payload.indexOtros = { formula: form.indexacionFormula.trim(), frecuencia: 'anual' };
  }

  return { ok: true, payload };
}
