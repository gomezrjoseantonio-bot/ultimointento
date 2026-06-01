// V78.1 (Commit 5 · histórico fiscal en detalle inmueble) · lectura cruzada año a año.
//
// El histórico fiscal de un inmueble vive en dos fuentes que NO se duplican:
//   · Botes (`BoteAnualSinIdentificar`) · rentas declaradas AEAT sin contrato identificado
//     al importar (Camino 2). Se leen TODOS los estados, incluido 'cerrado' (transitorio en
//     "Por conciliar", pero permanente aquí: es la fuente de verdad del año conciliado).
//   · Contracts Camino 1 con `ejerciciosFiscales[año]` · arrendamientos identificados que se
//     declararon de forma normal (con NIF, vivienda completa…).
//
// Esta función mergea ambas por año (descendente) para que el detalle del inmueble pinte su
// histórico fiscal completo sin migraciones ni campos persistidos nuevos.

import { initDB } from './db';
import type { BoteAnualSinIdentificar, Contract, EjercicioFiscalContrato } from './db';
import { boteAnualService } from './boteAnualService';

export interface ContractCamino1Fiscal {
  contract: Contract;
  ejercicio: EjercicioFiscalContrato;
}

export interface AñoHistoricoFiscalInmueble {
  año: number;
  /** Bote del (inmueble · año), si existe (cualquier estado). */
  bote?: BoteAnualSinIdentificar;
  /** Contracts Camino 1 con ejercicio fiscal declarado en ese año. */
  contractsCamino1: ContractCamino1Fiscal[];
}

/**
 * Devuelve el histórico fiscal declarado del inmueble, un registro por año (orden
 * descendente). Cada año puede tener 0 o 1 bote y 0..N Contracts Camino 1.
 */
export async function obtenerHistoricoFiscalInmueble(
  inmuebleId: number,
): Promise<AñoHistoricoFiscalInmueble[]> {
  const db = await initDB();

  // 1 · Botes del inmueble (todos los estados · listarPorInmueble ya ordena desc).
  const botes = await boteAnualService.listarPorInmueble(inmuebleId);

  // 2 · Contracts Camino 1 (con ejerciciosFiscales) del inmueble.
  const contracts = (await db.getAll('contracts')) as Contract[];
  const camino1ByAño = new Map<number, ContractCamino1Fiscal[]>();
  for (const c of contracts) {
    if (c.inmuebleId !== inmuebleId || !c.ejerciciosFiscales) continue;
    for (const [añoStr, ejercicio] of Object.entries(c.ejerciciosFiscales)) {
      const año = Number(añoStr);
      if (!Number.isFinite(año)) continue;
      const arr = camino1ByAño.get(año) ?? [];
      arr.push({ contract: c, ejercicio });
      camino1ByAño.set(año, arr);
    }
  }

  // 3 · Merge por año único.
  const añosUnicos = new Set<number>([
    ...botes.map((b) => b.año),
    ...Array.from(camino1ByAño.keys()),
  ]);

  return Array.from(añosUnicos)
    .sort((a, b) => b - a)
    .map((año) => ({
      año,
      bote: botes.find((b) => b.año === año),
      contractsCamino1: camino1ByAño.get(año) ?? [],
    }));
}
