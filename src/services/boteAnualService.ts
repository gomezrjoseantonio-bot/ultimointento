// src/services/boteAnualService.ts
//
// V78 · refactor modelo alquileres v3 · servicio del Camino 2 del wizard de import XML AEAT.
//
// Un "bote anual sin identificar" (`BoteAnualSinIdentificar`) guarda el importe de alquiler
// DECLARADO en la AEAT para un (inmueble · año) que NO se enrutó a un Contract identificado:
// arrendamientos sin NIF, por habitaciones, mixtos o no-vivienda. Es historia fiscal y NO
// genera cobros previstos en Tesorería. El usuario lo concilia después vinculando Contracts
// reales que descuentan del `saldoPendiente`.
//
// Reglas de negocio (derivadas del modelo de datos de Commit 2):
//   · Máximo 1 bote por (inmuebleId · año) — índice único `inmuebleId-año`.
//   · `importeAsignado` = Σ de los `importeAsignado` de los links vinculados.
//   · `saldoPendiente` = `importeDeclarado` − `importeAsignado` (en céntimos exactos).
//   · `estado` se deriva: 0 → pendiente_total · 0<asig<decl → parcial ·
//     asig≈decl → cerrado · asig>decl → sobre_asignado.
//
// La idempotencia de re-imports (no acumular dos veces el mismo XML) es responsabilidad del
// orquestador de import (Commit 4), no de este servicio: `crearOActualizarBote` ACUMULA.

import { initDB } from './db';
import type { BoteAnualSinIdentificar, BoteContractLink, Contract } from './db';

type EstadoBote = BoteAnualSinIdentificar['estado'];

/** Redondeo a céntimos para evitar deriva de coma flotante en saldos. */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Tolerancia de 1 céntimo al comparar importes (coma flotante). */
const EPS = 0.005;

/** Deriva el estado del bote a partir de declarado vs asignado. */
function derivarEstado(importeDeclarado: number, importeAsignado: number): EstadoBote {
  if (importeAsignado <= EPS) return 'pendiente_total';
  if (importeAsignado > importeDeclarado + EPS) return 'sobre_asignado';
  if (importeAsignado >= importeDeclarado - EPS) return 'cerrado';
  return 'parcial';
}

/** Recalcula importeAsignado/saldoPendiente/estado in-place desde contractsVinculados. */
function recalcular(bote: BoteAnualSinIdentificar): BoteAnualSinIdentificar {
  const importeAsignado = round2(
    (bote.contractsVinculados ?? []).reduce((s, l) => s + (Number(l.importeAsignado) || 0), 0),
  );
  bote.importeAsignado = importeAsignado;
  bote.saldoPendiente = round2(bote.importeDeclarado - importeAsignado);
  bote.estado = derivarEstado(bote.importeDeclarado, importeAsignado);
  return bote;
}

/** Meses (1..12) en los que el rango [fechaInicio,fechaFin] de un contrato solapa con `año`. */
function mesesSolapadosEnAño(fechaInicio?: string, fechaFin?: string, año?: number): number {
  if (!año) return 0;
  const inicio = fechaInicio ? new Date(fechaInicio) : new Date(año, 0, 1);
  const fin = fechaFin ? new Date(fechaFin) : new Date(año, 11, 31);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
  const yStart = new Date(año, 0, 1);
  const yEnd = new Date(año, 11, 31);
  const start = inicio > yStart ? inicio : yStart;
  const end = fin < yEnd ? fin : yEnd;
  if (end < start) return 0;
  const months =
    (end.getFullYear() * 12 + end.getMonth()) - (start.getFullYear() * 12 + start.getMonth()) + 1;
  return Math.max(0, Math.min(12, months));
}

export interface CrearOActualizarBoteInput {
  inmuebleId: number;
  año: number;
  importeDeclarado: number;
  díasDeclarados: number;
  nifsDetectados?: string[];
  tiposArrendamientoOriginales?: string[];
  fuente?: 'xml_aeat';
}

/** Sugerencia de vinculación · un Contract candidato con su puntuación e importe propuesto. */
export interface SugerenciaVinculacion {
  contract: Contract;
  contractId: number;
  score: number;                 // mayor = mejor candidato
  importeSugerido: number;       // céntimos · capado al saldoPendiente
  nifCoincide: boolean;
  mesesSolapados: number;
  motivos: string[];
}

export const boteAnualService = {
  /**
   * Crea el bote del (inmueble · año) o ACUMULA sobre el existente (varios bloques del XML
   * que caen al mismo bote). Preserva `importeAsignado` y los links ya vinculados; recalcula
   * saldo y estado. La deduplicación de re-imports es del orquestador (Commit 4).
   */
  async crearOActualizarBote(input: CrearOActualizarBoteInput): Promise<BoteAnualSinIdentificar> {
    const db = await initDB();
    const ahora = new Date().toISOString();
    const nifs = input.nifsDetectados ?? [];
    const tipos = input.tiposArrendamientoOriginales ?? [];

    const existente = (await db.getFromIndex(
      'botesAnualesSinIdentificar',
      'inmuebleId-año',
      [input.inmuebleId, input.año],
    )) as BoteAnualSinIdentificar | undefined;

    if (existente) {
      existente.importeDeclarado = round2(existente.importeDeclarado + input.importeDeclarado);
      existente.díasDeclarados = Math.min(366, existente.díasDeclarados + input.díasDeclarados);
      existente.nifsDetectados = Array.from(new Set([...(existente.nifsDetectados ?? []), ...nifs]));
      existente.tiposArrendamientoOriginales = Array.from(
        new Set([...(existente.tiposArrendamientoOriginales ?? []), ...tipos]),
      );
      existente.fechaUltimaModificación = ahora;
      recalcular(existente);
      await db.put('botesAnualesSinIdentificar', existente);
      return existente;
    }

    const nuevo: BoteAnualSinIdentificar = {
      inmuebleId: input.inmuebleId,
      año: input.año,
      importeDeclarado: round2(input.importeDeclarado),
      díasDeclarados: Math.min(366, input.díasDeclarados),
      nifsDetectados: Array.from(new Set(nifs)),
      tiposArrendamientoOriginales: Array.from(new Set(tipos)),
      importeAsignado: 0,
      saldoPendiente: round2(input.importeDeclarado),
      estado: 'pendiente_total',
      contractsVinculados: [],
      fuente: input.fuente ?? 'xml_aeat',
      fechaImportación: ahora,
      fechaUltimaModificación: ahora,
    };
    const id = (await db.add('botesAnualesSinIdentificar', nuevo)) as number;
    nuevo.id = id;
    return nuevo;
  },

  /** Bote de un (inmueble · año), o undefined. */
  async getBote(inmuebleId: number, año: number): Promise<BoteAnualSinIdentificar | undefined> {
    const db = await initDB();
    return (await db.getFromIndex('botesAnualesSinIdentificar', 'inmuebleId-año', [
      inmuebleId,
      año,
    ])) as BoteAnualSinIdentificar | undefined;
  },

  async getBotePorId(id: number): Promise<BoteAnualSinIdentificar | undefined> {
    const db = await initDB();
    return (await db.get('botesAnualesSinIdentificar', id)) as BoteAnualSinIdentificar | undefined;
  },

  async listarBotes(): Promise<BoteAnualSinIdentificar[]> {
    const db = await initDB();
    return (await db.getAll('botesAnualesSinIdentificar')) as BoteAnualSinIdentificar[];
  },

  async listarPorInmueble(inmuebleId: number): Promise<BoteAnualSinIdentificar[]> {
    const db = await initDB();
    const all = (await db.getAllFromIndex(
      'botesAnualesSinIdentificar',
      'inmuebleId',
      inmuebleId,
    )) as BoteAnualSinIdentificar[];
    return all.sort((a, b) => b.año - a.año);
  },

  /**
   * Vincula (o re-asigna) un Contract al bote con un importe. Si el Contract ya estaba
   * vinculado, actualiza su importe. Recalcula saldo y estado.
   */
  async vincularContract(
    boteId: number,
    contractId: number,
    importeAsignado: number,
    origen: BoteContractLink['origen'] = 'manual_usuario',
  ): Promise<BoteAnualSinIdentificar> {
    const db = await initDB();
    const bote = (await db.get('botesAnualesSinIdentificar', boteId)) as
      | BoteAnualSinIdentificar
      | undefined;
    if (!bote) throw new Error(`[boteAnualService] bote ${boteId} no existe`);

    const ahora = new Date().toISOString();
    const links = bote.contractsVinculados ?? [];
    const idx = links.findIndex((l) => l.contractId === contractId);
    const link: BoteContractLink = {
      contractId,
      importeAsignado: round2(importeAsignado),
      fechaVinculación: ahora,
      origen,
    };
    if (idx >= 0) links[idx] = link;
    else links.push(link);
    bote.contractsVinculados = links;
    bote.fechaUltimaModificación = ahora;
    recalcular(bote);
    await db.put('botesAnualesSinIdentificar', bote);
    return bote;
  },

  /** Quita un Contract del bote y recalcula. No-op si no estaba vinculado. */
  async desvincularContract(boteId: number, contractId: number): Promise<BoteAnualSinIdentificar> {
    const db = await initDB();
    const bote = (await db.get('botesAnualesSinIdentificar', boteId)) as
      | BoteAnualSinIdentificar
      | undefined;
    if (!bote) throw new Error(`[boteAnualService] bote ${boteId} no existe`);
    bote.contractsVinculados = (bote.contractsVinculados ?? []).filter(
      (l) => l.contractId !== contractId,
    );
    bote.fechaUltimaModificación = new Date().toISOString();
    recalcular(bote);
    await db.put('botesAnualesSinIdentificar', bote);
    return bote;
  },

  /**
   * Sugiere Contracts del mismo inmueble que solapan con el año del bote, para vincular.
   *
   * Heurística (interpretación · revisable):
   *   · candidatos = Contracts con `inmuebleId` del bote, NO sin_identificar, que solapan ≥1 mes
   *     con el año, y que NO estén ya vinculados a este bote.
   *   · score = +1000 si algún NIF (inquilino.dni o cotitulares) ∈ bote.nifsDetectados, +meses solapados.
   *   · importeSugerido = mesesSolapados × rentaMensual, capado al `saldoPendiente`.
   * Ordenadas por score desc.
   */
  async sugerirContracts(boteId: number): Promise<SugerenciaVinculacion[]> {
    const db = await initDB();
    const bote = (await db.get('botesAnualesSinIdentificar', boteId)) as
      | BoteAnualSinIdentificar
      | undefined;
    if (!bote) return [];

    const yaVinculados = new Set((bote.contractsVinculados ?? []).map((l) => l.contractId));
    const nifsBote = new Set((bote.nifsDetectados ?? []).map((n) => n.trim().toUpperCase()).filter(Boolean));

    const contracts = (await db.getAll('contracts')) as Contract[];
    const sugerencias: SugerenciaVinculacion[] = [];

    for (const c of contracts) {
      if (c.id == null) continue;
      if (c.inmuebleId !== bote.inmuebleId) continue;
      if (c.estadoContrato === 'sin_identificar') continue;
      if (yaVinculados.has(c.id)) continue;

      const meses = mesesSolapadosEnAño(c.fechaInicio, c.fechaFin, bote.año);
      if (meses <= 0) continue;

      const nifsContrato = [c.inquilino?.dni, ...(c.inquilino?.cotitulares ?? [])]
        .map((n) => (n ?? '').trim().toUpperCase())
        .filter(Boolean);
      const nifCoincide = nifsContrato.some((n) => nifsBote.has(n));

      const importeSugerido = Math.min(
        round2(meses * (Number(c.rentaMensual) || 0)),
        bote.saldoPendiente,
      );

      const motivos: string[] = [`solapa ${meses} ${meses === 1 ? 'mes' : 'meses'} en ${bote.año}`];
      if (nifCoincide) motivos.unshift('NIF coincide con la declaración');

      sugerencias.push({
        contract: c,
        contractId: c.id,
        score: (nifCoincide ? 1000 : 0) + meses,
        importeSugerido: Math.max(0, importeSugerido),
        nifCoincide,
        mesesSolapados: meses,
        motivos,
      });
    }

    return sugerencias.sort((a, b) => b.score - a.score);
  },

  async eliminarBote(id: number): Promise<void> {
    const db = await initDB();
    await db.delete('botesAnualesSinIdentificar', id);
  },
};
