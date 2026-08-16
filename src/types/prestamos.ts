// Préstamos - Comprehensive Loan Data Models
// Following the requirements from the problem statement

// El cuadro vive en `planPagos.ts` · se importa porque `Prestamo` lo usa, y se
// reexporta más abajo para que ningún import de fuera tenga que enterarse.
import type { PlanPagos } from './planPagos';
// El plan de amortizaciones no es del contrato · ver su propio fichero.
import type { PlanDeAmortizaciones } from './planDeAmortizaciones';

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
  /**
   * Cómo cuenta los DÍAS SUELTOS del arranque (§6 bis · bis) · puede no ser la
   * misma base que el resto del cuadro, y en la práctica no lo es.
   *
   * Santander e ING los cuentan en días reales sobre 365 mientras liquidan las
   * cuotas normales entre doce. El Sabadell los cuenta 30/360 como el resto:
   * formalizado el 04-07 y cobrando fin de mes son **26** días (30 − 4), no los
   * 27 reales.
   *
   * Ausente = días reales sobre 365 si la base es el mes comercial, y la propia
   * base en los demás casos · es lo que ATLAS venía haciendo.
   */
  baseDiasSueltos?: BaseCalculoIntereses;
  /**
   * Qué hace el banco con los días entre la disposición y la primera cuota.
   *
   * Ausente = `CARGO_APARTE`, que es lo que ATLAS venía haciendo y lo que hacen
   * cinco de los seis cuadros que hay medidos.
   */
  diasSueltosDelArranque?: DiasSueltosDelArranque;

  // FIJO
  tipoNominalAnualFijo?: number; // 3.2 for 3.2%

  // VARIABLE
  indice?: 'EURIBOR' | 'OTRO';
  /**
   * El índice con el que arranca el tramo variable · en PORCENTAJE (4,149).
   *
   * Es una **presunción del arranque**, no el índice de hoy, y por eso
   * `tramosDeTipo` lo marca `estimado`. En cuanto hay una revisión confirmada
   * (`revisionesDeTipo`) ese hecho manda y esto deja de pintar nada en el tramo
   * en curso.
   *
   * **El euríbor de «Actualizar valores» no entra aquí ni al leer.** El cuadro
   * se calcula con lo último FIJADO y no se mueve porque el mercado se mueva:
   * nada cambia de verdad hasta la revisión siguiente *(Jose · 8 ago 2026)*.
   * Ese euríbor sirve para la guía —`simulacionRevision`—, no para el cuadro.
   */
  valorIndiceActual?: number;
  diferencial?: number;         // 0.012
  /**
   * De qué mes publicado sale el índice · desfase en meses (§6 ter).
   *
   * Lo dice la escritura: «el del mes anterior» es 1. Ausente = no lo dice, y
   * no se supone ninguno. Lo traduce `publicacionDelIndice`.
   */
  indiceDesfaseMeses?: number;
  /**
   * Cada cuántos meses revisa el banco · lo normal, 6 o 12 (§6 ter).
   *
   * **UNA periodicidad para todo el préstamo** *(Jose · 8 ago 2026)*: la
   * revisión es un acto; lo que cambia es qué alcanza. También en un FIJO —no
   * revisa el índice porque no tiene, pero sí si cumples, y el de ING mueve su
   * tipo del 2,15 % al 1,35 %—. Léase con `cadaCuantoRevisa`.
   */
  periodoRevisionMeses?: number;
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
  // Van en PUNTOS PORCENTUALES: `0.25` son 0,25 %, como se teclea y como lo
  // dice el papel del banco. Había cuatro sitios leyéndolas de cuatro maneras
  // —dos multiplicando en crudo, dos adivinando por el tamaño—, y la cuenta
  // vive ahora en `prestamos/comisiones`.
  //
  // TODAS MENOS LA DE MANTENIMIENTO, que va en EUROS AL MES. Este comentario
  // decía que también era un porcentaje y el formulario pide «€/mes» desde
  // siempre: el que mandaba era el formulario, porque es lo que el usuario
  // tecleó. Queda dicho aquí para que nadie lo multiplique por el capital.
  //
  // `comisionAmortizacionParcial` se retiró: nadie la escribía, y era la única
  // que leía el simulador, así que la comisión de una amortización parcial
  // salía SIEMPRE cero.
  /** En PUNTOS PORCENTUALES del capital · gasto de FINANCIACIÓN. */
  comisionApertura?: number;
  /** En EUROS AL MES · se paga con cada recibo. */
  comisionMantenimiento?: number;

  // ── Lo que costó formalizarlo · §6 bis · quinquies ────────────────────────
  //
  // Estos dos existen por la TAE, pero NO son «entradas de la TAE»: son costes
  // del préstamo, y su segundo lector es el IRPF. Por eso nacen con su
  // naturaleza fiscal puesta — si entraran solo como números, el día que
  // alguien necesite lo fiscal añadiría OTRO campo y tendríamos el mismo dato
  // escrito dos veces, divergiendo.
  /**
   * Lo que costó la tasación, en EUROS.
   *
   * Es gasto de **financiación**, no de adquisición: nace del préstamo —el
   * banco la exige para conceder—, no de la compraventa. Se deduce el año en
   * que se paga (art. 23.1.a.1.º LIRPF, dentro del límite conjunto con
   * intereses y conservación), **no** se amortiza al 3 % y **no** sube el
   * valor de adquisición, así que tampoco resta en la ganancia al vender.
   */
  tasacion?: number;
  /** Los seguros que acompañan al préstamo · ver `SeguroVinculado`. */
  segurosVinculados?: SeguroVinculado[];
  /**
   * Amortización anticipada PARCIAL · adelantar una parte del capital.
   *
   * Distinta de la de cancelación total a propósito: los topes legales son
   * máximos y no obligan a que se pacten iguales. Lo normal es que no lo sean
   * —0 % parcial y 0,25 % total es una combinación corriente—, y de esa
   * diferencia sale una decisión de dinero: cancelar dejando viva una cuota.
   */
  comisionAmortizacionAnticipada?: number;
  /** Cancelación TOTAL · adelantar todo lo que queda vivo. @deprecated ver abajo */
  comisionCancelacionTotal?: number;

  /**
   * El calendario de la comisión por adelantar una PARTE del capital.
   *
   * Una comisión no suele ser un número: cambia con el tiempo —«2 % los diez
   * primeros años y 1,50 % después»—, y por eso son tramos. Los dos campos
   * sueltos de arriba son lo que guardaban los préstamos de antes, y se leen
   * como un calendario de un solo tramo.
   *
   * Lleva de dónde sale la cifra: al dar de alta, ATLAS **propone** el tope
   * legal —dejarlo en cero afirmaría «no hay comisión», que no es neutral—,
   * pero una cifra propuesta no es una leída de la escritura y la pantalla
   * tiene que poder decirlo.
   */
  comisionReembolsoParcial?: ComisionPactada;
  /** Lo mismo, para la cancelación TOTAL · suele ser otra cifra. */
  comisionReembolsoTotal?: ComisionPactada;
  gastosFijosOperacion?: number;           // €

  // Bonifications management
  bonificaciones?: Bonificacion[];
  maximoBonificacionPorcentaje?: number;     // maximum total bonification allowed (e.g., 0.006 = 0.60%)
  /**
   * Cómo cuentan entre sí las bonificaciones del anexo · §6 ter.
   *
   *   · `INDEPENDIENTES` · cada una vale por sí misma y se suman las cumplidas.
   *     Es lo normal, y es lo que ATLAS venía haciendo.
   *   · `CASCADA` · van en orden, y **la primera que no cumples corta las de
   *     debajo**. Lo escriben algunos anexos —«se aplicará el escalón siguiente
   *     únicamente si se mantiene el anterior»— y sin este campo se guardaban
   *     como si sumaran, que enseña una cuota más baja de la que se paga.
   *
   * Ausente = `INDEPENDIENTES`. Cambiar el valor por defecto habría movido la
   * cuota de todos los préstamos ya guardados sin que nadie lo pidiera.
   */
  modoBonificaciones?: ModoBonificaciones;
  /**
   * @deprecated Usar `periodoRevisionMeses` · la periodicidad es una sola.
   *
   * Había dos, con su propio desplegable «Revisión» cada una en la misma
   * pantalla de alta, y no coincidían: la ficha anunciaba una fecha arriba y
   * otra en la tarjeta de bonificaciones.
   *
   * Ya no se escribe · se lee de respaldo en `cadaCuantoRevisa`, que en un fijo
   * guardado antes de unificarlas es el único sitio donde está el dato.
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
  /**
   * Desde cuándo REBAJAN las bonificaciones · §6 ter.
   *
   * Solo tiene sentido en un mixto, y ahí lo cambia todo. Dos escrituras reales
   * de Jose, las dos mixtas, dicen cosas opuestas:
   *
   *   · Unicaja: «en el SEGUNDO y en los sucesivos períodos de interés… UNICAJA
   *     BANCO aplicará bonificaciones al tipo de interés». El primer periodo son
   *     los 36 meses al 2,600 % fijo: durante ellos no rebajan nada, por mucho
   *     que tengas contratados el seguro y la nómina. → `TRAMO_VARIABLE`.
   *   · ING: 2,15 % desde la firma, que baja a 1,35 % con las bonificaciones ya
   *     durante el tramo fijo. → `FIRMA`.
   *
   * Es del PRÉSTAMO y no de cada bonificación, por el mismo motivo que
   * `graciaMesesBonificaciones`: la escritura lo dice UNA vez, para el anexo
   * entero, y preguntarlo bonificación a bonificación era una pregunta repetida
   * cuya respuesta podía además contradecirse consigo misma.
   *
   * Ausente = `FIRMA`, que es lo que ATLAS venía haciendo. Cambiar el valor por
   * defecto habría movido la cuota de todos los mixtos ya guardados sin que
   * nadie lo hubiera pedido.
   */
  bonificacionesDesde?: 'FIRMA' | 'TRAMO_VARIABLE';
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

  /**
   * Lo que su dueño ha dicho que va a amortizar · §6 bis · quater.
   *
   * No es del contrato: el banco no sabe nada de esto. Es una intención de
   * quien paga —«200 € todos los meses y la extra de junio»— y por eso vive
   * junto al préstamo pero se lee aparte, en `types/planDeAmortizaciones`.
   *
   * Guardarlo NO es haberlo hecho. De aquí salen previsiones `predicted` si su
   * dueño lo pide, pero el cuadro no se toca: lo que ocurra de verdad se
   * registra el día que ocurra, con `confirmLoanSettlement`.
   */
  planDeAmortizaciones?: PlanDeAmortizaciones;

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

/** Un tramo del calendario de una comisión · «2 % hasta el mes 120». */
export interface TramoDeComision {
  /** Hasta qué mes desde la firma rige, sin incluirlo · ausente = al final. */
  hastaMes?: number;
  /** En PUNTOS PORCENTUALES · `0.25` son 0,25 %. */
  porcentaje: number;
}

/** Lo pactado para una comisión, y de dónde sale · §6 bis · quater. */
export interface ComisionPactada {
  tramos: TramoDeComision[];
  /** `ESCRITURA` lo puso el usuario · `TOPE_LEGAL` lo propuso ATLAS. */
  origen: 'ESCRITURA' | 'TOPE_LEGAL';
}

/** Cómo se cuentan los días para liquidar intereses · §6 bis · bis. */
export type BaseCalculoIntereses = '30/360' | 'ACT/360' | 'ACT/365';

/**
 * Qué es fiscalmente un coste del préstamo · §6 bis · quinquies.
 *
 * La línea que separa los dos primeros no es cuándo se paga, es **de qué
 * contrato nace**. Lo que nace de la COMPRAVENTA —notaría, registro, ITP/AJD,
 * gestoría— es mayor valor de adquisición: se amortiza al 3 % y resta en la
 * ganancia al vender. Lo que nace de la HIPOTECA —tasación, apertura— es gasto
 * de financiación: se deduce el año en que se paga y no toca el valor de
 * adquisición.
 */
export type NaturalezaFiscal =
  /** Art. 23.1.a.1.º LIRPF · con los intereses, y con su mismo límite. */
  | 'FINANCIACION'
  /** Art. 23.1.a.3.º · primas de seguro del inmueble, como el de hogar. */
  | 'GASTO_DEL_INMUEBLE'
  /** Se paga, pero no se resta. */
  | 'NO_DEDUCIBLE';

/**
 * Un seguro que acompaña al préstamo.
 *
 * Tiene DOS lectores que responden cosas distintas, y por eso lleva dos
 * marcas separadas en vez de una:
 *
 *   · la **TAE** mira `exigidoParaElTipo` · si sin ese seguro no tendrías el
 *     tipo que te ofrecieron, el seguro es precio del préstamo;
 *   · el **IRPF** mira `naturaleza` · que es otra pregunta.
 *
 * El seguro de vida vinculado es el caso donde las dos se separan: entra en la
 * TAE y **no** se deduce. Desde la Ley 5/2019 el banco no puede obligarte a
 * contratarlo —solo ofrecerlo combinado—, así que apoyar la deducción en «me
 * obligaban» es apoyarse en algo que legalmente no existe *(decisión de Jose ·
 * 6 ago 2026, por prudencia)*.
 */
export interface SeguroVinculado {
  /** «Hogar», «Vida»… */
  concepto: string;
  /** En EUROS AL AÑO. */
  primaAnual: number;
  /** Si sin él no tienes el tipo ofertado · entonces entra en la TAE. */
  exigidoParaElTipo?: boolean;
  naturaleza: NaturalezaFiscal;
}

/**
 * Qué hace el banco con los días entre la disposición y la primera cuota.
 *
 * Seis cuadros de amortización reales, cuatro bancos, y solo hay dos formas:
 *
 *   · `CARGO_APARTE` · un recibo propio de SOLO INTERESES en la primera fecha
 *     de cobro posterior a la disposición, y la primera cuota entera un mes
 *     después. Lo hacen el Santander (tres préstamos) y el Sabadell (dos).
 *   · `EN_LA_PRIMERA_CUOTA` · no hay recibo en esa fecha: el banco se la salta
 *     y mete esos días dentro de la primera cuota, que lleva la amortización
 *     normal MÁS el interés de todos los días transcurridos. Lo hace ING —
 *     97.500 € dispuestos el 22-02-2022, ningún cargo el 01-03, y el recibo del
 *     01-04 son 411,42 € = 193,05 de capital + 218,37 de 38 días—.
 *
 * Disponer el mismo día en que se cobra no deja días sueltos, y entonces esto
 * no decide nada.
 */
export type DiasSueltosDelArranque = 'CARGO_APARTE' | 'EN_LA_PRIMERA_CUOTA';

export interface AfectacionInmueblePrestamo {
  inmuebleId: string;
  porcentaje: number; // 0..100
  tipoRelacion?: 'GARANTIA' | 'DESTINO_CAPITAL' | 'MIXTA';
}

/** Cómo cuentan entre sí las bonificaciones de un préstamo · §6 ter. */
export type ModoBonificaciones = 'INDEPENDIENTES' | 'CASCADA';

/**
 * Un escalón de la rebaja · «desde 2.000 € rebaja 0,30; desde 3.000 €, 0,50».
 *
 * Hay anexos que no pagan una cifra fija por cumplir, sino una que sube con lo
 * que aportas. Guardar solo la mayor diría que rebaja más de lo que rebaja, y
 * guardar solo la menor, menos: las dos versiones enseñan una cuota que no es.
 */
export interface TramoDeRebaja {
  /** Desde qué valor del umbral rige, incluido · en la unidad de la regla. */
  desde: number;
  /** Lo que rebaja a partir de ahí, en PUNTOS PORCENTUALES · `0.30`. */
  pp: number;
}

export interface Bonificacion {
  id: string;
  tipo: 'NOMINA'|'RECIBOS'|'SEGURO_HOGAR'|'SEGURO_VIDA'|'TARJETA'|'PENSIONES'|'FONDOS'|'CERTIFICADO_ENERGETICO'|'ALARMA'|'OTROS';
  nombre: string;                 // "Nómina", "Seguro hogar", "Tarjeta"…
  /**
   * En qué puesto va, cuando el anexo las encadena · solo lo lee `CASCADA`.
   *
   * En modo independiente no dice nada y no se mira: ahí el orden de la lista
   * es presentación, no contrato. Ausente = el orden en que están guardadas.
   */
  orden?: number;
  /**
   * El tope de ESTA bonificación, en puntos porcentuales.
   *
   * Distinto del tope del préstamo (`topeBonificacionesTotal`), que capa la
   * suma. Este capa una sola, y existe porque hay anexos que ponen las dos
   * cosas: «por domiciliaciones, hasta 0,30 p.p.» dentro de un anexo que además
   * no baja de un punto en total. Sin él, una rebaja escalonada podría pasarse
   * de su propio máximo aunque el total cupiera bajo el tope general.
   *
   * Ausente = esta bonificación no trae tope propio.
   */
  sublimitePP?: number;
  /**
   * La rebaja cuando NO es una cifra fija · escalones sobre el umbral.
   *
   * Manda sobre `reduccionPuntosPorcentuales` cuando está: se toma el escalón
   * cuyo `desde` es el mayor que no supera el umbral declarado. Por debajo del
   * primer escalón no rebaja nada, que es lo que dice el anexo.
   */
  rebajaPorTramos?: TramoDeRebaja[];
  /**
   * Lo que rebaja, **en puntos porcentuales** · `0.30` es «−0,30 p.p.».
   *
   * El nombre del campo lo dice y así lo escribe el asistente (`ppDescuento`) y
   * lo leen `tinEfectivo` y el simulador. El comentario que había aquí decía
   * `0.003 = 0.30 pp` —una fracción—, o sea la unidad equivocada por un factor
   * de cien: quien lo hubiera creído habría guardado bonificaciones que no
   * rebajan nada. Es exactamente el error que ya cometió la capa de
   * presentación al revés, multiplicando por cien y comiéndose treinta puntos
   * de TIN.
   */
  reduccionPuntosPorcentuales: number;
  impacto: { puntos: number };    // p.ej. -0,10 p.p.
  // A qué tramo rebaja NO vive aquí: es `bonificacionesDesde`, del préstamo.
  // El campo `aplicaEn` que había aquí lo escribía el asistente con la
  // constante `'FIJO'` en todos los préstamos y no lo leía nadie, así que no
  // decía nada de ninguno — leerlo como un hecho habría dejado sin bonificar el
  // tramo fijo de TODOS los mixtos, que es lo correcto para la Unicaja de Jose
  // y lo contrario de lo que dice su ING.
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
  /**
   * Que le entre dinero al banco · **con sus dos ramas**.
   *
   * No es «nómina de X al mes» a secas. La FEIN de Unicaja dice: «Nómina, o
   * Pensión, o Prestación económica de la Seguridad Social, por importe igual o
   * superior a 2.500,00 euros netos mensuales; **o ingresos recurrentes por
   * importe anual igual o superior a 30.000 euros netos**».
   *
   * Son dos condiciones con dos ventanas distintas, y basta con UNA. La segunda
   * no exige nómina ninguna: valen alquileres, dividendos, lo que entre. Con
   * solo `minimoMensual`, quien cumple por esa vía salía como que **no cumple**
   * *(Jose · 6 ago 2026: «esto es la madre del cordero»)*.
   */
  | { tipo: 'NOMINA'; minimoMensual: number; minimoAnualRecurrente?: number }
  /**
   * Plan de pensiones o previsión · «aportar al menos N € al año».
   *
   * **Dos ramas, y basta con una** *(Jose · 9 ago 2026)*: unos anexos piden
   * APORTAR X al año, otros TENER X con el banco. No es la misma pregunta —un
   * plan sin aportaciones desde hace años puede tener 40.000 € dentro— y se
   * prueban en sitios distintos: la aportación en tesorería, el saldo en la
   * posición. Sin ninguna de las dos, la condición es tenerlo contratado.
   */
  | { tipo: 'PLAN_PENSIONES'; activo: boolean; aportacionAnual?: number; saldoMinimo?: number }
  /**
   * Seguros, **contados o sumados** · la forma que ninguna otra podía expresar.
   *
   * «Cada entidad bonifica de forma distinta: unas por tenerlo, otras por el
   * número de seguros, otras por el importe total de las primas» *(Jose · 6 ago
   * 2026)*. `SEGURO_HOGAR` y `SEGURO_VIDA` dicen «ten ESTE», y con eso no se
   * puede escribir «dos pólizas cualesquiera» ni «primas por 600 € al año»,
   * que es lo que piden muchos anexos. Y el agrario, el de comercio, el de
   * salud, el de auto y el de RC no tienen tipo propio: caían a `OTRA` y se
   * volvían incomprobables siendo lo mismo que los demás — un recibo.
   *
   * Las dos condiciones son un Y: sin `minimoPolizas` no se cuenta, sin
   * `primaAnualMinima` no se suma, y sin ninguna basta con tener una.
   */
  | { tipo: 'SEGUROS'; minimoPolizas?: number; primaAnualMinima?: number }
  /** El seguro del inmueble · `primaAnual` en EUROS AL AÑO, si el anexo la dice. */
  | { tipo: 'SEGURO_HOGAR'; activo: boolean; primaAnual?: number }
  /**
   * El seguro de vida · `capitalAseguradoPct` en % DEL CAPITAL del préstamo.
   *
   * Es como lo escriben los anexos —«vida por el 100 % del capital»— y no en
   * euros: el capital baja con cada cuota, así que una cifra fija diría otra
   * cosa dentro de diez años.
   */
  | { tipo: 'SEGURO_VIDA'; activo: boolean; capitalAseguradoPct?: number }
  | { tipo: 'TARJETA'; movimientosMesMin?: number; importeMinimo?: number }
  /**
   * Fondos de inversión o valores · las MISMAS dos ramas que el plan.
   *
   * `saldoMinimo` es «mantener N € con ellos», `aportacionAnual` es «meter N €
   * al año». Basta con una.
   */
  | { tipo: 'FONDOS'; saldoMinimo?: number; aportacionAnual?: number }
  /**
   * Certificado de eficiencia energética del inmueble.
   *
   * La condición es una LETRA («A», «B», «C»…), no un número: son las que
   * emite el certificado, y traducirlas a una escala numérica propia sería
   * inventarse una equivalencia que nadie ha escrito. Ausente = el anexo pide
   * el certificado sin decir letra mínima.
   */
  | { tipo: 'CERTIFICADO_ENERGETICO'; letraMinima?: string }
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

// ─── El cuadro de amortización ───
//
// `PeriodoPago`, `PlanPagos` y `CalculoAmortizacion` viven en `planPagos.ts` y
// se reexportan aquí: un préstamo es lo que se pactó, y el cuadro es lo que sale
// de aplicarlo. Se separaron cuando este fichero llegó al tope de tamaño que
// vigila el marcador de salud, y el corte se hizo por tema, no por la tijera.
export type { PeriodoPago, PlanPagos, CalculoAmortizacion } from './planPagos';

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
