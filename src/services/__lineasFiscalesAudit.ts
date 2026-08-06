// ============================================================================
// LÍNEAS FISCALES MATERIALIZADAS DE MÁS · utilidad de diagnóstico
// ============================================================================
//
// Prefijo `__` indica herramienta de desarrollo · NO importar desde código de
// producción. Vive aparte de `__buscarApunteAudit` porque mira OTRO store y
// contesta OTRA pregunta: aquél busca un apunte concreto entre compromisos,
// previsiones y movimientos; éste audita el estado de `gastosInmueble`.
//
// SÓLO LEE. No borra nada.
// ============================================================================

import { initDB } from './db';
import type { GastoInmueble } from './db';
import { céntimos, normalizar } from './__normalizacionAudit';

/** Qué le pasa a una línea fiscal materializada de más. */
export type AnomaliaFiscal =
  /** `fecha` que no existe en el calendario · 31 de febrero y compañía. */
  | 'fecha_imposible'
  /** Ejercicio muy por delante del actual · lo materializó una proyección. */
  | 'ejercicio_futuro'
  /** Otra línea con el mismo inmueble, ejercicio, concepto e importe. */
  | 'duplicado_exacto';

export interface LineaFiscalAnomala {
  id: number;
  inmuebleId: number;
  ejercicio: number;
  fecha: string;
  concepto: string;
  importe: number;
  origen: string;
  anomalias: AnomaliaFiscal[];
}

export interface ResumenFiscal {
  total: number;
  fechasImposibles: number;
  ejerciciosFuturos: number;
  duplicadosExactos: number;
  /** Ejercicio más lejano encontrado · delata el horizonte de la proyección. */
  ejercicioMaximo: number | null;
  /** Cuántas líneas hay por ejercicio · ordenado por año. */
  porEjercicio: Array<{ ejercicio: number; lineas: number }>;
  muestra: LineaFiscalAnomala[];
}

// ─── 5 · Líneas fiscales materializadas de más ─────────────────────────────

/** ¿Existe esa fecha en el calendario? `2026-02-31` no. */
function fechaImposible(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return false;
  const [, a, mes, dia] = m;
  const d = new Date(Number(a), Number(mes) - 1, Number(dia));
  // Si el día se desborda, `Date` rueda al mes siguiente y deja de coincidir.
  return d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia);
}

/**
 * Revisa `gastosInmueble` · el store de gastos REALES de un inmueble.
 *
 * Por qué merece sección propia: `computeFiscalSummary` no sólo lee, también
 * ESCRIBE — materializa una línea por mes del ejercicio que se le pregunte
 * (`generarOperacionesDesdeRecurrentes`). El propio repo lo documenta en
 * `fiscalSummaryMemo.ts`: la proyección pide ~20 años y «cada llamada
 * materializa gastos de años futuros». El memo que se añadió evita el CUELGUE,
 * pero no retira lo que ya se escribió.
 *
 * El resultado son cientos de líneas de ejercicios que aún no existen. No se
 * ven en ninguna pantalla —lo fiscal se mira un ejercicio cada vez, y nadie
 * abre 2044— y no las encuentra ninguna de las otras secciones, que miran
 * compromisos y previsiones.
 *
 * Se marcan tres cosas distintas y NO se mezclan: una fecha imposible es un
 * fallo de construcción del dato, un ejercicio futuro es basura de proyección,
 * y un duplicado exacto es contar dos veces. Sólo lo tercero infla una suma.
 */
export async function lineasFiscalesAnomalas(): Promise<ResumenFiscal> {
  const db = await initDB();
  const gastos = ((await db.getAll('gastosInmueble')) ?? []) as GastoInmueble[];

  // El corte es «el año que viene»: una previsión del ejercicio en curso o del
  // siguiente es legítima (se declara en breve). Más allá no lo pidió nadie.
  const limite = new Date().getFullYear() + 1;

  const porFirma = new Map<string, number>();
  for (const g of gastos) {
    const f = `${g.inmuebleId}|${g.ejercicio}|${normalizar(g.concepto)}|${céntimos(g.importe)}`;
    porFirma.set(f, (porFirma.get(f) ?? 0) + 1);
  }

  const porEjercicio = new Map<number, number>();
  const anomalas: LineaFiscalAnomala[] = [];
  let fechasImposibles = 0;
  let ejerciciosFuturos = 0;
  let duplicadosExactos = 0;
  let ejercicioMaximo: number | null = null;

  for (const g of gastos) {
    porEjercicio.set(g.ejercicio, (porEjercicio.get(g.ejercicio) ?? 0) + 1);
    if (ejercicioMaximo == null || g.ejercicio > ejercicioMaximo) ejercicioMaximo = g.ejercicio;

    const anomalias: AnomaliaFiscal[] = [];
    if (fechaImposible(g.fecha)) { anomalias.push('fecha_imposible'); fechasImposibles++; }
    if (g.ejercicio > limite) { anomalias.push('ejercicio_futuro'); ejerciciosFuturos++; }

    const firma = `${g.inmuebleId}|${g.ejercicio}|${normalizar(g.concepto)}|${céntimos(g.importe)}`;
    if ((porFirma.get(firma) ?? 0) > 1) { anomalias.push('duplicado_exacto'); duplicadosExactos++; }

    if (anomalias.length > 0) {
      anomalas.push({
        id: g.id as number,
        inmuebleId: g.inmuebleId,
        ejercicio: g.ejercicio,
        fecha: g.fecha,
        concepto: g.concepto,
        importe: g.importe,
        origen: g.origen,
        anomalias,
      });
    }
  }

  return {
    total: gastos.length,
    fechasImposibles,
    ejerciciosFuturos,
    duplicadosExactos,
    ejercicioMaximo,
    porEjercicio: Array.from(porEjercicio.entries())
      .map(([ejercicio, lineas]) => ({ ejercicio, lineas }))
      .sort((a, b) => a.ejercicio - b.ejercicio),
    // Una muestra basta para diagnosticar · volcar cientos de líneas iguales
    // esconde el dato que importa, que son los recuentos.
    muestra: anomalas.slice(0, 15),
  };
}
