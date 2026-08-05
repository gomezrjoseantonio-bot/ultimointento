// Préstamos - Comprehensive Loan Data Models
// Following the requirements from the problem statement

// ── DestinoCapital ─────────────────────────────────────────────────────────
// Para qué se pide el dinero — determina fiscalidad (no la garantía)

export interface DestinoCapital {
  id: string;                         // uuid corto
  tipo: 'ADQUISICION'                 // comprar un inmueble
      | 'REFORMA'                     // reformar un inmueble
      | 'CANCELACION_DEUDA'           // cancelar otro préstamo/deuda
      | 'INVERSION'                   // financiar inversión mobiliaria
      | 'PERSONAL'                    // gasto personal (no deducible)
      | 'OTRA';

  // Vinculación al activo (según tipo)
  inmuebleId?: string;                // si ADQUISICION o REFORMA
  inversionId?: string;               // si INVERSION
  prestamoIdCancelado?: string;       // si CANCELACION_DEUDA

  importe: number;                    // € destinados a este fin
  porcentaje?: number;                // calculado: importe / principalInicial * 100
  descripcion?: string;               // texto libre: "Compra Tenderina 48"
}

// ── Garantia ───────────────────────────────────────────────────────────────
// Qué responde si no pagas — informativa, NO afecta fiscalidad

export interface Garantia {
  tipo: 'HIPOTECARIA'                 // un inmueble responde
      | 'PERSONAL'                    // la persona responde
      | 'PIGNORATICIA';               // un activo financiero responde

  // Vinculación al activo que garantiza
  inmuebleId?: string;                // si HIPOTECARIA
  inversionId?: string;               // si PIGNORATICIA (fondo, PP, depósito)

  descripcion?: string;               // "Buigas 15 Sant Fruitós" o "Plan pensiones Orange"
}

export interface Prestamo {
  id: string;
  ambito: 'PERSONAL' | 'INMUEBLE';
  // NOTE: ambito se CALCULA de destinos:
  //   Si algún destino tiene inmuebleId → 'INMUEBLE'
  //   Si ninguno → 'PERSONAL'

  // ── NUEVO v2: Destino y Garantía ─────────────────────────────────────────
  /**
   * Para qué se pide el dinero — determina fiscalidad.
   * sum(destinos[].importe) debe === principalInicial.
   * Si vacío → usar inmuebleId/afectacionesInmueble como fallback (legacy).
   */
  destinos?: DestinoCapital[];
  /**
   * Qué responde si no pagas — informativo, NO afecta cálculos fiscales.
   */
  garantias?: Garantia[];

  // ── LEGACY (mantener para migración, no usar en código nuevo) ────────────
  /** @deprecated Usar destinos[].inmuebleId */
  inmuebleId?: string;
  /**
   * @deprecated Usar destinos[] con un DestinoCapital por cada inmueble.
   * Distribución opcional del préstamo entre varios inmuebles.
   */
  afectacionesInmueble?: AfectacionInmueblePrestamo[];
  /**
   * @deprecated Usar destinos[].tipo
   * Finalidad económica principal del préstamo.
   */
  finalidad?: 'ADQUISICION' | 'REFORMA' | 'INVERSION' | 'PERSONAL' | 'OTRA';

  nombre: string;

  principalInicial: number;
  principalVivo: number;

  fechaFirma: string;           // ISO date (e.g., 2025-08-10)
  fechaPrimerCargo: string;     // ISO date of first payment charge
  plazoMesesTotal: number;      // original contractual term

  diaCargoMes: number;          // 1-28
  esquemaPrimerRecibo: 'NORMAL' | 'SOLO_INTERESES' | 'PRORRATA';

  tipo: 'FIJO' | 'VARIABLE' | 'MIXTO';
  sistema: 'FRANCES';

  /**
   * Cómo cuenta los días el banco al liquidar intereses (§6 bis · bis).
   *
   * `interés = capital × TIN × días ÷ base`, y la base es una CLÁUSULA de la
   * escritura: `ACT/360` —la clásica española, un 1,39 % más cara—, `ACT/365`
   * o `30/360`, el mes comercial.
   *
   * Ausente = `30/360`, que es lo que ATLAS venía haciendo. No se presume la
   * clásica aunque sea la más habitual: movería el cuadro de todo lo ya
   * guardado, y presumir una cláusula que nadie ha leído es inventarse un dato.
   */
  baseCalculoIntereses?: BaseCalculoIntereses;

  // FIJO
  tipoNominalAnualFijo?: number; // 3.2 for 3.2%

  // VARIABLE
  indice?: 'EURIBOR' | 'OTRO';
  valorIndiceActual?: number;   // 0.025
  diferencial?: number;         // 0.012
  periodoRevisionMeses?: number; // 6 or 12
  fechaProximaRevision?: string;
  /**
   * Las revisiones del índice que YA ocurrieron · §6 bis · bis.
   *
   * Cada una dice desde qué día el banco aplicó qué valor del índice, tal como
   * viene en su carta. Son HECHOS, y sin ellas el cuadro de una variable de
   * hace años se genera entero al índice de hoy: una hipoteca firmada con el
   * Euríbor al 0 % y revisada al 4 % diría que sus cuotas pasadas fueron las de
   * ahora, y de ahí salen los intereses de cada ejercicio.
   *
   * Lo que viene DESPUÉS de la última apuntada no se proyecta a otro tipo: se
   * sabe cuándo revisa el banco, no a cuánto, y un índice inventado se lee
   * igual que uno real.
   */
  revisionesDeTipo?: RevisionDelIndice[];

  // MIXTO
  tramoFijoMeses?: number;
  tipoNominalAnualMixtoFijo?: number;

  /**
   * La carencia inicial · el periodo en que NO se amortiza capital (§6 bis·ter).
   *
   * `CAPITAL` paga solo los intereses del mes y el capital se queda quieto.
   * `TOTAL` no paga nada y los intereses **se capitalizan**: al acabar se debe
   * más de lo que se pidió.
   *
   * No confundir con `carenciaTecnica`, que **no es una carencia**: son los
   * días sueltos entre la firma y el primer mes de cobro.
   */
  carencia: 'NINGUNA' | 'CAPITAL' | 'TOTAL';
  /** Cuántos meses dura · van DENTRO del plazo total, no se suman a él. */
  carenciaMeses?: number;

  // Initial irregularities
  //
  // `mesesSoloIntereses` se retiró (§6 bis · ter): era la mitad que el motor
  // aplicaba de una función cuya otra mitad —`carencia` / `carenciaMeses`— era
  // la que se rellenaba. Nadie lo escribía nunca, así que decir doce meses de
  // carencia daba un cuadro sin carencia.
  diferirPrimeraCuotaMeses?: number; // 0..N (e.g., 2 → first payment 2 months later)
  prorratearPrimerPeriodo?: boolean;  // true = interest by actual days until 1st payment
  cobroMesVencido?: boolean;    // true = accrual month t, collection in month t+1

  // Collection details
  cuentaCargoId: string;        // treasury account id

  // ── Comisiones · §6 bis · quater ──────────────────────────────────────────
  //
  // Todas van en PUNTOS PORCENTUALES: `0.25` son 0,25 %, como se teclea y como
  // lo dice el papel del banco. Había cuatro sitios leyéndolas de cuatro
  // maneras —dos multiplicando en crudo, dos adivinando por el tamaño—, y la
  // cuenta vive ahora en `prestamos/comisiones`.
  //
  // `comisionAmortizacionParcial` se retiró: nadie la escribía, y era la única
  // que leía el simulador, así que la comisión de una amortización parcial
  // salía SIEMPRE cero.
  comisionApertura?: number;
  comisionMantenimiento?: number;
  /**
   * Amortización anticipada PARCIAL · adelantar una parte del capital.
   *
   * Distinta de la de cancelación total a propósito: los topes legales son
   * máximos y no obligan a que se pacten iguales. Lo normal es que no lo sean
   * —0 % parcial y 0,25 % total es una combinación corriente—, y de esa
   * diferencia sale una decisión de dinero: cancelar dejando viva una cuota.
   */
  comisionAmortizacionAnticipada?: number;
  /** Cuántos meses desde la firma se cobra · ausente = toda la vida. */
  comisionAmortizacionVigenciaMeses?: number;
  /** Cancelación TOTAL · adelantar todo lo que queda vivo. */
  comisionCancelacionTotal?: number;
  /** Cuántos meses desde la firma se cobra · ausente = toda la vida. */
  comisionCancelacionVigenciaMeses?: number;
  gastosFijosOperacion?: number;           // €

  // Bonifications management
  bonificaciones?: Bonificacion[];
  maximoBonificacionPorcentaje?: number;     // maximum total bonification allowed (e.g., 0.006 = 0.60%)
  /**
   * Cada cuántos meses mira el banco si cumples · lo normal, 6 o 12 (§6 ter).
   *
   * Una bonificación no se pierde el día que dejas de cumplirla: se pierde el
   * día que el banco lo mira. Sin este dato, el veredicto solo puede decir «si
   * la revisión fuera hoy», que es una hipótesis; con él dice una fecha, y da
   * tiempo a corregir.
   *
   * Ausente = la escritura no lo dice. No se supone un año: una fecha inventada
   * se lee igual que una real.
   */
  periodoRevisionBonificacionMeses?: number;
  /**
   * La próxima revisión TAL COMO LA DA EL BANCO · `YYYY-MM` (§6 ter).
   *
   * Manda sobre la periodicidad, y por eso existe. La revisión suele ser
   * regular —la carta del Santander dice «REVISIÓN ANUAL» y da el periodo
   * exacto, «desde el 31/03/2026 hasta el 30/03/2027»—, pero esa fecha es la
   * del banco y no tiene por qué caer en el aniversario de la firma.
   * Deducirla acierta solo si coinciden.
   *
   * Va en mes y año porque es lo que el banco enseña. Ponerle un día sería
   * prometer una precisión que nadie ha dado.
   */
  proximaRevisionBonificaciones?: string;
  /**
   * La última revisión que ya se dio por vista · `YYYY-MM-DD` o `YYYY-MM`.
   *
   * ATLAS no ve la carta del banco: puede decir qué demuestran tus movimientos,
   * pero no si te dejaron la bonificación. Una revisión que ya pasó queda
   * ESPERANDO respuesta hasta que se confirma o se rectifica, y esto es lo que
   * distingue las atendidas de la que sigue reclamando.
   */
  ultimaRevisionBonificacionesConfirmada?: string;
  /**
   * Meses iniciales en que las bonificaciones se dan por cumplidas (§6 ter).
   *
   * Es del PRÉSTAMO, no de cada bonificación (decisión de Jose · 4 ago 2026):
   * el banco concede un plazo común —el primer año, los primeros seis meses, o
   * ninguno—, y se cuenta desde `fechaFirma`.
   *
   * Durante ese plazo la cuota rebajada NO demuestra que cumplas, y por eso hay
   * que decirlo en pantalla: quien no lo sepa creerá que va bien.
   */
  graciaMesesBonificaciones?: number;
  fechaFinMaximaBonificacion?: string;       // end date for maximum bonification period

  // Reglas por defecto de bonificaciones
  topeBonificacionesTotal?: number;          // Tope acumulado de descuentos: -1,00 p.p.
  tinMin?: number;                           // Suelo TIN para FIJO: 1,00%
  diferencialMin?: number;                   // Suelo diferencial para VARIABLE: 0,40%

  // Bonification evaluation parameters (when bonifications are active)
  fechaFinPeriodo?: string;           // end of evaluation period (ISO date)
  fechaEvaluacion?: string;           // evaluation date (defaults to finPeriodo - 30 days, editable)
  offsetEvaluacionDias?: number;      // default 30 days before end period

  // Estado de pagos
  cuotasPagadas: number;
  fechaUltimaCuotaPagada?: string;
  estado?: 'vivo' | 'cancelado' | 'pendiente_cancelacion_venta' | 'pendiente_completar';
  fechaCancelacion?: string;
  /** Marcado cuando la venta del inmueble deja pendiente la cancelación del préstamo. */
  cancelacionPendienteVenta?: boolean;
  /** Fecha (ISO) en que la venta del inmueble solicitó la cancelación del préstamo. */
  fechaSolicitudCancelacionVenta?: string;

  // Intereses anuales declarados por ejercicio fiscal (ej: { 2023: 1200.50 })
  interesesAnualesDeclarados?: Record<number, number>;

  // ── S-WIZARD-PRESTAMO-V2 · campos extendidos (opcionales · sin breaking changes) ──
  /** Tipo comercial del préstamo · independiente de la garantía. */
  tipoPrestamoV2?: 'hipotecario' | 'personal' | 'linea_credito' | 'otro';
  /** Nombre del banco emisor (display). */
  banco?: string;
  /** Número de contrato (referencia comercial). */
  numeroContrato?: string;
  /**
   * Interés de demora pactado (TIN anual %, p.ej. 6.99 = 6,99%).
   * Solo informativo · no afecta al cuadro principal.
   */
  interesDemoraPct?: number;
  /** Comisión de modificación de condiciones · %. */
  comisionModificacionCondiciones?: number;
  /** Gasto de reclamación de impago (€ · típico 49 €). */
  gastoReclamacionImpago?: number;
  /**
   * Carencia técnica detectada al guardar el préstamo desde el wizard v2.
   * Calculada como días entre la fecha de firma y el primer día de cobro
   * del mes siguiente · genera un cargo separado en tesorería.
   * `null` si NO existe; objeto si existe.
   */
  carenciaTecnica?: {
    dias: number;
    fechaLiquidacion: string;        // ISO date
    intereses: number;               // €
  } | null;

  // Importación
  origenCreacion: 'MANUAL' | 'FEIN' | 'IMPORTACION';
  cuotasPagadasAlImportar?: number;
  capitalVivoAlImportar?: number;
  documentoFEIN?: string;

  /**
   * V60 (TAREA 7 sub-tarea 1): liquidación final del préstamo (cancelación
   * total o parcial). Absorbe los datos del store eliminado
   * `loan_settlements` (sub-tarea 4 elimina el store y migra los registros
   * al campo `prestamos[].liquidacion` correspondiente).
   *
   * Tipo `unknown` aquí para evitar dependencia circular con
   * `services/db.ts` donde vive la interfaz `LoanSettlement` completa.
   * Los consumidores que necesiten el tipo concreto deben hacer cast a
   * `LoanSettlement` desde `src/services/db.ts`.
   *
   * Default `null` post-V60 (préstamo vivo). `undefined` para préstamos
   * pre-V60 (campo aún no inicializado).
   */
  liquidacion?: unknown | null;

  /**
   * TAREA 15 sub-tarea 15.3 · plan de pagos del préstamo.
   *
   * Antes de T15 vivía en `keyval[planpagos_${prestamoId}]` · datos del
   * usuario disfrazados de configuración (categoría C del audit T15.1).
   * `migrateKeyvalPlanpagosToPrestamos` mueve cada entrada del store
   * `keyval` a este campo y borra la entrada origen.
   *
   * `undefined` mientras no se haya generado o migrado el plan · objeto
   * `PlanPagos` cuando esté disponible.
   */
  planPagos?: PlanPagos;

  activo: boolean;

  // Audit
  createdAt: string;
  updatedAt: string;
}

/**
 * Una revisión del índice que ya ocurrió · lo que dice la carta del banco.
 *
 * Se guarda el ÍNDICE, no el tipo final: el diferencial es del contrato y no
 * cambia, así que guardar la suma obligaría a rehacerla si alguien corrige el
 * diferencial, y las dos cifras acabarían contradiciéndose.
 */
export interface RevisionDelIndice {
  /** Desde qué día rige · ISO `YYYY-MM-DD`. */
  desde: string;
  /** El valor del índice, en porcentaje (2,164 = 2,164 %). */
  valorIndice: number;
}

/** Cómo se cuentan los días para liquidar intereses · §6 bis · bis. */
export type BaseCalculoIntereses = '30/360' | 'ACT/360' | 'ACT/365';

export interface AfectacionInmueblePrestamo {
  inmuebleId: string;
  porcentaje: number; // 0..100
  tipoRelacion?: 'GARANTIA' | 'DESTINO_CAPITAL' | 'MIXTA';
}

export interface Bonificacion {
  id: string;
  tipo: 'NOMINA'|'RECIBOS'|'SEGURO_HOGAR'|'SEGURO_VIDA'|'TARJETA'|'PENSIONES'|'ALARMA'|'OTROS';
  nombre: string;                 // "Nómina", "Seguro hogar", "Tarjeta"…
  reduccionPuntosPorcentuales: number; // e.g., 0.003 = 0.30 pp
  impacto: { puntos: number };    // p.ej. -0,10 p.p.
  aplicaEn: 'FIJO'|'VARIABLE'|'MIXTO_SECCION_FIJA'|'MIXTO_SECCION_VARIABLE';
  lookbackMeses: number;          // compliance window
  regla: ReglaBonificacion;       // declarative rule
  costeAnualEstimado?: number;    // e.g., insurance premium
  cuentaExigidaId?: string;       // if bank requires specific account
  /**
   * Con qué tarjeta se cumple, cuando la regla es de tarjeta (§3.6).
   *
   * Importa **la tarjeta concreta**, no la cuenta: de una misma cuenta pueden
   * colgar dos, y el banco bonifica por una. Sin esto no se puede demostrar
   * nada — sumar todas diría que cumples un requisito que no cumples.
   */
  tarjetaExigidaId?: number;

  // Alta (día 1):
  seleccionado?: boolean;         // el usuario lo marca
  // El periodo inicial en que se dan por cumplidas NO vive aquí: es del
  // préstamo entero (`graciaMesesBonificaciones`). Decisión de Jose · 4 ago
  // 2026 — el banco concede un plazo común, y preguntarlo por bonificación era
  // una pregunta repetida cuya respuesta podía además contradecirse consigo
  // misma. El campo que había aquí no lo rellenaba nadie.
  
  // Estados a futuro (no en esta vista):
  estado: 'INACTIVO'|'SELECCIONADO'|'ACTIVO_POR_GRACIA'|'ACTIVO_POR_CUMPLIMIENTO'|'PENDIENTE'|'EN_RIESGO'|'CUMPLIDA'|'PERDIDA';
  
  // Progress tracking (for UI)
  progreso?: {
    descripcion: string; // "Llevas 2/4 meses de nómina ≥ 1.200€"
    faltante?: string;   // "Falta 1 mes con nómina ≥ 1.200€"
  };
}

export type ReglaBonificacion =
  | { tipo: 'NOMINA'; minimoMensual: number }
  | { tipo: 'PLAN_PENSIONES'; activo: boolean }
  | { tipo: 'SEGURO_HOGAR'; activo: boolean }
  | { tipo: 'SEGURO_VIDA'; activo: boolean }
  | { tipo: 'TARJETA'; movimientosMesMin?: number; importeMinimo?: number }
  /**
   * Recibos domiciliados · «tener domiciliados al menos N recibos».
   *
   * `Bonificacion.tipo` ya contemplaba `RECIBOS`, pero la regla no: una
   * bonificación de este tipo no tenía forma de decir **cuántos**, y sin eso no
   * se puede comparar con nada (§6 ter).
   *
   * Se cuentan recibos DISTINTOS, no cargos: «tres recibos domiciliados» son
   * tres servicios, no el de la luz tres meses seguidos.
   */
  | { tipo: 'RECIBOS'; minimoRecibos: number }
  | { tipo: 'ALARMA'; activo: boolean }
  | { tipo: 'OTRA'; descripcion: string };

export interface PeriodoPago {
  periodo: number;                // 1..N
  devengoDesde: string;          // ISO date
  devengoHasta: string;          // ISO date
  fechaCargo: string;            // ISO date
  cuota: number;                 // €
  interes: number;               // €
  amortizacion: number;          // €
  principalFinal: number;        // €
  esProrrateado?: boolean;       // first period prorated
  esSoloIntereses?: boolean;     // interest-only period
  diasDevengo?: number;          // for prorated calculations
  pagado: boolean;
  fechaPagoReal?: string;
  movimientoTesoreriaId?: string;
}

export interface PlanPagos {
  prestamoId: string;
  fechaGeneracion: string;       // ISO timestamp
  periodos: PeriodoPago[];
  resumen: {
    totalIntereses: number;
    totalCuotas: number;
    fechaFinalizacion: string;
  };
  metadata?: {
    source?: 'generated' | 'property_sale' | 'loan_settlement' | 'wizard_v2_generated';
    operationType?: 'TOTAL' | 'PARTIAL';
    operationDate?: string;
    partialMode?: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  };
}

export interface CalculoAmortizacion {
  modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  importeAmortizar: number;
  fechaAmortizacion: string;

  // Results
  penalizacion: number;
  nuevaCuota?: number;           // if REDUCIR_CUOTA
  nuevoplazo?: number;           // if REDUCIR_PLAZO
  nuevaFechaFin?: string;
  interesesAhorrados: number;
  puntoEquilibrio?: number;      // months to break even
}

// ─── NUEVO v2: Destino y Garantía ───

export interface DestinoCapital {
  id: string;
  tipo: 'ADQUISICION' | 'REFORMA' | 'CANCELACION_DEUDA' | 'INVERSION' | 'PERSONAL' | 'OTRA';
  inmuebleId?: string;
  inversionId?: string;
  prestamoIdCancelado?: string;
  importe: number;
  porcentaje?: number;           // opcional: puede venir almacenado (legacy) o derivarse como importe / principalInicial * 100
  descripcion?: string;
}

export interface Garantia {
  tipo: 'HIPOTECARIA' | 'PERSONAL' | 'PIGNORATICIA';
  inmuebleId?: string;
  inversionId?: string;
  descripcion?: string;
}
