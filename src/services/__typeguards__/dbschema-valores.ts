// CANDADO B · Tanda 1 de la conversión a DBSchema (TAREA-CC-DBSCHEMA-TANDA1).
//
// Fase 0 dejó los 45 stores con `value: any`. La Tanda 1 sustituye ese `any` por
// el tipo real en 12 stores del núcleo fiscal. Un candado por store: `db.put` de
// un objeto basura `{ __basura__: true }` DEBE ser un error de tipo cuando el
// `value` es el tipo real. El `@ts-expect-error` consume ese error y `tsc` pasa.
//
// Semáforo: si un store volviera a `value: any` (regresión), su objeto basura
// dejaría de ser error, el `@ts-expect-error` quedaría sin consumir y `tsc`
// fallaría — señalando exactamente el store que perdió el tipado.
//
// NOTA (§1 de la tarea): el objeto basura es `{ __basura__: true }` LITERAL, sin
// cast. Un `as never`/`as any` invalidaría el candado (never es asignable a todo).
// Si en algún store `{ __basura__: true }` resultara asignable al tipo real (tipo
// demasiado laxo), el `@ts-expect-error` quedaría sin usar y `tsc` fallaría aquí:
// eso es el STOP de §1 — el tipo no protege nada y hay que revisarlo.
import { initDB } from '../db';

// ejerciciosFiscalesCoord · RESUELTO en Frente B (cerrar DBSchema · Caso 2, con OK de
// Jose): EjercicioFiscalCoord ganó `estado: 'cerrado'`, `cierreAtlasMetadata`,
// `declaradoAt`; el store ya es `value: EjercicioFiscalCoord`. Candado activo abajo.
export async function candadoValor_ejerciciosFiscalesCoord() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando ejerciciosFiscalesCoord tenga tipo real
  await db.put('ejerciciosFiscalesCoord', { __basura__: true });
}

export async function candadoValor_resultadosEjercicio() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando resultadosEjercicio tenga tipo real
  await db.put('resultadosEjercicio', { __basura__: true });
}

// arrastresIRPF · RESUELTO en Frente B (cerrar DBSchema · §5-upgrade, con OK de Jose):
// se quitó el `as { origen?: string }` del backfill V60 (cursor.value ya es
// ArrastreIRPF · origen es opcional); el store ya es `value: ArrastreIRPF`. Candado:
export async function candadoValor_arrastresIRPF() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando arrastresIRPF tenga tipo real
  await db.put('arrastresIRPF', { __basura__: true });
}

export async function candadoValor_perdidasPatrimonialesAhorro() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando perdidasPatrimonialesAhorro tenga tipo real
  await db.put('perdidasPatrimonialesAhorro', { __basura__: true });
}

export async function candadoValor_snapshotsDeclaracion() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando snapshotsDeclaracion tenga tipo real
  await db.put('snapshotsDeclaracion', { __basura__: true });
}

export async function candadoValor_entidadesAtribucion() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando entidadesAtribucion tenga tipo real
  await db.put('entidadesAtribucion', { __basura__: true });
}

export async function candadoValor_aeatCarryForwards() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando aeatCarryForwards tenga tipo real
  await db.put('aeatCarryForwards', { __basura__: true });
}

export async function candadoValor_deudasFiscales() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando deudasFiscales tenga tipo real
  await db.put('deudasFiscales', { __basura__: true });
}

export async function candadoValor_vinculosAccesorio() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando vinculosAccesorio tenga tipo real
  await db.put('vinculosAccesorio', { __basura__: true });
}

// gastosInmueble · ENDURECIDO en paletas-fase-1 (tras borrar los 2 servicios muertos
// historical* que lo leían con forma de agregado fiscal). Ya no hay lector con forma
// incompatible → se tipa limpio a GastoInmueble.
export async function candadoValor_gastosInmueble() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando gastosInmueble tenga tipo real
  await db.put('gastosInmueble', { __basura__: true });
}

export async function candadoValor_mejorasInmueble() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando mejorasInmueble tenga tipo real
  await db.put('mejorasInmueble', { __basura__: true });
}

export async function candadoValor_mueblesInmueble() {
  const db = await initDB();
  // @ts-expect-error — debe fallar cuando mueblesInmueble tenga tipo real
  await db.put('mueblesInmueble', { __basura__: true });
}
