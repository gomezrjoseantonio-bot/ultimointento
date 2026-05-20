// src/types/valoracionActivo.ts
// T-VALORACIONES PR1 · tipos del store polimórfico `valoracionesActivos` (v74).
//
// Naming · `TipoActivoValoracion` (NO `TipoActivo`) para evitar colisión con
// `src/types/tipoActivo.ts` que define el subtipo de inmueble (piso/parking/...).

export type TipoActivoValoracion =
  | 'inmueble'
  | 'inversion'
  | 'plan_pensiones'
  | 'deposito'
  | 'otro';

export type SubtipoInversion =
  | 'fondo'
  | 'accion'
  | 'etf'
  | 'crypto';

export type OrigenValoracion =
  | 'manual'
  | 'import_csv'
  | 'import_pdf'
  | 'api_gestora'
  | 'seed_migracion_v74'    // PR1 · transformación store anterior
  | 'seed_legacy_field_v74' // PR4-6 · campos legacy embebidos
  | 'cierre_anual';

export interface ValoracionActivo {
  id: number;                          // autoIncrement
  activoId: string;                    // FORZADO string (Q6 · UUID o stringify del id numérico)
  tipoActivo: TipoActivoValoracion;
  subtipoInversion?: SubtipoInversion; // solo si tipoActivo === 'inversion'
  fecha: string;                       // ISO YYYY-MM-DD (Q4)
  valor: number;                       // en EUR
  divisaOriginal?: string;             // 'EUR' | 'USD' | 'BTC' | ...
  valorDivisaOriginal?: number;
  origen: OrigenValoracion;
  notas?: string;
  archivoOrigenId?: number;            // FK a `documents` store
  esAnchorFiscal?: boolean;            // true · valor pericial fiscal (tasación)
  createdAt: string;                   // ISO datetime
  updatedAt: string;                   // ISO datetime
  deletedAt?: string | null;           // soft delete
}

export interface ValoracionInput {
  activoId: string;
  tipoActivo: TipoActivoValoracion;
  subtipoInversion?: SubtipoInversion;
  fecha: string;
  valor: number;
  origen: OrigenValoracion;
  divisaOriginal?: string;
  valorDivisaOriginal?: number;
  notas?: string;
  archivoOrigenId?: number;
  esAnchorFiscal?: boolean;
}

/**
 * Valida invariantes del input antes de persistir.
 *
 * Reglas:
 * - `subtipoInversion` solo permitido cuando `tipoActivo === 'inversion'`
 * - `fecha` debe ser YYYY-MM-DD estricto
 * - `valor` debe ser número finito
 * - `activoId` debe ser string no vacío
 */
export function validateValoracionInput(input: ValoracionInput): void {
  if (input.subtipoInversion && input.tipoActivo !== 'inversion') {
    throw new Error('subtipoInversion solo permitido si tipoActivo === "inversion"');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    throw new Error(`fecha debe ser YYYY-MM-DD · recibido "${input.fecha}"`);
  }
  if (typeof input.valor !== 'number' || !Number.isFinite(input.valor)) {
    throw new Error(`valor debe ser número finito · recibido ${input.valor}`);
  }
  if (!input.activoId || typeof input.activoId !== 'string') {
    throw new Error('activoId debe ser string no vacío');
  }
}
