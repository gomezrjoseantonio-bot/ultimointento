// Tipos compartidos del módulo Financiación (v5).
// Reflejan filas de presentación que consumen tabs y subpáginas.
//
// Los tipos del modelo (Prestamo · DestinoCapital · Garantía · etc.) viven en
// `src/types/prestamos.ts` y NO se duplican aquí.

import type { Prestamo } from '../../types/prestamos';

/** Paleta de logos por banco (mockup atlas-financiacion-v2). */
export type BankPalette = {
  bg: string;
  fg: string;
  abbr: string;
};

/** Tipo lógico mostrado en chips · "Hipoteca" · "Personal" · "Pignoraticia". */
export type LoanKind = 'hipoteca' | 'personal' | 'pignora' | 'otro';

/** Fila de presentación · síntesis del préstamo para tablas y cards. */
export interface LoanRow {
  id: string;
  alias: string;
  banco: string;
  kind: LoanKind;
  principalInicial: number;
  capitalVivo: number;
  amortizado: number;
  porcentajeAmortizado: number;
  cuotaMensual: number;
  tin: number;
  fechaFirma: string | null;
  fechaVencimiento: string | null;
  cuotasRestantes: number;
  destinosResumen: string;
  garantiasResumen: string;
  intDeducibles: number;
  intDeduciblesPct: number;
  /** Prestamo subyacente (referencia · NO mutar). */
  raw: Prestamo;
}
