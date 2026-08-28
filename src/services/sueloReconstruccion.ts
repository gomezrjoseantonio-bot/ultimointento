// ============================================================================
// El suelo de la reconstrucción · desde cuándo se rehace el pasado
// ============================================================================
//
// Para poblar «lo que ya pasó» hace falta saber dónde empieza ese pasado. Ese
// punto es el SUELO, y no lo decide el calendario a secas: lo decide en qué
// momento de la campaña de IRPF estamos.
//
// La razón es que un ejercicio cuya campaña sigue viva todavía se puede
// declarar, así que reconstruirlo sirve de algo. Uno cuya campaña cerró ya no:
// el plazo pasó, y remover ese año no cambia nada que se pueda presentar.
//
// Tres franjas, según dónde cae HOY respecto a la campaña del ejercicio
// anterior (N-1):
//
//   1 · antes de que abra   → N-1 aún no se ha podido presentar → suelo 1/1 N-1
//   2 · campaña abierta     → única ventana de duda → manda el estado de N-1
//   3 · campaña cerrada     → N-1 ya no se toca → suelo 1/1 N
//
// Y dentro de la franja 2, ANTE LA DUDA el suelo BAJA. No es simetría: dar por
// presentada una declaración que no lo estaba puede costar el plazo del
// ejercicio; darla por no presentada solo cuesta trabajo, y el trabajo se
// recupera. Por eso solo un `'declarado'` exacto sube el suelo, y cualquier
// otra cosa —incluido que no conste el ejercicio— lo baja.
//
// El TECHO no vive aquí. Esta función dice desde dónde; hasta dónde (hoy) lo
// decide quien genere los movimientos.
// ============================================================================

import { initDB } from './db';
import { VENTANAS_IRPF } from './fiscalResolverService';
import type { EjercicioFiscalCoord } from './db';

/** En qué punto de la campaña de N-1 cae una fecha. */
export type FranjaCampaña = 'antes' | 'abierta' | 'cerrada';

/**
 * El único estado que cuenta como «ya presentada».
 *
 * Los demás valores del enum (`en_curso`, `pendiente`, `prescrito` y `cerrado`)
 * NO lo son. `cerrado` en particular es un cierre ATLAS confirmado
 * (`db/types-fiscal.ts:430`), que es una afirmación del usuario sobre sus
 * números — no un acuse de la AEAT.
 *
 * Y el store no valida lo que se le escribe, así que también llegan valores
 * fuera del enum. Se compara contra el valor exacto y todo lo demás es duda.
 */
const ESTADO_PRESENTADA = 'declarado';

/** Respaldo para los ejercicios que la tabla oficial aún no cubre. */
function ventanaDe(ejercicio: number): { from: string; to: string } {
  const oficial = VENTANAS_IRPF[ejercicio];
  if (oficial) return oficial;
  // La campaña abre a primeros de abril y cierra el 30 de junio del año
  // siguiente al ejercicio. Sin fecha publicada, esas dos sostienen las tres
  // franjas; cuando la AEAT publique la suya, la tabla manda.
  const añoCampaña = ejercicio + 1;
  return { from: `${añoCampaña}-04-01`, to: `${añoCampaña}-06-30` };
}

const soloFecha = (iso: string): string => iso.slice(0, 10);

/**
 * En qué franja de la campaña de N-1 cae `hoy`, y cuál es ese N-1.
 *
 * `hoy` en `YYYY-MM-DD`. Los bordes de la ventana son INCLUSIVOS: el día que
 * abre y el día que cierra la campaña está abierta.
 */
export function franjaDeCampaña(hoy: string): {
  franja: FranjaCampaña;
  ejercicioN1: number;
} {
  const fecha = soloFecha(hoy);
  const añoActual = Number(fecha.slice(0, 4));
  const ejercicioN1 = añoActual - 1;
  const { from, to } = ventanaDe(ejercicioN1);

  if (fecha < soloFecha(from)) return { franja: 'antes', ejercicioN1 };
  if (fecha > soloFecha(to)) return { franja: 'cerrada', ejercicioN1 };
  return { franja: 'abierta', ejercicioN1 };
}

/**
 * El suelo de la reconstrucción · `YYYY-MM-DD`, siempre un 1 de enero.
 *
 * Función PURA: recibe el estado del ejercicio N-1 en vez de leerlo, para poder
 * fijar la tabla de verdad sin base de datos. `obtenerSueloReconstruccion` es
 * la que lo busca.
 *
 * `estadoN1` ausente = no consta ese ejercicio en ATLAS, que es el caso NORMAL:
 * los ejercicios solo se crean cuando algo va a escribir en ellos
 * (`ejercicioResolverService.ts:56-59`), así que un ATLAS que nunca importó una
 * declaración tiene el store vacío.
 *
 * El suelo nunca baja más allá de N-1. Un ejercicio más antiguo tiene la
 * campaña cerrada por definición, y esta fase no reconstruye lo que ya no se
 * puede presentar.
 */
export function calcularSueloReconstruccion(
  hoy: string,
  estadoN1?: string | null,
): string {
  const { franja, ejercicioN1 } = franjaDeCampaña(hoy);
  const añoActual = ejercicioN1 + 1;

  switch (franja) {
    case 'antes':
      // Todavía no se ha podido presentar · hay ejercicio que reconstruir.
      return `${ejercicioN1}-01-01`;
    case 'cerrada':
      // El plazo pasó · presentada o no, en esta fase N-1 no se toca.
      return `${añoActual}-01-01`;
    case 'abierta':
      // La única ventana de duda · y ante la duda, se baja.
      return estadoN1 === ESTADO_PRESENTADA
        ? `${añoActual}-01-01`
        : `${ejercicioN1}-01-01`;
  }
}

/**
 * El puente: lee el estado del ejercicio N-1 en `ejerciciosFiscalesCoord` y
 * devuelve el suelo.
 *
 * Un fallo de lectura NO rompe: se resuelve como «no consta», que es la rama
 * prudente. Quedarse sin suelo por no poder abrir la base sería peor que
 * reconstruir un año de más.
 */
export async function obtenerSueloReconstruccion(hoy: string): Promise<string> {
  const { franja, ejercicioN1 } = franjaDeCampaña(hoy);

  // Fuera de la campaña abierta el estado no cambia nada · ni se consulta.
  if (franja !== 'abierta') return calcularSueloReconstruccion(hoy);

  let estado: string | undefined;
  try {
    const db = await initDB();
    const ejercicio = (await db.get('ejerciciosFiscalesCoord', ejercicioN1)) as
      | EjercicioFiscalCoord
      | undefined;
    estado = ejercicio?.estado;
  } catch (err) {
    console.warn(
      `[sueloReconstruccion] no se pudo leer el ejercicio ${ejercicioN1} · se trata como no presentado`,
      err,
    );
  }

  return calcularSueloReconstruccion(hoy, estado);
}
