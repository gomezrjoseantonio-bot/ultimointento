// ============================================================================
// ATLAS Personal · Modelo de datos exhaustivo v1.1 — Vivienda Habitual
// ============================================================================
//
// Ficha única de la vivienda donde vive el hogar. Se da de alta UNA vez y
// genera automáticamente los eventos derivados en `treasuryEvents` (alquiler ·
// hipoteca · IBI · comunidad · seguros). Regla de oro #2 · NUNCA se da de
// alta el alquiler · cuota hipoteca · IBI · comunidad o seguro hogar de la
// vivienda habitual como compromiso recurrente independiente.
//
// La vivienda HABITUAL es distinta del inmueble de inversión (módulo
// Inmuebles · `properties`). Esta ficha es de Personal.
// ============================================================================

// ─── Sub-objetos comunes ────────────────────────────────────────────────────

export interface DireccionVivienda {
  calle: string;
  numero?: string;
  piso?: string;
  municipio: string;
  provincia?: string;
  cp: string;
  ccaa?: string;
  referenciaCatastral?: string;
}

export interface DatosCatastrales {
  referenciaCatastral: string;
  valorCatastral: number;
  valorCatastralConstruccion?: number;
  superficie: number;
  porcentajeTitularidad: number; // 100 si privativa · 50 si gananciales
  catastralRevisado?: boolean;
}

export interface DatosAdquisicion {
  fecha: string; // ISO date
  precio: number;
  gastosAdquisicion: number;
  mejorasAcumuladas: Array<{
    fecha: string;
    descripcion: string;
    importe: number;
  }>;
}

export interface ItemAnualSimple {
  importeAnual: number;
  mesPago: number; // 1-12
  diaPago: number; // 1-31
}

export interface ItemMensualSimple {
  importe: number;
  diaCargo: number; // 1-31
}

export interface ItemIBI {
  importeAnual: number;
  mesesPago: number[]; // ej. [6, 11] · 50/50
  importesPorPago?: Record<number, number>; // si distinto al 50/50 · mes → importe
  diaPago: number;
}

export interface SegurosVivienda {
  hogar?: ItemAnualSimple;
  vida?: ItemAnualSimple;
}

// ─── Caso A · Inquilino (sección 6.2) ──────────────────────────────────────

export interface ContratoArrendamiento {
  arrendador: { nombre: string; nif?: string };
  fechaFirma: string;
  vigenciaDesde: string;
  vigenciaHasta: string; // 5 años LAU
  rentaMensual: number;
  diaCobro: number; // día del mes en que se carga
  fianza: number;
  garantiasAdicionales?: number;
  revisionIPC: { aplica: boolean; mesRevision?: number };
  gastosIncluidos: string[]; // ej. ['comunidad'] · qué entra ya en la renta
}

export interface ViviendaHabitualInquilino {
  tipo: 'inquilino';
  direccion: DireccionVivienda;
  contrato: ContratoArrendamiento;
  cuentaCargo: number; // accountId
  conceptoBancarioEsperado: string;
}

// ─── Caso B · Propietario sin hipoteca (sección 6.3) ────────────────────────

export interface ViviendaHabitualPropietario {
  tipo: 'propietarioSinHipoteca';
  direccion: DireccionVivienda;
  catastro: DatosCatastrales;
  adquisicion: DatosAdquisicion;
  comunidad?: ItemMensualSimple;
  ibi: ItemIBI;
  seguros: SegurosVivienda;
  cuentaCargo: number;
}

// ─── Caso C · Propietario con hipoteca (sección 6.4) ────────────────────────

export interface ViviendaHabitualHipoteca {
  tipo: 'propietarioConHipoteca';
  direccion: DireccionVivienda;
  catastro: DatosCatastrales;
  adquisicion: DatosAdquisicion;
  comunidad?: ItemMensualSimple;
  ibi: ItemIBI;
  seguros: SegurosVivienda;
  cuentaCargo: number;
  hipoteca: {
    prestamoId: string | number; // ref a `prestamos` · NO se duplica el cuadro de amortización
  };
  beneficioFiscal?: {
    aplica: boolean; // solo hipotecas anteriores a 31/12/2012
    porcentajeDeduccion?: number; // 15% estatal · variable autonómico
  };
}

// ─── Unión discriminada ─────────────────────────────────────────────────────

export type ViviendaHabitualData =
  | ViviendaHabitualInquilino
  | ViviendaHabitualPropietario
  | ViviendaHabitualHipoteca;

export interface ViviendaHabitual {
  id?: number;
  personalDataId: number; // FK a `personalData`
  data: ViviendaHabitualData;

  // Vigencia
  vigenciaDesde: string; // ISO date · cuándo el hogar pasó a vivir aquí
  vigenciaHasta?: string; // null si actual

  activa: boolean;
  createdAt: string;
  updatedAt: string;
  notas?: string;
}
