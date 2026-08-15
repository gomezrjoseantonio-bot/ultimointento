// ============================================================================
// ¿POR QUÉ NO APARECE LO QUE GASTO CON LA TARJETA? · utilidad de diagnóstico
// ============================================================================
//
// Prefijo `__` = herramienta de desarrollo: no la llama ninguna pantalla, no
// pinta nada y no ESCRIBE. Su único consumidor es la consola del navegador,
// donde se cuelga de `window.atlasDiagnostico.tarjetas()`. Se registra desde
// producción a propósito (§ mismo criterio que `__buscarApunteAudit`): los datos
// que hay que mirar están en el navegador de producción, y una herramienta que
// no corre donde está el problema no sirve.
//
// La pregunta que contesta, con los datos REALES del usuario: cuando anoto una
// compra con una tarjeta de crédito, ¿por qué no engorda su periodo? El cálculo
// de «Llevas X este periodo» es derivado y tiene varias puertas por las que la
// compra se cae, y a ojo no se sabe cuál:
//
//   1. La tarjeta no tiene `ciclo` (o su modalidad no es `credito`): entonces
//      `gastoDeMovimientosCredito` la ignora entera.
//   2. La compra no llegó con la marca `gastoTarjetaCredito` (o sin `tarjetaId`):
//      el saldo la trata como cargo normal y el periodo no la ve.
//   3. El cargo del periodo de esa compra ya salió (`fechaCargo < hoy`): se
//      descarta porque su importe real vendría por el recibo.
//   4. El corte de la compra NO coincide con el del recibo PREVISTO: en el tile,
//      `gastoAbierto` fija el corte vigente con el primer periodo que encuentra
//      (gana el previsto) y descarta los de otro corte.
//
// Esta utilidad reproduce el cálculo paso a paso y dice, por cada compra, si
// cuenta y por qué no. SÓLO LEE.
// ============================================================================

import { initDB } from './db';
import type { Movement, TreasuryEvent } from './db';
import type { Tarjeta } from '../types/tarjetas';
import { recibosDeTarjeta } from './reciboDeTarjeta';
import { gastoPorTarjeta } from './gastoPorTarjeta';
import { toISODateLocal } from '../utils/recurrenceDateUtils';

interface CompraDiagnostico {
  movementId: number | null;
  fecha: string;
  importe: number;
  tieneMarca: boolean;
  /** El corte/cargo que le toca según el ciclo · null si no se puede calcular. */
  fechaCorte: string | null;
  fechaCargo: string | null;
  /** true si cuenta en el periodo abierto; si no, `motivo` dice por qué. */
  cuenta: boolean;
  motivo: string;
}

interface TarjetaDiagnostico {
  id: number | null;
  alias: string;
  modalidad: string;
  origen: string;
  cuentaLiquidacionId: number | null;
  ciclo: Tarjeta['ciclo'] | null;
  /** Problemas de la propia tarjeta que tumban su cálculo entero. */
  avisos: string[];
  compras: CompraDiagnostico[];
  /** Cortes de los recibos PREVISTOS (de compromisos) · para ver si cuadran. */
  cortesPrevistos: string[];
  /** El corte que el tile daría por «vigente» (el primer periodo abierto). */
  corteVigente: string | null;
  /** Lo que sumaría «Llevas X este periodo», con el desglose. */
  llevasEstePeriodo: number;
}

/**
 * Reproduce el cálculo de una tarjeta con los datos reales. No escribe nada.
 *
 * `hoy` se inyecta para poder probarlo; por defecto es el día LOCAL (no UTC, que
 * a medianoche en España daría el día anterior y movería el corte).
 */
export async function diagnosticarTarjetas(hoy: string = toISODateLocal(new Date())): Promise<TarjetaDiagnostico[]> {
  const db = await initDB();
  const tarjetas = ((await db.getAll('tarjetas')) ?? []) as Tarjeta[];
  const movimientos = ((await db.getAll('movements')) ?? []) as Movement[];
  const eventos = ((await db.getAll('treasuryEvents')) ?? []) as TreasuryEvent[];

  const previstosPorTarjeta = new Map<number, string[]>();
  for (const p of gastoPorTarjeta(eventos)) {
    if (p.estado !== 'abierto') continue;
    const arr = previstosPorTarjeta.get(p.tarjetaId) ?? [];
    arr.push(p.fechaCorte);
    previstosPorTarjeta.set(p.tarjetaId, arr);
  }

  const salida: TarjetaDiagnostico[] = [];
  for (const t of tarjetas) {
    const avisos: string[] = [];
    if (t.modalidad !== 'credito') {
      avisos.push(`modalidad="${t.modalidad}" · solo las de CRÉDITO acumulan compras en un periodo.`);
    }
    if (t.modalidad === 'credito' && !t.ciclo) {
      avisos.push('SIN CICLO · una tarjeta de crédito sin corte/cargo no puede agrupar nada. Edítala y dale su ciclo.');
    }

    // Los movimientos atribuidos a ESTA tarjeta (por `tarjetaId`).
    const suyos = movimientos.filter((m) => m.id != null && m.tarjetaId === t.id);
    const puedeCalcular = t.modalidad === 'credito' && !!t.ciclo && t.id != null;

    const compras: CompraDiagnostico[] = [];
    for (const m of suyos) {
      const fecha = (m.date ?? '').slice(0, 10);
      const base: CompraDiagnostico = {
        movementId: m.id ?? null,
        fecha,
        importe: m.amount,
        tieneMarca: m.gastoTarjetaCredito === true,
        fechaCorte: null,
        fechaCargo: null,
        cuenta: false,
        motivo: '',
      };

      if (m.amount >= 0) {
        base.motivo = 'no es gasto (importe ≥ 0) · una devolución no suma consumo.';
        compras.push(base);
        continue;
      }
      if (!base.tieneMarca) {
        base.motivo =
          'el movimiento NO tiene la marca gastoTarjetaCredito · se anotó como cargo normal, no como compra de crédito.';
        compras.push(base);
        continue;
      }
      if (!puedeCalcular) {
        base.motivo = 'la tarjeta no puede calcular periodos (ver avisos de la tarjeta).';
        compras.push(base);
        continue;
      }

      const [recibo] = recibosDeTarjeta(t as Tarjeta & { id: number }, [
        { fecha, importe: Math.abs(m.amount) },
      ]);
      if (!recibo) {
        base.motivo = 'el ciclo no produce recibo para esta compra (revisa el corte/cargo de la tarjeta).';
        compras.push(base);
        continue;
      }
      base.fechaCorte = recibo.fechaCorte;
      base.fechaCargo = recibo.fechaCargo;
      if (recibo.fechaCargo < hoy) {
        base.motivo = `su cargo (${recibo.fechaCargo}) ya salió antes de hoy (${hoy}) · su importe real vendría por el recibo del extracto.`;
      } else {
        base.cuenta = true;
        base.motivo = `cuenta en el periodo que corta el ${recibo.fechaCorte} (cargo ${recibo.fechaCargo}).`;
      }
      compras.push(base);
    }

    const cortesPrevistos = t.id != null ? previstosPorTarjeta.get(t.id) ?? [] : [];

    // Reproducción del tile: el corte vigente es el del PRIMER periodo abierto.
    // El previsto entra antes que las compras manuales (así se concatena en la
    // página), así que si hay previsto, gana su corte.
    const cortesAbiertos = [
      ...cortesPrevistos,
      ...compras.filter((c) => c.cuenta && c.fechaCorte).map((c) => c.fechaCorte as string),
    ];
    const corteVigente = cortesAbiertos[0] ?? null;

    // «Llevas X»: suma las compras que cuentan y caen en el corte vigente. (El
    // importe del previsto no se suma aquí: esto mide lo que aportan tus compras.)
    let llevas = 0;
    for (const c of compras) {
      if (c.cuenta && c.fechaCorte === corteVigente) llevas += Math.abs(c.importe);
    }
    // Si el corte vigente lo fija un previsto y tus compras caen en OTRO corte,
    // se quedan fuera del tile aunque «cuenten»: es el fallo nº 4.
    for (const c of compras) {
      if (c.cuenta && c.fechaCorte !== corteVigente) {
        c.motivo += ` OJO: cae en el corte ${c.fechaCorte}, pero el tile muestra el ${corteVigente} (el del previsto), así que NO se ve en «Llevas X».`;
      }
    }

    salida.push({
      id: t.id ?? null,
      alias: t.alias,
      modalidad: t.modalidad,
      origen: t.origen,
      cuentaLiquidacionId: t.cuentaLiquidacionId ?? null,
      ciclo: t.ciclo ?? null,
      avisos,
      compras,
      cortesPrevistos,
      corteVigente,
      llevasEstePeriodo: Math.round(llevas * 100) / 100,
    });
  }

  return salida;
}

/** Resumen en texto plano · para pegar en un mensaje sin capturas. */
export function formatearDiagnosticoTarjetas(dgs: TarjetaDiagnostico[], hoy: string): string {
  const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  const l: string[] = [];
  l.push(`TARJETAS · diagnóstico a día ${hoy} · ${dgs.length} tarjeta(s)`);
  if (dgs.length === 0) l.push('  No hay ninguna tarjeta dada de alta.');

  for (const d of dgs) {
    l.push('');
    l.push(`■ ${d.alias}  [#${d.id ?? '—'}]  ${d.modalidad} · ${d.origen}`);
    l.push(`   liquida en cuenta: ${d.cuentaLiquidacionId ?? '—'}`);
    l.push(
      d.ciclo
        ? `   ciclo: ${d.ciclo.periodicidad} · corte ${d.ciclo.corte} · cargo ${d.ciclo.diaCargo} · +${d.ciclo.periodosHastaElCargo} periodo(s)`
        : '   ciclo: (ninguno)'
    );
    for (const a of d.avisos) l.push(`   ⚠ ${a}`);

    if (d.cortesPrevistos.length > 0) {
      l.push(`   recibos PREVISTOS abiertos, cortes: ${d.cortesPrevistos.join(', ')}`);
    }
    l.push(`   corte que muestra el tile: ${d.corteVigente ?? '—'}`);
    l.push(`   «Llevas este periodo» (tus compras): ${eur(d.llevasEstePeriodo)}`);

    if (d.compras.length === 0) {
      l.push('   compras atribuidas: ninguna (ningún movimiento con esta tarjeta).');
    } else {
      l.push(`   compras atribuidas: ${d.compras.length}`);
      for (const c of d.compras) {
        const ok = c.cuenta ? '✓' : '✗';
        l.push(`     ${ok} ${c.fecha} · ${eur(c.importe)} · mov#${c.movementId ?? '—'}${c.tieneMarca ? '' : ' · SIN marca crédito'}`);
        l.push(`         ${c.motivo}`);
      }
    }
  }
  return l.join('\n');
}

/**
 * Cuelga el diagnóstico de tarjetas de la consola del navegador, FUSIONÁNDOSE
 * con lo que ya haya en `atlasDiagnostico` (búsqueda de apuntes, duplicados):
 * sobrescribir el objeto se llevaría por delante las otras herramientas.
 *
 *     await atlasDiagnostico.tarjetas()          → informe legible · SOLO LEE
 *     await atlasDiagnostico.tarjetasRaw()       → el objeto · SOLO LEE
 */
export function registrarDiagnosticoTarjetasEnConsola(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  const previo = (w.atlasDiagnostico as Record<string, unknown>) ?? {};
  w.atlasDiagnostico = {
    ...previo,
    tarjetas: async (hoy?: string) => {
      const dia = hoy ?? toISODateLocal(new Date());
      const dgs = await diagnosticarTarjetas(dia);
      // eslint-disable-next-line no-console
      console.log(formatearDiagnosticoTarjetas(dgs, dia));
      return dgs;
    },
    tarjetasRaw: diagnosticarTarjetas,
  };
}
