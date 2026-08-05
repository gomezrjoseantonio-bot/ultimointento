// ============================================================================
// A qué tipo se paga cada tramo del préstamo · VOCABULARIO §6 bis · bis
// ============================================================================
//
// El cuadro se generaba entero a UN tipo: una hipoteca variable salía a treinta
// años al índice de hoy, y una mixta al tipo de su tramo fijo, que no terminaba
// nunca. Una mixta 3+27 al 2,0 % fijo y Euríbor+1 después decía que ibas a
// pagar el 2,0 % durante treinta años.
//
// Aquí se decide **dónde se parte el cuadro y a qué tipo va cada trozo**, con
// una regla por encima de todas:
//
//   **El Euríbor de mañana no se sabe, y no se inventa.**
//
// Es la misma regla que la fecha de revisión (§6 ter): un número inventado se
// lee igual que uno real, y sobre él se hacen cuentas. Así que:
//
//   - Lo que **ya pasó** se toma de las revisiones que el usuario haya
//     apuntado de sus cartas. Eso es un hecho.
//   - Lo que **está por venir** se proyecta con el último tipo conocido, que es
//     lo mismo que hace el banco en su cuadro. Va marcado como `estimado` para
//     que la pantalla pueda decirlo en vez de fingir certeza.
//
// Lo único que se sabe de un futuro variable es CUÁNDO cambia, no a cuánto. Por
// eso un mixto sí se parte —la fecha del cambio está en la escritura— aunque el
// tipo de después sea una estimación: decir «desde marzo de 2029, en torno al
// 3,1 %» se acerca mucho más que decir «el 2,0 % hasta 2054».
// ============================================================================

import type { Prestamo } from '../../types/prestamos';
import { esISO, sumarMeses } from './fechas';

export interface TramoDeTipo {
  /** Desde qué día rige · ISO `YYYY-MM-DD`. El primero es la firma. */
  desde: string;
  /** El TIN anual ANTES de bonificar, en porcentaje (4,99 = 4,99 %). */
  tinBase: number;
  /**
   * Si el tipo es una PROYECCIÓN y no un dato de un papel.
   *
   * Lo es el tramo variable de un mixto —nadie sabe el índice de dentro de tres
   * años— y el tramo inicial de una variable cuando sale de «el índice actual»,
   * que es el de hoy y no tiene por qué ser el que aplicó al firmar.
   */
  estimado: boolean;
}

const numero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** El índice más el diferencial · lo que se paga en un tramo variable. */
const variable = (p: Prestamo, valorIndice?: number): number =>
  Math.round((numero(valorIndice ?? p.valorIndiceActual) + numero(p.diferencial)) * 10000) / 10000;

/**
 * Los tramos de tipo de un préstamo, de la firma en adelante.
 *
 * Siempre devuelve al menos uno, y siempre empieza en la firma: un cuadro tiene
 * que saber a qué tipo va su primera cuota.
 */
export function tramosDeTipo(prestamo: Prestamo): TramoDeTipo[] {
  const firma = esISO(prestamo.fechaFirma) ? prestamo.fechaFirma.slice(0, 10) : '';

  // ── El arranque · lo que se paga desde la firma ───────────────────────────
  const tramos: TramoDeTipo[] = [];

  // Desde cuándo cuentan las revisiones del índice. En un mixto, no antes de
  // que acabe el tramo fijo: durante él el índice no pinta nada, y aplicar una
  // revisión ahí bajaría o subiría una cuota que por contrato no se mueve.
  let desdeCuandoRevisan = firma;

  if (prestamo.tipo === 'FIJO') {
    return [{ desde: firma, tinBase: numero(prestamo.tipoNominalAnualFijo), estimado: false }];
  }

  if (prestamo.tipo === 'MIXTO') {
    tramos.push({
      desde: firma,
      tinBase: numero(prestamo.tipoNominalAnualMixtoFijo),
      estimado: false,
    });

    const meses = numero(prestamo.tramoFijoMeses);
    // Un tramo fijo que se come el préstamo entero es un préstamo fijo · y sin
    // meses dichos no hay fecha de cambio, así que no se inventa ninguna.
    if (firma && Number.isInteger(meses) && meses > 0 && meses < prestamo.plazoMesesTotal) {
      desdeCuandoRevisan = sumarMeses(firma, meses);
      tramos.push({ desde: desdeCuandoRevisan, tinBase: variable(prestamo), estimado: true });
    }
  }

  if (prestamo.tipo === 'VARIABLE') {
    // «El índice actual» es el de hoy, no necesariamente el que aplicó al
    // firmar. Para un préstamo de hace años es una presunción, y se dice.
    tramos.push({ desde: firma, tinBase: variable(prestamo), estimado: true });
  }

  // ── Las revisiones que ya ocurrieron · esto sí son hechos ─────────────────
  const revisiones = (prestamo.revisionesDeTipo ?? [])
    .filter((r) => esISO(r?.desde) && typeof r?.valorIndice === 'number' && Number.isFinite(r.valorIndice))
    .map((r) => ({ desde: r.desde.slice(0, 10), valorIndice: r.valorIndice }))
    .filter((r) => r.desde >= desdeCuandoRevisan)
    .sort((a, b) => a.desde.localeCompare(b.desde));

  for (const r of revisiones) {
    const tinBase = variable(prestamo, r.valorIndice);

    // Una revisión que cae el mismo día en que arranca un tramo lo SUSTITUYE:
    // es el dato bueno para ese día, y el que había era la presunción.
    const mismoDia = tramos[tramos.length - 1]?.desde === r.desde;
    if (mismoDia) {
      tramos[tramos.length - 1] = { desde: r.desde, tinBase, estimado: false };
      continue;
    }

    tramos.push({ desde: r.desde, tinBase, estimado: false });
  }

  // Después de la última revisión apuntada no se proyecta ninguna más. Sabemos
  // cuándo revisará el banco, pero no a cuánto: partir el cuadro por una fecha
  // para volver a poner el MISMO tipo no cambia nada y solo añade ruido.
  return tramos;
}
