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
// `bizum` añadido (sección 2.8). NO existe "lo paga otra persona": si no mueve
// una cuenta propia no es una fila del presupuesto (decisión Jose).
export type MetodoPagoCompromiso =
  | 'domiciliacion'
  | 'transferencia'
  | 'tarjeta'
  | 'efectivo'
  | 'bizum';
// Los tres estados de la sección 2.3. `pausado` ELIMINADO (no convive con
// `preparado`). `preparado` = existe en el plan, nunca ha tenido un cargo · sin
// fecha · NO se proyecta. `baja` = se cobraba y dejó de llegar · lleva la fecha
// del último cobro en `fechaFin`.
export type EstadoCompromiso = 'activo' | 'preparado' | 'baja';

// Motivo de baja estructurado (sección 2.4). `cambioProveedor` BLOQUEA la
// reactivación (el viejo queda de baja para siempre y se crea uno nuevo).
export type MotivoBaja = 'cambioProveedor' | 'yaNoAplica' | 'finContrato' | 'otro';

// Familia fiscal (§3.2 · cómo cuenta el gasto en la previsión de impuestos). NO
// se pregunta: se DERIVA del concepto del catálogo. Sólo se guarda cuando el
// concepto es una excepción que pregunta (derrama · «Otro»), en el único campo
// opcional `familiaFiscalManual`. Ver utils/fiscalidadConcepto.
export type FamiliaFiscal =
  | 'comunidad'
  | 'ibi_tasas'
  | 'seguros'
  | 'suministros'
  | 'reparaciones_conservacion'
  | 'servicios_profesionales'
  | 'intereses_financiacion'
  | 'mejora'
  // Mobiliario y enseres · casilla 0117. No es «mejora»: la mejora amortiza al
  // 3 % sobre el valor del inmueble y el mobiliario al 10 % en diez años.
  | 'amortizacion_muebles'
  | 'no_deducible';

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
  tipo: TipoCompromiso;
  subtipo?: string; // 'luz' | 'gas' | 'agua' | 'internet' | 'movil' | ...

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

  // Familia fiscal ELEGIDA A MANO · SÓLO para conceptos que preguntan (derrama:
  // conservación vs mejora · «Otro»: sin catálogo que lo diga). La familia normal
  // se deriva del concepto y NO se persiste. Ausente = usa la del catálogo.
  familiaFiscalManual?: FamiliaFiscal;

  // Importe (sección 2.2)
  importe: ImporteEvento;

  // Variación (sección 2.3)
  variacion?: PatronVariacion;

  // Vinculación operativa
  cuentaCargo: number; // accountId destino del cargo
  conceptoBancario: string; // texto que aparece en extracto · "IBERDROLA CLIENTES SA"
  metodoPago: MetodoPagoCompromiso;
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

  // Categorización
  /**
   * QUÉ es este gasto · id del catálogo unificado (`services/conceptos`).
   *
   * Es el único campo de clasificación que se elige. `categoria`,
   * `bolsaPresupuesto` y `tipo` se DERIVAN de él según el ámbito
   * (`proyectar(concepto, ambito)`) y se siguen guardando por retrocompatibilidad
   * con todo lo que hoy los lee.
   *
   * Sustituye al par (`tipoFamilia`, `subtipo`), que se conserva mientras quede
   * código leyéndolo. Ausente = registro anterior a la unificación que la
   * migración no supo traducir; hay que revisarlo a mano, no adivinarlo.
   *
   * Campo opcional sin índice · no mueve `DB_VERSION`.
   */
  concepto?: string;
  categoria: string; // normalizado a "familia.subfamilia" en T38; retrocompatible con CategoriaGastoCompromiso legacy
  // Fase 3 vivienda habitual · SOLO relevante en ámbito personal con categoria
  // 'vivienda.alquiler': marca si este alquiler es el de la vivienda habitual
  // del titular (alimenta la deducción autonómica por alquiler). Semántica
  // default-true: `undefined` cuenta como vivienda habitual; `false` explícito
  // la excluye (alquiler de otra cosa: trastero, segunda vivienda…).
  esViviendaHabitual?: boolean;
  bolsaPresupuesto: BolsaPresupuesto;
  tipoFamilia?: string; // T38: familia real ('vivienda' | 'suministros' | 'dia_a_dia' | 'suscripciones' | 'seguros_cuotas' | 'otros' | 'tributos' | 'comunidad' | 'seguros' | 'gestion' | 'reparacion')
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
