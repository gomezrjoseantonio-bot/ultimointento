import type { Contract, Property } from '../../../services/db';
import { isContratoActivo } from './contratoEstado';
import { esFechaIndefinida } from './formatFechaFin';
import { estaFirmado, calcularEstadoChip } from './calcularEstadoChip';
import { parseIsoDateAsUTC } from '../../../utils/recurrenceDateUtils';
import { calcularLibresAhora, type UnidadLibre } from './calcularLibresAhora';

const MS_DIA = 1000 * 60 * 60 * 24;

export interface ItemTablero {
  contrato: Contract & { id: number };
  inmuebleAlias: string;
  diasHastaVencimiento?: number;
  diasSinFirmar?: number;
  fechaEnvioFirma?: string;
  fechaRenovacion?: string;
  nVecesRenovado?: number;
  hasta?: string;
}

export interface ItemHabitacionLibre extends UnidadLibre {}

export interface BloqueUrgenteHoyData {
  total: number;
  impago: ItemTablero[];
  libreSinCandidato: ItemHabitacionLibre[];
  firmaAtrasada: ItemTablero[];
  venceMuyProximo: ItemTablero[];
}

export interface BloqueDecisionSemanaData {
  total: number;
  vencimientos: ItemTablero[];
  firmaPendienteCorta: ItemTablero[];
}

export interface BloquePlanificarMesData {
  total: number;
  items: ItemTablero[];
}

export interface BloqueBuenasNoticiasData {
  total: number;
  renovaciones: ItemTablero[];
}

export interface StatsAnaliticos {
  tasaRenovacionYtd: number | null;
  variacionVsAnoAnteriorPp: number | null;
  duracionMediaContratosMeses: number | null;
}

export interface ClasificacionTablero {
  urgenteHoy: BloqueUrgenteHoyData;
  decisionSemana: BloqueDecisionSemanaData;
  planificarMes: BloquePlanificarMesData;
  buenasNoticias: BloqueBuenasNoticiasData;
  silenciosos: { total: number };
  statsAnaliticos: StatsAnaliticos;
  totalCategorias: number;
}

function hoyUTCMs(hoy: Date): number {
  return Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
}

export function diasHastaVencimiento(c: Contract, hoy: Date): number | null {
  if (!c.fechaFin || esFechaIndefinida(c.fechaFin)) return null;
  const fin = parseIsoDateAsUTC(c.fechaFin);
  if (Number.isNaN(fin.getTime())) return null;
  return Math.ceil((fin.getTime() - hoyUTCMs(hoy)) / MS_DIA);
}

function diasSinFirmar(c: Contract, hoy: Date): number | null {
  if (estaFirmado(c)) return null;
  const fechaEnvio = c.firma?.fechaEnvio;
  if (!fechaEnvio) return null;
  const envio = parseIsoDateAsUTC(fechaEnvio);
  if (Number.isNaN(envio.getTime())) return null;
  return Math.max(0, Math.ceil((hoyUTCMs(hoy) - envio.getTime()) / MS_DIA));
}

/**
 * Detecta el evento de renovación más reciente del contrato a partir de
 * `historicoRentas` con `origen === 'renegociacion'`. Si no hay histórico,
 * el contrato nunca se ha renovado.
 */
function ultimaRenovacion(c: Contract): { fecha: string; nVeces: number } | null {
  const hist = c.historicoRentas ?? [];
  const renegociaciones = hist
    .filter((h) => h.origen === 'renegociacion')
    .sort((a, b) => (a.fechaDesde < b.fechaDesde ? 1 : -1));
  if (renegociaciones.length === 0) return null;
  return {
    fecha: renegociaciones[0].fechaDesde,
    nVeces: renegociaciones.length,
  };
}

function enriquecer(
  c: Contract & { id: number },
  hoy: Date,
  inmuebleAlias: string,
): ItemTablero {
  const dv = diasHastaVencimiento(c, hoy);
  const ds = diasSinFirmar(c, hoy);
  const ren = ultimaRenovacion(c);
  return {
    contrato: c,
    inmuebleAlias,
    diasHastaVencimiento: dv ?? undefined,
    diasSinFirmar: ds ?? undefined,
    fechaEnvioFirma: c.firma?.fechaEnvio,
    fechaRenovacion: ren?.fecha,
    nVecesRenovado: ren?.nVeces,
    hasta: c.fechaFin,
  };
}

function calcularStatsAnaliticos(
  contratos: Contract[],
  hoy: Date,
): StatsAnaliticos {
  // Duración media · contratos definidos sólo
  const duraciones: number[] = [];
  for (const c of contratos) {
    if (!c.fechaInicio || !c.fechaFin || esFechaIndefinida(c.fechaFin)) continue;
    const ini = parseIsoDateAsUTC(c.fechaInicio);
    const fin = parseIsoDateAsUTC(c.fechaFin);
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) continue;
    const meses = (fin.getTime() - ini.getTime()) / (MS_DIA * 30.44);
    if (meses > 0) duraciones.push(meses);
  }
  const duracionMediaContratosMeses = duraciones.length > 0
    ? Math.round(duraciones.reduce((s, v) => s + v, 0) / duraciones.length)
    : null;

  // Tasa renovación YTD · contratos con historicoRentas.origen=renegociacion este año
  const yearStart = Date.UTC(hoy.getUTCFullYear(), 0, 1);
  let renovadosYtd = 0;
  let candidatosRenovacionYtd = 0;
  for (const c of contratos) {
    const hist = c.historicoRentas ?? [];
    const renegEsteAno = hist.some((h) => {
      if (h.origen !== 'renegociacion') return false;
      const f = parseIsoDateAsUTC(h.fechaDesde);
      return !Number.isNaN(f.getTime()) && f.getTime() >= yearStart;
    });
    if (renegEsteAno) {
      renovadosYtd += 1;
      candidatosRenovacionYtd += 1;
    } else if (
      c.estadoContrato === 'finalizado' ||
      c.estadoContrato === 'rescindido'
    ) {
      if (c.fechaFin) {
        const f = parseIsoDateAsUTC(c.fechaFin);
        if (!Number.isNaN(f.getTime()) && f.getTime() >= yearStart) {
          candidatosRenovacionYtd += 1;
        }
      }
    }
  }
  const tasaRenovacionYtd =
    candidatosRenovacionYtd > 0 ? renovadosYtd / candidatosRenovacionYtd : null;

  return {
    tasaRenovacionYtd,
    variacionVsAnoAnteriorPp: null,
    duracionMediaContratosMeses,
  };
}

export function clasificarTablero(
  contratos: Contract[],
  properties: Property[],
  hoy: Date = new Date(),
): ClasificacionTablero {
  const aliasById = new Map<number, string>();
  properties.forEach((p) => {
    if (p.id != null) aliasById.set(p.id, p.alias);
  });

  const activos = contratos
    .filter((c): c is Contract & { id: number } => c.id != null)
    .filter(isContratoActivo);

  // Helper local para construir items
  const item = (c: Contract & { id: number }): ItemTablero =>
    enriquecer(c, hoy, aliasById.get(c.inmuebleId) ?? `Inmueble #${c.inmuebleId}`);

  // BLOQUE 1 · URGENTE HOY
  // Impago · siempre [] hasta T3.6 (sin servicio de cobros · calcularEstadoChip
  // nunca devuelve 'impago' actualmente, pero soportamos la rama para futuro).
  const impago = activos.filter((c) => calcularEstadoChip(c, hoy) === 'impago').map(item);

  // Habitaciones libres · todas asumidas "sin candidato" hasta T4.9
  const libres = calcularLibresAhora(contratos, properties, hoy).unidades;

  // Firma atrasada > 3 días sin firmar
  const firmaAtrasada = activos
    .filter((c) => {
      if (estaFirmado(c)) return false;
      const ds = diasSinFirmar(c, hoy);
      return ds != null && ds > 3;
    })
    .map(item);

  // Vencen < 15 días
  const venceMuyProximo = activos
    .filter((c) => {
      const d = diasHastaVencimiento(c, hoy);
      return d != null && d >= 0 && d < 15;
    })
    .map(item);

  const urgenteHoy: BloqueUrgenteHoyData = {
    total: impago.length + libres.length + firmaAtrasada.length + venceMuyProximo.length,
    impago,
    libreSinCandidato: libres,
    firmaAtrasada,
    venceMuyProximo,
  };

  // BLOQUE 2 · DECISIÓN ESTA SEMANA
  const vencimientos = activos
    .filter((c) => {
      const d = diasHastaVencimiento(c, hoy);
      return d != null && d >= 15 && d <= 30;
    })
    .map(item);

  const firmaPendienteCorta = activos
    .filter((c) => {
      if (estaFirmado(c)) return false;
      const ds = diasSinFirmar(c, hoy);
      return ds != null && ds <= 3;
    })
    .map(item);

  const decisionSemana: BloqueDecisionSemanaData = {
    total: vencimientos.length + firmaPendienteCorta.length,
    vencimientos,
    firmaPendienteCorta,
  };

  // BLOQUE 3 · PLANIFICAR ESTE MES (30-90 días)
  const planificar = activos
    .filter((c) => {
      const d = diasHastaVencimiento(c, hoy);
      return d != null && d > 30 && d <= 90;
    })
    .map(item);

  const planificarMes: BloquePlanificarMesData = {
    total: planificar.length,
    items: planificar,
  };

  // BLOQUE 4 · BUENAS NOTICIAS · renovados últimos 30 días
  const renovaciones = activos
    .filter((c) => {
      const ren = ultimaRenovacion(c);
      if (!ren) return false;
      const f = parseIsoDateAsUTC(ren.fecha);
      if (Number.isNaN(f.getTime())) return false;
      const dias = Math.floor((hoyUTCMs(hoy) - f.getTime()) / MS_DIA);
      return dias >= 0 && dias <= 30;
    })
    .map(item);

  const buenasNoticias: BloqueBuenasNoticiasData = {
    total: renovaciones.length,
    renovaciones,
  };

  // SILENCIOSOS · activos no encuadrados en ninguna categoría visible
  const idsClasificados = new Set<number>([
    ...impago,
    ...firmaAtrasada,
    ...venceMuyProximo,
    ...vencimientos,
    ...firmaPendienteCorta,
    ...planificar,
    ...renovaciones,
  ].map((i) => i.contrato.id));
  const silenciosos = activos.filter((c) => !idsClasificados.has(c.id));

  const totalCategorias =
    urgenteHoy.total +
    decisionSemana.total +
    planificarMes.total +
    buenasNoticias.total;

  return {
    urgenteHoy,
    decisionSemana,
    planificarMes,
    buenasNoticias,
    silenciosos: { total: silenciosos.length },
    statsAnaliticos: calcularStatsAnaliticos(contratos, hoy),
    totalCategorias,
  };
}
