// ============================================================================
// ATLAS · TAREA 9.1 · compromisoDetectionService
// ============================================================================
//
// Servicio read-only que analiza el store `movements` y propone candidatos a
// `CompromisoRecurrente` siguiendo el algoritmo de 5 fases definido en
// `docs/TAREA-9-bootstrap-compromisos-recurrentes.md` §2.3.
//
// Reglas inviolables T9.1:
//   - NUNCA escribe (solo lectura)
//   - NUNCA toca movementSuggestionService ni compromisosRecurrentesService
//   - NUNCA inventa variantes de PatronRecurrente · si un cluster no encaja
//     en las 8 variantes existentes · se descarta
//   - Filtra candidatos que correspondan a vivienda habitual o a inmuebles
//     de inversión (modelo · sección 1.2 de la spec)
// ============================================================================

import { initDB } from './db';
import type { Movement, Property } from './db';
import type {
  CompromisoRecurrente,
  PatronRecurrente,
  ImporteEvento,
  PatronVariacion,
  TipoCompromiso,
  CategoriaGastoCompromiso,
  BolsaPresupuesto,
} from '../types/compromisosRecurrentes';
import type { ViviendaHabitual } from '../types/viviendaHabitual';

// ─── Defaults · spec §2.3 ──────────────────────────────────────────────────

const DEFAULT_MIN_OCURRENCIAS = 3;
const DEFAULT_MAX_ANTIGUEDAD_MESES = 18;
const DEFAULT_TOLERANCIA_IMPORTE_PERCENT = 5;
const DEFAULT_TOLERANCIA_DIA_MES = 3;

// Score mínimo para que un candidato pase el filtrado fase 5.
const MIN_CONFIDENCE = 60;

// Proveedores españoles reconocidos · suma score +5 (spec §2.3 fase 5)
const PROVEEDORES_RECONOCIDOS: Record<string, { tipo: TipoCompromiso; subtipo?: string }> = {
  IBERDROLA: { tipo: 'suministro', subtipo: 'luz' },
  ENDESA: { tipo: 'suministro', subtipo: 'luz' },
  NATURGY: { tipo: 'suministro', subtipo: 'gas' },
  REPSOL: { tipo: 'suministro', subtipo: 'gas' },
  HOLALUZ: { tipo: 'suministro', subtipo: 'luz' },
  SOMENERGIA: { tipo: 'suministro', subtipo: 'luz' },
  EDP: { tipo: 'suministro', subtipo: 'luz' },
  AQUALIA: { tipo: 'suministro', subtipo: 'agua' },
  CANAL: { tipo: 'suministro', subtipo: 'agua' },
  MOVISTAR: { tipo: 'suministro', subtipo: 'movil' },
  ORANGE: { tipo: 'suministro', subtipo: 'movil' },
  VODAFONE: { tipo: 'suministro', subtipo: 'movil' },
  YOIGO: { tipo: 'suministro', subtipo: 'movil' },
  PEPEPHONE: { tipo: 'suministro', subtipo: 'movil' },
  MASMOVIL: { tipo: 'suministro', subtipo: 'movil' },
  DIGI: { tipo: 'suministro', subtipo: 'movil' },
  NETFLIX: { tipo: 'suscripcion' },
  SPOTIFY: { tipo: 'suscripcion' },
  HBO: { tipo: 'suscripcion' },
  DISNEY: { tipo: 'suscripcion' },
  AMAZON: { tipo: 'suscripcion' },
  PRIME: { tipo: 'suscripcion' },
  APPLE: { tipo: 'suscripcion' },
  GOOGLE: { tipo: 'suscripcion' },
  YOUTUBE: { tipo: 'suscripcion' },
  MAPFRE: { tipo: 'seguro' },
  ALLIANZ: { tipo: 'seguro' },
  MUTUA: { tipo: 'seguro' },
  AXA: { tipo: 'seguro' },
  GENERALI: { tipo: 'seguro' },
  LINEADIRECTA: { tipo: 'seguro' },
  REALE: { tipo: 'seguro' },
  PELAYO: { tipo: 'seguro' },
  SANITAS: { tipo: 'seguro' },
  ADESLAS: { tipo: 'seguro' },
  ASISA: { tipo: 'seguro' },
  DKV: { tipo: 'seguro' },
};

// Tokens que sugieren relación con vivienda habitual o inmueble cuando no
// hay match directo por dirección/referencia · usado solo si la vivienda
// habitual está activa.
const TOKENS_COMUNIDAD = ['COMUNIDAD', 'PROPIETARIOS', 'VECINOS'];
const TOKENS_IBI = ['IBI', 'IBIS'];
const TOKENS_HIPOTECA = ['HIPOTECA', 'PRESTAMO'];
const TOKENS_ALQUILER = ['ALQUILER', 'RENTA'];

// ─── Tipos públicos · spec §2.3 ────────────────────────────────────────────

export interface CandidatoCompromiso {
  id: string;
  conceptoNormalizado: string;
  cuentaCargo: number;
  ocurrencias: Array<{
    movementId: number;
    fecha: string;
    importe: number;
    descripcionRaw: string;
  }>;
  patronInferido: PatronRecurrente;
  importeInferido: ImporteEvento;
  variacionInferida: PatronVariacion;
  confidence: number;
  razonesScore: string[];
  propuesta: Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;
  avisos: string[];
}

export interface DetectionOptions {
  minOcurrencias?: number;
  maxAntiguedadMeses?: number;
  excluirYaConfirmados?: boolean;
  toleranciaImportePercent?: number;
  toleranciaDiaMes?: number;
}

export interface DetectionReport {
  candidatos: CandidatoCompromiso[];
  estadisticas: {
    movementsAnalizados: number;
    movementsAgrupados: number;
    movementsDescartados: number;
    clustersTotales: number;
    candidatosPropuestos: number;
    candidatosFiltrados: {
      porViviendaHabitual: number;
      porInmuebleInversion: number;
      porCompromisoExistente: number;
      porScoreInsuficiente: number;
    };
  };
  warnings: string[];
}

// ─── Utilidades de normalización y estadística ─────────────────────────────

export function normalizeDescription(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 3)
    .slice(0, 3)
    .join(' ');
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stdDev(values) / m;
}

function roundMode(values: number[]): number {
  if (values.length === 0) return 1;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function modeMonths(values: number[]): number[] {
  // Devuelve los meses únicos ordenados ascendente
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function intervalDaysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

function subMonthsISO(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

// ─── Tipo interno para el pipeline ─────────────────────────────────────────

interface NormalizedMovement {
  movementId: number;
  accountId: number;
  fecha: string;
  importe: number; // siempre positivo
  descripcionRaw: string;
  conceptoNormalizado: string;
}

// ─── Fase 1 · Carga y normalización ───────────────────────────────────────

async function fase1_loadAndNormalize(
  opts: Required<Pick<DetectionOptions, 'maxAntiguedadMeses'>>,
): Promise<{ normalized: NormalizedMovement[]; totalEnDB: number }> {
  const db = await initDB();
  const all: Movement[] = await db.getAll('movements');
  const cutoff = subMonthsISO(new Date(), opts.maxAntiguedadMeses);

  // El spec menciona `unifiedStatus !== 'ignorado'` pero ese literal no existe
  // en `UnifiedMovementStatus` (definido en db.ts línea 990). El equivalente
  // legacy `state === 'ignored'` sí existe y es lo que usamos para excluir
  // movements que el usuario ha marcado como ignorados manualmente.
  const filtered = all.filter(
    (m) =>
      m.amount < 0 &&
      m.state !== 'ignored' &&
      new Date(m.date).getTime() >= cutoff.getTime(),
  );

  const normalized: NormalizedMovement[] = filtered
    .filter((m) => m.id != null && m.accountId != null)
    .map((m) => ({
      movementId: m.id as number,
      accountId: m.accountId,
      fecha: m.date,
      importe: Math.abs(m.amount),
      descripcionRaw: m.description ?? '',
      conceptoNormalizado: normalizeDescription(m.description ?? ''),
    }))
    .filter((m) => m.conceptoNormalizado.length > 0);

  return { normalized, totalEnDB: all.length };
}

// ─── Fase 2 · Clustering por concepto + cuenta ────────────────────────────

function fase2_cluster(
  normalized: NormalizedMovement[],
  minOcurrencias: number,
): NormalizedMovement[][] {
  const clusters = new Map<string, NormalizedMovement[]>();
  for (const m of normalized) {
    const key = `${m.conceptoNormalizado}|${m.accountId}`;
    const list = clusters.get(key) ?? [];
    list.push(m);
    clusters.set(key, list);
  }
  return Array.from(clusters.values()).filter((list) => list.length >= minOcurrencias);
}

// ─── Fase 3 · Inferencia de patrón temporal ────────────────────────────────

interface InferenciaTemporal {
  patron: PatronRecurrente;
  intervaloMediano: number;
  desviacionDias: number;
}

function fase3_inferTemporalPattern(
  occurrences: NormalizedMovement[],
): InferenciaTemporal | null {
  if (occurrences.length < 2) return null;
  const sorted = [...occurrences].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const intervalos: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervalos.push(intervalDaysBetween(sorted[i - 1].fecha, sorted[i].fecha));
  }
  const med = median(intervalos);
  const dev = stdDev(intervalos);

  const dias = sorted.map((o) => new Date(o.fecha).getDate());
  const meses = sorted.map((o) => new Date(o.fecha).getMonth() + 1);

  if (med >= 28 && med <= 32 && dev <= 3) {
    return {
      patron: { tipo: 'mensualDiaFijo', dia: roundMode(dias) },
      intervaloMediano: med,
      desviacionDias: dev,
    };
  }
  if (med >= 58 && med <= 62 && dev <= 4) {
    return {
      patron: {
        tipo: 'cadaNMeses',
        cadaNMeses: 2,
        mesAncla: meses[0],
        dia: roundMode(dias),
      },
      intervaloMediano: med,
      desviacionDias: dev,
    };
  }
  if (med >= 88 && med <= 95 && dev <= 5) {
    return {
      patron: {
        tipo: 'cadaNMeses',
        cadaNMeses: 3,
        mesAncla: meses[0],
        dia: roundMode(dias),
      },
      intervaloMediano: med,
      desviacionDias: dev,
    };
  }
  if (med >= 178 && med <= 188 && dev <= 8) {
    return {
      patron: {
        tipo: 'cadaNMeses',
        cadaNMeses: 6,
        mesAncla: meses[0],
        dia: roundMode(dias),
      },
      intervaloMediano: med,
      desviacionDias: dev,
    };
  }
  if (med >= 358 && med <= 372 && dev <= 12) {
    return {
      patron: {
        tipo: 'anualMesesConcretos',
        mesesPago: modeMonths(meses),
        diaPago: roundMode(dias),
      },
      intervaloMediano: med,
      desviacionDias: dev,
    };
  }
  return null;
}

// ─── Fase 4 · Inferencia de importe ────────────────────────────────────────

interface InferenciaImporte {
  importe: ImporteEvento;
  cv: number;
  variacion: PatronVariacion;
  avisoVariacion?: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasMonthlyPattern(occurrences: NormalizedMovement[]): boolean {
  // Heurística · si las ocurrencias se concentran en meses concretos con
  // importes consistentes intra-mes (rangos de variación tipo factura luz),
  // hay patrón mensual diferenciado.
  const porMes = new Map<number, number[]>();
  for (const o of occurrences) {
    const m = new Date(o.fecha).getMonth() + 1;
    const list = porMes.get(m) ?? [];
    list.push(o.importe);
    porMes.set(m, list);
  }
  if (porMes.size < 4) return false;
  // si la variación intra-mes (CV medio) es razonable y hay diferencias claras
  // entre meses, es un patrón mensual diferenciado.
  let intraMesCv = 0;
  for (const list of porMes.values()) {
    intraMesCv += coefficientOfVariation(list);
  }
  intraMesCv = intraMesCv / porMes.size;
  return intraMesCv < 0.15;
}

function groupByMonth(occurrences: NormalizedMovement[]): number[] {
  const porMes = new Map<number, number[]>();
  for (const o of occurrences) {
    const m = new Date(o.fecha).getMonth() + 1;
    const list = porMes.get(m) ?? [];
    list.push(o.importe);
    porMes.set(m, list);
  }
  // Devuelve array de 12 elementos · ene→dic · 0 si no hay datos en el mes
  const out: number[] = new Array(12).fill(0);
  for (const [m, importes] of porMes) {
    out[m - 1] = round2(mean(importes));
  }
  return out;
}

function detectaSubidaProgresiva(occurrences: NormalizedMovement[]): boolean {
  // ordena por fecha y comprueba si el último es notablemente mayor que el primero
  if (occurrences.length < 3) return false;
  const sorted = [...occurrences].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const first = sorted[0].importe;
  const last = sorted[sorted.length - 1].importe;
  return last > first * 1.05;
}

function fase4_inferImporte(
  occurrences: NormalizedMovement[],
): InferenciaImporte | null {
  const importes = occurrences.map((o) => o.importe);
  const cv = coefficientOfVariation(importes);
  const subida = detectaSubidaProgresiva(occurrences);

  if (cv < 0.005) {
    return {
      importe: { modo: 'fijo', importe: round2(median(importes)) },
      cv,
      variacion: { tipo: 'sinVariacion' },
    };
  }
  // Subida progresiva detectada · prevalece sobre clasificación por CV ·
  // se trata de un "variable" con cambio de tarifa, no de un patrón mes-a-mes
  // diferenciado.
  if (subida) {
    return {
      importe: { modo: 'variable', importeMedio: round2(mean(importes)) },
      cv,
      variacion: { tipo: 'manual' },
      avisoVariacion: 'el importe sube progresivamente entre ocurrencias',
    };
  }
  if (cv < 0.05) {
    return {
      importe: { modo: 'variable', importeMedio: round2(mean(importes)) },
      cv,
      variacion: { tipo: 'manual' },
    };
  }
  if (cv < 0.2 && hasMonthlyPattern(occurrences)) {
    return {
      importe: { modo: 'diferenciadoPorMes', importesPorMes: groupByMonth(occurrences) },
      cv,
      variacion: { tipo: 'manual' },
    };
  }
  return null;
}

// ─── Fase 5 · Filtrado y scoring ───────────────────────────────────────────

interface ContextoFiltrado {
  viviendaHabitual?: ViviendaHabitual;
  properties: Property[];
  compromisosVivos: CompromisoRecurrente[];
  personalDataIdActivo?: number;
}

function tokensFromConcepto(concepto: string): string[] {
  return concepto.split(' ').filter((t) => t.length >= 3);
}

function matchVivienda(
  tokens: string[],
  vh: ViviendaHabitual | undefined,
  cuentaCargo: number,
): { match: boolean; motivo?: string } {
  if (!vh || !vh.activa) return { match: false };
  const data = vh.data;

  // Tokens semánticos generales que apuntan a vivienda habitual.
  const tokenSet = new Set(tokens);
  const hasComunidad = TOKENS_COMUNIDAD.some((t) => tokenSet.has(t));
  const hasIbi = TOKENS_IBI.some((t) => tokenSet.has(t));
  const hasHipoteca = TOKENS_HIPOTECA.some((t) => tokenSet.has(t));
  const hasAlquiler = TOKENS_ALQUILER.some((t) => tokenSet.has(t));

  // matching por cuenta · si la cuentaCargo coincide con la de la vivienda y
  // hay tokens semánticos sospechosos · descartar.
  if (data.cuentaCargo === cuentaCargo) {
    if (hasComunidad) return { match: true, motivo: 'comunidad de vivienda habitual' };
    if (hasIbi) return { match: true, motivo: 'IBI de vivienda habitual' };
    if (hasHipoteca) return { match: true, motivo: 'hipoteca de vivienda habitual' };
    if (hasAlquiler && data.tipo === 'inquilino') {
      return { match: true, motivo: 'renta de vivienda habitual' };
    }
  }

  // matching por referencia catastral si aparece en concepto (raro pero
  // posible · ej · "IBI 12345-A-12-12" · al normalizar se pierde el
  // dígito · pero por seguridad chequeamos también texto crudo en el caller)
  // -- noop aquí · el match por crudo se hace en el caller con avisos.

  return { match: false };
}

function matchInmuebleInversion(
  tokens: string[],
  descripcionRaw: string,
  properties: Property[],
): { match: boolean; motivo?: string } {
  if (properties.length === 0) return { match: false };
  const tokenSet = new Set(tokens);
  const upperRaw = descripcionRaw.toUpperCase();
  for (const p of properties) {
    if (p.state === 'vendido' || p.state === 'baja') continue;
    const aliasNorm = normalizeDescription(p.alias ?? '');
    if (aliasNorm) {
      for (const t of aliasNorm.split(' ')) {
        if (t.length >= 4 && tokenSet.has(t)) {
          return { match: true, motivo: `alias inmueble "${p.alias}"` };
        }
      }
    }
    const calleNorm = normalizeDescription(p.address ?? '');
    if (calleNorm) {
      for (const t of calleNorm.split(' ')) {
        if (t.length >= 5 && tokenSet.has(t)) {
          return { match: true, motivo: `dirección inmueble "${p.address}"` };
        }
      }
    }
    if (p.cadastralReference && upperRaw.includes(p.cadastralReference.toUpperCase())) {
      return { match: true, motivo: `referencia catastral inmueble` };
    }
  }
  return { match: false };
}

function matchCompromisoExistente(
  cuentaCargo: number,
  conceptoBancario: string,
  compromisos: CompromisoRecurrente[],
): boolean {
  const conceptoNorm = normalizeDescription(conceptoBancario);
  if (!conceptoNorm) return false;
  return compromisos.some((c) => {
    if (c.estado !== 'activo') return false;
    if (c.cuentaCargo !== cuentaCargo) return false;
    const existeNorm = normalizeDescription(c.conceptoBancario ?? '');
    if (!existeNorm) return false;
    // matching laxo · si comparten al menos una palabra significativa
    const a = new Set(conceptoNorm.split(' ').filter((t) => t.length >= 4));
    const b = existeNorm.split(' ').filter((t) => t.length >= 4);
    return b.some((t) => a.has(t));
  });
}

function inferTipoFromConcepto(
  tokens: string[],
): { tipo: TipoCompromiso; subtipo?: string; proveedorReconocido: boolean } {
  for (const t of tokens) {
    if (PROVEEDORES_RECONOCIDOS[t]) {
      return { ...PROVEEDORES_RECONOCIDOS[t], proveedorReconocido: true };
    }
  }
  // fallback heurísticas suaves
  const tokenSet = new Set(tokens);
  if (TOKENS_COMUNIDAD.some((t) => tokenSet.has(t))) {
    return { tipo: 'comunidad', proveedorReconocido: false };
  }
  if (TOKENS_IBI.some((t) => tokenSet.has(t))) {
    return { tipo: 'impuesto', proveedorReconocido: false };
  }
  return { tipo: 'otros', proveedorReconocido: false };
}

function categoriaFromTipo(
  tipo: TipoCompromiso,
): { categoria: CategoriaGastoCompromiso; bolsa: BolsaPresupuesto } {
  switch (tipo) {
    case 'suministro':
      return { categoria: 'vivienda.suministros', bolsa: 'necesidades' };
    case 'suscripcion':
      return { categoria: 'suscripciones', bolsa: 'deseos' };
    case 'seguro':
      return { categoria: 'vivienda.seguros', bolsa: 'necesidades' };
    case 'cuota':
      return { categoria: 'personal', bolsa: 'deseos' };
    case 'comunidad':
      return { categoria: 'vivienda.comunidad', bolsa: 'necesidades' };
    case 'impuesto':
      return { categoria: 'vivienda.ibi', bolsa: 'necesidades' };
    case 'otros':
    default:
      return { categoria: 'personal', bolsa: 'deseos' };
  }
}

interface ScoreCalculo {
  score: number;
  razones: string[];
}

function calcularScore(
  occurrences: NormalizedMovement[],
  temporal: InferenciaTemporal,
  importeInf: InferenciaImporte,
  proveedorReconocido: boolean,
  minOcurrencias: number,
): ScoreCalculo {
  let score = 50;
  const razones: string[] = [];

  // +5 por cada ocurrencia adicional sobre el mínimo · cap +20
  const extra = Math.min(20, Math.max(0, (occurrences.length - minOcurrencias) * 5));
  if (extra > 0) {
    score += extra;
    razones.push(`${occurrences.length} ocurrencias`);
  } else {
    razones.push(`${occurrences.length} ocurrencias (mínimo justo)`);
  }

  if (temporal.desviacionDias <= 2) {
    score += 15;
    razones.push('patrón temporal estable');
  }

  if (importeInf.importe.modo === 'fijo') {
    score += 10;
    razones.push('importe fijo');
  }

  if (proveedorReconocido) {
    score += 5;
    razones.push('proveedor reconocido');
  }

  return { score: Math.min(100, score), razones };
}

// ─── Construcción de propuesta · spec §2.3 ─────────────────────────────────

function aliasFromConcepto(concepto: string): string {
  const tokens = concepto.split(' ');
  if (tokens.length === 0) return 'Compromiso recurrente';
  // Title-case del primer token
  const main = tokens[0];
  const formatted = main.charAt(0).toUpperCase() + main.slice(1).toLowerCase();
  // Si es proveedor reconocido · prefijar con tipo legible
  const meta = PROVEEDORES_RECONOCIDOS[main];
  if (meta) {
    if (meta.tipo === 'suministro') return `Suministro ${formatted}`;
    if (meta.tipo === 'suscripcion') return `Suscripción ${formatted}`;
    if (meta.tipo === 'seguro') return `Seguro ${formatted}`;
  }
  return formatted;
}

function buildPropuesta(
  cluster: NormalizedMovement[],
  conceptoNormalizado: string,
  patron: PatronRecurrente,
  importe: ImporteEvento,
  variacion: PatronVariacion,
  personalDataId: number | undefined,
): Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'> {
  const sorted = [...cluster].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const first = sorted[0];
  const tokens = tokensFromConcepto(conceptoNormalizado);
  const tipoInf = inferTipoFromConcepto(tokens);
  const cat = categoriaFromTipo(tipoInf.tipo);
  const proveedorNombre =
    tokens.find((t) => PROVEEDORES_RECONOCIDOS[t]) ?? tokens[0] ?? 'Sin nombre';

  return {
    ambito: 'personal',
    personalDataId,
    alias: aliasFromConcepto(conceptoNormalizado),
    tipo: tipoInf.tipo,
    subtipo: tipoInf.subtipo,
    proveedor: { nombre: proveedorNombre },
    patron,
    importe,
    variacion,
    cuentaCargo: first.accountId,
    conceptoBancario: first.descripcionRaw,
    metodoPago: 'domiciliacion',
    categoria: cat.categoria,
    bolsaPresupuesto: cat.bolsa,
    responsable: 'titular',
    fechaInicio: first.fecha.slice(0, 10),
    estado: 'activo',
    derivadoDe: { fuente: 'manual', refId: 'T9-detection' },
  };
}

// ─── UUID estable · idempotencia entre runs ────────────────────────────────

function stableId(conceptoNormalizado: string, accountId: number): string {
  // ID estable basado en el cluster · garantiza idempotencia entre ejecuciones
  return `cand:${accountId}:${conceptoNormalizado.replace(/\s+/g, '_')}`;
}

// ─── API pública ───────────────────────────────────────────────────────────

export async function detectCompromisos(
  options?: DetectionOptions,
): Promise<DetectionReport> {
  const opts = {
    minOcurrencias: options?.minOcurrencias ?? DEFAULT_MIN_OCURRENCIAS,
    maxAntiguedadMeses: options?.maxAntiguedadMeses ?? DEFAULT_MAX_ANTIGUEDAD_MESES,
    excluirYaConfirmados: options?.excluirYaConfirmados ?? true,
    toleranciaImportePercent:
      options?.toleranciaImportePercent ?? DEFAULT_TOLERANCIA_IMPORTE_PERCENT,
    toleranciaDiaMes: options?.toleranciaDiaMes ?? DEFAULT_TOLERANCIA_DIA_MES,
  };

  const warnings: string[] = [];
  const candidatos: CandidatoCompromiso[] = [];
  const filtrado = {
    porViviendaHabitual: 0,
    porInmuebleInversion: 0,
    porCompromisoExistente: 0,
    porScoreInsuficiente: 0,
  };

  // Fase 1 · cargar y normalizar
  const { normalized, totalEnDB } = await fase1_loadAndNormalize({
    maxAntiguedadMeses: opts.maxAntiguedadMeses,
  });

  // Cargar contexto · vivienda habitual + inmuebles + compromisos existentes + personalData
  const db = await initDB();
  const [viviendas, properties, compromisos, personalDataAll] = await Promise.all([
    db.getAll('viviendaHabitual') as Promise<ViviendaHabitual[]>,
    db.getAll('properties') as Promise<Property[]>,
    db.getAll('compromisosRecurrentes') as Promise<CompromisoRecurrente[]>,
    db.getAll('personalData') as Promise<Array<{ id?: number }>>,
  ]);
  const viviendaActiva = viviendas.find((v) => v.activa);
  const personalDataIdActivo = personalDataAll[0]?.id;
  const ctx: ContextoFiltrado = {
    viviendaHabitual: viviendaActiva,
    properties,
    compromisosVivos: compromisos,
    personalDataIdActivo,
  };

  // Fase 2 · clustering
  const clusters = fase2_cluster(normalized, opts.minOcurrencias);
  const movementsAgrupados = clusters.reduce((s, c) => s + c.length, 0);

  // Fases 3 + 4 + 5
  for (const cluster of clusters) {
    const conceptoNormalizado = cluster[0].conceptoNormalizado;
    const cuentaCargo = cluster[0].accountId;

    const temporal = fase3_inferTemporalPattern(cluster);
    if (!temporal) {
      warnings.push(
        `cluster "${conceptoNormalizado}" descartado · patrón temporal no encaja en las 8 variantes de PatronRecurrente`,
      );
      continue;
    }

    const importeInf = fase4_inferImporte(cluster);
    if (!importeInf) {
      warnings.push(
        `cluster "${conceptoNormalizado}" descartado · importe sin patrón (gasto irregular · no compromiso)`,
      );
      continue;
    }

    const tokens = tokensFromConcepto(conceptoNormalizado);

    // Filtro · vivienda habitual
    const vh = matchVivienda(tokens, ctx.viviendaHabitual, cuentaCargo);
    if (vh.match) {
      filtrado.porViviendaHabitual += 1;
      continue;
    }

    // Filtro · inmuebles de inversión
    const inm = matchInmuebleInversion(
      tokens,
      cluster[0].descripcionRaw,
      ctx.properties,
    );
    if (inm.match) {
      filtrado.porInmuebleInversion += 1;
      continue;
    }

    // Filtro · compromiso existente
    if (
      opts.excluirYaConfirmados &&
      matchCompromisoExistente(cuentaCargo, cluster[0].descripcionRaw, ctx.compromisosVivos)
    ) {
      filtrado.porCompromisoExistente += 1;
      continue;
    }

    // Tipo + scoring
    const tipoInf = inferTipoFromConcepto(tokens);
    const score = calcularScore(
      cluster,
      temporal,
      importeInf,
      tipoInf.proveedorReconocido,
      opts.minOcurrencias,
    );

    if (score.score < MIN_CONFIDENCE) {
      filtrado.porScoreInsuficiente += 1;
      continue;
    }

    const propuesta = buildPropuesta(
      cluster,
      conceptoNormalizado,
      temporal.patron,
      importeInf.importe,
      importeInf.variacion,
      ctx.personalDataIdActivo,
    );

    const avisos: string[] = [];
    if (importeInf.avisoVariacion) avisos.push(importeInf.avisoVariacion);
    if (importeInf.cv >= 0.005 && importeInf.cv < 0.05) {
      avisos.push('importe varía suavemente · revisar variación manual');
    }

    const candidato: CandidatoCompromiso = {
      id: stableId(conceptoNormalizado, cuentaCargo),
      conceptoNormalizado,
      cuentaCargo,
      ocurrencias: cluster.map((m) => ({
        movementId: m.movementId,
        fecha: m.fecha,
        importe: m.importe,
        descripcionRaw: m.descripcionRaw,
      })),
      patronInferido: temporal.patron,
      importeInferido: importeInf.importe,
      variacionInferida: importeInf.variacion,
      confidence: score.score,
      razonesScore: score.razones,
      propuesta,
      avisos,
    };

    candidatos.push(candidato);
  }

  // Orden por score descendente · luego por ocurrencias descendente
  candidatos.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.ocurrencias.length - a.ocurrencias.length;
  });

  return {
    candidatos,
    estadisticas: {
      movementsAnalizados: totalEnDB,
      movementsAgrupados,
      movementsDescartados: normalized.length - movementsAgrupados,
      clustersTotales: clusters.length,
      candidatosPropuestos: candidatos.length,
      candidatosFiltrados: filtrado,
    },
    warnings,
  };
}
