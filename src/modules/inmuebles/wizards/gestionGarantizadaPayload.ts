// Gestión delegada · construcción del payload del CONTRATO DE GESTIÓN (padre)
// desde el formulario. En `.ts` (sin JSX) para testearlo aislado.
// Ver docs/DISENO-gestion-delegada-agencias-V1.md.
//
// Modelo unificado: la vista fiscal es siempre ingresos + comisión + neto; el
// flujo de tesorería (liquidación) es ortogonal. Aquí se captura la config de
// la comisión (garantizada/%/fees) y la liquidación (A/B).
//
// El padre es NO-LAU (§4.5): `fechaFin` = plazo pactado (sin +5 de LAU), sin
// fianza LAU ni reducción; contraparte = la agencia; indexación mercantil
// (IPC · Otros · sin), nunca IRAV.

import type { Contract, HonorarioAgencia } from '../../../services/db';

/** Indexaciones válidas para un contrato mercantil de gestión (sin IRAV). */
export type IndexacionGestion = 'none' | 'ipc' | 'otros';

export interface GestionForm {
  inmuebleId: number | null;
  agenciaNombre: string;
  agenciaNif: string;
  /** Cómo se calcula la comisión de la agencia. */
  comisionTipo: 'garantizada' | 'porcentaje' | 'fees';
  /** Flujo de tesorería (quién cobra). */
  liquidacion: 'agencia_neto' | 'propietario_bruto';
  rentaGarantizada: string; // solo comisionTipo='garantizada'
  comisionPorcentaje: string; // solo comisionTipo='porcentaje'
  feeHabitacion: string; // solo comisionTipo='fees' · € por habitación / mes
  feeFijo: string; // solo comisionTipo='fees' · € fijo / mes
  /** Captación (honorario por inquilino nuevo) · solo en %/fees. */
  captacionTipo: 'ninguna' | 'fijo' | 'porcentaje';
  captacionValor: string; // € (fijo) o % de la renta del inquilino (porcentaje)
  fianza: string; // opcional · fianza que deja la agencia (€)
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

export function construirPayloadGestion(form: GestionForm): PayloadResult {
  if (form.inmuebleId == null) return { ok: false, error: 'Debe seleccionar un inmueble' };
  if (!form.agenciaNombre.trim()) return { ok: false, error: 'El nombre de la agencia es obligatorio' };
  if (!form.agenciaNif.trim()) return { ok: false, error: 'El NIF/CIF de la agencia es obligatorio' };

  // Comisión según el tipo. `rentaMensual` del padre = renta garantizada (o 0 en
  // %/fees, donde el ingreso viene de los subcontratos / la liquidación).
  let rentaMensual = 0;
  let rentaGarantizada: number | undefined;
  let comisionPorcentaje: number | undefined;
  const honorarios: HonorarioAgencia[] = [];

  if (form.comisionTipo === 'garantizada') {
    rentaGarantizada = Number(form.rentaGarantizada);
    if (!Number.isFinite(rentaGarantizada) || rentaGarantizada <= 0)
      return { ok: false, error: 'La renta garantizada debe ser mayor que 0' };
    rentaMensual = rentaGarantizada;
  } else if (form.comisionTipo === 'porcentaje') {
    comisionPorcentaje = Number(form.comisionPorcentaje);
    if (!Number.isFinite(comisionPorcentaje) || comisionPorcentaje <= 0 || comisionPorcentaje > 100)
      return { ok: false, error: 'El porcentaje de comisión debe estar entre 0 y 100' };
  } else {
    const feeHab = Number(form.feeHabitacion) || 0;
    const feeFijo = Number(form.feeFijo) || 0;
    if (feeHab <= 0 && feeFijo <= 0)
      return { ok: false, error: 'Indica al menos un honorario (fee por habitación o fee fijo)' };
    if (feeHab > 0)
      honorarios.push({ concepto: 'fee_habitacion', calculo: 'importe', base: 'habitacion', valor: feeHab, periodicidad: 'mensual' });
    if (feeFijo > 0)
      honorarios.push({ concepto: 'fee_fijo', calculo: 'importe', base: 'fijo', valor: feeFijo, periodicidad: 'mensual' });
  }

  // Captación (honorario por inquilino nuevo) · solo tiene sentido en %/fees:
  // en garantizada la comisión (Σ − garantizado) ya la absorbe.
  if (
    (form.comisionTipo === 'porcentaje' || form.comisionTipo === 'fees') &&
    form.captacionTipo !== 'ninguna'
  ) {
    const capVal = Number(form.captacionValor);
    if (!Number.isFinite(capVal) || capVal <= 0)
      return { ok: false, error: 'El honorario de captación debe ser mayor que 0' };
    if (form.captacionTipo === 'porcentaje' && capVal > 100)
      return { ok: false, error: 'El porcentaje de captación no puede superar el 100%' };
    honorarios.push({
      concepto: 'captacion',
      calculo: form.captacionTipo === 'porcentaje' ? 'porcentaje' : 'importe',
      base: form.captacionTipo === 'porcentaje' ? 'mensualidad' : 'fijo',
      valor: capVal,
      periodicidad: 'por_inquilino_nuevo',
    });
  }

  const diaPago = Number(form.diaPago);
  if (!Number.isFinite(diaPago) || diaPago < 1 || diaPago > 31)
    return { ok: false, error: 'El día de cobro debe estar entre 1 y 31' };

  if (!form.fechaInicio) return { ok: false, error: 'La fecha de inicio es obligatoria' };
  if (!form.fechaFin.trim()) return { ok: false, error: 'La fecha de fin (plazo pactado) es obligatoria' };
  if (new Date(form.fechaFin) <= new Date(form.fechaInicio))
    return { ok: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };

  if (form.indexacion === 'otros' && !form.indexacionFormula.trim())
    return { ok: false, error: 'Indica la fórmula o referencia de la indexación' };

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
    modalidad: 'larga_estancia',
    inquilino: { nombre: form.agenciaNombre.trim(), apellidos: '', dni: agenciaNif, telefono: '', email: '' },
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin.trim(),
    rentaMensual,
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
      modeloIngreso: form.comisionTipo === 'garantizada' ? 'garantizada' : 'traspaso',
      rentaGarantizada,
      honorarios,
      liquidacion: form.liquidacion,
      comisionTipo: form.comisionTipo,
      comisionPorcentaje,
    },
    documents: [],
  } as ContratoPayload;

  if (form.indexacion === 'otros') {
    payload.indexOtros = { formula: form.indexacionFormula.trim(), frecuencia: 'anual' };
  }

  return { ok: true, payload };
}
