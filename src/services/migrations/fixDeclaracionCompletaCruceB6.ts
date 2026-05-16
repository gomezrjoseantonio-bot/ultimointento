/**
 * TAREA CC FIX-B6-bis · migración one-shot para reparar el cruce
 * `aportacionesTrabajador` ↔ `contribucionesEmpresa` en la copia íntegra
 * del XML AEAT persistida en
 * `ejerciciosFiscalesCoord[año].aeat.declaracionCompleta.planPensiones`.
 *
 * Contexto · B6 (PR #1350) corrigió el parser y volteó los registros del
 * store `aportacionesPlan` con `origen='xml_aeat'`. Pero el coord guarda
 * además el snapshot completo del XML tal y como salió del parser viejo,
 * con los dos campos cruzados. F2 lee de esa copia (vía
 * `declaracionCompletaToIRPFAdapter`) y muestra los valores invertidos.
 *
 * Esta migración recorre `ejerciciosFiscalesCoord` y, para cada ejercicio
 * con `aeat.fuenteImportacion === 'xml'` y `planPensiones` poblado,
 * intercambia `aportacionesTrabajador` ↔ `contribucionesEmpresa`. El
 * resto de campos (`totalConDerechoReduccion`, `nifEmpleador`,
 * `nombreEmpleador`) NO se tocan · no estaban cruzados.
 *
 * Idempotente · el flag `migration_b6_declaracionCompleta_v1` en
 * `keyval` se escribe SOLO si todos los `put` por ejercicio tienen
 * éxito · si alguno falla, NO se marca como completada y el próximo
 * arranque reintenta. Lectura del flag, swaps y escritura del flag se
 * ejecutan en una sola transacción `readwrite` sobre `keyval` +
 * `ejerciciosFiscalesCoord` para serializar runs concurrentes (varias
 * pestañas / instancias) y evitar que un 2.º run lea el flag ausente
 * entre el swap del 1.º y la escritura del flag (lo que volvería a
 * invertir los datos).
 *
 * NO bumpea `DB_VERSION`. NO toca parser, adapter ni `aportacionesPlan`
 * (ya migrado en B6). Solo invierte los 2 campos en declaraciones con
 * `fuenteImportacion='xml'`.
 */

import { initDB } from '../db';
import type { EjercicioFiscalCoord } from '../db';

export const B6_DECLARACION_COMPLETA_FLAG_KEY = 'migration_b6_declaracionCompleta_v1';

export interface FixDeclaracionCompletaCruceB6Report {
  /** True si el flag estaba presente al iniciar · skip silencioso. */
  skipped: boolean;
  /** Número de ejercicios con planPensiones invertido. */
  swapped: number;
  /**
   * Errores no fatales por ejercicio o en la transacción. Si > 0, el
   * flag NO se escribe · el próximo arranque reintentará.
   */
  errors: string[];
}

export async function fixDeclaracionCompletaCruceB6(): Promise<FixDeclaracionCompletaCruceB6Report> {
  const report: FixDeclaracionCompletaCruceB6Report = {
    skipped: false,
    swapped: 0,
    errors: [],
  };

  const db = await initDB();

  // Una sola transacción readwrite sobre los 2 stores · serializa runs
  // concurrentes (otra pestaña) y garantiza que la lectura del flag y los
  // swaps son atómicos respecto a la escritura final del flag.
  const tx = db.transaction(['keyval', 'ejerciciosFiscalesCoord'], 'readwrite');
  const keyvalStore = tx.objectStore('keyval');
  const coordStore = tx.objectStore('ejerciciosFiscalesCoord');

  try {
    const flag = await keyvalStore.get(B6_DECLARACION_COMPLETA_FLAG_KEY);
    if (flag === 'completed') {
      report.skipped = true;
      await tx.done;
      return report;
    }

    const ejercicios = (await coordStore.getAll()) as EjercicioFiscalCoord[];
    const ahora = new Date().toISOString();
    const logs: string[] = [];

    for (const ej of ejercicios) {
      const aeat = ej.aeat;
      if (!aeat) continue;
      if (aeat.fuenteImportacion !== 'xml') continue;
      const pp = aeat.declaracionCompleta?.planPensiones;
      if (!pp) continue;

      const trabajadorAntes = pp.aportacionesTrabajador ?? 0;
      const empresaAntes = pp.contribucionesEmpresa ?? 0;
      if (trabajadorAntes === 0 && empresaAntes === 0) continue;

      try {
        const updated: EjercicioFiscalCoord = {
          ...ej,
          aeat: {
            ...aeat,
            declaracionCompleta: {
              ...aeat.declaracionCompleta!,
              planPensiones: {
                ...pp,
                aportacionesTrabajador: empresaAntes,
                contribucionesEmpresa: trabajadorAntes,
              },
            },
          },
          updatedAt: ahora,
        };
        await coordStore.put(updated);
        report.swapped++;
        logs.push(
          `[ATLAS] FIX-B6-bis declaracionCompleta ejercicio ${ej.año} · `
            + `trabajador ${trabajadorAntes} → ${empresaAntes} · `
            + `empresa ${empresaAntes} → ${trabajadorAntes}`,
        );
      } catch (error) {
        report.errors.push(
          `put ejerciciosFiscalesCoord ${ej.año}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Solo marcamos completada si TODOS los swaps fueron OK.
    if (report.errors.length === 0) {
      await keyvalStore.put('completed', B6_DECLARACION_COMPLETA_FLAG_KEY);
    }

    await tx.done;

    for (const line of logs) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* ignore */
    }
    report.errors.push(
      `transaction: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return report;
}
