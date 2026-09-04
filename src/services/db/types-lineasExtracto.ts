// Tipos de `lineasExtracto` · sacados de types-movimientos.ts en E1.3 para
// que ese fichero no pase de 800 líneas. Se re-exportan desde `./types`.

// ============================================================================
// E1.1 · `lineasExtracto` · la línea del banco, persistida (store propio)
// ============================================================================
//
// Hasta E1.1 la línea de extracto vivía solo en memoria (`ParsedMovement`) y se
// perdía al insertar el `Movement`; `importBatches` guarda metadatos del lote,
// no líneas. Este registro la conserva TAL CUAL la trajo el banco.
//
// Ciclo previsto (§16.3 · §29) · en E1.1 solo se escribe, nadie lo lee:
//   estado         sin_procesar → pendiente → resuelta
//   comoSeResolvio motor (el matcheo la casó) · confirmada (el usuario dijo sí a
//                  lo que ATLAS propuso) · a_mano (el usuario la clasificó)
//   atencion       recordar · silenciada — el «ignorar» de §29: silencia el
//                  recordatorio, NO saca la línea del saldo.
//
// Regla de fases futuras · una línea puede engendrar VARIOS movimientos (§16.4 ·
// un pago que junta fianza + dos meses): `movementIds` es plural y la suma de los
// importes de esos movimientos debe ser igual a `importe`. Vacío si aún no ha
// generado ninguno. La regla no aplica a una línea con `descarte`.
export type EstadoLineaExtracto = 'sin_procesar' | 'pendiente' | 'resuelta';
export type ComoSeResolvioLinea = 'motor' | 'confirmada' | 'a_mano';
export type AtencionLineaExtracto = 'recordar' | 'silenciada';
/**
 * Por qué una fila del fichero NO generó movimiento al importar. Antes de E1.1
 * estas filas se perdían en silencio (VERIFICACION-E1-preflight §1.4); ahora
 * dejan rastro. `duplicada`: su `hashMovement` ya existía de otra importación.
 */
export type DescarteLineaExtracto = 'duplicada' | 'sin_fecha' | 'sin_importe';

/**
 * E1.3 · la decisión del usuario sobre una línea, tal cual está en la sesión.
 *
 * Es la serialización directa de las siete estructuras de `DecisionesSesion`
 * (`extractoSesion.ts`) para UNA línea: se guarda tras cada gesto y se vuelve
 * a cargar al retomar un lote a medias. No se interpreta al guardar (varias
 * marcas pueden convivir, igual que en la sesión); `atencion` y
 * `comoSeResolvio` son el RESUMEN derivado, no la fuente.
 */
export interface DecisionDeLineaPersistida {
  /** «Asignar a un previsto» · el `treasuryEvent` elegido. */
  asignadoA?: number;
  /** «Ignorar» · §29: silencia el recordatorio, no saca la línea del saldo. */
  ignorada?: true;
  /** «Crear movimiento» · clasificada desde la ficha. */
  creada?: true;
  /** Venía ignorada de otra importación y el usuario la recuperó. */
  recuperada?: true;
  /** «Es efectivo» · al guardar se convierte en traspaso a Efectivo. */
  aEfectivo?: true;
  /** «Es traspaso» · la cuenta destino. */
  traspasoA?: number;
  /** «No es esto» · la corrección sobre lo que ATLAS colocó solo. */
  desemparejada?: true;
  decididaAt: string;
}

export interface LineaExtractoPersistida {
  id?: number;

  // ── Crudo del banco · INMUTABLE · copia fiel (§16.1) ──────────────────────
  /** Día ISO `YYYY-MM-DD` del cargo. `''` solo si el banco no trajo fecha legible (`descarte: 'sin_fecha'`). */
  fechaOperacion: string;
  /** Día ISO de valor · cae a `fechaOperacion` cuando el fichero no lo trae. */
  fechaValor: string;
  /** Con signo, tal como lo dio el parser. */
  importe: number;
  /**
   * El texto EXACTO del banco: se guarda sin `trim`, sin normalizar, sin
   * embellecer. Las dos huellas se derivan de él y cada una lo transforma a su
   * manera (`hashMovement` recorta los espacios de los extremos; `hashLinea`
   * lo normaliza entero), así que alterar el literal —espacios internos,
   * mayúsculas, acentos, puntuación— cambia al menos una y rompe el dedupe.
   */
  conceptoLiteral: string;
  contraparte?: string;
  referencia?: string;
  saldo?: number;
  divisa?: string;

  // ── Trazabilidad ──────────────────────────────────────────────────────────
  importBatchId: string;
  accountId: number;
  /** Fila del fichero de la que salió (`ParsedMovement.originalRow`). */
  filaOriginal?: number;
  /** La fila cruda que entregó el parser (`ParsedMovement.rawData`), si la hubo. */
  datosCrudos?: Record<string, unknown>;

  // ── Huellas · las que ya calcula el orquestador, no otras ──────────────────
  /** `generateLineHash` · `v1:fecha|céntimos|concepto normalizado` (sin cuenta). */
  hashLinea: string;
  /** `bankStatementOrchestrator.hashMovement` · `cuenta|fecha|céntimos|concepto.trim()` (sin normalizar: mayúsculas, acentos y espacios internos cuentan). */
  hashMovement: string;

  // ── Estado ────────────────────────────────────────────────────────────────
  estado: EstadoLineaExtracto;
  comoSeResolvio?: ComoSeResolvioLinea;
  atencion?: AtencionLineaExtracto;
  descarte?: DescarteLineaExtracto;
  /** E1.3 · lo que el usuario decidió sobre esta línea en la sesión · para retomarla. */
  decision?: DecisionDeLineaPersistida;

  // ── Enlace ────────────────────────────────────────────────────────────────
  /** Movimientos nacidos de esta línea · PLURAL · vacío si aún ninguno. */
  movementIds: number[];

  createdAt: string;
  updatedAt: string;
}
