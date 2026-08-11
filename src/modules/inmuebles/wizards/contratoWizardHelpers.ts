// Helpers del wizard de contratos (alta y edición). Extraídos del componente
// para mantener `NuevoContratoWizard.tsx` por debajo del umbral de 800 líneas.

import type { Contract } from '../../../services/db';

export interface FormState {
  inmuebleId: number | null;
  habitacionId: string;
  modalidad: 'habitual' | 'temporada' | 'vacacional';
  fechaInicio: string;
  fechaFin: string;
  inquilinoNombre: string;
  inquilinoApellidos: string;
  inquilinoNif: string;
  inquilinoEmail: string;
  inquilinoTelefono: string;
  rentaMensual: string;
  diaPago: string;
  fianzaMensualidades: string;
  indexacion: 'none' | 'ipc' | 'irav' | 'otros';
  /** Id (como string, para el <select>) de la cuenta bancaria de cobro. */
  cuentaCobroId: string;
}

/**
 * FIX P3 · convierte un string date-only "YYYY-MM-DD" en un Date construido con
 * componentes LOCALES. Evita el off-by-one de `new Date("YYYY-MM-DD")` (que se
 * parsea como medianoche UTC y al formatear en TZ local cae al día anterior),
 * dejando el resumen en vivo SIEMPRE en el mismo día que el campo. Local al
 * wizard · no se toca `DateLabel` (global).
 */
export const toLocalDate = (iso: string): Date | null => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const emptyForm: FormState = {
  inmuebleId: null,
  habitacionId: '',
  modalidad: 'habitual',
  fechaInicio: new Date().toISOString().slice(0, 10),
  fechaFin: '',
  inquilinoNombre: '',
  inquilinoApellidos: '',
  inquilinoNif: '',
  inquilinoEmail: '',
  inquilinoTelefono: '',
  rentaMensual: '',
  diaPago: '1',
  fianzaMensualidades: '2',
  indexacion: 'ipc',
  cuentaCobroId: '',
};

// Edición · mapea un contrato persistido al estado del formulario (prefill).
export const contratoAForm = (c: Contract): FormState => ({
  inmuebleId: c.inmuebleId ?? null,
  habitacionId: c.habitacionId ?? '',
  modalidad: (c.modalidad as FormState['modalidad']) ?? 'habitual',
  fechaInicio: c.fechaInicio || emptyForm.fechaInicio,
  fechaFin: c.fechaFin ?? '',
  inquilinoNombre: c.inquilino?.nombre ?? '',
  inquilinoApellidos: c.inquilino?.apellidos ?? '',
  inquilinoNif: c.inquilino?.dni ?? '',
  inquilinoEmail: c.inquilino?.email ?? '',
  inquilinoTelefono: c.inquilino?.telefono ?? '',
  rentaMensual: c.rentaMensual != null ? String(c.rentaMensual) : '',
  diaPago: c.diaPago != null ? String(c.diaPago) : '1',
  fianzaMensualidades: c.fianzaMeses != null ? String(c.fianzaMeses) : '2',
  indexacion: (c.indexacion as FormState['indexacion']) ?? 'ipc',
  cuentaCobroId: c.cuentaCobroId != null ? String(c.cuentaCobroId) : '',
});
