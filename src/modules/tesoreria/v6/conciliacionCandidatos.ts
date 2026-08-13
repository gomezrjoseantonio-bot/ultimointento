// ============================================================================
// Tesorería V6 · §4.7 · candidatos para "Asignar a un previsto"
// ============================================================================
//
// El desplegable de asignación volcaba TODAS las previsiones abiertas de la
// cuenta. Un gasto recurrente proyecta una previsión por mes, así que el gas de
// −48 € salía CATORCE veces idéntico, y encima ordenadas por nada. Para una
// línea del extracto —un cargo concreto de un día concreto— eso no ayuda: solo
// hay UNA previsión de esa serie que le corresponde (la de su mes).
//
// Aquí se construye la lista que de verdad sirve para asignar a mano:
//   · una sola entrada por SERIE (se colapsan las instancias mensuales),
//   · ordenada por cercanía —primero las que cuadran de importe, luego por
//     fecha—,
//   · recortada a unas pocas.
//
// Es presentación pura: no concilia nada, solo decide qué se ofrece.
// ============================================================================

import type { TreasuryEvent } from '../../../services/db';

export interface CandidatoPrevisto {
  id: number;
  descripcion: string;
  /** Importe con signo · + ingreso · − gasto. */
  importe: number;
  fecha: string;
  /** El importe coincide con el de la línea (± céntimo). */
  exacto: boolean;
  /** Distancia en días entre la línea y la previsión. */
  diffDias: number;
}

const importeConSigno = (e: TreasuryEvent): number => {
  const mag = Math.abs(e.actualAmount ?? e.amount);
  return e.type === 'income' ? mag : -mag;
};

const soloDia = (iso?: string): string => (iso ?? '').slice(0, 10);

const diasEntre = (a: string, b: string): number => {
  const ta = Date.parse(`${soloDia(a)}T00:00:00Z`);
  const tb = Date.parse(`${soloDia(b)}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((ta - tb) / 86_400_000));
};

/** Signo del tipo compatible con el de la línea (financiación vale para los dos). */
const signoCompatible = (importeLinea: number, tipo: TreasuryEvent['type']): boolean => {
  if (tipo === 'income') return importeLinea >= 0;
  if (tipo === 'expense') return importeLinea < 0;
  return true; // financing
};

/**
 * Clave de SERIE · colapsa las instancias mensuales de un mismo recurrente.
 *
 * Lo que las distingue de otra serie: qué es (proveedor/descripción), cuánto y
 * de qué inmueble. La fecha NO entra —es justo lo que cambia de un mes a otro—.
 */
const claveSerie = (e: TreasuryEvent): string => {
  const quien = (e.providerName ?? e.counterparty ?? e.description ?? '').trim().toLowerCase();
  const cuanto = Math.round(Math.abs(e.actualAmount ?? e.amount) * 100);
  const donde = e.inmuebleId ?? '';
  const que = e.categoryKey ?? e.sourceType ?? '';
  return `${quien}|${cuanto}|${donde}|${que}`;
};

export interface OpcionesCandidatos {
  /** Ventana de fechas · por defecto ±45 días (cubre el desfase de domiciliación). */
  maxDias?: number;
  /** Cuántas series ofrecer como mucho · por defecto 6. */
  max?: number;
}

/**
 * Los previstos que de verdad merece la pena ofrecer para asignar esta línea.
 *
 * `previstos` deben ser ya los abiertos de la MISMA cuenta que el extracto.
 */
export function candidatosDeLinea(
  linea: { fecha: string; importe: number },
  previstos: TreasuryEvent[],
  opciones?: OpcionesCandidatos,
): CandidatoPrevisto[] {
  const maxDias = opciones?.maxDias ?? 45;
  const max = opciones?.max ?? 6;

  // 1) Nos quedamos con el mismo signo y dentro de la ventana.
  const enVentana = previstos
    .filter((e) => e.id != null)
    .filter((e) => signoCompatible(linea.importe, e.type))
    .map((e) => ({ e, diffDias: diasEntre(linea.fecha, e.predictedDate) }))
    .filter((x) => x.diffDias <= maxDias);

  // 2) Una sola instancia por serie · la más cercana en fecha.
  const porSerie = new Map<string, { e: TreasuryEvent; diffDias: number }>();
  for (const x of enVentana) {
    const clave = claveSerie(x.e);
    const previa = porSerie.get(clave);
    if (!previa || x.diffDias < previa.diffDias) porSerie.set(clave, x);
  }

  // 3) A candidato · con si cuadra de importe.
  const candidatos: CandidatoPrevisto[] = [...porSerie.values()].map(({ e, diffDias }) => {
    const importe = importeConSigno(e);
    return {
      id: e.id as number,
      descripcion: e.description,
      importe,
      fecha: soloDia(e.predictedDate),
      exacto: Math.abs(Math.abs(importe) - Math.abs(linea.importe)) < 0.005,
      diffDias,
    };
  });

  // 4) Orden: primero lo que cuadra de importe, luego lo más cercano en fecha,
  //    y a igualdad lo más cercano en importe.
  candidatos.sort((a, b) => {
    if (a.exacto !== b.exacto) return a.exacto ? -1 : 1;
    if (a.diffDias !== b.diffDias) return a.diffDias - b.diffDias;
    return Math.abs(a.importe - linea.importe) - Math.abs(b.importe - linea.importe);
  });

  return candidatos.slice(0, max);
}

/**
 * ¿Hay un cuadre claro? · una única previsión que cuadra de importe y está
 * cerca en fecha. Cuando NO lo hay, la acción por defecto de la línea es "Crear
 * movimiento": ofrecer un desplegable de cosas que no cuadran es peor que nada.
 */
export function hayCuadreClaro(candidatos: CandidatoPrevisto[]): boolean {
  const exactos = candidatos.filter((c) => c.exacto);
  return exactos.length === 1 && exactos[0].diffDias <= 7;
}
