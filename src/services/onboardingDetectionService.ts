/**
 * Onboarding día 0 · C5 · motor de detección v1.
 *
 * Lee `movements` de las cuentas con extracto y PROPONE (nunca crea solo · §0.1.3):
 *   1. Recurrentes · ORQUESTA el motor canónico existente `compromisoDetectionService`
 *      (§0.1.6 · no se duplica · TAREA 9) · confirmar = `createCompromisosFromCandidatos`.
 *   2. Préstamo · NUEVO · cargo mensual idéntico con concepto tipo préstamo/hipoteca
 *      → propuesta que pre-rellena el wizard de préstamo (cuota · día · cuenta).
 *   3. Nómina · NUEVO · abono periódico grande del mismo pagador → propuesta que
 *      pre-rellena el wizard de nómina (neto · día · cuenta).
 *
 * Los abonos que cuadran con la renta de un contrato NO se proponen (los gestiona
 * la conciliación · nota literal del mockup).
 *
 * Decisiones persistidas en `keyval` (sin store nuevo): descartar registra en
 * `onboarding_v1_descartes` + regla negativa · confirmar refuerza learning rules.
 */
import { initDB } from './db';
import type { Movement } from './db';
import {
  detectCompromisos,
  type CandidatoCompromiso,
} from './compromisoDetectionService';
import {
  createCompromisosFromCandidatos,
  type CreationOptions,
} from './compromisoCreationService';
import { createOrUpdateRule, buildLearnKey } from './movementLearningService';
import { addDescarte, isDescartado } from './onboardingProgressService';
import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';

export type SugerenciaTipo = 'recurrente' | 'prestamo' | 'nomina';
export type Cadencia = 'mensual' | 'trimestral' | 'anual';

// FIX PUNTO 4 (P10) · ámbito de un recurrente · un gasto puede ser de un
// INMUEBLE (IBI · comunidad · seguro · suministros de un piso de alquiler →
// `gastosInmueble` · deducible) o PERSONAL (hogar). El motor pre-marca un
// ámbito por el concepto, pero el usuario SIEMPRE confirma o cambia (§3.6).
export interface InmuebleLite {
  id: number;
  alias?: string;
  address?: string;
}
export interface AmbitoRecurrente {
  ambito: 'personal' | 'inmueble';
  inmuebleId?: number;
}

export interface PrestamoPrefill {
  cuota: number;
  dia: number;
  cuentaId: number;
  concepto: string;
}
export interface NominaPrefill {
  neto: number;
  dia: number;
  cuentaId: number;
  pagador: string;
}

export interface Sugerencia {
  tipo: SugerenciaTipo;
  /** Identidad estable · sirve para descartes y para no reproponer. */
  clave: string;
  nombre: string;
  meta: string;
  contraparte: string;
  accountId: number;
  /** Importe representativo en valor absoluto (para mostrar). */
  importe: number;
  cadencia: Cadencia;
  importeVariable?: boolean;
  /** Texto de lo que falta · marca la fila como `needs` (borde oro). */
  needs?: string;
  prefill?: PrestamoPrefill | NominaPrefill;
  /** Candidato canónico (solo recurrentes) · para la confirmación. */
  candidato?: CandidatoCompromiso;
}

// ── Helpers de agrupación ─────────────────────────────────────────────────────

const LOAN_RE = /prestamo|préstamo|hipoteca|hipotecario|mortgage|loan|cuota\s+prest/i;

function normContraparte(m: Movement): string {
  const base = (m.counterparty || m.description || '').toString();
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diaDelMes(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 1 : d.getUTCDate();
}

function yearMonth(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

/** Moda (valor más frecuente) de una lista de números. */
function moda(nums: number[]): number {
  const counts = new Map<number, number>();
  let best = nums[0] ?? 1;
  let bestCount = 0;
  for (const n of nums) {
    const c = (counts.get(n) ?? 0) + 1;
    counts.set(n, c);
    if (c > bestCount) {
      bestCount = c;
      best = n;
    }
  }
  return best;
}

interface Grupo {
  contraparte: string;
  accountId: number;
  movimientos: Movement[];
  meses: Set<string>;
}

/** Agrupa por contraparte normalizada + cuenta + signo. */
function agrupar(movements: Movement[], signo: 'cargo' | 'abono'): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const m of movements) {
    if (signo === 'cargo' && m.amount >= 0) continue;
    if (signo === 'abono' && m.amount <= 0) continue;
    const cp = normContraparte(m);
    if (!cp) continue;
    const key = `${cp}::${m.accountId}`;
    let g = mapa.get(key);
    if (!g) {
      g = { contraparte: cp, accountId: m.accountId, movimientos: [], meses: new Set() };
      mapa.set(key, g);
    }
    g.movimientos.push(m);
    g.meses.add(yearMonth(m.date));
  }
  return [...mapa.values()];
}

const MIN_OCURRENCIAS = 3;

function esMensual(g: Grupo): boolean {
  return g.meses.size >= MIN_OCURRENCIAS;
}

// ── Detector de préstamos (NUEVO) ─────────────────────────────────────────────

/**
 * Cargo mensual idéntico con concepto de préstamo/hipoteca → 1 propuesta.
 * Pre-relleno: cuota · día de cargo · cuenta. Falta TIN y plazo (el usuario).
 */
export function detectarPrestamosDesdeMovimientos(movements: Movement[]): Sugerencia[] {
  const out: Sugerencia[] = [];
  for (const g of agrupar(movements, 'cargo')) {
    if (!esMensual(g)) continue;
    const esPrestamo = g.movimientos.some((m) => LOAN_RE.test(m.description || '') || LOAN_RE.test(m.counterparty || ''));
    if (!esPrestamo) continue;
    const importes = g.movimientos.map((m) => Math.round(Math.abs(m.amount) * 100) / 100);
    const identicos = new Set(importes).size === 1;
    if (!identicos) continue; // cuota idéntica · señal fuerte de préstamo

    const cuota = importes[0];
    const dia = moda(g.movimientos.map((m) => diaDelMes(m.date)));
    const nombre = g.movimientos[0].description || g.movimientos[0].counterparty || 'Préstamo';
    out.push({
      tipo: 'prestamo',
      clave: `prestamo:${g.contraparte}:${Math.round(cuota)}:${g.accountId}`,
      nombre,
      meta: `Cuota idéntica · ${g.meses.size} meses · día ${dia} · cuenta ${g.accountId} · falta TIN y plazo`,
      contraparte: g.contraparte,
      accountId: g.accountId,
      importe: cuota,
      cadencia: 'mensual',
      needs: 'Falta TIN y plazo para el cuadro',
      prefill: { cuota, dia, cuentaId: g.accountId, concepto: nombre },
    });
  }
  return out;
}

// ── Detector de nómina (NUEVO) ────────────────────────────────────────────────

const NOMINA_MIN_IMPORTE = 600;

/**
 * Abono periódico grande del mismo pagador → 1 propuesta de nómina. Los abonos
 * que cuadran con la renta de un contrato (±2%) se EXCLUYEN (los concilia Atlas).
 */
export function detectarNominasDesdeMovimientos(
  movements: Movement[],
  rentasContrato: number[] = [],
): Sugerencia[] {
  const out: Sugerencia[] = [];
  const cuadraConContrato = (importe: number): boolean =>
    rentasContrato.some((r) => r > 0 && Math.abs(importe - r) / r <= 0.02);

  for (const g of agrupar(movements, 'abono')) {
    if (!esMensual(g)) continue;
    const importes = g.movimientos.map((m) => Math.round(Math.abs(m.amount) * 100) / 100);
    const neto = moda(importes);
    if (neto < NOMINA_MIN_IMPORTE) continue;
    if (cuadraConContrato(neto)) continue; // renta de alquiler · no es nómina

    const dia = moda(g.movimientos.map((m) => diaDelMes(m.date)));
    const pagador = g.movimientos[0].counterparty || g.movimientos[0].description || 'Pagador';
    out.push({
      tipo: 'nomina',
      clave: `nomina:${g.contraparte}:${Math.round(neto)}:${g.accountId}`,
      nombre: `Abono periódico · "${pagador}"`,
      meta: `${g.meses.size} meses · día ${dia} · cuenta ${g.accountId} · falta bruto y nº de pagas`,
      contraparte: g.contraparte,
      accountId: g.accountId,
      importe: neto,
      cadencia: 'mensual',
      needs: 'Falta bruto y nº de pagas',
      prefill: { neto, dia, cuentaId: g.accountId, pagador },
    });
  }
  return out;
}

// ── Recurrentes · orquesta el motor canónico ──────────────────────────────────

function importeRepresentativo(imp: CandidatoCompromiso['importeInferido']): number {
  if (!imp) return 0;
  if (imp.modo === 'fijo') return imp.importe;
  if (imp.modo === 'variable') return imp.importeMedio;
  if (imp.modo === 'diferenciadoPorMes') {
    const xs = imp.importesPorMes.filter((n) => n > 0);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  }
  const vals = Object.values(imp.importesPorPago);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function candidatoToSugerencia(c: CandidatoCompromiso): Sugerencia {
  const importe = Math.abs(importeRepresentativo(c.importeInferido) || c.ocurrencias[0]?.importe || 0);
  const variable = c.importeInferido ? c.importeInferido.modo !== 'fijo' : false;
  return {
    tipo: 'recurrente',
    clave: `recurrente:${c.id}`,
    nombre: c.propuesta?.alias || c.conceptoNormalizado,
    meta: `Visto ${c.ocurrencias.length} veces · cuenta ${c.cuentaCargo}`,
    contraparte: c.conceptoNormalizado,
    accountId: c.cuentaCargo,
    importe,
    cadencia: 'mensual',
    importeVariable: variable,
    candidato: c,
  };
}

export async function detectarRecurrentes(): Promise<Sugerencia[]> {
  const report = await detectCompromisos();
  return report.candidatos.map(candidatoToSugerencia);
}

// ── Orquestación · todas las sugerencias ──────────────────────────────────────

interface CargarDatos {
  movements: Movement[];
  rentasContrato: number[];
}

async function cargarDatos(): Promise<CargarDatos> {
  const db = await initDB();
  const [movements, contracts] = await Promise.all([
    db.getAll('movements') as Promise<Movement[]>,
    db.getAll('contracts') as Promise<Array<{ rentaMensual?: number }>>,
  ]);
  const rentasContrato = contracts.map((c) => c.rentaMensual ?? 0).filter((r) => r > 0);
  return { movements, rentasContrato };
}

/** Filtra las sugerencias ya descartadas por el usuario (no reaparecen). */
async function filtrarDescartadas(sugs: Sugerencia[]): Promise<Sugerencia[]> {
  const out: Sugerencia[] = [];
  for (const s of sugs) {
    if (!(await isDescartado(s.tipo, s.clave))) out.push(s);
  }
  return out;
}

export async function detectarSugerencias(): Promise<Sugerencia[]> {
  const { movements, rentasContrato } = await cargarDatos();
  const [recurrentes] = await Promise.all([detectarRecurrentes()]);
  const prestamos = detectarPrestamosDesdeMovimientos(movements);
  const nominas = detectarNominasDesdeMovimientos(movements, rentasContrato);
  return filtrarDescartadas([...recurrentes, ...prestamos, ...nominas]);
}

// ── Decisiones · confirmar / descartar (§2.4) ─────────────────────────────────

async function reforzarLearning(sug: Sugerencia, override?: AmbitoRecurrente): Promise<void> {
  const cand = sug.candidato;
  if (!cand) return;
  try {
    const movId = cand.ocurrencias[0]?.movementId;
    const db = await initDB();
    const mov = movId != null ? ((await db.get('movements', movId)) as Movement | undefined) : undefined;
    // El ámbito efectivo es el que confirmó el usuario · si no lo tocó, el de
    // la propuesta del motor (P10 · nunca cruzar inmueble/personal).
    const ambitoEfectivo = override?.ambito ?? cand.propuesta.ambito;
    const inmuebleIdEfectivo =
      override?.ambito === 'inmueble' ? override.inmuebleId : cand.propuesta.inmuebleId;
    await createOrUpdateRule({
      learnKey: mov ? buildLearnKey(mov) : `onboarding:${cand.conceptoNormalizado}`,
      categoria: cand.propuesta.categoria || 'otros',
      ambito: ambitoEfectivo === 'inmueble' ? 'INMUEBLE' : 'PERSONAL',
      inmuebleId: inmuebleIdEfectivo != null ? String(inmuebleIdEfectivo) : undefined,
      movement: mov,
    });
  } catch {
    // Learning best-effort · no debe bloquear la creación.
  }
}

// FIX PUNTO 4 (P10) · keywords típicas de un gasto recurrente de inmueble.
const INMUEBLE_KEYWORDS =
  /comunidad|administrador\s+de\s+fincas|\bibi\b|seguro\s+hogar|suministro|derrama|alcantarillado|basura|vado/i;

/**
 * Pre-marca el ámbito de un recurrente por su concepto (P10 · §3.6). El
 * usuario SIEMPRE confirma o cambia · esto es solo el valor por defecto:
 *   1. si el concepto menciona el alias/dirección de un inmueble → ese inmueble;
 *   2. si trae palabras típicas de gasto de inmueble → el primer inmueble;
 *   3. en cualquier otro caso → personal.
 */
export function adivinarAmbitoRecurrente(
  concepto: string,
  inmuebles: InmuebleLite[],
): AmbitoRecurrente {
  const texto = (concepto || '').toLowerCase();
  for (const inm of inmuebles) {
    const tokens = [inm.alias, inm.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    if (tokens.some((tok) => texto.includes(tok))) {
      return { ambito: 'inmueble', inmuebleId: inm.id };
    }
  }
  if (INMUEBLE_KEYWORDS.test(texto) && inmuebles.length > 0) {
    return { ambito: 'inmueble', inmuebleId: inmuebles[0].id };
  }
  return { ambito: 'personal' };
}

/**
 * Confirma una sugerencia de RECURRENTE: crea el compromiso por su servicio
 * canónico, refuerza el learning rule y la marca para no reproponer.
 * (Préstamo/nómina se "completan" abriendo su wizard pre-rellenado en la UI.)
 *
 * FIX PUNTO 4 (P10) · `ambito` es el que confirmó el usuario. Si es inmueble,
 * se reescribe la propuesta a `ambito='inmueble'` + `inmuebleId` + bolsa
 * `inmueble` (deducible · NUNCA una renta) vía `ajustesPorCandidato`. Si es
 * personal, se crea tal cual (Personal · Gastos). Jamás se cruzan.
 */
export async function confirmarSugerencia(
  sug: Sugerencia,
  ambito?: AmbitoRecurrente,
): Promise<void> {
  if (sug.tipo === 'recurrente' && sug.candidato) {
    let options: CreationOptions | undefined;
    if (ambito?.ambito === 'inmueble' && ambito.inmuebleId != null) {
      const override: Partial<CompromisoRecurrente> = {
        ambito: 'inmueble',
        inmuebleId: ambito.inmuebleId,
        personalDataId: undefined,
        bolsaPresupuesto: 'inmueble',
      };
      options = { ajustesPorCandidato: new Map([[sug.candidato.id, override]]) };
    }
    await createCompromisosFromCandidatos([sug.candidato], options);
    await reforzarLearning(sug, ambito);
  }
  await addDescarte(sug.tipo, sug.clave); // gestionada · no reaparece
}

/** Descarta una sugerencia: persiste el descarte (regla negativa · no reaparece). */
export async function descartarSugerencia(sug: Sugerencia): Promise<void> {
  await addDescarte(sug.tipo, sug.clave);
}
