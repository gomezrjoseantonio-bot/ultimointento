// T23.6.1 · Adaptador `getAllCartaItems()` (§ 1.3 spec).
//
// Lee de los 2 servicios existentes (`inversionesService` +
// `planesPensionesService`) · filtra activos · deduplica (plan en
// `planesPensiones` prevalece sobre posición tipo `plan_pensiones` en
// `inversiones` con mismo nombre+entidad+fechaApertura) · ordena por
// valor_actual descendente.
//
// Solo lectura · cero escritura · cero migración · cero cambio de schema.

import { useCallback, useEffect, useState } from 'react';
import { inversionesService } from '../../../services/inversionesService';
import { planesPensionesService } from '../../../services/planesPensionesService';
import { aportacionesPlanService } from '../../../services/aportacionesPlanService';
import { esCerrada } from '../helpers';
import {
  inversionToCartaItem,
  planPensionToCartaItem,
  type CartaItem,
} from '../types/cartaItem';

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Clave de deduplicación: nombre + entidad + fechaApertura en minúsculas. */
const dedupKey = (nombre: string, entidad: string, fecha?: string | null): string =>
  `${nombre.trim().toLowerCase()}|${entidad.trim().toLowerCase()}|${fecha ?? ''}`;

const PLAN_TIPOS = new Set<string>(['plan_pensiones', 'plan-pensiones', 'plan_empleo']);

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve todos los `CartaItem` activos combinando los 2 stores:
 * - `inversiones` · posiciones activas que NO son planes ya en `planesPensiones`
 * - `planesPensiones` · planes con estado `'activo'`
 *
 * Deduplicación: si un plan de `planesPensiones` coincide con una posición
 * de tipo `plan_pensiones` / `plan_empleo` en `inversiones` por el criterio
 * `nombre + entidad + fechaApertura` · prevalece el plan del store
 * `planesPensiones` (modelo rico con gestora · ISIN · etc.).
 *
 * Resultado ordenado por `valor_actual` descendente.
 */
export async function getAllCartaItems(): Promise<CartaItem[]> {
  const [posicionesResult, planes] = await Promise.all([
    inversionesService.getAllPosiciones(),
    planesPensionesService.getAllPlanes(),
  ]);

  const activasInversiones = posicionesResult.activas;
  const activasPlanes = planes.filter((plan) => plan.estado === 'activo');

  const mapaAportaciones = await aportacionesPlanService.getMapaAportacionesAcumuladas(
    activasPlanes.map((plan) => plan.id),
  );

  // Construir set de dedup a partir de los planes activos de planesPensiones
  const dedupSet = new Set<string>(
    activasPlanes.map((plan) =>
      dedupKey(plan.nombre, plan.gestoraActual, plan.fechaContratacion),
    ),
  );

  // Inversiones activas filtradas: excluir tipos plan que ya están en planesPensiones
  const itemsInversiones: CartaItem[] = activasInversiones
    .filter((p) => !esCerrada(p))
    .filter((p) => {
      if (!PLAN_TIPOS.has(p.tipo)) return true;
      // Es tipo plan → dedup contra planesPensiones por nombre+entidad+fecha
      return !dedupSet.has(dedupKey(p.nombre, p.entidad, p.fecha_compra));
    })
    .map(inversionToCartaItem);

  const itemsPlanes: CartaItem[] = activasPlanes.map((plan) =>
    planPensionToCartaItem(plan, mapaAportaciones.get(plan.id) ?? 0),
  );

  return [...itemsInversiones, ...itemsPlanes].sort(
    (a, b) => b.valor_actual - a.valor_actual,
  );
}

// ── Hooks React ───────────────────────────────────────────────────────────────

/** Hook que expone `CartaItem[]` + estado de carga + función de recarga. */
export function useAllCartaItems(): {
  items: CartaItem[];
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [items, setItems] = useState<CartaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllCartaItems();
      setItems(result);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllCartaItems()
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, reload };
}

/**
 * Busca un `CartaItem` por su `posicionId` de URL:
 * - Si `posicionId` es entero positivo → busca en `inversiones`
 * - Si `posicionId` es un string no numérico (UUID) → busca en `planesPensiones`
 *
 * Devuelve `undefined` mientras carga · `null` si no encontrado.
 */
export function useCartaItemById(
  posicionId: string | undefined,
): CartaItem | null | undefined {
  const [item, setItem] = useState<CartaItem | null | undefined>(undefined);

  useEffect(() => {
    if (!posicionId) {
      setItem(null);
      return;
    }
    let cancelled = false;
    setItem(undefined); // señal de carga

    getAllCartaItems()
      .then((allItems) => {
        if (cancelled) return;
        const idNum = Number(posicionId);
        const isNumericId = Number.isInteger(idNum) && idNum > 0;
        const found = isNumericId
          ? allItems.find(
              (i) => i._origen === 'inversiones' && i._idOriginal === idNum,
            )
          : allItems.find(
              (i) => i._origen === 'planesPensiones' && i._idOriginal === posicionId,
            );
        setItem(found ?? null);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      });

    return () => {
      cancelled = true;
    };
  }, [posicionId]);

  return item;
}
