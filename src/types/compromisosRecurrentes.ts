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

import type { FamiliaId, MetodoPago } from '../services/catalogo/catalogoUnico';

// ─── Patrones de calendario (sección 2.1) ──────────────────────────────────

export type PatronRecurrente =
  | { tipo: 'mensualDiaFijo'; dia: number }
  | { tipo: 'mensualDiaRelativo'; referencia: ReferenciaDiaRelativo }
  | { tipo: 'cadaNMeses'; cadaNMeses: number; mesAncla: number; dia: number }
  | { tipo: 'trimestralFiscal'; diaPago: number }
  // Meses concretos del año (IBI de junio y noviembre, seguro anual…).
  //
  // `diaPagoPorMes` deja que cada mes cargue SU día: el IBI de Asturias llega
  // el 15 de junio y el 11 de noviembre, no el mismo día las dos veces. Es
  // opcional y `diaPago` sigue siendo el respaldo — un patrón guardado antes de
  // que existiera se comporta igual que antes.
  //
  // El día vive AQUÍ y no en el importe a propósito: las fechas de las
  // previsiones salen de expandir el patrón, y el importe solo responde «cuánto
  // toca en esta fecha». Ponerlo en los dos sitios sería el mismo dato con dos
  // dueños.
  | {
      tipo: 'anualMesesConcretos';
      mesesPago: number[];
      diaPago: number;
      diaPagoPorMes?: Record<number, number> /* mes (1-12) → día · respaldo: `diaPago` */;
    }
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
  | { modo: 'porPago'; importesPorPago: Record<number, number> /* mes → importe */ }
  // Por tramos · la cuota cambia en una fecha (ej. gas: 56 € hasta mayo, 38 €
  // desde junio). Se aplica el tramo cuyo `desde` (ISO date) es el más reciente
  // ≤ la fecha del cargo. Sección 2.6.
  | { modo: 'porTramos'; tramos: Array<{ desde: string; importe: number }> }
  // Porcentaje de la renta · gestión del alquiler, comisiones de plataforma. El
  // importe se resuelve con la renta del contrato del inmueble (contexto que NO
  // tiene `calcularImporte`; lo aporta el consumidor con acceso al contrato ·
  // sección 2.6). Sin ese contexto no se proyecta cifra.
  | { modo: 'porcentajeRenta'; porcentaje: number /* 0-100 */ };

// ─── Variación (sección 2.3) ───────────────────────────────────────────────

export type PatronVariacion =
  | { tipo: 'sinVariacion' }
  | { tipo: 'ipcAnual'; mesRevision: number; ultimoIpcAplicado?: number }
  | { tipo: 'aniversarioContrato'; mesAniversario: number; porcentajeAnual: number }
  | { tipo: 'manual' };

// ─── Clasificación · los 4 ejes del catálogo único (E2.4.1c) ───────────────
//
// Un compromiso recurrente es SIEMPRE un gasto (naturaleza fija); su categoría
// es `familia` + `subtipo` del catálogo único; el método es `metodoPago`; el
// ámbito es `ambito` + `inmuebleId`. Los árboles viejos (`TipoCompromiso`,
// `CategoriaGastoCompromiso`, el concepto unificado y su proyección) y la bolsa
// 50/30/20 se retiraron: la fiscalidad la pone la lente (`fiscal/lenteFiscal`)
// leyendo familia + subtipo + ámbito, no un campo guardado.
//
// Restricción que sigue: la cuota de hipoteca NO se crea como compromiso · la
// genera Financiación (`prestamo_hipoteca` es de los eventos, no de aquí).

export type ResponsableCompromiso = 'titular' | 'pareja' | 'hogarCompartido';
// El método de pago es el eje 3 del catálogo único (E2.4.1): un solo
// vocabulario para recurrentes y movimientos. NO existe "lo paga otra persona":
// si no mueve una cuenta propia no es una fila del presupuesto (decisión Jose).
// Los tres estados de la sección 2.3. `pausado` ELIMINADO (no convive con
// `preparado`). `preparado` = existe en el plan, nunca ha tenido un cargo · sin
// fecha · NO se proyecta. `baja` = se cobraba y dejó de llegar · lleva la fecha
// del último cobro en `fechaFin`.
export type EstadoCompromiso = 'activo' | 'preparado' | 'baja';

// Motivo de baja estructurado (sección 2.4). `cambioProveedor` BLOQUEA la
// reactivación (el viejo queda de baja para siempre y se crea uno nuevo).
export type MotivoBaja = 'cambioProveedor' | 'yaNoAplica' | 'finContrato' | 'otro';

// Reparto de un mismo recibo entre varios inmuebles (sección 2.7 · embebido, no
// store aparte · decisión Jose). Se guarda el importe COMPLETO del recibo en el
// compromiso; el reparto solo se usa al declarar. Cada línea lleva `porcentaje`
// (0-100) O `importe` fijo; el total debe cuadrar al 100 % o al importe completo
// (se valida al guardar).
export interface RepartoInmueble {
  inmuebleId: number;
  porcentaje?: number;
  importe?: number;
}

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

  proveedor: {
    nombre: string;
    nif?: string;
    referencia?: string; // legacy · CUPS/póliza/cliente mezclados (retrocompat)
  };

  // Identificadores que permiten cuadrar la factura aunque cambie la compañía
  // (sección 3.2 · campos editables separados). `referencia` (arriba) se
  // conserva por retrocompat; los nuevos son la fuente canónica.
  cups?: string;
  numeroContrato?: string; // número de contrato o póliza

  // Calendario (sección 2.1)
  patron: PatronRecurrente;

  // Día del cargo "no lo sé todavía" (sección 2.2): cuando es true, el cargo se
  // proyecta a mitad de mes (día 15) porque aún no se conoce el día real.
  diaCargoIncierto?: boolean;

  // Margen de gracia en días (sección 3.2): tolerancia al cuadrar el cargo real
  // contra la fecha prevista.
  margenGraciaDias?: number;

  // Importe (sección 2.2)
  importe: ImporteEvento;

  // Variación (sección 2.3)
  variacion?: PatronVariacion;

  // Vinculación operativa
  cuentaCargo: number; // accountId destino del cargo
  conceptoBancario: string; // texto que aparece en extracto · "IBERDROLA CLIENTES SA"
  metodoPago: MetodoPago;
  /**
   * Con qué TARJETA se paga · solo cuando `metodoPago === 'tarjeta'`
   * (docs/VOCABULARIO-dinero.md §3).
   *
   * «Tarjeta» a secas no dice de dónde sale el dinero, y por eso el cargo
   * acababa apuntando a la cuenta que estuviera elegida a mano — la Carrefour
   * contra Santander cuando su recibo lo paga Bankinter. Con la tarjeta dicha,
   * `cuentaCargo` deja de elegirse: es su cuenta de liquidación.
   *
   * Campo opcional sin índice · no mueve `DB_VERSION`.
   */
  tarjetaId?: number;

  // Categorización · eje 2 del catálogo único · ausente = sin clasificar.
  familia?: FamiliaId;
  subtipo?: string;
  // Fase 3 vivienda habitual · SOLO relevante en ámbito personal con familia
  // `alquiler_renting` · `vivienda`: marca si este alquiler es el de la vivienda
  // habitual del titular (alimenta la deducción autonómica por alquiler).
  // Semántica default-true: `undefined` cuenta como vivienda habitual; `false`
  // explícito la excluye (alquiler de otra cosa: trastero, segunda vivienda…).
  esViviendaHabitual?: boolean;
  responsable: ResponsableCompromiso;
  porcentajeTitular?: number; // 0-100 · si hogar compartido y % no es 50/50

  // Reparto de un mismo recibo entre varios inmuebles (sección 2.7). Si está
  // presente, `importe` es el importe COMPLETO del recibo y `reparto` dice cómo
  // se atribuye a cada inmueble al declarar. Ausente = gasto de un solo inmueble.
  reparto?: RepartoInmueble[];

  // Vigencia
  fechaInicio: string; // ISO date
  fechaFin?: string; // null si indefinido
  estado: EstadoCompromiso;
  motivoBaja?: MotivoBaja;

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
