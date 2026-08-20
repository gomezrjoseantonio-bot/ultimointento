// ============================================================================
// V90 · R1 · ALQUILERES · siembra de `explotacionAlquiler` (Jose, 20 ago 2026)
// ============================================================================
//
// «Poner un inmueble en alquiler» pasa a ser una entidad propia del dominio
// Alquileres (`ExplotacionAlquiler`) que referencia al inmueble, en vez de vivir
// como campos sueltos de `Property` (`modoExplotacion`, `alquilerPorHabitaciones`,
// `usoTipo`, `explotacion`). Esta migración NO pierde la configuración que ya
// tuvieran los inmuebles: por cada inmueble con señal de alquiler crea su
// explotación equivalente.
//
// Qué NO marca (queda sin explotación · uso propio · Personal):
//   · La vivienda habitual (`usoTipo === 'vivienda_habitual'`).
//   · Un inmueble sin ninguna señal de alquiler (ni uso de arrendamiento, ni
//     habitaciones activas, ni estado operativo, ni contrato). Se marca a mano
//     desde Alquileres › Disponibilidad, que es el gesto explícito del modelo.
//
// Idempotente: deduplica por `inmuebleId` (índice único), así una segunda pasada
// no crea nada. Los campos legacy de `Property` NO se borran (quedan de
// solo-lectura hasta que no queden lectores).
// ============================================================================

import type { IDBPDatabase } from 'idb';
import type { Property } from '../db';
import { explotacionDesdeLegacy } from '../explotacionAlquilerService';

export interface ResultadoV90 {
  explotacionesCreadas: number;
}

export async function migrarExplotacionAlquiler(db: IDBPDatabase<any>): Promise<ResultadoV90> {
  const resultado: ResultadoV90 = { explotacionesCreadas: 0 };

  const propiedades = ((await db.getAll('properties')) ?? []) as Property[];
  if (propiedades.length === 0) return resultado;

  // Inmuebles que ya tienen algún contrato · señal fuerte de que se alquilan.
  const contratos = ((await db.getAll('contracts')) ?? []) as Array<{ inmuebleId?: number }>;
  const conContrato = new Set<number>();
  for (const c of contratos) if (c?.inmuebleId != null) conContrato.add(c.inmuebleId);

  // Ya marcados (una pasada anterior a medias) · no duplicar.
  const yaExisten = ((await db.getAll('explotacionAlquiler')) ?? []) as Array<{ inmuebleId: number }>;
  const yaMarcados = new Set(yaExisten.map((e) => e.inmuebleId));

  const ahora = new Date().toISOString();

  for (const p of propiedades) {
    if (p.id == null || yaMarcados.has(p.id)) continue;
    const base = explotacionDesdeLegacy(p, conContrato.has(p.id));
    if (!base) continue;
    await db.add('explotacionAlquiler', { ...base, createdAt: ahora, updatedAt: ahora });
    yaMarcados.add(p.id);
    resultado.explotacionesCreadas++;
  }

  return resultado;
}
