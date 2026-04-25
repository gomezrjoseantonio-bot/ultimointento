// ============================================================================
// ATLAS Personal · Modelo de datos exhaustivo v1.1 — Compromisos Recurrentes
// ============================================================================
//
// Catálogo universal de compromisos del hogar (suministro · suscripción · seguro
// · cuota · etc.). Schema único con discriminador `ambito` (G-01) que permite
// usar la misma entidad para personal e inmueble (sustituye el fragmentado
// `opexRules` + `patronGastosPersonales`).
//
// Cada compromiso da de alta UNA vez · genera N eventos en `treasuryEvents`
// (regla de oro #1).
// ============================================================================

// ─── Patrones de calendario (sección 2.1) ──────────────────────────────────

export type PatronRecurrente =
  | { tipo: 'mensualDiaFijo'; dia: number }
  | { tipo: 'mensualDiaRelativo'; referencia: ReferenciaDiaRelativo }
  | { tipo: 'cadaNMeses'; cadaNMeses: number; mesAncla: number; dia: number }
  | { tipo: 'trimestralFiscal'; diaPago: number }
  | { tipo: 'anualMesesConcretos'; mesesPago: number[]; diaPago: number }
  | { tipo: 'pagasExtra'; mesesExtra: number[]; referencia: ReferenciaDiaRelativo }
  | { tipo: 'variablePorMes'; mesesPago: number[]; importeObjetivoAnual: number }
  | { tipo: 'puntual'; fecha: string; importe: number };

export type ReferenciaDiaRelativo =
  | 'ultimoHabil'
  | 'primerHabil'
  | 'primerLunes'
  | 'segundoLunes'
  | 'tercerLunes'
  | 'ultimoLunes'
  | 'ultimoViernes'
  | 'primerViernes';

// ─── Importe (sección 2.2) ─────────────────────────────────────────────────

export type ImporteEvento =
  | { modo: 'fijo'; importe: number }
  | { modo: 'variable'; importeMedio: number }
  | { modo: 'diferenciadoPorMes'; importesPorMes: number[] /* 12 elementos · ene→dic */ }
  | { modo: 'porPago'; importesPorPago: Record<number, number> /* mes → importe */ };

// ─── Variación (sección 2.3) ───────────────────────────────────────────────

export type PatronVariacion =
  | { tipo: 'sinVariacion' }
  | { tipo: 'ipcAnual'; mesRevision: number; ultimoIpcAplicado?: number }
  | { tipo: 'aniversarioContrato'; mesAniversario: number; porcentajeAnual: number }
  | { tipo: 'manual' };

// ─── Tipos y categorías ────────────────────────────────────────────────────
//
// Restricción importante: la cuota de hipoteca · renta de alquiler · IBI ·
// comunidad y seguro de la vivienda HABITUAL NO existen como tipos válidos.
// Esos compromisos se derivan automáticamente de `viviendaHabitual` (sección
// 6, regla de oro #2).

export type TipoCompromiso =
  | 'suministro'    // luz · gas · agua · internet · móvil
  | 'suscripcion'   // streaming · prensa · software
  | 'seguro'        // hogar (NO vivienda habitual) · vida · salud · coche · otros
  | 'cuota'         // gimnasio · colegio profesional · ONG · membresía
  | 'comunidad'     // SOLO si NO es vivienda habitual ni inmueble de inversión (raro)
  | 'impuesto'      // SOLO si NO es vivienda habitual ni inmueble de inversión (raro)
  | 'otros';

// Subtipos sugeridos para `suministro` (categoryCatalog futuro):
//   'luz' | 'gas' | 'agua' | 'internet' | 'movil' | 'tv'

// ─── Categorías de gasto (sección 4) ────────────────────────────────────────
//
// Identificadores canónicos. La asignación a la bolsa 50/30/20 va aparte en
// `bolsaPresupuesto` para permitir reasignación sin tocar la categoría.

export type CategoriaGastoCompromiso =
  // Necesidades (50%)
  | 'vivienda.alquiler'
  | 'vivienda.hipoteca'
  | 'vivienda.suministros'
  | 'vivienda.comunidad'
  | 'vivienda.ibi'
  | 'vivienda.seguros'
  | 'alimentacion'
  | 'transporte'
  | 'salud'
  | 'educacion'
  // Deseos (30%)
  | 'ocio'
  | 'viajes'
  | 'suscripciones'
  | 'personal'
  | 'regalos'
  | 'tecnologia'
  // Ahorro+inversión (20%)
  | 'ahorro.aporteFondo'
  | 'ahorro.aportePension'
  | 'ahorro.amortizacionExtra'
  | 'ahorro.cuentaTarget'
  | 'ahorro.cajaLiquida'
  // Obligaciones fiscales (NO entran en 50/30/20)
  | 'obligaciones.irpfPagar'
  | 'obligaciones.irpfFraccionamiento'
  | 'obligaciones.m130'
  | 'obligaciones.reta'
  | 'obligaciones.cuotasProf'
  | 'obligaciones.multas'
  | 'obligaciones.donaciones'
  // Inmueble (cuando ambito='inmueble')
  | 'inmueble.opex'
  | 'inmueble.suministros'
  | 'inmueble.ibi'
  | 'inmueble.comunidad'
  | 'inmueble.seguros'
  | 'inmueble.gestionAlquiler'
  | 'inmueble.otros';

export type BolsaPresupuesto =
  | 'necesidades'
  | 'deseos'
  | 'ahorroInversion'
  | 'obligaciones'
  | 'inmueble'; // ambito='inmueble' no entra en 50/30/20 personal

export type ResponsableCompromiso = 'titular' | 'pareja' | 'hogarCompartido';
export type MetodoPagoCompromiso = 'domiciliacion' | 'transferencia' | 'tarjeta' | 'efectivo';
export type EstadoCompromiso = 'activo' | 'pausado' | 'baja';

// ─── Origen (cuando viene derivado de otra entidad) ────────────────────────

export interface OrigenCompromiso {
  fuente: 'viviendaHabitual' | 'manual' | 'importeCSV' | 'opexRule';
  refId?: string | number;
  bloqueado?: boolean; // si true · no se puede editar aquí · solo desde origen
}

// ─── Entidad principal ──────────────────────────────────────────────────────

export interface CompromisoRecurrente {
  id?: number;

  // Ámbito · personal o inmueble (decisión G-01)
  ambito: 'personal' | 'inmueble';
  inmuebleId?: number; // requerido si ambito='inmueble'
  personalDataId?: number; // requerido si ambito='personal'

  // Identificación
  alias: string;
  tipo: TipoCompromiso;
  subtipo?: string; // 'luz' | 'gas' | 'agua' | 'internet' | 'movil' | ...

  proveedor: {
    nombre: string;
    nif?: string;
    referencia?: string; // CUPS · ID póliza · número cliente
  };

  // Calendario (sección 2.1)
  patron: PatronRecurrente;

  // Importe (sección 2.2)
  importe: ImporteEvento;

  // Variación (sección 2.3)
  variacion?: PatronVariacion;

  // Vinculación operativa
  cuentaCargo: number; // accountId destino del cargo
  conceptoBancario: string; // texto que aparece en extracto · "IBERDROLA CLIENTES SA"
  metodoPago: MetodoPagoCompromiso;

  // Categorización
  categoria: CategoriaGastoCompromiso;
  bolsaPresupuesto: BolsaPresupuesto;
  responsable: ResponsableCompromiso;
  porcentajeTitular?: number; // 0-100 · si hogar compartido y % no es 50/50

  // Vigencia
  fechaInicio: string; // ISO date
  fechaFin?: string; // null si indefinido
  estado: EstadoCompromiso;
  motivoBaja?: string;

  // Origen
  derivadoDe?: OrigenCompromiso;

  // Auditoría
  createdAt: string;
  updatedAt: string;
  notas?: string;
}

// ─── Validación de creación (sección 6.5) ──────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  motivo?: string;
  redirigirA?: 'viviendaHabitual' | 'gastosInmueble';
}
