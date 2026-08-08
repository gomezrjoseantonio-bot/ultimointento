// ============================================================================
// Qué traería la próxima revisión si el índice se quedara como está hoy
// ============================================================================
//
// Una revisión confirmada **fija** el índice desde su día y ese valor corre
// hasta la revisión siguiente: se guarda en `revisionesDeTipo`, `tramosDeTipo`
// lo trata como hecho (`estimado: false`) y no proyecta nada por encima. Así que
// actualizar el euríbor de «Actualizar valores» cien veces no mueve ni un
// céntimo de los doce meses en curso, que es exactamente como tiene que ser.
//
// Pero entonces, durante esos doce meses, el euríbor de hoy **no decía nada**
// *(Jose · 8 ago 2026)*. Y sí dice algo: dice por dónde va a ir la revisión que
// viene. Eso es lo que calcula este fichero.
//
// Tres cosas lo mantienen honesto:
//
//   · **No entra en el cuadro.** Es una respuesta a «¿y si?», no un tramo. El
//     cuadro sigue diciendo lo que se paga de verdad, que es lo que el banco va
//     a cobrar mientras no revise.
//   · **Caduca sola.** Se recalcula con el índice de hoy cada vez que se mira,
//     así que sube y baja con el mercado sin tocar nada guardado.
//   · **Dice de dónde sale.** «Con el euríbor de hoy» no es «el banco aplicará»:
//     nadie sabe cuál será dentro de once meses, y prometerlo sería inventar el
//     dato del que cuelga la cuota.
// ============================================================================

import type { Prestamo } from '../../types/prestamos';
import { proximaRevision } from '../bonificaciones/revisionDelBanco';
import { cuadroDe, getCuota } from './lecturas';
import { tinDelTramo } from './tinDelTramo';
import { tramoVigente } from './tramosDeTipo';

export interface SimulacionRevision {
  /** Cuándo revisa · `YYYY-MM-DD` o `YYYY-MM` según lo que se sepa. */
  fecha: string;
  precision: 'dia' | 'mes';
  /** El índice con el que se ha simulado · el de «Actualizar valores». */
  indice: number;
  /** Lo que se paga hoy. */
  cuotaHoy: number;
  /** Lo que se pasaría a pagar · con ese índice y las bonificaciones de hoy. */
  cuotaDespues: number;
  /** El TIN de hoy, ya bonificado. */
  tinHoy: number;
  /** El TIN al que se iría, ya bonificado. */
  tinDespues: number;
}

/** El día desde el que regiría · con precisión de mes, el 1. */
const aplicaDesde = (fecha: string, precision: 'dia' | 'mes'): string =>
  precision === 'mes' ? `${fecha.slice(0, 7)}-01` : fecha.slice(0, 10);

/**
 * Qué pasaría en la próxima revisión con el índice de hoy.
 *
 * `null` cuando no hay nada que decir, y son varios casos legítimos: un préstamo
 * a tipo fijo no revisa; sin saber cada cuánto mira el banco no hay fecha que
 * poner —y una inventada se lee igual que una real—; y sin índice apuntado en
 * «Actualizar valores» no hay con qué simular. En los tres, callarse es la
 * respuesta correcta.
 *
 * La cuenta la hace el MOTOR, no este fichero: se le pasa el mismo préstamo con
 * una revisión de más y se le pregunta la cuota. Escribir aquí la anualidad
 * sería la cuarta copia de una fórmula que ya tuvo que corregirse una vez.
 */
export function simulacionRevision(
  prestamo: Prestamo,
  hoy: string,
  indiceHoy: number | null | undefined
): SimulacionRevision | null {
  if (prestamo.tipo === 'FIJO') return null;
  if (typeof indiceHoy !== 'number' || !Number.isFinite(indiceHoy)) return null;

  const proxima = proximaRevision(
    {
      desdeLaFirma: prestamo.fechaFirma ?? '',
      proximaSegunElBanco: prestamo.proximaRevisionBonificaciones,
      cadaMeses: prestamo.periodoRevisionBonificacionMeses,
      graciaMeses: prestamo.graciaMesesBonificaciones,
    },
    hoy
  );
  if (!proxima?.fecha || !proxima.precision) return null;

  const desde = aplicaDesde(proxima.fecha, proxima.precision);

  // Un mixto en su tramo fijo no revisa el índice todavía · el cambio que le
  // viene es el fin del tramo, y ese ya lo anuncia el cuadro con su propia
  // cifra. Simular encima diría dos cosas del mismo día.
  const tramoEntonces = tramoVigente(prestamo, desde);
  if (!tramoEntonces.variable) return null;

  // El mismo préstamo con una revisión de más · el motor hace el resto.
  const comoSiRevisaran: Prestamo = {
    ...prestamo,
    revisionesDeTipo: [
      ...(prestamo.revisionesDeTipo ?? []),
      { desde, valorIndice: indiceHoy },
    ],
  };

  const cuadroHoy = cuadroDe(prestamo);
  const cuadroDespues = cuadroDe(comoSiRevisaran);

  const cuotaHoy = getCuota(cuadroHoy, hoy);
  const cuotaDespues = getCuota(cuadroDespues, desde);
  const tinHoy = tinDelTramo(prestamo, tramoVigente(prestamo, hoy));
  const tinDespues = tinDelTramo(comoSiRevisaran, tramoVigente(comoSiRevisaran, desde));

  // Si no mueve nada, no hay aviso que dar · un «tu cuota pasará de 518 a 518»
  // es ruido, y encima el usuario acaba dejando de leer los que sí importan.
  if (Math.abs(cuotaDespues - cuotaHoy) < 0.01) return null;

  return {
    fecha: proxima.fecha,
    precision: proxima.precision,
    indice: indiceHoy,
    cuotaHoy,
    cuotaDespues,
    tinHoy,
    tinDespues,
  };
}
